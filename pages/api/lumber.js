import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const FOLDER_ID = "1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o";

function loadMetadata() {
  try {
    const metaPath = path.join(process.cwd(), 'lumber.json');
    const data = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error loading lumber.json:', e);
    return {};
  }
}

async function listFolderFiles() {
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
    
    return res.data.files || [];
  } catch (e) {
    console.error('Drive API error:', e);
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const files = await listFolderFiles();
    const metadata = loadMetadata();
    
    const pieces = files.map(file => {
      const serial = file.name.split('.').slice(0, -1).join('.');
      const pieceMeta = metadata[serial] || {};
      
      return {
        filename: file.name,
        fileId: file.id,
        photoUrl: `https://drive.google.com/uc?id=${file.id}`,
        serialno: pieceMeta.serialno || serial,
        species: pieceMeta.species || "",
        length: pieceMeta.length || "",
        width: pieceMeta.width || "",
        owner: pieceMeta.owner || "",
        location: pieceMeta.location || "",
        comments: pieceMeta.comments || ""
      };
    });
    
    res.status(200).json({ pieces });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: err.message });
  }
}