
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

import { useDataManagement } from './hooks/useDataManagement';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import Header from './components/Header';
import AppRouter from './components/AppRouter';
import CommandPalette from './components/CommandPalette';
import { IconName } from './components/ui/Icon';
import { useStore } from './store/store';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const App: React.FC = () => {
  const { dispatch, ...state } = useStore();
  const [isImportModalOpen, setImportModalOpen] = useState(false);
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
  const [seriesProgress, setSeriesProgress] = useState<SeriesProgress>(new Map());

  const [installPrompt, handleInstall] = useInstallPrompt();
  const { addToast } = useToast();
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const { path, navigate } = useRouter();
  const initialLoadComplete = useRef(false);

  const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd, REFRESH_THRESHOLD } = usePullToRefresh();
  
  const openModal = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      modalTriggerRef.current = document.activeElement as HTMLElement;
      setter(true);
  }, []);
  
  const closeModal = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      setter(false);
      // Delay focus shift to allow modal closing animation to complete.
      // The sidebar animation is 300ms.
      setTimeout(() => {
        modalTriggerRef.current?.focus();
      }, 300);
  }, []);

  // Create stable open/close functions for each modal
  const openMenu = useCallback(() => openModal(setIsMenuOpen), [openModal]);
  const closeMenu = useCallback(() => closeModal(setIsMenuOpen), [closeModal]);
  const openCommandPalette = useCallback(() => openModal(setIsCommandPaletteOpen), [openModal]);
  const closeCommandPalette = useCallback(() => closeModal(setIsCommandPaletteOpen), [closeModal]);
  const openImportModal = useCallback(() => openModal(setImportModalOpen), [openModal]);
  const closeImportModal = useCallback(() => closeModal(setImportModalOpen), [closeModal]);
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
    seriesProgress,
    setSeriesProgress,
    setGeneralStudyDeck,
    openConfirmModal,
    setFolderToEdit: openFolderEditor,
    setSeriesToEdit: openSeriesEditor,
  });
  const { handleAddDecks } = dataHandlers;

  // Global keydown listener for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        const isAnyModalOpen = isImportModalOpen || isRestoreModalOpen || isResetProgressModalOpen || isConfirmModalOpen || folderToEdit !== null || seriesToEdit !== null;
        if (!isInputFocused && !isAnyModalOpen) {
          openCommandPalette();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImportModalOpen, isRestoreModalOpen, isResetProgressModalOpen, isConfirmModalOpen, folderToEdit, seriesToEdit, openCommandPalette]);


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

  const loadLocalSettings = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed: ', err));
        });
      }
      
      const sessionKeys = await db.getAllSessionKeys();
      const resumable = new Set(sessionKeys.map(key => key.replace('session_deck_', '')));
      let loadedProgress: SeriesProgress = new Map();

      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
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
        console.error("Failed to load local settings from storage. This can happen if cookies/site data are disabled.", error);
        addToast("Could not load saved settings.", "error");
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

  const activeDeck = useMemo(() => {
    const getActiveDeckId = (p: string) => p.match(/^\/decks\/([^/?]+)/)?.[1] || null;
    const activeDeckId = getActiveDeckId(path);
    if (!activeDeckId) return null;
    
    const baseDeck = state.decks.find(d => d.id === activeDeckId);
    if (!baseDeck) return null;

    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const seriesId = params.get('seriesId');
    if (seriesId) {
        const series = state.deckSeries.find(s => s.id === seriesId);
        if (series) {
            const flatDeckIds = series.levels.flatMap(l => l.deckIds);
            const deckIndex = flatDeckIds.indexOf(activeDeckId);
            if (deckIndex > -1) {
                const completedInSeries = seriesProgress.get(series.id)?.size || 0;
                const isLocked = deckIndex > completedInSeries;
                return { ...baseDeck, locked: isLocked };
            }
        }
    }
    return baseDeck;
  }, [path, state.decks, state.deckSeries, seriesProgress]);

  const activeSeries = useMemo(() => {
    const getActiveSeriesId = (p: string) => p.match(/^\/series\/([^/?]+)/)?.[1] || null;
    const activeSeriesId = getActiveSeriesId(path);
    if (!activeSeriesId) return null;
    return state.deckSeries.find(s => s.id === activeSeriesId);
  }, [path, state.deckSeries]);

  const commandPaletteActions = useMemo(() => {
    const goToSettingSection = (sectionId: string) => {
      navigate('/settings');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };
    return [
      { id: 'new-deck', label: 'New / Import Deck', icon: 'plus' as IconName, action: openImportModal },
      { id: 'new-series', label: 'Create New Series', icon: 'layers' as IconName, action: () => openSeriesEditor('new') },
      { id: 'go-decks', label: 'Go to All Decks', icon: 'folder' as IconName, action: () => navigate('/decks') },
      { id: 'go-series', label: 'Go to All Series', icon: 'layers' as IconName, action: () => navigate('/series') },
      { id: 'go-archive', label: 'Go to Archive', icon: 'archive' as IconName, action: () => navigate('/archive') },
      { id: 'go-trash', label: 'Go to Trash', icon: 'trash-2' as IconName, action: () => navigate('/trash') },
      { id: 'go-settings', label: 'Go to Settings', icon: 'settings' as IconName, action: () => navigate('/settings') },
      
      { id: 'go-appearance-settings', label: 'Go to Appearance Settings', icon: 'sun' as IconName, action: () => goToSettingSection('settings-appearance'), searchableOnly: true, keywords: ['theme', 'dark', 'light', 'animation', 'haptics'] },
      { id: 'go-local-backup', label: 'Go to Local Backup', icon: 'download' as IconName, action: () => goToSettingSection('settings-local-backup'), searchableOnly: true, keywords: ['export', 'import', 'json', 'file', 'download', 'data'] },
      { id: 'go-cloud-backup', label: 'Go to Cloud Backup', icon: 'upload-cloud' as IconName, action: () => goToSettingSection('google-drive-backup'), searchableOnly: true, keywords: ['google', 'drive', 'sync', 'data'] },
      { id: 'go-cache-management', label: 'Go to Cache Management', icon: 'broom' as IconName, action: () => goToSettingSection('settings-cache-management'), searchableOnly: true, keywords: ['clear', 'reload', 'refresh', 'storage', 'data', 'service worker'] },
      { id: 'go-reset-progress', label: 'Go to Reset Progress', icon: 'refresh-ccw' as IconName, action: () => goToSettingSection('settings-reset-progress'), searchableOnly: true, keywords: ['srs', 'spaced repetition', 'start over', 'danger'] },
      { id: 'go-factory-reset', label: 'Go to Factory Reset', icon: 'trash-2' as IconName, action: () => goToSettingSection('settings-factory-reset'), searchableOnly: true, keywords: ['delete all', 'wipe', 'clean', 'erase', 'danger'] },
    ];
  }, [navigate, openImportModal, openSeriesEditor]);


  if (state.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300"><Spinner size="lg" />Loading CogniFlow...</h1></div>;
  }

  return (
    <div className="min-h-screen text-text flex flex-col overflow-x-hidden"
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
        onClose={closeMenu}
        onImport={() => { openImportModal(); closeMenu(); }}
        onCreateSeries={() => { closeMenu(); openSeriesEditor('new'); }}
        onInstall={installPrompt ? () => { handleInstall(); closeMenu(); } : null}
      />
      <div className="flex-grow flex flex-col">
        <Header 
          activeDeck={activeDeck} 
          onOpenMenu={openMenu}
          onOpenCommandPalette={openCommandPalette}
        />
        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AppRouter
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
            setImportModalOpen={setImportModalOpen}
            setRestoreModalOpen={setRestoreModalOpen}
            setResetProgressModalOpen={setResetProgressModalOpen}
            openFolderModal={openFolderEditor}
            openConfirmModal={openConfirmModal}
            openCreateSeriesModal={() => openSeriesEditor('new')}
            {...dataHandlers}
          />
        </main>
      </div>
      <OfflineIndicator />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        actions={commandPaletteActions}
      />
      {isImportModalOpen && <ImportModal isOpen={isImportModalOpen} onClose={closeImportModal} onAddDecks={dataHandlers.handleAddDecks} onAddSeriesWithDecks={dataHandlers.handleAddSeriesWithDecks} />}
      {isRestoreModalOpen && <RestoreModal isOpen={isRestoreModalOpen} onClose={closeRestoreModal} onRestore={dataHandlers.handleRestoreData} />}
      {isResetProgressModalOpen && <ResetProgressModal isOpen={isResetProgressModalOpen} onClose={closeResetProgressModal} onReset={dataHandlers.handleResetDeckProgress} decks={state.decks} />}
      {isConfirmModalOpen && <ConfirmModal isOpen={isConfirmModalOpen} onClose={closeConfirm} {...confirmModalProps} />}
      {folderToEdit !== null && <FolderModal folder={folderToEdit === 'new' ? null : folderToEdit} onClose={() => setFolderToEdit(null)} onSave={dataHandlers.handleSaveFolder} />}
      {seriesToEdit !== null && <EditSeriesModal series={seriesToEdit === 'new' ? null : seriesToEdit} onClose={() => setSeriesToEdit(null)} onSave={dataHandlers.handleSaveSeries} />}
    </div>
  );
};

export default App;
