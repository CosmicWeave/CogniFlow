
import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AppRouter from './components/AppRouter';
import ModalManager from './components/ModalManager';
import AIGenerationStatusIndicator from './components/AIGenerationStatusIndicator';
import AIChatFab from './components/AIChatFab';
import OfflineIndicator from './components/ui/OfflineIndicator';
import PullToRefreshIndicator from './components/ui/PullToRefreshIndicator';
import { DataManagementProvider, useData } from './contexts/DataManagementContext';
import { useDataManagement } from './hooks/useDataManagement';
import { useStore } from './store/store';
import { useSettings } from './hooks/useSettings';
import { useAutoHideHeader } from './hooks/useAutoHideHeader';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import * as googleDriveService from './services/googleDriveService';
import * as db from './services/db';
import { GoogleDriveFile } from './types';
import Button from './components/ui/Button';
import Icon from './components/ui/Icon';
import { analyzeFile } from './services/importService';

const AppContent: React.FC = () => {
  const { aiGenerationStatus, dispatch, isLoading } = useStore();
  const dataHandlers = useData();
  const settings = useSettings();
  const isHeaderVisible = useAutoHideHeader();
  const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd, REFRESH_THRESHOLD } = usePullToRefresh();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [isGapiSignedIn, setIsGapiSignedIn] = useState(false);
  const [gapiUser, setGapiUser] = useState<any>(null);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  // We no longer use initError to block the UI, but we track if DB failed
  const [isDbFailed, setIsDbFailed] = useState(false);
  
  const { decks, deckSeries, isLoading: storeLoading } = useStore();
  // Simple URL parsing for active items
  const activeDeckId = window.location.hash.match(/\/decks\/([^/?]+)/)?.[1];
  const activeSeriesId = window.location.hash.match(/\/series\/([^/?]+)/)?.[1];
  
  const activeDeck = activeDeckId ? decks[activeDeckId] || null : null;
  const activeSeries = activeSeriesId ? deckSeries[activeSeriesId] || null : null;

  // --- Google Drive Init ---
  useEffect(() => {
    googleDriveService.initGoogleDriveService()
      .then(() => {
        setIsGapiReady(true);
        googleDriveService.onAuthStateChanged((isSignedIn, user) => {
          setIsGapiSignedIn(isSignedIn);
          setGapiUser(user);
        });
        const previouslySignedIn = localStorage.getItem('gdrive-previously-signed-in');
        if (previouslySignedIn) {
          googleDriveService.attemptSilentSignIn();
        }
      })
      .catch(err => console.error("GAPI Init Error", err));
  }, []);

  // --- Global File Drop ---
  useEffect(() => {
      const handleWindowDragOver = (e: DragEvent) => {
          // Only allow dropping files, not internal elements like cards/decks
          if (e.dataTransfer?.types.includes('Files')) {
              e.preventDefault();
          }
      };

      const handleWindowDrop = async (e: DragEvent) => {
          if (!e.dataTransfer?.types.includes('Files')) return;
          e.preventDefault();
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const file = e.dataTransfer.files[0];
              try {
                  const analysis = await analyzeFile(file);
                  if (analysis) {
                      dataHandlers?.openModal('droppedFile', { analysis });
                  } else {
                      dataHandlers?.addToast(`Could not recognize format of "${file.name}".`, 'error');
                  }
              } catch (err) {
                  console.error("File analysis failed", err);
                  dataHandlers?.addToast('Failed to analyze dropped file.', 'error');
              }
          }
      };

      window.addEventListener('dragover', handleWindowDragOver);
      window.addEventListener('drop', handleWindowDrop);

      return () => {
          window.removeEventListener('dragover', handleWindowDragOver);
          window.removeEventListener('drop', handleWindowDrop);
      };
  }, [dataHandlers]);

  // --- Initial Data Load ---
  useEffect(() => {
    const loadData = async () => {
        try {
            const [decks, folders, deckSeries, sessions, seriesProgress, learningProgress, aiChatHistory] = await Promise.all([
                db.getAllDecks(),
                db.getAllFolders(),
                db.getAllDeckSeries(),
                db.getAllSessions(),
                db.getAllSeriesProgress(),
                db.getAllLearningProgress(),
                db.getAIChatHistory()
            ]);

            // Dispatch to global store
            dispatch({ type: 'LOAD_DATA', payload: { decks, folders, deckSeries } });
            dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: aiChatHistory });
            
            const progressMap = new Map<string, Set<string>>();
            Object.entries(seriesProgress).forEach(([seriesId, deckIds]) => {
                progressMap.set(seriesId, new Set(deckIds));
            });
            dispatch({ type: 'SET_SERIES_PROGRESS', payload: progressMap });
            dispatch({ type: 'SET_LEARNING_PROGRESS', payload: learningProgress });
            
            if (dataHandlers && dataHandlers.setSessionsToResume) {
                 dataHandlers.setSessionsToResume(new Set(sessions.map(s => s.id.replace('session_deck_', ''))));
            }

            if (dataHandlers) {
                dataHandlers.triggerSync({ isManual: false });
            }

        } catch (error) {
            console.error("Failed to load initial data from DB. Falling back to empty state.", error);
            // Treat as a fresh start if DB fails, rather than blocking the user
            setIsDbFailed(true);
            
            dispatch({ type: 'LOAD_DATA', payload: { decks: [], folders: [], deckSeries: [] } });
            
            if (dataHandlers) {
                dataHandlers.addToast("Storage error: Data may not persist between reloads.", "warning");
            }
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    loadData();
  }, [dispatch]); // Only run once on mount

  // --- AI Queue Processing ---
  useEffect(() => {
    const processQueue = async () => {
      if (aiGenerationStatus.isGenerating || aiGenerationStatus.queue.length === 0 || !dataHandlers) return;

      const task = aiGenerationStatus.queue[0];
      const abortController = new AbortController();
      
      dispatch({ type: 'START_NEXT_AI_TASK', payload: { task, abortController } });

      try {
        switch (task.type) {
            case 'generateFullSeriesFromScaffold':
                await (dataHandlers as any).onGenerateFullSeriesFromScaffold(task.payload, abortController.signal);
                break;
            case 'generateFlashcardDeckWithAI':
                await (dataHandlers as any).onGenerateFlashcardDeck(task.payload, abortController.signal);
                break;
            case 'generateLearningDeckWithAI':
                await (dataHandlers as any).onGenerateLearningDeckWithAI(task.payload, abortController.signal);
                break;
            case 'generateQuestionsForDeck':
                await (dataHandlers as any).onGenerateQuestionsForDeck(task.payload.deck, task.payload.count, task.payload.seriesContext, abortController.signal);
                break;
            case 'generateDeckFromOutline':
                 await (dataHandlers as any).onGenerateDeckFromOutline(task.payload.outline, task.payload.metadata, task.payload.seriesId, task.payload.levelIndex, abortController.signal);
                 break;
            case 'autoPopulateSeries':
                await (dataHandlers as any).onAutoPopulateSeries(task.payload, abortController.signal);
                break;
            case 'autoPopulateLevel':
                await (dataHandlers as any).onAutoPopulateLevel(task.payload, abortController.signal);
                break;
            case 'generateSeriesQuestionsInBatches':
                await (dataHandlers as any).onGenerateSeriesQuestionsInBatches(task.payload, abortController.signal);
                break;
            case 'regenerateQuestion':
                 await (dataHandlers as any).onRegenerateQuestion(task.payload, abortController.signal);
                 break;
            case 'generateSeriesLearningContentInBatches':
                 await (dataHandlers as any).onGenerateLearningContentForDeck(task.payload, abortController.signal);
                 break;
            default:
                console.warn(`Unknown AI task type: ${task.type}`);
                break;
        }
      } catch (error: any) {
         if (error.message !== "Cancelled by user" && error.name !== 'AbortError') {
             console.error("AI Task Failed", error);
             dataHandlers.addToast(`AI Task Failed: ${error.message}`, 'error');
         }
      } finally {
         dispatch({ type: 'FINISH_CURRENT_AI_TASK' });
      }
    };
    processQueue();
  }, [aiGenerationStatus.isGenerating, aiGenerationStatus.queue, dispatch, dataHandlers]);


  if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-text">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-lg font-medium animate-pulse">Loading Library...</p>
        </div>
      );
  }

  // Router props need to be wired up to the handlers and state
  const routerProps = {
      activeDeck,
      activeSeries,
      generalStudyDeck: null,
      sessionsToResume: new Set<string>(),
      onSync: () => dataHandlers?.handleManualSync(),
      isSyncing: false,
      lastSyncStatus: '',
      isGapiReady,
      isGapiSignedIn,
      gapiUser,
      sortPreference: 'lastOpened',
      setSortPreference: () => {},
      draggedDeckId: null,
      setDraggedDeckId: () => {},
      openFolderIds: new Set<string>(),
      onToggleFolder: (id: string) => {},
  };

  return (
    <div 
        className="min-h-screen bg-background text-text transition-colors duration-200"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <Header 
        onOpenMenu={() => setIsSidebarOpen(true)} 
        onOpenCommandPalette={() => dataHandlers?.openModal('commandPalette')}
        activeDeck={activeDeck}
        isVisible={isHeaderVisible}
      />
      
      {isDbFailed && (
          <div className="bg-red-500 text-white text-center text-xs py-1 px-2 fixed top-16 left-0 right-0 z-30">
              Storage Warning: Changes may not be saved locally due to a browser database error.
          </div>
      )}
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onImport={() => dataHandlers?.openModal('import')}
        onCreateSeries={() => dataHandlers?.openModal('series', { series: 'new' })}
        onGenerateAI={() => dataHandlers?.openModal('aiGeneration')}
        onInstall={null} 
      />

      <main className={`pt-20 pb-20 px-4 max-w-7xl mx-auto min-h-[calc(100vh-5rem)] ${isDbFailed ? 'mt-6' : ''}`}>
        <PullToRefreshIndicator 
            pullDistance={pullToRefreshState.pullDistance} 
            isRefreshing={pullToRefreshState.isRefreshing} 
            threshold={REFRESH_THRESHOLD} 
        />
        <AppRouter {...routerProps} 
            // Override with props passed from App wrapper if available, otherwise defaults
            sessionsToResume={dataHandlers.sessionsToResume || new Set()}
            isSyncing={dataHandlers.isSyncing || false}
            lastSyncStatus={dataHandlers.lastSyncStatus || ''}
            sortPreference={dataHandlers.sortPreference || 'lastOpened'}
            setSortPreference={dataHandlers.setSortPreference || (() => {})}
            draggedDeckId={dataHandlers.draggedDeckId || null}
            setDraggedDeckId={dataHandlers.setDraggedDeckId || (() => {})}
            openFolderIds={dataHandlers.openFolderIds || new Set()}
            onToggleFolder={dataHandlers.onToggleFolder || (() => {})}
            generalStudyDeck={dataHandlers.generalStudyDeck || null}
        />
      </main>

      <ModalManager driveFiles={driveFiles} />
      <AIGenerationStatusIndicator 
        onOpen={() => dataHandlers?.openModal('aiStatus')} 
        onCancel={() => dataHandlers?.handleCancelAIGeneration()} 
      />
      <AIChatFab />
      <OfflineIndicator />
    </div>
  );
};

