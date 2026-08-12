const fs = require('fs')
const path = require('path')

const DEFAULT_DATA = {
  version: 1,
  transactions: [],
  settings: {
    categories: ['בית', 'מזון', 'כיף', 'דלק', 'גנים', 'אחר'],
    people: ['שרון', 'יהונתן', 'בית'],
    rules: [
      // הוצאות בית קבועות (הוראות קבע נפוצות)
      { keyword: 'משכנתא', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'ועד בית', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'קופת גמל', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'חברת החשמל', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'ארנונה', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'עירית', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'עיריית', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'סלקום', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'פרטנר', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'הוט', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'בזק', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'דמי כרטיס', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      // ביטוחים ופנסיה (בד"כ הוראת קבע)
      { keyword: 'הפניקס', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'מגדל', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'כלל ביטוח', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'הראל', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'מנורה', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'כללית', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'מכבי', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'מאוחדת', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'לאומית', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
      // גנים / חינוך (מינהל קהילתי, צהרונים וכו')
      { keyword: 'מינהל קהילתי', category: 'גנים', person: 'בית', isFixed: true, type: 'expense' },
      { keyword: 'צהרון', category: 'גנים', person: 'בית', isFixed: true, type: 'expense' },
      // דלק
      { keyword: 'פז ', category: 'דלק', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'סונול', category: 'דלק', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'דור אלון', category: 'דלק', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'דלק מנוע', category: 'דלק', person: 'בית', isFixed: false, type: 'expense' },
      // מזון - רשתות סופר נפוצות
      { keyword: 'שופרסל', category: 'מזון', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'יוחננוף', category: 'מזון', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'רמי לוי', category: 'מזון', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'ויקטורי', category: 'מזון', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'טיב טעם', category: 'מזון', person: 'בית', isFixed: false, type: 'expense' },
      { keyword: 'אושר עד', category: 'מזון', person: 'בית', isFixed: false, type: 'expense' },
      // הכנסות
      { keyword: 'משכורת', category: 'משכורת', person: 'בית', isFixed: false, type: 'income' },
      { keyword: 'סיטיבנק', category: 'משכורת', person: 'בית', isFixed: false, type: 'income' },
      { keyword: 'ביטוח לאומי', category: 'קצבאות', person: 'בית', isFixed: false, type: 'income' }
    ],
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
    return {
      version: parsed.version || 1,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) }
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
