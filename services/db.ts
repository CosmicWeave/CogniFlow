// services/db.ts
import Dexie, { type Table } from 'dexie';
import { 
  Deck, Folder, DeckSeries, ReviewLog, SessionState, 
  AIMessage, FullBackupData, AppSettings, DeckLearningProgress 
} from '../types';
import { broadcastDataChange } from './syncService.ts';
import { getStockholmFilenameTimestamp } from './time.ts';

const DB_NAME = 'CogniFlowDB';
const DB_VERSION = 9;

// --- Logger ---
const createSpamProtectedLogger = (name: string, threshold = 20, timeWindow = 5000) => {
    let logCount = 0;
    let windowStart = Date.now();
    let isMuted = false;

    const log = (level: 'log' | 'warn' | 'error', ...args: any[]) => {
        const now = Date.now();
        if (now - windowStart > timeWindow) {
            logCount = 0;
            windowStart = now;
            if (isMuted) console.warn(`[${name}] Logger is now unmuted.`);
            isMuted = false;
        }
        if (isMuted) return;
        logCount++;
        if (logCount > threshold) {
            console.error(`[${name}] Logger muted: Excess logs.`);
            isMuted = true;
            return;
        }
        console[level](`[${name}]`, ...args);
    };

    return {
        log: (...args: any[]) => log('log', ...args),
        warn: (...args: any[]) => log('warn', ...args),
        error: (...args: any[]) => log('error', ...args),
    };
};
const dbLogger = createSpamProtectedLogger('DB');

// --- Dexie Database Definition ---
export class CogniFlowDatabase extends Dexie {
  decks!: Table<Deck, string>;
  folders!: Table<Folder, string>;
  deckSeries!: Table<DeckSeries, string>;
  sessions!: Table<SessionState, string>;
  reviews!: Table<ReviewLog, number>; // auto-incrementing key
  ai_chat!: Table<{ id: string, history: AIMessage[] }, string>;
  seriesProgress!: Table<{ id: string, completedDeckIds: string[] }, string>;
  learningProgress!: Table<DeckLearningProgress, string>;

  constructor() {
    super(DB_NAME);
    // FIX: Using cast to any to resolve version property accessibility issue in some compiler environments
    (this as any).version(DB_VERSION).stores({
      decks: 'id',
      folders: 'id',
      deckSeries: 'id',
      sessions: 'id',
      reviews: '++id, timestamp, deckId',
      ai_chat: 'id',
      seriesProgress: 'id',
      learningProgress: 'deckId'
    });
  }
}

export const db = new CogniFlowDatabase();

// --- Storage Logic Implementation ---

export async function getAllDecks(): Promise<Deck[]> {
  return await db.decks.toArray();
}

export async function addDecks(decks: Deck[]): Promise<void> {
  if (decks.length === 0) return;
  // FIX: Cast table to any to prevent 'any to never' assignment errors on bulk operations.
  await (db.decks as any).bulkPut(decks);
  broadcastDataChange();
}

export async function bulkUpdateDecks(decks: Deck[]): Promise<void> {
  await addDecks(decks);
}

export async function deleteDeck(deckId: string): Promise<void> {
  // FIX: Using cast to any to resolve transaction property accessibility
  await (db as any).transaction('rw', db.decks, db.deckSeries, async () => {
    await db.decks.delete(deckId);
    // Cleanup series references
    await db.deckSeries.toCollection().modify(series => {
        if (series.levels) {
            series.levels = series.levels.map(level => ({
                ...level,
                deckIds: (level.deckIds || []).filter(id => id !== deckId)
            }));
        }
    });
  });
  broadcastDataChange();
}

export async function updateDeck(deck: Deck): Promise<void> {
  await db.decks.put(deck);
  broadcastDataChange();
}

export async function getAllFolders(): Promise<Folder[]> {
  return await db.folders.toArray();
}

