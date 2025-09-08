import { Deck, Folder, DeckSeries, ReviewLog, SessionState, AIMessage, FullBackupData } from '../types';
import { broadcastDataChange } from './syncService';
import { getStockholmFilenameTimestamp } from './time';

const DB_NAME = 'CogniFlowDB';
const DB_VERSION = 8; // Incremented version
const DECK_STORE_NAME = 'decks';
const FOLDER_STORE_NAME = 'folders';
const SERIES_STORE_NAME = 'deckSeries';
const SESSION_STORE_NAME = 'sessions';
const REVIEW_STORE_NAME = 'reviews';
const AI_CHAT_STORE_NAME = 'ai_chat';
const SERIES_PROGRESS_STORE_NAME = 'seriesProgress';


let dbPromise: Promise<IDBDatabase> | null = null;
let catastrophicFailure = false;
let selfHealAttempted = false; // Prevent healing loops within a single session

function initDB(): Promise<IDBDatabase> {
  if (catastrophicFailure) {
    return Promise.reject(new Error('Catastrophic error: Could not open or delete the database. Please clear your site data manually.'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    console.log(`[DB] Initializing IndexedDB: ${DB_NAME} v${DB_VERSION}...`);
    if (!window.indexedDB) {
        const errorMsg = "IndexedDB is not supported by this browser.";
        console.error(`[DB] ${errorMsg}`);
        return reject(new Error(errorMsg));
    }
      
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = (event) => {
        const errorMsg = 'Database upgrade is required, but it is blocked by another open tab of this application. Please close all other tabs and reload.';
        console.error('[DB] IndexedDB open request blocked. Please close other tabs with this app open.', event);
        reject(new Error(errorMsg));
    };

    request.onerror = () => {
      console.error('[DB] IndexedDB error during open:', request.error);
      const errorMsg = 'Catastrophic error: Could not open or delete the database. Please clear your site data manually.';

      if (selfHealAttempted) {
          console.error('[DB] Self-heal already attempted. Failing permanently.');
          catastrophicFailure = true;
          dbPromise = null;
          return reject(new Error(errorMsg));
      }
      
      selfHealAttempted = true;
      console.warn('[DB] Attempting to self-heal by deleting the database and reloading.');
      
      dbPromise = null;

      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      
      deleteRequest.onsuccess = () => {
          console.log('[DB] Database deleted successfully. Reloading the page to re-initialize.');
          // A full reload is a more robust recovery mechanism than retrying in the background.
          window.location.reload();
          // The promise will not resolve here because the page is reloading.
      };
      
      deleteRequest.onerror = (e) => {
          console.error(`[DB] ${errorMsg}`, e);
          catastrophicFailure = true;
          dbPromise = null;
          reject(new Error(errorMsg));
      };
      
      deleteRequest.onblocked = (e) => {
          const blockedErrorMsg = 'Database deletion is blocked. Please close all other tabs of this app and try again.';
          console.error(`[DB] ${blockedErrorMsg}`, e);
          catastrophicFailure = true;
          dbPromise = null;
          reject(new Error(blockedErrorMsg));
      };
    };

    request.onsuccess = () => {
      const db = request.result;
      console.log('[DB] IndexedDB connection successful.');
      selfHealAttempted = false; // Reset on a successful connection
      db.onclose = () => {
        dbPromise = null;
        console.warn('[DB] Database connection closed.');
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      console.log(`[DB] Upgrading database from version ${event.oldVersion} to ${DB_VERSION}`);
      
      if (!transaction) {
          console.error("[DB] Upgrade transaction is not available, aborting upgrade.");
          if (event.target) {
            (event.target as IDBOpenDBRequest).transaction?.abort();
          }
          return;
      }
      
      // Use a fall-through switch statement for robust, sequential upgrades.
      switch(event.oldVersion) {
        case 0:
            console.log('[DB] v1: Creating initial object stores (decks, folders).');
            db.createObjectStore(DECK_STORE_NAME, { keyPath: 'id' });
            db.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id' });
        // fall through
        case 1:
        case 2:
            console.log(`[DB] v3: Creating object store: ${SERIES_STORE_NAME}`);
            if (!db.objectStoreNames.contains(SERIES_STORE_NAME)) {
                db.createObjectStore(SERIES_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        case 3:
            console.log(`[DB] v4: Creating object store: ${SESSION_STORE_NAME}`);
            if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
                db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        case 4:
            console.log(`[DB] v5: Creating object store: ${REVIEW_STORE_NAME}`);
            if (!db.objectStoreNames.contains(REVIEW_STORE_NAME)) {
                const reviewStore = db.createObjectStore(REVIEW_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                reviewStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        // fall through
        case 5:
            console.log('[DB] v6: Adding deckId index to reviews store.');
            const store = transaction.objectStore(REVIEW_STORE_NAME);
            if (!store.indexNames.contains('deckId')) {
                store.createIndex('deckId', 'deckId', { unique: false });
            }
        // fall through
        case 6:
            console.log(`[DB] v7: Creating object store: ${AI_CHAT_STORE_NAME}`);
            if (!db.objectStoreNames.contains(AI_CHAT_STORE_NAME)) {
                db.createObjectStore(AI_CHAT_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        case 7:
            console.log(`[DB] v8: Creating object store: ${SERIES_PROGRESS_STORE_NAME}`);
            if (!db.objectStoreNames.contains(SERIES_PROGRESS_STORE_NAME)) {
                db.createObjectStore(SERIES_PROGRESS_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        default:
          console.log('[DB] Database upgrade sequence complete.');
      }
    };
  });
  return dbPromise;
}

// Deck Functions
export async function getAllDecks(): Promise<Deck[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DECK_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DECK_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => {
        console.error("DB Error fetching all decks:", request.error);
        reject(new Error('Error fetching decks from the database.'));
    };
    request.onsuccess = () => resolve(request.result as Deck[]);
  });
}

export async function addDecks(decks: Deck[]): Promise<void> {
  if (decks.length === 0) return;
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DECK_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DECK_STORE_NAME);
    
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => {
        console.error("Transaction error adding/updating decks", transaction.error);
        reject(new Error('Transaction error adding/updating decks.'));
    };

    decks.forEach(deck => {
        const request = store.put(deck);
        request.onerror = () => {
             console.error(`Error putting deck ${deck.name}`, request.error);
        }
    });
  });
}

export async function bulkUpdateDecks(decks: Deck[]): Promise<void> {
  await addDecks(decks);
}


export async function deleteDeck(deckId: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DECK_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => {
        console.error("Transaction error deleting deck", transaction.error);
        reject(new Error('Transaction error deleting deck.'));
    };

    const store = transaction.objectStore(DECK_STORE_NAME);
    store.delete(deckId);
  });
}

export async function updateDeck(deck: Deck): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DECK_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => {
        console.error("Transaction error updating deck", transaction.error);
        reject(new Error('Transaction error updating deck.'));
    };
    
    const store = transaction.objectStore(DECK_STORE_NAME);
    store.put(deck);
  });
}

