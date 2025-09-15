import { useCallback, useMemo } from 'react';
import * as backupService from '../../services/backupService';
import * as db from '../../services/db';
import { useToast } from '../useToast';
import { FullBackupData, AIMessage } from '../../types';

export const useBackupHandlers = ({ onRestoreData, triggerSync, isSyncing, setIsSyncing, setLastSyncStatus, openConfirmModal }: {
    onRestoreData: (data: FullBackupData) => Promise<void>;
    triggerSync: (options?: { isManual?: boolean; force?: boolean }) => Promise<void>;
    isSyncing: boolean;
    setIsSyncing: (syncing: boolean) => void;
    setLastSyncStatus: (status: string) => void;
    openConfirmModal: (props: any) => void;
}) => {
  const { addToast } = useToast();

  const fetchAndRestoreFromServer = useCallback(async (isForce = false) => {
    console.log(`[Restore] Starting fetch from server. Force: ${isForce}`);
    if (isSyncing) { addToast('A sync operation is already in progress.', 'info'); return; }
    setIsSyncing(true);
    setLastSyncStatus('Fetching from server...');
    if (isForce) {
      try {
        const currentData = await db.getAllDataForBackup();
        localStorage.setItem('cogniflow-pre-fetch-backup', JSON.stringify({ version: 6, ...currentData }));
        addToast('Created a temporary local backup before fetching.', 'info');
      } catch (e) {
        addToast('Could not create pre-fetch backup. Aborting.', 'error');
        setIsSyncing(false);
        return;
      }
    }
    try {
        const fullData = await backupService.syncDataFromServer();
        let aiHistoryToRestore: AIMessage[] = [];

        if (fullData.aiChatHistory && fullData.aiChatHistory.length > 0) {
            console.log('[Restore] Found AI chat history in the main sync file.');
            aiHistoryToRestore = fullData.aiChatHistory;
        } else {
            console.log('[Restore] No AI chat history in main sync file, fetching separately.');
            aiHistoryToRestore = await backupService.syncAIChatHistoryFromServer().catch(e => {
                if ((e as any).status === 404) {
                    console.log('[Restore] No separate AI chat history file found.');
                    return [];
                }
                throw e;
            });
        }
        
        const finalData = { ...fullData, aiChatHistory: aiHistoryToRestore };
        await onRestoreData(finalData);
        console.log('[Restore] Fetch and restore successful.');
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[Restore] Fetch from server failed:", e);
        if ((e as any).status === 404 || message.includes('404')) {
            setLastSyncStatus('No sync file found on the server.');
            addToast('No sync file found on the server.', 'info');
        } else {
            setLastSyncStatus(`Error: ${message}`);
            addToast(`Failed to fetch server data: ${message}`, 'error');
        }
         setIsSyncing(false);
    }
  }, [addToast, onRestoreData, setIsSyncing, setLastSyncStatus, isSyncing]);
  
  const handleForceFetchFromServer = useCallback(() => {
    openConfirmModal({
        title: 'Force Fetch from Server',
        message: 'This will overwrite your local data with the data from the server. A local backup will be made that you can revert to from the settings page. Are you sure?',
        confirmText: 'Fetch',
        onConfirm: () => fetchAndRestoreFromServer(true),
    });
  }, [openConfirmModal, fetchAndRestoreFromServer]);
  
  const handleForceUploadToServer = useCallback(() => {
    openConfirmModal({
        title: 'Force Upload to Server',
        message: 'This will overwrite the server data with your current local data. This is useful if you know your local data is more up-to-date. Are you sure?',
        confirmText: 'Upload',
        onConfirm: () => triggerSync({ isManual: true, force: true }),
    });
  }, [openConfirmModal, triggerSync]);

  const handleCreateServerBackup = useCallback(() => {
    openConfirmModal({
        title: 'Create Manual Backup',
        message: 'Are you sure you want to create a new manual backup on the server? This does not affect your live sync file.',
        onConfirm: async () => {
            try {
                const result = await backupService.createServerBackup();
                addToast(`Successfully created backup: ${result.filename}`, 'success');
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to create backup.";
                addToast(message, 'error');
            }
        }
    });
  }, [addToast, openConfirmModal]);

  const handleRestoreFromServerBackup = useCallback((filename: string) => {
    openConfirmModal({
        title: 'Restore Live Sync from Backup',
        message: `This will overwrite your current live sync file on the server with the contents of "${filename}". Your local data will not be changed until you fetch from the server. Are you sure?`,
        onConfirm: async () => {
            try {
                await backupService.restoreFromServerBackup(filename);
                addToast(`Successfully restored live sync from "${filename}". You may want to 'Force Fetch' now.`, 'success');
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to restore from backup.";
                addToast(message, 'error');
            }
        }
    });
  }, [addToast, openConfirmModal]);
  
  const handleDeleteServerBackup = useCallback(async (filename: string) => {
    openConfirmModal({
      title: "Delete Server Backup",
      message: `Are you sure you want to permanently delete the backup file "${filename}" from the server? This action cannot be undone.`,
      onConfirm: async () => {
          try {
              await backupService.deleteServerBackup(filename);
              addToast(`Deleted backup: ${filename}`, 'success');
          } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to delete backup.";
              addToast(message, 'error');
              throw error;
          }
      }
    });
  }, [addToast, openConfirmModal]);

  return useMemo(() => ({
    fetchAndRestoreFromServer,
    handleForceFetchFromServer,
    handleForceUploadToServer,
    handleCreateServerBackup,
    handleRestoreFromServerBackup,
    handleDeleteServerBackup,
  }), [
    fetchAndRestoreFromServer, handleForceFetchFromServer, handleForceUploadToServer, 
    handleCreateServerBackup, handleRestoreFromServerBackup, handleDeleteServerBackup
  ]);
};
