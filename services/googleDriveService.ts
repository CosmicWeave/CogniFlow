

import { API_KEY, CLIENT_ID, DISCOVERY_DOC, SCOPES } from './googleDriveConfig';
import * as db from './db';
import { Deck, Folder, GoogleDriveFile, DeckSeries, DeckType, FullBackupData } from '../types';
import { getStockholmFilenameTimestamp } from './time';
import { parseAndValidateBackupFile } from './importService';

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
      // If silent sign-in fails, we remove the flag to prevent repeated pop-ups on load.
      localStorage.removeItem('gdrive-previously-signed-in');
      notifyAuthSubscribers(false);
      return;
    }
    // On successful sign-in, set the flag.
    localStorage.setItem('gdrive-previously-signed-in', 'true');
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
                    if (!API_KEY || !CLIENT_ID) {
                        console.warn("Google Drive API Key or Client ID is not configured. Drive features will be disabled.");
                        gapiInited = true;
                        finalInitCheck();
                        return;
                    }
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
                if (!CLIENT_ID) {
                    console.warn("Google Drive Client ID is not configured. Drive features will be disabled.");
                    gisInited = true;
                    finalInitCheck();
                    return;
                }
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
    // Using 'none' ensures that no UI is shown to the user.
    // An error is returned if the user is not signed in or has not granted consent.
    tokenClient.requestAccessToken({ prompt: 'none' });
};

export const signOut = () => {
  const token = gapi.client.getToken();
  // Always clear local state regardless of Google's response
  gapi.client.setToken(null);
  localStorage.removeItem('gdrive-previously-signed-in');
  notifyAuthSubscribers(false);
  
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      // Callback can be empty or log success
      console.log('Google token revoked.');
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
    const backupData = await db.getAllDataForBackup();
    
    if (backupData.decks.length === 0 && backupData.folders.length === 0 && backupData.deckSeries.length === 0) {
        throw new Error("There is no data to back up.");
    }

    const exportData: FullBackupData = {
        version: 6,
        ...backupData
    };

    const backupContent = JSON.stringify(exportData);
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

export const downloadFile = async (fileId: string): Promise<FullBackupData> => {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
    });
    
    if (response.status !== 200) {
        throw new Error('Failed to download backup file.');
    }

    const content = typeof response.body === 'string' ? response.body : JSON.stringify(response.result);
    return parseAndValidateBackupFile(content);
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