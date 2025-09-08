import React, { useCallback } from 'react';
import { GoogleDriveFile, QuizDeck, FullBackupData, Deck, Folder, DeckSeries } from '../types';
import * as backupService from '../services/backupService';
import { useStore } from '../store/store';
import { useToast } from './useToast';
import { useRouter } from '../contexts/RouterContext';
import { useModal } from '../contexts/ModalContext';
import * as db from '../services/db';
import { mergeData } from '../services/mergeService';

import { createDeckAndFolderHandlers } from './data-management-handlers/deckAndFolder';
import { createSeriesHandlers } from './data-management-handlers/series';
import { createSessionHandlers } from './data-management-handlers/session';
import { createAIHandlers } from './data-management-handlers/ai';
import { createBackupHandlers } from './data-management-handlers/backup';
import { createDriveHandlers } from './data-management-handlers/drive';

export interface UseDataManagementProps {
    sessionsToResume: Set<string>;
    setSessionsToResume: React.Dispatch<React.SetStateAction<Set<string>>>;
    setGeneralStudyDeck: React.Dispatch<React.SetStateAction<QuizDeck | null>>;
    triggerSync: (options?: { isManual?: boolean; dataToSync?: backupService.ServerSyncData; force?: boolean; }) => Promise<void>;
    isGapiReady: boolean;
    isGapiSignedIn: boolean;
    gapiUser: any;
    setDriveFiles: React.Dispatch<React.SetStateAction<GoogleDriveFile[]>>;
    isSyncing: boolean;
    setIsSyncing: React.Dispatch<React.SetStateAction<boolean>>;
    setLastSyncStatus: React.Dispatch<React.SetStateAction<string>>;
}

export const useDataManagement = (props: UseDataManagementProps) => {
    const {
        sessionsToResume, setSessionsToResume, setGeneralStudyDeck, triggerSync,
        isGapiReady, isGapiSignedIn, gapiUser, setDriveFiles,
        isSyncing, setIsSyncing, setLastSyncStatus
    } = props;

    const { dispatch } = useStore();
    const { addToast } = useToast();
    const { navigate } = useRouter();
    const { openModal, closeModal } = useModal();

    const openConfirmModal = useCallback((payload: any) => openModal('confirm', payload), [openModal]);
    
    const handleRestoreData = useCallback(async (data: FullBackupData) => {
        try {
            await db.performAtomicRestore(data);
            
            // On a successful restore, we are about to reload the page.
            // Closing the modal manually is not necessary and could potentially
            // interfere with the reload process in some edge cases.
            addToast("Data restored successfully. The app will now reload.", 'success');
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Failed to restore data:", error);
            addToast("There was an error restoring your data.", "error");
            throw error; // Re-throw to allow callers to handle failure
        }
    }, [addToast]);
    
    const handleMergeResolution = useCallback(async (mergedData: FullBackupData) => {
        await handleRestoreData(mergedData);
        // The success toast and reload are handled by handleRestoreData
        // We will trigger a force-sync after the reload happens.
        setTimeout(() => triggerSync({ force: true }), 2000);
    }, [handleRestoreData, triggerSync]);

    const deckAndFolderHandlers = createDeckAndFolderHandlers({
        dispatch, addToast, triggerSync, openConfirmModal,
    });

    const seriesHandlers = createSeriesHandlers({
        dispatch, addToast, navigate, triggerSync, 
        handleAddDecks: deckAndFolderHandlers.handleAddDecks,
        handleUpdateDeck: deckAndFolderHandlers.handleUpdateDeck,
    });
    
    const sessionHandlers = createSessionHandlers({
        sessionsToResume, setSessionsToResume, setGeneralStudyDeck, navigate, dispatch, addToast,
        handleUpdateDeck: deckAndFolderHandlers.handleUpdateDeck,
    });

    const aiHandlers = createAIHandlers({
        dispatch, addToast, ...deckAndFolderHandlers, ...seriesHandlers
    });
    
    const backupHandlers = createBackupHandlers({
        addToast, openConfirmModal, onRestoreData: handleRestoreData, triggerSync,
        isSyncing, setIsSyncing, setLastSyncStatus
    });

    const driveHandlers = createDriveHandlers({
        addToast, openConfirmModal, openRestoreFromDriveModal: () => openModal('restoreFromDrive'), setDriveFiles, onRestoreData: handleRestoreData
    });

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
            message: 'Are you sure you want to perform a factory reset? All of your local data, including decks, progress, and settings, will be permanently deleted. This action cannot be undone.',
            confirmText: 'delete everything',
            onConfirm: async () => {
                try {
                    await db.factoryReset();
                    localStorage.clear();
                    addToast('Factory reset complete. The application will now reload.', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to perform factory reset.", 'error');
                }
            }
        });
    }, [addToast, openModal]);

    const handleClearAppCache = useCallback(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
            addToast('App cache cleared. Please reload for changes to take effect.', 'success');
        }
    }, [addToast]);

    const handleClearCdnCache = useCallback(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CDN_CACHE' });
            addToast('CDN cache cleared. Please reload for changes to take effect.', 'success');
        }
    }, [addToast]);

    const handleRevertLastFetch = useCallback(() => {
        openModal('confirm', {
            title: 'Revert Last Fetch',
            message: 'This will restore your local data to the state it was in before your last "Force Fetch from Server". This is useful if a fetch overwrote important local changes. Are you sure?',
            onConfirm: async () => {
                const backup = localStorage.getItem('cogniflow-pre-fetch-backup');
                if (backup) {
                    try {
                        const data = JSON.parse(backup) as FullBackupData;
                        await handleRestoreData(data);
                        localStorage.removeItem('cogniflow-pre-fetch-backup');
                        // Success toast is handled by handleRestoreData
                    } catch (e) {
                        addToast('Failed to parse or restore pre-fetch backup.', 'error');
                    }
                } else {
                    addToast('No pre-fetch backup found.', 'error');
                }
            }
        });
    }, [addToast, openModal, handleRestoreData]);
    
    const handleSync = useCallback(() => triggerSync({ isManual: true }), [triggerSync]);
    
    const handleMergeResolutionWithSync = useCallback(async (mergedData: FullBackupData) => {
        await handleRestoreData(mergedData);
        // After reload, trigger a forced sync of the newly merged data.
        setTimeout(() => triggerSync({ force: true }), 2000);
    }, [handleRestoreData, triggerSync]);

    return {
        ...deckAndFolderHandlers,
        ...seriesHandlers,
        ...sessionHandlers,
        ...aiHandlers,
        ...backupHandlers,
        ...driveHandlers,
        handleRestoreData,
        handleMergeResolution: handleMergeResolutionWithSync,
        handleExportData,
        handleFactoryReset,
        handleClearAppCache,
        handleClearCdnCache,
        handleRevertLastFetch,
        handleSync,
        openImportModal: () => openModal('import'),
        openRestoreModal: () => openModal('restore'),
        openResetProgressModal: () => openModal('resetProgress'),
        openAIGenerationModal: () => openModal('aiGeneration'),
        openAIStatusModal: () => openModal('aiStatus'),
        openServerBackupModal: () => openModal('serverBackup'),
        openConfirmModal,
        openFolderEditor: (folder: Folder | 'new' | null) => openModal('folder', { folder }),
        openSeriesEditor: (series: DeckSeries | 'new' | null) => openModal('series', { series }),
    };
};