# 🚨 מעקב אזעקות פיקוד העורף

דשבורד להצגת אזעקות פיקוד העורף ב-24 השעות האחרונות לפי יישובים.

## דרישות
- [Node.js](https://nodejs.org) (גרסה 14+)

## הרצה מקומית

```bash
# שכפל את הריפו
git clone https://github.com/Gal9amar/oref-alerts.git
cd oref-alerts

# הפעל את שרת הפרוקסי
node server.js

# פתח בדפדפן
open http://localhost:3001
```

> **חשוב:** חייב לרוץ מרשת ישראלית. הפרוקסי עוקף את חסימת ה-CORS של הדפדפן.

## ארכיטקטורה

```
דפדפן → server.js (localhost:3001) → oref.org.il API
```

שרת הפרוקסי:
- מוסיף את ה-headers הנכונים לפיקוד העורף
- פותר את בעיית ה-CORS
- משמש גם כ-static file server לקובץ ה-HTML

## Endpoints

| נתיב | תיאור |
|------|--------|
| `GET /` | דשבורד ראשי |
| `GET /api/history` | היסטוריית אזעקות 24 שעות |
| `GET /api/alerts` | אזעקות פעילות בזמן אמת |