export async function addFolder(folder: Folder): Promise<void> {
  await db.folders.add(folder);
}

export async function addFolders(folders: Folder[]): Promise<void> {
  if (folders.length === 0) return;
  // FIX: Cast table to any to prevent 'any to never' assignment errors on bulk operations.
  await (db.folders as any).bulkPut(folders);
}

export async function updateFolder(folder: Folder): Promise<void> {
  await db.folders.put(folder);
}

export async function deleteFolder(folderId: string): Promise<void> {
  // FIX: Using cast to any to resolve transaction property accessibility
  await (db as any).transaction('rw', db.folders, db.decks, async () => {
    await db.folders.delete(folderId);
    await db.decks.where('folderId').equals(folderId).modify({ folderId: null });
  });
}

export async function getAllDeckSeries(): Promise<DeckSeries[]> {
    return await db.deckSeries.toArray();
}

export async function addDeckSeries(series: DeckSeries[]): Promise<void> {
    if (series.length === 0) return;
    // FIX: Cast table to any to prevent 'any to never' assignment errors on bulk operations.
    await (db.deckSeries as any).bulkPut(series);
    broadcastDataChange();
}

export async function updateDeckSeries(series: DeckSeries): Promise<void> {
    await db.deckSeries.put(series);
}

export async function deleteDeckSeries(seriesId: string): Promise<void> {
    await db.deckSeries.delete(seriesId);
    broadcastDataChange();
}

export async function saveSessionState(id: string, state: SessionState): Promise<void> {
  await db.sessions.put({ ...state, id });
}

export async function getSessionState(id: string): Promise<SessionState | null> {
  return (await db.sessions.get(id)) || null;
}

export async function getAllSessions(): Promise<SessionState[]> {
    return await db.sessions.toArray();
}

export async function clearSessions(): Promise<void> {
    await db.sessions.clear();
}

export async function bulkAddSessions(sessions: SessionState[]): Promise<void> {
    if (sessions.length === 0) return;
    // FIX: Cast table to any to prevent 'any to never' assignment errors on bulk operations.
    await (db.sessions as any).bulkPut(sessions);
}

export async function deleteSessionState(id: string): Promise<void> {
  await db.sessions.delete(id);
}

export async function getAllSessionKeys(): Promise<string[]> {
  const keys = await db.sessions.toCollection().primaryKeys();
  return keys as string[];
}

export async function clearDecks() { await db.decks.clear(); }
export async function clearFolders() { await db.folders.clear(); }
export async function clearSeries() { await db.deckSeries.clear(); }

export async function saveLearningProgress(progress: DeckLearningProgress): Promise<void> {
    await db.learningProgress.put(progress);
}

export async function getAllLearningProgress(): Promise<Record<string, DeckLearningProgress>> {
    const items = await db.learningProgress.toArray();
    const result: Record<string, DeckLearningProgress> = {};
    items.forEach(item => result[item.deckId] = item);
    return result;
}

export async function bulkAddLearningProgress(progress: Record<string, DeckLearningProgress>): Promise<void> {
    const items = Object.values(progress);
    if (items.length === 0) return;
    // FIX: Cast table to any to prevent 'any to never' assignment errors on bulk operations.
    await (db.learningProgress as any).bulkPut(items as any);
}

export async function getAllDataForBackup(): Promise<{
  decks: Deck[],
  folders: Folder[],
  deckSeries: DeckSeries[],
  reviews: ReviewLog[],
  sessions: SessionState[],
  seriesProgress: Record<string, string[]>,
  learningProgress: Record<string, DeckLearningProgress>,
}> {
  const [decks, folders, deckSeries, reviews, sessions, rawSeriesProgress, learningProgressArr] = await Promise.all([
    db.decks.toArray(),
    db.folders.toArray(),
    db.deckSeries.toArray(),
    db.reviews.toArray(),
    db.sessions.toArray(),
    db.seriesProgress.toArray(),
    db.learningProgress.toArray()
  ]);

  const seriesProgress: Record<string, string[]> = {};
  rawSeriesProgress.forEach(item => seriesProgress[item.id] = item.completedDeckIds);

  const learningProgress: Record<string, DeckLearningProgress> = {};
  learningProgressArr.forEach(item => learningProgress[item.deckId] = item);

  return { decks, folders, deckSeries, reviews, sessions, seriesProgress, learningProgress };
}

