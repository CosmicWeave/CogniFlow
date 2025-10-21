// FIX: Corrected import path for types
import { Deck, Folder, DeckSeries, ReviewLog, SessionState, AIMessage, FullBackupData, AppSettings } from '../types';
import { broadcastDataChange } from './syncService.ts';
import { getStockholmFilenameTimestamp } from './time.ts';

const DB_NAME = 'CogniFlowDB';
const DB_VERSION = 8; // Incremented version
const DECK_STORE_NAME = 'decks';
const FOLDER_STORE_NAME = 'folders';
const SERIES_STORE_NAME = 'deckSeries';
const SESSION_STORE_NAME = 'sessions';
const REVIEW_STORE_NAME = 'reviews';
const AI_CHAT_STORE_NAME = 'ai_chat';
const SERIES_PROGRESS_STORE_NAME = 'seriesProgress';

const createSpamProtectedLogger = (name: string, threshold = 20, timeWindow = 5000) => {
    let logCount = 0;
    let windowStart = Date.now();
    let isMuted = false;

    const log = (level: 'log' | 'warn' | 'error', ...args: any[]) => {
        const now = Date.now();
        if (now - windowStart > timeWindow) {
            logCount = 0;
            windowStart = now;
            if (isMuted) {
                console.warn(`[${name}] Logger is now unmuted after timeout.`);
            }
            isMuted = false;
        }

        if (isMuted) {
            return;
        }

        logCount++;

        if (logCount > threshold) {
            console.error(`[${name}] Logger muted: Too many logs in a short time window (${threshold} logs in <${timeWindow}ms). This may indicate a serious issue like a data corruption loop or a repeated failed operation. Further logs from this source will be suppressed for a short time to prevent app overload.`);
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


let dbPromise: Promise<IDBDatabase> | null = null;

function initDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    dbLogger.log(`Initializing IndexedDB: ${DB_NAME} v${DB_VERSION}...`);
    if (!window.indexedDB) {
        const errorMsg = "IndexedDB is not supported by this browser.";
        dbLogger.error(`${errorMsg}`);
        return reject(new Error(errorMsg));
    }
      
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = (event) => {
        const errorMsg = 'Database upgrade is required, but it is blocked by another open tab of this application. Please close all other tabs and reload.';
        dbLogger.error('IndexedDB open request blocked. Please close other tabs with this app open.', event);
        reject(new Error(errorMsg));
    };

    request.onerror = () => {
      dbLogger.error('IndexedDB error during open:', request.error);
      // Nullify the promise so subsequent calls will re-attempt initialization.
      dbPromise = null;
      // Reject with a specific error that the UI can catch and display instructions for.
      // This prevents a reload loop if the DB is in a permanently bad state.
      const specificError = new Error('Could not open or delete the database. This can be caused by browser settings (like blocking all data), private mode, or corruption. Please clear website data for this app in your browser settings and reload.');
      reject(specificError);
    };

    request.onsuccess = () => {
      const db = request.result;
      dbLogger.log('IndexedDB connection successful.');
      db.onclose = () => {
        dbPromise = null;
        dbLogger.warn('Database connection closed.');
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      dbLogger.log(`Upgrading database from version ${event.oldVersion} to ${DB_VERSION}`);
      
      if (!transaction) {
          dbLogger.error("Upgrade transaction is not available, aborting upgrade.");
          if (event.target) {
            (event.target as IDBOpenDBRequest).transaction?.abort();
          }
          return;
      }
      
      // Use a fall-through switch statement for robust, sequential upgrades.
      switch(event.oldVersion) {
        case 0:
            dbLogger.log('v1: Creating initial object stores (decks, folders).');
            db.createObjectStore(DECK_STORE_NAME, { keyPath: 'id' });
            db.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id' });
        // fall through
        case 1:
        case 2:
            dbLogger.log(`v3: Creating object store: ${SERIES_STORE_NAME}`);
            if (!db.objectStoreNames.contains(SERIES_STORE_NAME)) {
                db.createObjectStore(SERIES_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        case 3:
            dbLogger.log(`v4: Creating object store: ${SESSION_STORE_NAME}`);
            if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
                db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        case 4:
            dbLogger.log(`v5: Creating object store: ${REVIEW_STORE_NAME}`);
            if (!db.objectStoreNames.contains(REVIEW_STORE_NAME)) {
                const reviewStore = db.createObjectStore(REVIEW_STORE_NAME, { autoIncrement: true });
                reviewStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        // fall through
        case 5:
            dbLogger.log('v6: Adding deckId index to reviews store.');
            const store = transaction.objectStore(REVIEW_STORE_NAME);
            if (!store.indexNames.contains('deckId')) {
                store.createIndex('deckId', 'deckId', { unique: false });
            }
        // fall through
        case 6:
            dbLogger.log(`v7: Creating object store: ${AI_CHAT_STORE_NAME}`);
            if (!db.objectStoreNames.contains(AI_CHAT_STORE_NAME)) {
                db.createObjectStore(AI_CHAT_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        case 7:
            dbLogger.log(`v8: Creating object store: ${SERIES_PROGRESS_STORE_NAME}`);
            if (!db.objectStoreNames.contains(SERIES_PROGRESS_STORE_NAME)) {
                db.createObjectStore(SERIES_PROGRESS_STORE_NAME, { keyPath: 'id' });
            }
        // fall through
        default:
          dbLogger.log('Database upgrade sequence complete.');
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
        dbLogger.error("DB Error fetching all decks:", request.error);
        reject(new Error('Error fetching decks from the database.'));
    };
    request.onsuccess = () => {
        const result = request.result;
        const decks = Array.isArray(result) ? result : [];
        const count = decks.length;
        if (count > 0) {
            dbLogger.log(`Successfully loaded ${count} decks from the database.`);
        } else {
            dbLogger.warn(`No decks found in the database.`);
        }
        resolve(decks as Deck[]);
    }
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
        dbLogger.error("Transaction error adding/updating decks", transaction.error);
        reject(new Error('Transaction error adding/updating decks.'));
    };

    decks.forEach(deck => {
        const request = store.put(deck);
        request.onerror = () => {
             dbLogger.error(`Error putting deck ${deck.name}`, request.error);
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
        dbLogger.error("Transaction error deleting deck", transaction.error);
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
        dbLogger.error("Transaction error updating deck", transaction.error);
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
        dbLogger.error("DB Error fetching all folders:", request.error);
        reject(new Error('Error fetching folders from the database.'));
    };
    request.onsuccess = () => {
        const result = request.result;
        const folders = Array.isArray(result) ? result : [];
        const count = folders.length;
        if (count > 0) {
            dbLogger.log(`Successfully loaded ${count} folders from the database.`);
        } else {
            dbLogger.warn(`No folders found in the database.`);
        }
        resolve(folders as Folder[]);
    }
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
        dbLogger.error("Transaction error adding folder", transaction.error);
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
        dbLogger.error("Transaction error adding/updating folders", transaction.error);
        reject(new Error('Transaction error adding/updating folders.'));
    };

    const store = transaction.objectStore(FOLDER_STORE_NAME);
    folders.forEach(folder => {
        const request = store.put(folder);
        request.onerror = () => {
             dbLogger.error(`Error putting folder ${folder.name}`, request.error);
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
        dbLogger.error("Transaction error updating folder", transaction.error);
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
        dbLogger.error("Transaction error deleting folder", transaction.error);
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
            dbLogger.error("DB Error fetching all series:", request.error);
            reject(new Error('Error fetching deck series from the database.'));
        };
        request.onsuccess = () => {
            const result = request.result;
            const series = Array.isArray(result) ? result : [];
            const count = series.length;
            if (count > 0) {
                dbLogger.log(`Successfully loaded ${count} series from the database.`);
            } else {
                dbLogger.warn(`No series found in the database.`);
            }
            resolve(series as DeckSeries[]);
        }
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
            dbLogger.error("Transaction error adding deck series", transaction.error);
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
            dbLogger.error("Transaction error updating deck series", transaction.error);
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
            dbLogger.error("Transaction error deleting deck series", transaction.error);
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
        dbLogger.error("Transaction error saving session state", transaction.error);
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
        dbLogger.error("DB Error fetching session state", request.error);
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
        request.onsuccess = () => {
            const result = request.result;
            const sessions = Array.isArray(result) ? result : [];
            const count = sessions.length;
            if (count > 0) {
                dbLogger.log(`Successfully loaded ${count} sessions from the database.`);
            } else {
                dbLogger.warn(`No sessions found in the database.`);
            }
            resolve(sessions);
        }
        request.onerror = () => {
            dbLogger.error("Failed to get all sessions.", request.error);
            reject(new Error('Failed to get all sessions.'));
        }
    });
}

export async function clearSessions(): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SESSION_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => {
            dbLogger.error('Failed to clear sessions.', request.error);
            reject(new Error('Failed to clear sessions.'));
        }
    });
}

export async function bulkAddSessions(sessions: SessionState[]): Promise<void> {
    if (sessions.length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SESSION_STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            dbLogger.error('Transaction error adding sessions.', transaction.error);
            reject(new Error('Transaction error adding sessions.'));
        }
        sessions.forEach(session => store.put(session));
    });
}


export async function deleteSessionState(id: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        dbLogger.error("Transaction error deleting session state", transaction.error);
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
        dbLogger.error("DB Error fetching session keys", request.error);
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
        dbLogger.error(`Failed to clear object store: ${storeName}`, request.error);
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
      const progressItems = Array.isArray(requests.seriesProgress.result) ? requests.seriesProgress.result : [];
      (progressItems as { id: string, completedDeckIds: string[] }[]).forEach(item => {
          progressResult[item.id] = item.completedDeckIds;
      });

      resolve({
        decks: Array.isArray(requests.decks.result) ? requests.decks.result as Deck[] : [],
        folders: Array.isArray(requests.folders.result) ? requests.folders.result as Folder[] : [],
        deckSeries: Array.isArray(requests.deckSeries.result) ? requests.deckSeries.result as DeckSeries[] : [],
        reviews: Array.isArray(requests.reviews.result) ? requests.reviews.result as ReviewLog[] : [],
        sessions: Array.isArray(requests.sessions.result) ? requests.sessions.result as SessionState[] : [],
        seriesProgress: progressResult,
      });
    };
    
    transaction.onerror = () => {
        dbLogger.error("Transaction error in getAllDataForBackup", transaction.error);
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
      dbLogger.error("Transaction error adding review log", transaction.error);
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
        dbLogger.error("DB Error fetching review logs", request.error);
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
        dbLogger.error("DB Error fetching all reviews:", request.error);
        reject(new Error('Error fetching all reviews from the database.'));
    };
    request.onsuccess = () => {
        const result = request.result;
        const reviews = Array.isArray(result) ? result : [];
        const count = reviews.length;
        if (count > 0) {
            dbLogger.log(`Successfully loaded ${count} review logs from the database.`);
        }
        resolve(reviews as ReviewLog[]);
    }
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
            dbLogger.error("Failed to clear review logs", request.error);
            reject(new Error('Failed to clear review logs.'));
        };
    });
}

