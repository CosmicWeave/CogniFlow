import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Deck, DeckSeries, Folder, QuizDeck, SeriesProgress, DeckType, FlashcardDeck, SeriesLevel, Card, Question, AIAction, LearningDeck, InfoCard } from './types';
import * as db from './services/db';
import * as backupService from './services/backupService';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import OfflineIndicator from './components/ui/OfflineIndicator';
import Sidebar from './components/Sidebar';
import { useToast } from './hooks/useToast';
import Spinner from './components/ui/Spinner';
import ImportModal from './components/ImportModal';
import RestoreModal from './components/RestoreModal';
import ResetProgressModal from './components/ResetProgressModal';
import { useRouter } from './contexts/RouterContext';
import ConfirmModal from './components/ConfirmModal';
import FolderModal from './components/FolderModal';
import EditSeriesModal from './components/EditSeriesModal';
import { onDataChange } from './services/syncService';
import PullToRefreshIndicator from './components/ui/PullToRefreshIndicator';
import { parseAnkiPkg, parseAnkiPkgMainThread } from './services/ankiImportService';

import { useDataManagement } from './hooks/useDataManagement';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import Header from './components/Header';
import AppRouter from './components/AppRouter';
import CommandPalette from './components/CommandPalette';
import Icon from './components/ui/Icon';
import { useStore } from './store/store';
import { analyzeFileContent, createCardsFromImport, createQuestionsFromImport } from './services/importService';
import DroppedFileConfirmModal, { DroppedFileAnalysis } from './components/DroppedFileConfirmModal';
import AIGenerationModal from './components/AIGenerationModal';
import { useSettings } from './hooks/useSettings';
import AIChatFab from './components/AIChatFab';
import AIChatModal from './components/AIChatModal';
import AIGenerationStatusIndicator from './components/AIGenerationStatusIndicator';
import AIGenerationStatusModal from './components/AIGenerationStatusModal';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const App: React.FC = () => {
  const { dispatch, ...state } = useStore();
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isAIGenerationModalOpen, setAIGenerationModalOpen] = useState(false);
  const [isAIStatusModalOpen, setAIStatusModalOpen] = useState(false);
  const [isRestoreModalOpen, setRestoreModalOpen] = useState(false);
  const [isResetProgressModalOpen, setResetProgressModalOpen] = useState(false);
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | 'new' | null>(null);
  const [seriesToEdit, setSeriesToEdit] = useState<DeckSeries | 'new' | null>(null);
  const [confirmModalProps, setConfirmModalProps] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  }>({ title: '', message: '', onConfirm: () => {} });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sessionsToResume, setSessionsToResume] = useState(new Set<string>());
  const [generalStudyDeck, setGeneralStudyDeck] = useState<QuizDeck | null>(null);
  const [sortPreference, setSortPreference] = useState<SortPreference>('lastOpened');
  const [draggedDeckId, setDraggedDeckId] = useState<string | null>(null);
  const [openFolderIds, setOpenFolderIds] = useState(new Set<string>());

  // Helper to safely parse server date strings which might be timestamps or formatted strings
  const parseServerDate = (dateValue?: string | null): Date => {
    // Return an invalid date if the input is null, undefined, or an empty string
    if (!dateValue) {
      return new Date(NaN);
    }
    // Check if it's a numeric string (unix timestamp in seconds)
    if (/^\d+(\.\d+)?$/.test(dateValue)) {
      return new Date(parseFloat(dateValue) * 1000);
    }
    // Otherwise, try to parse it as a date string, making it more compatible.
    // Handles ISO 8601 format like "2025-08-31T06:43:54Z" correctly.
    return new Date(dateValue.replace(' ', 'T'));
  };

  const onToggleFolder = useCallback((folderId: string) => {
    setOpenFolderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const [droppedFileAnalysis, setDroppedFileAnalysis] = useState<DroppedFileAnalysis | null>(null);
  const dragCounter = useRef(0);

  const [installPrompt, handleInstall] = useInstallPrompt();
  const { addToast } = useToast();
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const { path, navigate } = useRouter();
  const initialLoadComplete = useRef(false);
  const { aiFeaturesEnabled, backupEnabled, backupApiKey } = useSettings();

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState('Never synced.');
  const dataDirtyRef = useRef(false);

  const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd, REFRESH_THRESHOLD } = usePullToRefresh();
  
  const openModal = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      modalTriggerRef.current = document.activeElement as HTMLElement;
      setter(true);
  }, []);
  
  const closeModal = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      setter(false);
      setTimeout(() => {
        modalTriggerRef.current?.focus();
      }, 300);
  }, []);

  const openMenu = useCallback(() => openModal(setIsMenuOpen), [openModal]);
  const closeMenu = useCallback(() => closeModal(setIsMenuOpen), [closeModal]);
  const openCommandPalette = useCallback(() => openModal(setIsCommandPaletteOpen), [openModal]);
  const closeCommandPalette = useCallback(() => closeModal(setIsCommandPaletteOpen), [closeModal]);
  const openImportModal = useCallback(() => openModal(setImportModalOpen), [openModal]);
  const closeImportModal = useCallback(() => closeModal(setImportModalOpen), [closeModal]);
  const openAIGenerationModal = useCallback(() => openModal(setAIGenerationModalOpen), [openModal]);
  const closeAIGenerationModal = useCallback(() => closeModal(setAIGenerationModalOpen), [closeModal]);
  const openRestoreModal = useCallback(() => openModal(setRestoreModalOpen), [openModal]);
  const closeRestoreModal = useCallback(() => closeModal(setRestoreModalOpen), [closeModal]);
  const openResetProgressModal = useCallback(() => openModal(setResetProgressModalOpen), [openModal]);
  const closeResetProgressModal = useCallback(() => closeModal(setResetProgressModalOpen), [closeModal]);
  const openConfirm = useCallback(() => openModal(setConfirmModalOpen), [openModal]);
  const closeConfirm = useCallback(() => closeModal(setConfirmModalOpen), [closeModal]);

  const openConfirmModal = useCallback((props: Omit<typeof confirmModalProps, 'onConfirm'> & { onConfirm: () => void }) => {
    setConfirmModalProps(props);
    openConfirm();
  }, [openConfirm]);
  
  const openFolderEditor = useCallback((folder: Folder | 'new' | null) => {
    modalTriggerRef.current = document.activeElement as HTMLElement;
    setFolderToEdit(folder);
  }, []);

  const openSeriesEditor = useCallback((series: DeckSeries | 'new' | null) => {
    modalTriggerRef.current = document.activeElement as HTMLElement;
    setSeriesToEdit(series);
  }, []);
  
  const dataHandlers = useDataManagement({
    sessionsToResume,
    setSessionsToResume,
    setGeneralStudyDeck,
    openConfirmModal,
    setFolderToEdit: openFolderEditor,
    setSeriesToEdit: openSeriesEditor,
  });
  const { handleAddDecks, handleAddSeriesWithDecks, handleRestoreData, handleExecuteAIAction } = dataHandlers;

  const handleDroppedFileConfirm = (analysis: DroppedFileAnalysis, deckName?: string) => {
    setDroppedFileAnalysis(null);
    try {
        switch (analysis.type) {
            case 'backup':
                handleRestoreData(analysis.data);
                break;
            case 'quiz_series': {
                const { seriesName, seriesDescription, levels: levelsData } = analysis.data;
                const allNewDecks: QuizDeck[] = [];
                const newLevels: SeriesLevel[] = levelsData.map((levelData: any) => {
                    const decksForLevel: QuizDeck[] = levelData.decks.map((d: any) => ({
                        id: crypto.randomUUID(),
                        name: d.name,
                        description: d.description,
                        type: DeckType.Quiz,
                        questions: createQuestionsFromImport(d.questions)
                    }));
                    allNewDecks.push(...decksForLevel);
                    return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
                });
                const newSeries: DeckSeries = {
                    id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription, levels: newLevels,
                    archived: false, createdAt: new Date().toISOString()
                };
                handleAddSeriesWithDecks(newSeries, allNewDecks);
                break;
            }
            case 'quiz': {
                const questions = createQuestionsFromImport(analysis.data.questions);
                const newDeck: QuizDeck = {
                    id: crypto.randomUUID(), name: deckName || analysis.data.name, description: analysis.data.description,
                    type: DeckType.Quiz, questions: questions
                };
                handleAddDecks([newDeck]);
                addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
                break;
            }
            case 'flashcard': {
                if (!deckName) {
                    addToast('A deck name is required for flashcard imports.', 'error');
                    return;
                }
                const cards = createCardsFromImport(analysis.data);
                const newDeck: FlashcardDeck = {
                    id: crypto.randomUUID(), name: deckName, type: DeckType.Flashcard, cards: cards,
                    description: `${cards.length} imported flashcard${cards.length === 1 ? '' : 's'}.`
                };
                handleAddDecks([newDeck]);
                addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
                break;
            }
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to process the dropped file.";
        addToast(message, 'error');
    }
  };

  const triggerSync = useCallback(async (isManual = false) => {
    if (!backupEnabled || !backupApiKey) {
        if (isManual) addToast('Server sync is not enabled or API key is missing.', 'error');
        return;
    }
    if (isSyncing) {
        if (isManual) addToast('A sync operation is already in progress.', 'info');
        return;
    }

    setIsSyncing(true);
    setLastSyncStatus('Syncing...');
    if (isManual) addToast('Manual sync started...', 'info');

    try {
        const { timestamp, etag } = await backupService.uploadBackup();
        dataDirtyRef.current = false;
        const syncDate = new Date(timestamp);
        localStorage.setItem('cogniflow-lastSyncTimestamp', syncDate.toISOString());
        localStorage.setItem('cogniflow-lastSyncEtag', etag);
        setLastSyncStatus(`Last synced: ${syncDate.toLocaleTimeString()}`);
        addToast('Data successfully synced to server.', 'success');
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("Sync failed:", e);
        setLastSyncStatus(`Error: ${message}`);
        addToast(`Server sync failed: ${message}`, 'error');
    } finally {
        setIsSyncing(false);
    }
  }, [backupEnabled, backupApiKey, isSyncing, addToast]);
  
  const handleFetchFromServer = useCallback(async () => {
    if (!backupEnabled || !backupApiKey) {
        addToast('Server sync is not enabled or API key is missing.', 'error');
        return;
    }
    if (isSyncing) {
        addToast('A sync operation is already in progress.', 'info');
        return;
    }

    openConfirmModal({
        title: 'Fetch from Server',
        message: 'This will download the latest backup from the server and overwrite any unsynced local changes. Are you sure you want to continue?',
        confirmText: 'Fetch',
        onConfirm: async () => {
            setIsSyncing(true);
            setLastSyncStatus('Fetching from server...');
            try {
                const { metadata } = await backupService.getLatestBackupMetadata();
                if (!metadata) {
                    throw new Error("Failed to retrieve backup metadata from server.");
                }
                const data = await backupService.downloadBackup(metadata);
                await dataHandlers.handleRestoreData(data);
                
                const serverDate = parseServerDate(metadata.modified);
                if (isNaN(serverDate.getTime())) {
                    throw new Error('Received an invalid date from the server.');
                }
                const serverLastModified = serverDate.toISOString();

                localStorage.setItem('cogniflow-lastSyncTimestamp', serverLastModified);
                localStorage.setItem('cogniflow-lastSyncEtag', metadata.etag);
                setLastSyncStatus(`Synced from server: ${serverDate.toLocaleTimeString()}`);
                addToast('Successfully fetched and restored data from server.', 'success');
            } catch (e) {
                const message = e instanceof Error ? e.message : "Unknown error";
                console.error("Fetch failed:", e);
                if (message.includes('404')) {
                    const userMessage = 'No backup found on the server to fetch from.';
                    setLastSyncStatus(userMessage);
                    addToast(userMessage, 'info');
                } else {
                    setLastSyncStatus(`Error: ${message}`);
                    addToast(`Failed to fetch server data: ${message}`, 'error');
                }
            } finally {
                setIsSyncing(false);
            }
        }
    });
  }, [backupEnabled, backupApiKey, isSyncing, addToast, openConfirmModal, dataHandlers, parseServerDate]);

  useEffect(() => {
    return useStore.subscribe((currentState, prevState) => {
        if (currentState.lastModified && currentState.lastModified !== prevState.lastModified) {
            dataDirtyRef.current = true;
        }
    });
  }, []);

  useEffect(() => {
      if (!backupEnabled || !backupApiKey) return;
      const intervalId = setInterval(() => {
          if (dataDirtyRef.current) {
              triggerSync(false);
          }
      }, 5 * 60 * 1000);
      return () => clearInterval(intervalId);
  }, [backupEnabled, backupApiKey, triggerSync]);
  
  const loadData = useCallback(async (isInitialLoad = false) => {
    try {
      const [decks, folders, deckSeries, sessionKeys] = await Promise.all([
        db.getAllDecks(),
        db.getAllFolders(),
        db.getAllDeckSeries(),
        isInitialLoad ? db.getAllSessionKeys() : Promise.resolve<string[]>([])
      ]);
      dispatch({ type: 'LOAD_DATA', payload: { decks, folders, deckSeries } });
      if (isInitialLoad) {
        const deckIdsWithSessions = new Set(sessionKeys.map((key: string) => key.replace('session_deck_', '')));
        setSessionsToResume(deckIdsWithSessions);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      addToast('Error loading data from the database.', 'error');
    }
  }, [addToast, dispatch]);
  
  const cleanupTrash = useCallback(async () => {
    const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const decksToDelete = state.decks.filter(d => d.deletedAt && new Date(d.deletedAt) < TEN_DAYS_AGO);
    const seriesToDelete = state.deckSeries.filter(s => s.deletedAt && new Date(s.deletedAt) < TEN_DAYS_AGO);

    if (decksToDelete.length === 0 && seriesToDelete.length === 0) return;

    for (const deck of decksToDelete) {
      await dataHandlers.handleDeleteDeckPermanently(deck.id);
    }
    for (const series of seriesToDelete) {
      await dataHandlers.handleDeleteSeriesPermanently(series.id);
    }
    addToast('Permanently deleted old items from trash.', 'info');
  }, [state.decks, state.deckSeries, dataHandlers, addToast]);
  
  const loadLocalSettings = useCallback(async () => {
    try {
      const savedSort = localStorage.getItem('cogniflow-sortPreference') as SortPreference;
      if (savedSort) setSortPreference(savedSort);

      const savedOpenFolders = localStorage.getItem('cogniflow-openFolderIds');
      if (savedOpenFolders) setOpenFolderIds(new Set(JSON.parse(savedOpenFolders)));

      const lastSync = localStorage.getItem('cogniflow-lastSyncTimestamp');
      if (lastSync) setLastSyncStatus(`Last synced: ${new Date(lastSync).toLocaleTimeString()}`);
    } catch (error) {
       console.error("Failed to load local settings", error);
       addToast("Could not load some of your settings.", "error");
    }
  }, [addToast]);

  useEffect(() => {
    const loadInitialData = async () => {
      await loadData(true);
      await loadLocalSettings();
    };
    loadInitialData();
  }, [loadData, loadLocalSettings]);

  useEffect(() => {
    if (initialLoadComplete.current) return;
    
    const checkServerForUpdates = async () => {
        if (!backupEnabled || !backupApiKey) return;
        
        try {
            setLastSyncStatus('Checking for updates...');
            const localEtag = localStorage.getItem('cogniflow-lastSyncEtag');
            const { metadata, isNotModified } = await backupService.getLatestBackupMetadata(localEtag || undefined);
            
            if (isNotModified) {
                const lastSync = localStorage.getItem('cogniflow-lastSyncTimestamp');
                setLastSyncStatus(lastSync ? `Last synced: ${new Date(lastSync).toLocaleTimeString()}` : 'In sync with server.');
                return;
            }

            if (metadata) {
                const serverDate = parseServerDate(metadata.modified);
                if (isNaN(serverDate.getTime())) {
                    throw new Error('Invalid date format from server.');
                }
                const serverLastModified = serverDate.getTime();
                const localLastSync = new Date(localStorage.getItem('cogniflow-lastSyncTimestamp') || 0).getTime();

                if (serverLastModified > (localLastSync + 60000)) {
                    openConfirmModal({
                        title: 'Update Available',
                        message: 'Newer data found on the server. Download and merge now? This will overwrite any unsynced local changes.',
                        onConfirm: async () => {
                            try {
                                const data = await backupService.downloadBackup(metadata);
                                await handleRestoreData(data);
                                const newTimestamp = new Date(serverLastModified).toISOString();
                                localStorage.setItem('cogniflow-lastSyncTimestamp', newTimestamp);
                                localStorage.setItem('cogniflow-lastSyncEtag', metadata.etag);
                                setLastSyncStatus(`Synced from server: ${new Date(serverLastModified).toLocaleTimeString()}`);
                            } catch (e) {
                                const message = e instanceof Error ? e.message : "Unknown error";
                                addToast(`Failed to download server data: ${message}`, 'error');
                            }
                        }
                    });
                } else {
                     const lastSync = localStorage.getItem('cogniflow-lastSyncTimestamp');
                     setLastSyncStatus(lastSync ? `Last synced: ${new Date(lastSync).toLocaleTimeString()}` : 'Never synced.');
                }
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "";
            if (message.includes('404')) {
                setLastSyncStatus('No backup found on server.');
                if (state.decks.length > 0) dataDirtyRef.current = true;
            } else {
                setLastSyncStatus(`Error: ${message}`);
            }
        }
    };

    if (!state.isLoading && !initialLoadComplete.current) {
        cleanupTrash();
        dataHandlers.reconcileSeriesProgress();
        checkServerForUpdates();
        initialLoadComplete.current = true;
    }
  }, [state.isLoading, backupEnabled, backupApiKey, openConfirmModal, handleRestoreData, addToast, state.decks.length, cleanupTrash, dataHandlers, parseServerDate]);

  const { activeDeck, activeSeries } = useMemo(() => {
    const [pathname] = path.split('?');
    if (pathname.startsWith('/decks/')) {
        const deckId = pathname.split('/')[2];
        return { activeDeck: state.decks.find(d => d.id === deckId) || null, activeSeries: null };
    }
    if (pathname.startsWith('/series/')) {
        const seriesId = pathname.split('/')[2];
        return { activeDeck: null, activeSeries: state.deckSeries.find(s => s.id === seriesId) || null };
    }
    return { activeDeck: null, activeSeries: null };
  }, [path, state.decks, state.deckSeries]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDraggingOverWindow(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setIsDraggingOverWindow(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingOverWindow(false); dragCounter.current = 0;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (file.name.toLowerCase().endsWith('.apkg')) {
        try {
            const buffer = await file.arrayBuffer();
            const bufferCopy = buffer.slice(0);
            let decks: Deck[] = [];
            try { decks = await parseAnkiPkg(buffer); } catch (workerError) {
                console.warn("Anki worker failed, trying main thread fallback:", workerError);
                addToast("Import via worker failed. Trying a slower fallback method... this may freeze the app.", "info");
                try { decks = await parseAnkiPkgMainThread(bufferCopy); } catch (mainThreadError) { throw mainThreadError; }
            }
            if (decks.length > 0) { handleAddDecks(decks); addToast(`Successfully imported ${decks.length} deck(s) from ${file.name}.`, 'success'); }
            else { addToast('No valid decks found in the Anki package.', 'info'); }
        } catch (error) { addToast(`An error occurred processing the Anki package: ${error instanceof Error ? error.message : "Unknown error"}`, 'error'); }
      } else {
          const analysis = analyzeFileContent(content);
          if (analysis) { setDroppedFileAnalysis({ ...analysis, fileName: file.name }); }
          else { addToast("Unsupported or invalid file format.", 'error'); }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen text-text flex flex-col overflow-x-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <PullToRefreshIndicator pullDistance={pullToRefreshState.pullDistance} isRefreshing={pullToRefreshState.isRefreshing} threshold={REFRESH_THRESHOLD} />
      <Sidebar 
        isOpen={isMenuOpen} 
        onClose={closeMenu} 
        onImport={openImportModal}
        onCreateSeries={() => openSeriesEditor('new')}
        onGenerateAI={openAIGenerationModal}
        onInstall={installPrompt ? handleInstall : null}
      />
      <div className="flex-1 flex flex-col">
        <Header 
            onOpenMenu={openMenu}
            onOpenCommandPalette={openCommandPalette}
            activeDeck={activeDeck}
        />
        <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
            {state.isLoading ? (
                <div className="text-center p-8"><Spinner /></div>
            ) : (
                <AppRouter
                    sessionsToResume={sessionsToResume}
                    sortPreference={sortPreference}
                    setSortPreference={setSortPreference}
                    draggedDeckId={draggedDeckId}
                    setDraggedDeckId={setDraggedDeckId}
                    openFolderIds={openFolderIds}
                    onToggleFolder={onToggleFolder}
                    generalStudyDeck={generalStudyDeck}
                    activeDeck={activeDeck}
                    activeSeries={activeSeries}
                    setImportModalOpen={setImportModalOpen}
                    setRestoreModalOpen={setRestoreModalOpen}
                    setResetProgressModalOpen={setResetProgressModalOpen}
                    openFolderModal={openFolderEditor}
                    openConfirmModal={openConfirmModal}
                    openCreateSeriesModal={() => openSeriesEditor('new')}
                    openAIGenerationModal={openAIGenerationModal}
                    onTriggerSync={() => triggerSync(true)}
                    onFetchFromServer={handleFetchFromServer}
                    isSyncing={isSyncing}
                    lastSyncStatus={lastSyncStatus}
                    onGenerateQuestionsForDeck={dataHandlers.handleGenerateQuestionsForDeck}
                    onGenerateContentForLearningDeck={dataHandlers.handleGenerateContentForLearningDeck}
                    onGenerateQuestionsForEmptyDecksInSeries={dataHandlers.handleGenerateQuestionsForEmptyDecksInSeries}
                    onCancelAIGeneration={dataHandlers.handleCancelAIGeneration}
                    onSaveLearningBlock={dataHandlers.handleSaveLearningBlock}
                    onDeleteLearningBlock={dataHandlers.handleDeleteLearningBlock}
                    {...dataHandlers}
                />
            )}
        </main>
      </div>
      <OfflineIndicator />
      {isImportModalOpen && <ImportModal isOpen={isImportModalOpen} onClose={closeImportModal} onAddDecks={handleAddDecks} onAddSeriesWithDecks={handleAddSeriesWithDecks} />}
      {isAIGenerationModalOpen && <AIGenerationModal isOpen={isAIGenerationModalOpen} onClose={closeAIGenerationModal} onGenerate={dataHandlers.handleGenerateWithAI} />}
      {isRestoreModalOpen && <RestoreModal isOpen={isRestoreModalOpen} onClose={closeRestoreModal} onRestore={handleRestoreData} />}
      {isResetProgressModalOpen && <ResetProgressModal isOpen={isResetProgressModalOpen} onClose={closeResetProgressModal} onReset={dataHandlers.handleResetDeckProgress} decks={state.decks} />}
      {isConfirmModalOpen && <ConfirmModal isOpen={isConfirmModalOpen} onClose={closeConfirm} {...confirmModalProps} />}
      {folderToEdit && <FolderModal folder={folderToEdit === 'new' ? null : folderToEdit} onClose={() => { setFolderToEdit(null); modalTriggerRef.current?.focus(); }} onSave={dataHandlers.handleSaveFolder} />}
      {seriesToEdit && <EditSeriesModal series={seriesToEdit === 'new' ? null : seriesToEdit} onClose={() => { setSeriesToEdit(null); modalTriggerRef.current?.focus(); }} onSave={dataHandlers.handleSaveSeries} />}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        actions={[
          { id: 'import', label: 'Create / Import Deck', icon: 'plus', action: openImportModal, keywords: ['new', 'add'] },
          { id: 'settings', label: 'Settings', icon: 'settings', action: () => { navigate('/settings') } },
          { id: 'trash', label: 'View Trash', icon: 'trash-2', action: () => { navigate('/trash') } },
          { id: 'archive', label: 'View Archive', icon: 'archive', action: () => { navigate('/archive') } },
          { id: 'progress', label: 'View Progress', icon: 'trending-up', action: () => { navigate('/progress') } },
        ]}
      />
      {isDraggingOverWindow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-lg p-8 text-center border-4 border-dashed border-primary">
            <Icon name="upload-cloud" className="w-16 h-16 text-primary mx-auto mb-4" />
            <p className="text-xl font-semibold">Drop file to import</p>
          </div>
        </div>
      )}
      {droppedFileAnalysis && (
        <DroppedFileConfirmModal
          isOpen={!!droppedFileAnalysis}
          onClose={() => setDroppedFileAnalysis(null)}
          onConfirm={handleDroppedFileConfirm}
          analysis={droppedFileAnalysis}
        />
      )}
      {aiFeaturesEnabled && (
        <>
          <AIChatFab />
          <AIChatModal onExecuteAction={handleExecuteAIAction} />
          <AIGenerationStatusIndicator onOpen={() => setAIStatusModalOpen(true)} onCancel={dataHandlers.handleCancelAIGeneration} />
          <AIGenerationStatusModal isOpen={isAIStatusModalOpen} onClose={() => setAIStatusModalOpen(false)} onCancel={dataHandlers.handleCancelAIGeneration} />
        </>
      )}
    </div>
  );
};

export default App;