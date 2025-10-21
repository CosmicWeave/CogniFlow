// FIX: Populate `App.tsx` with the main application component.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from './store/store';
import { useDataManagement } from './hooks/useDataManagement';
import { useModal, ModalProvider } from './contexts/ModalContext'; // Re-exporting for use in Manager
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useAutoHideHeader } from './hooks/useAutoHideHeader';
import { usePullToRefresh, REFRESH_THRESHOLD } from './hooks/usePullToRefresh';
import * as db from './services/db';
import { onDataChange } from './services/syncService';
import { initGoogleDriveService, onAuthStateChanged, onGapiReady, attemptSilentSignIn } from './services/googleDriveService';
import { Deck, DeckSeries, QuizDeck, GoogleDriveFile } from './types';
import { useRouter } from './contexts/RouterContext';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ModalManager from './components/ModalManager';
import AppRouter from './components/AppRouter';
import OfflineIndicator from './components/ui/OfflineIndicator';
import AIGenerationStatusIndicator from './components/AIGenerationStatusIndicator';
import { DataManagementProvider } from './contexts/DataManagementContext';
import { SortPreference } from './components/ui/DeckSortControl';
import PullToRefreshIndicator from './components/ui/PullToRefreshIndicator';
import { analyzeFileContent } from './services/importService';

