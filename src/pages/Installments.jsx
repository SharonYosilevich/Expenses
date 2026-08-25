import React, { useMemo, useState } from 'react'
import { useData } from '../DataContext.jsx'
import { formatMoney } from './Dashboard.jsx'
import { sortedMonths } from '../lib/aggregate.js'
import { formatMonth } from '../components/FilterBar.jsx'

export default function Installments() {
  const { transactions } = useData()
  const [month, setMonth] = useState('')

  const instTx = useMemo(() => transactions.filter((t) => t.installmentTotal > 1), [transactions])
  const months = useMemo(() => sortedMonths(instTx), [instTx])

  // ── Month view: all installment charges in a specific month ──
  const monthRows = useMemo(() => {
    if (!month) return []
    return instTx
      .filter((t) => t.month === month)
      .sort((a, b) => b.amount - a.amount)
  }, [instTx, month])

  const monthTotal = useMemo(() => monthRows.reduce((s, t) => s + t.amount, 0), [monthRows])

  // ── Active view: one record per unique purchase (no month filter) ──
  const installments = useMemo(() => {
    if (instTx.length === 0) return []
    const byDesc = {}
    for (const t of instTx) {
      const key = (t.note || t.sourceDescription || '').trim()
      if (!byDesc[key] || t.installmentCurrent > byDesc[key].installmentCurrent) {
        byDesc[key] = t
      }
    }
    return Object.values(byDesc).map((t) => {
      const remaining = t.installmentTotal - t.installmentCurrent
      const monthlyAmount = t.amount
      const originalAmount = t.originalAmount || (monthlyAmount * t.installmentTotal)
      const remainingTotal = monthlyAmount * remaining
      let endMonth = '—'
      if (t.month && remaining > 0) {
        const [y, m] = t.month.split('-').map(Number)
        const endDate = new Date(y, m - 1 + remaining, 1)
        endMonth = endDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })
      }
      return { t, key: t.id, desc: t.note || t.sourceDescription, monthlyAmount, originalAmount, remaining, remainingTotal, endMonth }
    }).sort((a, b) => b.remainingTotal - a.remainingTotal)
  }, [instTx])

  const totalMonthly = useMemo(() => installments.reduce((s, i) => s + i.monthlyAmount, 0), [installments])
  const totalRemaining = useMemo(() => installments.reduce((s, i) => s + i.remainingTotal, 0), [installments])

  if (instTx.length === 0) {
    return (
      <div>
        <h2 className="page-title">עסקאות בתשלומים</h2>
        <div className="empty-state">לא נמצאו עסקאות בתשלומים</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>עסקאות בתשלומים</h2>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13 }}
        >
          <option value="">כל הזמן (פעיל)</option>
          {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
      </div>

      {/* ── Month view ── */}
      {month && (
        <>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="label">סה"כ חיובי תשלומים — {formatMonth(month)}</div>
              <div className="value">{formatMoney(monthTotal)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">מספר עסקאות</div>
              <div className="value" style={{ fontSize: '1.8rem' }}>{monthRows.length}</div>
            </div>
          </div>
          <div className="card" style={{ overflowX: 'auto', padding: 0, marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>תיאור</th>
                  <th>תאריך</th>
                  <th>תשלום</th>
                  <th>חיוב חודשי</th>
                  <th>סכום כולל</th>
                  <th>קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.note || t.sourceDescription}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.date}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: 'rgba(42,120,214,0.12)', fontSize: 13, fontWeight: 600 }}>
                        {t.installmentCurrent}/{t.installmentTotal}
                      </span>
                    </td>
                    <td style={{ color: 'var(--series-2)', fontWeight: 600 }}>{formatMoney(t.amount)}</td>
                    <td>{formatMoney(t.originalAmount || t.amount * t.installmentTotal)}</td>
                    <td style={{ fontSize: 13 }}>{t.category}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={3}>סה"כ</td>
                  <td>{formatMoney(monthTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* ── Active view ── */}
      {!month && (
        <>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="label">סה"כ חיוב חודשי</div>
              <div className="value">{formatMoney(totalMonthly)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">סה"כ יתרה לתשלום</div>
              <div className="value">{formatMoney(totalRemaining)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">עסקאות פעילות</div>
              <div className="value" style={{ fontSize: '1.8rem' }}>{installments.length}</div>
            </div>
          </div>
          <div className="card" style={{ overflowX: 'auto', padding: 0, marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>תיאור</th>
                  <th>סכום כולל</th>
                  <th>חיוב חודשי</th>
                  <th>תשלום</th>
                  <th>נשאר</th>
                  <th>יתרה לתשלום</th>
                  <th>סיום משוער</th>
                  <th>קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {installments.map(({ key, desc, monthlyAmount, originalAmount, remaining, remainingTotal, endMonth, t }) => (
                  <tr key={key}>
                    <td style={{ fontWeight: 500 }}>{desc}</td>
                    <td>{formatMoney(originalAmount)}</td>
                    <td style={{ color: 'var(--series-2)', fontWeight: 600 }}>{formatMoney(monthlyAmount)}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: 'rgba(42,120,214,0.12)', fontSize: 13, fontWeight: 600 }}>
                        {t.installmentCurrent}/{t.installmentTotal}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: remaining <= 2 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {remaining} תשלומים
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(remainingTotal)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{endMonth}</td>
                    <td style={{ fontSize: 13 }}>{t.category}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={2}>סה"כ</td>
                  <td>{formatMoney(totalMonthly)}</td>
                  <td colSpan={2}></td>
                  <td>{formatMoney(totalRemaining)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
