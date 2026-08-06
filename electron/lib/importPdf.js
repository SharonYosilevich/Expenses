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

/**
 * Parses a PDF buffer (Hebrew bank/credit-card statement style) into raw
 * 2D rows, best-effort. Boilerplate lines (interest terms, branch headers,
 * footers) are filtered out. This is heuristic - the import wizard's
 * review/edit grid is the safety net for anything misparsed.
 */
async function parsePdfBuffer(buffer) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
  const uint8 = new Uint8Array(buffer)
  const doc = await pdfjsLib.getDocument({ data: uint8, disableWorker: true }).promise

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

  return {
    sheets: [
      {
        name: 'PDF',
        rows: allRows,
        suggestedHeaderRowIndex: 0
      }
    ]
  }
}

module.exports = { parsePdfBuffer, isBoilerplate }