// Folder Functions
export async function getAllFolders(): Promise<Folder[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FOLDER_STORE_NAME, 'readonly');
    const store = transaction.objectStore(FOLDER_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => {
        console.error("DB Error fetching all folders:", request.error);
        reject(new Error('Error fetching folders from the database.'));
    };
    request.onsuccess = () => resolve(request.result as Folder[]);
  });
}

export async function addFolder(folder: Folder): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FOLDER_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => {
        console.error("Transaction error adding folder", transaction.error);
        reject(new Error('Transaction error adding folder.'));
    };

    const store = transaction.objectStore(FOLDER_STORE_NAME);
    store.add(folder);
  });
}

export async function addFolders(folders: Folder[]): Promise<void> {
  if (folders.length === 0) return;
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FOLDER_STORE_NAME, 'readwrite');
    
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => {
        console.error("Transaction error adding/updating folders", transaction.error);
        reject(new Error('Transaction error adding/updating folders.'));
    };

    const store = transaction.objectStore(FOLDER_STORE_NAME);
    folders.forEach(folder => {
        const request = store.put(folder);
        request.onerror = () => {
             console.error(`Error putting folder ${folder.name}`, request.error);
        }
    });
  });
}

export async function updateFolder(folder: Folder): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FOLDER_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => {
        console.error("Transaction error updating folder", transaction.error);
        reject(new Error('Transaction error updating folder.'));
    };

    const store = transaction.objectStore(FOLDER_STORE_NAME);
    store.put(folder);
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FOLDER_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => {
        console.error("Transaction error deleting folder", transaction.error);
        reject(new Error('Transaction error deleting folder.'));
    };

    const store = transaction.objectStore(FOLDER_STORE_NAME);
    store.delete(folderId);
  });
}

// DeckSeries Functions
export async function getAllDeckSeries(): Promise<DeckSeries[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SERIES_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SERIES_STORE_NAME);
        const request = store.getAll();

        request.onerror = () => {
            console.error("DB Error fetching all series:", request.error);
            reject(new Error('Error fetching deck series from the database.'));
        };
        request.onsuccess = () => resolve(request.result as DeckSeries[]);
    });
}

