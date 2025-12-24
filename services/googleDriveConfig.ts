
// IMPORTANT: For a real application, you must create your own project in the
// Google Cloud Console, enable the Google Drive API, and create OAuth 2.0
// credentials for a Web application. You must also configure the authorized
// JavaScript origins to match the domain where you host your app.

// These values must be configured in your environment.
// Using safe access to prevent ReferenceError if process is not defined
const getEnv = (key: string) => {
    try {
        return typeof process !== 'undefined' ? process.env[key] : undefined;
    } catch (e) {
        return undefined;
    }
};

export const API_KEY = getEnv('GDRIVE_API_KEY');
export const CLIENT_ID = getEnv('GDRIVE_CLIENT_ID');

// These values are standard for the Google Drive API.
export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
// This scope allows the app to create, view, and manage files in a special,
// hidden folder in the user's Google Drive. It also requests access to basic
// user profile information (name, email, picture).
export const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
