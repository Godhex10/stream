// api/realdebrid.js
// Vercel serverless function — proxies Real-Debrid API calls
// so the browser never talks to RD directly (avoids CORS block).
//
// Your browser calls: POST /api/realdebrid
// This function calls: Real-Debrid API server-to-server
// Then returns the result back to the browser.

const RD_BASE = 'https://api.real-debrid.com/rest/1.0';

export default async function handler(req, res) {
  // Allow your Vercel domain (and localhost for testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, magnet, link, token } = req.body;

  if (!token) return res.status(400).json({ error: 'Missing RD token' });
  if (!action) return res.status(400).json({ error: 'Missing action' });

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  try {
    let rdRes, data;

    if (action === 'addMagnet') {
      // Step 1: Add magnet link to RD
      rdRes = await fetch(`${RD_BASE}/torrents/addMagnet`, {
        method: 'POST',
        headers,
        body: `magnet=${encodeURIComponent(magnet)}`
      });
      data = await rdRes.json();
      if (!rdRes.ok) return res.status(rdRes.status).json(data);
      return res.status(200).json(data);
    }

    if (action === 'selectFiles') {
      // Step 2: Select all files
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing torrent id' });
      rdRes = await fetch(`${RD_BASE}/torrents/selectFiles/${id}`, {
        method: 'POST',
        headers,
        body: 'files=all'
      });
      // RD returns 204 No Content on success here
      return res.status(200).json({ ok: true });
    }

    if (action === 'torrentInfo') {
      // Step 3: Get torrent info (poll for links)
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing torrent id' });
      rdRes = await fetch(`${RD_BASE}/torrents/info/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      data = await rdRes.json();
      if (!rdRes.ok) return res.status(rdRes.status).json(data);
      return res.status(200).json(data);
    }

    if (action === 'unrestrict') {
      // Step 4: Unrestrict link to get direct download URL
      if (!link) return res.status(400).json({ error: 'Missing link' });
      rdRes = await fetch(`${RD_BASE}/unrestrict/link`, {
        method: 'POST',
        headers,
        body: `link=${encodeURIComponent(link)}`
      });
      data = await rdRes.json();
      if (!rdRes.ok) return res.status(rdRes.status).json(data);
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[RD Proxy] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
