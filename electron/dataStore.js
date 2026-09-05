const fs = require('fs')
const path = require('path')

const DEFAULT_DATA = {
  version: 1,
  transactions: [],
  settings: {
    categories: [
      'אישי', 'ארנונה', 'בידור', 'ביטוח לרכב', 'ביטוחים', 'הוצאות נסיעה',
      'בית', 'גנים', 'דלק', 'החזר הלוואה', 'הטבות בנק', 'העברות',
      'חד פעמי', 'כיף', 'מזון', 'משיכת מזומן', 'משכורת', 'משכנתא',
      'סופר', 'סיגריות', 'ענן', 'קופ"ח', 'קופ"ח תרופות', 'קניות',
      'קניות אינטרנט', 'קצבאות', 'תקשורת', 'AI', 'אחר'
    ],
    people: ['שרון', 'יהונתן', 'אביתר', 'אלינור', 'בית'],
    rules: [
      // ── בית / הוצאות קבועות ──
      { keyword: 'משכנתא',           category: 'משכנתא',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'דסק-משכנתא',       category: 'משכנתא',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'ועד בית',          category: 'בית',          person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'חברת החשמל',       category: 'בית',          person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מי נתניה',         category: 'בית',          person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'ארנונה',           category: 'ארנונה',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'עירית נתניה',      category: 'ארנונה',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'עיריית',           category: 'ארנונה',       person: 'בית', isFixed: true,  type: 'expense' },
      // ── ביטוחים ובריאות ──
      { keyword: 'הפניקס',           category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מגדל חיים',        category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'הראל-ביטוח',       category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מנורה מבטחים',     category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'כלל ב.בריאות',     category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'ש. שלמה',          category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'סעוד הראל',        category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'שרותי בריאות כללית', category: 'קופ"ח',     person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מגדל',             category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'הראל',             category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מנורה',            category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'כלל ביטוח',        category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מכבי',             category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מאוחדת',           category: 'ביטוחים',      person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'הפניקס רכב',       category: 'ביטוח לרכב',  person: 'בית', isFixed: true,  type: 'expense' },
      // ── תקשורת ──
      { keyword: 'סלקום',            category: 'תקשורת',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'גולן טלקום',       category: 'תקשורת',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'פרטנר',            category: 'תקשורת',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'הוט',              category: 'תקשורת',       person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'בזק',              category: 'תקשורת',       person: 'בית', isFixed: true,  type: 'expense' },
      // ── גנים / חינוך ──
      { keyword: 'מינהל קהילתי',     category: 'גנים',         person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'מינהל קהילתי מזרח נתניה', category: 'גנים', person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'צהרון',            category: 'גנים',         person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'משיכת שיק',        category: 'גנים',         person: 'בית', isFixed: true,  type: 'expense' },
      // ── נסיעות ──
      { keyword: 'פנגו',             category: 'הוצאות נסיעה', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'מ. התחבורה',       category: 'הוצאות נסיעה', person: 'בית', isFixed: false, type: 'expense' },
      // ── דלק ──
      { keyword: 'פז',               category: 'דלק',          person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'YELLOW',           category: 'דלק',          person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'סונול',            category: 'דלק',          person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'דור אלון',         category: 'דלק',          person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'תפוז נתניה',       category: 'דלק',          person: 'בית', isFixed: false, type: 'expense' },
      // ── סופר ──
      { keyword: 'שופרסל',           category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'יוחננוף',          category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'רמי לוי',          category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'ויקטורי',          category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'טיב טעם',          category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'אושר עד',          category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'סופר הגורן',       category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'הקולה מרקט',       category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'סטופמרקט',         category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'דני בית מאפה',     category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'ניצת הדובדבן',     category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'לבל מרקט',         category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'פרו דג',           category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'דוכני שפע',        category: 'סופר',         person: 'בית', isFixed: false, type: 'expense' },
      // ── קניות ──
      { keyword: 'מקס נתניה',        category: 'קניות',        person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'נתניה JM',         category: 'קניות',        person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'BOOOM',            category: 'קניות',        person: 'בית', isFixed: false, type: 'expense' },
      { keyword: '83121237',         category: 'קניות אינטרנט', person: 'בית', isFixed: false, type: 'expense' },
      // ── ענן / טכנולוגיה ──
      { keyword: 'ANTHROPIC',        category: 'AI',           person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'GOOGLE',           category: 'ענן',          person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'APPLE.COM',        category: 'ענן',          person: 'בית', isFixed: false, type: 'expense' },
      // ── העברות ──
      { keyword: 'BIT',              category: 'העברות',       person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'PAYBOX',           category: 'העברות',       person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'לאיסטרייכר',       category: 'העברות',       person: 'בית', isFixed: false, type: 'expense' },
      // ── הטבות בנק ──
      { keyword: 'דמי כרטיס',        category: 'הטבות בנק',    person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'זיכוי הנחות מפתח', category: 'הטבות בנק',   person: 'בית', isFixed: false, type: 'income'  },
      { keyword: 'החזר דיסקונט',     category: 'הטבות בנק',   person: 'בית', isFixed: false, type: 'income'  },
      { keyword: 'CashPro',          category: 'הטבות בנק',   person: 'בית', isFixed: false, type: 'income'  },
      // ── הלוואות ──
      { keyword: 'מור גמל ופ',       category: 'החזר הלוואה',  person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'קופת גמל',         category: 'החזר הלוואה',  person: 'בית', isFixed: true,  type: 'expense' },
      // ── בידור ──
      { keyword: 'מפעל הפיס',        category: 'בידור',        person: 'בית', isFixed: true,  type: 'expense' },
      { keyword: 'טיקצ\'אק',         category: 'בידור',        person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'הטבות פיס',        category: 'בידור',        person: 'בית', isFixed: false, type: 'expense' },
      // ── משיכת מזומן ──
      { keyword: 'משיכת מזומן',      category: 'משיכת מזומן',  person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'כספומט',           category: 'משיכת מזומן',  person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'משיכה מכספומט',    category: 'משיכת מזומן',  person: 'בית', isFixed: false, type: 'expense' },
      // ── הכנסות ──
      { keyword: 'משכורת',           category: 'משכורת',       person: 'בית', isFixed: false, type: 'income'  },
      { keyword: 'סיטיבנק',           category: 'משכורת',       person: 'יהונתן', isFixed: false, type: 'income'  },
      { keyword: 'עירית חדרה משכורת', category: 'משכורת',      person: 'שרון',   isFixed: false, type: 'income'  },
      { keyword: 'עיריית חדרה משכורת', category: 'משכורת',     person: 'שרון',   isFixed: false, type: 'income'  },
      { keyword: 'ביטוח לאומי',      category: 'קצבאות',       person: 'בית', isFixed: false, type: 'income'  },
      // ── אישי שרון ──
      { keyword: 'All Jobs',         category: 'אישי',         person: 'שרון', isFixed: false, type: 'expense' },
    ],
    categoryTypes: {
      'משכנתא':       'חובה',
      'ארנונה':        'חובה',
      'בית':           'חובה',
      'ביטוחים':       'חובה',
      'ביטוח לרכב':   'חובה',
      'קופ"ח':         'חובה',
      'קופ"ח תרופות':  'חובה',
      'גנים':          'חובה',
      'תקשורת':        'חובה',
      'החזר הלוואה':   'חובה',
      'סופר':          'גמיש',
      'דלק':           'גמיש',
      'הוצאות נסיעה':  'גמיש',
      'מזון':          'גמיש',
      'קניות':         'מותרות',
      'קניות אינטרנט': 'מותרות',
      'בידור':         'מותרות',
      'כיף':           'מותרות',
      'סיגריות':       'מותרות',
      'אישי':          'מותרות',
      'ענן':           'מותרות',
      'AI':            'מותרות',
      'חד פעמי':       'מותרות',
      'העברות':        'מותרות',
      'משיכת מזומן':   'מותרות',
    },
    importMappings: {}
  }
}

function getDataPaths() {
  const { app } = require('electron')
  const userData = app.getPath('userData')
  return {
    userData,
    dataFile: path.join(userData, 'data.json'),
    backupsDir: path.join(userData, 'backups')
  }
}

function ensureDirs() {
  const { userData, backupsDir } = getDataPaths()
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })
}

