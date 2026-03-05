const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3001;

const OREF_HEADERS = {
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

function fetchFromOref(path, referer) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.oref.org.il',
      path,
      method: 'GET',
      headers: { ...OREF_HEADERS, 'Referer': referer, 'Host': 'www.oref.org.il' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (req.url === '/api/history') {
      const { status, body } = await fetchFromOref(
        '/WarningMessages/History/AlertsHistory.json',
        'https://www.oref.org.il/heb/alerts-history'
      );
      if (body.trim().startsWith('<')) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'geo_blocked', status }));
        return;
      }
      res.writeHead(200);
      res.end(body || '[]');
      return;
    }

    if (req.url === '/api/alerts') {
      const { status, body } = await fetchFromOref(
        '/WarningMessages/alert/alerts.json',
        'https://www.oref.org.il/'
      );
      if (body.trim().startsWith('<')) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'geo_blocked', status }));
        return;
      }
      res.writeHead(200);
      res.end(body || '{}');
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));

  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ Oref proxy running on port ${PORT}`);
});
