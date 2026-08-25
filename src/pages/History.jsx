import React, { useMemo, useState } from 'react'
import { useData } from '../DataContext.jsx'
import { monthlyPivot } from '../lib/aggregate.js'
import { PersonPills, formatMonth } from '../components/FilterBar.jsx'
import { formatMoney } from './Dashboard.jsx'

export default function History() {
  const { transactions, settings } = useData()
  const [person, setPerson] = useState('הכל')
  const categories = settings.categories || []

  const filtered = person === 'הכל' ? transactions : transactions.filter((t) => t.person === person)
  const pivot = useMemo(() => monthlyPivot(filtered, categories), [filtered, categories])

  // Compute column averages for color coding
  const colAvg = useMemo(() => {
    if (pivot.length < 2) return {}
    const avgs = {}
    for (const cat of categories) {
      const vals = pivot.map((r) => r.categoryTotals[cat] || 0).filter((v) => v > 0)
      if (vals.length > 0) avgs[cat] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    avgs._fixed = pivot.map((r) => r.fixedTotal).reduce((a, b) => a + b, 0) / pivot.length
    avgs._income = pivot.map((r) => r.incomeTotal).reduce((a, b) => a + b, 0) / pivot.length
    return avgs
  }, [pivot, categories])

  function cellColor(value, avg, higherIsBad = true) {
    if (!avg || avg === 0 || pivot.length < 2) return {}
    const ratio = value / avg
    if (higherIsBad) {
      if (ratio > 1.3) return { color: 'var(--critical)', fontWeight: 700 }
      if (ratio < 0.7) return { color: 'var(--success)', fontWeight: 700 }
    } else {
      if (ratio > 1.3) return { color: 'var(--success)', fontWeight: 700 }
      if (ratio < 0.7) return { color: 'var(--critical)', fontWeight: 700 }
    }
    return {}
  }

  if (pivot.length === 0) {
    return (
      <div>
        <h2 className="page-title">השוואת חודשים</h2>
        <div className="empty-state">אין עדיין נתונים להשוואה.</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">השוואת חודשים</h2>
      <div className="filters-bar">
        <PersonPills people={settings.people || []} value={person} onChange={setPerson} />
      </div>

      {pivot.length >= 2 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, marginTop: -8 }}>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>ירוק</span> = נמוך ב-30%+ מהממוצע ·{' '}
          <span style={{ color: 'var(--critical)', fontWeight: 700 }}>אדום</span> = גבוה ב-30%+ מהממוצע
        </p>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>חודש</th>
              {categories.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th>קבועות</th>
              <th>הכנסות</th>
              <th>נשאר</th>
            </tr>
          </thead>
          <tbody>
            {pivot.map((row) => (
              <tr key={row.month}>
                <td style={{ fontWeight: 600 }}>{formatMonth(row.month)}</td>
                {categories.map((c) => (
                  <td key={c} style={cellColor(row.categoryTotals[c] || 0, colAvg[c], true)}>
                    {formatMoney(row.categoryTotals[c] || 0)}
                  </td>
                ))}
                <td style={cellColor(row.fixedTotal, colAvg._fixed, true)}>
                  {formatMoney(row.fixedTotal)}
                </td>
                <td style={cellColor(row.incomeTotal, colAvg._income, false)}>
                  {formatMoney(row.incomeTotal)}
                </td>
                <td style={{ color: row.remaining >= 0 ? 'var(--success)' : 'var(--critical)', fontWeight: 700 }}>
                  {formatMoney(row.remaining)}
                </td>
              </tr>
            ))}
            {pivot.length >= 2 && (
              <tr className="total-row">
                <td>ממוצע</td>
                {categories.map((c) => (
                  <td key={c}>{colAvg[c] ? formatMoney(Math.round(colAvg[c])) : '—'}</td>
                ))}
                <td>{formatMoney(Math.round(colAvg._fixed || 0))}</td>
                <td>{formatMoney(Math.round(colAvg._income || 0))}</td>
                <td>—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