function loadData() {
  ensureDirs()
  const { dataFile } = getDataPaths()
  if (!fs.existsSync(dataFile)) {
    saveData(DEFAULT_DATA)
    return structuredCloneSafe(DEFAULT_DATA)
  }
  try {
    const raw = fs.readFileSync(dataFile, 'utf-8')
    const parsed = JSON.parse(raw)
    const userSettings = parsed.settings || {}

    // Normalize user rules: accept both 'keyword' and 'match' fields
    const userRules = (userSettings.rules || []).map(r => ({
      ...r,
      keyword: r.keyword || r.match
    })).filter(r => r.keyword)

    // Merge: keep all user rules; add DEFAULT rules whose keyword isn't already in user rules
    const userKeywords = new Set(userRules.map(r => r.keyword))
    const mergedRules = [
      ...userRules,
      ...DEFAULT_DATA.settings.rules.filter(r => !userKeywords.has(r.keyword))
    ]

    // Merge categories: keep user order, append any DEFAULT categories not present
    const userCats = userSettings.categories || DEFAULT_DATA.settings.categories
    const mergedCats = [
      ...userCats,
      ...DEFAULT_DATA.settings.categories.filter(c => !userCats.includes(c))
    ]

    // Merge people: keep user list, append any DEFAULT people not present
    const userPeople = userSettings.people || DEFAULT_DATA.settings.people
    const mergedPeople = [
      ...userPeople,
      ...DEFAULT_DATA.settings.people.filter(p => !userPeople.includes(p))
    ]

    // Merge categoryTypes: defaults first, user overrides win
    const mergedCatTypes = {
      ...DEFAULT_DATA.settings.categoryTypes,
      ...(userSettings.categoryTypes || {})
    }

    return {
      version: parsed.version || 1,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      settings: {
        ...DEFAULT_DATA.settings,
        ...userSettings,
        categories: mergedCats,
        people: mergedPeople,
        rules: mergedRules,
        categoryTypes: mergedCatTypes
      }
    }
  } catch (err) {
    const corruptPath = dataFile + '.corrupt.' + Date.now()
    try { fs.copyFileSync(dataFile, corruptPath) } catch (e) {}
    saveData(DEFAULT_DATA)
    return structuredCloneSafe(DEFAULT_DATA)
  }
}

function saveData(data) {
  ensureDirs()
  const { dataFile, backupsDir } = getDataPaths()

  if (fs.existsSync(dataFile)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupsDir, `data-${stamp}.json`)
    try {
      fs.copyFileSync(dataFile, backupPath)
      pruneBackups(backupsDir, 10)
    } catch (e) {}
  }

  const tmpPath = dataFile + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, dataFile)
}

function pruneBackups(backupsDir, keep) {
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith('data-') && f.endsWith('.json'))
    .map((f) => ({ f, t: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  files.slice(keep).forEach(({ f }) => {
    try { fs.unlinkSync(path.join(backupsDir, f)) } catch (e) {}
  })
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj))
}

module.exports = { loadData, saveData, getDataPaths, DEFAULT_DATA }
