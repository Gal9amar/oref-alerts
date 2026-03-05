const https = require('https');

exports.handler = async () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.oref.org.il',
      path: '/WarningMessages/History/AlertsHistory.json',
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'he-IL,he;q=0.9',
        'Referer': 'https://www.oref.org.il/heb/alerts-history',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'Host': 'www.oref.org.il'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: body || '[]'
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: err.message })
      });
    });

    req.end();
  });
};
