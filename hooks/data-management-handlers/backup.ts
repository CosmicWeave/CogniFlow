
import { useCallback } from 'react';
import * as backupService from '../../services/backupService.ts';
import * as db from '../../services/db.ts';
import { useStore } from '../../store/store.ts';
import { FullBackupData, BackupComparison, Deck, DeckSeries, DeckType, FlashcardDeck, QuizDeck, LearningDeck, Reviewable } from '../../types.ts';
import { broadcastDataChange } from '../../services/syncService.ts';
import { mergeData, MergeResolutionStrategy } from '../../services/mergeService.ts';
import { getDueItemsCount, getEffectiveMasteryLevel } from '../../services/srs.ts';

export const useBackupHandlers = ({ 
    addToast, 
    openModal, 
    closeModal, 
    dispatch, 
    setLastSyncStatus, 
    setIsSyncing, 
    backupEnabled
}: any) => {
    // Helper to calculate comparison stats
    const calculateStats = (items: Reviewable[]) => {
        if (!items || items.length === 0) return 0;
        return items.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / items.length;
    };

    const handleCompareBackup = useCallback((backupData: FullBackupData): BackupComparison => {
        const currentDecks = useStore.getState().decks;
        const currentSeries = useStore.getState().deckSeries;
        
        const newDecks: Deck[] = [];
        const newSeries: DeckSeries[] = [];
        const changedDecks: any[] = [];
        const changedSeries: any[] = [];
        const dueCounts = new Map<string, number>();
        const masteryLevels = new Map<string, number>();

        // Check Decks
        backupData.decks.forEach(backupDeck => {
            const localDeck = currentDecks[backupDeck.id];
            if (!localDeck) {
                newDecks.push(backupDeck);
                dueCounts.set(backupDeck.id, getDueItemsCount(backupDeck));
            } else if (localDeck.lastModified !== backupDeck.lastModified) {
                // Determine what changed
                // Deep check for content (cards/questions)
                const localItems = (localDeck.type === DeckType.Flashcard ? (localDeck as FlashcardDeck).cards : (localDeck.type === DeckType.Learning ? (localDeck as LearningDeck).questions : (localDeck as QuizDeck).questions)) || [];
                const backupItems = (backupDeck.type === DeckType.Flashcard ? (backupDeck as FlashcardDeck).cards : (backupDeck.type === DeckType.Learning ? (backupDeck as LearningDeck).questions : (backupDeck.type === DeckType.Quiz ? (backupDeck as QuizDeck).questions : []))) || [];
                
                const diff = {
                    content: localItems.length !== backupItems.length, // Naive check
                    dueCount: getDueItemsCount(localDeck) !== getDueItemsCount(backupDeck),
                    mastery: false // calculated below
                };

                changedDecks.push({ local: localDeck, backup: backupDeck, diff });
                
                dueCounts.set(`local-${localDeck.id}`, getDueItemsCount(localDeck));
                dueCounts.set(backupDeck.id, getDueItemsCount(backupDeck));
                
                // Calculate Mastery
                const localReviewables = localItems as Reviewable[];
                const backupReviewables = backupItems as Reviewable[];
                
                const localMastery = calculateStats(localReviewables);
                const backupMastery = calculateStats(backupReviewables);
                
                masteryLevels.set(`local-${localDeck.id}`, localMastery);
                masteryLevels.set(backupDeck.id, backupMastery);
                
                diff.mastery = Math.abs(localMastery - backupMastery) > 0.01;
            }
        });

        // Check Series
        backupData.deckSeries.forEach(backupS => {
            const localS = currentSeries[backupS.id];
            if (!localS) {
                newSeries.push(backupS);
            } else if (localS.lastModified !== backupS.lastModified) {
                const diff = {
                    structure: JSON.stringify(localS.levels) !== JSON.stringify(backupS.levels),
                    completion: false, // simplified
                    mastery: false
                };
                changedSeries.push({ local: localS, backup: backupS, diff });
            }
        });

        return { newDecks, newSeries, changedDecks, changedSeries, dueCounts, masteryLevels };
    }, []);

    const triggerSync = useCallback(async (options: { isManual?: boolean, force?: boolean } = {}) => {
        if (!backupEnabled) {
            if (options.isManual) addToast("Backup is disabled in settings.", "info");
            return;
        }
        
        setIsSyncing(true);
        setLastSyncStatus('Syncing...');
        
        try {
            const { timestamp } = await backupService.syncDataToServer(undefined, options.force);
            const date = new Date(timestamp);
            setLastSyncStatus(`Synced: ${date.toLocaleTimeString()}`);
            if (options.isManual) {
                addToast('Sync successful.', 'success');
            }
        } catch (e: any) {
            console.error("Sync failed", e);
            if (e.status === 412 || e.status === 409) {
                // Conflict
                setLastSyncStatus('Sync Conflict');
                try {
                    const serverData = await backupService.syncDataFromServer();
                    
                    const comparison = handleCompareBackup(serverData);
                    
                    // Open merge conflict modal
                    openModal('mergeConflict', { comparison, remoteData: serverData });
                } catch (readError) {
                    addToast("Sync failed and could not read server data for resolution.", "error");
                }
            } else {
                setLastSyncStatus('Sync Failed');
                if (options.isManual) {
                    addToast(`Sync failed: ${e.message}`, 'error');
                }
            }
        } finally {
            setIsSyncing(false);
        }
    }, [backupEnabled, addToast, setIsSyncing, setLastSyncStatus, handleCompareBackup, openModal]);

    const onRestoreDataWithSync = useCallback(async (data: FullBackupData) => {
        try {
            await db.performAtomicRestore(data);
            dispatch({ type: 'RESTORE_DATA', payload: data });
            if (data.aiChatHistory) dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: data.aiChatHistory });
            addToast('Data restored successfully.', 'success');
            // Force push to server to overwrite with restored data if backup enabled
            if (backupEnabled) {
                triggerSync({ isManual: false, force: true });
            }
        } catch (e) {
            console.error(e);
            addToast('Failed to restore data.', 'error');
        }
    }, [dispatch, addToast, triggerSync, backupEnabled]);

    const handleManualSync = useCallback(() => {
        triggerSync({ isManual: true });
    }, [triggerSync]);

    const handleForceFetchFromServer = useCallback(async () => {
        setIsSyncing(true);
        try {
            // Save current state as "pre-fetch" backup in case user wants to revert
            const currentData = await db.getAllDataForBackup();
            localStorage.setItem('cogniflow-pre-fetch-backup', JSON.stringify(currentData));
            
            const serverData = await backupService.syncDataFromServer();
            
            // Just restore locally without syncing back immediately, as fetching implies pulling state down
            await db.performAtomicRestore(serverData);
            dispatch({ type: 'RESTORE_DATA', payload: serverData });
            if (serverData.aiChatHistory) dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: serverData.aiChatHistory });
            
            addToast('Force fetch successful.', 'success');
            setLastSyncStatus(`Fetched: ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            addToast(`Force fetch failed: ${(e as Error).message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [dispatch, setIsSyncing, addToast, setLastSyncStatus]);

    const handleRevertLastFetch = useCallback(async () => {
        const backupStr = localStorage.getItem('cogniflow-pre-fetch-backup');
        if (!backupStr) {
            addToast("No backup found to revert to.", "error");
            return;
        }
        try {
            const backupData = JSON.parse(backupStr);
            await onRestoreDataWithSync(backupData);
            addToast("Reverted to state before last fetch.", "success");
        } catch (e) {
            addToast("Failed to revert.", "error");
        }
    }, [onRestoreDataWithSync, addToast]);

    const handleForceUploadToServer = useCallback(async () => {
        setIsSyncing(true);
        try {
            await backupService.syncDataToServer(undefined, true); // Force overwrite
            addToast("Force upload successful.", "success");
            setLastSyncStatus(`Synced: ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            addToast(`Force upload failed: ${(e as Error).message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [setIsSyncing, addToast, setLastSyncStatus]);

    const handleCreateServerBackup = useCallback(async () => {
        setIsSyncing(true);
        try {
            const result = await backupService.createServerBackup();
            addToast(`Backup created: ${result.filename}`, 'success');
        } catch (e) {
            addToast(`Backup failed: ${(e as Error).message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [setIsSyncing, addToast]);

    const handleRestoreFromServerBackup = useCallback(async (filename: string) => {
        setIsSyncing(true);
        try {
            await backupService.restoreFromServerBackup(filename);
            // Now fetch the data (which is now the live sync data)
            const serverData = await backupService.syncDataFromServer();
            
            await db.performAtomicRestore(serverData);
            dispatch({ type: 'RESTORE_DATA', payload: serverData });
            if (serverData.aiChatHistory) dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: serverData.aiChatHistory });
            
            addToast("Restored from server backup.", "success");
            setLastSyncStatus(`Restored: ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            addToast(`Restore failed: ${(e as Error).message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [setIsSyncing, addToast, dispatch, setLastSyncStatus]);

    const handleDeleteServerBackup = useCallback(async (filename: string) => {
        try {
            await backupService.deleteServerBackup(filename);
            // Toast handled by caller usually or here? The modal calls this.
        } catch (e) {
            addToast(`Delete failed: ${(e as Error).message}`, 'error');
            throw e; // Re-throw so modal knows it failed
        }
    }, [addToast]);

    const handleRestoreSelectedItems = useCallback(async ({ selectedIds, backupData }: { selectedIds: Set<string>; backupData: FullBackupData }) => {
        const currentData = await db.getAllDataForBackup();
        // Use merge logic with a strategy where selected IDs are taken from backup ('remote')
        const strategy: MergeResolutionStrategy = { decks: {}, series: {} };
        
        backupData.decks.forEach(d => {
            if (selectedIds.has(d.id)) strategy.decks[d.id] = 'remote';
            else strategy.decks[d.id] = 'local';
        });
        backupData.deckSeries.forEach(s => {
            if (selectedIds.has(s.id)) strategy.series[s.id] = 'remote';
            else strategy.series[s.id] = 'local';
        });

        // We need to merge local and backup data
        const merged = mergeData({ ...currentData, version: 9 }, backupData, strategy);
        
        await onRestoreDataWithSync(merged);
    }, [onRestoreDataWithSync]);

    const handleMergeResolution = useCallback(async (strategy: MergeResolutionStrategy, remoteData: FullBackupData) => {
        closeModal(); // Close merge conflict modal
        const localData = await db.getAllDataForBackup();
        const merged = mergeData({ ...localData, version: 9 }, remoteData, strategy);
        
        await db.performAtomicRestore(merged);
        dispatch({ type: 'RESTORE_DATA', payload: merged });
        if (merged.aiChatHistory) dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: merged.aiChatHistory });
        
        // Push the resolved state to server
        setIsSyncing(true);
        try {
            await backupService.syncDataToServer(merged, true); // Force push resolved state
            addToast("Sync conflict resolved.", "success");
            setLastSyncStatus(`Synced: ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            addToast("Failed to push resolved data to server.", "error");
        } finally {
            setIsSyncing(false);
        }
    }, [closeModal, dispatch, addToast, setIsSyncing, setLastSyncStatus]);

    const handleExportData = useCallback(async () => {
        try {
            await db.exportAllData();
            addToast('Export started.', 'info');
        } catch (e) {
            addToast(`Export failed: ${(e as Error).message}`, 'error');
        }
    }, [addToast]);

    const handleClearAppCache = useCallback(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
            addToast("App cache cleared. Reloading...", "success");
            setTimeout(() => window.location.reload(), 1000);
        } else {
            addToast("Service worker not active.", "error");
        }
    }, [addToast]);

    const handleClearCdnCache = useCallback(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CDN_CACHE' });
            addToast("CDN cache cleared.", "success");
        } else {
            addToast("Service worker not active.", "error");
        }
    }, [addToast]);

    return {
        triggerSync,
        handleManualSync,
        onRestoreData: onRestoreDataWithSync,
        handleCompareBackup,
        handleRestoreSelectedItems,
        handleForceFetchFromServer,
        handleForceUploadToServer,
        handleCreateServerBackup,
        handleRestoreFromServerBackup,
        handleDeleteServerBackup,
        handleMergeResolution,
        handleExportData,
        handleClearAppCache,
        handleClearCdnCache,
        handleRevertLastFetch,
    };
};
