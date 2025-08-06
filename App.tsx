
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Deck, DeckSeries, Folder, QuizDeck, SeriesProgress } from './types';
import * as db from './services/db';
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
import { parseAnkiPkg } from './services/ankiImportService';

import { useAppReducer } from './hooks/useAppReducer';
import { useDataManagement } from './hooks/useDataManagement';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import Header from './components/Header';
import AppRouter from './components/AppRouter';
import TrashPage from './components/TrashPage';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const App: React.FC = () => {
  const [state, dispatch] = useAppReducer();
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isRestoreModalOpen, setRestoreModalOpen] = useState(false);
  const [isResetProgressModalOpen, setResetProgressModalOpen] = useState(false);
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
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
  const [seriesProgress, setSeriesProgress] = useState<SeriesProgress>(new Map());

  const [installPrompt, handleInstall] = useInstallPrompt();
  const { addToast } = useToast();
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const { path } = useRouter();
  const initialLoadComplete = useRef(false);

  const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd, REFRESH_THRESHOLD } = usePullToRefresh();
  
  const openModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      modalTriggerRef.current = document.activeElement as HTMLElement;
      setter(true);
  };
  
  const openConfirmModal = (props: Omit<typeof confirmModalProps, 'onConfirm'> & { onConfirm: () => void }) => {
    setConfirmModalProps(props);
    openModal(setConfirmModalOpen);
  };
  
  const closeModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      setter(false);
      modalTriggerRef.current?.focus();
  };

  const dataHandlers = useDataManagement({
    state,
    dispatch,
    sessionsToResume,
    setSessionsToResume,
    seriesProgress,
    setSeriesProgress,
    setGeneralStudyDeck,
    openConfirmModal,
    setFolderToEdit: (folder) => { openModal(setFolderToEdit as any); setFolderToEdit(folder); },
    setSeriesToEdit: (series) => { openModal(setSeriesToEdit as any); setSeriesToEdit(series); }
  });
  const { handleAddDecks } = dataHandlers;

  const loadData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      dispatch({ type: 'SET_LOADING', payload: true });
    }
    try {
      const [decks, folders, deckSeries] = await Promise.all([db.getAllDecks(), db.getAllFolders(), db.getAllDeckSeries()]);
      dispatch({ type: 'LOAD_DATA', payload: { decks, folders, deckSeries } });
      if (!isInitialLoad) {
        addToast("Data synced from another tab.", "info");
      }
    } catch (error) {
      console.error("Failed to load data from IndexedDB", error);
      const message = error instanceof Error ? error.message : "Could not load your data. Please try refreshing.";
      addToast(message, "error");
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [addToast, dispatch]);

  const cleanupTrash = useCallback(async () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const decksToDelete = state.decks.filter(d => d.deletedAt && new Date(d.deletedAt) < tenDaysAgo);
    const seriesToDelete = state.deckSeries.filter(s => s.deletedAt && new Date(s.deletedAt) < tenDaysAgo);

    if (decksToDelete.length === 0 && seriesToDelete.length === 0) return;

    try {
        await Promise.all([
            ...decksToDelete.map(d => db.deleteDeck(d.id)),
            ...seriesToDelete.map(s => db.deleteDeckSeries(s.id))
        ]);

        decksToDelete.forEach(d => dispatch({ type: 'DELETE_DECK', payload: d.id }));
        seriesToDelete.forEach(s => dispatch({ type: 'DELETE_SERIES', payload: s.id }));
        
        const totalDeleted = decksToDelete.length + seriesToDelete.length;
        addToast(`${totalDeleted} item(s) permanently deleted from trash.`, 'info');
    } catch(e) {
        console.error("Failed to cleanup trash", e);
        addToast("Error during automatic trash cleanup.", "error");
    }
  }, [state.decks, state.deckSeries, dispatch, addToast]);

  const loadLocalSettings = useCallback(() => {
    try {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed: ', err));
        });
      }
      
      const resumable = new Set<string>();
      let loadedProgress: SeriesProgress = new Map();

      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('session_deck_')) resumable.add(key.replace('session_deck_', ''));
          if (key.startsWith('series-progress-')) {
              const seriesId = key.replace('series-progress-', '');
              try {
                  loadedProgress.set(seriesId, new Set(JSON.parse(localStorage.getItem(key) || '[]')));
              } catch (e) { console.error(`Failed to parse progress for series ${seriesId}`); }
          }
      }
      setSessionsToResume(resumable);
      setSeriesProgress(loadedProgress);

      const savedSort = localStorage.getItem('cogniflow-sortPreference');
      if (savedSort && ['lastOpened', 'name', 'dueCount'].includes(savedSort)) {
          setSortPreference(savedSort as SortPreference);
      }

      try {
        const savedOpenFolders = localStorage.getItem('cogniflow-openFolders');
        if (savedOpenFolders) setOpenFolderIds(new Set(JSON.parse(savedOpenFolders)));
      } catch (e) { console.error("Could not load open folder state", e); }
    } catch (error) {
        console.error("Failed to load local settings from localStorage. This can happen if cookies/site data are disabled.", error);
        addToast("Could not load saved settings.", "error");
    }
  }, [addToast, setOpenFolderIds, setSeriesProgress, setSessionsToResume, setSortPreference]);

  useEffect(() => { loadData(true); loadLocalSettings(); }, [loadData, loadLocalSettings]);

  useEffect(() => {
    // Run cleanup and reconciliation logic only once after the initial data load is complete.
    if (!state.isLoading && !initialLoadComplete.current) {
        cleanupTrash();
        dataHandlers.reconcileSeriesProgress();
        initialLoadComplete.current = true;
    }
  }, [state.isLoading, cleanupTrash, dataHandlers]);

  useEffect(() => {
    const unsubscribeDB = onDataChange(() => loadData(false));
    const handleStorageChange = () => loadLocalSettings();
    window.addEventListener('storage', handleStorageChange);
    return () => { unsubscribeDB(); window.removeEventListener('storage', handleStorageChange); };
  }, [loadData, loadLocalSettings]);

  useEffect(() => {
    // File Handling API for "Open with..." PWA feature
    const launchQueue = (window as any).launchQueue;
    if (!launchQueue) return;

    launchQueue.setConsumer(async (launchParams: { files?: any[] }) => {
      if (!launchParams.files || launchParams.files.length === 0) return;
      
      const fileHandle = launchParams.files[0];
      try {
        const file = await fileHandle.getFile();

        if (file.name.toLowerCase().endsWith('.apkg')) {
          addToast(`Importing ${file.name}...`, 'info');
          const buffer = await file.arrayBuffer();
          const decks = await parseAnkiPkg(buffer);
          
          if (decks.length > 0) {
            await handleAddDecks(decks);
            addToast(`Successfully imported ${decks.length} deck(s) from ${file.name}.`, 'success');
          } else {
            addToast('No valid decks found in the Anki package.', 'info');
          }
        }
      } catch (error) {
        console.error("Failed to process launched file:", error);
        addToast(`An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
      }
    });
  }, [handleAddDecks, addToast]);

  const handleToggleFolder = useCallback((folderId: string) => {
    setOpenFolderIds(prevOpenIds => {
        const newOpenIds = new Set(prevOpenIds);
        if (newOpenIds.has(folderId)) newOpenIds.delete(folderId);
        else newOpenIds.add(folderId);
        try { localStorage.setItem('cogniflow-openFolders', JSON.stringify(Array.from(newOpenIds))); } catch (e) { console.error("Could not save open folder state", e); }
        return newOpenIds;
    });
  }, []);

  const getActiveDeckId = (p: string) => p.match(/^\/decks\/([^/?]+)/)?.[1] || null;
  const getActiveSeriesId = (p: string) => p.match(/^\/series\/([^/?]+)/)?.[1] || null;

  const activeDeckId = getActiveDeckId(path);
  let activeDeck = activeDeckId ? state.decks.find(d => d.id === activeDeckId) : null;
  
  if (activeDeck) {
      const params = new URLSearchParams(window.location.hash.split('?')[1]);
      const seriesId = params.get('seriesId');
      if (seriesId) {
          const series = state.deckSeries.find(s => s.id === seriesId);
          if (series) {
              const flatDeckIds = series.levels.flatMap(l => l.deckIds);
              const deckIndex = flatDeckIds.indexOf(activeDeck.id);
              if (deckIndex > -1) {
                  const completedInSeries = seriesProgress.get(series.id)?.size || 0;
                  const isLocked = deckIndex > completedInSeries;
                  activeDeck = { ...activeDeck, locked: isLocked };
              }
          }
      }
  }
  
  const activeSeriesId = getActiveSeriesId(path);
  const activeSeries = activeSeriesId ? state.deckSeries.find(s => s.id === activeSeriesId) : null;

  if (state.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300"><Spinner size="lg" />Loading CogniFlow...</h1></div>;
  }

  const mainContentClass = `flex-grow transition-transform duration-300 ease-in-out ${isMenuOpen ? '-translate-x-16 sm:-translate-x-20' : ''}`;

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 flex flex-col overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <PullToRefreshIndicator
        pullDistance={pullToRefreshState.pullDistance}
        isRefreshing={pullToRefreshState.isRefreshing}
        threshold={REFRESH_THRESHOLD}
      />
      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => closeModal(setIsMenuOpen)}
        onImport={() => { openModal(setImportModalOpen); setIsMenuOpen(false); }}
        onCreateSeries={() => {
          setIsMenuOpen(false);
          modalTriggerRef.current = document.activeElement as HTMLElement;
          setSeriesToEdit('new');
        }}
        onInstall={installPrompt ? () => { handleInstall(); closeModal(setIsMenuOpen); } : null}
      />
      <div className="flex-grow flex flex-col">
        <Header 
          activeDeck={activeDeck} 
          onOpenMenu={() => openModal(setIsMenuOpen)} 
        />
        <main className={`${mainContentClass} container mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
          <AppRouter
            state={state}
            sessionsToResume={sessionsToResume}
            sortPreference={sortPreference}
            setSortPreference={setSortPreference}
            draggedDeckId={draggedDeckId}
            setDraggedDeckId={setDraggedDeckId}
            openFolderIds={openFolderIds}
            onToggleFolder={handleToggleFolder}
            seriesProgress={seriesProgress}
            generalStudyDeck={generalStudyDeck}
            activeDeck={activeDeck}
            activeSeries={activeSeries}
            openModal={openModal}
            setImportModalOpen={setImportModalOpen}
            setRestoreModalOpen={setRestoreModalOpen}
            setResetProgressModalOpen={setResetProgressModalOpen}
            openFolderModal={(folder) => {
              modalTriggerRef.current = document.activeElement as HTMLElement;
              setFolderToEdit(folder);
            }}
            openConfirmModal={openConfirmModal}
            openCreateSeriesModal={() => {
                modalTriggerRef.current = document.activeElement as HTMLElement;
                setSeriesToEdit('new');
            }}
            {...dataHandlers}
          />
        </main>
      </div>
      <OfflineIndicator />
      {isImportModalOpen && <ImportModal isOpen={isImportModalOpen} onClose={() => closeModal(setImportModalOpen)} onAddDecks={dataHandlers.handleAddDecks} onAddSeriesWithDecks={dataHandlers.handleAddSeriesWithDecks} />}
      {isRestoreModalOpen && <RestoreModal isOpen={isRestoreModalOpen} onClose={() => closeModal(setRestoreModalOpen)} onRestore={dataHandlers.handleRestoreData} />}
      {isResetProgressModalOpen && <ResetProgressModal isOpen={isResetProgressModalOpen} onClose={() => closeModal(setResetProgressModalOpen)} onReset={dataHandlers.handleResetDeckProgress} decks={state.decks} />}
      {isConfirmModalOpen && <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => closeModal(setConfirmModalOpen)} {...confirmModalProps} />}
      {folderToEdit !== null && <FolderModal folder={folderToEdit === 'new' ? null : folderToEdit} onClose={() => setFolderToEdit(null)} onSave={dataHandlers.handleSaveFolder} />}
      {seriesToEdit !== null && <EditSeriesModal series={seriesToEdit === 'new' ? null : seriesToEdit} onClose={() => setSeriesToEdit(null)} onSave={dataHandlers.handleSaveSeries} />}
    </div>
  );
};

export default App;