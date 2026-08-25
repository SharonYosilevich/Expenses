import React, { useEffect, useMemo, useState } from 'react'
import { useData } from '../DataContext.jsx'
import { hashPin } from './LockScreen.jsx'
import { sortedMonths } from '../lib/aggregate.js'
import { formatMonth } from '../components/FilterBar.jsx'

export default function Settings() {
  const { settings, transactions, updateSettings, reloadFromBackup, clearTransactions, deleteTransactionsByMonth, deleteTransactionsByMonthAndFile } = useData()
  const [dataPath, setDataPath] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [catSearch, setCatSearch] = useState('')
  const [newPerson, setNewPerson] = useState('')
  const [budgetInputs, setBudgetInputs] = useState(() => {
    const b = settings.budgets || {}
    return Object.fromEntries((settings.categories || []).map((c) => [c, b[c] ?? '']))
  })
  const [backupMsg, setBackupMsg] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const FILE_TYPE_LABEL = {
    'card-1029': 'כרטיס 1029',
    'card-5825': 'כרטיס 5825',
    'bank': 'עובר ושב'
  }

  function guessFileType(t) {
    if (t.sourceFileType) return t.sourceFileType
    const f = t.sourceFile || ''
    if (f.includes('1029')) return 'card-1029'
    if (f.includes('5825')) return 'card-5825'
    return 'bank'
  }

  const monthFileData = useMemo(() => {
    const months = sortedMonths(transactions)
    return months.map((m) => {
      const txForMonth = transactions.filter((t) => t.month === m)
      const fileGroups = {}
      txForMonth.forEach((t) => {
        const ft = guessFileType(t)
        fileGroups[ft] = (fileGroups[ft] || 0) + 1
      })
      return {
        month: m,
        total: txForMonth.length,
        files: Object.entries(fileGroups).map(([ft, count]) => ({
          fileType: ft,
          count,
          label: FILE_TYPE_LABEL[ft] || ft
        }))
      }
    })
  }, [transactions])

  function confirmDeleteMonth(month, label) {
    if (!confirm(`למחוק את כל התנועות של ${label}? פעולה זו אינה הפיכה.`)) return
    deleteTransactionsByMonth([month])
  }

  function confirmDeleteFile(month, fileType, fileLabel, monthLabel) {
    if (!confirm(`למחוק את ${fileLabel} מחודש ${monthLabel}? פעולה זו אינה הפיכה.`)) return
    deleteTransactionsByMonthAndFile(month, fileType)
  }

  const [newRule, setNewRule] = useState(() => ({
    keyword: '',
    type: 'expense',
    category: (settings.categories || [])[0] || '',
    person: (settings.people || [])[0] || '',
    isFixed: false
  }))

  useEffect(() => {
    window.api.getDataPath().then(setDataPath)
  }, [])

  function saveBudgets() {
    const budgets = {}
    for (const [cat, val] of Object.entries(budgetInputs)) {
      const n = parseFloat(val)
      if (!isNaN(n) && n > 0) budgets[cat] = n
    }
    updateSettings({ budgets })
  }

  function addCategory() {
    const v = newCategory.trim()
    if (!v || (settings.categories || []).includes(v)) return
    updateSettings({ categories: [...(settings.categories || []), v] })
    setBudgetInputs((prev) => ({ ...prev, [v]: '' }))
    setNewCategory('')
  }

  function removeCategory(cat) {
    updateSettings({ categories: (settings.categories || []).filter((c) => c !== cat) })
  }

  function addPerson() {
    const v = newPerson.trim()
    if (!v || (settings.people || []).includes(v)) return
    updateSettings({ people: [...(settings.people || []), v] })
    setNewPerson('')
  }

  function removePerson(p) {
    updateSettings({ people: (settings.people || []).filter((x) => x !== p) })
  }

  function removeRule(idx) {
    const rules = [...(settings.rules || [])]
    rules.splice(idx, 1)
    updateSettings({ rules })
  }

  function addRule() {
    const keyword = newRule.keyword.trim()
    if (!keyword) return
    updateSettings({ rules: [...(settings.rules || []), { ...newRule, keyword }] })
    setNewRule({ ...newRule, keyword: '' })
  }

  function removeMapping(name) {
    const next = { ...(settings.importMappings || {}) }
    delete next[name]
    updateSettings({ importMappings: next })
  }

  async function handleExportBackup() {
    const res = await window.api.exportBackup()
    if (!res.canceled) setBackupMsg('הגיבוי נשמר ב: ' + res.filePath)
  }

  async function savePin() {
    if (!/^\d{4,}$/.test(newPin)) { setPinMsg('קוד PIN חייב להכיל לפחות 4 ספרות'); return }
    if (newPin !== confirmPin) { setPinMsg('הקודים אינם תואמים'); return }
    const hash = await hashPin(newPin)
    const patch = { pinHash: hash }
    if (recoveryCode.trim()) {
      patch.recoveryCodeHash = await hashPin(recoveryCode.trim())
    }
    updateSettings(patch)
    setNewPin(''); setConfirmPin(''); setRecoveryCode('')
    setPinMsg('קוד PIN נשמר בהצלחה ✅' + (recoveryCode.trim() ? ' (כולל קוד גיבוי)' : ''))
  }

  function removePin() {
    if (!confirm('להסיר את הגנת ה-PIN? כל אחד עם גישה למחשב יוכל לפתוח את האפליקציה.')) return
    updateSettings({ pinHash: null })
    setPinMsg('קוד PIN הוסר')
  }

  async function handleImportBackup() {
    if (!confirm('שחזור מגיבוי יחליף את כל הנתונים הנוכחיים באפליקציה. להמשיך?')) return
    const res = await window.api.importBackup()
    if (!res.canceled) {
      reloadFromBackup(res.data)
      setBackupMsg('הנתונים שוחזרו בהצלחה')
    }
  }

  return (
    <div>
      <h2 className="page-title">הגדרות</h2>

      <div className="grid-2">
        <div>
          <div className="section-title">קטגוריות</div>
          <div className="card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                type="text"
                placeholder="חיפוש קטגוריה..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13 }}
              />
              <button
                className="btn"
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                onClick={() => {
                  const cats = [...(settings.categories || [])]
                  const withoutOther = cats.filter(c => c !== 'אחר')
                  const sorted = withoutOther.sort((a, b) => a.localeCompare(b, 'he'))
                  updateSettings({ categories: [...sorted, 'אחר'] })
                }}
              >
                מיין א-ב
              </button>
            </div>
            <div className="tag-list" style={{ marginBottom: 12 }}>
              {(settings.categories || [])
                .filter((c) => !catSearch.trim() || c.includes(catSearch.trim()))
                .map((c) => (
                  <span className="tag" key={c}>
                    {c}
                    <button onClick={() => removeCategory(c)}>✕</button>
                  </span>
                ))}
              {catSearch.trim() && (settings.categories || []).filter(c => c.includes(catSearch.trim())).length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>לא נמצאה קטגוריה</span>
              )}
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <input
                type="text"
                placeholder="קטגוריה חדשה"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              />
              <button className="btn" onClick={addCategory}>
                הוספה
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="section-title">עבור מי</div>
          <div className="card">
            <div className="tag-list" style={{ marginBottom: 12 }}>
              {(settings.people || []).map((p) => (
                <span className="tag" key={p}>
                  {p}
                  <button onClick={() => removePerson(p)}>✕</button>
                </span>
              ))}
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <input
                type="text"
                placeholder="שם חדש"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPerson()}
              />
              <button className="btn" onClick={addPerson}>
                הוספה
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">תקציב חודשי לפי קטגוריה</div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: -6 }}>
        הגדירי תקציב חודשי לכל קטגוריה — בדשבורד תראי פס התקדמות שמראה כמה נוצל. ריק = ללא תקציב.
      </p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {(settings.categories || []).map((cat) => (
            <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cat}</label>
              <input
                type="number"
                min="0"
                placeholder="ללא תקציב"
                value={budgetInputs[cat] ?? ''}
                onChange={(e) => setBudgetInputs((prev) => ({ ...prev, [cat]: e.target.value }))}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)' }}
              />
            </div>
          ))}
        </div>
        <button className="btn primary" onClick={saveBudgets} style={{ marginTop: 14 }}>
          שמירת תקציבים
        </button>
      </div>

      <div className="section-title">חוקי סיווג אוטומטי</div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: -6 }}>
        כל תנועה שהתיאור המקורי שלה מכיל את מילת המפתח תסווג אוטומטית כך בפעם הבאה שמייבאים - לא צריך לסווג שוב ידנית.
      </p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label>מילת מפתח</label>
          <input
            type="text"
            placeholder='למשל: "שופרסל" או "עיריית נתניה"'
            value={newRule.keyword}
            onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
          />
        </div>
        <div className="form-row">
          <label>סוג</label>
          <select value={newRule.type} onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}>
            <option value="expense">הוצאה</option>
            <option value="income">הכנסה</option>
          </select>
          <label>קטגוריה</label>
          <select value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}>
            {(settings.categories || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label>עבור מי</label>
          <select value={newRule.person} onChange={(e) => setNewRule({ ...newRule, person: e.target.value })}>
            {(settings.people || []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label style={{ minWidth: 'auto' }}>
            <input
              type="checkbox"
              checked={newRule.isFixed}
              onChange={(e) => setNewRule({ ...newRule, isFixed: e.target.checked })}
            />{' '}
            קבוע
          </label>
          <button className="btn primary" onClick={addRule} disabled={!newRule.keyword.trim()}>
            הוספת חוק
          </button>
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        {(settings.rules || []).length === 0 ? (
          <div className="empty-state">אין חוקים עדיין - הם נוצרים אוטומטית בזמן ייבוא כשמסמנים "הוסף כחוק"</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>מילת מפתח בתיאור</th>
                <th>סוג</th>
                <th>קטגוריה</th>
                <th>עבור מי</th>
                <th>קבוע?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(settings.rules || []).map((r, idx) => (
                <tr key={idx}>
                  <td>{r.keyword}</td>
                  <td>{r.type === 'income' ? 'הכנסה' : 'הוצאה'}</td>
                  <td>{r.category}</td>
                  <td>{r.person}</td>
                  <td>{r.isFixed ? 'כן' : 'לא'}</td>
                  <td>
                    <button className="btn danger" onClick={() => removeRule(idx)}>
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">מיפויי ייבוא שמורים</div>
      <div className="card">
        {Object.keys(settings.importMappings || {}).length === 0 ? (
          <div className="empty-state">אין עדיין מיפויים שמורים</div>
        ) : (
          <div className="tag-list">
            {Object.keys(settings.importMappings || {}).map((name) => (
              <span className="tag" key={name}>
                {name}
                <button onClick={() => removeMapping(name)}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="section-title">נעילת אפליקציה עם PIN</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
          {settings.pinHash ? '🔒 PIN מוגדר — האפליקציה תיפתח עם קוד.' : '🔓 אין PIN — כל אחד עם גישה למחשב יכול לפתוח.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>קוד PIN (ספרות בלבד)</label>
            <input type="password" inputMode="numeric" placeholder="לפחות 4 ספרות" value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>אישור PIN</label>
            <input type="password" inputMode="numeric" placeholder="הכניסי שוב" value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>קוד גיבוי לאיפוס (ספרות/אותיות)</label>
            <input type="password" placeholder="קוד שתזכרי תמיד" value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={savePin} disabled={!newPin || !confirmPin}>
            {settings.pinHash ? 'שינוי PIN' : 'הגדרת PIN'}
          </button>
          {settings.pinHash && (
            <button className="btn danger" style={{ border: '1px solid var(--critical)' }} onClick={removePin}>
              הסרת PIN
            </button>
          )}
        </div>
        {pinMsg && <p style={{ fontSize: 13, marginTop: 8, color: pinMsg.includes('✅') ? 'var(--success)' : 'var(--critical)' }}>{pinMsg}</p>}
      </div>

      <div className="section-title">ניהול נתונים — מחיקה לפי חודש / קובץ</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          ניתן למחוק קובץ בודד מחודש מסוים, או חודש שלם עם כל הקבצים שלו. ההגדרות והחוקים ישמרו.
        </p>

        {monthFileData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>אין תנועות במערכת.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {monthFileData.map(({ month, total, files }) => {
              const mLabel = formatMonth(month)
              return (
                <div key={month} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Month row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--surface-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {mLabel}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12, marginRight: 8 }}>({total} תנועות)</span>
                    </span>
                    <button
                      className="btn danger"
                      style={{ fontSize: 12, padding: '3px 10px', border: '1px solid var(--critical)' }}
                      onClick={() => confirmDeleteMonth(month, mLabel)}
                    >
                      מחיקת החודש כולו
                    </button>
                  </div>
                  {/* File rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {files.map(({ fileType, count, label }) => (
                      <div key={fileType} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 6px 28px', borderTop: '1px solid var(--gridline)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {label}
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 6 }}>({count} תנועות)</span>
                        </span>
                        <button
                          className="btn danger"
                          style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--critical)', opacity: 0.8 }}
                          onClick={() => confirmDeleteFile(month, fileType, label, mLabel)}
                        >
                          מחיקת קובץ זה
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--gridline)' }}>
          <button
            className="btn danger"
            style={{ border: '1px solid var(--critical)', fontSize: 13 }}
            onClick={() => {
              if (confirm('למחוק את כל התנועות? פעולה זו אינה הפיכה.')) clearTransactions()
            }}
          >
            מחיקת הכל
          </button>
        </div>
      </div>

      <div className="section-title">גיבוי ושחזור</div>
      <div className="card">
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          כל הנתונים נשמרים במחשב בלבד, בנתיב:
          <br />
          <code>{dataPath}</code>
          <br />
          גיבוי אוטומטי נשמר בכל שינוי (10 גיבויים אחרונים). מומלץ גם לייצא גיבוי ידני מדי פעם למקום בטוח.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={handleExportBackup}>
            ייצוא גיבוי לקובץ
          </button>
          <button className="btn" onClick={handleImportBackup}>
            שחזור מגיבוי
          </button>
        </div>
        {backupMsg && <p style={{ color: 'var(--success)', fontSize: 13 }}>{backupMsg}</p>}
      </div>
    </div>
  )
}
