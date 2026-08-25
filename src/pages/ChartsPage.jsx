import React, { useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts'
import { useData } from '../DataContext.jsx'
import { filterTransactions, monthSummary, monthlyPivot, sortedMonths } from '../lib/aggregate.js'
import { MonthSelect, PersonPills, formatMonth } from '../components/FilterBar.jsx'
import { usePalette, colorForCategory } from '../lib/palette.js'
import { formatMoney } from './Dashboard.jsx'

export default function ChartsPage() {
  const { transactions, settings } = useData()
  const months = useMemo(() => sortedMonths(transactions), [transactions])
  const [month, setMonth] = useState('')
  const [person, setPerson] = useState('הכל')
  const [drillCategory, setDrillCategory] = useState(null)
  const palette = usePalette()
  const categories = settings.categories || []

  const activeMonth = month || months[months.length - 1] || ''

  const filtered = useMemo(
    () => filterTransactions(transactions, { month: activeMonth, person }),
    [transactions, activeMonth, person]
  )
  const summary = useMemo(() => monthSummary(filtered, categories), [filtered, categories])

  const pieData = categories
    .map((cat) => ({ name: cat, value: summary.categoryTotals[cat] || 0 }))
    .filter((d) => d.value > 0)
  if (summary.otherTotal > 0) pieData.push({ name: 'אחר', value: summary.otherTotal })

  const drillRows = useMemo(() => {
    if (!drillCategory) return []
    const known = new Set(categories)
    return filtered
      .filter((t) => {
        if (t.type !== 'expense') return false
        if (drillCategory === 'אחר') return !known.has(t.category)
        return t.category === drillCategory
      })
      .sort((a, b) => b.amount - a.amount)
  }, [drillCategory, filtered, categories])

  function openDrill(name) { setDrillCategory(name) }

  const barData = [...pieData].sort((a, b) => b.value - a.value)

  const trendData = useMemo(() => {
    const personFiltered = person === 'הכל' ? transactions : transactions.filter((t) => t.person === person)
    return monthlyPivot(personFiltered, categories).map((row) => ({
      month: formatMonth(row.month),
      הכנסות: row.incomeTotal,
      הוצאות: row.expenseTotal,
      נשאר: row.remaining
    }))
  }, [transactions, categories, person])

  if (months.length === 0) {
    return (
      <div>
        <h2 className="page-title">גרפים</h2>
        <div className="empty-state">אין עדיין נתונים להצגה.</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">גרפים</h2>
      <div className="filters-bar">
        <MonthSelect months={months} value={activeMonth} onChange={setMonth} />
        <PersonPills people={settings.people || []} value={person} onChange={setPerson} />
      </div>

      <div className="grid-2">
        <div>
          <div className="section-title">התפלגות הוצאות לפי קטגוריה - {formatMonth(activeMonth)}</div>
          <div className="card" style={{ height: 320 }}>
            {pieData.length === 0 ? (
              <div className="empty-state">אין הוצאות משתנות בחודש זה</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                    onClick={(d) => openDrill(d.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={colorForCategory(d.name, categories, palette)} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <div className="section-title">השוואת קטגוריות - {formatMonth(activeMonth)}</div>
          <div className="card" style={{ height: 320 }}>
            {barData.length === 0 ? (
              <div className="empty-state">אין הוצאות משתנות בחודש זה</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ right: 20 }}>
                  <CartesianGrid horizontal={false} stroke="var(--gridline)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} width={70} />
                  <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={22} onClick={(d) => openDrill(d.name)} style={{ cursor: 'pointer' }}>
                    {barData.map((d) => (
                      <Cell key={d.name} fill={colorForCategory(d.name, categories, palette)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {drillCategory && (
        <div style={modalOverlayStyle} onClick={() => setDrillCategory(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {drillCategory} — {formatMonth(activeMonth)}
              </div>
              <button className="btn" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => setDrillCategory(null)}>✕ סגור</button>
            </div>
            {drillRows.length === 0 ? (
              <div className="empty-state">אין תנועות</div>
            ) : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>תיאור</th>
                    <th>עבור מי</th>
                    <th>קבוע?</th>
                    <th>סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontSize: 13 }}>{t.date}</td>
                      <td style={{ fontSize: 13 }}>{t.note || t.sourceDescription || ''}</td>
                      <td style={{ fontSize: 13 }}>{t.person}</td>
                      <td style={{ fontSize: 13 }}>{t.isFixed ? 'כן' : ''}</td>
                      <td style={{ fontWeight: 600, color: 'var(--series-2)' }}>{formatMoney(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={4}>סה"כ</td>
                    <td>{formatMoney(drillRows.reduce((s, t) => s + t.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="section-title">מגמה חודשית {person !== 'הכל' ? `- ${person}` : ''}</div>
      <div className="card" style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
            <YAxis stroke="var(--text-muted)" fontSize={12} />
            <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="הכנסות" stroke={palette[2]} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="הוצאות" stroke={palette[7]} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="נשאר" stroke={palette[0]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13
}

const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
}

const modalStyle = {
  background: 'var(--surface-1)', borderRadius: 12, padding: 24,
  minWidth: 480, maxWidth: 680, maxHeight: '80vh', overflowY: 'auto',
  boxShadow: '0 8px 40px rgba(0,0,0,0.3)'
}
