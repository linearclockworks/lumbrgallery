import os
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

def get_auth():
    cred_path = os.path.expanduser("~/shopify_scripts/marketing_agent/marketing-agent-key.json")
    return Credentials.from_service_account_file(cred_path, scopes=['https://www.googleapis.com/auth/drive.readonly'])

creds = get_auth()
drive = build('drive', 'v3', credentials=creds)

target_file = "885.jpeg"

print(f"Searching for '{target_file}' across all drives...")
results = drive.files().list(
    q=f"name = '{target_file}' and trashed = false",
    spaces='drive',
    fields='files(id, name, parents)',
    supportsAllDrives=True,
    includeItemsFromAllDrives=True
).execute()

files = results.get('files', [])

if not files:
    print(f"❌ Could not find '{target_file}'. Check extension case (.jpg vs .jpeg)?")
else:
    for f in files:
        print(f"\n✅ Found!")
        print(f"  Name: {f['name']}")
        print(f"  ID:   {f['id']}")
        parent_id = f.get('parents', ['No parent'])[0]
        print(f"  Parent Folder ID: {parent_id}")
        print(f"\n➜ Update your script's FOLDER_ID to: {parent_id}")
