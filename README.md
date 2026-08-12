# הוצאות הבית

אפליקציית שולחן עבודה (Electron) לניהול הוצאות והכנסות חודשיות של הבית - מקומית לחלוטין, בלי ענן ובלי תלות באינטרנט בזמן ריצה. נבנתה עבור שרון ויהונתן יוסילביץ'.

## מה זה עושה

- ייבוא נתונים מקבצי **Excel ו-PDF** - דפי עו"ש מהבנק ודפי אשראי מפורטים (ויזה/ישראכרט/מקס), עם אשף ייבוא שממפה עמודות ומאפשר בדיקה/עריכה לפני שמירה (אף פעם לא שומר "בעיוורון").
- סיווג כל תנועה לפי **קטגוריה** (בית/מזון/כיף/דלק/גנים/אחר, ניתן לעריכה) ולפי **מי** (שרון/יהונתן/בית, ניתן לעריכה), עם חוקי סיווג אוטומטי לפי מילות מפתח בתיאור שנלמדים עם הזמן.
- **דשבורד חודשי** - קטגוריות כעמודות עם סה"כ לכל עמודה (כבקשת יהונתן - לא כמו טבלת אקסל רגילה), הוצאות קבועות בנפרד, הכנסות בנפרד, וכמה נשאר בסוף החודש.
- **גרפים** (עוגה/בר/מגמה) ו**השוואת חודשים** (פיבוט: שורות=חודשים, עמודות=קטגוריות) - הכל מסונן לפי חודש/אדם.
- שמירת **היסטוריה של כל החודשים**, גיבוי אוטומטי (10 גיבויים אחרונים) + ייצוא/שחזור גיבוי ידני.

## סטאק טכנולוגי

Electron + React (JS, לא TS) + Vite, אריזה ל-installer של Windows (NSIS) דרך `electron-builder`. אחסון נתונים כקובץ JSON תחת `app.getPath('userData')` (לא SQLite - בכוונה, כדי להימנע מ-native modules שמסבכים אריזה; בהיקף נתונים של הוצאות בית זה לגמרי מספיק).

```
electron/
  main.js            # תהליך ראשי: חלון, IPC handlers, גיבויים
  preload.js          # contextBridge - ה-API הבטוח שנחשף ל-renderer כ-window.api
  dataStore.js         # קריאה/כתיבה אטומית של data.json + גיבויים מתגלגלים
  lib/importExcel.js   # פענוח Excel (xlsx) - raw:true חשוב! (ר' "מלכודות" למטה)
  lib/importPdf.js     # פענוח PDF (pdfjs-dist) - חילוץ טקסט+מיקום, קיבוץ לשורות/עמודות, סינון boilerplate
src/
  DataContext.jsx      # React context - טוען/שומר נתונים דרך window.api
  App.jsx              # sidebar + ניתוב פשוט מבוסס state (בלי react-router)
  pages/                # Dashboard, ChartsPage, History, Transactions, Import (אשף 3 שלבים), Settings
  lib/
    aggregate.js        # פונקציות טהורות לחישובי סכומים/פיבוט - עם בדיקות
    categorize.js        # התאמת חוקים + זיהוי "חיוב לכרטיס" מרוכז / יתרת פתיחה
    parseDate.js          # נירמול תאריכים (ISO/DD-MM-YYYY/סריאל אקסל) וסכומים
    palette.js             # צבעי הקטגוריות בגרפים (recharts)
```

## פקודות

```bash
npm install       # פעם ראשונה (וכל פעם שמשנים dependencies)
npm run dev        # הרצה בפיתוח (Vite + Electron ביחד)
npm test           # vitest - הבדיקות ב-src/lib/*.test.js
npm run build       # build בלבד (dist/ + dist-electron/)
npm run dist         # build + electron-builder -> release/*.exe
```

## מלכודות שכבר נתקלנו בהן (חשוב לזכור!)

