const XLSX = require('xlsx')

function pad(n) {
  return String(n).padStart(2, '0')
}

function cellToString(v) {
  if (v === null || v === undefined) return ''
  // Use local (not UTC) date parts - toISOString() shifts by timezone offset
  // and can silently roll the date back a day.
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  return String(v).trim()
}

function guessHeaderRowIndex(rows) {
  const keywords = ['תאריך', 'תיאור', 'סכום', 'זכות', 'חובה', 'יתרה', 'עסק', 'קטגוריה']
  let bestIdx = 0
  let bestScore = -1
  const limit = Math.min(rows.length, 25)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    if (!row) continue
    const nonEmpty = row.filter((c) => cellToString(c) !== '')
    if (nonEmpty.length < 2) continue
    let score = nonEmpty.length
    for (const c of nonEmpty) {
      const s = cellToString(c)
      if (keywords.some((k) => s.includes(k))) score += 5
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}

/**
 * Parses an Excel file buffer into raw 2D rows per sheet, plus a best-guess
 * header row index. All UI decisions (which sheet, which row is the header,
 * column mapping) happen afterwards in the import wizard.
 */
function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    // raw:true - so date cells come through as JS Date objects (unambiguous),
    // rather than raw:false's locale-formatted text (SheetJS defaults to
    // US M/D/Y order regardless of the source file's own date format).
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).map((row) =>
      row.map(cellToString)
    )
    return {
      name,
      rows,
      suggestedHeaderRowIndex: guessHeaderRowIndex(rows)
    }
  })
  return { sheets }
}

module.exports = { parseExcelBuffer, guessHeaderRowIndex }
