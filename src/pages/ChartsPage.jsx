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
                  <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={22}>
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
