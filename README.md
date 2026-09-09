# FitLedger – הפנקס של המאמן

אפליקציית מעקב אימונים ותשלומים למאמן כושר. React + Vite, Firebase (Firestore + Auth), פריסה ל-GitHub Pages.

## מבנה
- `src/firebase.js` – חיבור לפרויקט Firebase (config ציבורי; ההגנה ב-Security Rules).
- `src/lib/store.js` – כל הגישה לנתונים (קריאה חיה, כתיבה, יתרות, ייבוא).
- `src/pages/` – דשבורד, רישום אימון, לקוחות, לקוח, קבוצות, עוד.
- `public/history.json` – ההיסטוריה מהאקסל, נטענת פעם אחת ממסך "עוד".
- `seed/build_seed.py` – הסקריפט שבנה את history.json מהאקסל (לתיעוד).
- `.github/workflows/deploy.yml` – פריסה אוטומטית בכל push ל-main.

## מודל הנתונים (Firestore)
- `clients` – לקוח: name, defaultPrice, active, groupId.
- `groups` – קבוצה: name, memberIds[], defaultPrice, active.
- `sessions` – אימון: date (YYYY-MM-DD), clientId, amount, type, paid, paidAt, receipt, note, groupId/gkey לאימון קבוצתי.
- `payments` – תשלום/מקדמה: date, clientId, amount, note.
- `monthly/{YYYY-MM}` – סיכום חודשי (charged, paid, count) לגרפים ארוכי טווח.
- `settings/app` – מחיר ברירת מחדל ועוד.

יתרה של לקוח = Σ תשלומים − Σ אימונים שלא שולמו (עד תאריך הסינון).

## פיתוח מקומי
```
npm install
npm run dev
```
תצוגה ללא Firebase (עיצוב בלבד): `http://localhost:5173/fitledger/demo.html?page=dash`

## פריסה
push ל-main → GitHub Actions בונה ומפרסם. ב-Settings → Pages לבחור Source: **GitHub Actions** (פעם אחת).
