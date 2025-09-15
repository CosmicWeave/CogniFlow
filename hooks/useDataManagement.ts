
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
// FIX: Imported 'DeckSeries' to resolve 'Cannot find name' error.
import { GoogleDriveFile, QuizDeck, FullBackupData, Deck, DeckType, FlashcardDeck, SeriesLevel, LearningDeck, AIMessage, DeckSeries } from '../types';
import * as backupService from '../services/backupService';
import { useStore } from '../store/store';
import { useToast } from './useToast';
import { useRouter } from '../contexts/RouterContext';
import { useModal } from '../contexts/ModalContext';
import * as db from '../services/db';
import { mergeData } from '../services/mergeService';
import { useOnlineStatus } from './useOnlineStatus';
import { DroppedFileAnalysis } from '../components/DroppedFileConfirmModal';
import { createQuestionsFromImport, createCardsFromImport } from '../services/importService';

// Import the new custom hooks
import { useDeckAndFolderHandlers } from './data-management-handlers/deckAndFolder';
import { useSeriesHandlers } from './data-management-handlers/series';
import { useSessionHandlers } from './data-management-handlers/session';
import { useAIHandlers } from './data-management-handlers/ai';
import { useBackupHandlers } from './data-management-handlers/backup';
import { useDriveHandlers } from './data-management-handlers/drive';

export interface UseDataManagementProps {
    sessionsToResume: Set<string>;
    setSessionsToResume: React.Dispatch<React.SetStateAction<Set<string>>>;
    setGeneralStudyDeck: React.Dispatch<React.SetStateAction<any | null>>;
    isGapiReady: boolean;
    isGapiSignedIn: boolean;
    gapiUser: any;
    setDriveFiles: React.Dispatch<React.SetStateAction<GoogleDriveFile[]>>;
    isSyncing: boolean;
    setIsSyncing: React.Dispatch<React.SetStateAction<boolean>>;
    setLastSyncStatus: React.Dispatch<React.SetStateAction<string>>;
    backupEnabled: boolean;
    backupApiKey: string;
    syncOnCellular: boolean;
}

