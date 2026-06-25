import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

const FOLDER_ID = "1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o";

function loadMetadata() {
  try {
    const metaPath = path.join(process.cwd(), 'lumber.json');
    const data = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

async function getPhotoIds() {
  try {
    const credString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!credString) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
    
    const creds = JSON.parse(credString);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
      pageSize: 200
    });
    
    const photoMap = {};
    for (const file of res.data.files || []) {
      const serial = file.name.split('.').slice(0, -1).join('.');
      photoMap[serial] = file.id;
    }
    
    return photoMap;
  } catch (e) {
    console.error('Drive API error:', e);
    return {};
  }
}

export default async function handler(req, res) {
  const metadata = loadMetadata();
  const photoIds = await getPhotoIds();
  
  const pieces = Object.entries(metadata).map(([serial, data]) => {
    const photoId = photoIds[serial];
    const photoUrl = photoId ? `https://drive.google.com/uc?id=${photoId}` : null;
    
    return {
      filename: `${serial}.jpeg`,
      fileId: serial,
      photoUrl: photoUrl,
      serialno: data.serialno || serial,
      species: data.species || "",
      length: data.length || "",
      width: data.width || "",
      owner: data.owner || "",
      location: data.location || "",
      comments: data.comments || ""
    };
  });
  
  res.status(200).json({ pieces });
}