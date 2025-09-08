import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Deck, DeckSeries, Folder, QuizDeck, SeriesProgress, DeckType, FlashcardDeck, SeriesLevel, Card, Question, AIAction, LearningDeck, InfoCard, FullBackupData, AIMessage, GoogleDriveFile } from './types';
import * as db from './services/db';
import * as backupService from './services/backupService';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import OfflineIndicator from './components/ui/OfflineIndicator';
import Sidebar from './components/Sidebar';
import { useToast } from './hooks/useToast';
import Spinner from './components/ui/Spinner';
import { useRouter } from './contexts/RouterContext';
import { onDataChange } from './services/syncService';
import PullToRefreshIndicator from './components/ui/PullToRefreshIndicator';
import { parseAnkiPkg, parseAnkiPkgMainThread } from './services/ankiImportService';
import { useDataManagement } from './hooks/useDataManagement';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import Header from './components/Header';
import AppRouter from './components/AppRouter';
import CommandPalette from './components/CommandPalette';
import Icon, { IconName } from './components/ui/Icon';
import Button from './components/ui/Button';
import { useStore } from './store/store';
import { analyzeFileContent, createCardsFromImport, createQuestionsFromImport } from './services/importService';
import { DroppedFileAnalysis } from './components/DroppedFileConfirmModal';
import { useSettings } from './hooks/useSettings';
import AIChatFab from './components/AIChatFab';
import AIGenerationStatusIndicator from './components/AIGenerationStatusIndicator';
import { parseServerDate } from './services/time';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { DataManagementProvider } from './contexts/DataManagementContext';
import ModalManager from './components/ModalManager';
import { useModal } from './contexts/ModalContext';

export type SortPreference = 'lastOpened' | 'name' | 'dueCount';

