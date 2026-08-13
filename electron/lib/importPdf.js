const { guessHeaderRowIndex } = require('./importExcel.js')

const BOILERPLATE_PATTERNS = [
  /מסגרת אשראי כוללת/,
  /תנאי הריבית/,
  /פעולות בגינן נגבית/,
  /במקרה של הערות לדף החשבון/,
  /זמינים לשירותכם/,
  /אחזור דפי חשבון/,
  /פרוט הבקשה/,
  /^לכבוד/,
  /^כתובה?:/,
  /^טלפון:/,
  /^פקס:/,
  /^צוות:/,
  /^מ\.עסקים/,
  /^מס' חשבון/,
  /^מס' חשבון קודם/,
  /^סניף /,
  /^עתיד$/,
  /^עו"ש פרטי$/,
  /^דפי חשבון קודמים$/,
  /^ליום \d/,
  /^יום\s*$/,
  /^ערך\s*$/,
  /^תיאור הפעולה\s*$/,
  /^אסמכתא\s*$/,
  /^זכות\s*$/,
  /^חובה\s*$/,
  /^יתרה\s*$/,
  /העברה מדף קודם/,
  // Credit-card statement page furniture + disclaimer block
  /^כרטיסי אשראי$/,
  /סה"כ לחיוב קרוב/,
  /^פירוט עסקאות בכרטיס/,
  /עבור עסקאות שבוצעו בכרטיסים שלא הונפקו/,
  /עסקאות לחיוב הקודם/,
  /^סה"כ חיוב:/,
  /^הודעה$/,
  /המידע באחריות חברת כרטיסי האשראי/,
  /בכל סתירה בין הרשום/,
  /יתכן שישנן רכישות שעדיין לא דווחו/,
  /עסקאות אחרונות הינן עסקאות שבוצעו/,
  /עסקאות שבוצעו וטרם נקלטו/,
  /עסקאות אלו משפיעות על יתרת המסגרת/,
  /לא כל תנועות האישור בכרטיס מוצגות/,
  /לא יופיעו תנועות אישור שנלקחו בכרטיס/,
  /בשאילתה זו מפורטות גם עסקאות/,
  /עסקאות במטבע זר שמועד החיוב/,
  /סכום החיוב הקרוב אינו סופי/,
  /לצפייה במידע נוסף אודות כרטיסי האשראי/,
  /קישור מידע מאתר/,
  /יפתח בחלון נפרד/
]

function isBoilerplate(text) {
  const t = text.trim()
  if (!t) return true
  return BOILERPLATE_PATTERNS.some((re) => re.test(t))
}

/**
 * Groups text items into visual lines by Y proximity, sorts each line
 * right-to-left by X, then clusters X positions across the page into
 * column bins so lines end up with a consistent set of columns.
 */
function itemsToRows(items, yTolerance = 3) {
  const sorted = [...items].sort((a, b) => b.y - a.y)
  const lines = []
  for (const item of sorted) {
    let line = lines.find((l) => Math.abs(l.y - item.y) <= yTolerance)
    if (!line) {
      line = { y: item.y, items: [] }
      lines.push(line)
    }
    line.items.push(item)
  }
  lines.sort((a, b) => b.y - a.y)
  lines.forEach((l) => l.items.sort((a, b) => b.x - a.x))
  return lines
}

function clusterColumns(lines, gapThreshold = 12) {
  const xs = []
  lines.forEach((l) => l.items.forEach((it) => xs.push(it.x)))
  const uniqSorted = [...new Set(xs)].sort((a, b) => a - b)
  const bins = []
  let currentBin = []
  for (const x of uniqSorted) {
    if (currentBin.length === 0 || x - currentBin[currentBin.length - 1] <= gapThreshold) {
      currentBin.push(x)
    } else {
      bins.push(currentBin)
      currentBin = [x]
    }
  }
  if (currentBin.length) bins.push(currentBin)
  const boundaries = bins.map((b) => (b[0] + b[b.length - 1]) / 2).sort((a, b) => b - a)
  return boundaries
}

