import { Deck, Folder, DeckSeries, ReviewLog, SessionState, AIMessage, FullBackupData, DeckLearningProgress } from '../types';
import * as db from './db';

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

// Default implementation using IndexedDB
const dbStorage: StorageService = {
  ...db
};

export default dbStorage;