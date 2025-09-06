
import { Deck, Folder, DeckSeries, ReviewLog, SessionState, AIMessage } from '../types';
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

function initDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = (event) => {
        console.error('IndexedDB open request blocked. Please close other tabs with this app open.', event);
        reject(new Error('Database upgrade is required, but it is blocked by another open tab of this application. Please close all other tabs and reload.'));
    };

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      dbPromise = null;
      reject(new Error(`IndexedDB error: ${request.error?.message || 'Unknown error'}`));
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
        console.warn('Database connection closed.');
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      if (!transaction) {
          console.error("Upgrade transaction is not available.");
          return;
      }

      switch (event.oldVersion) {
          case 0:
              db.createObjectStore(DECK_STORE_NAME, { keyPath: 'id' });
              db.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id' });
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
                  const reviewStore = db.createObjectStore(REVIEW_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                  reviewStore.createIndex('timestamp', 'timestamp', { unique: false });
              }
          case 5:
              const reviewStoreV5 = transaction.objectStore(REVIEW_STORE_NAME);
              if (!reviewStoreV5.indexNames.contains('deckId')) {
                  reviewStoreV5.createIndex('deckId', 'deckId', { unique: false });
              }
          case 6:
              if (!db.objectStoreNames.contains(AI_CHAT_STORE_NAME)) {
                  db.createObjectStore(AI_CHAT_STORE_NAME, { keyPath: 'id' });
              }
          case 7:
              if (!db.objectStoreNames.contains(SERIES_PROGRESS_STORE_NAME)) {
                  db.createObjectStore(SERIES_PROGRESS_STORE_NAME, { keyPath: 'id' });
              }
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

export async function factoryReset(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }

  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onerror = (event) => {
      console.error('Error deleting database.', event);
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