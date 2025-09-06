
import * as db from './db';
import { parseAndValidateBackupFile } from './importService';
import { Deck, Folder, DeckSeries, ReviewLog, SessionState, FullBackupData, AIMessage } from '../types';

const BASE_URL = 'https://www.greenyogafestival.org/backup-api/api/v1';
const APP_ID = 'cogniflow-data';
const SYNC_FILENAME = 'cogniflow-data.json';
const AI_CHAT_FILENAME = 'cogniflow-ai-chat.json';

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

    // When sending FormData, let the browser set the Content-Type header automatically.
    // Manually setting it will break the multipart boundary.
    if (options.body instanceof FormData) {
        headers.delete('Content-Type');
    }

    const finalOptions: RequestInit = {
        ...options,
        headers,
    };

    const response = await fetch(url, finalOptions);

    // Allow callers to handle specific non-ok statuses gracefully, like 404.
    if (!response.ok && ![304, 404].includes(response.status)) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: `HTTP error! status: ${response.status}` };
        }
        console.error("API request failed:", errorData);
        const errorMessage = errorData?.error || errorData?.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        throw error;
    }

    return response;
}

export async function syncDataToServer(): Promise<{ timestamp: string, etag: string }> {
    const { decks, folders, deckSeries, reviews, sessions, seriesProgress } = await db.getAllDataForBackup();
    
    const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
    const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
    
    const backupData: ServerSyncData = {
        version: 6,
        decks,
        folders,
        deckSeries,
        reviews,
        sessions,
        seriesProgress,
        aiOptions,
    };

    const body = JSON.stringify(backupData);
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    const etag = getLastSyncEtag();
    if (etag) {
        headers['If-Match'] = etag;
    }
    
    // This is a write operation, so we check for ok status directly.
    const rawResponse = await fetch(`${BASE_URL}/apps/${APP_ID}/backups/${SYNC_FILENAME}`, {
        method: 'PUT',
        headers: { ...headers, 'X-API-Key': getApiKey() },
        body
    });

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
    return { timestamp: responseData.modified, etag: newEtag || '' };
}

export async function syncDataFromServer(): Promise<ServerSyncData> {
    const response = await request(`apps/${APP_ID}/backups/${SYNC_FILENAME}`);
    if(response.status === 404) {
      throw new Error("No sync file found on the server.");
    }
    const etag = response.headers.get('ETag');
    if (etag) {
        setLastSyncEtag(etag);
    }
    const jsonString = await response.text();
    return parseAndValidateBackupFile(jsonString) as ServerSyncData;
}


export async function getSyncDataMetadata(): Promise<{ metadata: BackupFileMetadata | null; isNotModified: boolean }> {
    const headers: HeadersInit = {};
    const etag = getLastSyncEtag();
    if (etag) {
        headers['If-None-Match'] = etag;
    }
    
    const response = await request(`apps/${APP_ID}/backups/${SYNC_FILENAME}/meta`, { headers });

    if (response.status === 304 || response.status === 404) {
        return { metadata: null, isNotModified: true };
    }
    
    const metadata = await response.json();
    return { metadata, isNotModified: false };
}

export async function syncAIChatHistoryToServer(): Promise<void> {
    const history = await db.getAIChatHistory();
    const body = JSON.stringify({ version: 1, history: history || [] });

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    
    let serverFileExists = false;
    const metaResponse = await request(`apps/${APP_ID}/backups/${AI_CHAT_FILENAME}/meta`);
    if (metaResponse.status !== 404) {
      serverFileExists = true;
    }
    
    const etag = getAiChatEtag();
    if (serverFileExists && etag) {
        headers['If-Match'] = etag;
    }
    
    // This is a write operation, so we check for ok status directly.
    const rawResponse = await fetch(`${BASE_URL}/apps/${APP_ID}/backups/${AI_CHAT_FILENAME}`, {
        method: 'PUT',
        headers: { ...headers, 'X-API-Key': getApiKey() },
        body
    });

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
}

export async function syncAIChatHistoryFromServer(): Promise<AIMessage[]> {
    const response = await request(`apps/${APP_ID}/backups/${AI_CHAT_FILENAME}`);
    if (response.status === 404) {
        return []; // File not found is not an error for chat history, just means it's empty.
    }
    const etag = response.headers.get('ETag');
    if (etag) setAiChatEtag(etag);
    const data = await response.json();
    return data.history || [];
}

export async function getAIChatMetadata(): Promise<{ metadata: BackupFileMetadata | null; isNotModified: boolean }> {
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
    const response = await request(`apps/${APP_ID}/backups/list`);
    const data = await response.json();
    return data.backups || [];
}

export async function createServerBackup(): Promise<CreateBackupResponse> {
    const { decks, folders, deckSeries, reviews, sessions, seriesProgress } = await db.getAllDataForBackup();
    
    const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
    const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
    
    const backupData: ServerSyncData = {
        version: 6,
        decks,
        folders,
        deckSeries,
        reviews,
        sessions,
        seriesProgress,
        aiOptions,
    };
    const jsonString = JSON.stringify(backupData);

    const fileBlob = new Blob([jsonString], { type: 'application/json' });

    const formData = new FormData();
    // The API expects a 'file' part. The filename here is not critical as the API generates its own timestamped filename.
    formData.append('file', fileBlob, 'backup-upload.json');

    const response = await request(`apps/${APP_ID}/backups`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type header here, fetch does it automatically for FormData
    });
    return await response.json();
}

export async function restoreFromServerBackup(filename: string): Promise<{ message: string }> {
    const response = await request(`apps/${APP_ID}/backups/${filename}/restore`, {
        method: 'POST',
    });
    return await response.json();
}

export async function deleteServerBackup(filename: string): Promise<void> {
    await request(`apps/${APP_ID}/backups/${filename}`, {
        method: 'DELETE',
    });
}
