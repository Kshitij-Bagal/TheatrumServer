import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
     "http://localhost:8000/callback"
);

const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('Authorize this app by visiting this URL:', authUrl);
