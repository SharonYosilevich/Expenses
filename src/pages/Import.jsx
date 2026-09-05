import React, { useEffect, useMemo, useState } from 'react'
import CategorySelect from '../components/CategorySelect.jsx'
import { v4 as uuidv4 } from 'uuid'
import { useData } from '../DataContext.jsx'
import { normalizeDate, normalizeAmount } from '../lib/parseDate.js'
import { monthOf } from '../lib/aggregate.js'
import { suggestFromRules, isLikelyCardAggregate, isLikelyBalanceCarry } from '../lib/categorize.js'
import { formatMoney } from './Dashboard.jsx'
import { formatMonth } from '../components/FilterBar.jsx'

const ROLE_LABELS = {
  ignore: '— התעלם —',
  date: 'תאריך עסקה',
  billingDate: 'תאריך חיוב',
  description: 'תיאור',
  amount: 'סכום עסקה (כולל)',
  billingAmount: 'סכום חיוב (חלק חודשי)',
  credit: 'זכות (כסף נכנס)',
  debit: 'חובה (כסף יוצא)',
  country: 'מדינה',
  installNum: 'מספר תשלום',
  installTotal: "סה\"כ תשלומים"
}
const ROLE_KEYS = Object.keys(ROLE_LABELS)

// Active cards expected every month (for status panel)
const KNOWN_CARDS = ['1029', '5825', '1937']

// Cards that were replaced — map old number → new number (same slot in status panel)
const REPLACED_CARDS = { '5128': '1029' }

// Occasional cards — recognized for import but not expected monthly
const OCCASIONAL_CARDS = ['8426']

// All recognized cards for import detection
const ALL_KNOWN_CARDS = [...KNOWN_CARDS, ...Object.keys(REPLACED_CARDS), ...OCCASIONAL_CARDS]

// Detect which type of file this is from the file name
function detectFileType(fileName) {
  if (!fileName) return 'bank'
  for (const card of ALL_KNOWN_CARDS) {
    if (fileName.includes(card)) return `card-${REPLACED_CARDS[card] || card}`
  }
  return 'bank'
}

// Extract last-4-digit card number from a card aggregate row description
function extractCardNumber(description) {
  const re = /(?:כרטיס|מכרטיס)\s*:?\s*(\d{4,})/
  const m = description.match(re)
  if (!m) return null
  return m[1].slice(-4) // last 4 digits
}

// Auto-detect column roles from header names + data patterns
function autoDetectColumnRoles(sheet, headerRowIndex) {
  const cols = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)
  const roles = new Array(cols).fill('ignore')

  const DATE_KW        = ['תאריך עסקה', 'תאריך רכישה', 'transaction date']
  const BILLING_KW     = ['תאריך החיוב', 'תאריך חיוב', 'billing date', 'charge date']
  const DESC_KW        = ['תיאור', 'בית עסק', 'שם בית עסק', 'description', 'פרטים', 'מוטב', 'תיאור הפעולה', 'שם']
  const AMOUNT_KW      = ['סכום העסקה', 'סכום עסקה', "סכום בש\"ח", 'סכום המקור', 'amount']
  const BILLING_AMT_KW = ['סכום החיוב', 'סכום חיוב', 'billing amount']
  const CREDIT_KW      = ['זכות', 'credit', 'הפקדה', 'זיכוי', 'income']
  const DEBIT_KW       = ['חובה', 'debit', 'משיכה', 'expense']
  const COUNTRY_KW     = ['מדינה', 'country', 'ישראל', "חו\"ל", 'local', 'foreign', 'מקומי/חו"ל']
  const INSTALL_NUM_KW = ["מס' תשלום", 'מספר תשלום', 'תשלום מספר', 'תשלום נוכחי', 'payment number', 'installment number']
  const INSTALL_TOT_KW = ["מס' תשלומים", 'מספר תשלומים', "סה\"כ תשלומים", 'כמות תשלומים', 'total payments', 'installments']

  // Step 1: match headers — order matters: more specific first
  const headerRow = headerRowIndex >= 0 ? (sheet.rows[headerRowIndex] || []) : []
  headerRow.forEach((cell, i) => {
    if (!cell || roles[i] !== 'ignore') return
    const s = String(cell).trim().toLowerCase()
    if (BILLING_KW.some(k => s.includes(k)))          roles[i] = 'billingDate'
    else if (INSTALL_NUM_KW.some(k => s.includes(k))) roles[i] = 'installNum'
    else if (INSTALL_TOT_KW.some(k => s.includes(k))) roles[i] = 'installTotal'
    else if (DATE_KW.some(k => s.includes(k)))        roles[i] = 'date'
    else if (DESC_KW.some(k => s.includes(k)))        roles[i] = 'description'
    else if (BILLING_AMT_KW.some(k => s.includes(k))) roles[i] = 'billingAmount'
    else if (AMOUNT_KW.some(k => s.includes(k)))      roles[i] = 'amount'
    else if (CREDIT_KW.some(k => s.includes(k)))      roles[i] = 'credit'
    else if (DEBIT_KW.some(k => s.includes(k)))       roles[i] = 'debit'
    else if (COUNTRY_KW.some(k => s.includes(k)))     roles[i] = 'country'
  })

  // Fallback: if no date role found yet, look for any 'תאריך' column
  if (!roles.includes('date')) {
    headerRow.forEach((cell, i) => {
      if (!cell || roles[i] !== 'ignore') return
      const s = String(cell).trim().toLowerCase()
      if (s.includes('תאריך') || s.includes('date')) roles[i] = 'date'
    })
  }

  // Step 1b: if no country header matched, detect by data values (ישראל/חו"ל)
  if (!roles.includes('country')) {
    const dataRows2 = sheet.rows.slice(headerRowIndex + 1).filter(r => r?.some(c => c)).slice(0, 15)
    for (let i = 0; i < cols; i++) {
      if (roles[i] !== 'ignore') continue
      const vals = dataRows2.map(r => r?.[i]).filter(Boolean).map(String)
      const hits = vals.filter(v => /(ישראל|חו"ל|חול|israel|abroad|foreign)/i.test(v)).length
      if (hits >= Math.min(2, vals.length) && hits / vals.length >= 0.5) { roles[i] = 'country'; break }
    }
  }

  // Step 2: fill in missing roles from data patterns
  const dataRows = sheet.rows.slice(headerRowIndex + 1).filter(r => r?.some(c => c)).slice(0, 15)
  if (dataRows.length === 0) return roles

  function colVals(i) { return dataRows.map(r => r[i]).filter(Boolean).map(String) }

  if (!roles.includes('date')) {
    for (let i = 0; i < cols; i++) {
      if (roles[i] !== 'ignore') continue
      const vals = colVals(i)
      const hits = vals.filter(v => normalizeDate(v)).length
      if (hits >= Math.min(3, vals.length) && hits / vals.length >= 0.6) { roles[i] = 'date'; break }
    }
  }

  if (!roles.includes('amount') && !roles.includes('credit')) {
    for (let i = 0; i < cols; i++) {
      if (roles[i] !== 'ignore') continue
      const vals = colVals(i)
      const hits = vals.filter(v => !isNaN(parseFloat(v.replace(/,/g, '').replace(/[₪$€]/g, '')))).length
      if (hits >= Math.min(3, vals.length) && hits / vals.length >= 0.7) { roles[i] = 'amount'; break }
    }
  }

  if (!roles.includes('description')) {
    let bestIdx = -1, bestLen = 0
    for (let i = 0; i < cols; i++) {
      if (roles[i] !== 'ignore') continue
      const vals = colVals(i)
      const avg = vals.reduce((s, v) => s + v.length, 0) / (vals.length || 1)
      if (avg > bestLen && avg > 3) { bestLen = avg; bestIdx = i }
    }
    if (bestIdx >= 0) roles[bestIdx] = 'description'
  }

  return roles
}

// Auto-detect card number from file content (scans all cells)
function autoDetectCardFromFile(sheets) {
  const cardKeyword = /(?:ויזה|ישראכרט|מאסטר|מקס|max|visa|mastercard|diners|דיינרס|אמריקן|amex)/i
  const digitOnlyPattern = /^\s*(\d{4})\s*$/
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        if (!cell) continue
        const s = String(cell)
        // If cell contains a card-brand keyword, scan all 4-digit sequences in it
        if (cardKeyword.test(s)) {
          const allFour = [...s.matchAll(/(\d{4})/g)].map(m => m[1])
          for (const num of allFour) {
            if (ALL_KNOWN_CARDS.includes(num)) return REPLACED_CARDS[num] || num
          }
        }
        // Also match cells that are just 4 digits (card number column)
        const d = s.match(digitOnlyPattern)
        if (d && ALL_KNOWN_CARDS.includes(d[1])) return REPLACED_CARDS[d[1]] || d[1]
      }
    }
  }
  return null
}

