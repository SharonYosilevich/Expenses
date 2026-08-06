import React from 'react'

export function MonthSelect({ months, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {months.length === 0 && <option value="">אין נתונים</option>}
      {months.map((m) => (
        <option key={m} value={m}>
          {formatMonth(m)}
        </option>
      ))}
    </select>
  )
}

export function PersonPills({ people, value, onChange }) {
  const options = ['הכל', ...people]
  return (
    <div className="pill-group">
      {options.map((p) => (
        <button
          key={p}
          className={'pill' + (value === p ? ' active' : '')}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

export function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const names = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ]
  const idx = parseInt(mo, 10) - 1
  return `${names[idx] || mo} ${y}`
}
