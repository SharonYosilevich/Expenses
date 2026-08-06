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
                  <td key={c}>{formatMoney(row.categoryTotals[c] || 0)}</td>
                ))}
                <td>{formatMoney(row.fixedTotal)}</td>
                <td>{formatMoney(row.incomeTotal)}</td>
                <td style={{ color: row.remaining >= 0 ? 'var(--success)' : 'var(--critical)', fontWeight: 700 }}>
                  {formatMoney(row.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
