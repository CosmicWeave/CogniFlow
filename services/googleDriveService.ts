
import { API_KEY, CLIENT_ID, DISCOVERY_DOC, SCOPES } from './googleDriveConfig';
import * as db from './db';
import { Deck, Folder, GoogleDriveFile, DeckSeries } from '../types';
import { getStockholmFilenameTimestamp } from './time';

declare var gapi: any;
declare var google: any;

let gapiInited = false;
let gisInited = false;
let tokenClient: any = null;

let authSubscribers: ((isSignedIn: boolean, user?: any) => void)[] = [];
let gapiSubscribers: ((isReady: boolean) => void)[] = [];

const notifyAuthSubscribers = (isSignedIn: boolean, user?: any) => {
  authSubscribers.forEach(cb => cb(isSignedIn, user));
};
const notifyGapiSubscribers = (isReady: boolean) => {
  gapiSubscribers.forEach(cb => cb(isReady));
};

/**
 * A single, reusable callback function to handle token responses from Google.
 * This is set once during initialization.
 * @param tokenResponse The response from the Google Identity Services.
 */
const handleTokenResponse = async (tokenResponse: any) => {
    if (tokenResponse.error) {
      // This can happen if silent sign-in finds no session or the user closes the pop-up.
      // It's not an error to be thrown, just a notification that sign-in did not complete.
      notifyAuthSubscribers(false);
      return;
    }
    // Explicitly set the access token for the GAPI client.
    // This is the crucial step to ensure all subsequent gapi.client requests are authenticated.
    gapi.client.setToken({ access_token: tokenResponse.access_token });
    
    const user = await fetchUserProfile(tokenResponse.access_token);
    notifyAuthSubscribers(true, user);
};


let initPromise: Promise<void> | null = null;
export const initGoogleDriveService = () => {
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = new Promise((resolve, reject) => {
        const finalInitCheck = () => {
            if(gapiInited && gisInited) {
                notifyGapiSubscribers(true);
                resolve();
            }
        }

        const handleGapiLoaded = () => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    gapiInited = true;
                    finalInitCheck();
                } catch (e) {
                    console.error('Error initializing GAPI client', e);
                    reject(e);
                }
            });
        };

        const handleGisLoaded = () => {
            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: handleTokenResponse, // Set the callback once during initialization.
                });
                gisInited = true;
                finalInitCheck();
            } catch(e) {
                console.error('Error initializing GIS client', e);
                reject(e);
            }
        };
        
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.async = true;
        gapiScript.defer = true;
        gapiScript.onload = handleGapiLoaded;
        gapiScript.onerror = () => reject(new Error('Failed to load GAPI script'));
        document.body.appendChild(gapiScript);

        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        gisScript.onload = handleGisLoaded;
        gisScript.onerror = () => reject(new Error('Failed to load GIS script'));
        document.body.appendChild(gisScript);
    });
    
    return initPromise;
};


export const onGapiReady = (callback: (isReady: boolean) => void) => {
    gapiSubscribers.push(callback);
    callback(gisInited && gapiInited);
    return () => {
        gapiSubscribers = gapiSubscribers.filter(cb => cb !== callback);
    };
};


export const onAuthStateChanged = (callback: (isSignedIn: boolean, user?: any) => void) => {
    authSubscribers.push(callback);
    return () => {
        authSubscribers = authSubscribers.filter(cb => cb !== callback);
    };
};

/**
 * Triggers the Google Sign-In flow with a user-facing prompt.
 * Should be called from a user action, like a button click.
 */
export const requestManualSignIn = () => {
  if (!gisInited || !gapiInited || !tokenClient) {
    console.error("Google services not ready for sign-in.");
    return;
  }
  // The 'consent' prompt ensures the user sees the sign-in and consent dialog.
  tokenClient.requestAccessToken({ prompt: 'consent' });
};

/**
 * Attempts to sign the user in silently in the background.
 * Will not show a pop-up if the user is not already signed in.
 */
export const attemptSilentSignIn = () => {
    if (!tokenClient) return;
    // An empty prompt attempts to get a token without user interaction.
    tokenClient.requestAccessToken({ prompt: '' });
};

export const signOut = () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken('');
      notifyAuthSubscribers(false);
    });
  }
};


const fetchUserProfile = async (accessToken: string) => {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch user profile.');
    }
    return response.json();
};

export const backup = async (): Promise<GoogleDriveFile> => {
    const [decks, folders, deckSeries] = await Promise.all([
        db.getAllDecks(),
        db.getAllFolders(),
        db.getAllDeckSeries()
    ]);

    if (decks.length === 0 && folders.length === 0 && deckSeries.length === 0) {
        throw new Error("There is no data to back up.");
    }
    
    const backupData = {
        version: 3,
        decks,
        folders,
        deckSeries
    };

    const backupContent = JSON.stringify(backupData);
    const timestamp = getStockholmFilenameTimestamp();
    const fileName = `cogniflow-backup-${timestamp}.json`;

    const fileMetadata = {
        name: fileName,
        parents: ['appDataFolder']
    };
    
    // Use a boundary string for the multipart request
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;
    
    // Construct the multipart request body
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      backupContent +
      close_delim;

    // Make the request using the high-level gapi.client.request
    const res = await gapi.client.request({
        path: 'https://www.googleapis.com/upload/drive/v3/files',
        method: 'POST',
        params: {
            uploadType: 'multipart',
            fields: 'id, name, modifiedTime'
        },
        headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
    });
    
    if (res.status !== 200) {
        throw new Error('Failed to upload backup file.');
    }
    return res.result as GoogleDriveFile;
};

export const listFiles = async (): Promise<GoogleDriveFile[]> => {
    const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc'
    });
    return response.result.files;
};

export type RestoreData = {
    decks: Deck[];
    folders: Folder[];
    deckSeries: DeckSeries[];
};

export const downloadFile = async (fileId: string): Promise<RestoreData> => {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
    });
    
    if (response.status !== 200) {
        throw new Error('Failed to download backup file.');
    }

    const data = response.result;
    
    if (typeof data === 'object' && data !== null && 'version' in data && Array.isArray(data.decks)) {
        const folders = (data.folders || []) as Folder[];
        const deckSeries = (data.deckSeries || []) as DeckSeries[];
        return { decks: data.decks, folders, deckSeries };
    }
    
    if (Array.isArray(data)) {
        return { decks: data, folders: [], deckSeries: [] };
    }

    throw new Error("Backup file content is not a valid format.");
};

export const deleteFile = async (fileId: string): Promise<void> => {
    try {
        await gapi.client.drive.files.delete({
            fileId: fileId,
        });
    } catch (e: any) {
        console.error("Failed to delete file from Google Drive", e);
        const errorMessage = e?.result?.error?.message || 'Unknown Google Drive API error.';
        throw new Error(`Failed to delete backup: ${errorMessage}`);
    }
};
