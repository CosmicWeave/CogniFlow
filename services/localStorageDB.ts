
import { Deck, Folder, DeckSeries, ReviewLog, SessionState, AIMessage, FullBackupData, DeckLearningProgress } from '../types';

const PREFIX = 'cogniflow_v1_';

const getItem = (key: string) => {
  const val = localStorage.getItem(PREFIX + key);
  return val ? JSON.parse(val) : null;
};

const setItem = (key: string, val: any) => {
  localStorage.setItem(PREFIX + key, JSON.stringify(val));
};

export const localStorageDB = {
  getAllDecks: async (): Promise<Deck[]> => getItem('decks') || [],
  addDecks: async (decks: Deck[]): Promise<void> => {
    const existing = getItem('decks') || [];
    const deckMap = new Map(existing.map((d: any) => [d.id, d]));
    decks.forEach(d => deckMap.set(d.id, d));
    setItem('decks', Array.from(deckMap.values()));
  },
  updateDeck: async (deck: Deck): Promise<void> => {
    // put logic (upsert)
    await localStorageDB.addDecks([deck]);
  },
  bulkUpdateDecks: async (decks: Deck[]): Promise<void> => {
    await localStorageDB.addDecks(decks);
  },
  deleteDeck: async (deckId: string): Promise<void> => {
    const existing = getItem('decks') || [];
    setItem('decks', existing.filter((d: any) => d.id !== deckId));
  },

  getAllFolders: async (): Promise<Folder[]> => getItem('folders') || [],
  addFolder: async (folder: Folder): Promise<void> => {
    const existing = getItem('folders') || [];
    setItem('folders', [...existing, folder]);
  },
  addFolders: async (folders: Folder[]): Promise<void> => {
    const existing = getItem('folders') || [];
    setItem('folders', [...existing, ...folders]);
  },
  updateFolder: async (folder: Folder): Promise<void> => {
    const existing = getItem('folders') || [];
    const index = existing.findIndex((f: any) => f.id === folder.id);
    if (index !== -1) {
        existing[index] = folder;
        setItem('folders', existing);
    } else {
        await localStorageDB.addFolder(folder);
    }
  },
  deleteFolder: async (folderId: string): Promise<void> => {
    const existing = getItem('folders') || [];
    setItem('folders', existing.filter((f: any) => f.id !== folderId));
  },

  getAllDeckSeries: async (): Promise<DeckSeries[]> => getItem('deckSeries') || [],
  addDeckSeries: async (series: DeckSeries[]): Promise<void> => {
    const existing = getItem('deckSeries') || [];
    const seriesMap = new Map(existing.map((s: any) => [s.id, s]));
    series.forEach(s => seriesMap.set(s.id, s));
    setItem('deckSeries', Array.from(seriesMap.values()));
  },
  updateDeckSeries: async (series: DeckSeries): Promise<void> => {
    await localStorageDB.addDeckSeries([series]);
  },
  deleteDeckSeries: async (seriesId: string): Promise<void> => {
    const existing = getItem('deckSeries') || [];
    setItem('deckSeries', existing.filter((s: any) => s.id !== seriesId));
  },

  saveSessionState: async (id: string, state: SessionState): Promise<void> => {
    const sessions = getItem('sessions') || {};
    sessions[id] = state;
    setItem('sessions', sessions);
  },
  getSessionState: async (id: string): Promise<SessionState | null> => {
    const sessions = getItem('sessions') || {};
    return sessions[id] || null;
  },
  getAllSessions: async (): Promise<SessionState[]> => Object.values(getItem('sessions') || {}),
  clearSessions: async (): Promise<void> => setItem('sessions', {}),
  bulkAddSessions: async (sessions: SessionState[]): Promise<void> => {
    const existing = getItem('sessions') || {};
    sessions.forEach(s => existing[s.id] = s);
    setItem('sessions', existing);
  },
  deleteSessionState: async (id: string): Promise<void> => {
    const sessions = getItem('sessions') || {};
    delete sessions[id];
    setItem('sessions', sessions);
  },
  getAllSessionKeys: async (): Promise<string[]> => Object.keys(getItem('sessions') || {}),

  addReviewLog: async (log: ReviewLog): Promise<void> => {
    const existing = getItem('reviews') || [];
    setItem('reviews', [...existing, log]);
  },
  getReviewsSince: async (sinceDate: Date): Promise<ReviewLog[]> => {
    const existing = getItem('reviews') || [];
    return existing.filter((r: any) => new Date(r.timestamp) >= sinceDate);
  },
  getAllReviews: async (): Promise<ReviewLog[]> => getItem('reviews') || [],
  clearReviews: async (): Promise<void> => setItem('reviews', []),
  deleteReviewsForDecks: async (deckIds: string[]): Promise<void> => {
    const existing = getItem('reviews') || [];
    const ids = new Set(deckIds);
    setItem('reviews', existing.filter((r: any) => !ids.has(r.deckId)));
  },
  bulkAddReviews: async (logs: ReviewLog[]): Promise<void> => {
    const existing = getItem('reviews') || [];
    setItem('reviews', [...existing, ...logs]);
  },
  getReviewsForDeck: async (deckId: string): Promise<ReviewLog[]> => {
    const existing = getItem('reviews') || [];
    return existing.filter((r: any) => r.deckId === deckId);
  },

  saveAIChatHistory: async (history: AIMessage[]): Promise<void> => setItem('ai_chat', history),
  getAIChatHistory: async (): Promise<AIMessage[]> => getItem('ai_chat') || [],
  clearAIChatHistory: async (): Promise<void> => setItem('ai_chat', []),

  saveSeriesProgress: async (seriesId: string, completedDeckIds: Set<string>): Promise<void> => {
    const progress = getItem('seriesProgress') || {};
    progress[seriesId] = Array.from(completedDeckIds);
    setItem('seriesProgress', progress);
  },
  getAllSeriesProgress: async (): Promise<Record<string, string[]>> => getItem('seriesProgress') || {},
  clearSeriesProgress: async (): Promise<void> => setItem('seriesProgress', {}),
  bulkAddSeriesProgress: async (progress: Record<string, string[]>): Promise<void> => setItem('seriesProgress', progress),

  saveLearningProgress: async (progress: DeckLearningProgress): Promise<void> => {
    const existing = getItem('learningProgress') || {};
    existing[progress.deckId] = progress;
    setItem('learningProgress', existing);
  },
  getAllLearningProgress: async (): Promise<Record<string, DeckLearningProgress>> => getItem('learningProgress') || {},
  bulkAddLearningProgress: async (progress: Record<string, DeckLearningProgress>): Promise<void> => setItem('learningProgress', progress),

  getAllDataForBackup: async () => {
    const sessionsObj = getItem('sessions') || {};
    return {
      decks: (getItem('decks') || []) as Deck[],
      folders: (getItem('folders') || []) as Folder[],
      deckSeries: (getItem('deckSeries') || []) as DeckSeries[],
      reviews: (getItem('reviews') || []) as ReviewLog[],
      sessions: Object.values(sessionsObj) as SessionState[],
      seriesProgress: (getItem('seriesProgress') || {}) as Record<string, string[]>,
      learningProgress: (getItem('learningProgress') || {}) as Record<string, DeckLearningProgress>,
    };
  },
  exportAllData: async (): Promise<string | null> => {
    const data = await localStorageDB.getAllDataForBackup();
    return JSON.stringify(data);
  },
  performAtomicRestore: async (data: FullBackupData): Promise<void> => {
    setItem('decks', data.decks);
    setItem('folders', data.folders);
    setItem('deckSeries', data.deckSeries);
    setItem('reviews', data.reviews);
    const sessions = (data.sessions || []).reduce((acc: any, s) => { acc[s.id] = s; return acc; }, {});
    setItem('sessions', sessions);
    setItem('seriesProgress', data.seriesProgress);
    setItem('learningProgress', data.learningProgress);
    if (data.aiChatHistory) setItem('ai_chat', data.aiChatHistory);
  },
  factoryReset: async (): Promise<void> => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }
};
