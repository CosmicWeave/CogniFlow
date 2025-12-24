
import { create } from 'zustand';
import { Deck, Folder, DeckSeries, SeriesProgress, DeckType, FlashcardDeck, QuizDeck, AIMessage, LearningDeck, FullBackupData, SeriesLevel, Reviewable, Card, Question, AIGenerationTask, DeckLearningProgress } from '../types.ts';

export interface AIGenerationStatus {
  isGenerating: boolean;
  statusText: string | null;
  generatingDeckId: string | null;
  generatingSeriesId: string | null;
  queue: AIGenerationTask[];
  currentTask: (AIGenerationTask & { abortController: AbortController }) | null;
}


export type AppState = {
  decks: Record<string, Deck>;
  folders: Record<string, Folder>;
  deckSeries: Record<string, DeckSeries>;
  seriesProgress: SeriesProgress;
  learningProgress: Record<string, DeckLearningProgress>; // Track read progress for learning decks
  isLoading: boolean;
  lastModified: number | null;
  aiGenerationStatus: AIGenerationStatus;
  aiChatHistory: AIMessage[];
};

export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SERIES_PROGRESS'; payload: SeriesProgress }
  | { type: 'SET_LEARNING_PROGRESS'; payload: Record<string, DeckLearningProgress> }
  | { type: 'UPDATE_LEARNING_PROGRESS'; payload: DeckLearningProgress }
  | { type: 'LOAD_DATA'; payload: { decks: Deck[]; folders: Folder[]; deckSeries: DeckSeries[] } }
  | { type: 'ADD_DECKS'; payload: Deck[] }
  | { type: 'DELETE_DECK'; payload: string }
  | { type: 'UPDATE_DECK'; payload: Deck }
  | { type: 'BULK_UPDATE_DECKS'; payload: Deck[] }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'ADD_FOLDERS'; payload: Folder[] }
  | { type: 'UPDATE_FOLDER'; payload: Folder }
  | { type: 'DELETE_FOLDER'; payload: string }
  | { type: 'ADD_SERIES'; payload: DeckSeries }
  | { type: 'ADD_SERIES_WITH_DECKS', payload: { series: DeckSeries, decks: Deck[] } }
  | { type: 'UPDATE_SERIES'; payload: DeckSeries }
  | { type: 'DELETE_SERIES'; payload: string }
  | { type: 'RESTORE_DATA', payload: FullBackupData }
  | { type: 'ADD_AI_TASK_TO_QUEUE'; payload: AIGenerationTask }
  | { type: 'START_NEXT_AI_TASK'; payload: { task: AIGenerationTask, abortController: AbortController } }
  | { type: 'UPDATE_CURRENT_AI_TASK_STATUS'; payload: { statusText: string, deckId?: string, seriesId?: string } }
  | { type: 'FINISH_CURRENT_AI_TASK' }
  | { type: 'CANCEL_AI_TASK'; payload?: { taskId?: string } }
  | { type: 'SET_AI_CHAT_HISTORY'; payload: AIMessage[] }
  | { type: 'SET_AI_GENERATION_STATUS'; payload: { isGenerating: boolean; statusText: string | null; generatingDeckId: string | null; generatingSeriesId: string | null, queue?: AIGenerationTask[], currentTask?: (AIGenerationTask & { abortController: AbortController }) | null } };


