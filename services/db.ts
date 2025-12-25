// FIX: Corrected import path for types
import { Deck, Folder, DeckSeries, ReviewLog, SessionState, AIMessage, FullBackupData, AppSettings, DeckLearningProgress } from '../types';
import { broadcastDataChange } from './syncService.ts';
import { getStockholmFilenameTimestamp } from './time.ts';

const DB_NAME = 'CogniFlowDB';
const DB_VERSION = 9; // Incremented version
const DECK_STORE_NAME = 'decks';
const FOLDER_STORE_NAME = 'folders';
const SERIES_STORE_NAME = 'deckSeries';
const SESSION_STORE_NAME = 'sessions';
const REVIEW_STORE_NAME = 'reviews';
const AI_CHAT_STORE_NAME = 'ai_chat';
const SERIES_PROGRESS_STORE_NAME = 'seriesProgress';
const LEARNING_PROGRESS_STORE_NAME = 'learningProgress';

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
    // Use global indexedDB to be compatible with both Window and Worker scopes
    const idb = typeof indexedDB !== 'undefined' ? indexedDB : (typeof window !== 'undefined' ? window.indexedDB : undefined);

    if (!idb) {
        const errorMsg = "IndexedDB is not supported in this environment.";
        dbLogger.warn(`${errorMsg}`);
        return reject(new Error(errorMsg));
    }
      
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onblocked = (event) => {
        const errorMsg = 'Database upgrade is required, but it is blocked by another open tab. Please close other tabs and reload.';
        dbLogger.warn('IndexedDB open request blocked.', event);
        reject(new Error(errorMsg));
    };

    request.onerror = (event) => {
      // Prevent the browser from logging its own error to the console
      if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
      }

      // Log as a warning since we have a localStorage fallback
      const error = request.error;
      const errorMessage = error ? error.message : 'Unknown error';
      dbLogger.warn(`IndexedDB failed to open: ${errorMessage}. Falling back to localStorage.`);
      
      // Nullify the promise so subsequent calls can retry if necessary, 
      // although storage.ts will usually switch permanently to localStorage for the session.
      dbPromise = null;
      
      reject(new Error(`Could not open the database: ${errorMessage}`));
    };

    request.onsuccess = () => {
      const db = request.result;
      
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        console.warn('Database version changed in another tab. Closing connection.');
      };

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
      
      switch(event.oldVersion) {
        case 0:
            if (!db.objectStoreNames.contains(DECK_STORE_NAME)) {
                db.createObjectStore(DECK_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(FOLDER_STORE_NAME)) {
                db.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id' });
            }
        case 1:
        case 2:
            if (!db.objectStoreNames.contains(SERIES_STORE_NAME)) {
                db.createObjectStore(SERIES_STORE_NAME, { keyPath: 'id' });
            }
        case 3:
            if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
                db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'id' });
            }
        case 4:
            if (!db.objectStoreNames.contains(REVIEW_STORE_NAME)) {
                const reviewStore = db.createObjectStore(REVIEW_STORE_NAME, { autoIncrement: true });
                reviewStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        case 5:
            const store = transaction.objectStore(REVIEW_STORE_NAME);
            if (!store.indexNames.contains('deckId')) {
                store.createIndex('deckId', 'deckId', { unique: false });
            }
        case 6:
            if (!db.objectStoreNames.contains(AI_CHAT_STORE_NAME)) {
                db.createObjectStore(AI_CHAT_STORE_NAME, { keyPath: 'id' });
            }
        case 7:
            if (!db.objectStoreNames.contains(SERIES_PROGRESS_STORE_NAME)) {
                db.createObjectStore(SERIES_PROGRESS_STORE_NAME, { keyPath: 'id' });
            }
        case 8:
            if (!db.objectStoreNames.contains(LEARNING_PROGRESS_STORE_NAME)) {
                db.createObjectStore(LEARNING_PROGRESS_STORE_NAME, { keyPath: 'deckId' });
            }
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

// Learning Progress Functions
export async function saveLearningProgress(progress: DeckLearningProgress): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(LEARNING_PROGRESS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(LEARNING_PROGRESS_STORE_NAME);
        const request = store.put(progress);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            dbLogger.error('Failed to save learning progress.', request.error);
            reject(new Error('Failed to save learning progress.'));
        }
    });
}

