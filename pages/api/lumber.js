async function listFolderFiles() {
  try {
    const credString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!credString) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
    
    const creds = JSON.parse(credString);
    
    // Get auth token
    const authUrl = 'https://oauth2.googleapis.com/token';
    const tokenRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.client_id,
        client_secret: creds.private_key_id,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: generateJWT(creds)
      })
    });
    
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    
    // List files
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}' in parents&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    return await driveRes.json();
  } catch (e) {
    console.error('Drive API error:', e);
    return { files: [] };
  }
}

function generateJWT(creds) {
  // JWT generation logic here (complex)
  // For now, just return empty
  return '';
}