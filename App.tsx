import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleDriveFile } from './types';
import * as backupService from './services/backupService';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import OfflineIndicator from './components/ui/OfflineIndicator';
import Sidebar from './components/Sidebar';
import { useToast } from './hooks/useToast';
import Spinner from './components/ui/Spinner';
import { useRouter } from './contexts/RouterContext';
import { useModal } from './contexts/ModalContext';
import { onDataChange } from './services/syncService';
import PullToRefreshIndicator from './components/ui/PullToRefreshIndicator';
import { parseAnkiPkg, parseAnkiPkgMainThread } from './services/ankiImportService';
import { useDataManagement } from './hooks/useDataManagement';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import Header from './components/Header';
import AppRouter from './components/AppRouter';
import Icon from './components/ui/Icon';
import Button from './components/ui/Button';
import { useStore } from './store/store';
import { analyzeFileContent } from './services/importService';
import { DroppedFileAnalysis } from './components/DroppedFileConfirmModal';
import { useSettings } from './hooks/useSettings';
import AIChatFab from './components/AIChatFab';
import AIGenerationStatusIndicator from './components/AIGenerationStatusIndicator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { DataManagementProvider } from './contexts/DataManagementContext';
import ModalManager from './components/ModalManager';
import * as db from './services/db';
import { useAutoHideHeader } from './hooks/useAutoHideHeader';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const App: React.FC = () => {
  const { dispatch, ...state } = useStore();
  const { aiGenerationStatus } = state;
  const [initError, setInitError] = useState<Error | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sessionsToResume, setSessionsToResume] = useState(new Set<string>());
  const [generalStudyDeck, setGeneralStudyDeck] = useState<any | null>(null);
  const [sortPreference, setSortPreference] = useState<SortPreference>('lastOpened');
  const [draggedDeckId, setDraggedDeckId] = useState<string | null>(null);
  const [openFolderIds, setOpenFolderIds] = useState(new Set<string>());
  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const dragCounter = useRef(0);
  const [installPrompt, handleInstall] = useInstallPrompt();
  const { addToast } = useToast();
  const { path, navigate } = useRouter();
  // FIX: Imported 'useModal' from './contexts/ModalContext' to resolve 'Cannot find name' error.
  const { modalType, openModal } = useModal();
  const { aiFeaturesEnabled, backupEnabled, backupApiKey, syncOnCellular } = useSettings();
  const { isOnline } = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState('Never synced.');
  const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd, REFRESH_THRESHOLD } = usePullToRefresh();
  const initialCheckDone = useRef(false);
  const [serverUpdateInfo, setServerUpdateInfo] = useState<{ modified: string; size: number } | null>(null);
  
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [isGapiSignedIn, setIsGapiSignedIn] = useState(false);
  const [gapiUser, setGapiUser] = useState<any>(null);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);

  const onToggleFolder = useCallback((folderId: string) => {
    setOpenFolderIds(prev => {
      const newSet = new Set(prev);
      newSet.has(folderId) ? newSet.delete(folderId) : newSet.add(folderId);
      return newSet;
    });
  }, []);
  
  const openMenu = useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  
  const dataHandlers = useDataManagement({
    sessionsToResume, setSessionsToResume, setGeneralStudyDeck,
    isGapiReady, isGapiSignedIn, gapiUser, setDriveFiles,
    isSyncing, setIsSyncing, setLastSyncStatus,
    backupEnabled, backupApiKey, syncOnCellular,
  });
  
  const { fetchAndRestoreFromServer, handleSync } = dataHandlers;

  // AI Queue Processor
  useEffect(() => {
    const processQueue = async () => {
        // FIX: Added more robust checks for `aiGenerationStatus` and its `queue` property to prevent errors if the state is not yet fully initialized.
        if (!aiGenerationStatus || !aiGenerationStatus.queue) {
            return;
        }
        if (aiGenerationStatus.currentTask || aiGenerationStatus.queue.length === 0) {
            return;
        }

        console.log('[AI Queue] Picking up next task from queue.');
        const task = aiGenerationStatus.queue[0];
        const abortController = new AbortController();
        dispatch({ type: 'START_NEXT_AI_TASK', payload: { task, abortController } });
        console.log(`[AI Queue] Starting task: ${task.type} (${task.id})`);

        try {
            switch (task.type) {
                case 'generateSeriesScaffoldWithAI':
                    await dataHandlers.onGenerateSeriesScaffold({ ...task.payload });
                    break;
                case 'generateDeckWithAI':
                    await dataHandlers.onGenerateDeck(task.payload);
                    break;
                case 'generateLearningDeckWithAI':
                    await dataHandlers.onGenerateLearningDeck(task.payload);
                    break;
                case 'generateQuestionsForDeck':
                    await dataHandlers.onGenerateQuestionsForDeck(task.payload.deck, task.payload.count);
                    break;
                case 'generateMoreLevelsForSeries':
                    await dataHandlers.handleAiAddLevelsToSeries(task.payload.seriesId);
                    break;
                case 'generateMoreDecksForLevel':
                    await dataHandlers.handleAiAddDecksToLevel(task.payload.seriesId, task.payload.levelIndex);
                    break;
                case 'generateSeriesQuestionsInBatches':
                    await dataHandlers.onGenerateSeriesQuestionsInBatches(task.payload.seriesId);
                    break;
                case 'generateSeriesLearningContentInBatches':
                    await dataHandlers.onGenerateSeriesLearningContentInBatches(task.payload.seriesId);
                    break;
                default:
                    console.warn(`[AI Queue] Unknown task type: ${(task as any).type}`);
            }
            console.log(`[AI Queue] Task completed successfully: ${task.type} (${task.id})`);
        } catch (error: any) {
            console.error(`[AI Queue] Task failed: ${task.type} (${task.id})`, error);
            if (error.name !== 'AbortError') {
                addToast(`AI Task Failed: ${error.message}`, 'error');
            }
        } finally {
            console.log(`[AI Queue] Finishing task: ${task.type} (${task.id})`);
            dispatch({ type: 'FINISH_CURRENT_AI_TASK' });
        }
    };

    processQueue();
  }, [aiGenerationStatus.queue, aiGenerationStatus.currentTask, dispatch, addToast, dataHandlers]);


  const loadInitialData = useCallback(async () => {
    try {
      console.log('[App] Starting initial data load...');
      const [decks, folders, deckSeries, sessionKeys, aiChatHistory, seriesProgressData] = await Promise.all([
        db.getAllDecks(), db.getAllFolders(), db.getAllDeckSeries(), db.getAllSessionKeys(), db.getAIChatHistory(), db.getAllSeriesProgress(),
      ]);
      console.log(`[App] Initial data loaded from DB. Decks: ${decks.length}, Folders: ${folders.length}, Series: ${deckSeries.length}, Sessions: ${sessionKeys.length}, Progress sets: ${Object.keys(seriesProgressData).length}, Chat history: ${aiChatHistory.length}.`);
      dispatch({ type: 'LOAD_DATA', payload: { decks, folders, deckSeries } });
      const progressMap = new Map<string, Set<string>>();
      Object.entries(seriesProgressData).forEach(([seriesId, completedDeckIds]) => {
          if (Array.isArray(completedDeckIds)) progressMap.set(seriesId, new Set(completedDeckIds));
      });
      dispatch({ type: 'SET_SERIES_PROGRESS', payload: progressMap });
      setSessionsToResume(new Set(sessionKeys.map((key: string) => key.replace('session_deck_', ''))));
      if (aiChatHistory.length > 0) dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: aiChatHistory });

      if (!initialCheckDone.current && backupEnabled && decks.length === 0 && folders.length === 0 && deckSeries.length === 0) {
        initialCheckDone.current = true;
        try {
            const { metadata } = await backupService.getSyncDataMetadata();
            if (metadata?.size) {
                openModal('confirm', {
                    title: 'Restore from Server?',
                    message: `Your local data is empty, but a backup was found on the server from ${new Date(metadata.modified).toLocaleString()}. Would you like to restore it?`,
                    onConfirm: fetchAndRestoreFromServer,
                    confirmText: 'Restore'
                });
            }
        } catch (e) {
            if ((e as any).status !== 404) console.warn("Failed to check for server backup on initial load:", e);
        }
      }
      
      if(localStorage.getItem('cogniflow-post-merge-sync')) {
        localStorage.removeItem('cogniflow-post-merge-sync');
        handleSync({ force: true });
      }

    } catch (error) {
        console.error("Initialization Error during data load:", error);
        setInitError(error as Error);
        dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, addToast, backupEnabled, openModal, fetchAndRestoreFromServer, handleSync]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const checkForServerUpdates = async () => {
        if (!backupEnabled || !backupApiKey || !isOnline) return;

        const lastCheckString = localStorage.getItem('cogniflow-lastServerUpdateCheck');
        const now = new Date().getTime();
        
        if (lastCheckString && now - parseInt(lastCheckString, 10) < 24 * 60 * 60 * 1000) return;

        console.log('[Sync Check] Performing daily check for server updates...');
        localStorage.setItem('cogniflow-lastServerUpdateCheck', now.toString());

        try {
            const { lastModified } = useStore.getState();
            const lastSyncTimestamp = localStorage.getItem('cogniflow-lastSyncTimestamp');
            const localHasChanges = lastModified !== null && (!lastSyncTimestamp || lastModified > new Date(lastSyncTimestamp).getTime());
            
            const { metadata } = await backupService.getSyncDataMetadata();
            const serverHasChanges = metadata && (!lastSyncTimestamp || new Date(metadata.modified).getTime() > new Date(lastSyncTimestamp).getTime());
            
            if (localHasChanges && serverHasChanges) {
                await handleSync({ isManual: false });
            } else if (serverHasChanges) {
                setServerUpdateInfo({ modified: metadata.modified, size: metadata.size });
            }
        } catch (error) {
            console.warn('Daily check for server updates failed:', error);
        }
    };
    const timeoutId = setTimeout(checkForServerUpdates, 5000);
    return () => clearTimeout(timeoutId);
  }, [backupEnabled, backupApiKey, isOnline, handleSync]);
  
  useEffect(() => {
    const unsubscribe = onDataChange(() => {
        addToast("Data updated in another tab. Refreshing...", "info");
        loadInitialData();
    });
    return unsubscribe;
  }, [addToast, loadInitialData]);
  
  useEffect(() => {
    try { 
      const savedOpenFolders = localStorage.getItem('cogniflow-openFolderIds');
      if (savedOpenFolders) {
        const parsed = JSON.parse(savedOpenFolders);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          setOpenFolderIds(new Set(parsed as string[]));
        }
      }
    } catch (error) { console.error("Failed to load open folder IDs", error); }
  }, []);
  
  useEffect(() => {
    try { localStorage.setItem('cogniflow-openFolderIds', JSON.stringify(Array.from(openFolderIds))); } catch (error) { console.error("Failed to save open folder IDs", error); }
  }, [openFolderIds]);
  
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

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent global drag overlay when a modal that accepts files is open
    if (modalType === 'import' || modalType === 'restore' || modalType === 'aiGeneration') {
        return;
    }
    dragCounter.current++;
    if (e.dataTransfer.items?.length) {
        setIsDraggingOverWindow(true);
    }
  };
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
            const decks = await parseAnkiPkg(buffer.slice(0)).catch(() => parseAnkiPkgMainThread(buffer));
            if (decks.length > 0) { dataHandlers.handleAddDecks(decks); addToast(`Imported ${decks.length} deck(s).`, 'success'); }
            else { addToast('No valid decks found.', 'info'); }
        } catch (error) { addToast(`Error processing Anki package: ${error instanceof Error ? error.message : "Unknown"}`, 'error'); }
      } else {
          const analysis = analyzeFileContent(content);
          if (analysis) {
            openModal('droppedFile', { analysis: { ...analysis, fileName: file.name } });
          } else {
            addToast("Unsupported file format.", 'error');
          }
      }
    };
    reader.readAsText(file);
  };
  const isHeaderVisible = useAutoHideHeader();

  if (initError) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background"><div className="text-center bg-surface p-8 rounded-lg shadow-xl max-w-lg w-full border border-border"><Icon name="x-circle" className="w-16 h-16 text-red-500 mx-auto mb-4"/><h1 className="text-3xl font-bold text-red-500 mb-4">Application Error</h1><p className="text-text-muted mb-6">A critical database error occurred. Please clear website data in your browser settings, then reload.</p><Button variant="danger" onClick={() => window.location.reload()}>Reload Page</Button></div></div>
  );

  return (
    <DataManagementProvider value={dataHandlers}>
      <div className="min-h-screen text-text flex flex-col overflow-x-hidden"
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        <PullToRefreshIndicator pullDistance={pullToRefreshState.pullDistance} isRefreshing={pullToRefreshState.isRefreshing} threshold={REFRESH_THRESHOLD} />
        <Sidebar isOpen={isMenuOpen} onClose={closeMenu} onImport={() => openModal('import')} onCreateSeries={() => openModal('series', { series: 'new' })} onGenerateAI={() => openModal('aiGeneration')} onInstall={installPrompt ? handleInstall : null} />
        <div className="flex-1 flex flex-col">
          <Header onOpenMenu={openMenu} onOpenCommandPalette={() => openModal('commandPalette')} activeDeck={activeDeck} isVisible={isHeaderVisible} />
          <main className="main-content-area flex-1 container mx-auto px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 pt-20 sm:pt-[5.5rem] lg:pt-24">
              {serverUpdateInfo && (
                <div className="bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200 p-4 rounded-r-lg mb-6 flex items-center justify-between gap-4 shadow-md animate-fade-in" role="alert">
                  <div className="flex items-center gap-3"><Icon name="upload-cloud" className="w-6 h-6 text-blue-500" /><div><p className="font-bold">Update Available</p><p className="text-sm">Newer data found on server from {new Date(serverUpdateInfo.modified).toLocaleString()}.</p></div></div>
                  <div className="flex items-center gap-2"><Button size="sm" onClick={() => { dataHandlers.handleForceFetchFromServer(); setServerUpdateInfo(null); }}>Sync Now</Button><Button size="sm" variant="ghost" onClick={() => setServerUpdateInfo(null)}>Dismiss</Button></div>
                </div>
              )}
              {state.isLoading ? <div className="text-center p-8"><Spinner /></div> : (
                  <AppRouter sessionsToResume={sessionsToResume} sortPreference={sortPreference} setSortPreference={setSortPreference} draggedDeckId={draggedDeckId} setDraggedDeckId={setDraggedDeckId} openFolderIds={openFolderIds} onToggleFolder={onToggleFolder} generalStudyDeck={generalStudyDeck} activeDeck={activeDeck} activeSeries={activeSeries} onSync={dataHandlers.handleManualSync} isSyncing={isSyncing} lastSyncStatus={lastSyncStatus} isGapiReady={isGapiReady} isGapiSignedIn={isGapiSignedIn} gapiUser={gapiUser} />
              )}
          </main>
        </div>
        <OfflineIndicator />
        <ModalManager driveFiles={driveFiles} />
        {isDraggingOverWindow && (
          <div className="fixed inset-0 bg-black/50 z-[55] flex items-center justify-center p-4"><div className="bg-surface rounded-lg p-8 text-center border-4 border-dashed border-primary"><Icon name="upload-cloud" className="w-16 h-16 text-primary mx-auto mb-4" /><p className="text-xl font-semibold">Drop file to import</p></div></div>
        )}
        {aiFeaturesEnabled && (<>
          <AIChatFab />
          <AIGenerationStatusIndicator onOpen={() => openModal('aiStatus')} onCancel={dataHandlers.handleCancelAIGeneration} />
        </>)}
      </div>
    </DataManagementProvider>
  );
};

export default App;