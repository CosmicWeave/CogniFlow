


import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Deck, DeckSeries, Folder, QuizDeck, SeriesProgress, DeckType, FlashcardDeck, SeriesLevel } from './types';
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
import Icon, { IconName } from './components/ui/Icon';
import { useStore } from './store/store';
import { analyzeFileContent, createCardsFromImport, createQuestionsFromImport } from './services/importService';
import DroppedFileConfirmModal, { DroppedFileAnalysis } from './components/DroppedFileConfirmModal';
import Breadcrumbs, { BreadcrumbItem } from './components/ui/Breadcrumbs';
import AIGenerationModal from './components/AIGenerationModal';
import { useSettings } from './hooks/useSettings';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const App: React.FC = () => {
  const { dispatch, ...state } = useStore();
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isAIGenerationModalOpen, setAIGenerationModalOpen] = useState(false);
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

  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const [droppedFileAnalysis, setDroppedFileAnalysis] = useState<DroppedFileAnalysis | null>(null);
  const dragCounter = useRef(0);

  const [installPrompt, handleInstall] = useInstallPrompt();
  const { addToast } = useToast();
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const { path, navigate } = useRouter();
  const initialLoadComplete = useRef(false);
  const { aiFeaturesEnabled } = useSettings();

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
  const { handleAddDecks, handleAddSeriesWithDecks, handleRestoreData } = dataHandlers;

    const handleDroppedFileConfirm = (analysis: DroppedFileAnalysis, deckName?: string) => {
    setDroppedFileAnalysis(null);
    try {
        switch (analysis.type) {
            case 'backup':
                handleRestoreData(analysis.data);
                break;
            case 'quiz_series':
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
                    return {
                        title: levelData.title,
                        deckIds: decksForLevel.map(deck => deck.id)
                    };
                });
                const newSeries: DeckSeries = {
                    id: crypto.randomUUID(),
                    type: 'series',
                    name: seriesName,
                    description: seriesDescription,
                    levels: newLevels,
                    createdAt: new Date().toISOString(),
                };
                handleAddSeriesWithDecks(newSeries, allNewDecks);
                break;
            
            case 'quiz':
            case 'flashcard':
                const finalDeckName = deckName || (analysis.type === 'quiz' ? analysis.data.name : '');
                if (!finalDeckName) {
                    addToast('A deck name is required.', 'error');
                    return;
                }
                let newDeck: Deck;
                if (analysis.type === 'flashcard') {
                    const cards = createCardsFromImport(analysis.data);
                    newDeck = {
                        id: crypto.randomUUID(),
                        name: finalDeckName,
                        type: DeckType.Flashcard,
                        cards: cards,
                        description: `${cards.length} imported flashcard${cards.length === 1 ? '' : 's'}.`
                    } as FlashcardDeck;
                } else { // Quiz
                    const questions = createQuestionsFromImport(analysis.data.questions);
                    newDeck = {
                        id: crypto.randomUUID(),
                        name: finalDeckName,
                        description: analysis.data.description,
                        type: DeckType.Quiz,
                        questions: questions
                    } as QuizDeck;
                }
                handleAddDecks([newDeck]);
                addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
                break;
        }
    } catch (error) {
        console.error("Failed to confirm dropped file action:", error);
        addToast(`An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
    }
};

  // Global keydown listener for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        const isAnyModalOpen = isImportModalOpen || isRestoreModalOpen || isResetProgressModalOpen || isConfirmModalOpen || folderToEdit !== null || seriesToEdit !== null || droppedFileAnalysis !== null;
        if (!isInputFocused && !isAnyModalOpen) {
          openCommandPalette();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImportModalOpen, isRestoreModalOpen, isResetProgressModalOpen, isConfirmModalOpen, folderToEdit, seriesToEdit, droppedFileAnalysis, openCommandPalette]);

  // Global Drag and Drop handler
  useEffect(() => {
    const isFileDrag = (e: DragEvent) => {
        return e.dataTransfer?.types.includes('Files');
    };

    const handleDragEnter = (e: DragEvent) => {
        if (isFileDrag(e)) {
            e.preventDefault();
            dragCounter.current++;
            setIsDraggingOverWindow(true);
        }
    };

    const handleDragOver = (e: DragEvent) => {
        if (isFileDrag(e)) {
            e.preventDefault();
        }
    };

    const handleDragLeave = (e: DragEvent) => {
        if (dragCounter.current > 0) {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current === 0) {
                setIsDraggingOverWindow(false);
            }
        }
    };

    const handleDrop = async (e: DragEvent) => {
        if (isFileDrag(e)) {
            e.preventDefault();
            dragCounter.current = 0;
            setIsDraggingOverWindow(false);

            const file = e.dataTransfer?.files?.[0];
            if (!file) return;

            addToast(`Processing ${file.name}...`, 'info');

            try {
                if (file.name.toLowerCase().endsWith('.apkg')) {
                    const buffer = await file.arrayBuffer();
                    const decks = await parseAnkiPkg(buffer);
                    if (decks.length > 0) {
                        await handleAddDecks(decks);
                        addToast(`Successfully imported ${decks.length} deck(s) from ${file.name}.`, 'success');
                    } else {
                        addToast('No valid decks found in the Anki package.', 'info');
                    }
                } else if (file.name.toLowerCase().endsWith('.json')) {
                    const text = await file.text();
                    const analysis = analyzeFileContent(text);
                    if (analysis) {
                        setDroppedFileAnalysis({ ...analysis, fileName: file.name } as DroppedFileAnalysis);
                    } else {
                        addToast(`"${file.name}" is not a recognized CogniFlow file format.`, 'error');
                    }
                } else {
                    addToast(`Unsupported file type: "${file.name}".`, 'error');
                }
            } catch (error) {
                console.error("Failed to process dropped file:", error);
                addToast(`An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, 'error');
            }
        }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
        window.removeEventListener('dragenter', handleDragEnter);
        window.removeEventListener('dragover', handleDragOver);
        window.removeEventListener('dragleave', handleDragLeave);
        window.removeEventListener('drop', handleDrop);
    };
  }, [handleAddDecks, handleRestoreData, handleAddSeriesWithDecks, addToast]);


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
      dispatch({ type: 'SET_SERIES_PROGRESS', payload: loadedProgress });

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
  }, [addToast, dispatch]);

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
                const completedInSeries = state.seriesProgress.get(series.id)?.size || 0;
                const isLocked = deckIndex > completedInSeries;
                return { ...baseDeck, locked: isLocked };
            }
        }
    }
    return baseDeck;
  }, [path, state.decks, state.deckSeries, state.seriesProgress]);

  const activeSeries = useMemo(() => {
    const getActiveSeriesId = (p: string) => p.match(/^\/series\/([^/?]+)/)?.[1] || null;
    const activeSeriesId = getActiveSeriesId(path);
    if (!activeSeriesId) return null;
    return state.deckSeries.find(s => s.id === activeSeriesId);
  }, [path, state.deckSeries]);

  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
    const pathSegments = path.split('?')[0].split('/').filter(Boolean);

    if (pathSegments[0] === 'series') {
        items.push({ label: 'Series', href: '/series' });
        if (pathSegments[1] && activeSeries) {
            items.push({ label: activeSeries.name, href: `/series/${activeSeries.id}` });
        }
    } else if (pathSegments[0] === 'decks') {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const seriesId = params.get('seriesId');
        
        if (seriesId) {
            const series = state.deckSeries.find(s => s.id === seriesId);
            if (series) {
                items.push({ label: 'Series', href: '/series' });
                items.push({ label: series.name, href: `/series/${series.id}` });
            }
        } else {
             items.push({ label: 'Decks', href: '/decks' });
        }

        if (pathSegments[1] && activeDeck) {
            items.push({ label: activeDeck.name });
        }
    } else if (pathSegments[0] === 'archive') {
        items.push({ label: 'Archive' });
    } else if (pathSegments[0] === 'trash') {
        items.push({ label: 'Trash' });
    } else if (pathSegments[0] === 'settings') {
        items.push({ label: 'Settings' });
    } else if (pathSegments[0] === 'progress') {
        items.push({ label: 'Progress' });
    } else if (pathSegments[0] === 'instructions' && pathSegments[1] === 'json') {
        items.push({ label: 'JSON Guide' });
    }
    
    return items;
  }, [path, activeDeck, activeSeries, state.deckSeries]);

  const commandPaletteActions = useMemo(() => {
    const goToSettingSection = (sectionId: string) => {
      navigate('/settings');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };
    const baseActions = [
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
    
    if(aiFeaturesEnabled) {
        baseActions.unshift({ id: 'ai-generate', label: 'Generate Series with AI', icon: 'zap' as IconName, action: openAIGenerationModal });
    }
    
    return baseActions;
  }, [navigate, openImportModal, openSeriesEditor, aiFeaturesEnabled, openAIGenerationModal]);


  if (state.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300"><Spinner size="lg" />Loading CogniFlow...</h1></div>;
  }

  return (
    <div className="min-h-screen text-text flex flex-col overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isDraggingOverWindow && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex flex-col items-center justify-center z-[100] border-4 border-dashed border-primary pointer-events-none">
          <Icon name="upload-cloud" className="w-24 h-24 text-primary drop-shadow-lg animate-pulse" />
          <p className="mt-4 text-2xl font-bold text-white drop-shadow-lg">Drop File Anywhere to Import</p>
        </div>
      )}
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
        onGenerateAI={() => { openAIGenerationModal(); closeMenu(); }}
        onInstall={installPrompt ? () => { handleInstall(); closeMenu(); } : null}
      />
      <div className="flex-grow flex flex-col">
        <Header 
          activeDeck={activeDeck} 
          onOpenMenu={openMenu}
          onOpenCommandPalette={openCommandPalette}
        />
        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumbs items={breadcrumbItems} />
          <AppRouter
            sessionsToResume={sessionsToResume}
            sortPreference={sortPreference}
            setSortPreference={setSortPreference}
            draggedDeckId={draggedDeckId}
            setDraggedDeckId={setDraggedDeckId}
            openFolderIds={openFolderIds}
            onToggleFolder={handleToggleFolder}
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
            handleAiAddLevelsToSeries={dataHandlers.handleAiAddLevelsToSeries}
            handleAiAddDecksToLevel={dataHandlers.handleAiAddDecksToLevel}
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
      {aiFeaturesEnabled && isAIGenerationModalOpen && <AIGenerationModal isOpen={isAIGenerationModalOpen} onClose={closeAIGenerationModal} onAddSeriesWithDecks={dataHandlers.handleAddSeriesWithDecks} />}
      {isRestoreModalOpen && <RestoreModal isOpen={isRestoreModalOpen} onClose={closeRestoreModal} onRestore={dataHandlers.handleRestoreData} />}
      {isResetProgressModalOpen && <ResetProgressModal isOpen={isResetProgressModalOpen} onClose={closeResetProgressModal} onReset={dataHandlers.handleResetDeckProgress} decks={state.decks} />}
      {isConfirmModalOpen && <ConfirmModal isOpen={isConfirmModalOpen} onClose={closeConfirm} {...confirmModalProps} />}
      {folderToEdit !== null && <FolderModal folder={folderToEdit === 'new' ? null : folderToEdit} onClose={() => setFolderToEdit(null)} onSave={dataHandlers.handleSaveFolder} />}
      {seriesToEdit !== null && <EditSeriesModal series={seriesToEdit === 'new' ? null : seriesToEdit} onClose={() => setSeriesToEdit(null)} onSave={dataHandlers.handleSaveSeries} />}
      {droppedFileAnalysis && <DroppedFileConfirmModal
        isOpen={!!droppedFileAnalysis}
        onClose={() => setDroppedFileAnalysis(null)}
        analysis={droppedFileAnalysis}
        onConfirm={handleDroppedFileConfirm}
      />}
    </div>
  );
};

export default App;
