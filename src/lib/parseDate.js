const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

function pad(n) {
  return String(n).padStart(2, '0')
}

function fromExcelSerial(serial) {
  const ms = EXCEL_EPOCH_UTC + serial * 86400000
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * Normalizes a raw cell value (already stringified) into YYYY-MM-DD.
 * Handles ISO dates, DD/MM/YYYY (Israeli convention), and Excel serial
 * numbers (for cells that didn't get auto-converted to a Date by the
 * spreadsheet reader). Returns null when unparseable.
 */
export function normalizeDate(raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (dmy) {
    const day = parseInt(dmy[1], 10)
    const month = parseInt(dmy[2], 10)
    const year = parseInt(dmy[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`
    }
  }

  const serial = s.match(/^\d{4,6}(\.\d+)?$/)
  if (serial) {
    const n = parseFloat(s)
    if (n > 10000 && n < 90000) return fromExcelSerial(n)
  }

  return null
}

/**
 * Parses a raw amount cell (may contain commas, currency symbols, parens
 * for negatives) into a plain float. Returns 0 for blank/unparseable.
 */
export function normalizeAmount(raw) {
  if (raw === null || raw === undefined) return 0
  let s = String(raw).trim()
  if (!s) return 0
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[₪,\s]/g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return negative ? -Math.abs(n) : n
}
