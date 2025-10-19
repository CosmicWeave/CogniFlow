import { useCallback, useMemo, useState } from 'react';
import * as db from '../../services/db';
import * as backupService from '../../services/backupService';
import { useToast } from '../useToast';
import { useStore } from '../../store/store';
import { useOnlineStatus } from '../useOnlineStatus';
import { Deck, DeckSeries, FullBackupData, DeckType, FlashcardDeck, QuizDeck, LearningDeck, Reviewable } from '../../types';
import { getDueItemsCount } from '../../services/srs';
import { getEffectiveMasteryLevel } from '../../services/srs';

export const useBackupHandlers = ({
  addToast,
  openModal,
  closeModal,
  dispatch,
  isSyncing,
  setIsSyncing,
  setLastSyncStatus,
  backupEnabled,
  backupApiKey,
  syncOnCellular
}: any) => {
  const { isOnline, isMetered } = useOnlineStatus();
  const [serverUpdateInfo, setServerUpdateInfo] = useState<{ modified: string; size: number } | null>(null);


  const handleExportData = useCallback(async () => {
    try {
      const filename = await db.exportAllData();
      if (filename) {
        addToast(`Successfully exported all data to ${filename}`, 'success');
      }
    } catch (e) {
      addToast((e as Error).message, 'error');
    }
  }, [addToast]);

  const onRestoreData = useCallback(async (data: FullBackupData) => {
    try {
      await db.performAtomicRestore(data);
      if (data.settings) {
        // Restore settings to localStorage
        Object.entries(data.settings).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            localStorage.setItem(`cogniflow-${key}`, typeof value === 'string' ? value : JSON.stringify(value));
          }
        });
      }
      addToast('Restore complete! The app will now reload.', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      addToast(`Restore failed: ${(e as Error).message}`, 'error');
    }
  }, [addToast]);

  const fetchAndRestoreFromServer = useCallback(async (isForce = false, createRevertBackup = true) => {
    setIsSyncing(true);
    if (createRevertBackup) {
      try {
        const backupData = await db.getAllDataForBackup();
        localStorage.setItem('cogniflow-pre-fetch-backup', JSON.stringify(backupData));
        addToast('Created a temporary local backup before fetching.', 'info');
      } catch (e) {
        addToast('Could not create pre-fetch backup. Aborting.', 'error');
        setIsSyncing(false);
        return;
      }
    }
    try {
      const data = await backupService.syncDataFromServer();
      await onRestoreData(data);
      localStorage.setItem('cogniflow-lastSyncTimestamp', new Date().toISOString());
      setLastSyncStatus(`Last sync: ${new Date().toLocaleString()}`);
      addToast('Data restored from server.', 'success');
    } catch (e) {
      const message = (e as Error).message;
      setLastSyncStatus(`Sync failed: ${message}`);
      addToast(`Sync failed: ${message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [setIsSyncing, setLastSyncStatus, addToast, onRestoreData]);

  const triggerSync = useCallback(async ({ isManual }: { isManual: boolean }) => {
    if (!isOnline) {
      if (isManual) addToast('Sync failed: You are offline.', 'error');
      return;
    }
    if (!backupEnabled || !backupApiKey) {
      if (isManual) addToast('Sync is disabled or API key is not set.', 'info');
      return;
    }
    if (isMetered && !syncOnCellular) {
      if (isManual) addToast('Sync paused on metered connection. Enable "Sync on Cellular" in settings.', 'info');
      return;
    }
    if (isSyncing) return;
  
    setIsSyncing(true);
    setLastSyncStatus('Syncing...');
  
    try {
      const { metadata, isNotModified } = await backupService.getSyncDataMetadata();
      const { lastModified } = useStore.getState();
      const lastSyncTimestamp = localStorage.getItem('cogniflow-lastSyncTimestamp');
  
      const localHasChanges = lastModified !== null && (!lastSyncTimestamp || lastModified > new Date(lastSyncTimestamp).getTime());
      const remoteHasChanges = metadata && (!lastSyncTimestamp || new Date(metadata.modified).getTime() > new Date(lastSyncTimestamp).getTime());
  
      if (isNotModified && !localHasChanges) {
        setLastSyncStatus(`Up to date. (${new Date().toLocaleTimeString()})`);
        if (isManual) addToast('Already up to date.', 'success');
      } else if (remoteHasChanges) {
        if (localHasChanges) {
          openModal('mergeConflict', {
            localData: { lastModified },
            remoteData: metadata
          });
        } else {
          if (isManual) {
            openModal('confirm', {
              title: 'Download from Server?',
              message: `Newer data was found on the server from ${new Date(metadata.modified).toLocaleString()}. Your local data has no changes. Would you like to download it?`,
              onConfirm: () => fetchAndRestoreFromServer(),
              confirmText: 'Download'
            });
          } else {
            setServerUpdateInfo({ modified: metadata.modified, size: metadata.size });
          }
        }
      } else if (localHasChanges) {
        const { timestamp, etag } = await backupService.syncDataToServer();
        localStorage.setItem('cogniflow-lastSyncTimestamp', timestamp);
        setLastSyncStatus(`Last sync: ${new Date().toLocaleString()}`);
        if (isManual) addToast('Local changes synced to server.', 'success');
      } else {
        setLastSyncStatus(`Up to date. (${new Date().toLocaleTimeString()})`);
        if (isManual) addToast('Already up to date.', 'success');
      }
    } catch (e: any) {
      const message = e.isNetworkError ? e.message : (e.status === 401 ? 'Unauthorized. Check API Key.' : (e.message || 'An unknown error occurred.'));
      setLastSyncStatus(`Sync failed: ${message}`);
      if (isManual) addToast(`Sync failed: ${message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, backupEnabled, backupApiKey, syncOnCellular, isMetered, isSyncing, addToast, setIsSyncing, setLastSyncStatus, openModal, closeModal, fetchAndRestoreFromServer]);

  const handleSync = useCallback(async ({ isManual, force = false }: { isManual: boolean, force?: boolean }) => {
    if (isSyncing) {
        addToast('Sync already in progress.', 'info');
        return;
    }
    const { lastModified } = useStore.getState();
    const lastSyncTimestamp = localStorage.getItem('cogniflow-lastSyncTimestamp');
    const localHasChanges = lastModified !== null && (!lastSyncTimestamp || lastModified > new Date(lastSyncTimestamp).getTime());

    if (localHasChanges && !force) {
        await triggerSync({ isManual: false });
    } else {
        await triggerSync({ isManual });
    }
  }, [isOnline, backupEnabled, backupApiKey, syncOnCellular, isMetered, isSyncing, triggerSync, addToast, setIsSyncing, setLastSyncStatus, openModal]);
  
  const handleManualSync = useCallback(() => {
    handleSync({ isManual: true });
  }, [handleSync]);

  const handleForceFetchFromServer = useCallback(() => {
    openModal('confirm', {
      title: 'Force Fetch from Server?',
      message: 'This will overwrite your local data with the version from the server. Any local changes made since the last sync will be lost. This action cannot be undone.',
      onConfirm: () => fetchAndRestoreFromServer(true),
      confirmText: 'Overwrite Local Data'
    });
  }, [openModal, fetchAndRestoreFromServer]);

  const handleForceUploadToServer = useCallback(() => {
    openModal('confirm', {
      title: 'Force Upload to Server?',
      message: 'This will overwrite the server data with your current local version. Any changes on the server since the last sync will be lost. This action cannot be undone.',
      onConfirm: async () => {
        setIsSyncing(true);
        try {
          const { timestamp } = await backupService.syncDataToServer(undefined, true);
          localStorage.setItem('cogniflow-lastSyncTimestamp', timestamp);
          addToast('Successfully uploaded local data to server.', 'success');
        } catch (e) {
          addToast(`Upload failed: ${(e as Error).message}`, 'error');
        } finally {
          setIsSyncing(false);
        }
      },
      confirmText: 'Overwrite Server Data'
    });
  }, [openModal, addToast, setIsSyncing]);

  const handleFactoryReset = useCallback(() => {
    openModal('confirm', {
      title: 'Factory Reset',
      message: 'This will permanently delete all your local data, settings, and database. This action cannot be undone and the app will reload. Are you sure?',
      onConfirm: async () => {
        try {
          await db.factoryReset();
          localStorage.clear();
          addToast('Factory reset complete. App will now reload.', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
          addToast(`Factory reset failed: ${(e as Error).message}`, 'error');
        }
      },
    });
  }, [openModal, addToast]);

  const handleMergeResolution = useCallback(async (resolution: 'local' | 'remote') => {
    if (resolution === 'local') {
        localStorage.setItem('cogniflow-post-merge-sync', 'true');
        addToast('Keeping local data. It will be force-uploaded after reloading.', 'info');
        setTimeout(() => window.location.reload(), 1500);
    } else { // remote
// FIX: The original code incorrectly tried to restore from the local state, which is wrong for the "remote" choice and caused a type error. This now correctly calls the function to fetch and restore from the server.
        await fetchAndRestoreFromServer(true, false);
    }
    closeModal();
  }, [addToast, closeModal, fetchAndRestoreFromServer]);

  const handleCreateServerBackup = useCallback(async () => {
    try {
        const { filename } = await backupService.createServerBackup();
        addToast(`Manual backup "${filename}" created on server.`, 'success');
    } catch (e) {
        addToast(`Failed to create backup: ${(e as Error).message}`, 'error');
    }
  }, [addToast]);

  const handleRestoreFromServerBackup = useCallback(async (filename: string) => {
    openModal('confirm', {
        title: 'Restore Live Sync?',
        message: `This will replace the current live sync file on the server with the contents of "${filename}". Are you sure?`,
        onConfirm: async () => {
            try {
                await backupService.restoreFromServerBackup(filename);
                addToast('Live sync file restored. It will be downloaded on next sync or app reload.', 'success');
            } catch (e) {
                addToast(`Restore failed: ${(e as Error).message}`, 'error');
            }
        },
        confirmText: 'Restore Sync File'
    });
  }, [addToast, openModal]);

  const handleDeleteServerBackup = useCallback(async (filename: string) => {
    openModal('confirm', {
        title: 'Delete Server Backup?',
        message: `Are you sure you want to permanently delete "${filename}" from the server? This action cannot be undone.`,
        onConfirm: async () => {
            try {
                await backupService.deleteServerBackup(filename);
                return Promise.resolve();
            } catch (e) {
                addToast(`Failed to delete backup: ${(e as Error).message}`, 'error');
                return Promise.reject();
            }
        },
        confirmText: 'Delete Permanently'
    });
  }, [addToast, openModal]);

  const handleRevertLastFetch = useCallback(() => {
    openModal('confirm', {
        title: 'Revert Last Fetch?',
        message: 'This will restore your local data to the state it was in right before the last fetch/sync from the server. Are you sure?',
        onConfirm: async () => {
            const backupJson = localStorage.getItem('cogniflow-pre-fetch-backup');
            if (backupJson) {
                try {
                    const backupData = JSON.parse(backupJson);
                    await onRestoreData(backupData);
                    localStorage.removeItem('cogniflow-pre-fetch-backup');
                } catch (e) {
                    addToast('Failed to parse or restore pre-fetch backup.', 'error');
                }
            } else {
                addToast('No pre-fetch backup found to revert to.', 'error');
            }
        }
    });
  }, [onRestoreData, openModal, addToast]);

  const handleRestoreSelectedItems = useCallback(async ({ selectedIds, backupData }: { selectedIds: Set<string>; backupData: FullBackupData; }) => {
    const decksToRestore = backupData.decks.filter(d => selectedIds.has(d.id));
    const seriesToRestore = backupData.deckSeries.filter(s => selectedIds.has(s.id));
    const allSeriesDeckIds = new Set(seriesToRestore.flatMap(s => s.levels.flatMap(l => l.deckIds)));
    const standaloneDecksToRestore = decksToRestore.filter(d => !allSeriesDeckIds.has(d.id));

    try {
      if (standaloneDecksToRestore.length > 0) {
        dispatch({ type: 'ADD_DECKS', payload: standaloneDecksToRestore });
        await db.addDecks(standaloneDecksToRestore);
      }
      if (seriesToRestore.length > 0) {
        seriesToRestore.forEach(s => {
          const decksInSeries = backupData.decks.filter(d => (s.levels || []).some(l => l.deckIds.includes(d.id)));
          dispatch({ type: 'ADD_SERIES_WITH_DECKS', payload: { series: s, decks: decksInSeries } });
        });
        await db.addDeckSeries(seriesToRestore);
        await db.addDecks(decksToRestore.filter(d => allSeriesDeckIds.has(d.id)));
      }
      addToast('Successfully restored selected items.', 'success');
      triggerSync({ isManual: false });
    } catch (e) {
      addToast(`Error restoring items: ${(e as Error).message}`, 'error');
    }
  }, [dispatch, addToast, triggerSync]);


  const handleCompareBackup = useCallback((backupData: FullBackupData) => {
    const { decks: localDecks, deckSeries: localSeries } = useStore.getState();
    const backupDecks = new Map(backupData.decks.map(d => [d.id, d]));
    const backupSeries = new Map(backupData.deckSeries.map(s => [s.id, s]));

    const newDecks: Deck[] = [];
    const changedDecks: any[] = [];
    localDecks.forEach(localDeck => {
      const backupDeck = backupDecks.get(localDeck.id);
      if (backupDeck) {
        const diff = { content: false, dueCount: false, mastery: false };
        // FIX: Narrow the union type 'Deck' before accessing 'cards' or 'questions' properties.
        const localContent = localDeck.type === DeckType.Flashcard ? (localDeck as FlashcardDeck).cards : (localDeck as QuizDeck | LearningDeck).questions;
        const backupContent = backupDeck.type === DeckType.Flashcard ? (backupDeck as FlashcardDeck).cards : (backupDeck as QuizDeck | LearningDeck).questions;
        if (JSON.stringify(localContent || []) !== JSON.stringify(backupContent || [])) {
            diff.content = true;
        }

        if (localDeck.lastModified && backupDeck.lastModified && backupDeck.lastModified > localDeck.lastModified) {
            diff.dueCount = true;
            diff.mastery = true;
        }
        if (diff.content || diff.dueCount || diff.mastery) {
          changedDecks.push({ local: localDeck, backup: backupDeck, diff });
        }
      }
    });
    for (const backupDeck of backupData.decks as Deck[]) {
      if (!localDecks.some(d => d.id === backupDeck.id)) newDecks.push(backupDeck);
    }

    const newSeries: DeckSeries[] = [];
    const changedSeries: any[] = [];
    localSeries.forEach(localS => {
        const backupS = backupSeries.get(localS.id);
        if (backupS) {
            const diff = { structure: false, completion: false, mastery: false };
            if (JSON.stringify(localS.levels) !== JSON.stringify(backupS.levels)) diff.structure = true;
            if (localS.lastModified && backupS.lastModified && backupS.lastModified > localS.lastModified) {
                diff.completion = true;
                diff.mastery = true;
            }
            if(diff.structure || diff.completion || diff.mastery) {
                changedSeries.push({ local: localS, backup: backupS, diff });
            }
        }
    });
    for (const backupS of backupData.deckSeries as DeckSeries[]) {
      if (!localSeries.some(s => s.id === backupS.id)) newSeries.push(backupS);
    }
    
    const allDecks = [...localDecks, ...newDecks, ...changedDecks.map(d=>d.backup)];
    const dueCounts = new Map<string, number>();
    allDecks.forEach(d => {
        dueCounts.set(d.id, getDueItemsCount(d));
        const localDeck = localDecks.find(ld => ld.id === d.id);
        if (localDeck) dueCounts.set(`local-${d.id}`, getDueItemsCount(localDeck));
    });

    const masteryLevels = new Map<string, number>();
    // FIX: Add `Reviewable` type to satisfy TypeScript. The type was not imported.
    const allItems = (deck: Deck): Reviewable[] => (deck.type === 'flashcard' ? (deck as any).cards : (deck as any).questions) || [];
    allDecks.forEach(d => {
        const items = allItems(d).filter(i => !i.suspended);
        const mastery = items.length > 0 ? items.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / items.length : 0;
        masteryLevels.set(d.id, mastery);
        const localDeck = localDecks.find(ld => ld.id === d.id);
        if (localDeck) {
            const localItems = allItems(localDeck).filter(i => !i.suspended);
            const localMastery = localItems.length > 0 ? localItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / localItems.length : 0;
            masteryLevels.set(`local-${d.id}`, localMastery);
        }
    });

    for(const series of [...localSeries, ...newSeries, ...changedSeries.map(s => s.backup)] as DeckSeries[]) {
        const seriesDecks = (series.levels || []).flatMap(l => l.deckIds).map(id => allDecks.find(d => d.id === id)).filter(Boolean);
        const allSeriesItems = seriesDecks.flatMap(d => allItems(d!)).filter(i => !i.suspended);
        const mastery = allSeriesItems.length > 0 ? allSeriesItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / allSeriesItems.length : 0;
        masteryLevels.set(series.id, mastery);
        const localS = localSeries.find(ls => ls.id === series.id);
        if(localS){
            const localSeriesDecks = (localS.levels || []).flatMap(l => l.deckIds).map(id => localDecks.find(d => d.id === id)).filter(Boolean);
            const allLocalSeriesItems = localSeriesDecks.flatMap(d => allItems(d!)).filter(i => !i.suspended);
            const localMastery = allLocalSeriesItems.length > 0 ? allLocalSeriesItems.reduce((sum, item) => sum + getEffectiveMasteryLevel(item), 0) / allLocalSeriesItems.length : 0;
            masteryLevels.set(`local-${series.id}`, localMastery);
        }
    }


    return { newDecks, newSeries, changedDecks, changedSeries, dueCounts, masteryLevels };
  }, []);

  // FIX: Added cache clearing handlers.
  const handleClearAppCache = useCallback(() => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
      addToast('Clearing app cache... It may take a moment to take effect.', 'info');
    } else {
      addToast('Service worker not available to clear cache.', 'error');
    }
  }, [addToast]);

  const handleClearCdnCache = useCallback(() => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CDN_CACHE' });
      addToast('Clearing CDN cache... It may take a moment to take effect.', 'info');
    } else {
      addToast('Service worker not available to clear cache.', 'error');
    }
  }, [addToast]);

  return useMemo(() => ({
    handleExportData,
    onRestoreData,
    handleCompareBackup,
    handleRestoreSelectedItems,
    triggerSync,
    handleManualSync,
    handleSync,
    fetchAndRestoreFromServer,
    handleForceFetchFromServer,
    handleForceUploadToServer,
    handleFactoryReset,
    handleMergeResolution,
    handleCreateServerBackup,
    handleRestoreFromServerBackup,
    handleDeleteServerBackup,
    handleRevertLastFetch,
    handleClearAppCache,
    handleClearCdnCache
  }), [
    handleExportData, onRestoreData, handleCompareBackup, handleRestoreSelectedItems,
    triggerSync, handleManualSync, handleSync, fetchAndRestoreFromServer,
    handleForceFetchFromServer, handleForceUploadToServer, handleFactoryReset, handleMergeResolution,
    handleCreateServerBackup, handleRestoreFromServerBackup, handleDeleteServerBackup, handleRevertLastFetch,
    handleClearAppCache, handleClearCdnCache
  ]);
};