import React, { useMemo, useState } from 'react'
import { useData } from '../DataContext.jsx'
import { monthOf, sortedMonths } from '../lib/aggregate.js'
import { formatMonth } from '../components/FilterBar.jsx'

export default function Transactions() {
  const { transactions, settings, updateTransaction, deleteTransaction } = useData()
  const months = useMemo(() => sortedMonths(transactions), [transactions])
  const [month, setMonth] = useState('הכל')
  const [person, setPerson] = useState('הכל')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const categories = settings.categories || []
  const people = settings.people || []

  const rows = useMemo(() => {
    let list = transactions
    if (month !== 'הכל') list = list.filter((t) => t.month === month)
    if (person !== 'הכל') list = list.filter((t) => t.person === person)
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
  }, [transactions, month, person, search, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function handleDateChange(t, value) {
    updateTransaction(t.id, { date: value, month: monthOf(value) })
  }

  return (
    <div>
      <h2 className="page-title">כל התנועות</h2>

      <div className="filters-bar">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="הכל">כל החודשים</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
        <select value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="הכל">כולם</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="חיפוש בתיאור/קטגוריה..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', minWidth: 220 }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{rows.length} תנועות</span>
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>
                תאריך {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th>תיאור</th>
              <th>סוג</th>
              <th>קטגוריה</th>
              <th>עבור מי</th>
              <th>קבוע?</th>
              <th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer' }}>
                סכום {sortKey === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <input type="date" value={t.date} onChange={(e) => handleDateChange(t, e.target.value)} style={inputStyle} />
                </td>
                <td>
                  <input
                    type="text"
                    value={t.note || ''}
                    placeholder={t.sourceDescription || ''}
                    onChange={(e) => updateTransaction(t.id, { note: e.target.value })}
                    style={{ ...inputStyle, minWidth: 160 }}
                  />
                </td>
                <td>
                  <select value={t.type} onChange={(e) => updateTransaction(t.id, { type: e.target.value })} style={inputStyle}>
                    <option value="expense">הוצאה</option>
                    <option value="income">הכנסה</option>
                  </select>
                </td>
                <td>
                  <select value={t.category} onChange={(e) => updateTransaction(t.id, { category: e.target.value })} style={inputStyle}>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={t.person} onChange={(e) => updateTransaction(t.id, { person: e.target.value })} style={inputStyle}>
                    {people.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!t.isFixed}
                    onChange={(e) => updateTransaction(t.id, { isFixed: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={t.amount}
                    onChange={(e) => updateTransaction(t.id, { amount: parseFloat(e.target.value) || 0 })}
                    style={{ ...inputStyle, width: 90 }}
                  />
                </td>
                <td>
                  <button className="btn danger" onClick={() => deleteTransaction(t.id)}>
                    מחיקה
                  </button>
                </td>
              </tr>
            ))}
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
  fontSize: 13
}