export async function addDeckSeries(series: DeckSeries[]): Promise<void> {
    if (series.length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SERIES_STORE_NAME, 'readwrite');
        
        transaction.oncomplete = () => {
            broadcastDataChange();
            resolve();
        };
        transaction.onerror = () => {
            console.error("Transaction error adding deck series", transaction.error);
            reject(new Error('Transaction error adding deck series.'));
        };

        const store = transaction.objectStore(SERIES_STORE_NAME);
        series.forEach(s => store.put(s));
    });
}

export async function updateDeckSeries(series: DeckSeries): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SERIES_STORE_NAME, 'readwrite');
        transaction.oncomplete = () => {
            broadcastDataChange();
            resolve();
        };
        transaction.onerror = () => {
            console.error("Transaction error updating deck series", transaction.error);
            reject(new Error('Error updating deck series.'));
        };

        const store = transaction.objectStore(SERIES_STORE_NAME);
        store.put(series);
    });
}

export async function deleteDeckSeries(seriesId: string): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SERIES_STORE_NAME, 'readwrite');
        transaction.oncomplete = () => {
            broadcastDataChange();
            resolve();
        };
        transaction.onerror = () => {
            console.error("Transaction error deleting deck series", transaction.error);
            reject(new Error('Error deleting deck series.'));
        };
        
        const store = transaction.objectStore(SERIES_STORE_NAME);
        store.delete(seriesId);
    });
}

// Session State Functions
export async function saveSessionState(id: string, state: SessionState): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        console.error("Transaction error saving session state", transaction.error);
        reject(new Error('Transaction error saving session state.'));
    };
    
    const store = transaction.objectStore(SESSION_STORE_NAME);
    store.put({ id, ...state });
  });
}

export async function getSessionState(id: string): Promise<SessionState | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SESSION_STORE_NAME);
    const request = store.get(id);

    request.onerror = () => {
        console.error("DB Error fetching session state", request.error);
        reject(new Error('Error fetching session state.'));
    };
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function getAllSessions(): Promise<SessionState[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SESSION_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Failed to get all sessions.'));
    });
}

export async function clearSessions(): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SESSION_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to clear sessions.'));
    });
}

export async function bulkAddSessions(sessions: SessionState[]): Promise<void> {
    if (sessions.length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SESSION_STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('Transaction error adding sessions.'));
        sessions.forEach(session => store.put(session));
    });
}


export async function deleteSessionState(id: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        console.error("Transaction error deleting session state", transaction.error);
        reject(new Error('Transaction error deleting session state.'));
    };

    const store = transaction.objectStore(SESSION_STORE_NAME);
    store.delete(id);
  });
}

export async function getAllSessionKeys(): Promise<string[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SESSION_STORE_NAME);
    const request = store.getAllKeys();

    request.onerror = () => {
        console.error("DB Error fetching session keys", request.error);
        reject(new Error('Error fetching session keys.'));
    };
    request.onsuccess = () => resolve(request.result as string[]);
  });
}

// Helper function to clear an object store
async function clearObjectStore(storeName: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error(`Failed to clear object store: ${storeName}`, request.error);
        reject(new Error(`Failed to clear object store: ${storeName}.`));
    };
  });
}

export const clearDecks = () => clearObjectStore(DECK_STORE_NAME);
export const clearFolders = () => clearObjectStore(FOLDER_STORE_NAME);
export const clearSeries = () => clearObjectStore(SERIES_STORE_NAME);

export async function getAllDataForBackup(): Promise<{
  decks: Deck[],
  folders: Folder[],
  deckSeries: DeckSeries[],
  reviews: ReviewLog[],
  sessions: SessionState[],
  seriesProgress: Record<string, string[]>,
}> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const storeNames = [DECK_STORE_NAME, FOLDER_STORE_NAME, SERIES_STORE_NAME, REVIEW_STORE_NAME, SESSION_STORE_NAME, SERIES_PROGRESS_STORE_NAME];
    const transaction = db.transaction(storeNames, 'readonly');
    
    const requests = {
      decks: transaction.objectStore(DECK_STORE_NAME).getAll(),
      folders: transaction.objectStore(FOLDER_STORE_NAME).getAll(),
      deckSeries: transaction.objectStore(SERIES_STORE_NAME).getAll(),
      reviews: transaction.objectStore(REVIEW_STORE_NAME).getAll(),
      sessions: transaction.objectStore(SESSION_STORE_NAME).getAll(),
      seriesProgress: transaction.objectStore(SERIES_PROGRESS_STORE_NAME).getAll(),
    };
    
    transaction.oncomplete = () => {
      const progressResult: Record<string, string[]> = {};
      (requests.seriesProgress.result as { id: string, completedDeckIds: string[] }[]).forEach(item => {
          progressResult[item.id] = item.completedDeckIds;
      });

      resolve({
        decks: requests.decks.result as Deck[],
        folders: requests.folders.result as Folder[],
        deckSeries: requests.deckSeries.result as DeckSeries[],
        reviews: requests.reviews.result as ReviewLog[],
        sessions: requests.sessions.result as SessionState[],
        seriesProgress: progressResult,
      });
    };
    
    transaction.onerror = () => {
        console.error("Transaction error in getAllDataForBackup", transaction.error);
        reject(new Error('Database transaction failed while gathering backup data.'));
    };
  });
}

