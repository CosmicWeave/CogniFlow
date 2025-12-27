
// components/DataManagementRoot.tsx

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '../store/store.ts';
import { useRouter } from '../contexts/RouterContext.tsx';
import { useToast } from '../hooks/useToast.ts';
import { useModal } from '../contexts/ModalContext.tsx';
import { useSettings } from '../hooks/useSettings.ts';
import { useDataManagement } from '../hooks/useDataManagement.ts';
import { DataManagementProvider } from '../contexts/DataManagementContext.tsx';
import { QuizDeck, FullBackupData } from '../types.ts';
import * as googleDriveService from '../services/googleDriveService.ts';
import storage from '../services/storage.ts';
import { onDataChange } from '../services/syncService.ts';

interface DataManagementRootProps {
  children: React.ReactNode;
}

const DataManagementRoot: React.FC<DataManagementRootProps> = ({ children }) => {
  const { path } = useRouter();
  const { dispatch, decks, deckSeries } = useStore();
  const { addToast } = useToast();
  const { openModal } = useModal();
  const { backupEnabled } = useSettings();

  // --- UI & Sync State ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState('Not synced');
  const [sessionsToResume, setSessionsToResume] = useState<Set<string>>(new Set());
  const [generalStudyDeck, setGeneralStudyDeck] = useState<QuizDeck | null>(null);
  
  // --- Folder & List State ---
  const [sortPreference, setSortPreference] = useState<'recent' | 'name' | 'dueCount'>('recent');
  const [draggedDeckId, setDraggedDeckId] = useState<string | null>(null);
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());

  const onToggleFolder = (id: string) => {
    setOpenFolderIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  // --- Google Drive State ---
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [isGapiSignedIn, setIsGapiSignedIn] = useState(false);
  const [gapiUser, setGapiUser] = useState<any>(null);

  // --- Data Loading Logic ---
  const loadInitialData = useCallback(async (customBackup?: FullBackupData) => {
    try {
        const [decks, folders, deckSeries, seriesProgress, learningProgress, chatHistory, sessionKeys] = await Promise.all([
            storage.getAllDecks(),
            storage.getAllFolders(),
            storage.getAllDeckSeries(),
            storage.getAllSeriesProgress(),
            storage.getAllLearningProgress(),
            storage.getAIChatHistory(),
            storage.getAllSessionKeys()
        ]);

        // Convert raw record to Map for the store
        const progressMap = new Map<string, Set<string>>();
        Object.entries(seriesProgress).forEach(([id, completedIds]) => {
            progressMap.set(id, new Set(completedIds));
        });

        dispatch({ type: 'LOAD_DATA', payload: { decks, folders, deckSeries } });
        dispatch({ type: 'SET_SERIES_PROGRESS', payload: progressMap });
        dispatch({ type: 'SET_LEARNING_PROGRESS', payload: learningProgress });
        dispatch({ type: 'SET_AI_CHAT_HISTORY', payload: chatHistory });
        
        // Handle AI Tasks from backup if this is a restore event
        if (customBackup?.aiTasks && customBackup.aiTasks.length > 0) {
            customBackup.aiTasks.forEach(task => {
                dispatch({ type: 'ADD_AI_TASK_TO_QUEUE', payload: task });
            });
            addToast(`Resumed ${customBackup.aiTasks.length} background AI tasks.`, 'info');
        }

        // Identify which decks have active sessions to resume
        const resumeSet = new Set<string>();
        sessionKeys.forEach(key => {
            if (key.startsWith('session_deck_')) {
                resumeSet.add(key.replace('session_deck_', ''));
            }
        });
        setSessionsToResume(resumeSet);

    } catch (error) {
        console.error("Critical error during data initialization:", error);
        addToast("Failed to load your data. Please check browser permissions and reload.", "error");
    }
  }, [dispatch, addToast]);

  useEffect(() => {
    loadInitialData();

    // Listen for changes from other tabs
    const unsubscribeSync = onDataChange(() => {
        console.log("Data changed in another tab, reloading...");
        loadInitialData();
    });

    return () => {
        unsubscribeSync();
    };
  }, [loadInitialData]);

  // --- Google Drive Initialization ---
  useEffect(() => {
    const unsubGapi = googleDriveService.onGapiReady(setIsGapiReady);
    const unsubAuth = googleDriveService.onAuthStateChanged((isSignedIn, user) => {
      setIsGapiSignedIn(isSignedIn);
      setGapiUser(user || null);
    });
    return () => {
      unsubGapi();
      unsubAuth();
    };
  }, []);

  // --- Derived Route State ---
  const activeDeck = useMemo(() => {
    const match = path.match(/^\/decks\/([^/?]+)/);
    return match ? decks[match[1]] : null;
  }, [path, decks]);

  const activeSeries = useMemo(() => {
    const match = path.match(/^\/series\/([^/?]+)/);
    return match ? deckSeries[match[1]] : null;
  }, [path, deckSeries]);

  // --- Initialize Data Handlers ---
  const dataHandlers = useDataManagement({
    activeDeck,
    activeSeries,
    generalStudyDeck,
    setGeneralStudyDeck,
    sessionsToResume,
    setSessionsToResume,
    isSyncing,
    setIsSyncing,
    lastSyncStatus,
    setLastSyncStatus,
    backupEnabled,
    isGapiReady,
    isGapiSignedIn,
    gapiUser,
    sortPreference,
    setSortPreference,
    draggedDeckId,
    setDraggedDeckId,
    openFolderIds,
    onToggleFolder,
    // Add special restore handler to pickup AI tasks
    onDataRestoreComplete: (data: FullBackupData) => loadInitialData(data)
  });

  return (
    <DataManagementProvider value={dataHandlers}>
      {children}
    </DataManagementProvider>
  );
};

export default DataManagementRoot;
