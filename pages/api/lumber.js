import { google } from 'googleapis';

const SHEET_ID = "1JP9F9BW9XmZEYjleWz3jh4xbZAhtnSry1lQLErEErNs";
const FOLDER_ID = "1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o";

async function getAuth() {
  const credString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credString) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  
  const creds = JSON.parse(credString);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ]
  });
}

async function getSheetData() {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Lumber!A:H'
  });
  
  const rows = res.data.values || [];
  const headers = rows[0] || [];
  const data = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] || '';
    });
    data.push(obj);
  }
  
  return data;
}

async function getPhotoIds() {
  const auth = await getAuth();
  const drive = google.drive({ version: 'v3', auth });
  
  const res = await drive.files.list({
    // Accepts JPEG, PNG, WebP, and any other image format
    q: `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id, name)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  
  const photoMap = {};
  for (const file of res.data.files || []) {
    const serial = file.name.split('.').slice(0, -1).join('.').trim().toLowerCase();
    photoMap[serial] = file.id;
  }
  
  return photoMap;
}

export default async function handler(req, res) {
  try {
    const [sheetData, photoIds] = await Promise.all([
      getSheetData(),
      getPhotoIds()
    ]);
    
    const pieces = [];
    const missing = [];
    
    for (const row of sheetData) {
      const serial = String(row.Serial || '').trim();
      if (!serial) continue;
      
      const availRaw = String(row.Available || '').trim().toLowerCase();
      const available = availRaw === 'y';
      
      const fileId = photoIds[serial.toLowerCase()];
      const photoUrl = fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1200` : null;
      
      const piece = {
        filename: `${serial}.jpeg`,
        fileId: serial,
        photoUrl: photoUrl,
        serialno: serial,
        species: row.Description || "",
        length: "",
        width: "",
        owner: row.Owner || "",
        location: row.Location || "",
        comments: row.Comments || "",
        available: available
      };
      
      if (photoUrl) {
        pieces.push(piece);
      } else if (available) {
        missing.push({
          serialno: serial,
          species: row.Description || "—",
          owner: row.Owner || "—",
          location: row.Location || "—"
        });
      }
    }
    
    res.status(200).json({ pieces, missing });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}
