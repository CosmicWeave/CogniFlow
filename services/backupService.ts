import * as db from './db';
import { parseAndValidateBackupFile } from './importService';
import { Deck, Folder, DeckSeries } from '../types';

const BASE_URL = 'https://www.greenyogafestival.org/backup-api/api/v1';
const APP_ID = 'cogniflow-data';

const getApiKey = () => localStorage.getItem('cogniflow-backupApiKey') || 'qRt+gU/57GHKhxTZeRnRi+dfT274iSkKKq2UnTr9Bxs=';

export interface BackupMetadata {
    filename: string;
    modified: string;
    size: number;
    etag: string;
    download_url: string;
}

export interface RestoreData {
    decks: Deck[];
    folders: Folder[];
    deckSeries: DeckSeries[];
}


async function request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API Key is not configured for the backup service.');

    const url = `${BASE_URL}/apps/${APP_ID}${endpoint}`;
    const headers = {
        'X-API-Key': apiKey,
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    // A 304 response is a successful response in the context of conditional GETs
    if (!response.ok && response.status !== 304) {
        // Start with a good default error message.
        let errorMessage = `Backup API Error (${response.status}): ${response.statusText || 'An unknown error occurred'}`;
        try {
            // Try to parse a more specific message from the JSON body.
            const errorData = await response.json();
            // The API might use 'message' or 'error' property.
            const specificMessage = errorData.message || errorData.error;
            if (specificMessage && typeof specificMessage === 'string') {
                 errorMessage = `Backup API Error (${response.status}): ${specificMessage}`;
            }
        } catch (e) {
            // JSON parsing failed. The response body might be empty or not JSON.
            // The default errorMessage is sufficient in this case.
        }
        throw new Error(errorMessage);
    }
    return response;
}

export async function getLatestBackupMetadata(etag?: string): Promise<{ metadata: BackupMetadata | null; isNotModified: boolean }> {
    const options: RequestInit = {};
    if (etag) {
        options.headers = { 'If-None-Match': etag };
    }
    
    const response = await request(`/backups/latest`, options);
    
    if (response.status === 304) {
        return { metadata: null, isNotModified: true };
    }
    
    const metadata = await response.json();
    if (!metadata.download_url) {
        // To be consistent with how the app handles "no backup", we'll throw an error
        // that includes '404', which the UI logic specifically checks for.
        const error = new Error("404: Backup metadata from server is missing a download_url.");
        if (response.status === 404) (error as any).status = 404;
        throw error;
    }
    return { metadata, isNotModified: false };
}

export async function downloadBackup(existingMetadata?: BackupMetadata): Promise<RestoreData> {
    const metadataResult = existingMetadata ? { metadata: existingMetadata, isNotModified: false } : await getLatestBackupMetadata();
    
    if (!metadataResult.metadata) {
         throw new Error("Could not retrieve backup metadata to download the file.");
    }
    const metadata = metadataResult.metadata;
    const apiKey = getApiKey();
    
    // The download_url is a full URL and may require the API key again.
    const response = await fetch(metadata.download_url, {
        headers: {
            'X-API-Key': apiKey,
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to download backup content from ${metadata.download_url}: ${response.statusText}`);
    }

    // The backup content is expected to be a JSON file, so we read it as text.
    const backupJsonString = await response.text();
    return parseAndValidateBackupFile(backupJsonString);
}

export async function uploadBackup(): Promise<{ timestamp: string; etag: string }> {
    const [decks, folders, deckSeries] = await Promise.all([
        db.getAllDecks(),
        db.getAllFolders(),
        db.getAllDeckSeries()
    ]);

    const exportData = { version: 3, decks, folders, deckSeries };
    const jsonString = JSON.stringify(exportData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const formData = new FormData();
    formData.append('file', blob, 'backup.json');

    const response = await request(`/backups`, {
        method: 'POST',
        body: formData,
    });

    const newBackupInfo = await response.json();

    return {
        timestamp: new Date().toISOString(),
        etag: newBackupInfo.etag
    };
}