/**
 * Given a list of dates (YYYY-MM-DD), detect if they span a billing cycle
 * of the form: 10th of month M to 9th of month M+1.
 * Returns { billingMonth: 'YYYY-MM', minDate, maxDate } or null.
 */
function detectBillingCycle(dates) {
  const valid = dates.filter(Boolean).sort()
  if (valid.length === 0) return null
  const minDate = valid[0]
  const maxDate = valid[valid.length - 1]
  const minDay = parseInt(minDate.slice(8, 10), 10)
  const maxDay = parseInt(maxDate.slice(8, 10), 10)
  const minMonth = minDate.slice(0, 7)
  const maxMonth = maxDate.slice(0, 7)

  // Spans two calendar months, starts around 10th, ends around 9th
  if (minMonth !== maxMonth && minDay >= 7 && minDay <= 13 && maxDay >= 7 && maxDay <= 13) {
    return { billingMonth: maxMonth, minDate, maxDate }
  }
  return null
}

/**
 * Detect gaps in bank coverage for a billing month.
 * Expected range: 10th of prev month → 9th of billing month.
 * Returns array of { from, to } date strings, or null if no gaps.
 */
function computeBankGaps(bankDates, billingMonth) {
  const [year, mon] = billingMonth.split('-').map(Number)
  const prevMon = mon === 1 ? 12 : mon - 1
  const prevYear = mon === 1 ? year - 1 : year
  const expectedStart = `${prevYear}-${String(prevMon).padStart(2, '0')}-10`
  const expectedEnd = `${billingMonth}-09`
  const today = new Date().toISOString().slice(0, 10)

  const datesInRange = [...new Set(bankDates)]
    .filter((d) => d >= expectedStart && d <= expectedEnd)
    .sort()

  if (datesInRange.length === 0) return null

  const msPerDay = 86400000
  function addDays(dateStr, n) {
    return new Date(new Date(dateStr).getTime() + n * msPerDay).toISOString().slice(0, 10)
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / msPerDay)
  }

  const gaps = []
  const first = datesInRange[0]
  const last = datesInRange[datesInRange.length - 1]

  // Gap at start of period (more than 3 days missing)
  if (daysBetween(expectedStart, first) > 3) {
    gaps.push({ from: expectedStart, to: addDays(first, -1) })
  }

  // Gap at end of period (only if the expected end is already in the past)
  if (expectedEnd <= today && daysBetween(last, expectedEnd) > 3) {
    gaps.push({ from: addDays(last, 1), to: expectedEnd })
  }

  return gaps.length > 0 ? gaps : null
}

