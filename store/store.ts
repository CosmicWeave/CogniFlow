import { create } from 'zustand';
import { Deck, Folder, DeckSeries, SeriesProgress, DeckType, FlashcardDeck, QuizDeck, AIMessage, LearningDeck } from '../types';
import { RestoreData } from '../services/googleDriveService';

export type AppState = {
  decks: Deck[];
  folders: Folder[];
  deckSeries: DeckSeries[];
  seriesProgress: SeriesProgress;
  isLoading: boolean;
  lastModified: number | null;
  aiGenerationStatus: {
    isGenerating: boolean;
    statusText: string | null;
    generatingDeckId: string | null;
    generatingSeriesId: string | null;
    abortController: AbortController | null;
  };
  isAIChatOpen: boolean;
  aiChatHistory: AIMessage[];
};

export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SERIES_PROGRESS'; payload: SeriesProgress }
  | { type: 'LOAD_DATA'; payload: { decks: Deck[]; folders: Folder[]; deckSeries: DeckSeries[] } }
  | { type: 'ADD_DECKS'; payload: Deck[] }
  | { type: 'DELETE_DECK'; payload: string }
  | { type: 'UPDATE_DECK'; payload: Deck }
  | { type: 'BULK_UPDATE_DECKS'; payload: Deck[] }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'UPDATE_FOLDER'; payload: Folder }
  | { type: 'DELETE_FOLDER'; payload: string }
  | { type: 'ADD_SERIES'; payload: DeckSeries }
  | { type: 'ADD_SERIES_WITH_DECKS', payload: { series: DeckSeries, decks: Deck[] } }
  | { type: 'UPDATE_SERIES'; payload: DeckSeries }
  | { type: 'DELETE_SERIES'; payload: string }
  | { type: 'RESTORE_DATA', payload: RestoreData }
  | { type: 'SET_AI_GENERATION_STATUS'; payload: Partial<AppState['aiGenerationStatus']> }
  | { type: 'CANCEL_AI_GENERATION' }
  | { type: 'TOGGLE_AI_CHAT'; payload: boolean }
  | { type: 'SET_AI_CHAT_HISTORY'; payload: AIMessage[] };


function appReducer(state: AppState, action: AppAction): AppState {
  const modifiedState = { ...state, lastModified: Date.now() };

  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }; // No data change, don't update lastModified
    case 'SET_SERIES_PROGRESS':
      return { ...state, seriesProgress: action.payload }; // Technically not a structural change, so we don't mark as modified for sync
    case 'LOAD_DATA':
      return { ...state, ...action.payload, isLoading: false, lastModified: null }; // Reset dirty flag on fresh load
    case 'SET_AI_GENERATION_STATUS':
      return { ...state, aiGenerationStatus: { ...state.aiGenerationStatus, ...action.payload } }; // Not a data change
    case 'CANCEL_AI_GENERATION':
      state.aiGenerationStatus.abortController?.abort();
      return { ...state, aiGenerationStatus: { isGenerating: false, statusText: null, generatingDeckId: null, generatingSeriesId: null, abortController: null } };
    case 'TOGGLE_AI_CHAT':
        return { ...state, isAIChatOpen: action.payload };
    case 'SET_AI_CHAT_HISTORY':
        return { ...state, aiChatHistory: action.payload };

    case 'ADD_DECKS': {
      const decksMap = new Map(state.decks.map(d => [d.id, d]));
      action.payload.forEach(deck => decksMap.set(deck.id, deck));
      return { ...modifiedState, decks: Array.from(decksMap.values()) };
    }
    case 'RESTORE_DATA': {
      const { decks, folders, deckSeries } = action.payload;
      const decksMap = new Map(state.decks.map(d => [d.id, d]));
      decks.forEach(deck => decksMap.set(deck.id, deck));

      const foldersMap = new Map(state.folders.map(f => [f.id, f]));
      folders.forEach(folder => foldersMap.set(folder.id, folder));
      
      const seriesMap = new Map(state.deckSeries.map(s => [s.id, s]));
      deckSeries.forEach(series => seriesMap.set(series.id, series));
      
      return { ...modifiedState, decks: Array.from(decksMap.values()), folders: Array.from(foldersMap.values()), deckSeries: Array.from(seriesMap.values()) };
    }
    case 'DELETE_DECK':
      return {
          ...modifiedState,
          decks: state.decks.filter(d => d.id !== action.payload),
          deckSeries: state.deckSeries.map(s => {
              if (!s.levels) {
                  return s;
              }
              return {
                  ...s,
                  levels: s.levels
                      .map(level => ({
                          ...level,
                          deckIds: (level.deckIds || []).filter(id => id !== action.payload)
                      }))
              };
          })
      };
    case 'UPDATE_DECK':
      return { ...modifiedState, decks: state.decks.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'BULK_UPDATE_DECKS': {
       const updatedDecksMap = new Map(state.decks.map(d => [d.id, d]));
       action.payload.forEach(deck => updatedDecksMap.set(deck.id, deck));
       return { ...modifiedState, decks: Array.from(updatedDecksMap.values()) };
    }
    case 'ADD_FOLDER':
        return { ...modifiedState, folders: [...state.folders, action.payload] };
    case 'UPDATE_FOLDER':
        return { ...modifiedState, folders: state.folders.map(f => f.id === action.payload.id ? action.payload : f) };
    case 'DELETE_FOLDER':
        return {
            ...modifiedState,
            folders: state.folders.filter(f => f.id !== action.payload),
            decks: state.decks.map(d => d.folderId === action.payload ? { ...d, folderId: null } : d)
        };
    case 'ADD_SERIES':
        return { ...modifiedState, deckSeries: [...state.deckSeries, action.payload] };
    case 'ADD_SERIES_WITH_DECKS': {
        const { series, decks } = action.payload;
        const decksMap = new Map(state.decks.map(d => [d.id, d]));
        decks.forEach(deck => decksMap.set(deck.id, deck));
        return {
            ...modifiedState,
            decks: Array.from(decksMap.values()),
            deckSeries: [...state.deckSeries, series]
        };
    }
    case 'UPDATE_SERIES':
        return { ...modifiedState, deckSeries: state.deckSeries.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SERIES':
        return { ...modifiedState, deckSeries: state.deckSeries.filter(s => s.id !== action.payload) };
    default:
      return state;
  }
}