function appReducer(state: AppState, action: AppAction): AppState {
  const modifiedState = { ...state, lastModified: Date.now() };

  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }; // No data change, don't update lastModified
    case 'SET_SERIES_PROGRESS':
      return { ...state, seriesProgress: action.payload }; 
    case 'SET_LEARNING_PROGRESS':
      return { ...state, learningProgress: action.payload };
    case 'UPDATE_LEARNING_PROGRESS':
      return { 
          ...state, 
          learningProgress: { 
              ...state.learningProgress, 
              [action.payload.deckId]: action.payload 
          } 
      };
    case 'LOAD_DATA': {
      const decksRecord: Record<string, Deck> = {};
      action.payload.decks.forEach(d => decksRecord[d.id] = d);
      const foldersRecord: Record<string, Folder> = {};
      action.payload.folders.forEach(f => foldersRecord[f.id] = f);
      const seriesRecord: Record<string, DeckSeries> = {};
      action.payload.deckSeries.forEach(s => seriesRecord[s.id] = s);
      
      return { 
          ...state, 
          decks: decksRecord, 
          folders: foldersRecord, 
          deckSeries: seriesRecord, 
          isLoading: false, 
          lastModified: null 
      }; // Reset dirty flag on fresh load
    }
    
    case 'SET_AI_GENERATION_STATUS':
      return {
        ...state,
        aiGenerationStatus: {
          ...state.aiGenerationStatus,
          ...action.payload,
        }
      };
    case 'ADD_AI_TASK_TO_QUEUE': {
      const currentQueue = Array.isArray(state.aiGenerationStatus.queue) ? state.aiGenerationStatus.queue : [];
      return { ...state, aiGenerationStatus: { ...state.aiGenerationStatus, queue: [...currentQueue, action.payload] } };
    }
    case 'START_NEXT_AI_TASK': {
      const currentQueue = Array.isArray(state.aiGenerationStatus.queue) ? state.aiGenerationStatus.queue : [];
      const newQueue = currentQueue.slice(1);
      const { task, abortController } = action.payload;
      return { ...state, aiGenerationStatus: { 
        ...state.aiGenerationStatus, 
        queue: newQueue, 
        currentTask: { ...task, abortController },
        isGenerating: true, // Explicitly set to true
      } };
    }
    case 'UPDATE_CURRENT_AI_TASK_STATUS': {
        if (!state.aiGenerationStatus.currentTask) return state;
        const { statusText, deckId, seriesId } = action.payload;
        const updatedTask = { ...state.aiGenerationStatus.currentTask, statusText, deckId, seriesId };
        return { ...state, aiGenerationStatus: { 
          ...state.aiGenerationStatus, 
          currentTask: updatedTask,
        } };
    }
    case 'FINISH_CURRENT_AI_TASK':
      return { ...state, aiGenerationStatus: { 
        ...state.aiGenerationStatus, 
        currentTask: null,
        isGenerating: false, // Explicitly set to false
      } };
    case 'CANCEL_AI_TASK':
        if (action.payload?.taskId) {
            const currentQueue = Array.isArray(state.aiGenerationStatus.queue) ? state.aiGenerationStatus.queue : [];
            // Cancel a specific task from the queue
            return { ...state, aiGenerationStatus: { ...state.aiGenerationStatus, queue: currentQueue.filter(task => task.id !== action.payload!.taskId) } };
        } else {
            // Cancel the current task
            state.aiGenerationStatus.currentTask?.abortController.abort();
            return { ...state, aiGenerationStatus: { 
              ...state.aiGenerationStatus, 
              currentTask: null,
              isGenerating: false,
            } };
        }

    case 'SET_AI_CHAT_HISTORY':
        return { ...state, aiChatHistory: action.payload };

    case 'ADD_DECKS': {
      const newDecks = { ...state.decks };
      action.payload.forEach(deck => newDecks[deck.id] = deck);
      return { ...modifiedState, decks: newDecks };
    }
    case 'RESTORE_DATA': {
      const { decks, folders, deckSeries } = action.payload;
      const decksRecord: Record<string, Deck> = {};
      decks.forEach(d => decksRecord[d.id] = d);
      const foldersRecord: Record<string, Folder> = {};
      folders.forEach(f => foldersRecord[f.id] = f);
      const seriesRecord: Record<string, DeckSeries> = {};
      deckSeries.forEach(s => seriesRecord[s.id] = s);
      
      return { 
          ...modifiedState, 
          decks: decksRecord, 
          folders: foldersRecord, 
          deckSeries: seriesRecord 
      };
    }
    case 'DELETE_DECK': {
      const newDecks = { ...state.decks };
      delete newDecks[action.payload];
      
      // Update series references
      const newSeries = { ...state.deckSeries };
      Object.keys(newSeries).forEach(seriesId => {
          const s = newSeries[seriesId];
          if (s.levels) {
              newSeries[seriesId] = {
                  ...s,
                  levels: s.levels.map(level => ({
                      ...level,
                      deckIds: (level.deckIds || []).filter(id => id !== action.payload)
                  }))
              };
          }
      });

      return {
          ...modifiedState,
          decks: newDecks,
          deckSeries: newSeries
      };
    }
    case 'UPDATE_DECK':
      return { ...modifiedState, decks: { ...state.decks, [action.payload.id]: action.payload } };
    case 'BULK_UPDATE_DECKS': {
       const newDecks = { ...state.decks };
       action.payload.forEach(deck => newDecks[deck.id] = deck);
       return { ...modifiedState, decks: newDecks };
    }
    case 'ADD_FOLDER':
        return { ...modifiedState, folders: { ...state.folders, [action.payload.id]: action.payload } };
    case 'ADD_FOLDERS': {
      const newFolders = { ...state.folders };
      action.payload.forEach(folder => newFolders[folder.id] = folder);
      return { ...modifiedState, folders: newFolders };
    }
    case 'UPDATE_FOLDER':
        return { ...modifiedState, folders: { ...state.folders, [action.payload.id]: action.payload } };
    case 'DELETE_FOLDER': {
        const newFolders = { ...state.folders };
        delete newFolders[action.payload];
        
        const newDecks = { ...state.decks };
        Object.values(newDecks).forEach(d => {
            if (d.folderId === action.payload) {
                newDecks[d.id] = { ...d, folderId: null };
            }
        });

        return {
            ...modifiedState,
            folders: newFolders,
            decks: newDecks
        };
    }
    case 'ADD_SERIES':
        return { ...modifiedState, deckSeries: { ...state.deckSeries, [action.payload.id]: action.payload } };
    case 'ADD_SERIES_WITH_DECKS': {
        const { series, decks } = action.payload;
        const newDecks = { ...state.decks };
        decks.forEach(deck => newDecks[deck.id] = deck);
        
        return {
            ...modifiedState,
            decks: newDecks,
            deckSeries: { ...state.deckSeries, [series.id]: series }
        };
    }
    case 'UPDATE_SERIES':
        return { ...modifiedState, deckSeries: { ...state.deckSeries, [action.payload.id]: action.payload } };
    case 'DELETE_SERIES': {
        const newSeries = { ...state.deckSeries };
        delete newSeries[action.payload];
        return { ...modifiedState, deckSeries: newSeries };
    }
    default:
      return state;
  }
}

