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
  const [openBudgetType, setOpenBudgetType] = useState(null)

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
  const categoryTypes = settings.categoryTypes || {}

  // ── 50/30/20 ──
  const typeBreakdown = useMemo(() => {
    const expenses = filtered.filter((t) => t.type === 'expense' && !t.fromSavings)
    const byType = { 'חובה': 0, 'גמיש': 0, 'מותרות': 0 }
    for (const t of expenses) {
      const ct = categoryTypes[t.category]
      if (ct) byType[ct] = (byType[ct] || 0) + t.amount
    }
    return byType
  }, [filtered, categoryTypes])

  const savingsSpend = useMemo(
    () => filtered.filter((t) => t.type === 'expense' && t.fromSavings).reduce((s, t) => s + t.amount, 0),
    [filtered]
  )

  const hasTypeBreakdown = Object.values(typeBreakdown).some((v) => v > 0)

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
        {savingsSpend > 0 && (
          <div className="stat-tile">
            <div className="label">הוצאות מחסכונות</div>
            <div className="value" style={{ fontSize: '1.1rem', color: 'var(--series-3)' }}>{formatMoney(savingsSpend)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>לא נכלל בתקציב החודשי</div>
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

      {/* ── 50/30/20 ── */}
      {hasTypeBreakdown && (
        <>
          <div className="section-title">חלוקת הוצאות — חובה / גמיש / מותרות</div>
          <div className="card">
            <BudgetRulePanel
              breakdown={typeBreakdown}
              incomeTotal={summary.incomeTotal}
              openType={openBudgetType}
              onTypeClick={(type) => setOpenBudgetType(openBudgetType === type ? null : type)}
              filtered={filtered}
              categoryTypes={categoryTypes}
            />
          </div>
        </>
      )}

      {/* ── הוצאות לפי קטגוריה ── */}
      <div className="section-title">הוצאות לפי קטגוריה</div>
      <div className="card">
        <CategoryBars
          categories={categories}
          summary={summary}
          openCategory={openCategory}
          setOpenCategory={setOpenCategory}
          categoryColorVar={categoryColorVar}
        />
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

const CATEGORY_GROUPS = {
  'בית': ['בית', 'ארנונה', 'משכנתא'],
  'רכב': ['דלק', 'ביטוח לרכב'],
  'בריאות': ['קופ"ח', 'קופ"ח תרופות', 'ביטוחים'],
}

// Returns the group name for a category, or null
function groupOf(cat) {
  for (const [g, cats] of Object.entries(CATEGORY_GROUPS)) {
    if (cats.includes(cat)) return g
  }
  return null
}

function CategoryBars({ categories, summary, openCategory, setOpenCategory, categoryColorVar }) {
  const [showAll, setShowAll] = useState(false)

  const rows = categories
    .map((cat) => ({ cat, amount: summary.categoryTotals[cat] || 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  if (summary.otherTotal > 0) rows.push({ cat: '(ללא קטגוריה)', amount: summary.otherTotal })

  const max = rows[0]?.amount || 1
  const SHOW_DEFAULT = 6
  const visible = showAll ? rows : rows.slice(0, SHOW_DEFAULT)
  const hiddenCount = rows.length - SHOW_DEFAULT

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px' }}>
        {visible.map(({ cat, amount }) => {
          const active = openCategory === cat
          const group = groupOf(cat)
          return (
            <div
              key={cat}
              onClick={() => setOpenCategory(active ? null : cat)}
              style={{ cursor: 'pointer', padding: '8px 4px', borderRadius: 6, background: active ? 'rgba(42,120,214,0.06)' : 'transparent' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: active ? 700 : 500 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: categoryColorVar(cat), flexShrink: 0, display: 'inline-block' }} />
                  {cat}
                  {group && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{group}</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(amount)}</span>
              </div>
              <div style={{ height: 5, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: categoryColorVar(cat), width: (amount / max * 100) + '%', transition: 'width 0.3s' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* total row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13 }}>
        <span style={{ color: 'var(--text-muted)' }}>סה"כ הוצאות</span>
        <span style={{ fontWeight: 700 }}>{formatMoney(summary.expenseTotal)}</span>
      </div>

      {/* show more / less */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="btn"
          style={{ marginTop: 10, fontSize: 12, padding: '4px 12px' }}
        >
          + הצג עוד {hiddenCount} קטגוריות
        </button>
      )}
      {showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="btn"
          style={{ marginTop: 10, fontSize: 12, padding: '4px 12px' }}
        >
          הסתר ↑
        </button>
      )}
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

const RULE_TARGETS  = { 'חובה': 50, 'גמיש': 30, 'מותרות': 20 }
const RULE_COLORS   = { 'חובה': '#8b5cf6', 'גמיש': '#10b981', 'מותרות': '#3b82f6' }
const RULE_SUBTITLES = { 'חובה': 'הכרחי — יעד 50%', 'גמיש': 'גמיש — יעד 30%', 'מותרות': 'רצוני — יעד 20%' }

function BudgetRulePanel({ breakdown, incomeTotal, openType, onTypeClick, filtered, categoryTypes }) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0)
  const base = incomeTotal > 0 ? incomeTotal : total || 1

  const drillRows = openType
    ? filtered
        .filter((t) => t.type === 'expense' && !t.fromSavings && categoryTypes[t.category] === openType)
        .sort((a, b) => b.amount - a.amount)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {['חובה', 'גמיש', 'מותרות'].map((type) => {
        const amount = breakdown[type] || 0
        const pct = Math.round((amount / base) * 100)
        const target = RULE_TARGETS[type]
        const color = RULE_COLORS[type]
        const diff = pct - target
        const barPct = Math.min((amount / (base * target / 100)) * 100, 130)
        const over = diff > 5
        const under = diff < -10
        const active = openType === type
        return (
          <div
            key={type}
            onClick={() => onTypeClick(type)}
            style={{
              cursor: 'pointer',
              borderRadius: 8,
              padding: '8px 10px',
              margin: '-8px -10px',
              background: active ? `rgba(${type === 'חובה' ? '139,92,246' : type === 'גמיש' ? '16,185,129' : '59,130,246'},0.07)` : 'transparent',
              transition: 'background 0.15s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: 700 }}>{type}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{RULE_SUBTITLES[type]}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{formatMoney(amount)}</span>
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 10,
                  background: over ? 'rgba(239,68,68,0.12)' : under ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.06)',
                  color: over ? '#ef4444' : under ? '#10b981' : 'var(--text-muted)',
                  fontWeight: 600
                }}>
                  {pct}%{over ? ' ↑' : under ? ' ↓' : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{active ? '▲' : '▼'}</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: over ? '#ef4444' : color,
                width: Math.min(barPct, 100) + '%',
                transition: 'width 0.4s'
              }} />
            </div>
          </div>
        )
      })}

      {/* ── Drill-down ── */}
      {openType && (
        <div style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: RULE_COLORS[openType] }}>
            תנועות {openType} ({drillRows.length})
          </div>
          {drillRows.length === 0 ? (
            <div className="empty-state">אין תנועות</div>
          ) : (
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>תיאור</th>
                  <th>קטגוריה</th>
                  <th>עבור מי</th>
                  <th>תאריך</th>
                  <th>סכום</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((t) => (
                  <tr key={t.id}>
                    <td>{t.note || t.sourceDescription}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{t.category}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{t.person}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{t.date}</td>
                    <td style={{ fontWeight: 700 }}>{formatMoney(t.amount)}</td>
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
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 4, borderTop: '1px solid var(--gridline)' }}>
        {incomeTotal > 0
          ? 'אחוזים מחושבים מתוך ההכנסה החודשית · הוצאות מחסכונות לא נכללות · לחצי על שורה לפירוט'
          : 'אין הכנסה מוזנת — אחוזים מתוך סך ההוצאות המסווגות · לחצי על שורה לפירוט'}
      </div>
    </div>
  )
}

export function formatMoney(n) {
  return (
    (n || 0).toLocaleString('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ₪'
  )
}
