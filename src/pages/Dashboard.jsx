import React, { useMemo, useState } from 'react'
import { useData } from '../DataContext.jsx'
import { filterTransactions, monthSummary, sortedMonths } from '../lib/aggregate.js'
import { MonthSelect, PersonPills, formatMonth } from '../components/FilterBar.jsx'

export default function Dashboard() {
  const { transactions, settings, categoryColorVar } = useData()
  const months = useMemo(() => sortedMonths(transactions), [transactions])
  const [month, setMonth] = useState('')
  const [person, setPerson] = useState('הכל')
  const [openCategory, setOpenCategory] = useState(null)

  const activeMonth = month || months[months.length - 1] || ''

  const filtered = useMemo(
    () => filterTransactions(transactions, { month: activeMonth, person }),
    [transactions, activeMonth, person]
  )

  const summary = useMemo(() => monthSummary(filtered, settings.categories || []), [filtered, settings.categories])

  if (months.length === 0) {
    return (
      <div>
        <h2 className="page-title">דשבורד חודשי</h2>
        <div className="empty-state">אין עדיין נתונים. אפשר להתחיל בייבוא קובץ מהתפריט בצד.</div>
      </div>
    )
  }

  const categories = settings.categories || []
  const categoryRows = openCategory
    ? filtered.filter((t) => t.type === 'expense' && !t.isFixed && t.category === openCategory)
    : []

  return (
    <div>
      <h2 className="page-title">דשבורד חודשי</h2>

      <div className="filters-bar">
        <MonthSelect months={months} value={activeMonth} onChange={setMonth} />
        <PersonPills people={settings.people || []} value={person} onChange={setPerson} />
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="label">הכנסות</div>
          <div className="value">{formatMoney(summary.incomeTotal)}</div>
        </div>
        <div className="stat-tile">
          <div className="label">הוצאות משתנות</div>
          <div className="value">{formatMoney(summary.variableTotal)}</div>
        </div>
        <div className="stat-tile">
          <div className="label">הוצאות קבועות</div>
          <div className="value">{formatMoney(summary.fixedTotal)}</div>
        </div>
        <div className={'stat-tile ' + (summary.remaining >= 0 ? 'positive' : 'negative')}>
          <div className="label">נשאר בסוף החודש</div>
          <div className="value">{formatMoney(summary.remaining)}</div>
        </div>
      </div>

      <div className="section-title">הוצאות משתנות לפי קטגוריה</div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {categories.map((cat) => (
                <th key={cat}>
                  <span className="category-swatch" style={{ background: categoryColorVar(cat) }} />
                  {cat}
                </th>
              ))}
              {summary.otherTotal > 0 && <th>אחר</th>}
              <th>סה"כ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {categories.map((cat) => (
                <td
                  key={cat}
                  onClick={() => setOpenCategory(openCategory === cat ? null : cat)}
                  style={{ cursor: 'pointer', fontWeight: openCategory === cat ? 700 : 400 }}
                >
                  {formatMoney(summary.categoryTotals[cat] || 0)}
                </td>
              ))}
              {summary.otherTotal > 0 && <td>{formatMoney(summary.otherTotal)}</td>}
              <td className="total-row">{formatMoney(summary.variableTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {openCategory && (
        <>
          <div className="section-title">תנועות בקטגוריית "{openCategory}"</div>
          <div className="card">
            <TransactionMiniTable rows={categoryRows} />
          </div>
        </>
      )}

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div>
          <div className="section-title">הוצאות קבועות</div>
          <div className="card">
            <TransactionMiniTable rows={summary.fixedItems} totalLabel="סה״כ קבוע" total={summary.fixedTotal} />
          </div>
        </div>
        <div>
          <div className="section-title">הכנסות</div>
          <div className="card">
            <TransactionMiniTable rows={summary.incomeItems} totalLabel="סה״כ הכנסות" total={summary.incomeTotal} />
          </div>
        </div>
      </div>
    </div>
  )
}

function TransactionMiniTable({ rows, totalLabel, total }) {
  if (rows.length === 0) return <div className="empty-state">אין תנועות</div>
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>תאריך</th>
          <th>תיאור</th>
          <th>עבור מי</th>
          <th>סכום</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id}>
            <td>{t.date}</td>
            <td>{t.note || t.sourceDescription}</td>
            <td>{t.person}</td>
            <td>{formatMoney(t.amount)}</td>
          </tr>
        ))}
        {typeof total === 'number' && (
          <tr className="total-row">
            <td colSpan={3}>{totalLabel}</td>
            <td>{formatMoney(total)}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export function formatMoney(n) {
  return (
    (n || 0).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₪'
  )
}