export async function addReviewLog(log: ReviewLog): Promise<void> {
  // Use add to let Dexie handle the auto-increment primary key
  const { id, ...data } = log;
  await db.reviews.add(data as any);
}

export async function getReviewsSince(sinceDate: Date): Promise<ReviewLog[]> {
  return await db.reviews.where('timestamp').aboveOrEqual(sinceDate.toISOString()).toArray();
}

export async function getAllReviews(): Promise<ReviewLog[]> {
  return await db.reviews.toArray();
}

export async function clearReviews(): Promise<void> {
    await db.reviews.clear();
}

export async function deleteReviewsForDecks(deckIds: string[]): Promise<void> {
    if (deckIds.length === 0) return;
    await db.reviews.where('deckId').anyOf(deckIds).delete();
}

export async function bulkAddReviews(logs: ReviewLog[]): Promise<void> {
    if (logs.length === 0) return;
    const data = logs.map(({ id, ...logWithoutId }) => logWithoutId);
    // FIX: Access bulkAdd through an any-cast to prevent 'any to never' assignment errors during bulk insertion.
    await (db as any).reviews.bulkAdd(data as any);
}

export async function getReviewsForDeck(deckId: string): Promise<ReviewLog[]> {
  return await db.reviews.where('deckId').equals(deckId).toArray();
}

export async function saveAIChatHistory(history: AIMessage[]): Promise<void> {
    await db.ai_chat.put({ id: 'global_history', history });
}

export async function getAIChatHistory(): Promise<AIMessage[]> {
    const entry = await db.ai_chat.get('global_history');
    return entry?.history || [];
}

export async function clearAIChatHistory(): Promise<void> {
    await db.ai_chat.clear();
}

export async function saveSeriesProgress(seriesId: string, completedDeckIds: Set<string>): Promise<void> {
  await db.seriesProgress.put({ id: seriesId, completedDeckIds: Array.from(completedDeckIds) });
}

export async function getAllSeriesProgress(): Promise<Record<string, string[]>> {
  const items = await db.seriesProgress.toArray();
  const result: Record<string, string[]> = {};
  items.forEach(item => result[item.id] = item.completedDeckIds);
  return result;
}

export async function clearSeriesProgress(): Promise<void> {
    await db.seriesProgress.clear();
}

export async function bulkAddSeriesProgress(progress: Record<string, string[]>): Promise<void> {
    const items = Object.entries(progress).map(([id, completedDeckIds]) => ({ id, completedDeckIds }));
    if (items.length === 0) return;
    // FIX: Cast table to any to prevent 'any to never' assignment errors on bulk operations.
    await (db.seriesProgress as any).bulkPut(items as any);
}