1. **Excel dates - חובה `raw: true`** ב-`sheet_to_json` (ב-`electron/lib/importExcel.js`). עם `raw:false` SheetJS מחזיר טקסט מפורמט לפי לוקאל ברירת מחדל (M/D/YY, אמריקאי) גם אם הקובץ המקורי בפורמט ישראלי - זה גרם לכל התאריכים להיכשל בפענוח וב-0 תנועות מיובאות. עם `raw:true` + `cellDates:true` מקבלים אובייקט `Date` אמיתי וממירים בעצמנו (ר' `cellToString`). גם שימי לב ל-`getFullYear/getMonth/getDate` (לוקאלי) ולא `toISOString()` (UTC) - זה יכול להזיז תאריך יום אחורה.

2. **שורות "חיוב לכרטיס ויזה/ישראכרט/מקס" בדף עו"ש הן סכום מרוכז**, לא הוצאה מפורטת - הפירוט האמיתי (מזון/דלק/כיף) צריך לבוא מדף האשראי המפורט. לכן `isLikelyCardAggregate()` מסמן אותן באזהרה ומשאיר אותן **לא מסומנות לייבוא כברירת מחדל** (`Import.jsx`, `buildDraftRows`) - כדי למנוע כפילות אם מייבאים גם את דף האשראי המפורט.

3. **תנועות בלי התאמת חוק לא אמורות ליפול על הקטגוריה הראשונה ברשימה** - יש פולבאק מפורש ל"אחר"/"בית" (ניטרלי, מסמן "צריך בדיקה") במקום שהכל ייראה כאילו זה "בית" כברירת מחדל.

4. **`ELECTRON_RUN_AS_NODE=1`** מוגדר בסביבת ה-shell של סוכן הפיתוח (Claude Code) - זה גורם ל-`electron.exe` לרוץ כ-Node רגיל במקום Electron אמיתי (require('electron') מחזיר undefined). צריך להסיר את המשתנה הזה (`delete env.ELECTRON_RUN_AS_NODE`) לפני שמריצים את ה-binary בבדיקות.

5. **contextBridge לא ניתן ל"stub"/override מה-renderer** - כדי לבדוק את זרימת הייבוא בלי לפתוח דיאלוג קבצים אמיתי, צריך לתפוס את זה בתהליך הראשי (`app.evaluate(({ipcMain}) => ipcMain.handle('import:pickFile', ...))`), לא ע"י שינוי `window.api` מה-renderer.

6. **בניית installer דורשת Windows Developer Mode פעיל** (Settings → מערכת → למפתחים) - אחרת `electron-builder` נכשל בחילוץ `winCodeSign` (symlinks של macOS בתוך הארכיון) עם שגיאת הרשאות. אפשר לכבות את Developer Mode אחרי הבנייה - לא נדרש להרצת האפליקציה המותקנת.

7. **`pdfjs-dist` חייב להיות ב-`dependencies`** (לא `devDependencies`) כי הוא נטען ב-runtime ב-main process (`electron/lib/importPdf.js`) ו-`electron-builder` אורז רק production dependencies.

8. **`pdfjs-dist` v4 הפסיק לספק build של CommonJS** - `require('pdfjs-dist/legacy/build/pdf.js')` לא קיים יותר, יש רק `.mjs`. חייבים `await import('pdfjs-dist/legacy/build/pdf.mjs')` (דינמי) מתוך `importPdf.js` שהוא עצמו CommonJS. זה גרם לקריסה מלאה של ייבוא PDF באפליקציה הארוזה (asar) - `require` נכשל בזמן ריצה כי הקובץ פשוט לא קיים. תוקן ונבדק דרך ה-exe הארוז עצמו (`release/win-unpacked/*.exe`), לא רק ב-dev.

## מה עוד לא נבדק/נבנה

- ייבוא PDF נבדק בפועל על שני סוגי קבצים אמיתיים: דף עו"ש בנק (יוצא נקי יחסית - כמעט שורה אחת לתנועה) ודף אשראי מפורט (הרבה יותר מבולגן - כל עסקה פרוסה על כמה שורות ויזואליות ב-PDF: תת-שורת "מזהה כרטיס", שורת בית-עסק+סכום, ותגית "Apple Pay" - כל אחת נשלפת כשורה נפרדת, ודורש עריכה ידנית משמעותית במסך הבדיקה). **המלצה לשרון: לדפי אשראי מפורטים עדיף לייבא את קובץ ה-Excel** (יש אפשרות ייצוא כזו באתר הבנק) - הוא נכנס נקי, שורה אחת לעסקה.
- אין אייקון מותאם אישית ל-installer (משתמש באייקון ברירת המחדל של Electron) - `build/icon.ico` אם ירצו להוסיף בעתיד (ולעדכן `package.json` -> `build.win.icon`).
- אין code signing (חתימה דיגיטלית) ל-installer - Windows SmartScreen עלול להציג אזהרה "Unknown publisher" בהתקנה הראשונה; זה תקין וניתן ללחוץ "עוד מידע" -> "הפעל בכל זאת".