// Review Log Functions for Analytics
export async function addReviewLog(log: ReviewLog): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(REVIEW_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      console.error("Transaction error adding review log", transaction.error);
      reject(new Error('Transaction error adding review log.'));
    };
    
    const store = transaction.objectStore(REVIEW_STORE_NAME);
    store.add(log);
  });
}

export async function getReviewsSince(sinceDate: Date): Promise<ReviewLog[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REVIEW_STORE_NAME, 'readonly');
    const store = transaction.objectStore(REVIEW_STORE_NAME);
    const index = store.index('timestamp');
    const range = IDBKeyRange.lowerBound(sinceDate.toISOString());
    const request = index.getAll(range);

    request.onerror = () => {
        console.error("DB Error fetching review logs", request.error);
        reject(new Error('Error fetching review logs.'));
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllReviews(): Promise<ReviewLog[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REVIEW_STORE_NAME, 'readonly');
    const store = transaction.objectStore(REVIEW_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => {
        console.error("DB Error fetching all reviews:", request.error);
        reject(new Error('Error fetching all reviews from the database.'));
    };
    request.onsuccess = () => resolve(request.result as ReviewLog[]);
  });
}

export async function clearReviews(): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(REVIEW_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(REVIEW_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (e) => {
            console.error("Failed to clear review logs", request.error);
            reject(new Error('Failed to clear review logs.'));
        };
    });
}

export async function bulkAddReviews(logs: ReviewLog[]): Promise<void> {
    if (logs.length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(REVIEW_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(REVIEW_STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
             console.error("Transaction error adding review logs", transaction.error);
             reject(new Error('Transaction error adding review logs.'));
        };

        logs.forEach(log => {
            const { id, ...logWithoutId } = log;
            store.add(logWithoutId);
        });
    });
}

export async function getReviewsForDeck(deckId: string): Promise<ReviewLog[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REVIEW_STORE_NAME, 'readonly');
    const store = transaction.objectStore(REVIEW_STORE_NAME);
    const index = store.index('deckId');
    const request = index.getAll(deckId);

    request.onerror = () => {
        console.error(`DB Error fetching reviews for deck ${deckId}`, request.error);
        reject(new Error(`Error fetching reviews for deck ${deckId}.`));
    };
    request.onsuccess = () => resolve(request.result);
  });
}

// AI Chat History Functions
export async function saveAIChatHistory(history: AIMessage[]): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(AI_CHAT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(AI_CHAT_STORE_NAME);
        const request = store.put({ id: 'global_history', history });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to save AI chat history.'));
    });
}

export async function getAIChatHistory(): Promise<AIMessage[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AI_CHAT_STORE_NAME, 'readonly');
        const store = transaction.objectStore(AI_CHAT_STORE_NAME);
        const request = store.get('global_history');
        request.onsuccess = () => resolve(request.result?.history || []);
        request.onerror = () => reject(new Error('Failed to get AI chat history.'));
    });
}

export async function clearAIChatHistory(): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(AI_CHAT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(AI_CHAT_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to clear AI chat history.'));
    });
}

// Series Progress Functions
export async function saveSeriesProgress(seriesId: string, completedDeckIds: Set<string>): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SERIES_PROGRESS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SERIES_PROGRESS_STORE_NAME);
    const request = store.put({ id: seriesId, completedDeckIds: Array.from(completedDeckIds) });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save series progress.'));
  });
}

export async function getAllSeriesProgress(): Promise<Record<string, string[]>> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SERIES_PROGRESS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SERIES_PROGRESS_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
        const result: Record<string, string[]> = {};
        (request.result as {id: string, completedDeckIds: string[]}[]).forEach(item => {
            result[item.id] = item.completedDeckIds;
        });
        resolve(result);
    };
    request.onerror = () => reject(new Error('Failed to get all series progress.'));
  });
}