function assignToColumn(x, boundaries) {
  let closestIdx = 0
  let closestDist = Infinity
  boundaries.forEach((b, idx) => {
    const d = Math.abs(x - b)
    if (d < closestDist) {
      closestDist = d
      closestIdx = idx
    }
  })
  return closestIdx
}

const TRAILING_DATE_RE = /^(.+?)\s+(\d{2}\/\d{2}\/\d{4})$/
const REVERSED_DECIMAL_RE = /^\.(\d{2})\s+([\d,]+)\s*(₪)?$/

/**
 * PDF bidi rendering sometimes splits a currency amount's fractional part
 * from its integer part into separate text runs, which come out reordered
 * (e.g. "281.89 ₪" extracted as ".89 281 ₪"). Detect and un-reverse it.
 */
function fixReversedDecimal(text) {
  const match = text.trim().match(REVERSED_DECIMAL_RE)
  if (!match) return text
  const [, fraction, integer, currency] = match
  return `${integer}.${fraction}${currency ? ' ' + currency : ''}`
}

/**
 * Some statement layouts (e.g. detailed credit-card statements) render the
 * merchant name and the transaction date close enough together that column
 * clustering merges them into one column, so no separate date column ever
 * exists to map. Detect a column where most non-empty values end in a
 * DD/MM/YYYY date and split it into two columns for every row, uniformly.
 */
function splitMergedTrailingDateColumn(rows) {
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0)
  let mergedCol = -1
  for (let c = 0; c < maxCols; c++) {
    const values = rows.map((r) => (r[c] || '').trim()).filter(Boolean)
    if (values.length < 3) continue
    const matchCount = values.filter((v) => TRAILING_DATE_RE.test(v)).length
    if (matchCount / values.length >= 0.5) {
      mergedCol = c
      break
    }
  }
  if (mergedCol === -1) return rows

  return rows.map((row) => {
    const next = [...row]
    const raw = (next[mergedCol] || '').trim()
    const match = raw.match(TRAILING_DATE_RE)
    if (match) {
      next[mergedCol] = match[1]
      next.splice(mergedCol + 1, 0, match[2])
    } else {
      next.splice(mergedCol + 1, 0, '')
    }
    return next
  })
}

const CARD_MARKER_RE = /^(מזהה כרטיס|Apple Pay|\d{3,6})$/i
const PLAIN_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

/**
 * Finds the column where most non-empty values are a clean DD/MM/YYYY date.
 * Returns -1 if no column looks confidently like a date column.
 */
function findDateColumn(rows) {
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0)
  for (let c = 0; c < maxCols; c++) {
    const values = rows.map((r) => (r[c] || '').trim()).filter(Boolean)
    if (values.length < 3) continue
    const matchCount = values.filter((v) => PLAIN_DATE_RE.test(v)).length
    if (matchCount / values.length >= 0.5) return c
  }
  return -1
}

/**
 * Merchant-name text doesn't always land in the same column index across
 * rows - a slightly longer/shorter name can shift it into the neighboring
 * bin during column clustering. Rather than trust one fixed "description
 * column" index, collapse *every* column before the date column into one,
 * concatenating whatever text each row actually has there. Row shape
 * becomes [description, date, ...everything from after the date column].
 */
function collapsePreDateColumns(rows, dateCol) {
  return rows.map((row) => {
    const before = row.slice(0, dateCol).map((c) => (c || '').trim()).filter(Boolean)
    const after = row.slice(dateCol + 1)
    return [before.join(' '), (row[dateCol] || '').trim(), ...after]
  })
}

/**
 * Long merchant names can wrap onto their own visual line *either* above
 * the date+amount line ("פז YELLOW -גשר" / then the data line) *or* below
 * it (data line / then "הארי"), and card-metadata sub-lines ("מזהה כרטיס
 * 6955", "Apple Pay") appear alongside either. Operates on the collapsed
 * [description, date, ...] shape: drops pure-marker rows, then for each
 * run of orphan (no-date) description lines, attaches it to the following
 * dated row if there is one, otherwise back onto the previously emitted
 * dated row (the "wraps below" case).
 */
