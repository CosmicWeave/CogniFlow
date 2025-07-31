// IMPORTANT: For a real application, you must create your own project in the
// Google Cloud Console, enable the Google Drive API, and create OAuth 2.0
// credentials for a Web application. You must also configure the authorized
// JavaScript origins to match the domain where you host your app.

// Using these placeholders will result in an error from Google.
export const API_KEY = "AIzaSyCxQD2rTQvfarBU5QQLwjHdRTJ-jq3GFMY";
export const CLIENT_ID = "727276393482-almsrnelboiul2343hvs643ok8onqtna.apps.googleusercontent.com";

// These values are standard for the Google Drive API.
export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
// This scope allows the app to create, view, and manage files in a special,
// hidden folder in the user's Google Drive. It also requests access to basic
// user profile information (name, email, picture).
export const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';