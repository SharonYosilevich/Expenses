import React, { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useData } from '../DataContext.jsx'
import { normalizeDate, normalizeAmount } from '../lib/parseDate.js'
import { monthOf } from '../lib/aggregate.js'
import { suggestFromRules, isLikelyCardAggregate, isLikelyBalanceCarry } from '../lib/categorize.js'
import { formatMoney } from './Dashboard.jsx'

const ROLE_LABELS = {
  ignore: '— התעלם —',
  date: 'תאריך',
  description: 'תיאור',
  amount: 'סכום (עם סימן)',
  credit: 'זכות (כסף נכנס)',
  debit: 'חובה (כסף יוצא)'
}
const ROLE_KEYS = Object.keys(ROLE_LABELS)

export default function Import({ onDone }) {
  const { settings, updateSettings, addTransactions } = useData()
  const [step, setStep] = useState('pick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileInfo, setFileInfo] = useState(null) // {fileName, kind, sheets}
  const [sourceType, setSourceType] = useState('')
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRowIndex, setHeaderRowIndex] = useState(0)
  const [columnRoles, setColumnRoles] = useState([])
  const [draftRows, setDraftRows] = useState([])

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
      setHeaderRowIndex(sheet.suggestedHeaderRowIndex ?? 0)
      setColumnRoles(new Array(columnCount(sheet)).fill('ignore'))
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
    const dateIdx = columnRoles.indexOf('date')
    const descIdx = columnRoles.indexOf('description')
    const amountIdx = columnRoles.indexOf('amount')
    const creditIdx = columnRoles.indexOf('credit')
    const debitIdx = columnRoles.indexOf('debit')

    const rules = settings.rules || []
    const drafts = []

    for (const row of dataRows) {
      if (!row || row.every((c) => !String(c).trim())) continue

      const description = descIdx >= 0 ? row[descIdx] || '' : ''
      const rawDate = dateIdx >= 0 ? row[dateIdx] : ''
      const date = normalizeDate(rawDate)

      let signed = 0
      if (amountIdx >= 0) {
        signed = normalizeAmount(row[amountIdx])
      } else {
        const credit = creditIdx >= 0 ? normalizeAmount(row[creditIdx]) : 0
        const debit = debitIdx >= 0 ? normalizeAmount(row[debitIdx]) : 0
        signed = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0)
      }

      if (!date && !description && signed === 0) continue

      const isCardAgg = isLikelyCardAggregate(description)
      const isBalanceCarry = isLikelyBalanceCarry(description)
      const rule = suggestFromRules(description, rules)
      const categories = settings.categories || []
      const people = settings.people || []
      // Unmatched rows fall into "אחר"/"בית" (neutral placeholders that make
      // "needs review" visible) rather than silently defaulting to whichever
      // category happens to be first in the list.
      const fallbackCategory = categories.includes('אחר') ? 'אחר' : categories[0] || ''
      const fallbackPerson = people.includes('בית') ? 'בית' : people[0] || ''

      drafts.push({
        _key: uuidv4(),
        include: date !== null && signed !== 0 && !isBalanceCarry && !isCardAgg,
        date: date || '',
        dateInvalid: !date,
        note: '',
        sourceDescription: description,
        type: rule?.type || (signed >= 0 ? 'income' : 'expense'),
        category: rule?.category || fallbackCategory,
        person: rule?.person || fallbackPerson,
        isFixed: rule?.isFixed || false,
        amount: Math.abs(signed),
        warning: isCardAgg ? 'card-aggregate' : isBalanceCarry ? 'balance-carry' : null,
        addRule: false,
        ruleKeyword: description.length > 40 ? description.slice(0, 40) : description
      })
    }
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
    const newTx = toSave.map((r) => ({
      id: uuidv4(),
      date: r.date,
      month: monthOf(r.date),
      type: r.type,
      category: r.category,
      person: r.person,
      amount: r.amount,
      isFixed: !!r.isFixed,
      note: r.note,
      sourceDescription: r.sourceDescription,
      sourceFile: fileInfo.fileName,
      importedAt: now
    }))
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

    setStep('done')
  }

  function resetWizard() {
    setStep('pick')
    setFileInfo(null)
    setSourceType('')
    setColumnRoles([])
    setDraftRows([])
    setError('')
  }

  const includedCount = draftRows.filter((r) => r.include).length
  const includedTotal = draftRows.filter((r) => r.include).reduce((a, r) => a + r.amount, 0)

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
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            אפשר לייבא קובץ Excel או PDF - דף עו"ש מהבנק, או דף אשראי מפורט (ויזה/ישראכרט/מקס). לכל שורה תוצע קטגוריה
            אוטומטית לפי חוקים קיימים, ותהיה הזדמנות לבדוק ולערוך הכל לפני שמירה.
          </p>
          <button className="btn primary" onClick={handlePickFile} disabled={busy}>
            {busy ? 'טוען...' : 'בחירת קובץ'}
          </button>
        </div>
      )}

      {step === 'map' && fileInfo && (
        <MappingStep
          fileInfo={fileInfo}
          sourceType={sourceType}
          mappingNames={mappingNames}
          onSourceTypeChange={applySourceType}
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
          onBack={() => setStep('map')}
          onConfirm={confirmImport}
        />
      )}

      {step === 'done' && (
        <div className="card">
          <p>הייבוא הושלם בהצלחה! {includedCount} תנועות נוספו.</p>
          <button className="btn primary" onClick={resetWizard} style={{ marginLeft: 8 }}>
            ייבוא קובץ נוסף
          </button>
          <button className="btn" onClick={onDone}>
            מעבר לתנועות
          </button>
        </div>
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
  fileInfo,
  sourceType,
  mappingNames,
  onSourceTypeChange,
  sheetIndex,
  setSheetIndex,
  headerRowIndex,
  setHeaderRowIndex,
  columnRoles,
  setColumnRole,
  onBack,
  onNext
}) {
  const sheet = fileInfo.sheets[sheetIndex]
  const previewRows = sheet.rows.slice(0, 14)
  const dataPreview = sheet.rows.slice(headerRowIndex + 1, headerRowIndex + 6)
  const cols = columnCount(sheet)

  const rolesUsed = { date: columnRoles.includes('date'), amountLike: columnRoles.some((r) => ['amount', 'credit', 'debit'].includes(r)) }
  const canProceed = rolesUsed.date && rolesUsed.amountLike

  return (
    <div className="card">
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: '0.9375rem' }}>
        טענו את הקובץ שבחרת - עכשיו רק צריך לעזור לנו להבין אותו, בשני צעדים קצרים: <strong>קודם</strong> לסמן איזו
        שורה בטבלה למטה היא שורת הכותרות (השורה עם שמות העמודות), <strong>ואז</strong> להגיד לנו איזו עמודה היא
        תאריך, איזו תיאור, ואיזו סכום.
      </p>

      <div className="form-row">
        <label>סוג מקור</label>
        <input
          list="source-types"
          value={sourceType}
          onChange={(e) => onSourceTypeChange(e.target.value)}
          placeholder='למשל: בנק - עו"ש / ויזה / ישראכרט'
          style={{ flex: 1 }}
        />
        <datalist id="source-types">
          {mappingNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: -4 }}>
        תנו שם לסוג המקור (למשל "עו״ש בנק" או "ויזה") - אם בפעם הבאה תבחרו את אותו שם, שני הצעדים למטה יתמלאו
        אוטומטית ולא תצטרכו לעשות את זה שוב.
      </p>

      {fileInfo.sheets.length > 1 && (
        <div className="form-row">
          <label>גיליון</label>
          <select value={sheetIndex} onChange={(e) => setSheetIndex(parseInt(e.target.value, 10))}>
            {fileInfo.sheets.map((s, i) => (
              <option key={s.name} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="section-title">צעד 1 - איזו שורה בטבלה למטה היא שורת הכותרות?</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: -6 }}>
        זו השורה שבה כתובים שמות העמודות (למשל "תאריך", "תיאור", "סכום") - לרוב לא השורה הראשונה בקובץ. סמנו אותה
        עם העיגול שליד מספר השורה המתאימה.
      </p>
      <div className="card" style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
        <table className="data-table">
          <tbody>
            <tr>
              <td></td>
              {Array.from({ length: cols }).map((_, i) => (
                <td key={i} style={{ color: 'var(--text-muted)' }}>
                  עמודה {i + 1}
                </td>
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
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: -6 }}>
        מתחת לכל עמודה יש כמה שורות לדוגמה מהקובץ, כדי שיהיה קל לזהות מה היא. בחרו מהתפריט מעל כל עמודה אם היא
        "תאריך", "תיאור", "סכום", או שאפשר להתעלם ממנה. חובה לבחור לפחות עמודת תאריך ועמודת סכום.
      </p>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <select value={columnRoles[i] || 'ignore'} onChange={(e) => setColumnRole(i, e.target.value)}>
                    {ROLE_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {ROLE_LABELS[k]}
                      </option>
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
      {!canProceed && (
        <p style={{ color: 'var(--critical)', fontSize: 13 }}>יש לבחור לפחות עמודת תאריך ועמודת סכום (או זכות/חובה) כדי להמשיך.</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={onBack}>
          חזרה
        </button>
        <button className="btn primary" onClick={onNext} disabled={!canProceed}>
          המשך לבדיקה
        </button>
      </div>
    </div>
  )
}

function ReviewStep({ draftRows, updateDraft, setAllIncluded, categories, people, includedCount, includedTotal, onBack, onConfirm }) {
  const allSelected = draftRows.length > 0 && includedCount === draftRows.length
  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0 }}>
          נמצאו <strong>{draftRows.length}</strong> שורות. מסומנות לייבוא: <strong>{includedCount}</strong>, בסך{' '}
          <strong>{formatMoney(includedTotal)}</strong>. אפשר לערוך כל שורה, לבטל סימון לשורות שלא רלוונטיות, ולסמן
          "הוסף כחוק" כדי שתנועות דומות יסווגו אוטומטית בפעם הבאה.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button className="btn" onClick={() => setAllIncluded(true)}>
          סימון הכל
        </button>
        <button className="btn" onClick={() => setAllIncluded(false)}>
          ביטול סימון הכל
        </button>
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
                  {r.warning === 'card-aggregate' && (
                    <div>
                      <span className="badge warn" title="זהו כנראה סכום מרוכז מכרטיס אשראי. אם מייבאים גם דוח אשראי מפורט, כדאי לבטל סימון כאן כדי למנוע כפילות.">
                        ⚠ ריכוז אשראי - יתכן כפל
                      </span>
                    </div>
                  )}
                  {r.warning === 'balance-carry' && (
                    <div>
                      <span className="badge muted">יתרת פתיחה - לא נכלל כברירת מחדל</span>
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
                  <select value={r.category} onChange={(e) => updateDraft(r._key, { category: e.target.value })}>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={r.person} onChange={(e) => updateDraft(r._key, { person: e.target.value })}>
                    {people.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={r.isFixed} onChange={(e) => updateDraft(r._key, { isFixed: e.target.checked })} />
                </td>
                <td>{formatMoney(r.amount)}</td>
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
        <button className="btn" onClick={onBack}>
          חזרה למיפוי
        </button>
        <button className="btn primary" onClick={onConfirm} disabled={includedCount === 0}>
          אישור וייבוא {includedCount} תנועות
        </button>
      </div>
    </div>
  )
}
