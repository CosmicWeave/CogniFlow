
import * as db from './db';
import { parseAndValidateBackupFile } from './importService';
import { Deck, Folder, DeckSeries, ReviewLog, SessionState, FullBackupData, AIMessage } from '../types';
import { getStockholmFilenameTimestamp } from './time';

// FIX: Create a mutable copy of the db module's functions to allow mocking in tests.
const db_internal = { ...db };

const BASE_URL = 'https://www.greenyogafestival.org/backup-api/api/v1';
const APP_ID = 'cogniflow-data';
const SYNC_FILENAME = 'cogniflow-data.json';
const AI_CHAT_FILENAME = 'cogniflow-ai-chat.json';
const MOCK_API_KEY = 'test-api-key';


const getApiKey = () => localStorage.getItem('cogniflow-backupApiKey') || 'qRt+gU/57GHKhxTZeRnRi+dfT274iSkKKq2UnTr9Bxs=';
const setLastSyncEtag = (etag: string) => localStorage.setItem('cogniflow-lastSyncEtag', etag);
const getLastSyncEtag = () => localStorage.getItem('cogniflow-lastSyncEtag');
const setAiChatEtag = (etag: string) => localStorage.setItem('cogniflow-aiChat-lastSyncEtag', etag);
const getAiChatEtag = () => localStorage.getItem('cogniflow-aiChat-lastSyncEtag');


export interface BackupFileMetadata {
    filename: string;
    modified: string;
    size: number;
    etag: string;
    download_url: string;
}

export interface CreateBackupResponse {
    message: string;
    filename: string;
}

export type ServerSyncData = Omit<FullBackupData, 'aiChatHistory'>;