const initialState: AppState = {
  decks: {},
  folders: {},
  deckSeries: {},
  seriesProgress: new Map<string, Set<string>>(),
  learningProgress: {},
  isLoading: true,
  lastModified: null,
  aiGenerationStatus: {
    isGenerating: false,
    statusText: null,
    generatingDeckId: null,
    generatingSeriesId: null,
    queue: [],
    currentTask: null,
  },
  aiChatHistory: [],
};

type AppStore = AppState & {
  dispatch: (action: AppAction) => void;
};

export const useStore = create<AppStore>()((set) => ({
  ...initialState,
  dispatch: (action: AppAction) => set((state) => appReducer(state, action)),
}));

// --- Selectors ---

const getDueItemsCountForDeck = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = (deck.type === DeckType.Quiz || deck.type === 'learning' ? (deck as QuizDeck | LearningDeck).questions : (deck as FlashcardDeck).cards) || [];
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate).getTime() <= today.getTime()).length;
};

// Convenience selectors to return Arrays for rendering lists
export const useDecksList = () => useStore(state => Object.values(state.decks));
export const useFoldersList = () => useStore(state => Object.values(state.folders));
export const useSeriesList = () => useStore(state => Object.values(state.deckSeries));

export const useActiveSeriesList = () => useStore(state => 
    (Object.values(state.deckSeries) as DeckSeries[]).filter(s => !s.archived && !s.deletedAt)
);

export const useStandaloneDecks = () => useStore(state => {
    const seriesDeckIds = new Set<string>();
    (Object.values(state.deckSeries) as DeckSeries[]).forEach(series => {
        (series.levels || []).forEach(level => (level?.deckIds || []).forEach(deckId => seriesDeckIds.add(deckId)));
    });
    return (Object.values(state.decks) as Deck[]).filter(d => !d.archived && !d.deletedAt && !seriesDeckIds.has(d.id));
});

export const useTotalDueCount = () => useStore(state => {
    const unlockedSeriesDeckIds = new Set<string>();
    (Object.values(state.deckSeries) as DeckSeries[]).forEach(series => {
        if (!series.archived && !series.deletedAt) {
            const completedCount = state.seriesProgress.get(series.id)?.size || 0;
            let deckCount = 0;
            ((series.levels || []).filter(Boolean)).forEach(level => {
                (level.deckIds || []).forEach((deckId) => {
                    if (deckCount <= completedCount) unlockedSeriesDeckIds.add(deckId);
                    deckCount++;
                });
            });
        }
    });

    return (Object.values(state.decks) as Deck[]).reduce((total, deck) => {
        if (deck.archived || deck.deletedAt) return total;
        
        // For learning decks, check persistent unlocked state if available
        if (deck.type === DeckType.Learning) {
            const progress = state.learningProgress[deck.id];
            if (progress && progress.unlockedQuestionIds) {
                const unlockedSet = new Set(progress.unlockedQuestionIds);
                const learningDeck = deck as LearningDeck;
                const dueCount = (learningDeck.questions || []).filter(q => 
                    unlockedSet.has(q.id) && !q.suspended && new Date(q.dueDate).getTime() <= new Date().setHours(23, 59, 59, 999)
                ).length;
                return total + dueCount;
            }
        }

        const isSeriesDeck = (deck.type === DeckType.Quiz || deck.type === DeckType.Learning) && (Object.values(state.deckSeries) as DeckSeries[]).some(s => (s.levels || []).some(l => l.deckIds?.includes(deck.id)));
        if (isSeriesDeck && !unlockedSeriesDeckIds.has(deck.id)) {
            return total;
        }

        return total + getDueItemsCountForDeck(deck);
    }, 0);
});