const App: React.FC = () => {
    // Lift state required for UI that isn't in global store yet
    const [sessionsToResume, setSessionsToResume] = useState<Set<string>>(new Set());
    const [generalStudyDeck, setGeneralStudyDeck] = useState<any>(null);
    const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncStatus, setLastSyncStatus] = useState('');
    const [sortPreference, setSortPreference] = useState<any>('lastOpened');
    const [draggedDeckId, setDraggedDeckId] = useState<string | null>(null);
    const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());

    const settings = useSettings();

    // Pass state setters to hook so handlers can update them
    const dataManagementProps = {
        sessionsToResume,
        setSessionsToResume,
        generalStudyDeck,
        setGeneralStudyDeck,
        driveFiles,
        setDriveFiles,
        isSyncing,
        setIsSyncing,
        lastSyncStatus,
        setLastSyncStatus,
        sortPreference,
        setSortPreference,
        draggedDeckId,
        setDraggedDeckId,
        openFolderIds,
        setOpenFolderIds,
        onToggleFolder: (id: string) => {
            const newSet = new Set(openFolderIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setOpenFolderIds(newSet);
        },
        // Settings for sync
        backupEnabled: settings.backupEnabled,
        backupApiKey: settings.backupApiKey,
        syncOnCellular: settings.syncOnCellular
    };

    const dataHandlers = useDataManagement(dataManagementProps);

    // Combine handlers and state into one object for the context to consume easily
    const contextValue = {
        ...dataHandlers,
        // Expose state vars for AppContent to use in props
        sessionsToResume,
        generalStudyDeck,
        isSyncing,
        lastSyncStatus,
        sortPreference,
        setSortPreference,
        draggedDeckId,
        setDraggedDeckId,
        openFolderIds,
        onToggleFolder: dataManagementProps.onToggleFolder
    };

    return (
        <DataManagementProvider value={contextValue}>
            <AppContent />
        </DataManagementProvider>
    );
};

export default App;
