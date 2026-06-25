import path from 'path';
import fs from 'fs';

function loadMetadata() {
  try {
    const metaPath = path.join(process.cwd(), 'lumber.json');
    const data = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

export default function handler(req, res) {
  const metadata = loadMetadata();
  
  const pieces = Object.entries(metadata).map(([serial, data]) => {
    return {
      filename: `${serial}.jpeg`,
      fileId: serial,
      photoUrl: `https://drive.google.com/uc?id=dummy-${serial}`,
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