const App: React.FC = () => {
    const { dispatch, decks, deckSeries, isLoading, aiGenerationStatus } = useStore();
    const { path } = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sessionsToResume, setSessionsToResume] = useState<Set<string>>(new Set());
    const [generalStudyDeck, setGeneralStudyDeck] = useState<QuizDeck | null>(null);
    const [installPrompt, handleInstall] = useInstallPrompt();
    const isHeaderVisible = useAutoHideHeader();
    const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd } = usePullToRefresh();
    
    // State for sync and drive
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncStatus, setLastSyncStatus] = useState<string>('Not synced yet.');
    const [isGapiReady, setIsGapiReady] = useState(false);
    const [isGapiSignedIn, setIsGapiSignedIn] = useState(false);
    const [gapiUser, setGapiUser] = useState<any>(null);
    const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
    
    // State for drag & drop
    const [sortPreference, setSortPreference] = useState<SortPreference>('lastOpened');
    const [draggedDeckId, setDraggedDeckId] = useState<string | null>(null);
    const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
    
    const dataHandlers = useDataManagement({
        isSyncing, setIsSyncing, lastSyncStatus, setLastSyncStatus,
        isGapiReady, isGapiSignedIn, gapiUser,
        sessionsToResume, setSessionsToResume,
        setGeneralStudyDeck,
        setDriveFiles
    });

    const { openModal } = useModal();
    
    // --- Data Loading and Syncing ---
    const loadData = useCallback(async () => {
        try {
            const [decks, folders, deckSeries, sessions, seriesProgress, aiChatHistory] = await Promise.all([
                db.getAllDecks(),
                db.getAllFolders(),
                db.getAllDeckSeries(),
                db.getAllSessions(),
                db.getAllSeriesProgress(),
                db.getAIChatHistory()
            ]);
            dispatch({ type: 'LOAD_DATA', payload: { decks, folders, deckSeries } });
            dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: aiChatHistory });
            
            const progressMap = new Map<string, Set<string>>();
            Object.entries(seriesProgress).forEach(([seriesId, deckIds]) => {
                progressMap.set(seriesId, new Set(deckIds));
            });
            dispatch({ type: 'SET_SERIES_PROGRESS', payload: progressMap });
            
            setSessionsToResume(new Set(sessions.map(s => s.id.replace('session_deck_', ''))));
            
        } catch (error) {
            console.error("Failed to load initial data:", error);
        }
    }, [dispatch]);

    useEffect(() => {
        loadData();
        const unsubscribe = onDataChange(loadData);
        return unsubscribe;
    }, [loadData]);
    
    // --- Google Drive Initialization ---
    useEffect(() => {
        initGoogleDriveService();
        const unsubGapi = onGapiReady(setIsGapiReady);
        const unsubAuth = onAuthStateChanged((isSignedIn, user) => {
            setIsGapiSignedIn(isSignedIn);
            setGapiUser(user || null);
        });
        return () => { unsubGapi(); unsubAuth(); };
    }, []);

    useEffect(() => {
        if (isGapiReady && localStorage.getItem('gdrive-previously-signed-in') === 'true') {
            attemptSilentSignIn();
        }
    }, [isGapiReady]);

    // --- Drag and Drop File Import ---
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => e.preventDefault();
        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer?.files[0];
            if (file) {
                try {
                    const content = await file.text();
                    const analysis = analyzeFileContent(content);
                    if (analysis) {
                        openModal('droppedFile', { analysis: { ...analysis, fileName: file.name } });
                    }
                } catch (error) {
                    dataHandlers.addToast((error as Error).message, 'error');
                }
            }
        };
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);
        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, [openModal, dataHandlers]);
    
     // --- AI Task Queue Processor ---
    useEffect(() => {
        const processQueue = async () => {
            if (aiGenerationStatus.currentTask || (aiGenerationStatus.queue?.length || 0) === 0) {
                return;
            }

            const task = aiGenerationStatus.queue[0];
            const abortController = new AbortController();
            
            dispatch({ type: 'START_NEXT_AI_TASK', payload: { task, abortController } });

            try {
                switch (task.type) {
                    case 'generateFlashcardDeckWithAI':
                        await (dataHandlers as any).onGenerateFlashcardDeck(task.payload, abortController.signal);
                        break;
                    // FIX: Added a case for 'generateQuestionsForDeck' to handle question generation tasks from the AI queue.
                    case 'generateQuestionsForDeck':
                        await (dataHandlers as any).handleGenerateQuestionsForDeck(task.payload.deck, task.payload.count, abortController.signal);
                        break;
                    default:
                        console.warn(`Unknown AI task type: ${task.type}`);
                }
            } catch (error) {
                 if ((error as Error).name !== 'AbortError') {
                    console.error("Error processing AI task:", error);
                    dataHandlers.addToast(`AI task failed: ${(error as Error).message}`, 'error');
                } else {
                    console.log("AI task was cancelled by user.");
                    dataHandlers.addToast('AI task cancelled.', 'info');
                }
            } finally {
                // Check if the task is still the current one before finishing
                // This prevents a late-arriving error from dismissing a new task
                if (useStore.getState().aiGenerationStatus.currentTask?.id === task.id) {
                    dispatch({ type: 'FINISH_CURRENT_AI_TASK' });
                }
            }
        };

        processQueue();
    }, [aiGenerationStatus.queue, aiGenerationStatus.currentTask, dispatch, dataHandlers]);


    // --- App Logic ---
    const { activeDeck, activeSeries } = useMemo(() => {
        const deckMatch = path.match(/\/decks\/([^/]+)/);
        const seriesMatch = path.match(/\/series\/([^/]+)/);
        return {
            activeDeck: deckMatch ? decks.find(d => d.id === deckMatch[1]) || null : null,
            activeSeries: seriesMatch ? deckSeries.find(s => s.id === seriesMatch[1]) || null : null,
        };
    }, [path, decks, deckSeries]);
    
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    return (
        <DataManagementProvider value={dataHandlers}>
            <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                <PullToRefreshIndicator pullDistance={pullToRefreshState.pullDistance} isRefreshing={pullToRefreshState.isRefreshing} threshold={REFRESH_THRESHOLD} />
                <Header 
                    onOpenMenu={() => setIsSidebarOpen(true)}
                    onOpenCommandPalette={() => openModal('commandPalette')}
                    activeDeck={activeDeck}
                    isVisible={isHeaderVisible}
                />
                <Sidebar 
                    isOpen={isSidebarOpen} 
                    onClose={() => setIsSidebarOpen(false)}
                    onImport={() => openModal('import')}
                    onCreateSeries={() => openModal('series', { series: 'new' })}
                    onGenerateAI={() => openModal('aiGeneration')}
                    onInstall={installPrompt ? handleInstall : null}
                />
                <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 min-h-screen">
                    <AppRouter 
                        activeDeck={activeDeck}
                        activeSeries={activeSeries}
                        generalStudyDeck={generalStudyDeck}
                        sessionsToResume={sessionsToResume}
                        onSync={dataHandlers.handleManualSync}
                        isSyncing={isSyncing}
                        lastSyncStatus={lastSyncStatus}
                        isGapiReady={isGapiReady}
                        isGapiSignedIn={isGapiSignedIn}
                        gapiUser={gapiUser}
                        sortPreference={sortPreference}
                        setSortPreference={setSortPreference}
                        draggedDeckId={draggedDeckId}
                        setDraggedDeckId={setDraggedDeckId}
                        openFolderIds={openFolderIds}
                        onToggleFolder={(id) => setOpenFolderIds(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(id)) newSet.delete(id);
                            else newSet.add(id);
                            return newSet;
                        })}
                    />
                </main>
                <ModalManager driveFiles={driveFiles} />
                <OfflineIndicator />
                <AIGenerationStatusIndicator onOpen={() => openModal('aiStatus')} onCancel={dataHandlers.handleCancelAIGeneration} />
            </div>
        </DataManagementProvider>
    );
};

export default App;