const App: React.FC = () => {
  const { dispatch, ...state } = useStore();
  const [initError, setInitError] = useState<Error | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sessionsToResume, setSessionsToResume] = useState(new Set<string>());
  const [generalStudyDeck, setGeneralStudyDeck] = useState<QuizDeck | null>(null);
  const [sortPreference, setSortPreference] = useState<SortPreference>('lastOpened');
  const [draggedDeckId, setDraggedDeckId] = useState<string | null>(null);
  const [openFolderIds, setOpenFolderIds] = useState(new Set<string>());
  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const dragCounter = useRef(0);
  const [installPrompt, handleInstall] = useInstallPrompt();
  const { addToast } = useToast();
  const { path, navigate } = useRouter();
  const { openModal } = useModal();
  const { aiFeaturesEnabled, backupEnabled, backupApiKey, syncOnCellular } = useSettings();
  const { isMetered } = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState('Never synced.');
  const { pullToRefreshState, handleTouchStart, handleTouchMove, handleTouchEnd, REFRESH_THRESHOLD } = usePullToRefresh();
  const initialCheckDone = useRef(false);
  const isSyncingRef = useRef(false);
  
  // Google Drive State
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
  
  const triggerSync = useCallback(async (options: { isManual?: boolean, dataToSync?: backupService.ServerSyncData, force?: boolean } = {}) => {
    const { isManual = false, dataToSync, force = false } = options;
    console.log(`[Sync] Triggered sync. Manual: ${!!isManual}, Force: ${!!force}.`);
    
    if (!isManual && isMetered && !syncOnCellular) { setLastSyncStatus('Sync paused on mobile data.'); return; }
    if (!backupEnabled || !backupApiKey) { if (isManual) addToast('Server sync is not enabled or API key is missing.', 'error'); return; }

    const lastSyncTimestamp = localStorage.getItem('cogniflow-lastSyncTimestamp');
    const { lastModified } = useStore.getState();
    if (!force && !dataToSync && (lastModified === null || (lastSyncTimestamp && lastModified < new Date(lastSyncTimestamp).getTime()))) {
      if (isManual) {
        addToast("No local changes to sync.", "info");
      }
      setLastSyncStatus(lastSyncTimestamp ? `Up to date. Last synced: ${new Date(lastSyncTimestamp).toLocaleTimeString()}` : 'Up to date.');
      return;
    }
    
    if (isSyncingRef.current) { 
        console.log('[Sync] Sync already in progress, skipping.');
        if (isManual) addToast('A sync operation is already in progress.', 'info'); 
        return; 
    }
    
    isSyncingRef.current = true;
    setIsSyncing(true);
    setLastSyncStatus(force ? 'Force uploading...' : 'Syncing...');
    console.log('[Sync] Starting sync operation...');
    if (isManual) addToast(force ? 'Force upload started...' : 'Sync started...', 'info');
    try {
        const { timestamp, etag } = await backupService.syncDataToServer(dataToSync, force);
        if (aiFeaturesEnabled) await backupService.syncAIChatHistoryToServer();
        const syncDate = parseServerDate(timestamp);
        if (isNaN(syncDate.getTime())) throw new Error('Received an invalid date from the server during sync.');
        console.log('[Sync] Sync successful. Server timestamp:', timestamp);
        localStorage.setItem('cogniflow-lastSyncTimestamp', syncDate.toISOString());
        localStorage.setItem('cogniflow-lastSyncEtag', etag);
        setLastSyncStatus(`Last synced: ${syncDate.toLocaleTimeString()}`);
        if (isManual) addToast('Data successfully synced to server.', 'success');
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[Sync] Sync failed:", e);
        setLastSyncStatus(`Error: ${message}`);
        addToast(`Server sync failed: ${message}`, 'error');
    } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
        console.log('[Sync] Sync operation finished.');
    }
  }, [backupEnabled, backupApiKey, addToast, aiFeaturesEnabled, isMetered, syncOnCellular]);

  const dataHandlers = useDataManagement({
    sessionsToResume, setSessionsToResume, setGeneralStudyDeck, triggerSync,
    isGapiReady, isGapiSignedIn, gapiUser, setDriveFiles,
    isSyncing, setIsSyncing, setLastSyncStatus
  });
  
  const { handleAddDecks, handleAddSeriesWithDecks, handleRestoreData, fetchAndRestoreFromServer } = dataHandlers;

  const handleDroppedFileConfirm = useCallback((analysis: DroppedFileAnalysis, deckName?: string) => {
    try {
        switch (analysis.type) {
            case 'backup': handleRestoreData(analysis.data); break;
            case 'quiz_series': {
                const { seriesName, seriesDescription, levels: levelsData } = analysis.data;
                const allNewDecks: QuizDeck[] = [];
                const newLevels: SeriesLevel[] = levelsData.map((levelData: any) => {
                    const decksForLevel: QuizDeck[] = levelData.decks.map((d: any) => ({
                        id: crypto.randomUUID(), name: d.name, description: d.description, type: DeckType.Quiz, questions: createQuestionsFromImport(d.questions)
                    }));
                    allNewDecks.push(...decksForLevel);
                    return { title: levelData.title, deckIds: decksForLevel.map(deck => deck.id) };
                });
                const newSeries: DeckSeries = {
                    id: crypto.randomUUID(), type: 'series', name: seriesName, description: seriesDescription, levels: newLevels, archived: false, createdAt: new Date().toISOString()
                };
                handleAddSeriesWithDecks(newSeries, allNewDecks);
                break;
            }
            case 'quiz': {
                const newDeck: QuizDeck = {
                    id: crypto.randomUUID(), name: deckName || analysis.data.name, description: analysis.data.description, type: DeckType.Quiz, questions: createQuestionsFromImport(analysis.data.questions)
                };
                handleAddDecks([newDeck]);
                addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
                break;
            }
            case 'flashcard': {
                if (!deckName) { addToast('A deck name is required for flashcard imports.', 'error'); return; }
                const newDeck: FlashcardDeck = {
                    id: crypto.randomUUID(), name: deckName, type: DeckType.Flashcard, cards: createCardsFromImport(analysis.data), description: `${analysis.data.length} imported flashcard${analysis.data.length === 1 ? '' : 's'}.`
                };
                handleAddDecks([newDeck]);
                addToast(`Deck "${newDeck.name}" imported successfully.`, 'success');
                break;
            }
        }
    } catch (e) { addToast(e instanceof Error ? e.message : "Failed to process the dropped file.", 'error'); }
  }, [handleRestoreData, handleAddSeriesWithDecks, handleAddDecks, addToast]);
  
  const loadInitialData = useCallback(async () => {
    try {
      const [decks, folders, deckSeries, sessionKeys, aiChatHistory, seriesProgressData] = await Promise.all([
        db.getAllDecks(), db.getAllFolders(), db.getAllDeckSeries(), db.getAllSessionKeys(), db.getAIChatHistory(), db.getAllSeriesProgress(),
      ]);
      dispatch({ type: 'LOAD_DATA', payload: { decks, folders, deckSeries } });
      const progressMap = new Map<string, Set<string>>();
      for (const [seriesId, completedDeckIds] of Object.entries(seriesProgressData)) {
          if (Array.isArray(completedDeckIds)) progressMap.set(seriesId, new Set(completedDeckIds));
      }
      dispatch({ type: 'SET_SERIES_PROGRESS', payload: progressMap });
      setSessionsToResume(new Set(sessionKeys.map((key: string) => key.replace('session_deck_', ''))));
      if (aiChatHistory.length > 0) dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: aiChatHistory });

      if (!initialCheckDone.current && backupEnabled && decks.length === 0 && folders.length === 0 && deckSeries.length === 0) {
        initialCheckDone.current = true;
        console.log("Local data is empty, checking for server backup...");
        try {
            const { metadata } = await backupService.getSyncDataMetadata();
            if (metadata && metadata.size > 0) {
                console.log("Server backup found. Prompting user to restore.");
                openModal('confirm', {
                    title: 'Restore from Server?',
                    message: `Your local data is empty, but a backup was found on the server from ${new Date(metadata.modified).toLocaleString()}. Would you like to restore it?`,
                    onConfirm: fetchAndRestoreFromServer,
                    confirmText: 'Restore'
                });
            }
        } catch (e) {
            if ((e as any).status !== 404) {
              console.warn("Failed to check for server backup on initial load:", e);
            }
        }
      }
    } catch (error) {
        console.error("Initialization Error:", error);
        setInitError(error as Error);
        dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, addToast, backupEnabled, openModal, fetchAndRestoreFromServer]);

  useEffect(() => {
    console.log("App mounted. To run backup service tests, type `runBackupServiceTests()` in the console.");
    loadInitialData();
  }, [loadInitialData]);
  
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
    } catch (error) { 
      console.error("Failed to load open folder IDs", error); 
    }
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
            let decks: Deck[] = [];
            try { decks = await parseAnkiPkg(buffer.slice(0)); } catch (workerError) {
                console.warn("Anki worker failed, trying main thread fallback:", workerError);
                addToast("Import via worker failed. Trying a slower fallback method...", "info");
                try { decks = await parseAnkiPkgMainThread(buffer); } catch (mainThreadError) { throw mainThreadError; }
            }
            if (decks.length > 0) { handleAddDecks(decks); addToast(`Successfully imported ${decks.length} deck(s).`, 'success'); }
            else { addToast('No valid decks found in the Anki package.', 'info'); }
        } catch (error) { addToast(`Error processing Anki package: ${error instanceof Error ? error.message : "Unknown error"}`, 'error'); }
      } else {
          const analysis = analyzeFileContent(content);
          if (analysis) {
            openModal('droppedFile', { analysis: { ...analysis, fileName: file.name }, onConfirm: handleDroppedFileConfirm });
          } else {
            addToast("Unsupported or invalid file format.", 'error');
          }
      }
    };
    reader.readAsText(file);
  };

  if (initError) {
    const isDbError = initError.message.includes('Could not open or delete the database');
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="text-center bg-surface p-6 sm:p-8 rounded-lg shadow-xl max-w-lg w-full border border-border">
                <Icon name="x-circle" className="w-16 h-16 text-red-500 mx-auto mb-4"/>
                <h1 className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-500 mb-4">
                  Application Error
                </h1>
                <p className="text-text-muted mb-6">
                  {isDbError 
                    ? "A critical database error occurred, and the app cannot start. This can happen if browser data becomes corrupted." 
                    : "An unexpected error occurred during startup. Please try reloading."}
                </p>
                {isDbError && (
                    <div className="text-left bg-background p-4 rounded-md mb-6 border border-border">
                        <p className="font-semibold text-text mb-2">To fix this, please clear the website data for this app in your browser's settings, then reload the page.</p>
                        <p className="text-sm text-text-muted mt-2"><strong>Warning:</strong> This will permanently erase all your local decks and progress unless you have a backup.</p>
                    </div>
                )}
                <Button variant="danger" onClick={() => window.location.reload()}>
                    Reload Page
                </Button>
            </div>
        </div>
    );
  }

  return (
    <DataManagementProvider value={dataHandlers}>
      <div className="min-h-screen text-text flex flex-col overflow-x-hidden"
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        <PullToRefreshIndicator pullDistance={pullToRefreshState.pullDistance} isRefreshing={pullToRefreshState.isRefreshing} threshold={REFRESH_THRESHOLD} />
        <Sidebar 
          isOpen={isMenuOpen} 
          onClose={closeMenu} 
          onImport={dataHandlers.openImportModal}
          onCreateSeries={() => dataHandlers.openSeriesEditor('new')}
          onGenerateAI={dataHandlers.openAIGenerationModal}
          onInstall={installPrompt ? handleInstall : null}
        />
        <div className="flex-1 flex flex-col">
          <Header 
              onOpenMenu={openMenu}
              onOpenCommandPalette={() => openModal('commandPalette')}
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
                      onSync={dataHandlers.handleSync}
                      isSyncing={isSyncing}
                      lastSyncStatus={lastSyncStatus}
                      isGapiReady={isGapiReady}
                      isGapiSignedIn={isGapiSignedIn}
                      gapiUser={gapiUser}
                  />
              )}
          </main>
        </div>
        <OfflineIndicator />
        <ModalManager
          driveFiles={driveFiles}
        />
        <CommandPalette
          isOpen={false} // Will be managed by ModalContext
          onClose={() => {}} // Will be managed by ModalContext
          actions={[
            { id: 'import', label: 'Create / Import Deck', icon: 'plus', action: dataHandlers.openImportModal, keywords: ['new', 'add'] },
            { id: 'settings', label: 'Settings', icon: 'settings', action: () => navigate('/settings') },
            { id: 'trash', label: 'View Trash', icon: 'trash-2', action: () => navigate('/trash') },
            { id: 'archive', label: 'View Archive', icon: 'archive', action: () => navigate('/archive') },
            { id: 'progress', label: 'View Progress', icon: 'trending-up', action: () => navigate('/progress') },
          ]}
        />
        {isDraggingOverWindow && (
          <div className="fixed inset-0 bg-black/50 z-[55] flex items-center justify-center p-4">
            <div className="bg-surface rounded-lg p-8 text-center border-4 border-dashed border-primary">
              <Icon name="upload-cloud" className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="text-xl font-semibold">Drop file to import</p>
            </div>
          </div>
        )}
        {aiFeaturesEnabled && (
          <>
            <AIChatFab />
            <AIGenerationStatusIndicator onOpen={dataHandlers.openAIStatusModal} onCancel={dataHandlers.handleCancelAIGeneration} />
          </>
        )}
      </div>
    </DataManagementProvider>
  );
};

export default App;