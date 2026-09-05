import React, { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useData } from '../DataContext.jsx'
import { monthOf, sortedMonths } from '../lib/aggregate.js'
import { formatMonth } from '../components/FilterBar.jsx'
import CategorySelect from '../components/CategorySelect.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => today().slice(0, 7)

export default function Transactions() {
  const { transactions, settings, updateTransaction, deleteTransaction, addTransactions } = useData()
  const months = useMemo(() => sortedMonths(transactions), [transactions])
  const [month, setMonth] = useState('הכל')
  const [person, setPerson] = useState('הכל')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('הכל')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [showAddForm, setShowAddForm] = useState(false)
  const [edits, setEdits] = useState({}) // { [id]: { field: value, ... } }
  const [form, setForm] = useState(() => ({
    date: today(),
    month: currentMonth(),
    description: '',
    amount: '',
    type: 'expense',
    category: '',
    person: '',
    isFixed: false,
    fromSavings: false
  }))

  const rows = useMemo(() => {
    let list = transactions
    if (month !== 'הכל') list = list.filter((t) => t.month === month)
    if (person !== 'הכל') list = list.filter((t) => t.person === person)
    if (filterCategory !== 'הכל') list = list.filter((t) => t.category === filterCategory)
    if (search.trim()) {
      const q = search.trim()
      list = list.filter(
        (t) => (t.note || '').includes(q) || (t.sourceDescription || '').includes(q) || (t.category || '').includes(q)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'amount') return (a.amount - b.amount) * dir
      return (a[sortKey] || '').localeCompare(b[sortKey] || '') * dir
    })
  }, [transactions, month, person, search, filterCategory, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const categories = settings.categories || []
  const people = settings.people || []

  // Per-row edit helpers
  function setEdit(id, patch) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))
  }

  function getVal(t, field) {
    return edits[t.id]?.[field] !== undefined ? edits[t.id][field] : t[field]
  }

  function isDirty(id) {
    return !!(edits[id] && Object.keys(edits[id]).length > 0)
  }

  function saveRow(id) {
    if (!edits[id]) return
    updateTransaction(id, edits[id])
    setEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function toggleFromSavings(t) {
    updateTransaction(t.id, { fromSavings: !t.fromSavings })
  }

  function discardRow(id) {
    setEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function handleFormDate(value) {
    setForm((f) => ({ ...f, date: value, month: monthOf(value) }))
  }

  function saveManual() {
    const amt = parseFloat(form.amount)
    if (!form.date || !form.description.trim() || isNaN(amt) || amt <= 0) return
    addTransactions([{
      id: uuidv4(),
      date: form.date,
      month: form.month,
      type: form.type,
      category: form.category || (categories[0] || ''),
      person: form.person || (people[0] || ''),
      amount: amt,
      isFixed: form.isFixed,
      fromSavings: form.fromSavings || false,
      note: form.description.trim(),
      sourceDescription: form.description.trim(),
      sourceFile: 'ידני',
      importedAt: new Date().toISOString()
    }])
    setForm({ date: today(), month: currentMonth(), description: '', amount: '', type: 'expense', category: form.category, person: form.person, isFixed: false, fromSavings: false })
    setShowAddForm(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>כל התנועות</h2>
        <button className="btn primary" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? '✕ ביטול' : '+ הוספת תנועה ידנית'}
        </button>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>הוספת תנועה ידנית (מזומן / הכנסה / הוצאה)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lblStyle}>תיאור</label>
              <input style={inputStyle} placeholder='למשל: מזומן - שוק' value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label style={lblStyle}>סכום (₪)</label>
              <input type="number" min="0" style={inputStyle} placeholder="0" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label style={lblStyle}>תאריך</label>
              <input type="date" style={inputStyle} value={form.date} onChange={(e) => handleFormDate(e.target.value)} />
            </div>
            <div>
              <label style={lblStyle}>חודש חיוב</label>
              <input type="month" style={inputStyle} value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} />
            </div>
            <div>
              <label style={lblStyle}>סוג</label>
              <select style={inputStyle} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
            <div>
              <label style={lblStyle}>קטגוריה</label>
              <CategorySelect
                value={form.category || categories[0] || ''}
                categories={categories}
                onChange={(c) => setForm((f) => ({ ...f, category: c }))}
              />
            </div>
            <div>
              <label style={lblStyle}>עבור מי</label>
              <select style={inputStyle} value={form.person || people[0] || ''} onChange={(e) => setForm((f) => ({ ...f, person: e.target.value }))}>
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 2 }}>
              <input type="checkbox" checked={form.isFixed} onChange={(e) => setForm((f) => ({ ...f, isFixed: e.target.checked }))} />
              <label style={{ fontSize: 13 }}>תשלום קבוע</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 2 }}>
              <input type="checkbox" checked={form.fromSavings} onChange={(e) => setForm((f) => ({ ...f, fromSavings: e.target.checked }))} />
              <label style={{ fontSize: 13 }}>💰 מחסכונות</label>
            </div>
          </div>
          <button className="btn primary" onClick={saveManual}
            disabled={!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0}>
            שמירה
          </button>
        </div>
      )}

      <div className="filters-bar">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="הכל">כל החודשים</option>
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <select value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="הכל">כולם</option>
          {people.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="הכל">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="חיפוש בתיאור..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', minWidth: 180 }}
        />
        {(month !== 'הכל' || person !== 'הכל' || filterCategory !== 'הכל' || search.trim()) && (
          <button
            className="btn"
            style={{ fontSize: 13, padding: '6px 12px', whiteSpace: 'nowrap' }}
            onClick={() => { setMonth('הכל'); setPerson('הכל'); setFilterCategory('הכל'); setSearch('') }}
          >
            ניקוי סינון ✕
          </button>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{rows.length} תנועות</span>
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>
                תאריך {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th>חודש חיוב</th>
              <th>תיאור</th>
              <th>סוג</th>
              <th>קטגוריה</th>
              <th>עבור מי</th>
              <th>קבוע?</th>
              <th title="הוצאה שמומנה מחסכונות — לא תיכלל בתקציב החודשי">💰</th>
              <th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer' }}>
                סכום {sortKey === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const dirty = isDirty(t.id)
              return (
                <tr key={t.id} style={{ background: dirty ? 'rgba(42,120,214,0.06)' : undefined }}>
                  <td>
                    <input
                      type="date"
                      value={getVal(t, 'date')}
                      onChange={(e) => setEdit(t.id, { date: e.target.value, month: monthOf(e.target.value) })}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      type="month"
                      value={getVal(t, 'month') || ''}
                      onChange={(e) => setEdit(t.id, { month: e.target.value })}
                      style={{ ...inputStyle, minWidth: 120 }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={getVal(t, 'note') || ''}
                      placeholder={t.sourceDescription || ''}
                      onChange={(e) => setEdit(t.id, { note: e.target.value })}
                      style={{ ...inputStyle, minWidth: 160 }}
                    />
                    {t.installmentTotal > 1 && (
                      <div style={{ fontSize: 11, color: 'var(--series-1)', marginTop: 2 }}>
                        תשלום {t.installmentCurrent}/{t.installmentTotal} · נותר: {t.installmentTotal - t.installmentCurrent}
                      </div>
                    )}
                  </td>
                  <td>
                    <select value={getVal(t, 'type')} onChange={(e) => setEdit(t.id, { type: e.target.value })} style={inputStyle}>
                      <option value="expense">הוצאה</option>
                      <option value="income">הכנסה</option>
                    </select>
                  </td>
                  <td>
                    <CategorySelect
                      value={getVal(t, 'category')}
                      categories={categories}
                      onChange={(c) => setEdit(t.id, { category: c })}
                      style={{ minWidth: 130 }}
                    />
                  </td>
                  <td>
                    <select value={getVal(t, 'person')} onChange={(e) => setEdit(t.id, { person: e.target.value })} style={inputStyle}>
                      {people.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!getVal(t, 'isFixed')}
                      onChange={(e) => setEdit(t.id, { isFixed: e.target.checked })}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => toggleFromSavings(t)}
                      title={t.fromSavings ? 'מחסכונות — לחץ לביטול' : 'לחץ לסימון כהוצאה מחסכונות'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: t.fromSavings ? 1 : 0.18, padding: 0 }}
                    >💰</button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, direction: 'ltr' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: getVal(t, 'type') === 'income' ? 'var(--success)' : 'var(--critical)', minWidth: 10, textAlign: 'center' }}>
                        {getVal(t, 'type') === 'income' ? '+' : '−'}
                      </span>
                      <input
                        type="number"
                        value={getVal(t, 'amount')}
                        onChange={(e) => setEdit(t.id, { amount: parseFloat(e.target.value) || 0 })}
                        style={{ ...inputStyle, width: 88, color: getVal(t, 'type') === 'income' ? 'var(--success)' : 'var(--critical)', fontWeight: 600 }}
                      />
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {dirty ? (
                      <>
                        <button
                          className="btn primary"
                          style={{ fontSize: 12, padding: '3px 10px', marginLeft: 4 }}
                          onClick={() => saveRow(t.id)}
                        >
                          שמירה
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: 12, padding: '3px 8px', marginLeft: 4 }}
                          onClick={() => discardRow(t.id)}
                        >
                          ביטול
                        </button>
                      </>
                    ) : (
                      <button className="btn danger" onClick={() => {
                        const label = t.note || t.sourceDescription || ''
                        const msg = `למחוק את "${label}" — ${t.amount.toLocaleString('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ₪?`
                        if (window.confirm(msg)) deleteTransaction(t.id)
                      }}>
                        מחיקה
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty-state">לא נמצאו תנועות</div>}
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '5px 7px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  fontSize: 13,
  width: '100%'
}

const lblStyle = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-muted)',
  marginBottom: 4
}