const initialState: AppState = {
  decks: [],
  folders: [],
  deckSeries: [],
  seriesProgress: new Map(),
  isLoading: true,
  lastModified: null,
  aiGenerationStatus: {
    isGenerating: false,
    statusText: null,
    generatingDeckId: null,
    generatingSeriesId: null,
    abortController: null,
  },
  isAIChatOpen: false,
  aiChatHistory: [],
};

type AppStore = AppState & {
  dispatch: (action: AppAction) => void;
};

export const useStore = create<AppStore>((set) => ({
  ...initialState,
  dispatch: (action: AppAction) => set((state) => appReducer(state, action)),
}));


// --- Selectors ---

const getDueItemsCount = (deck: Deck): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const items = deck.type === DeckType.Quiz || deck.type === DeckType.Learning ? (deck as QuizDeck | LearningDeck).questions : (deck as FlashcardDeck).cards;
    if (!Array.isArray(items)) {
        return 0;
    }
    return items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
};

export const useStandaloneDecks = () => useStore(state => {
    const seriesDeckIds = new Set<string>();
    state.deckSeries.forEach(series => {
        (series.levels || []).forEach(level => (level.deckIds || []).forEach(deckId => seriesDeckIds.add(deckId)));
    });
    return state.decks.filter(d => !d.archived && !d.deletedAt && !seriesDeckIds.has(d.id));
});

export const useActiveSeriesList = () => useStore(state => 
    state.deckSeries.filter(s => !s.archived && !s.deletedAt)
);

export const useTotalDueCount = () => useStore(state => {
    const seriesDeckIds = new Set<string>();
    state.deckSeries.forEach(series => {
        series.levels.forEach(level => level.deckIds.forEach(deckId => seriesDeckIds.add(deckId)));
    });

    const unlockedSeriesDeckIds = new Set<string>();
    state.deckSeries.forEach(series => {
        if (!series.archived && !series.deletedAt) {
            const completedCount = state.seriesProgress.get(series.id)?.size || 0;
            const flatDeckIds = (series.levels || []).flatMap(l => l.deckIds || []);
            flatDeckIds.forEach((deckId, index) => {
                if (index <= completedCount) {
                    unlockedSeriesDeckIds.add(deckId);
                }
            });
        }
    });

    return state.decks
        .filter(deck => {
            if (deck.archived || deck.deletedAt) return false;
            // It's a series deck that is locked
            if (seriesDeckIds.has(deck.id) && !unlockedSeriesDeckIds.has(deck.id)) return false;
            return true;
        })
        .reduce((total, deck) => total + getDueItemsCount(deck), 0);
});
