# Lumber Gallery

Photo database for lumber inventory with search, filter, and lightbox.

## Quick start

```bash
cd ~/shopify_scripts/lumbrgallery
npm install
npm run dev
```

Visit `http://localhost:3000`

## Edit metadata

Add details for your photos in `lumber.json`. Key by filename (without extension):

```json
{
  "885": {
    "serialno": "LCK-001",
    "species": "walnut",
    "length": 48,
    "width": 12,
    "owner": "Bryan",
    "location": "shop",
    "comments": "quartersawn"
  }
}
```

When you save, the app reloads and shows updated metadata.

## Deploy to Vercel

1. **Push to Git**
   ```bash
   git init
   git add .
   git commit -m "Lumber gallery"
   git remote add origin https://github.com/YOUR_USERNAME/lumber-gallery.git
   git push -u origin main
   ```

2. **vercel.com/new** → Import repo → Auto-detects Next.js ✓

3. **Add env var** (Vercel dashboard)
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Value: Full contents of `~/shopify_scripts/marketing_agent/marketing-agent-key.json`

4. **Done** → App lives at `lumber-gallery.vercel.app`

## File structure

```
lumbrgallery/
├── pages/
│   ├── api/lumber.js      ← API endpoint (reads Drive folder + metadata)
│   └── index.jsx          ← React component (gallery UI)
├── lumber.json            ← Metadata (edit to add piece details)
├── package.json
├── next.config.js
└── .gitignore
```

## Folder structure

The `pages/` folder is Next.js's file-based routing:
- `pages/index.jsx` → homepage `/`
- `pages/api/lumber.js` → API endpoint `/api/lumber`

This is how Next.js works by convention. No build step needed—just edit and save.

## Photos

All 62 photos are in: `https://drive.google.com/drive/folders/1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o`

The app reads this folder automatically. Add more photos by drag-dropping into the Drive folder—no rebuild.

## Workflow

1. Add photo to Drive folder (no rebuild)
2. Edit `lumber.json` with metadata for that photo
3. Push to git → Vercel auto-deploys
4. App updates with new metadata

That's it.
