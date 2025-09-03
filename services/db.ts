
import { Deck, Folder, DeckSeries, ReviewLog } from '../types';
import { broadcastDataChange } from './syncService';
import { getStockholmFilenameTimestamp } from './time';

const DB_NAME = 'CogniFlowDB';
const DB_VERSION = 6; // Incremented version
const DECK_STORE_NAME = 'decks';
const FOLDER_STORE_NAME = 'folders';
const SERIES_STORE_NAME = 'deckSeries';
const SESSION_STORE_NAME = 'sessions';
const REVIEW_STORE_NAME = 'reviews';

let dbPromise: Promise<IDBDatabase> | null = null;

function initDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = (event) => {
        console.error('IndexedDB open request blocked. Please close other tabs with this app open.', event);
        // This is a critical error. The app can't proceed. We reject the promise
        // so the app can display an error state instead of hanging.
        reject(new Error('Database upgrade is required, but it is blocked by another open tab of this application. Please close all other tabs and reload.'));
    };

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      dbPromise = null; // Clear promise on error
      reject(new Error(`IndexedDB error: ${request.error?.message || 'Unknown error'}`));
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        // Connection was closed. Nullify the promise so a new one can be created.
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

      // Using a switch statement with fall-through is the most robust way to handle migrations.
      switch (event.oldVersion) {
          case 0:
              // Migrating from no database (v0)
              db.createObjectStore(DECK_STORE_NAME, { keyPath: 'id' });
              db.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id' });
              // fall-through to next version migration
          case 1:
          case 2:
              // Migrating from v2 to v3
              if (!db.objectStoreNames.contains(SERIES_STORE_NAME)) {
                  db.createObjectStore(SERIES_STORE_NAME, { keyPath: 'id' });
              }
              // fall-through
          case 3:
              // Migrating from v3 to v4
              if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
                  db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'id' });
              }
              // fall-through
          case 4:
              // Migrating from v4 to v5
              if (!db.objectStoreNames.contains(REVIEW_STORE_NAME)) {
                  const reviewStore = db.createObjectStore(REVIEW_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                  reviewStore.createIndex('timestamp', 'timestamp', { unique: false });
              }
              // fall-through
          case 5:
              // Migrating from v5 to v6
              const reviewStore = transaction.objectStore(REVIEW_STORE_NAME);
              if (!reviewStore.indexNames.contains('deckId')) {
                  reviewStore.createIndex('deckId', 'deckId', { unique: false });
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

    request.onerror = () => reject('Error fetching decks');
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
        reject('Transaction error adding/updating decks');
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
  await addDecks(decks); // `addDecks` uses `put`, which works for updates.
}


export async function deleteDeck(deckId: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DECK_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => {
        broadcastDataChange();
        resolve();
    };
    transaction.onerror = () => reject('Transaction error deleting deck');

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
    transaction.onerror = () => reject('Transaction error updating deck');
    
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

    request.onerror = () => reject('Error fetching folders');
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
    transaction.onerror = () => reject('Transaction error adding folder');

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
        reject('Transaction error adding/updating folders');
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
    transaction.onerror = () => reject('Transaction error updating folder');

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
    transaction.onerror = () => reject('Transaction error deleting folder');

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

        request.onerror = () => reject('Error fetching deck series');
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
        transaction.onerror = () => reject('Transaction error adding deck series');

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
        transaction.onerror = () => reject('Error updating deck series');

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
        transaction.onerror = () => reject('Error deleting deck series');
        
        const store = transaction.objectStore(SERIES_STORE_NAME);
        store.delete(seriesId);
    });
}

// Session State Functions
export async function saveSessionState(id: string, state: { reviewQueue: any[], currentIndex: number, readInfoCardIds?: string[], unlockedQuestionIds?: string[] }): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject('Transaction error saving session state');
    
    const store = transaction.objectStore(SESSION_STORE_NAME);
    store.put({ id, ...state });
  });
}

export async function getSessionState(id: string): Promise<{ reviewQueue: any[], currentIndex: number, readInfoCardIds?: string[], unlockedQuestionIds?: string[] } | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SESSION_STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject('Error fetching session state');
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteSessionState(id: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject('Transaction error deleting session state');

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

    request.onerror = () => reject('Error fetching session keys');
    request.onsuccess = () => resolve(request.result as string[]);
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
      reject('Transaction error adding review log');
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

    request.onerror = () => reject('Error fetching review logs');
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getReviewsForDeck(deckId: string): Promise<ReviewLog[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REVIEW_STORE_NAME, 'readonly');
    const store = transaction.objectStore(REVIEW_STORE_NAME);
    const index = store.index('deckId');
    const request = index.getAll(deckId);

    request.onerror = () => reject('Error fetching reviews for deck');
    request.onsuccess = () => resolve(request.result);
  });
}


export async function exportAllData(): Promise<string | null> {
    const [decks, folders, deckSeries] = await Promise.all([
        getAllDecks(),
        getAllFolders(),
        getAllDeckSeries()
    ]);
    
    if (decks.length === 0 && folders.length === 0 && deckSeries.length === 0) {
        throw new Error("There is no data to export.");
    }

    const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
    const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;

    const exportData: any = {
        version: 4,
        decks,
        folders,
        deckSeries
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
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return a.download;
}

export async function factoryReset(): Promise<void> {
  // If a DB connection is active or being initialized, we must close it first.
  if (dbPromise) {
    const db = await dbPromise;
    db.close(); // This triggers the `onclose` event handler in `initDB` which will nullify `dbPromise`.
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
