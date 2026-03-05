const https = require('https');
const http = require('http');

const TOKEN = process.env.BOT_TOKEN || '8621396960:AAGK-xk2nixwvrgi1FllQvRg9oMd82ttcQA';
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

// Store subscribers and last alert id
const subscribers = new Set();
let lastAlertId = null;
let lastHistoryCheck = null;

// ── Telegram API helpers ──────────────────────────────────────
function tgRequest(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sendMessage(chatId, text, extra = {}) {
  return tgRequest('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

// ── Oref API helpers ──────────────────────────────────────────
function fetchOref(path, referer) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.oref.org.il',
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'he-IL,he;q=0.9',
        'Referer': referer,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Host': 'www.oref.org.il'
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (body.trim().startsWith('<')) return resolve(null);
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function fetchCurrentAlert() {
  return fetchOref('/WarningMessages/alert/alerts.json', 'https://www.oref.org.il/');
}

function fetchHistory() {
  return fetchOref('/WarningMessages/History/AlertsHistory.json', 'https://www.oref.org.il/heb/alerts-history');
}

// ── Filter last 24h ───────────────────────────────────────────
function isWithin24h(alertDate) {
  try {
    const dt = new Date(alertDate.replace(' ', 'T'));
    return (Date.now() - dt.getTime()) < 24 * 60 * 60 * 1000;
  } catch { return false; }
}

// ── Commands ──────────────────────────────────────────────────
async function cmdStart(chatId) {
  subscribers.add(chatId);
  await sendMessage(chatId,
    `🚨 <b>בוט אזעקות פיקוד העורף</b>\n\n` +
    `נרשמת לקבל התראות בזמן אמת!\n\n` +
    `<b>פקודות זמינות:</b>\n` +
    `/start - הרשמה להתראות\n` +
    `/stop - הפסקת התראות\n` +
    `/stats - סטטיסטיקות 24 שעות\n` +
    `/city [שם עיר] - חיפוש לפי עיר\n` +
    `/now - בדיקת אזעקות פעילות כרגע`
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
  await sendMessage(chatId, '⏳ מושך נתונים...');
  const history = await fetchHistory();
  if (!history) {
    await sendMessage(chatId, '❌ לא ניתן למשוך נתונים כרגע.');
    return;
  }

  const recent = history.filter(a => isWithin24h(a.alertDate));
  if (recent.length === 0) {
    await sendMessage(chatId, '✅ לא היו אזעקות ב-24 השעות האחרונות.');
    return;
  }

  const cityCount = {};
  recent.forEach(a => {
    const city = a.data || 'לא ידוע';
    cityCount[city] = (cityCount[city] || 0) + 1;
  });

  const sorted = Object.entries(cityCount).sort((a, b) => b[1] - a[1]);
  const top10 = sorted.slice(0, 10);

  let msg = `📊 <b>סטטיסטיקות 24 שעות אחרונות</b>\n\n`;
  msg += `🔢 סה"כ אזעקות: <b>${recent.length}</b>\n`;
  msg += `🏙️ יישובים מושפעים: <b>${sorted.length}</b>\n\n`;
  msg += `<b>🏆 Top 10 יישובים:</b>\n`;
  top10.forEach(([city, count], i) => {
    const bar = '█'.repeat(Math.min(count, 10));
    msg += `${i + 1}. ${city} — <b>${count}</b> ${bar}\n`;
  });

  await sendMessage(chatId, msg);
}

async function cmdCity(chatId, cityName) {
  if (!cityName) {
    await sendMessage(chatId, '❓ שימוש: /city [שם עיר]\nלדוגמה: /city תל אביב');
    return;
  }

  await sendMessage(chatId, `🔍 מחפש אזעקות עבור: <b>${cityName}</b>...`);
  const history = await fetchHistory();
  if (!history) {
    await sendMessage(chatId, '❌ לא ניתן למשוך נתונים כרגע.');
    return;
  }

  const recent = history.filter(a => isWithin24h(a.alertDate));
  const matches = recent.filter(a => a.data && a.data.includes(cityName));

  if (matches.length === 0) {
    await sendMessage(chatId, `✅ לא נמצאו אזעקות עבור "<b>${cityName}</b>" ב-24 שעות האחרונות.`);
    return;
  }

  let msg = `📍 <b>אזעקות עבור ${cityName}</b> (24 שעות)\n`;
  msg += `סה"כ: <b>${matches.length}</b> אזעקות\n\n`;
  matches.slice(0, 20).forEach(a => {
    const time = a.alertDate ? a.alertDate.split(' ')[1].substring(0, 5) : '-';
    const date = a.alertDate ? a.alertDate.split(' ')[0] : '-';
    msg += `🕐 ${date} ${time} — ${a.title || 'אזעקה'}\n`;
  });
  if (matches.length > 20) msg += `\n...ועוד ${matches.length - 20} נוספות`;

  await sendMessage(chatId, msg);
}

// ── Real-time alert polling ───────────────────────────────────
async function pollAlerts() {
  try {
    const alert = await fetchCurrentAlert();
    if (!alert || !alert.data || alert.data.length === 0) {
      lastAlertId = null;
      return;
    }

    const alertId = alert.id ? String(alert.id) : alert.data.join(',');
    if (alertId === lastAlertId) return;
    lastAlertId = alertId;

    if (subscribers.size === 0) return;

    const cities = alert.data.join('\n• ');
    const msg =
      `🚨🚨 <b>אזעקה!</b> 🚨🚨\n\n` +
      `📋 <b>${alert.title || 'התרעת פיקוד העורף'}</b>\n\n` +
      `📍 <b>אזורים:</b>\n• ${cities}\n\n` +
      `🕐 ${new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' })}`;

    for (const chatId of subscribers) {
      sendMessage(chatId, msg).catch(() => {});
    }

    console.log(`🚨 Alert sent to ${subscribers.size} subscribers: ${alert.data.join(', ')}`);
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

// ── Webhook / Long polling ────────────────────────────────────
let offset = 0;

async function getUpdates() {
  try {
    const res = await tgRequest('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    if (!res.ok || !res.result) return;

    for (const update of res.result) {
      offset = update.update_id + 1;
      const msg = update.message;
      if (!msg || !msg.text) continue;

      const chatId = msg.chat.id;
      const text = msg.text.trim();

      console.log(`[${chatId}] ${text}`);

      if (text.startsWith('/start')) await cmdStart(chatId);
      else if (text.startsWith('/stop')) await cmdStop(chatId);
      else if (text.startsWith('/now')) await cmdNow(chatId);
      else if (text.startsWith('/stats')) await cmdStats(chatId);
      else if (text.startsWith('/city')) {
        const cityName = text.replace('/city', '').trim();
        await cmdCity(chatId, cityName);
      } else {
        await sendMessage(chatId, '❓ פקודה לא מוכרת. שלח /start לרשימת הפקודות.');
      }
    }
  } catch (err) {
    console.error('getUpdates error:', err.message);
  }
}

// ── Main loop ─────────────────────────────────────────────────
async function main() {
  console.log('🤖 Oref Telegram Bot starting...');

  // Delete webhook to use long polling
  await tgRequest('deleteWebhook', {});

  const me = await tgRequest('getMe', {});
  console.log(`✅ Bot: @${me.result.username}`);

  // Poll for alerts every 2 seconds
  setInterval(pollAlerts, 2000);

  // Long polling loop
  const poll = async () => {
    await getUpdates();
    setImmediate(poll);
  };
  poll();

  // Keep-alive HTTP server for Railway
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, subscribers: subscribers.size }));
  }).listen(process.env.PORT || 3001, () => {
    console.log(`✅ Health server on port ${process.env.PORT || 3001}`);
  });
}

main().catch(console.error);
