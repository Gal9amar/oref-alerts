# 🚨 מעקב אזעקות פיקוד העורף

דשבורד להצגת אזעקות פיקוד העורף ב-24 השעות האחרונות.

## ארכיטקטורה

```
Netlify (index.html) → Railway Proxy (ישראל) → oref.org.il
```

## פריסה

### שלב 1 — פרוס את ה-Proxy על Railway

1. כנס ל-[railway.app](https://railway.app) והתחבר עם GitHub
2. לחץ **New Project → Deploy from GitHub repo**
3. בחר את הריפו `Gal9amar/oref-alerts`
4. **חשוב:** שנה את Root Directory ל-`proxy`
5. Railway יזהה את `package.json` ויפרוס אוטומטית
6. לאחר הפריסה — לחץ על הסרביס → **Settings → Networking → Generate Domain**
7. העתק את ה-URL (למשל: `https://oref-proxy.up.railway.app`)

### שלב 2 — עדכן את Netlify

ב-Netlify dashboard → Site settings → Environment variables → הוסף:
```
PROXY_URL = https://oref-proxy.up.railway.app
```

**או** — עדכן את `index.html` ישירות:
```js
const PROXY_BASE = 'https://oref-proxy.up.railway.app';
```

### שלב 3 — בדוק

פתח את האתר ב-Netlify — הנתונים אמורים להגיע ✅

## קבצים

```
├── index.html                    # הדשבורד (Netlify)
├── netlify.toml                  # הגדרות Netlify
├── netlify/edge-functions/       # Edge functions (גיבוי)
└── proxy/
    ├── server.js                 # Proxy server (Railway)
    ├── package.json
    └── Procfile
```
