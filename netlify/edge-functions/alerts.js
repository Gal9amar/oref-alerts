export default async (request, context) => {
  try {
    const response = await fetch(
      'https://www.oref.org.il/WarningMessages/alert/alerts.json',
      {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': 'https://www.oref.org.il/',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      }
    );

    const text = await response.text();

    if (text.trim().startsWith('<')) {
      return new Response(
        JSON.stringify({ error: 'geo_blocked', status: response.status }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(text || '{}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const config = { path: '/api/alerts' };
