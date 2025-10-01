// Google Drive API Configuration
// Replace these with your actual Google Drive API credentials

export const GOOGLE_DRIVE_CONFIG = {
  CLIENT_ID: '252499620125-tscdg1v9nu02gl41gqngfjcdp4e9hb1q.apps.googleusercontent.com',
  API_KEY: 'AIzaSyAsu1QzlIQWAwP5hwu3E4waFNjoY6sLhFk',
  DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  SCOPES: 'https://www.googleapis.com/auth/drive.file'
};

// Instructions for setting up Google Drive API:
// 1. Go to https://console.developers.google.com/
// 2. Create a new project or select an existing one
// 3. Enable the Google Drive API
// 4. Create credentials (OAuth 2.0 Client ID for web application)
// 5. Add your domain to authorized origins
// 6. Copy the Client ID and API Key to this file