function formatDateHeb(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`
}

// Dominant month among included draft rows
function dominantMonth(drafts, override) {
  if (override) return override
  const counts = {}
  drafts.filter((r) => r.include && r.date).forEach((r) => {
    const m = r.date.slice(0, 7)
    counts[m] = (counts[m] || 0) + 1
  })
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

export default function Import({ onDone }) {
  const { settings, transactions: existingTx, clearVersion, updateSettings, addTransactions } = useData()

  const [step, setStep] = useState('pick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileInfo, setFileInfo] = useState(null)
  const [sourceType, setSourceType] = useState('')
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRowIndex, setHeaderRowIndex] = useState(0)
  const [columnRoles, setColumnRoles] = useState([])
  const [fileType, setFileType] = useState('') // 'card-1029' | 'card-5825' | 'bank' | ''
  const [draftRows, setDraftRows] = useState([])
  const [billingCycle, setBillingCycle] = useState(null)
  const [billingMonthOverride, setBillingMonthOverride] = useState(null)
  const [unknownCards, setUnknownCards] = useState([])

  // Reset wizard when transactions are cleared from Settings
  useEffect(() => {
    if (clearVersion > 0) {
      setStep('pick')
      setFileInfo(null)
      setSourceType('')
      setFileType('')
      setColumnRoles([])
      setDraftRows([])
      setError('')
      setBillingCycle(null)
      setBillingMonthOverride(null)
      setUnknownCards([])
    }
  }, [clearVersion])

  // ── סטטוס קבצים: מחושב מהנתונים הקיימים ──
  const allMonths = useMemo(() => {
    return [...new Set(existingTx.map((t) => t.month).filter(Boolean))].sort().reverse()
  }, [existingTx])

  const recentMonth = allMonths[0] || null
  const [statusMonth, setStatusMonth] = useState('')

  // Reset statusMonth if the selected month was deleted from the data
  useEffect(() => {
    if (statusMonth && !allMonths.includes(statusMonth)) {
      setStatusMonth('')
    }
  }, [allMonths, statusMonth])

  const activeStatusMonth = statusMonth || recentMonth

  // אילו סוגי קבצים כבר יובאו לחודש הנבחר?
  // Replaced cards (e.g. card-5128) count as their replacement (card-1029)
  const importedFileTypes = useMemo(() => {
    if (!activeStatusMonth) return new Set()
    const types = new Set()
    existingTx
      .filter((t) => t.month === activeStatusMonth)
      .forEach((t) => {
        let ft = t.sourceFileType || (t.sourceFile ? detectFileType(t.sourceFile) : null)
        if (!ft) return
        // Map replaced card types to their current equivalent
        const cardMatch = ft.match(/^card-(\d+)$/)
        if (cardMatch && REPLACED_CARDS[cardMatch[1]]) {
          ft = `card-${REPLACED_CARDS[cardMatch[1]]}`
        }
        types.add(ft)
      })
    return types
  }, [existingTx, activeStatusMonth])

  // Detect date gaps in bank coverage for the selected billing month
  const bankGaps = useMemo(() => {
    if (!activeStatusMonth || !importedFileTypes.has('bank')) return null
    const [year, mon] = activeStatusMonth.split('-').map(Number)
    const prevMon = mon === 1 ? 12 : mon - 1
    const prevYear = mon === 1 ? year - 1 : year
    const expectedStart = `${prevYear}-${String(prevMon).padStart(2, '0')}-10`
    const expectedEnd = `${activeStatusMonth}-09`
    const bankDates = existingTx
      .filter((t) => {
        const ft = t.sourceFileType || (t.sourceFile ? detectFileType(t.sourceFile) : null)
        return ft === 'bank'
      })
      .map((t) => t.date)
      .filter((d) => d && d >= expectedStart && d <= expectedEnd)
    return computeBankGaps(bankDates, activeStatusMonth)
  }, [existingTx, activeStatusMonth, importedFileTypes])

  const mappingNames = Object.keys(settings.importMappings || {})

  async function handlePickFile() {
    setError('')
    const picked = await window.api.pickImportFile()
    if (picked.canceled) return
    setBusy(true)
    try {
      const parsed = await window.api.parseImportFile(picked.filePath)
      setFileInfo(parsed)
      setSheetIndex(0)
      const sheet = parsed.sheets[0]
      const hdr = sheet.suggestedHeaderRowIndex ?? 0
      setHeaderRowIndex(hdr)

      // Auto-detect column roles
      setColumnRoles(autoDetectColumnRoles(sheet, hdr))

      // Auto-detect file type:
      const fileName = (picked.filePath || '').replace(/\\/g, '/')
      const baseName = fileName.split('/').pop() || ''

      // 1. File name contains "עובר ושב" or "עוש" → bank statement
      const isBankByName = /עובר.?ושב|עו.?ש/i.test(baseName)

      // 1b. File name contains a known card number → card (e.g. "דיינרס 1937")
      const cardByFileName = (() => {
        if (isBankByName) return null
        for (const card of ALL_KNOWN_CARDS) {
          if (baseName.includes(card)) return REPLACED_CARDS[card] || card
        }
        return null
      })()

      // 2. Columns include both credit & debit → bank statement
      const detectedRoles = autoDetectColumnRoles(sheet, hdr)
      const hasCreditDebit = detectedRoles.includes('credit') && detectedRoles.includes('debit')

      if (isBankByName || (hasCreditDebit && !cardByFileName)) {
        setFileType('bank')
      } else if (cardByFileName) {
        setFileType(`card-${cardByFileName}`)
      } else {
        const detectedCard = autoDetectCardFromFile(parsed.sheets)
        if (detectedCard) {
          const mappedCard = REPLACED_CARDS[detectedCard] || detectedCard
          if (KNOWN_CARDS.includes(mappedCard) || OCCASIONAL_CARDS.includes(mappedCard)) {
            setFileType(`card-${detectedCard}`)
          } else {
            setFileType('bank') // unknown card
          }
        } else {
          setFileType('bank')
        }
      }

      setStep('map')
    } catch (e) {
      setError('לא הצלחתי לקרוא את הקובץ: ' + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  function applySourceType(name) {
    setSourceType(name)
    const saved = (settings.importMappings || {})[name]
    if (saved && fileInfo) {
      const sheet = fileInfo.sheets[saved.sheetIndex] || fileInfo.sheets[sheetIndex]
      const cols = columnCount(sheet)
      if (saved.columnRoles && saved.columnRoles.length === cols) {
        setSheetIndex(saved.sheetIndex || 0)
        setHeaderRowIndex(saved.headerRowIndex)
        setColumnRoles(saved.columnRoles)
      }
    }
  }

  function setColumnRole(idx, role) {
    setColumnRoles((prev) => {
      const next = [...prev]
      next[idx] = role
      return next
    })
  }

  function buildDraftRows() {
    const sheet = fileInfo.sheets[sheetIndex]
    const dataRows = sheet.rows.slice(headerRowIndex + 1)
    const dateIdx          = columnRoles.indexOf('date')
    const billingDateIdx   = columnRoles.indexOf('billingDate')
    const descIdx          = columnRoles.indexOf('description')
    const amountIdx        = columnRoles.indexOf('amount')
    const billingAmountIdx = columnRoles.indexOf('billingAmount')
    const creditIdx        = columnRoles.indexOf('credit')
    const debitIdx         = columnRoles.indexOf('debit')
    const countryIdx     = columnRoles.indexOf('country')
    const installNumIdx  = columnRoles.indexOf('installNum')
    const installTotIdx  = columnRoles.indexOf('installTotal')

    const rules = settings.rules || []
    const drafts = []
    const foundUnknownCards = new Set()

    for (const row of dataRows) {
      if (!row || row.every((c) => !String(c).trim())) continue

      const description = descIdx >= 0 ? row[descIdx] || '' : ''
      const rawDate = dateIdx >= 0 ? row[dateIdx] : ''
      const rawBillingDate = billingDateIdx >= 0 ? row[billingDateIdx] : ''
      const countryVal = countryIdx >= 0 ? String(row[countryIdx] || '').trim() : ''
      const isForeign = /חו"ל|חול|abroad|foreign/i.test(countryVal)
      const date = normalizeDate(rawDate)
      const billingDate = normalizeDate(rawBillingDate)
      const billingMonth = billingDate ? billingDate.slice(0, 7) : null

      let signed = 0
      if (billingAmountIdx >= 0 && row[billingAmountIdx] !== undefined && row[billingAmountIdx] !== '') {
        // Prefer billing amount (per-installment charge) over total transaction amount
        signed = normalizeAmount(row[billingAmountIdx])
        // Billing amount may be negative in some formats; treat as expense if card file
        if (signed === 0 && amountIdx >= 0) signed = normalizeAmount(row[amountIdx])
      } else if (amountIdx >= 0) {
        signed = normalizeAmount(row[amountIdx])
      } else {
        const credit = creditIdx >= 0 ? normalizeAmount(row[creditIdx]) : 0
        const debit = debitIdx >= 0 ? normalizeAmount(row[debitIdx]) : 0
        signed = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0)
      }

      if (!date && !description && signed === 0) continue

      const isCardAgg = isLikelyCardAggregate(description)
      const isBalanceCarry = isLikelyBalanceCarry(description)

      // Detect card numbers in aggregate rows that aren't one of our known cards
      if (isCardAgg) {
        const cardNum = extractCardNumber(description)
        if (cardNum && !KNOWN_CARDS.includes(cardNum)) {
          foundUnknownCards.add(cardNum)
        }
      }

      // Installment detection — from dedicated columns or description text
      let installmentCurrent = null
      let installmentTotal = null
      if (installNumIdx >= 0) {
        const v = parseInt(row[installNumIdx])
        if (!isNaN(v) && v > 0) installmentCurrent = v
      }
      if (installTotIdx >= 0) {
        const v = parseInt(row[installTotIdx])
        if (!isNaN(v) && v > 1) installmentTotal = v
      }
      if (!installmentCurrent || !installmentTotal) {
        // Scan ALL cells in the row for installment patterns (e.g. "פירוט" column)
        const INSTALL_RE = [
          /תשלום\s+(\d+)\s+(?:מתוך|מ-?)\s*(\d+)/i,
          /(\d+)\s+מ\s*-\s*(\d+)/,
          /\((\d+)\/(\d+)\)/,
          /(\d+)\s+מתוך\s+(\d+)/,
        ]
        outer: for (const cell of row) {
          const s = String(cell || '').trim()
          if (!s) continue
          for (const re of INSTALL_RE) {
            const m = s.match(re)
            if (m) {
              installmentCurrent = installmentCurrent || parseInt(m[1])
              installmentTotal   = installmentTotal   || parseInt(m[2])
              break outer
            }
          }
        }
      }
      // Only keep if both present and total > 1 (single payment = not installment)
      if (!installmentTotal || installmentTotal <= 1) { installmentCurrent = null; installmentTotal = null }

      // Store original transaction amount (total purchase) for installment display
      const originalAmount = (installmentTotal > 1 && amountIdx >= 0 && billingAmountIdx >= 0)
        ? Math.abs(normalizeAmount(row[amountIdx]))
        : null

      const rule = suggestFromRules(description, rules)
      const categories = settings.categories || []
      const people = settings.people || []
      const fallbackCategory = isForeign && categories.includes('עסקאות חו"ל')
        ? 'עסקאות חו"ל'
        : categories.includes('אחר') ? 'אחר' : categories[0] || ''
      const fallbackPerson = people.includes('בית') ? 'בית' : people[0] || ''

      // Duplicate detection: same date + same amount + similar description
      // For installments: only a duplicate if the installment number also matches
      const isDuplicate = date && signed !== 0 && existingTx.some((t) => {
        if (t.date !== date) return false
        if (Math.abs(t.amount - Math.abs(signed)) > 1) return false
        const descA = (t.sourceDescription || '').trim().slice(0, 15).toLowerCase()
        const descB = description.trim().slice(0, 15).toLowerCase()
        if (descA !== descB) return false
        // If both are installments with different installment numbers → not a duplicate
        if (installmentCurrent && t.installmentCurrent && t.installmentCurrent !== installmentCurrent) return false
        return true
      })

      drafts.push({
        _key: uuidv4(),
        include: date !== null && signed !== 0 && !isBalanceCarry && !isCardAgg && !isDuplicate,
        date: date || '',
        billingMonth,
        dateInvalid: !date,
        note: '',
        sourceDescription: description,
        type: rule?.type || (signed < 0 ? 'expense' : fileType.startsWith('card-') ? 'expense' : 'income'),
        category: rule?.category || fallbackCategory,
        person: rule?.person || fallbackPerson,
        isFixed: rule?.isFixed || false,
        amount: Math.abs(signed),
        originalAmount,
        installmentCurrent,
        installmentTotal,
        warning: isCardAgg ? 'card-aggregate' : isBalanceCarry ? 'balance-carry' : isDuplicate ? 'duplicate' : null,
        addRule: false,
        ruleKeyword: description.length > 40 ? description.slice(0, 40) : description
      })
    }

    // Detect billing cycle
    const validDates = drafts.filter((d) => d.date && d.amount > 0).map((d) => d.date)
    const cycle = detectBillingCycle(validDates)
    setBillingCycle(cycle)
    setBillingMonthOverride(cycle ? cycle.billingMonth : null)

    setUnknownCards([...foundUnknownCards])
    setDraftRows(drafts)
    setStep('review')
  }

  function updateDraft(key, patch) {
    setDraftRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  }

  function setAllIncluded(include) {
    setDraftRows((prev) => prev.map((r) => ({ ...r, include })))
  }

  function confirmImport() {
    const toSave = draftRows.filter((r) => r.include && r.date && r.amount > 0)
    const now = new Date().toISOString()
    const month = dominantMonth(draftRows, billingMonthOverride)

    const newTx = toSave.map((r) => {
      // Priority: manual override > per-row billing date column > transaction date
      const assignedMonth = billingMonthOverride || r.billingMonth || monthOf(r.date)
      return {
        id: uuidv4(),
        date: r.date,
        month: assignedMonth,
        type: r.type,
        category: r.category,
        person: r.person,
        amount: r.amount,
        isFixed: !!r.isFixed,
        note: r.note,
        sourceDescription: r.sourceDescription,
        sourceFile: fileInfo.fileName,
        sourceFileType: fileType || detectFileType(fileInfo.fileName),
        importedAt: now,
        ...(r.installmentTotal > 1 ? { installmentCurrent: r.installmentCurrent, installmentTotal: r.installmentTotal, originalAmount: r.originalAmount } : {})
      }
    })
    addTransactions(newTx)

    const newRules = draftRows
      .filter((r) => r.addRule && r.ruleKeyword.trim())
      .map((r) => ({
        keyword: r.ruleKeyword.trim(),
        category: r.category,
        person: r.person,
        isFixed: !!r.isFixed,
        type: r.type
      }))

    const nextSettings = { ...settings }
    if (newRules.length) {
      nextSettings.rules = [...(settings.rules || []), ...newRules]
    }
    if (sourceType.trim()) {
      nextSettings.importMappings = {
        ...(settings.importMappings || {}),
        [sourceType.trim()]: { sheetIndex, headerRowIndex, columnRoles }
      }
    }
    updateSettings(nextSettings)

    // Set status panel to the dominant ASSIGNED month (billing date takes priority over transaction date)
    const assignedCounts = {}
    toSave.forEach((r) => {
      const m = billingMonthOverride || r.billingMonth || monthOf(r.date)
      if (m) assignedCounts[m] = (assignedCounts[m] || 0) + 1
    })
    const importedMonth = Object.entries(assignedCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || billingMonthOverride || month
    if (importedMonth) setStatusMonth(importedMonth)

    setStep('done')
  }

  function resetWizard() {
    setStep('pick')
    setFileInfo(null)
    setSourceType('')
    setFileType('')
    setColumnRoles([])
    setDraftRows([])
    setError('')
    setBillingCycle(null)
    setBillingMonthOverride(null)
    setUnknownCards([])
  }

  const includedCount = draftRows.filter((r) => r.include).length
  const includedTotal = draftRows.filter((r) => r.include).reduce((a, r) => a + r.amount, 0)
  const duplicateCount = draftRows.filter((r) => r.warning === 'duplicate').length

  const expectedFiles = [
    ...KNOWN_CARDS.map((c) => ({ type: `card-${c}`, label: `כרטיס ${c}` })),
    { type: 'bank', label: 'עובר ושב' }
  ]
  const missingFiles = expectedFiles.filter((f) => !importedFileTypes.has(f.type))
  const allDone = activeStatusMonth && missingFiles.length === 0

  return (
    <div>
      <h2 className="page-title">ייבוא קובץ</h2>

      <div className="wizard-steps">
        <StepPill label="1. בחירת קובץ" active={step === 'pick'} done={step !== 'pick'} />
        <StepPill label="2. מיפוי עמודות" active={step === 'map'} done={step === 'review' || step === 'done'} />
        <StepPill label="3. בדיקה ואישור" active={step === 'review'} done={step === 'done'} />
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--critical)', color: 'var(--critical)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === 'pick' && (
        <>
          {/* ── סטטוס קבצים לחודש האחרון ── */}
          {activeStatusMonth && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                borderColor: allDone ? 'var(--success)' : 'var(--critical)',
                background: allDone ? 'rgba(0,99,0,0.05)' : 'rgba(208,59,59,0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>{allDone ? '✅' : '⚠'} סטטוס קבצים —</span>
                <select
                  value={activeStatusMonth}
                  onChange={(e) => setStatusMonth(e.target.value)}
                  style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, fontWeight: 600 }}
                >
                  {allMonths.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {expectedFiles.map((f) => {
                  const done = importedFileTypes.has(f.type)
                  return (
                    <div key={f.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ fontSize: 15 }}>{done ? '✅' : '❌'}</span>
                      <span style={{ color: done ? 'var(--success)' : 'var(--critical)', fontWeight: done ? 400 : 700 }}>
                        {f.label}
                        {!done && ' — טרם יובא'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {bankGaps && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(250,178,25,0.12)', border: '1px solid rgba(250,178,25,0.4)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#96690a', marginBottom: 4 }}>
                    ⚠ עו"ש — ייתכן הורדה חלקית, תאריכים חסרים:
                  </div>
                  {bankGaps.map((g, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#96690a', marginTop: 2 }}>
                      • {formatDateHeb(g.from)} עד {formatDateHeb(g.to)}
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    הורידי קובץ עו"ש לתקופה החסרה ויובא אוטומטית
                  </div>
                </div>
              )}
              {!allDone && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--critical)', fontWeight: 600 }}>
                  חסרים: {missingFiles.map((f) => f.label).join(', ')}
                </div>
              )}
              {allDone && !bankGaps && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  כל הקבצים לחודש זה יובאו בהצלחה!
                </div>
              )}
              {allDone && bankGaps && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#96690a', fontWeight: 600 }}>
                  כל הקבצים יובאו — אך עו"ש עשוי להיות חלקי (ראי למעלה)
                </div>
              )}
            </div>
          )}

          <div className="card">
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
              אפשר לייבא קובץ Excel או PDF - דף עו"ש מהבנק, או דף אשראי מפורט (ויזה/ישראכרט/מקס). לכל שורה תוצע קטגוריה
              אוטומטית לפי חוקים קיימים, ותהיה הזדמנות לבדוק ולערוך הכל לפני שמירה.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>
              כל חודש יש לייבא: כרטיס {KNOWN_CARDS[0]}, כרטיס {KNOWN_CARDS[1]}, ועובר ושב.
            </p>
            <button className="btn primary" onClick={handlePickFile} disabled={busy}>
              {busy ? 'טוען...' : 'בחירת קובץ'}
            </button>
          </div>
        </>
      )}

      {step === 'map' && fileInfo && (
        <MappingStep
          fileInfo={fileInfo}
          sourceType={sourceType}
          mappingNames={mappingNames}
          onSourceTypeChange={applySourceType}
          fileType={fileType}
          setFileType={setFileType}
          knownCards={KNOWN_CARDS}
          sheetIndex={sheetIndex}
          setSheetIndex={setSheetIndex}
          headerRowIndex={headerRowIndex}
          setHeaderRowIndex={setHeaderRowIndex}
          columnRoles={columnRoles}
          setColumnRole={setColumnRole}
          onBack={resetWizard}
          onNext={buildDraftRows}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          draftRows={draftRows}
          updateDraft={updateDraft}
          setAllIncluded={setAllIncluded}
          categories={settings.categories || []}
          people={settings.people || []}
          includedCount={includedCount}
          includedTotal={includedTotal}
          duplicateCount={duplicateCount}
          unknownCards={unknownCards}
          billingCycle={billingCycle}
          billingMonthOverride={billingMonthOverride}
          setBillingMonthOverride={setBillingMonthOverride}
          onBack={() => setStep('map')}
          onConfirm={confirmImport}
        />
      )}

      {step === 'done' && (
        <>
          <div className="card">
            <p>הייבוא הושלם בהצלחה! {includedCount} תנועות נוספו.</p>
            <button className="btn primary" onClick={resetWizard} style={{ marginLeft: 8 }}>
              ייבוא קובץ נוסף
            </button>
            <button className="btn" onClick={onDone}>
              מעבר לתנועות
            </button>
          </div>
          {activeStatusMonth && (
            <div
              className="card"
              style={{
                marginTop: 12,
                borderColor: allDone ? 'var(--success)' : 'var(--critical)',
                background: allDone ? 'rgba(0,99,0,0.05)' : 'rgba(208,59,59,0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>{allDone ? '✅' : '⚠'} סטטוס קבצים —</span>
                <select
                  value={activeStatusMonth}
                  onChange={(e) => setStatusMonth(e.target.value)}
                  style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, fontWeight: 600 }}
                >
                  {allMonths.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {expectedFiles.map((f) => {
                  const done = importedFileTypes.has(f.type)
                  return (
                    <div key={f.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ fontSize: 15 }}>{done ? '✅' : '❌'}</span>
                      <span style={{ color: done ? 'var(--success)' : 'var(--critical)', fontWeight: done ? 400 : 700 }}>
                        {f.label}
                        {!done && ' — טרם יובא'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {bankGaps && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(250,178,25,0.12)', border: '1px solid rgba(250,178,25,0.4)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#96690a', marginBottom: 4 }}>
                    ⚠ עו"ש — ייתכן הורדה חלקית, תאריכים חסרים:
                  </div>
                  {bankGaps.map((g, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#96690a', marginTop: 2 }}>
                      • {formatDateHeb(g.from)} עד {formatDateHeb(g.to)}
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    הורידי קובץ עו"ש לתקופה החסרה ויובא אוטומטית
                  </div>
                </div>
              )}
              {!allDone && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--critical)', fontWeight: 600 }}>
                  חסרים: {missingFiles.map((f) => f.label).join(', ')}
                </div>
              )}
              {allDone && !bankGaps && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  כל הקבצים לחודש זה יובאו בהצלחה!
                </div>
              )}
              {allDone && bankGaps && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#96690a', fontWeight: 600 }}>
                  כל הקבצים יובאו — אך עו"ש עשוי להיות חלקי (ראי למעלה)
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function columnCount(sheet) {
  return sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)
}

function StepPill({ label, active, done }) {
  return <div className={'wizard-step' + (active ? ' active' : '') + (done ? ' done' : '')}>{label}</div>
}

function MappingStep({
  fileInfo, sourceType, mappingNames, onSourceTypeChange,
  fileType, setFileType, knownCards,
  sheetIndex, setSheetIndex, headerRowIndex, setHeaderRowIndex,
  columnRoles, setColumnRole, onBack, onNext
}) {
  const sheet = fileInfo.sheets[sheetIndex]
  const previewRows = sheet.rows.slice(0, 14)
  const dataPreview = sheet.rows.slice(headerRowIndex + 1, headerRowIndex + 6)
  const cols = columnCount(sheet)

  const rolesUsed = { date: columnRoles.includes('date'), amountLike: columnRoles.some((r) => ['amount', 'credit', 'debit'].includes(r)) }
  const canProceed = rolesUsed.date && rolesUsed.amountLike && !!fileType

  return (
    <div className="card">
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: '0.9375rem' }}>
        טענו את הקובץ שבחרת - עכשיו רק צריך לעזור לנו להבין אותו, בשני צעדים קצרים: <strong>קודם</strong> לסמן איזו
        שורה בטבלה למטה היא שורת הכותרות, <strong>ואז</strong> להגיד לנו איזו עמודה היא תאריך, תיאור, וסכום.
      </p>

      <div className="form-row">
        <label>סוג קובץ</label>
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          style={{ flex: 1, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontWeight: fileType ? 600 : 400 }}
        >
          <option value="">— בחרי סוג קובץ —</option>
          {knownCards.map((c) => (
            <option key={c} value={`card-${c}`}>כרטיס {c}</option>
          ))}
          {Object.entries(REPLACED_CARDS).map(([old]) => (
            <option key={old} value={`card-${old}`}>כרטיס {old}</option>
          ))}
          {OCCASIONAL_CARDS.map((c) => (
            <option key={c} value={`card-${c}`}>כרטיס {c}</option>
          ))}
          <option value="bank">עובר ושב</option>
        </select>
      </div>

      <div className="form-row">
        <label>שם מקור</label>
        <input
          list="source-types"
          value={sourceType}
          onChange={(e) => onSourceTypeChange(e.target.value)}
          placeholder='למשל: ויזה / ישראכרט / בנק דיסקונט'
          style={{ flex: 1 }}
        />
        <datalist id="source-types">
          {mappingNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: -4 }}>
        תנו שם לסוג המקור - אם בפעם הבאה תבחרו את אותו שם, המיפוי יתמלא אוטומטית.
      </p>

      {fileInfo.sheets.length > 1 && (
        <div className="form-row">
          <label>גיליון</label>
          <select value={sheetIndex} onChange={(e) => {
            const idx = parseInt(e.target.value, 10)
            setSheetIndex(idx)
            const s = fileInfo.sheets[idx]
            const hdr = s.suggestedHeaderRowIndex ?? 0
            setHeaderRowIndex(hdr)
            setColumnRoles(autoDetectColumnRoles(s, hdr))
          }}>
            {fileInfo.sheets.map((s, i) => (
              <option key={s.name} value={i}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="section-title">צעד 1 - שורת הכותרות</div>
      <div className="card" style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
        <table className="data-table">
          <tbody>
            <tr>
              <td></td>
              {Array.from({ length: cols }).map((_, i) => (
                <td key={i} style={{ color: 'var(--text-muted)' }}>עמודה {i + 1}</td>
              ))}
            </tr>
            <tr>
              <td>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" checked={headerRowIndex === -1} onChange={() => setHeaderRowIndex(-1)} />
                  אין שורת כותרות
                </label>
              </td>
              <td colSpan={cols}></td>
            </tr>
            {previewRows.map((row, i) => (
              <tr key={i}>
                <td>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="radio" checked={headerRowIndex === i} onChange={() => setHeaderRowIndex(i)} />
                    שורה {i + 1}
                  </label>
                </td>
                {Array.from({ length: cols }).map((_, ci) => (
                  <td key={ci}>{row[ci]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">צעד 2 - מה יש בכל עמודה?</div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <select value={columnRoles[i] || 'ignore'} onChange={(e) => setColumnRole(i, e.target.value)}>
                    {ROLE_KEYS.map((k) => (
                      <option key={k} value={k}>{ROLE_LABELS[k]}</option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataPreview.map((row, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }).map((_, ci) => (
                  <td key={ci}>{row[ci]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!fileType && (
        <p style={{ color: 'var(--critical)', fontSize: 13 }}>יש לבחור סוג קובץ (כרטיס / עובר ושב) כדי להמשיך.</p>
      )}
      {fileType && !rolesUsed.date && (
        <p style={{ color: 'var(--critical)', fontSize: 13 }}>יש לבחור לפחות עמודת תאריך ועמודת סכום כדי להמשיך.</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={onBack}>חזרה</button>
        <button className="btn primary" onClick={onNext} disabled={!canProceed}>המשך לבדיקה</button>
      </div>
    </div>
  )
}

function ReviewStep({
  draftRows, updateDraft, setAllIncluded, categories, people,
  includedCount, includedTotal, duplicateCount, unknownCards,
  billingCycle, billingMonthOverride, setBillingMonthOverride,
  onBack, onConfirm
}) {
  const allSelected = draftRows.length > 0 && includedCount === draftRows.length

  return (
    <div>
      {/* ── זיהוי מחזור חיוב ── */}
      {billingCycle && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--series-1)', background: 'rgba(42,120,214,0.06)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            📅 זיהינו מחזור חיוב: {formatDateHeb(billingCycle.minDate)} – {formatDateHeb(billingCycle.maxDate)}
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
            כל התנועות ייוחסו לחודש הבא (חודש החיוב). ניתן לשנות:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13 }}>חודש חיוב:</label>
            <input
              type="month"
              value={billingMonthOverride || ''}
              onChange={(e) => setBillingMonthOverride(e.target.value || null)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)' }}
            />
            <button className="btn" style={{ fontSize: 12 }} onClick={() => setBillingMonthOverride(null)}>
              השתמש בתאריך מקורי של כל שורה
            </button>
          </div>
        </div>
      )}

      {/* ── אזהרת כרטיסים חוץ בנקאיים נוספים ── */}
      {unknownCards.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning)', background: 'rgba(250,178,25,0.07)' }}>
          <strong>🃏 זוהו הוצאות מכרטיסים נוספים בקובץ זה:</strong>{' '}
          {unknownCards.map((c) => (
            <span key={c} className="badge warn" style={{ marginRight: 4 }}>כרטיס ...{c}</span>
          ))}
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            ייתכן שחסרים קבצי אשראי לכרטיסים אלו — יש לייבא אותם בנפרד כדי לקבל תמונה מלאה.
          </div>
        </div>
      )}

      {/* ── אזהרת כפילויות ── */}
      {duplicateCount > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning)', background: 'rgba(250,178,25,0.07)' }}>
          <strong>⚠ זוהו {duplicateCount} תנועות שנראות כבר קיימות במערכת</strong> (אותו תאריך + סכום + תיאור דומה).
          הן סומנו אוטומטית כ"לא לייבוא" כדי למנוע כפילויות. ניתן לסמן אותן בחזרה אם זו שגיאה.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0 }}>
          נמצאו <strong>{draftRows.length}</strong> שורות. מסומנות לייבוא: <strong>{includedCount}</strong>, בסך{' '}
          <strong>{formatMoney(includedTotal)}</strong>.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button className="btn" onClick={() => setAllIncluded(true)}>סימון הכל</button>
        <button className="btn" onClick={() => setAllIncluded(false)}>ביטול סימון הכל</button>
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allSelected} onChange={(e) => setAllIncluded(e.target.checked)} />
              </th>
              <th>תאריך</th>
              <th>תיאור מקורי</th>
              <th>סוג</th>
              <th>קטגוריה</th>
              <th>עבור מי</th>
              <th>קבוע?</th>
              <th>סכום</th>
              <th>חוק להבא</th>
            </tr>
          </thead>
          <tbody>
            {draftRows.map((r) => (
              <tr key={r._key} style={{ opacity: r.include ? 1 : 0.45 }}>
                <td>
                  <input type="checkbox" checked={r.include} onChange={(e) => updateDraft(r._key, { include: e.target.checked })} />
                </td>
                <td>
                  {r.dateInvalid ? (
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => updateDraft(r._key, { date: e.target.value, dateInvalid: false })}
                    />
                  ) : (
                    r.date
                  )}
                </td>
                <td style={{ maxWidth: 220 }}>
                  {r.sourceDescription}
                  {r.installmentTotal > 1 && (
                    <div>
                      <span className="badge" style={{ background: 'rgba(42,120,214,0.13)', color: 'var(--series-1)', fontSize: 11 }}>
                        תשלום {r.installmentCurrent}/{r.installmentTotal} · נותר: {r.installmentTotal - r.installmentCurrent}
                      </span>
                    </div>
                  )}
                  {r.warning === 'card-aggregate' && (
                    <div>
                      <span className="badge warn" title="סכום מרוכז מכרטיס אשראי - יתכן כפל">
                        ⚠ ריכוז אשראי - יתכן כפל
                      </span>
                    </div>
                  )}
                  {r.warning === 'balance-carry' && (
                    <div><span className="badge muted">יתרת פתיחה</span></div>
                  )}
                  {r.warning === 'duplicate' && (
                    <div>
                      <span className="badge" style={{ background: 'rgba(250,178,25,0.2)', color: '#96690a' }}>
                        ⚠ כנראה קיים כבר
                      </span>
                    </div>
                  )}
                </td>
                <td>
                  <select value={r.type} onChange={(e) => updateDraft(r._key, { type: e.target.value })}>
                    <option value="expense">הוצאה</option>
                    <option value="income">הכנסה</option>
                  </select>
                </td>
                <td>
                  <CategorySelect
                    value={r.category}
                    categories={categories}
                    onChange={(c) => updateDraft(r._key, { category: c })}
                    style={{ minWidth: 130 }}
                  />
                </td>
                <td>
                  <select value={r.person} onChange={(e) => updateDraft(r._key, { person: e.target.value })}>
                    {people.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={r.isFixed} onChange={(e) => updateDraft(r._key, { isFixed: e.target.checked })} />
                </td>
                <td style={{ fontWeight: 600, color: r.type === 'income' ? 'var(--success)' : 'var(--critical)', whiteSpace: 'nowrap' }}>
                  {r.type === 'income' ? '+' : '−'}{formatMoney(r.amount)}
                </td>
                <td>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={r.addRule} onChange={(e) => updateDraft(r._key, { addRule: e.target.checked })} />
                    <input
                      type="text"
                      value={r.ruleKeyword}
                      onChange={(e) => updateDraft(r._key, { ruleKeyword: e.target.value })}
                      style={{ width: 110, fontSize: 12 }}
                      disabled={!r.addRule}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={onBack}>חזרה למיפוי</button>
        <button className="btn primary" onClick={onConfirm} disabled={includedCount === 0}>
          אישור וייבוא {includedCount} תנועות
        </button>
      </div>
    </div>
  )
}
