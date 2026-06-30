import gspread
import os
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SHEET_ID = "1JP9F9BW9XmZEYjleWz3jh4xbZAhtnSry1lQLErEErNs"
FOLDER_ID = "1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o"

def get_auth():
    cred_path = os.path.expanduser("~/shopify_scripts/marketing_agent/marketing-agent-key.json")
    creds = Credentials.from_service_account_file(cred_path, scopes=[
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
    ])
    return creds

def get_sheet_data():
    creds = get_auth()
    gc = gspread.authorize(creds)
    sheet = gc.open_by_key(SHEET_ID)
    ws = sheet.worksheet("Lumber")
    return ws.get_all_records()

def get_photo_ids():
    creds = get_auth()
    drive = build('drive', 'v3', credentials=creds)
    
    results = drive.files().list(
        q=f"'{FOLDER_ID}' in parents and mimeType='image/jpeg' and trashed=false",
        spaces='drive',
        fields='files(id, name, webViewLink)',
        pageSize=100,
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()
    
    photo_map = {}
    for file in results.get('files', []):
        serial = file['name'].rsplit('.', 1)[0]
        web_link = file.get('webViewLink', '').replace('/view', '/preview')
        photo_map[serial] = web_link
    
    return photo_map

def build_lumber_json():
    rows = get_sheet_data()
    photo_ids = get_photo_ids()
    
    lumber_data = {}
    for row in rows:
        serial = str(row.get('Serial', '')).strip()
        if not serial:
            continue
        
        lumber_data[serial] = {
            "serialno": serial,
            "species": row.get('Name', ''),
            "length": "",
            "width": "",
            "owner": row.get('Owner', ''),
            "location": row.get('Location', ''),
            "comments": row.get('Comments', '')
        }
    
    with open('lumber.json', 'w') as f:
        json.dump(lumber_data, f, indent=2)
    
    with open('photo_ids.json', 'w') as f:
        json.dump(photo_ids, f, indent=2)
    
    print(f"✓ Created lumber.json with {len(lumber_data)} entries")
    print(f"✓ Created photo_ids.json with {len(photo_ids)} photo IDs")

if __name__ == '__main__':
    build_lumber_json()