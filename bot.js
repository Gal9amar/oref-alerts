const https = require('https');
const http = require('http');

const TOKEN = process.env.BOT_TOKEN || '8621396960:AAGK-xk2nixwvrgi1FllQvRg9oMd82ttcQA';

// ── Local history store (in-memory, built from real-time polling) ──
const alertHistory = []; // { alertDate, title, data, id }
const MAX_HISTORY = 5000;

// ── Subscribers ───────────────────────────────────────────────
const subscribers = new Set();
let lastAlertId = null;

// ── Telegram helpers ──────────────────────────────────────────
function tgRequest(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sendMessage(chatId, text, extra = {}) {
  return tgRequest('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

// ── Oref real-time alerts (works from non-Israeli IP sometimes) ─
function fetchCurrentAlert() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.oref.org.il',
      path: '/WarningMessages/alert/alerts.json',
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'he-IL,he;q=0.9',
        'Referer': 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Host': 'www.oref.org.il'
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (!body || body.trim().startsWith('<') || body.trim() === '') return resolve(null);
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ── Filter last 24h ───────────────────────────────────────────
function getLast24h() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return alertHistory.filter(a => a.timestamp >= cutoff);
}

// ── Commands ──────────────────────────────────────────────────
async function cmdStart(chatId) {
  subscribers.add(chatId);
  await sendMessage(chatId,
    `🚨 <b>בוט אזעקות פיקוד העורף</b>\n\n` +
    `נרשמת לקבל התראות בזמן אמת! ✅\n\n` +
    `<b>פקודות:</b>\n` +
    `/start — הרשמה להתראות\n` +
    `/stop — הפסקת התראות\n` +
    `/now — אזעקות פעילות כרגע\n` +
    `/stats — סטטיסטיקות 24 שעות\n` +
    `/city [שם עיר] — חיפוש לפי עיר`
  );
}

async function cmdStop(chatId) {
  subscribers.delete(chatId);
  await sendMessage(chatId, '🔕 הוסרת מרשימת ההתראות.');
}

async function cmdNow(chatId) {
  const alert = await fetchCurrentAlert();
  if (!alert || !alert.data || alert.data.length === 0) {
    await sendMessage(chatId, '✅ אין אזעקות פעילות כרגע.');
    return;
  }
  const cities = alert.data.join('\n• ');
  await sendMessage(chatId,
    `🚨 <b>אזעקה פעילה עכשיו!</b>\n\n` +
    `📋 <b>${alert.title || 'התרעה'}</b>\n\n` +
    `📍 <b>אזורים:</b>\n• ${cities}`
  );
}

async function cmdStats(chatId) {
  const recent = getLast24h();

  if (recent.length === 0) {
    const uptime = Math.round(process.uptime() / 60);
    await sendMessage(chatId,
      `📊 <b>סטטיסטיקות 24 שעות</b>\n\n` +
      `הבוט רץ ${uptime} דקות.\n` +
      (uptime < 60
        ? `הבוט עוד לא פועל מספיק זמן לצבור היסטוריה.\nכשתהיה אזעקה — היא תישמר אוטומטית! 🔄`
        : `✅ לא היו אזעקות ב-24 השעות האחרונות.`)
    );
    return;
  }

  // Count by city
  const cityCount = {};
  recent.forEach(a => {
    (Array.isArray(a.data) ? a.data : [a.data]).forEach(city => {
      if (city) cityCount[city] = (cityCount[city] || 0) + 1;
    });
  });

  const sorted = Object.entries(cityCount).sort((a, b) => b[1] - a[1]);
  const top15 = sorted.slice(0, 15);

  let msg = `📊 <b>סטטיסטיקות 24 שעות אחרונות</b>\n\n`;
  msg += `🔢 סה"כ אזעקות: <b>${recent.length}</b>\n`;
  msg += `🏙️ יישובים: <b>${sorted.length}</b>\n\n`;
  msg += `<b>🏆 Top יישובים:</b>\n`;
  top15.forEach(([city, count], i) => {
    const bar = '█'.repeat(Math.min(count, 8)) + '░'.repeat(Math.max(0, 8 - count));
    msg += `${i + 1}. ${city} — <b>${count}</b>\n`;
  });

  await sendMessage(chatId, msg);
}

async function cmdCity(chatId, cityName) {
  if (!cityName) {
    await sendMessage(chatId, '❓ שימוש: /city [שם עיר]\nלדוגמה: <code>/city תל אביב</code>');
    return;
  }

  const recent = getLast24h();
  const matches = recent.filter(a => {
    const cities = Array.isArray(a.data) ? a.data : [a.data];
    return cities.some(c => c && c.includes(cityName));
  });

  if (matches.length === 0) {
    const total = recent.length;
    await sendMessage(chatId,
      `🔍 לא נמצאו אזעקות עבור "<b>${cityName}</b>" ב-24 שעות האחרונות.\n` +
      (total > 0 ? `(סה"כ ${total} אזעקות נרשמו מאז הפעלת הבוט)` : `(הבוט עוד לא צבר היסטוריה)`)
    );
    return;
  }

  let msg = `📍 <b>אזעקות — ${cityName}</b>\nסה"כ: <b>${matches.length}</b>\n\n`;
  matches.slice(0, 20).forEach(a => {
    const time = new Date(a.timestamp).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    const date = new Date(a.timestamp).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    msg += `🕐 ${date} ${time} — ${a.title || 'אזעקה'}\n`;
  });
  if (matches.length > 20) msg += `\n...ועוד ${matches.length - 20} נוספות`;

  await sendMessage(chatId, msg);
}

// ── Real-time polling + history accumulation ──────────────────
async function pollAlerts() {
  try {
    const alert = await fetchCurrentAlert();
    if (!alert || !alert.data || alert.data.length === 0) {
      lastAlertId = null;
      return;
    }

    const alertId = String(alert.id || alert.data.join(','));
    if (alertId === lastAlertId) return;
    lastAlertId = alertId;

    // Save to local history
    const entry = {
      alertDate: new Date().toISOString(),
      timestamp: Date.now(),
      title: alert.title || 'התרעה',
      data: alert.data,
      id: alertId
    };
    alertHistory.unshift(entry);
    if (alertHistory.length > MAX_HISTORY) alertHistory.pop();

    console.log(`🚨 Alert: ${alert.data.join(', ')}`);

    if (subscribers.size === 0) return;

    const cities = alert.data.join('\n• ');
    const now = new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const msg =
      `🚨🚨 <b>אזעקה!</b> 🚨🚨\n\n` +
      `📋 <b>${alert.title || 'התרעת פיקוד העורף'}</b>\n\n` +
      `📍 <b>אזורים:</b>\n• ${cities}\n\n` +
      `🕐 ${now}`;

    for (const chatId of subscribers) {
      sendMessage(chatId, msg).catch(() => {});
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

// ── Long polling for commands ─────────────────────────────────
let offset = 0;

async function getUpdates() {
  try {
    const res = await tgRequest('getUpdates', {
      offset,
      timeout: 30,
      allowed_updates: ['message']
    });
    if (!res.ok || !res.result) return;

    for (const update of res.result) {
      offset = update.update_id + 1;
      const msg = update.message;
      if (!msg || !msg.text) continue;

      const chatId = msg.chat.id;
      const text = msg.text.trim();
      console.log(`[${chatId}] ${text}`);

      if (text.startsWith('/start'))      await cmdStart(chatId);
      else if (text.startsWith('/stop'))  await cmdStop(chatId);
      else if (text.startsWith('/now'))   await cmdNow(chatId);
      else if (text.startsWith('/stats')) await cmdStats(chatId);
      else if (text.startsWith('/city')) {
        await cmdCity(chatId, text.replace('/city', '').replace(/@\w+/, '').trim());
      } else {
        await sendMessage(chatId, '❓ פקודה לא מוכרת.\nשלח /start לרשימת הפקודות.');
      }
    }
  } catch (err) {
    console.error('getUpdates error:', err.message);
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Oref Telegram Bot starting...');
  await tgRequest('deleteWebhook', {});

  const me = await tgRequest('getMe', {});
  if (me.result) console.log(`✅ Bot: @${me.result.username}`);

  // Poll oref every 2 seconds
  setInterval(pollAlerts, 2000);

  // Long polling loop
  const loop = async () => {
    await getUpdates();
    setImmediate(loop);
  };
  loop();

  // Health server for Railway
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      subscribers: subscribers.size,
      historyCount: alertHistory.length,
      uptime: Math.round(process.uptime())
    }));
  }).listen(process.env.PORT || 3001, () => {
    console.log(`✅ Health server on port ${process.env.PORT || 3001}`);
  });
}

main().catch(console.error);
