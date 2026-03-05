# 🚨 מעקב אזעקות פיקוד העורף

דשבורד להצגת אזעקות פיקוד העורף ב-24 השעות האחרונות לפי יישובים.

## פריסה על Netlify

1. חבר את הריפו ל-Netlify
2. Build settings:
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions`
3. פרוס — הכל אוטומטי ✅

## פיתוח מקומי עם Netlify CLI

```bash
npm install -g netlify-cli
netlify dev
```

פתח: **http://localhost:8888**

## ארכיטקטורה

```
דפדפן → Netlify Function (proxy) → oref.org.il API
```

- `/api/history` → `netlify/functions/history.js`
- `/api/alerts`  → `netlify/functions/alerts.js`

> **חשוב:** הפונקציות רצות בסרברי Netlify — חסימת ה-CORS וה-IP נפתרות אוטומטית.