export async function getAllLearningProgress(): Promise<Record<string, DeckLearningProgress>> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(LEARNING_PROGRESS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(LEARNING_PROGRESS_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const result: Record<string, DeckLearningProgress> = {};
            const items = Array.isArray(request.result) ? request.result : [];
            (items as DeckLearningProgress[]).forEach(item => {
                result[item.deckId] = item;
            });
            resolve(result);
        };
        request.onerror = () => {
            dbLogger.error('Failed to get learning progress.', request.error);
            reject(new Error('Failed to get learning progress.'));
        }
    });
}

export async function bulkAddLearningProgress(progress: Record<string, DeckLearningProgress>): Promise<void> {
    if (Object.keys(progress).length === 0) return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(LEARNING_PROGRESS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(LEARNING_PROGRESS_STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            dbLogger.error('Transaction error adding learning progress.', transaction.error);
            reject(new Error('Transaction error adding learning progress.'));
        }
        Object.values(progress).forEach((item) => {
            store.put(item);
        });
    });
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
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const storeNames = [
        DECK_STORE_NAME, FOLDER_STORE_NAME, SERIES_STORE_NAME, 
        REVIEW_STORE_NAME, SESSION_STORE_NAME, SERIES_PROGRESS_STORE_NAME,
        LEARNING_PROGRESS_STORE_NAME
    ];
    const transaction = db.transaction(storeNames, 'readonly');
    
    const requests = {
      decks: transaction.objectStore(DECK_STORE_NAME).getAll(),
      folders: transaction.objectStore(FOLDER_STORE_NAME).getAll(),
      deckSeries: transaction.objectStore(SERIES_STORE_NAME).getAll(),
      reviews: transaction.objectStore(REVIEW_STORE_NAME).getAll(),
      sessions: transaction.objectStore(SESSION_STORE_NAME).getAll(),
      seriesProgress: transaction.objectStore(SERIES_PROGRESS_STORE_NAME).getAll(),
      learningProgress: transaction.objectStore(LEARNING_PROGRESS_STORE_NAME).getAll(),
    };
    
    transaction.oncomplete = () => {
      const progressResult: Record<string, string[]> = {};
      const progressItems = Array.isArray(requests.seriesProgress.result) ? requests.seriesProgress.result : [];
      (progressItems as { id: string, completedDeckIds: string[] }[]).forEach(item => {
          progressResult[item.id] = item.completedDeckIds;
      });

      const learningResult: Record<string, DeckLearningProgress> = {};
      const learningItems = Array.isArray(requests.learningProgress.result) ? requests.learningProgress.result : [];
      (learningItems as DeckLearningProgress[]).forEach(item => {
          learningResult[item.deckId] = item;
      });

      resolve({
        decks: Array.isArray(requests.decks.result) ? requests.decks.result as Deck[] : [],
        folders: Array.isArray(requests.folders.result) ? requests.folders.result as Folder[] : [],
        deckSeries: Array.isArray(requests.deckSeries.result) ? requests.deckSeries.result as DeckSeries[] : [],
        reviews: Array.isArray(requests.reviews.result) ? requests.reviews.result as ReviewLog[] : [],
        sessions: Array.isArray(requests.sessions.result) ? requests.sessions.result as SessionState[] : [],
        seriesProgress: progressResult,
        learningProgress: learningResult,
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
                if (deckIdSet.has(String(cursor.value.deckId))) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            dbLogger.error("Transaction error deleting reviews for decks", transaction.error);
            reject(new Error("Failed to delete review logs."));
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
    // Only available in window scope
    if (typeof window === 'undefined') return null;

    const { decks, folders, deckSeries, reviews, sessions, seriesProgress, learningProgress } = await getAllDataForBackup();
    
    if (decks.length === 0 && folders.length === 0 && deckSeries.length === 0) {
        throw new Error("There is no data to export.");
    }

    const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
    const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
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

    Object.entries(lsKeys).forEach(([key, lsKey]) => {
        const value = localStorage.getItem(lsKey);
        if (value !== null) {
            try {
                if (['disableAnimations', 'hapticsEnabled', 'aiFeaturesEnabled', 'veoEnabled', 'groundedImagesEnabled', 'searchAuditsEnabled', 'backupEnabled', 'syncOnCellular', 'notificationsEnabled'].includes(key)) {
                    (settings as any)[key] = JSON.parse(value);
                } else if (['leechThreshold'].includes(key)) {
                    (settings as any)[key] = Number(value);
                } else {
                    (settings as any)[key] = value;
                }
            } catch (e) {
                (settings as any)[key] = value;
            }
        }
    });

    const exportData: FullBackupData = {
        version: 9,
        decks,
        folders,
        deckSeries,
        reviews,
        sessions,
        aiChatHistory,
        seriesProgress,
        learningProgress,
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
        dbLogger.log(`Starting atomic restore.`);
        
        const storeNames = [
            DECK_STORE_NAME, FOLDER_STORE_NAME, SERIES_STORE_NAME, 
            REVIEW_STORE_NAME, SESSION_STORE_NAME, AI_CHAT_STORE_NAME, 
            SERIES_PROGRESS_STORE_NAME, LEARNING_PROGRESS_STORE_NAME
        ];
        
        const transaction = db.transaction(storeNames, 'readwrite');
        
        transaction.oncomplete = () => {
            broadcastDataChange();
            resolve();
        };
        transaction.onerror = () => {
            dbLogger.error("Atomic restore transaction failed:", transaction.error);
            reject(new Error('Database transaction failed during restore.'));
        };
        
        try {
            transaction.objectStore(DECK_STORE_NAME).clear();
            transaction.objectStore(FOLDER_STORE_NAME).clear();
            transaction.objectStore(SERIES_STORE_NAME).clear();
            transaction.objectStore(REVIEW_STORE_NAME).clear();
            transaction.objectStore(SESSION_STORE_NAME).clear();
            transaction.objectStore(AI_CHAT_STORE_NAME).clear();
            transaction.objectStore(SERIES_PROGRESS_STORE_NAME).clear();
            transaction.objectStore(LEARNING_PROGRESS_STORE_NAME).clear();

            (data.decks || []).forEach(deck => transaction.objectStore(DECK_STORE_NAME).put(deck));
            (data.folders || []).forEach(folder => transaction.objectStore(FOLDER_STORE_NAME).put(folder));
            (data.deckSeries || []).forEach(series => transaction.objectStore(SERIES_STORE_NAME).put(series));
            (data.reviews || []).forEach(log => {
                const { id, ...logWithoutId } = log;
                transaction.objectStore(REVIEW_STORE_NAME).add(logWithoutId);
            });
            (data.sessions || []).forEach(session => transaction.objectStore(SESSION_STORE_NAME).put(session));
            if (data.aiChatHistory && data.aiChatHistory.length > 0) {
                 transaction.objectStore(AI_CHAT_STORE_NAME).put({ id: 'global_history', history: data.aiChatHistory });
            }
            Object.entries(data.seriesProgress || {}).forEach(([seriesId, completedDeckIds]) => {
                transaction.objectStore(SERIES_PROGRESS_STORE_NAME).put({ id: seriesId, completedDeckIds });
            });
            Object.values(data.learningProgress || {}).forEach((item) => {
                transaction.objectStore(LEARNING_PROGRESS_STORE_NAME).put(item);
            });
            
        } catch (e) {
            transaction.abort();
            reject(e);
        }
    });
}

export async function factoryReset(): Promise<void> {
  if (dbPromise) {
    try {
        const db = await dbPromise;
        db.close();
    } catch (e) {}
    dbPromise = null;
  }

  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onerror = () => reject(new Error('Error deleting database.'));
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onblocked = () => reject(new Error('Deletion blocked. Please close other tabs.'));
  });
}