function mergeOrphanDescriptionLines(rows) {
  const dateCol = findDateColumn(rows)
  if (dateCol <= 0) return rows
  const descCol = 0
  const newDateCol = 1

  const collapsed = collapsePreDateColumns(rows, dateCol).filter((row) => {
    const nonEmpty = row.map((c) => (c || '').trim()).filter(Boolean)
    return !(nonEmpty.length > 0 && nonEmpty.every((c) => CARD_MARKER_RE.test(c)))
  })

  const isOrphan = (row) =>
    !(row[newDateCol] || '').trim() &&
    !!(row[descCol] || '').trim() &&
    // Marker noise can sit in the *same* row as orphan description text,
    // not only in its own row - tolerate it here too, not just empty cells.
    row.every((c, i) => i === descCol || !(c || '').trim() || CARD_MARKER_RE.test((c || '').trim()))

  const merged = []
  let i = 0
  while (i < collapsed.length) {
    if (!isOrphan(collapsed[i])) {
      merged.push(collapsed[i])
      i++
      continue
    }

    let prefix = collapsed[i][descCol].trim()
    let j = i + 1
    while (j < collapsed.length && isOrphan(collapsed[j])) {
      prefix += ' ' + collapsed[j][descCol].trim()
      j++
    }

    const nextRow = collapsed[j]
    if (nextRow && !!(nextRow[newDateCol] || '').trim()) {
      // A dated row follows - the common case (name wraps above its data).
      const patched = [...nextRow]
      patched[descCol] = patched[descCol] ? `${prefix} ${patched[descCol]}` : prefix
      collapsed[j] = patched
    } else if (merged.length > 0) {
      // No dated row follows - fold onto the row already emitted (the name
      // wraps below its data, or trails off before a footer/EOF).
      const prev = merged[merged.length - 1]
      prev[descCol] = prev[descCol] ? `${prev[descCol]} ${prefix}` : prefix
    }
    i = j
  }
  return merged
}

/**
 * Parses a PDF buffer (Hebrew bank/credit-card statement style) into raw
 * 2D rows, best-effort. Boilerplate lines (interest terms, branch headers,
 * footers) are filtered out. This is heuristic - the import wizard's
 * review/edit grid is the safety net for anything misparsed.
 */
async function parsePdfBuffer(buffer) {
  // pdfjs-dist v4 dropped its CommonJS build - only ships .mjs now, so this
  // has to be a dynamic import() even though this file itself is CommonJS.
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const uint8 = new Uint8Array(buffer)
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise

  // Column boundaries are computed once from every page's lines combined -
  // not per page - otherwise page 2 can end up with different column
  // semantics than page 1 (same PDF, but transactions silently misaligned).
  const allLines = []
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const items = content.items
      .filter((it) => it.str && it.str.trim() !== '')
      .map((it) => ({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5]
      }))

    for (const line of itemsToRows(items)) {
      const lineText = line.items.map((it) => it.text).join(' ')
      if (!isBoilerplate(lineText)) allLines.push(line)
    }
  }

  const boundaries = clusterColumns(allLines)
  const allRows = []
  for (const line of allLines) {
    const cols = new Array(boundaries.length).fill('')
    for (const it of line.items) {
      const colIdx = assignToColumn(it.x, boundaries)
      cols[colIdx] = cols[colIdx] ? `${cols[colIdx]} ${it.text}` : it.text
    }
    if (cols.some((c) => c.trim() !== '')) {
      allRows.push(cols)
    }
  }

  const fixedRows = allRows.map((row) => row.map(fixReversedDecimal))
  const splitRows = splitMergedTrailingDateColumn(fixedRows)
  const normalizedRows = mergeOrphanDescriptionLines(splitRows)

  return {
    sheets: [
      {
        name: 'PDF',
        rows: normalizedRows,
        suggestedHeaderRowIndex: guessHeaderRowIndex(normalizedRows)
      }
    ]
  }
}

module.exports = {
  parsePdfBuffer,
  isBoilerplate,
  splitMergedTrailingDateColumn,
  fixReversedDecimal,
  mergeOrphanDescriptionLines
}
