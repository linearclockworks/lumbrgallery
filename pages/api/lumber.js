import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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

async function getAccessToken(creds) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64');
  
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(creds.private_key, 'base64');
  
  const jwt = `${header}.${payload}.${signature}`;
  
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  const data = await res.json();
  return data.access_token;
}

async function getPhotoIds() {
  try {
    const credString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!credString) return {};
    
    const creds = JSON.parse(credString);
    const token = await getAccessToken(creds);
    
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const data = await res.json();
    const photoMap = {};
    
    for (const file of data.files || []) {
      const serial = file.name.split('.').slice(0, -1).join('.');
      photoMap[serial] = file.id;
    }
    
    return photoMap;
  } catch (e) {
    console.error('Photo ID error:', e);
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