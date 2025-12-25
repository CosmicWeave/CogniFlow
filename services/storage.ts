
import { Deck, Folder, DeckSeries, ReviewLog, SessionState, AIMessage, FullBackupData, DeckLearningProgress } from '../types.ts';
import * as db from './db.ts';
import { localStorageDB } from './localStorageDB.ts';

export interface StorageService {
  // Decks
  getAllDecks(): Promise<Deck[]>;
  addDecks(decks: Deck[]): Promise<void>;
  updateDeck(deck: Deck): Promise<void>;
  bulkUpdateDecks(decks: Deck[]): Promise<void>;
  deleteDeck(deckId: string): Promise<void>;

  // Folders
  getAllFolders(): Promise<Folder[]>;
  addFolder(folder: Folder): Promise<void>;
  addFolders(folders: Folder[]): Promise<void>;
  updateFolder(folder: Folder): Promise<void>;
  deleteFolder(folderId: string): Promise<void>;

  // Series
  getAllDeckSeries(): Promise<DeckSeries[]>;
  addDeckSeries(series: DeckSeries[]): Promise<void>;
  updateDeckSeries(series: DeckSeries): Promise<void>;
  deleteDeckSeries(seriesId: string): Promise<void>;

  // Sessions
  saveSessionState(id: string, state: SessionState): Promise<void>;
  getSessionState(id: string): Promise<SessionState | null>;
  getAllSessions(): Promise<SessionState[]>;
  clearSessions(): Promise<void>;
  bulkAddSessions(sessions: SessionState[]): Promise<void>;
  deleteSessionState(id: string): Promise<void>;
  getAllSessionKeys(): Promise<string[]>;

  // Reviews
  addReviewLog(log: ReviewLog): Promise<void>;
  getReviewsSince(sinceDate: Date): Promise<ReviewLog[]>;
  getAllReviews(): Promise<ReviewLog[]>;
  clearReviews(): Promise<void>;
  deleteReviewsForDecks(deckIds: string[]): Promise<void>;
  bulkAddReviews(logs: ReviewLog[]): Promise<void>;
  getReviewsForDeck(deckId: string): Promise<ReviewLog[]>;

  // AI Chat
  saveAIChatHistory(history: AIMessage[]): Promise<void>;
  getAIChatHistory(): Promise<AIMessage[]>;
  clearAIChatHistory(): Promise<void>;

  // Series Progress
  saveSeriesProgress(seriesId: string, completedDeckIds: Set<string>): Promise<void>;
  getAllSeriesProgress(): Promise<Record<string, string[]>>;
  clearSeriesProgress(): Promise<void>;
  bulkAddSeriesProgress(progress: Record<string, string[]>): Promise<void>;

  // Learning Progress
  saveLearningProgress(progress: DeckLearningProgress): Promise<void>;
  getAllLearningProgress(): Promise<Record<string, DeckLearningProgress>>;
  bulkAddLearningProgress(progress: Record<string, DeckLearningProgress>): Promise<void>;

  // System / Backup
  getAllDataForBackup(): Promise<{
    decks: Deck[];
    folders: Folder[];
    deckSeries: DeckSeries[];
    reviews: ReviewLog[];
    sessions: SessionState[];
    seriesProgress: Record<string, string[]>;
    learningProgress: Record<string, DeckLearningProgress>;
  }>;
  exportAllData(): Promise<string | null>;
  performAtomicRestore(data: FullBackupData): Promise<void>;
  factoryReset(): Promise<void>;
}

// Proxy to detect IndexedDB failure and switch to localStorage
const createProxyStorage = (): StorageService => {
  let activeStorage: StorageService | null = null;
  let initPromise: Promise<StorageService> | null = null;

  const getStorage = async (): Promise<StorageService> => {
    if (activeStorage) return activeStorage;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        // Test if IndexedDB is available
        const idb = typeof indexedDB !== 'undefined' ? indexedDB : (typeof window !== 'undefined' ? window.indexedDB : undefined);
        if (!idb) throw new Error('No IndexedDB support');
        
        // Probe the DB by attempting to initialize and call a lightweight method.
        // If this rejects, we fallback to localStorage.
        await db.getAllDecks();
        activeStorage = db;
        console.log('Using IndexedDB for primary storage.');
      } catch (e) {
        console.warn('IndexedDB initialization failed. Falling back to localStorage.', e);
        activeStorage = localStorageDB;
      }
      return activeStorage;
    })();

    return initPromise;
  };

  // Wrap all methods to ensure the correct storage is loaded on first call
  const wrap = (methodName: keyof StorageService) => {
    return async (...args: any[]) => {
      const s = await getStorage();
      return (s[methodName] as Function)(...args);
    };
  };

  return {
    getAllDecks: wrap('getAllDecks'),
    addDecks: wrap('addDecks'),
    updateDeck: wrap('updateDeck'),
    bulkUpdateDecks: wrap('bulkUpdateDecks'),
    deleteDeck: wrap('deleteDeck'),
    getAllFolders: wrap('getAllFolders'),
    addFolder: wrap('addFolder'),
    addFolders: wrap('addFolders'),
    updateFolder: wrap('updateFolder'),
    deleteFolder: wrap('deleteFolder'),
    getAllDeckSeries: wrap('getAllDeckSeries'),
    addDeckSeries: wrap('addDeckSeries'),
    updateDeckSeries: wrap('updateDeckSeries'),
    deleteDeckSeries: wrap('deleteDeckSeries'),
    saveSessionState: wrap('saveSessionState'),
    getSessionState: wrap('getSessionState'),
    getAllSessions: wrap('getAllSessions'),
    clearSessions: wrap('clearSessions'),
    bulkAddSessions: wrap('bulkAddSessions'),
    deleteSessionState: wrap('deleteSessionState'),
    getAllSessionKeys: wrap('getAllSessionKeys'),
    addReviewLog: wrap('addReviewLog'),
    getReviewsSince: wrap('getReviewsSince'),
    getAllReviews: wrap('getAllReviews'),
    clearReviews: wrap('clearReviews'),
    deleteReviewsForDecks: wrap('deleteReviewsForDecks'),
    bulkAddReviews: wrap('bulkAddReviews'),
    getReviewsForDeck: wrap('getReviewsForDeck'),
    saveAIChatHistory: wrap('saveAIChatHistory'),
    getAIChatHistory: wrap('getAIChatHistory'),
    clearAIChatHistory: wrap('clearAIChatHistory'),
    saveSeriesProgress: wrap('saveSeriesProgress'),
    getAllSeriesProgress: wrap('getAllSeriesProgress'),
    clearSeriesProgress: wrap('clearSeriesProgress'),
    bulkAddSeriesProgress: wrap('bulkAddSeriesProgress'),
    saveLearningProgress: wrap('saveLearningProgress'),
    getAllLearningProgress: wrap('getAllLearningProgress'),
    bulkAddLearningProgress: wrap('bulkAddLearningProgress'),
    getAllDataForBackup: wrap('getAllDataForBackup'),
    exportAllData: wrap('exportAllData'),
    performAtomicRestore: wrap('performAtomicRestore'),
    factoryReset: wrap('factoryReset'),
  };
};

const storage: StorageService = createProxyStorage();

export default storage;