export async function deleteReviewsForDecks(deckIds: string[]): Promise<void> {
    if (deckIds.length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(REVIEW_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(REVIEW_STORE_NAME);
        const index = store.index('deckId');
        const deckIdSet = new Set(deckIds);
        
        const request = index.openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (deckIdSet.has(cursor.value.deckId)) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };

        transaction.oncomplete = () => {
            dbLogger.log(`Deleted reviews for ${deckIds.length} deck(s).`);
            resolve();
        };
        transaction.onerror = () => {
            dbLogger.error("Transaction error deleting reviews for decks", transaction.error);
            reject(new Error("Failed to delete review logs for specified decks."));
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
             dbLogger.error("Transaction error adding review logs", transaction.error);
             reject(new Error('Transaction error adding review logs.'));
        };

        logs.forEach(log => {
            const { id, ...logWithoutId } = log; // Reviews have auto-incrementing key
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
        dbLogger.error(`DB Error fetching reviews for deck ${deckId}`, request.error);
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
        request.onerror = () => {
            dbLogger.error('Failed to save AI chat history.', request.error);
            reject(new Error('Failed to save AI chat history.'));
        }
    });
}

export async function getAIChatHistory(): Promise<AIMessage[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AI_CHAT_STORE_NAME, 'readonly');
        const store = transaction.objectStore(AI_CHAT_STORE_NAME);
        const request = store.get('global_history');
        request.onsuccess = () => {
            const count = request.result?.history?.length ?? 0;
            if (count > 0) {
                dbLogger.log(`Successfully loaded ${count} AI chat history messages.`);
            }
            resolve(request.result?.history || []);
        }
        request.onerror = () => {
            dbLogger.error('Failed to get AI chat history.', request.error);
            reject(new Error('Failed to get AI chat history.'));
        }
    });
}

