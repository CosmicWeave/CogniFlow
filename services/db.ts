
import { Deck, Folder, DeckSeries } from '../types';
import { broadcastDataChange } from './syncService';
import { getStockholmFilenameTimestamp } from './time';

const DB_NAME = 'CogniFlowDB';
const DB_VERSION = 3; // Incremented version
const DECK_STORE_NAME = 'decks';
const FOLDER_STORE_NAME = 'folders';
const SERIES_STORE_NAME = 'deckSeries';

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
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(DECK_STORE_NAME)) {
        dbInstance.createObjectStore(DECK_STORE_NAME, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(FOLDER_STORE_NAME)) {
        dbInstance.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id' });
      }
      if (event.oldVersion < 3 && !dbInstance.objectStoreNames.contains(SERIES_STORE_NAME)) {
        dbInstance.createObjectStore(SERIES_STORE_NAME, { keyPath: 'id' });
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


export async function exportAllData(): Promise<string | null> {
    const [decks, folders, deckSeries] = await Promise.all([
        getAllDecks(),
        getAllFolders(),
        getAllDeckSeries()
    ]);
    
    if (decks.length === 0 && folders.length === 0 && deckSeries.length === 0) {
        throw new Error("There is no data to export.");
    }

    const exportData = {
        version: 3,
        decks,
        folders,
        deckSeries
    };

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