export const useDataManagement = (props: UseDataManagementProps) => {
    const {
        sessionsToResume, setSessionsToResume, setGeneralStudyDeck,
        isGapiReady, isGapiSignedIn, gapiUser, setDriveFiles,
        isSyncing, setIsSyncing, setLastSyncStatus,
        backupEnabled, backupApiKey, syncOnCellular
    } = props;

    const { addToast } = useToast();
    const { openModal, closeModal } = useModal();
    const { isOnline, isMetered } = useOnlineStatus();

    const openConfirmModal = useCallback((payload: any) => openModal('confirm', payload), [openModal]);

    const handleRestoreData = useCallback(async (data: FullBackupData) => {
        console.log(`[DataMgmt] Restore process initiated from a backup file.`);
        try {
            await db.performAtomicRestore(data);
            addToast("Data restored successfully. The app will now reload.", 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error("Failed to restore data:", error);
            addToast("There was an error restoring your data.", "error");
        }
    }, [addToast]);

    const handleMergeResolution = useCallback(async (mergedData: FullBackupData) => {
        await handleRestoreData(mergedData);
        localStorage.setItem('cogniflow-post-merge-sync', 'true');
    }, [handleRestoreData]);
    
    // --- Stabilized Sync Trigger ---
    const handleSyncRef = useRef<((options: any) => Promise<void>) | null>(null);
    const triggerSync = useCallback((options: any = { isManual: false }): Promise<void> => {
        if (handleSyncRef.current) {
            return handleSyncRef.current(options);
        }
        console.warn('[Sync] triggerSync called before handleSync was ready.');
        return Promise.resolve();
    }, []);

    // --- Call custom hooks at the top level ---
    const deckAndFolderHandlers = useDeckAndFolderHandlers({ triggerSync, openConfirmModal });
    const seriesHandlers = useSeriesHandlers({ triggerSync, ...deckAndFolderHandlers });
    const sessionHandlers = useSessionHandlers({ sessionsToResume, setSessionsToResume, setGeneralStudyDeck, ...deckAndFolderHandlers });
    const backupHandlers = useBackupHandlers({ onRestoreData: handleRestoreData, triggerSync, isSyncing, setIsSyncing, setLastSyncStatus, openConfirmModal });
    const driveHandlers = useDriveHandlers({ openConfirmModal, openRestoreFromDriveModal: () => openModal('restoreFromDrive'), setDriveFiles, onRestoreData: handleRestoreData });
    const aiHandlers = useAIHandlers({ deckAndFolderHandlers, seriesHandlers });
    
    // --- THE MAIN SYNC HANDLER ---
    const handleSync = useCallback(async (options: { isManual?: boolean, dataToSync?: backupService.ServerSyncData, force?: boolean } = {}) => {
        const { isManual = false, dataToSync, force = false } = options;
        
        console.log(`[Sync] Triggered sync. Online: ${isOnline}, Manual: ${isManual}, Force: ${force}.`);
        
        if (!isOnline) { if (isManual) addToast("Cannot sync while offline.", "error"); setLastSyncStatus("Offline, sync paused."); return; }
        if (!isManual && isMetered && !syncOnCellular) { setLastSyncStatus('Sync paused on mobile data.'); return; }
        if (!backupEnabled || !backupApiKey) { if (isManual) addToast('Server sync is not enabled or API key is missing.', 'error'); return; }
        if (isSyncing) { if (isManual) addToast('A sync operation is already in progress.', 'info'); return; }

        setIsSyncing(true);
        setLastSyncStatus(force ? 'Force uploading...' : 'Syncing...');
        if (isManual && !dataToSync) addToast(force ? 'Force upload started...' : 'Sync started...', 'info');

        try {
            const { lastModified: localLastModified } = useStore.getState();
            const lastSyncTimestamp = localStorage.getItem('cogniflow-lastSyncTimestamp');
            const localHasChanges = localLastModified !== null && (!lastSyncTimestamp || localLastModified > new Date(lastSyncTimestamp).getTime());
            
            if (force || dataToSync) {
                const { timestamp, etag } = await backupService.syncDataToServer(dataToSync, force);
                const syncDate = new Date(timestamp);
                localStorage.setItem('cogniflow-lastSyncTimestamp', syncDate.toISOString());
                localStorage.setItem('cogniflow-lastSyncEtag', etag);
                setLastSyncStatus(`Last synced: ${syncDate.toLocaleTimeString()}`);
                if (isManual) addToast('Data successfully synced to server.', 'success');
            } else {
                const { metadata } = await backupService.getSyncDataMetadata();
                const serverHasChanges = metadata && (!lastSyncTimestamp || new Date(metadata.modified).getTime() > new Date(lastSyncTimestamp).getTime());
                
                if (localHasChanges && serverHasChanges) {
                    addToast('Conflict detected! Resolving changes...', 'info');
                    setLastSyncStatus('Conflict detected...');
                    const remoteData = await backupService.syncDataFromServer();
                    const localData = await db.getAllDataForBackup();
                    const aiChatHistory = await db.getAIChatHistory();
                    openModal('mergeConflict', { localData: {...localData, aiChatHistory}, remoteData });
                    setIsSyncing(false);
                    setLastSyncStatus('Awaiting conflict resolution.');
                    return;
                } else if (localHasChanges) {
                    await handleSyncRef.current?.({ ...options, force: true });
                } else if (serverHasChanges && isManual) {
                    openModal('confirm', {
                        title: 'Update Available',
                        message: `Newer data was found on the server. Do you want to fetch it now? This will overwrite local data.`,
                        onConfirm: () => backupHandlers.fetchAndRestoreFromServer(),
                        confirmText: 'Fetch'
                    });
                } else if (isManual) {
                    addToast("Your data is already up to date.", "info");
                    setLastSyncStatus(`Last synced: ${new Date(lastSyncTimestamp!).toLocaleTimeString()}`);
                }
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unknown error";
            console.error("[Sync] Sync failed:", e);
            setLastSyncStatus(`Error: ${message}`);
            addToast(`Server sync failed: ${message}`, 'error');
        } finally {
            if (isSyncing) setIsSyncing(false);
        }
    }, [
        addToast, backupApiKey, backupEnabled, backupHandlers, handleMergeResolution, isMetered, isOnline, isSyncing, 
        openModal, setIsSyncing, setLastSyncStatus, syncOnCellular
    ]);

    useEffect(() => {
        handleSyncRef.current = handleSync;
    }, [handleSync]);
    
    const handleDroppedFileConfirm = useCallback((analysis: DroppedFileAnalysis, deckName?: string) => {
        closeModal();
        try {
            switch (analysis.type) {
                case 'backup': handleRestoreData(analysis.data); break;
                case 'quiz_series': {
                    const { seriesName, seriesDescription, levels: levelsData } = analysis.data;
                    const allNewDecks: QuizDeck[] = [];
                    const newLevels: SeriesLevel[] = levelsData.map((levelData: any) => {
                        const decksForLevel: QuizDeck[] = levelData.decks.map((d: any) => ({
                            id: crypto.randomUUID(), name: d.name, description: d.description, type: DeckType.Quiz, questions: createQuestionsFromImport(d.questions)
                        }));
                        allNewDecks.push(...decksForLevel);
                        return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
                    });
                    const newSeries: DeckSeries = {
                        id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription, levels: newLevels, archived: false, createdAt: new Date().toISOString()
                    };
                    seriesHandlers.handleAddSeriesWithDecks(newSeries, allNewDecks);
                    break;
                }
                case 'quiz': {
                    const newDeck: QuizDeck = {
                        id: crypto.randomUUID(), name: deckName || analysis.data.name, description: analysis.data.description, type: DeckType.Quiz, questions: createQuestionsFromImport(analysis.data.questions)
                    };
                    deckAndFolderHandlers.handleAddDecks([newDeck]);
                    addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
                    break;
                }
                case 'flashcard': {
                    if (!deckName) { addToast('A deck name is required for flashcard imports.', 'error'); return; }
                    const newDeck: FlashcardDeck = {
                        id: crypto.randomUUID(), name: deckName, type: DeckType.Flashcard, cards: createCardsFromImport(analysis.data), description: `${analysis.data.length} imported flashcard${analysis.data.length === 1 ? '' : 's'}.`
                    };
                    deckAndFolderHandlers.handleAddDecks([newDeck]);
                    addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
                    break;
                }
            }
        } catch (e) { addToast(e instanceof Error ? e.message : "Failed to process the dropped file.", 'error'); }
    }, [addToast, closeModal, deckAndFolderHandlers, seriesHandlers, handleRestoreData]);

    const handleExportData = useCallback(async () => {
        try {
            const filename = await db.exportAllData();
            addToast(`Successfully exported data to ${filename}`, 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to export data.", 'error');
        }
    }, [addToast]);
    
    const handleFactoryReset = useCallback(() => {
        openModal('confirm', {
            title: 'Factory Reset',
            message: 'This will permanently erase all local data. This action cannot be undone.',
            confirmText: 'delete everything',
            onConfirm: async () => {
                try {
                    await db.factoryReset();
                    localStorage.clear();
                    addToast('Factory reset complete. Reloading...', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Factory reset failed.", 'error');
                }
            }
        });
    }, [addToast, openModal]);

    const handleClearAppCache = useCallback(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
            addToast('App cache cleared. Please reload.', 'success');
        }
    }, [addToast]);

    const handleClearCdnCache = useCallback(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CDN_CACHE' });
            addToast('CDN cache cleared. Please reload.', 'success');
        }
    }, [addToast]);

    const handleRevertLastFetch = useCallback(() => {
        openModal('confirm', {
            title: 'Revert Last Fetch',
            message: 'This will restore your local data to the state it was in before your last "Force Fetch". Are you sure?',
            onConfirm: async () => {
                const backup = localStorage.getItem('cogniflow-pre-fetch-backup');
                if (backup) {
                    try {
                        const data = JSON.parse(backup) as FullBackupData;
                        await handleRestoreData(data);
                        localStorage.removeItem('cogniflow-pre-fetch-backup');
                    } catch (e) {
                        addToast('Failed to restore pre-fetch backup.', 'error');
                    }
                } else {
                    addToast('No pre-fetch backup found.', 'error');
                }
            }
        });
    }, [addToast, openModal, handleRestoreData]);
    
    const handleManualSync = useCallback(() => {
        handleSync({ isManual: true });
    }, [handleSync]);

    return useMemo(() => ({
        ...deckAndFolderHandlers,
        ...seriesHandlers,
        ...sessionHandlers,
        ...aiHandlers,
        ...backupHandlers,
        ...driveHandlers,
        handleRestoreData,
        handleMergeResolution,
        handleExportData,
        handleFactoryReset,
        handleClearAppCache,
        handleClearCdnCache,
        handleRevertLastFetch,
        handleSync,
        handleManualSync,
        handleDroppedFileConfirm,
        openModal,
        closeModal,
        openConfirmModal,
        openRestoreModal: () => openModal('restore'),
        openResetProgressModal: () => openModal('resetProgress'),
        openServerBackupModal: () => openModal('serverBackup'),
    }), [
        deckAndFolderHandlers, seriesHandlers, sessionHandlers, aiHandlers, backupHandlers, driveHandlers,
        handleRestoreData, handleMergeResolution, handleExportData, handleFactoryReset, handleClearAppCache,
        handleClearCdnCache, handleRevertLastFetch, handleSync, handleManualSync, handleDroppedFileConfirm,
        openModal, closeModal, openConfirmModal
    ]);
};