export async function clearAIChatHistory(): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(AI_CHAT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(AI_CHAT_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => {
            dbLogger.error('Failed to clear AI chat history.', request.error);
            reject(new Error('Failed to clear AI chat history.'));
        }
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
    request.onerror = () => {
        dbLogger.error('Failed to save series progress.', request.error);
        reject(new Error('Failed to save series progress.'));
    }
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
        const progressItems = Array.isArray(request.result) ? request.result : [];
        (progressItems as {id: string, completedDeckIds: string[]}[]).forEach(item => {
            result[item.id] = item.completedDeckIds;
        });
        const count = Object.keys(result).length;
        if (count > 0) {
            dbLogger.log(`Successfully loaded progress for ${count} series.`);
        }
        resolve(result);
    };
    request.onerror = () => {
        dbLogger.error('Failed to get all series progress.', request.error);
        reject(new Error('Failed to get all series progress.'));
    }
  });
}

export async function clearSeriesProgress(): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SERIES_PROGRESS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SERIES_PROGRESS_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => {
            dbLogger.error('Failed to clear series progress.', request.error);
            reject(new Error('Failed to clear series progress.'));
        }
    });
}

export async function bulkAddSeriesProgress(progress: Record<string, string[]>): Promise<void> {
    if (Object.keys(progress).length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SERIES_PROGRESS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SERIES_PROGRESS_STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            dbLogger.error('Transaction error adding series progress.', transaction.error);
            reject(new Error('Transaction error adding series progress.'));
        }
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
    
    // Gather settings from localStorage
    const settings: AppSettings = {};
    const keys: (keyof AppSettings)[] = ['themeId', 'disableAnimations', 'hapticsEnabled', 'aiFeaturesEnabled', 'backupEnabled', 'backupApiKey', 'syncOnCellular'];
    const lsKeys: Record<keyof AppSettings, string> = {
        themeId: 'cogniflow-themeId',
        disableAnimations: 'cogniflow-disableAnimations',
        hapticsEnabled: 'cogniflow-hapticsEnabled',
        aiFeaturesEnabled: 'cogniflow-aiFeaturesEnabled',
        backupEnabled: 'cogniflow-backupEnabled',
        backupApiKey: 'cogniflow-backupApiKey',
        syncOnCellular: 'cogniflow-syncOnCellular',
    };
    keys.forEach(key => {
        const lsKey = lsKeys[key];
        const value = localStorage.getItem(lsKey);
        if (value !== null) {
            try {
                // some are booleans stored as strings
                if (['disableAnimations', 'hapticsEnabled', 'aiFeaturesEnabled', 'backupEnabled', 'syncOnCellular'].includes(key)) {
                    (settings as any)[key] = JSON.parse(value);
                } else {
                    (settings as any)[key] = value;
                }
            } catch (e) {
                (settings as any)[key] = value;
            }
        }
    });

    const exportData: FullBackupData = {
        version: 7,
        decks,
        folders,
        deckSeries,
        reviews,
        sessions,
        aiChatHistory,
        seriesProgress,
        settings,
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
        dbLogger.log(`Starting atomic restore from backup version ${data.version}.`);
        dbLogger.log(`Backup contains: ${data.decks?.length || 0} decks, ${data.folders?.length || 0} folders, ${data.deckSeries?.length || 0} series, ${data.reviews?.length || 0} reviews, ${data.sessions?.length || 0} sessions, ${Object.keys(data.seriesProgress || {}).length} series progresses, and ${data.aiChatHistory?.length || 0} chat messages.`);
        
        const storeNames = [
            DECK_STORE_NAME, FOLDER_STORE_NAME, SERIES_STORE_NAME, 
            REVIEW_STORE_NAME, SESSION_STORE_NAME, AI_CHAT_STORE_NAME, 
            SERIES_PROGRESS_STORE_NAME
        ];
        
        const transaction = db.transaction(storeNames, 'readwrite');
        
        transaction.oncomplete = () => {
            dbLogger.log("Atomic restore transaction completed successfully. All data has been replaced.");
            broadcastDataChange(); // Notify other tabs
            resolve();
        };
        transaction.onerror = (event) => {
            dbLogger.error("Atomic restore transaction failed:", transaction.error);
            reject(new Error('Database transaction failed during data restore.'));
        };
        
        try {
            // 1. Clear all stores
            dbLogger.log(`Clearing ${storeNames.length} stores...`);
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
            dbLogger.log('All stores cleared.');

            // 2. Add new data from backup
            dbLogger.log('Adding new data from backup...');
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
            dbLogger.log('Finished queueing restore operations.');
            
        } catch (e) {
            dbLogger.error("Error queueing operations for atomic restore:", e);
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
    dbLogger.log(`Attempting to delete database: ${DB_NAME}`);
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onerror = (event) => {
      dbLogger.error('Error deleting database.', (event.target as IDBOpenDBRequest).error);
      reject(new Error('Error deleting database.'));
    };

    deleteRequest.onsuccess = () => {
      dbLogger.log('Database deleted successfully.');
      resolve();
    };
    
    deleteRequest.onblocked = () => {
        dbLogger.error('Database deletion blocked. Please close other tabs of this app and try again.');
        reject(new Error('Deletion blocked. Please close other tabs of this app.'));
    };
  });
}