export async function exportAllData(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const data = await getAllDataForBackup();
    
    if (data.decks.length === 0 && data.folders.length === 0 && data.deckSeries.length === 0) {
        throw new Error("No data to export.");
    }

    const aiChatHistory = await getAIChatHistory();
    const settings: AppSettings = {};
    const lsKeys: Record<string, string> = {
        themeId: 'cogniflow-themeId',
        disableAnimations: 'cogniflow-disableAnimations',
        hapticsEnabled: 'cogniflow-hapticsEnabled',
        aiFeaturesEnabled: 'cogniflow-aiFeaturesEnabled',
        veoEnabled: 'cogniflow-veoEnabled',
        groundedImagesEnabled: 'cogniflow-groundedImagesEnabled',
        searchAuditsEnabled: 'cogniflow-searchAuditsEnabled',
        backupEnabled: 'cogniflow-backupEnabled',
        backupApiKey: 'cogniflow-backupApiKey',
        syncOnCellular: 'cogniflow-syncOnCellular',
        notificationsEnabled: 'cogniflow-notificationsEnabled',
        leechThreshold: 'cogniflow-leechThreshold',
        leechAction: 'cogniflow-leechAction',
        fontFamily: 'cogniflow-fontFamily',
        encryptionPassword: 'cogniflow-encryptionPassword',
    };

    // FIX: Using cast to any to resolve indexed access issue (Type 'any' is not assignable to type 'never')
    Object.entries(lsKeys).forEach(([key, lsKey]) => {
        const val = localStorage.getItem(lsKey);
        if (val !== null) {
            try { (settings as any)[key] = JSON.parse(val); } catch { (settings as any)[key] = val; }
        }
    });

    const exportData: FullBackupData = { version: 9, ...data, aiChatHistory, settings };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cogniflow-backup-${getStockholmFilenameTimestamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return a.download;
}

export async function performAtomicRestore(data: FullBackupData): Promise<void> {
    // FIX: Using cast to any to resolve transaction property accessibility
    await (db as any).transaction('rw', [db.decks, db.folders, db.deckSeries, db.reviews, db.sessions, db.ai_chat, db.seriesProgress, db.learningProgress], async () => {
        await Promise.all([
            db.decks.clear(), db.folders.clear(), db.deckSeries.clear(), 
            db.reviews.clear(), db.sessions.clear(), db.ai_chat.clear(), 
            db.seriesProgress.clear(), db.learningProgress.clear()
        ]);

        // FIX: Cast db instance to 'any' for subsequent bulk operations and explicitly cast table properties to bypass compiler inference issues (any to never).
        const anyDb = db as any;
        const anyData = data as any;
        
        if (anyData.decks) await (anyDb.decks as any).bulkPut(anyData.decks as any);
        if (anyData.folders) await (anyDb.folders as any).bulkPut(anyData.folders as any);
        if (anyData.deckSeries) await (anyDb.deckSeries as any).bulkPut(anyData.deckSeries as any);
        
        if (anyData.reviews && anyData.reviews.length > 0) {
            // FIX: Explicitly cast individual item in map to resolve Type 'any' is not assignable to type 'never' during restoration.
            const reviewRestoreItems = anyData.reviews.map((log: any) => {
                const { id, ...logWithoutId } = log;
                return logWithoutId;
            });
            // FIX: Access bulkAdd through an any-cast to prevent 'any to never' assignment errors during restoration.
            await (anyDb.table('reviews') as any).bulkAdd(reviewRestoreItems as any);
        }
        if (anyData.sessions) await (anyDb.sessions as any).bulkPut(anyData.sessions as any);
        if (anyData.aiChatHistory) await (anyDb.ai_chat as any).put({ id: 'global_history', history: anyData.aiChatHistory } as any);
        
        if (anyData.seriesProgress) {
            const progressEntries = Object.entries(anyData.seriesProgress).map(([id, completedDeckIds]) => ({ id, completedDeckIds }));
            // FIX: Explicitly cast anyData.seriesProgress components to any to resolve Type 'any' is not assignable to type 'never' error.
            await (anyDb.seriesProgress as any).bulkPut(progressEntries as any);
        }
        if (anyData.learningProgress) {
            // FIX: Explicitly cast anyData.learningProgress components to any to resolve Type 'any' is not assignable to type 'never' error.
            await (anyDb.learningProgress as any).bulkPut(Object.values(anyData.learningProgress) as any);
        }
    });
    broadcastDataChange();
}

export async function factoryReset(): Promise<void> {
  // FIX: Using cast to any to resolve delete property accessibility
  await (db as any).delete();
  localStorage.clear();
  window.location.reload();
}
