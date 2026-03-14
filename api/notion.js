export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let { token, dbId, limit = 18 } = req.body;
  if (!token || !dbId) return res.status(400).json({ error: 'Missing token or dbId' });

  // Clean up the dbId — accept full URLs or raw IDs, strip dashes
  dbId = dbId.trim();
  // If it's a URL, extract the ID part before any ?
  if (dbId.includes('notion.so')) {
    dbId = dbId.split('?')[0].split('/').pop();
  }
  // Remove dashes and any non-hex characters
  dbId = dbId.replace(/-/g, '').replace(/[^a-f0-9]/gi, '');
  // Take last 32 chars in case there's extra
  if (dbId.length > 32) dbId = dbId.slice(-32);
  // Re-add dashes in standard UUID format
  if (dbId.length === 32) {
    dbId = `${dbId.slice(0,8)}-${dbId.slice(8,12)}-${dbId.slice(12,16)}-${dbId.slice(16,20)}-${dbId.slice(20)}`;
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sorts: [{ property: 'Publish Date', direction: 'ascending' }],
        page_size: Number(limit)
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.message });
    }

    const data = await response.json();
    const posts = data.results.map(page => {
      const props = page.properties;
      const files = props['Attachment']?.files || [];
      const img = files[0]?.file?.url || files[0]?.external?.url || '';
      const name = props['Name']?.title?.[0]?.plain_text || '';
      const date = props['Publish Date']?.date?.start || '';
      return { id: page.id, img, name, date };
    });

    res.json({ posts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