export async function clearSeriesProgress(): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SERIES_PROGRESS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SERIES_PROGRESS_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to clear series progress.'));
    });
}

export async function bulkAddSeriesProgress(progress: Record<string, string[]>): Promise<void> {
    if (Object.keys(progress).length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SERIES_PROGRESS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SERIES_PROGRESS_STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('Transaction error adding series progress.'));
        Object.entries(progress).forEach(([seriesId, completedDeckIds]) => {
            store.put({ id: seriesId, completedDeckIds });
        });
    });
}


export async function exportAllData(): Promise<string | null> {
    const { decks, folders, deckSeries, reviews, sessions, seriesProgress } = await getAllDataForBackup();
    
    if (decks.length === 0 && folders.length === 0 && deckSeries.length === 0) {
        throw new Error("There is no data to export.");
    }

    const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
    const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
    const aiChatHistory = await getAIChatHistory();

    const exportData: any = {
        version: 6,
        decks,
        folders,
        deckSeries,
        reviews,
        sessions,
        aiChatHistory,
        seriesProgress
    };

    if (aiOptions) {
        exportData.aiOptions = aiOptions;
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const timestamp = getStockholmFilenameTimestamp();
    a.download = `cogniflow-backup-${timestamp}.json`;
    
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return a.download;
}

export async function performAtomicRestore(data: FullBackupData): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const storeNames = [
            DECK_STORE_NAME, FOLDER_STORE_NAME, SERIES_STORE_NAME, 
            REVIEW_STORE_NAME, SESSION_STORE_NAME, AI_CHAT_STORE_NAME, 
            SERIES_PROGRESS_STORE_NAME
        ];
        
        const transaction = db.transaction(storeNames, 'readwrite');
        
        transaction.oncomplete = () => {
            broadcastDataChange(); // Notify other tabs
            resolve();
        };
        transaction.onerror = (event) => {
            console.error("Atomic restore transaction failed:", transaction.error);
            reject(new Error('Database transaction failed during data restore.'));
        };
        
        try {
            // 1. Clear all stores
            const deckStore = transaction.objectStore(DECK_STORE_NAME);
            deckStore.clear();
            const folderStore = transaction.objectStore(FOLDER_STORE_NAME);
            folderStore.clear();
            const seriesStore = transaction.objectStore(SERIES_STORE_NAME);
            seriesStore.clear();
            const reviewStore = transaction.objectStore(REVIEW_STORE_NAME);
            reviewStore.clear();
            const sessionStore = transaction.objectStore(SESSION_STORE_NAME);
            sessionStore.clear();
            const aiChatStore = transaction.objectStore(AI_CHAT_STORE_NAME);
            aiChatStore.clear();
            const seriesProgressStore = transaction.objectStore(SERIES_PROGRESS_STORE_NAME);
            seriesProgressStore.clear();

            // 2. Add new data from backup
            (data.decks || []).forEach(deck => deckStore.put(deck));
            (data.folders || []).forEach(folder => folderStore.put(folder));
            (data.deckSeries || []).forEach(series => seriesStore.put(series));
            (data.reviews || []).forEach(log => {
                const { id, ...logWithoutId } = log; // Reviews have auto-incrementing key
                reviewStore.add(logWithoutId);
            });
            (data.sessions || []).forEach(session => sessionStore.put(session));
            if (data.aiChatHistory && data.aiChatHistory.length > 0) {
                 aiChatStore.put({ id: 'global_history', history: data.aiChatHistory });
            }
            Object.entries(data.seriesProgress || {}).forEach(([seriesId, completedDeckIds]) => {
                seriesProgressStore.put({ id: seriesId, completedDeckIds });
            });
            
        } catch (e) {
            console.error("Error queueing operations for atomic restore:", e);
            transaction.abort(); // Attempt to abort if an error occurs while queueing
            reject(e);
        }
    });
}

export async function factoryReset(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }

  return new Promise((resolve, reject) => {
    console.log(`[DB] Attempting to delete database: ${DB_NAME}`);
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onerror = (event) => {
      console.error('Error deleting database.', (event.target as IDBOpenDBRequest).error);
      reject(new Error('Error deleting database.'));
    };

    deleteRequest.onsuccess = () => {
      console.log('Database deleted successfully.');
      resolve();
    };
    
    deleteRequest.onblocked = () => {
        console.error('Database deletion blocked. Please close other tabs of this app and try again.');
        reject(new Error('Deletion blocked. Please close other tabs of this app.'));
    };
  });
}
