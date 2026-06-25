import { google } from 'googleapis';
import path from 'path';

const FOLDER_ID = "1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o";

function loadMetadata() {
  try {
    const metaPath = path.join(process.cwd(), 'lumber.json');
    const data = require('fs').readFileSync(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function getGoogleAuth() {
  const credString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credString) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  
  let creds;
  try {
    creds = JSON.parse(credString);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON: ' + e.message);
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  
  return google.drive({ version: 'v3', auth });
}

async function listFolderFiles() {
  const drive = await getGoogleAuth();
  const query = `'${FOLDER_ID}' in parents and trashed=false`;
  
  const res = await drive.files.list({
    q: query,
    spaces: 'drive',
    fields: 'files(id, name)',
    pageSize: 100
  });
  
  return res.data.files || [];
}

export default async function handler(req, res) {
  try {
    const files = await listFolderFiles();
    const metadata = loadMetadata();
    
    const pieces = files.map(file => {
      const filename = file.name;
      const serial = filename.split('.').slice(0, -1).join('.');
      const pieceMeta = metadata[serial] || {};
      
      return {
        filename,
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}