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

async function getPhotoUrls() {
  const auth = await getAuth();
  const drive = google.drive({ version: 'v3', auth });
  
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and mimeType='image/jpeg' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id, name, webContentLink)',  // <-- Use webContentLink
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  
  const photoMap = {};
  for (const file of res.data.files || []) {
    const serial = file.name.split('.').slice(0, -1).join('.');
    photoMap[serial] = file.webContentLink;  // Direct download link
  }
  
  return photoMap;
}

export default async function handler(req, res) {
  try {
    const [sheetData, photoUrls] = await Promise.all([
      getSheetData(),
      getPhotoUrls()
    ]);
    
    const pieces = sheetData
      .map(row => {
        const serial = String(row.Serial || '').trim();
        if (!serial) return null;
        
        return {
          filename: `${serial}.jpeg`,
          fileId: serial,
          photoUrl: photoUrls[serial] || null,
          serialno: serial,
          species: row.Name || "",
          length: "",
          width: "",
          owner: row.Owner || "",
          location: row.Location || "",
          comments: row.Comments || ""
        };
      })
      .filter(Boolean);
    
    res.status(200).json({ pieces });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}