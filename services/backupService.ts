import * as db from './db';
import { parseAndValidateBackupFile } from './importService';
import { Deck, Folder, DeckSeries } from '../types';

const BASE_URL = 'https://www.greenyogafestival.org/backup-api/api/v1';
const APP_ID = 'cogniflow-data';
const FILENAME = 'cogniflow_backup.json';

const getApiKey = () => localStorage.getItem('cogniflow-backupApiKey') || 'qRt+gU/57GHKhxTZeRnRi+dfT274iSkKKq2UnTr9Bxs=';

export interface BackupMetadata {
    filename: string;
    last_modified: string; // ISO 8601 string
    size: number;
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

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: response.statusText };
        }
        const errorMessage = `Backup API Error (${response.status}): ${errorData.message || 'Unknown error'}`;
        throw new Error(errorMessage);
    }
    return response;
}

export async function getLatestBackupMetadata(): Promise<BackupMetadata> {
    const response = await request(`/backups/latest`);
    return response.json();
}

export async function downloadBackup(): Promise<RestoreData> {
    // Note: The API GETs the file content directly, not metadata
    const response = await request(`/backups/${FILENAME}`); 
    const backupJson = await response.json();
    // The backup data is the file content itself, so we stringify it to pass to the parser
    const validationResult = parseAndValidateBackupFile(JSON.stringify(backupJson));
    return validationResult;
}

export async function uploadBackup(): Promise<string> {
    const [decks, folders, deckSeries] = await Promise.all([
        db.getAllDecks(),
        db.getAllFolders(),
        db.getAllDeckSeries()
    ]);

    const exportData = { version: 3, decks, folders, deckSeries };
    const jsonString = JSON.stringify(exportData);
    const blob = new Blob([jsonString], { type: 'application/json' });

    try {
        // The most common case will be updating an existing file. We try this first.
        await request(`/backups/${FILENAME}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: jsonString,
        });
    } catch (error) {
        // If the update fails with a 404, it means the file doesn't exist yet. We create it with POST.
        if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
            const formData = new FormData();
            formData.append('file', blob, FILENAME);
            await request(`/backups`, {
                method: 'POST',
                body: formData,
            });
        } else {
            // Re-throw any other errors (e.g., auth errors, server errors)
            throw error;
        }
    }

    // Return the current timestamp for local tracking
    return new Date().toISOString();
}
