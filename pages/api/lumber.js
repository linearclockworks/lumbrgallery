import { google } from 'googleapis';

const SHEET_ID = "1JP9F9BW9XmZEYjleWz3jh4xbZAhtnSry1lQLErEErNs";
const FOLDER_ID = "1HZ5UYhlecNFZgn_ibUiOK7lzeuxc6t1o";
const DEFAULT_SHOP_SLUG = "linear-clockworks";

function normalizeShopDomain(rawShop) {
  const s = String(rawShop || DEFAULT_SHOP_SLUG).trim();
  if (!s) return `${DEFAULT_SHOP_SLUG}.myshopify.com`;
  const cleaned = s.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return cleaned.includes('.') ? cleaned : `${cleaned}.myshopify.com`;
}

function getShopSlug(shopDomain) {
  return shopDomain.replace(/\.myshopify\.com$/i, '') || DEFAULT_SHOP_SLUG;
}

function formatOrderDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York'
  });
}

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
    range: 'Lumber!A:J'
  });

  const rows = res.data.values || [];
  const headers = rows[0] || [];
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[String(h || '').trim()] = row[idx] || '';
    });
    data.push(obj);
  }

  return data;
}

async function getPhotoIds() {
  const auth = await getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
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

function isClockItem(title, sku) {
  const s = String(sku || '').trim().toUpperCase();
  const combined = `${String(title || '')} ${s}`.toUpperCase();
  if (
    combined.includes('CLEARTIME') ||
    combined.includes('CLEAR TIME') ||
    combined.includes('CTLIGHT') ||
    combined.includes('SLED')
  ) {
    return false;
  }
  return s.startsWith('LCK-') || combined.includes('CLOCK');
}

function extractPrimaryClockTitle(lineItemEdges) {
  const items = (lineItemEdges || []).map((e) => e?.node).filter(Boolean);
  if (!items.length) return '';

  const activeItems = items.filter((li) => {
    const qty = Number(li.quantity || 0);
    const unfulfilled = li.unfulfilledQuantity != null ? Number(li.unfulfilledQuantity) : qty;
    return unfulfilled > 0 || qty > 0;
  });
  const pool = activeItems.length ? activeItems : items;

  const clockItem = pool.find((li) => {
    const sku = li.sku || li.variant?.sku || '';
    return isClockItem(li.title, sku);
  });

  return String((clockItem || pool[0])?.title || '').trim();
}

async function fetchShopifyOrderDetails(orderNumbers) {
  const token = String(process.env.SHOPIFY_ACCESS_TOKEN || '').trim();
  const shopDomain = normalizeShopDomain(process.env.SHOPIFY_SHOP_NAME);
  const shopSlug = getShopSlug(shopDomain);
  const apiVersion = String(process.env.SHOPIFY_API_VERSION || '2024-01').trim();

  const uniqueNumbers = [...new Set(orderNumbers.map((n) => String(n).replace(/^#/, '').trim()).filter(Boolean))];
  const orderMap = {};
  const debug = {
    tokenConfigured: Boolean(token),
    shopDomain,
    requestedCount: uniqueNumbers.length,
    matchedCount: 0,
    error: null
  };

  if (!token || uniqueNumbers.length === 0) {
    if (!token) debug.error = 'SHOPIFY_ACCESS_TOKEN is not set in Vercel environment variables';
    return { orderMap, shopSlug, debug };
  }

  const queryGql = `
    query GetOrdersByName($q: String!) {
      orders(first: 250, query: $q) {
        edges {
          node {
            legacyResourceId
            name
            createdAt
            email
            customer {
              displayName
              firstName
              lastName
              email
            }
            shippingAddress {
              name
            }
            billingAddress {
              name
            }
            lineItems(first: 20) {
              edges {
                node {
                  title
                  quantity
                  unfulfilledQuantity
                  sku
                  variant {
                    sku
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  for (let i = 0; i < uniqueNumbers.length; i += 40) {
    const chunk = uniqueNumbers.slice(i, i + 40);
    // status:any is required so fulfilled/closed orders are also returned
    const searchQuery = `status:any (${chunk.map((num) => `name:${num}`).join(' OR ')})`;

    try {
      const resp = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: queryGql,
          variables: { q: searchQuery }
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        debug.error = `HTTP ${resp.status}: ${errText.slice(0, 200)}`;
        console.error('Shopify API error:', debug.error);
        continue;
      }

      const json = await resp.json();
      if (json.errors) {
        debug.error = JSON.stringify(json.errors);
        console.error('Shopify GraphQL errors:', debug.error);
      }

      const edges = json?.data?.orders?.edges || [];

      for (const edge of edges) {
        const node = edge?.node;
        if (!node) continue;

        const cleanOrderNum = String(node.name || '').replace(/^#/, '').trim();
        const first = String(node.customer?.firstName || '').trim();
        const last = String(node.customer?.lastName || '').trim();
        const customerName =
          `${first} ${last}`.trim() ||
          String(node.customer?.displayName || '').trim() ||
          String(node.shippingAddress?.name || '').trim() ||
          String(node.billingAddress?.name || '').trim() ||
          String(node.customer?.email || node.email || '').trim();

        const clockName = extractPrimaryClockTitle(node.lineItems?.edges);
        const orderDate = formatOrderDate(node.createdAt);
        const legacyId = String(node.legacyResourceId || '').trim();

        orderMap[cleanOrderNum] = {
          orderNumber: cleanOrderNum,
          orderAdminUrl: legacyId
            ? `https://admin.shopify.com/store/${shopSlug}/orders/${legacyId}`
            : `https://admin.shopify.com/store/${shopSlug}/orders?query=${encodeURIComponent('#' + cleanOrderNum)}`,
          orderDate,
          customerName,
          clockName
        };
      }
    } catch (err) {
      debug.error = err.message;
      console.error('Shopify lookup error:', err);
    }
  }

  debug.matchedCount = Object.keys(orderMap).length;
  return { orderMap, shopSlug, debug };
}

export default async function handler(req, res) {
  try {
    const [sheetData, photoIds] = await Promise.all([
      getSheetData(),
      getPhotoIds()
    ]);

    const orderNumbersToLookup = [];
    for (const row of sheetData) {
      const orderNum = String(row['Order Number'] || '').replace(/^#/, '').trim();
      if (orderNum) {
        orderNumbersToLookup.push(orderNum);
      }
    }

    const { orderMap, shopSlug, debug } = await fetchShopifyOrderDetails(orderNumbersToLookup);

    const pieces = [];
    const missing = [];

    for (const row of sheetData) {
      const serial = String(row.Serial || '').trim();
      if (!serial) continue;

      const availRaw = String(row.Available || '').trim().toLowerCase();
      const available = availRaw === 'y';

      const fileId = photoIds[serial.toLowerCase()];
      const photoUrl = fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w1200` : null;

      const orderNumber = String(row['Order Number'] || '').replace(/^#/, '').trim();
      const shopifyOrder = orderNumber ? orderMap[orderNumber] : null;

      const orderAdminUrl = orderNumber
        ? (shopifyOrder?.orderAdminUrl ||
          `https://admin.shopify.com/store/${shopSlug}/orders?query=${encodeURIComponent('#' + orderNumber)}`)
        : '';

      const piece = {
        filename: `${serial}.jpeg`,
        fileId: serial,
        photoUrl: photoUrl,
        serialno: serial,
        species: row.Description || '',
        length: '',
        width: '',
        owner: row.Owner || '',
        location: row.Location || '',
        comments: row.Comments || '',
        available: available,
        orderNumber: orderNumber,
        orderAdminUrl: orderAdminUrl,
        orderDate: shopifyOrder?.orderDate || '',
        customerName: shopifyOrder?.customerName || '',
        clockName: shopifyOrder?.clockName || ''
      };

      if (photoUrl) {
        pieces.push(piece);
      } else if (available) {
        missing.push({
          serialno: serial,
          species: row.Description || '—',
          owner: row.Owner || '—',
          location: row.Location || '—'
        });
      }
    }

    res.status(200).json({ pieces, missing, shopifyDebug: debug });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}