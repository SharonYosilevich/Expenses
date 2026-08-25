import React, { useMemo, useState } from 'react'
import { useData } from '../DataContext.jsx'
import { filterTransactions, monthSummary, sortedMonths } from '../lib/aggregate.js'
import { detectAnomalies, forecastMonthEnd, topExpenses, categoryAverages } from '../lib/insights.js'
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

  const forecast = useMemo(
    () => forecastMonthEnd(person === 'הכל' ? transactions : transactions.filter(t => t.person === person), activeMonth),
    [transactions, activeMonth, person]
  )

  const anomalies = useMemo(
    () => detectAnomalies(
      person === 'הכל' ? transactions : transactions.filter(t => t.person === person),
      settings.categories || [],
      activeMonth
    ),
    [transactions, settings.categories, activeMonth, person]
  )

  const top5 = useMemo(() => topExpenses(filtered, activeMonth), [filtered, activeMonth])

  const avgByCategory = useMemo(
    () => categoryAverages(
      person === 'הכל' ? transactions : transactions.filter(t => t.person === person),
      settings.categories || [],
      activeMonth
    ),
    [transactions, settings.categories, activeMonth, person]
  )

  const budgets = settings.budgets || {}

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
    ? filtered.filter((t) => t.type === 'expense' && t.category === openCategory)
    : []

  return (
    <div>
      <h2 className="page-title">דשבורד חודשי</h2>

      <div className="filters-bar">
        <MonthSelect months={months} value={activeMonth} onChange={setMonth} />
        <PersonPills people={settings.people || []} value={person} onChange={setPerson} />
      </div>

      {/* ── כרטיסי סיכום ── */}
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
        {forecast && (
          <div className="stat-tile">
            <div className="label">תחזית הוצאות לסוף חודש</div>
            <div className="value" style={{ fontSize: '1.1rem' }}>{formatMoney(forecast.forecast)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              עד יום {forecast.daysElapsed}: {formatMoney(forecast.currentSpend)}
            </div>
          </div>
        )}
      </div>

      {/* ── התראות חריגה ── */}
      {anomalies.length > 0 && (
        <>
          <div className="section-title">⚠ התראות חריגה לעומת ממוצע חודשים קודמים</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {anomalies.map((a) => (
              <div key={a.category} className="anomaly-card">
                <span className="anomaly-cat">{a.category}</span>
                <span>
                  חודש זה: <strong>{formatMoney(a.currentSpend)}</strong>
                  {' · '}ממוצע: {formatMoney(a.avg)}
                  {' · '}חריגה: <strong style={{ color: 'var(--critical)' }}>+{formatMoney(a.diff)}</strong>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── הוצאות לפי קטגוריה + פסי תקציב ── */}
      <div className="section-title">הוצאות לפי קטגוריה</div>
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
              {summary.otherTotal > 0 && <th>(ללא קטגוריה)</th>}
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
              <td className="total-row">{formatMoney(summary.expenseTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── פסי תקציב ── */}
      {categories.some((c) => budgets[c] > 0) && (
        <>
          <div className="section-title" style={{ marginTop: 20 }}>תקציב חודשי</div>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {categories
                .filter((c) => budgets[c] > 0)
                .map((cat) => {
                  const spent = summary.categoryTotals[cat] || 0
                  const budget = budgets[cat]
                  const pct = Math.min((spent / budget) * 100, 100)
                  const over = spent > budget
                  const warn = !over && pct >= 80
                  const avg = avgByCategory[cat]
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{cat}</span>
                        <span style={{ color: over ? 'var(--critical)' : warn ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {formatMoney(spent)} / {formatMoney(budget)}
                          {over && ' ⚠ חריגה!'}
                        </span>
                      </div>
                      <div className="budget-track">
                        <div
                          className="budget-fill"
                          style={{
                            width: pct + '%',
                            background: over ? 'var(--critical)' : warn ? 'var(--warning)' : 'var(--series-3)'
                          }}
                        />
                        {avg > 0 && avg < budget && (
                          <div
                            className="budget-avg-marker"
                            style={{ right: (100 - Math.min((avg / budget) * 100, 100)) + '%' }}
                            title={'ממוצע חודשים קודמים: ' + formatMoney(avg)}
                          />
                        )}
                      </div>
                      {avg > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          ממוצע חודשים קודמים: {formatMoney(avg)}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </>
      )}

      {/* ── קטגוריה פתוחה ── */}
      {openCategory && (
        <>
          <div className="section-title">תנועות בקטגוריית "{openCategory}"</div>
          <div className="card">
            <TransactionMiniTable rows={categoryRows} />
          </div>
        </>
      )}

      {/* ── 2 עמודות: קבועות + הכנסות ── */}
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

      {/* ── TOP 5 הוצאות גדולות ── */}
      {top5.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>5 ההוצאות הגדולות בחודש</div>
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>תיאור</th>
                  <th>קטגוריה</th>
                  <th>תאריך</th>
                  <th>סכום</th>
                </tr>
              </thead>
              <tbody>
                {top5.map((t) => (
                  <tr key={t.id}>
                    <td>{t.note || t.sourceDescription}</td>
                    <td>{t.category}</td>
                    <td>{t.date}</td>
                    <td style={{ fontWeight: 700 }}>{formatMoney(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── קבוע vs. גמיש ── */}
      <div className="section-title" style={{ marginTop: 24 }}>קבוע מול גמיש</div>
      <div className="card">
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <FixedVsFlexItem label="קבוע (חובה)" amount={summary.fixedTotal} total={summary.expenseTotal} color="var(--series-7)" />
          <FixedVsFlexItem label="גמיש (ניתן לצמצם)" amount={summary.variableTotal} total={summary.expenseTotal} color="var(--series-2)" />
        </div>
        {summary.expenseTotal > 0 && (
          <div className="budget-track" style={{ marginTop: 12 }}>
            <div
              className="budget-fill"
              style={{
                width: Math.min((summary.fixedTotal / summary.expenseTotal) * 100, 100) + '%',
                background: 'var(--series-7)',
                borderRadius: '6px 0 0 6px'
              }}
            />
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          הצד הכהה = הוצאות קבועות · הצד הבהיר = הוצאות גמישות
        </div>
      </div>
    </div>
  )
}

function FixedVsFlexItem({ label, amount, total, color }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 14, height: 14, borderRadius: 4, background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatMoney(amount)}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pct}% מסך ההוצאות</div>
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
    (n || 0).toLocaleString('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ₪'
  )
}
