import os
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

FOLDER_ID = "1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o"  # Original lumber-photos

def get_auth():
    cred_path = os.path.expanduser("~/shopify_scripts/marketing_agent/marketing-agent-key.json")
    return Credentials.from_service_account_file(cred_path, scopes=[
        'https://www.googleapis.com/auth/drive.readonly'
    ])

creds = get_auth()
drive = build('drive', 'v3', credentials=creds)

print(f"Listing all files in {FOLDER_ID}...")
results = drive.files().list(
    q=f"'{FOLDER_ID}' in parents and trashed=false",
    spaces='drive',
    fields='files(id, name, mimeType)',
    pageSize=100,
    supportsAllDrives=True,
    includeItemsFromAllDrives=True
).execute()

files = results.get('files', [])
print(f"Found {len(files)} files:\n")

for f in files:
    print(f"  {f['name']} ({f['mimeType']})")

# Extract JPEGs
jpegs = [f for f in files if f['mimeType'] == 'image/jpeg']
print(f"\nFound {len(jpegs)} JPEGs")
