
// services/backupService.ts
import * as db from './db';
import { parseAndValidateBackupFile } from './importService';
import { Deck, Folder, GoogleDriveFile, DeckSeries, DeckType, FullBackupData, AIMessage, FlashcardDeck, Reviewable, QuizDeck, LearningDeck } from '../types';
import { getStockholmFilenameTimestamp } from './time';
import JSZip from 'jszip';
import { encryptData, decryptData } from './encryptionService';
import { useStore } from '../store/store';

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
    
    // --- Retry Logic ---
    const MAX_RETRIES = 3;
    const INITIAL_DELAY = 1000; // 1 second

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await window.fetch(url, finalOptions);
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

            return response; // Success, exit the loop
        } catch (error) {
            // Only retry on network-like errors
            if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
                if (attempt < MAX_RETRIES) {
                    const delay = INITIAL_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                    console.warn(`[BackupService] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue; // Go to the next attempt
                } else {
                    // Last attempt failed, throw the helpful error
                    console.error("[BackupService] All network attempts failed. This may be a network or CORS issue.", error);
                    const helpfulError = new Error("Network error: Could not connect to the backup server. Please check your internet connection and any browser extensions (like ad-blockers) that may be interfering.");
                    (helpfulError as any).isNetworkError = true;
                    throw helpfulError;
                }
            }
            // Re-throw other errors immediately
            throw error;
        }
    }
    // This part should be unreachable, but as a fallback:
    throw new Error("An unexpected error occurred in the request function.");
}

/**
 * Compresses the backup data into a zip file and returns a JSON wrapper with the base64 content.
 */
async function compressData(data: FullBackupData): Promise<any> {
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(data));
    const base64 = await zip.generateAsync({ 
        type: "base64", 
        compression: "DEFLATE", 
        compressionOptions: { level: 6 } 
    });
    
    return {
        dataType: 'cogniflow-compressed-backup-v1',
        content: base64
    };
}

export async function syncDataToServer(dataToSync?: FullBackupData, force = false): Promise<{ timestamp: string, etag: string }> {
    console.log('[BackupService] Starting syncDataToServer...');
    let backupData: FullBackupData;

    if (dataToSync) {
        backupData = dataToSync;
    } else {
        const { decks, folders, deckSeries, reviews, sessions, seriesProgress, learningProgress } = await db.getAllDataForBackup();
        const aiChatHistory = await db.getAIChatHistory();
        const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
        const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
        
        // Pick up active tasks from store
        const aiTasks = useStore.getState().aiGenerationStatus.queue || [];

        backupData = {
            version: 9, // Incremented due to learningProgress
            decks,
            folders,
            deckSeries,
            reviews,
            sessions,
            seriesProgress,
            learningProgress,
            aiOptions,
            aiChatHistory,
            aiTasks,
        };
    }
    
    // Compress payload
    const compressedPayload = await compressData(backupData);
    let body = JSON.stringify(compressedPayload);
    
    // Encrypt if password exists
    const password = localStorage.getItem('cogniflow-encryptionPassword');
    if (password) {
       const encrypted = await encryptData(body, password);
       body = JSON.stringify({
           dataType: 'cogniflow-encrypted-v1',
           content: encrypted
       });
       console.log('[BackupService] Payload encrypted.');
    }
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    const etag = getLastSyncEtag();
    if (etag && !force) {
        headers['If-Match'] = etag;
    }
    
    console.log(`[BackupService] PUT ${SYNC_FILENAME}`, { headers, bodySize: body.length });
    
    const rawResponse = await request(`apps/${APP_ID}/backups/${SYNC_FILENAME}`, {
        method: 'PUT',
        headers,
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
    console.log('[BackupService] syncDataToServer successful:', responseData);
    return { timestamp: responseData.modified, etag: newEtag || '' };
}

export async function syncDataFromServer(): Promise<FullBackupData> {
    console.log('[BackupService] Starting syncDataFromServer...');
    const response = await request(`apps/${APP_ID}/backups/${SYNC_FILENAME}`);
    if(response.status === 404) {
      throw new Error("No sync file found on the server.");
    }
    const etag = response.headers.get('ETag');
    if (etag) {
        setLastSyncEtag(etag);
    }
    let jsonString = await response.text();

    // Check for encryption wrapper
    try {
        const potentialEncrypted = JSON.parse(jsonString);
        if (potentialEncrypted && potentialEncrypted.dataType === 'cogniflow-encrypted-v1') {
             const password = localStorage.getItem('cogniflow-encryptionPassword');
             if (!password) throw new Error("Sync data is encrypted but no password is set on this device. Please set it in Settings.");
             jsonString = await decryptData(potentialEncrypted.content, password);
             console.log('[BackupService] Payload decrypted.');
        }
    } catch (e) {
        // If decryption failed explicitly, rethrow
        if (e instanceof Error && (e.message.includes("Decryption failed") || e.message.includes("password is set"))) {
             throw e;
        }
        // If JSON parse failed or other error, assume it's legacy plaintext or compressed data handled below
    }

    // parseAndValidateBackupFile handles decompression automatically
    const parsedData = await parseAndValidateBackupFile(jsonString);
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
    const history = await db.getAIChatHistory();
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
    
    const rawResponse = await request(`apps/${APP_ID}/backups/${AI_CHAT_FILENAME}`, {
        method: 'PUT',
        headers,
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
    const { decks, folders, deckSeries, reviews, sessions, seriesProgress, learningProgress } = await db.getAllDataForBackup();
    
    const aiOptionsString = localStorage.getItem('cogniflow-ai-options');
    const aiOptions = aiOptionsString ? JSON.parse(aiOptionsString) : undefined;
    const aiChatHistory = await db.getAIChatHistory();
    const aiTasks = useStore.getState().aiGenerationStatus.queue || [];

    const backupData: FullBackupData = {
        version: 9, // Incremented
        decks,
        folders,
        deckSeries,
        reviews,
        sessions,
        seriesProgress,
        learningProgress,
        aiOptions,
        aiChatHistory,
        aiTasks
    };

    // Use compression for manual backups as well
    const compressedPayload = await compressData(backupData);
    let body = JSON.stringify(compressedPayload);

    // Encrypt if password exists
    const password = localStorage.getItem('cogniflow-encryptionPassword');
    if (password) {
       const encrypted = await encryptData(body, password);
       body = JSON.stringify({
           dataType: 'cogniflow-encrypted-v1',
           content: encrypted
       });
       console.log('[BackupService] Backup payload encrypted.');
    }
    
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