async function request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${BASE_URL}/${endpoint}`;
    const apiKey = getApiKey();

    const headers = new Headers(options.headers || {});
    headers.set('X-API-Key', apiKey);

    if (options.body instanceof FormData) {
        headers.delete('Content-Type');
    }

    const finalOptions: RequestInit = {
        ...options,
        headers,
    };
    
    console.log(`[BackupService] Requesting: ${options.method || 'GET'} ${url}`, { headers: Object.fromEntries(headers.entries()) });

    const response = await fetch(url, finalOptions);
    console.log(`[BackupService] Response from ${options.method || 'GET'} ${url}: ${response.status}`);

    if (!response.ok && ![304, 404].includes(response.status)) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: `HTTP error! status: ${response.status}` };
        }
        console.error("[BackupService] API request failed:", errorData);
        const errorMessage = errorData?.error || errorData?.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        throw error;
    }

    return response;
}

export async function syncDataToServer(dataToSync?: ServerSyncData, force = false): Promise<{ timestamp: string, etag: string }> {
    console.log('[BackupService] Starting syncDataToServer...');
    let backupData: ServerSyncData;

    if (dataToSync) {
        backupData = dataToSync;
    } else {
        const { decks, folders, deckSeries, reviews, sessions, seriesProgress } = await db_internal.getAllDataForBackup();
        const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
        const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
        backupData = {
            version: 6,
            decks,
            folders,
            deckSeries,
            reviews,
            sessions,
            seriesProgress,
            aiOptions,
        };
    }
    
    const body = JSON.stringify(backupData);
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    const etag = getLastSyncEtag();
    if (etag && !force) {
        headers['If-Match'] = etag;
    }
    
    console.log(`[BackupService] PUT ${SYNC_FILENAME}`, { headers, body: `(JSON body of size ${body.length})` });
    
    const rawResponse = await fetch(`${BASE_URL}/apps/${APP_ID}/backups/${SYNC_FILENAME}`, {
        method: 'PUT',
        headers: { ...headers, 'X-API-Key': getApiKey() },
        body
    });
    console.log(`[BackupService] syncDataToServer response status: ${rawResponse.status}`);

    if (!rawResponse.ok) {
        let errorData;
        try { errorData = await rawResponse.json(); } catch(e) { errorData = { error: `HTTP error! status: ${rawResponse.status}`}; }
        const errorMessage = errorData?.error || errorData?.message || `Request failed with status ${rawResponse.status}`;
        const error = new Error(errorMessage) as any;
        error.status = rawResponse.status;
        throw error;
    }
    
    const newEtag = rawResponse.headers.get('ETag');
    if (newEtag) {
        setLastSyncEtag(newEtag);
    }
    const responseData = await rawResponse.json();
    console.log('[BackupService] syncDataToServer successful:', responseData);
    return { timestamp: responseData.modified, etag: newEtag || '' };
}

export async function syncDataFromServer(): Promise<ServerSyncData> {
    console.log('[BackupService] Starting syncDataFromServer...');
    const response = await request(`apps/${APP_ID}/backups/${SYNC_FILENAME}`);
    if(response.status === 404) {
      throw new Error("No sync file found on the server.");
    }
    const etag = response.headers.get('ETag');
    if (etag) {
        setLastSyncEtag(etag);
    }
    const jsonString = await response.text();
    const parsedData = parseAndValidateBackupFile(jsonString) as ServerSyncData;
    console.log('[BackupService] syncDataFromServer successful.');
    return parsedData;
}


export async function getSyncDataMetadata(): Promise<{ metadata: BackupFileMetadata | null; isNotModified: boolean }> {
    console.log('[BackupService] Starting getSyncDataMetadata...');
    const headers: HeadersInit = {};
    const etag = getLastSyncEtag();
    if (etag) {
        headers['If-None-Match'] = etag;
    }
    
    const response = await request(`apps/${APP_ID}/backups/${SYNC_FILENAME}/meta`, { headers });

    if (response.status === 304 || response.status === 404) {
        console.log(`[BackupService] getSyncDataMetadata finished with status: ${response.status}`);
        return { metadata: null, isNotModified: response.status === 304 };
    }
    
    const metadata = await response.json();
    console.log('[BackupService] getSyncDataMetadata successful:', metadata);
    return { metadata, isNotModified: false };
}

export async function syncAIChatHistoryToServer(): Promise<void> {
    console.log('[BackupService] Starting syncAIChatHistoryToServer...');
    const history = await db_internal.getAIChatHistory();
    const body = JSON.stringify({ version: 1, history: history || [] });

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    
    let serverFileExists = false;
    try {
        const metaResponse = await request(`apps/${APP_ID}/backups/${AI_CHAT_FILENAME}/meta`);
        if (metaResponse.status !== 404) {
          serverFileExists = true;
        }
    } catch(e) {
        if ((e as any).status !== 404) throw e;
    }
    
    const etag = getAiChatEtag();
    if (serverFileExists && etag) {
        headers['If-Match'] = etag;
    }
    
    const rawResponse = await fetch(`${BASE_URL}/apps/${APP_ID}/backups/${AI_CHAT_FILENAME}`, {
        method: 'PUT',
        headers: { ...headers, 'X-API-Key': getApiKey() },
        body
    });
    console.log(`[BackupService] syncAIChatHistoryToServer response status: ${rawResponse.status}`);

    if (!rawResponse.ok) {
        let errorData;
        try { errorData = await rawResponse.json(); } catch(e) { errorData = { error: `HTTP error! status: ${rawResponse.status}`}; }
        const errorMessage = errorData?.error || errorData?.message || `Request failed with status ${rawResponse.status}`;
        const error = new Error(errorMessage) as any;
        error.status = rawResponse.status;
        throw error;
    }

    const newEtag = rawResponse.headers.get('ETag');
    if (newEtag) {
        setAiChatEtag(newEtag);
    }
     console.log('[BackupService] syncAIChatHistoryToServer successful.');
}

export async function syncAIChatHistoryFromServer(): Promise<AIMessage[]> {
    console.log('[BackupService] Starting syncAIChatHistoryFromServer...');
    const response = await request(`apps/${APP_ID}/backups/${AI_CHAT_FILENAME}`);
    if (response.status === 404) {
        throw response;
    }
    const etag = response.headers.get('ETag');
    if (etag) setAiChatEtag(etag);
    const data = await response.json();
    console.log('[BackupService] syncAIChatHistoryFromServer successful.');
    return data.history || [];
}

export async function getAIChatMetadata(): Promise<{ metadata: BackupFileMetadata | null; isNotModified: boolean }> {
    console.log('[BackupService] Starting getAIChatMetadata...');
    const headers: HeadersInit = {};
    const etag = getAiChatEtag();
    if (etag) headers['If-None-Match'] = etag;
    
    const response = await request(`apps/${APP_ID}/backups/${AI_CHAT_FILENAME}/meta`, { headers });
    
    if (response.status === 304 || response.status === 404) {
        return { metadata: null, isNotModified: true };
    }
    
    const metadata = await response.json();
    return { metadata, isNotModified: false };
}


export async function listServerBackups(): Promise<BackupFileMetadata[]> {
    console.log('[BackupService] Starting listServerBackups...');
    const response = await request(`apps/${APP_ID}/backups/list`);
    const data = await response.json();
    console.log(`[BackupService] Found ${data.backups?.length || 0} backups.`);
    return data.backups || [];
}

export async function createServerBackup(): Promise<CreateBackupResponse> {
    console.log('[BackupService] Starting createServerBackup...');
    const { decks, folders, deckSeries, reviews, sessions, seriesProgress } = await db_internal.getAllDataForBackup();
    
    const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
    const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
    const aiChatHistory = await db_internal.getAIChatHistory();

    const backupData: FullBackupData = {
        version: 6,
        decks,
        folders,
        deckSeries,
        reviews,
        sessions,
        seriesProgress,
        aiOptions,
        aiChatHistory
    };

    const body = JSON.stringify(backupData);
    const blob = new Blob([body], { type: 'application/json' });
    const filename = `backup-${getStockholmFilenameTimestamp()}.json`;

    const formData = new FormData();
    formData.append('file', blob, filename);

    const response = await request(`apps/${APP_ID}/backups`, {
        method: 'POST',
        body: formData,
    });
    const responseData = await response.json();
    console.log('[BackupService] createServerBackup successful:', responseData);
    return responseData;
}

export async function restoreFromServerBackup(filename: string): Promise<{ message: string }> {
    console.log(`[BackupService] Restoring live sync from manual backup: ${filename}...`);
    const response = await request(`apps/${APP_ID}/backups/${filename}/restore`, {
        method: 'POST',
    });
    const responseData = await response.json();
    console.log(`[BackupService] Restore from ${filename} successful:`, responseData);
    return responseData;
}

export async function deleteServerBackup(filename: string): Promise<void> {
    console.log(`[BackupService] Deleting manual backup: ${filename}...`);
    await request(`apps/${APP_ID}/backups/${filename}`, {
        method: 'DELETE',
    });
    console.log(`[BackupService] Deleted ${filename} successfully.`);
}

export async function runBackupServiceTests() {
  console.log('%c--- Running Backup Service Unit Tests ---', 'color: blue; font-weight: bold;');

  const originalFetch = window.fetch;
  const originalGetItem = localStorage.getItem;
  const originalSetItem = localStorage.setItem;
  const originalGetAllDataForBackup = db_internal.getAllDataForBackup;
  const originalGetAIChatHistory = db_internal.getAIChatHistory;

  let testCount = 0;
  let passedCount = 0;
  let currentEtag: string | null = 'initial-etag';
  const mockStorage: Record<string, string> = { 'cogniflow-backupApiKey': MOCK_API_KEY };

  const test = async (name: string, testFn: () => Promise<void>) => {
    testCount++;
    console.log(`\nRunning test: ${name}`);
    try {
      // Reset mocks before each test
      currentEtag = 'initial-etag';
      mockStorage['cogniflow-lastSyncEtag'] = currentEtag;
      await testFn();
      console.log(`%c✔ PASS: ${name}`, 'color: green;');
      passedCount++;
    } catch (error) {
      console.error(`%c❌ FAIL: ${name}`, 'color: red;');
      console.error(error);
    }
  };

  const assertEqual = (actual: any, expected: any, message: string) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(`${message}\nExpected: ${expectedStr}\nActual:   ${actualStr}`);
    }
  };
  
  const assert = (condition: boolean, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
  }

  const assertThrows = async (fn: () => Promise<any>, expectedErrorMessage: string, message: string) => {
    try {
      await fn();
      throw new Error(`Expected function to throw, but it did not. ${message}`);
    } catch (error: any) {
      if (!error.message.includes(expectedErrorMessage)) {
        throw new Error(`${message}\nExpected error message to include: "${expectedErrorMessage}"\nActual error message: "${error.message}"`);
      }
    }
  };

  const mockDbData = { decks: [{id: 'd1', name: 'Deck 1'}], folders: [], deckSeries: [], reviews: [], sessions: [], seriesProgress: {} };
  const mockAiHistory: AIMessage[] = [{id: 'm1', role: 'user', text: 'hello'}];
  
  localStorage.getItem = (key: string) => mockStorage[key] || null;
  localStorage.setItem = (key: string, value: string) => { mockStorage[key] = value; };
  db_internal.getAllDataForBackup = async () => Promise.resolve(mockDbData as any);
  db_internal.getAIChatHistory = async () => Promise.resolve(mockAiHistory);

  await test('syncDataToServer should succeed and update ETag', async () => {
    window.fetch = async (url, options) => {
      const headers = new Headers(options?.headers);
      assert(headers.get('If-Match') === 'initial-etag', 'If-Match header should be sent');
      return new Response(JSON.stringify({ modified: '2023-01-01T12:00:00Z' }), { status: 200, headers: { ETag: 'new-etag' } });
    };
    const result = await syncDataToServer();
    assertEqual(result.etag, 'new-etag', 'Should return the new ETag');
    assertEqual(getLastSyncEtag(), 'new-etag', 'Should store the new ETag in localStorage');
  });
  
  await test('syncDataToServer should use force option to ignore ETag', async () => {
    window.fetch = async (url, options) => {
      const headers = new Headers(options?.headers);
      assert(!headers.has('If-Match'), 'If-Match header should NOT be sent when force=true');
      return new Response(JSON.stringify({ modified: '2023-01-01T12:00:00Z' }), { status: 201, headers: { ETag: 'forced-etag' } });
    };
    await syncDataToServer(undefined, true);
    assertEqual(getLastSyncEtag(), 'forced-etag', 'ETag should be updated even on force sync');
  });

  await test('syncDataToServer should handle 412 Precondition Failed', async () => {
    window.fetch = async () => new Response(JSON.stringify({ error: 'ETag mismatch' }), { status: 412 });
    await assertThrows(() => syncDataToServer(), 'ETag mismatch', 'Should throw on 412 error');
  });
  
  await test('syncDataFromServer should succeed and parse data', async () => {
    const serverData = { ...mockDbData, version: 6 };
    window.fetch = async () => new Response(JSON.stringify(serverData), { status: 200, headers: { ETag: 'server-etag' } });
    const data = await syncDataFromServer();
    assertEqual(data.decks, mockDbData.decks, 'Parsed decks should match mock data');
    assertEqual(getLastSyncEtag(), 'server-etag', 'Should update ETag on successful fetch');
  });
  
  await test('syncDataFromServer should handle 404 Not Found', async () => {
    window.fetch = async () => new Response(null, { status: 404 });
    await assertThrows(() => syncDataFromServer(), 'No sync file found on the server', 'Should throw a specific message on 404');
  });
  
  await test('getSyncDataMetadata should send If-None-Match header', async () => {
    window.fetch = async (url, options) => {
      const headers = new Headers(options?.headers);
      assert(headers.get('If-None-Match') === 'initial-etag', 'If-None-Match header should be sent');
      return new Response(JSON.stringify({ filename: 'test.json' }), { status: 200 });
    };
    await getSyncDataMetadata();
  });

  await test('getSyncDataMetadata should handle 304 Not Modified', async () => {
    window.fetch = async () => new Response(null, { status: 304 });
    const { metadata, isNotModified } = await getSyncDataMetadata();
    assert(isNotModified, 'isNotModified should be true on 304');
    assertEqual(metadata, null, 'Metadata should be null on 304');
  });
  
  await test('createServerBackup should send multipart/form-data', async () => {
    window.fetch = async (url, options) => {
      assert(options?.body instanceof FormData, 'Body should be FormData');
      const formData = options.body as FormData;
      const file = formData.get('file') as File;
      assert(file.name.startsWith('backup-'), 'File should have correct name format');
      return new Response(JSON.stringify({ message: 'Backup successful', filename: file.name }), { status: 201 });
    };
    const response = await createServerBackup();
    assert(response.message === 'Backup successful', 'Success message should be returned');
  });

  console.log(`\n%c--- Test Summary ---`, 'color: blue; font-weight: bold;');
  console.log(`Total tests: ${testCount}`);
  console.log(`%cPassed: ${passedCount}`, 'color: green;');
  if (testCount > passedCount) {
    console.log(`%cFailed: ${testCount - passedCount}`, 'color: red;');
  }

  // Restore original functions
  window.fetch = originalFetch;
  localStorage.getItem = originalGetItem;
  localStorage.setItem = originalSetItem;
  db_internal.getAllDataForBackup = originalGetAllDataForBackup;
  db_internal.getAIChatHistory = originalGetAIChatHistory;
}

// Expose the test runner to the window object for easy access from the console.
(window as any).runBackupServiceTests = runBackupServiceTests;
