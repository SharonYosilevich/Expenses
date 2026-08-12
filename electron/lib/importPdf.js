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
  /העברה מדף קודם/
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

  const allRows = []
  let maxCols = 0

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

    const lines = itemsToRows(items)
    const boundaries = clusterColumns(lines)
    maxCols = Math.max(maxCols, boundaries.length)

    for (const line of lines) {
      const lineText = line.items.map((it) => it.text).join(' ')
      if (isBoilerplate(lineText)) continue

      const cols = new Array(boundaries.length).fill('')
      for (const it of line.items) {
        const colIdx = assignToColumn(it.x, boundaries)
        cols[colIdx] = cols[colIdx] ? `${cols[colIdx]} ${it.text}` : it.text
      }
      if (cols.some((c) => c.trim() !== '')) {
        allRows.push(cols)
      }
    }
  }

  const fixedRows = allRows.map((row) => row.map(fixReversedDecimal))
  const normalizedRows = splitMergedTrailingDateColumn(fixedRows)

  return {
    sheets: [
      {
        name: 'PDF',
        rows: normalizedRows,
        suggestedHeaderRowIndex: 0
      }
    ]
  }
}

module.exports = { parsePdfBuffer, isBoilerplate, splitMergedTrailingDateColumn, fixReversedDecimal }
