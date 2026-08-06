import { describe, it, expect } from 'vitest'
import {
  monthOf,
  filterTransactions,
  sumAmount,
  categoryTotals,
  fixedExpenses,
  incomeSummary,
  monthSummary,
  monthlyPivot
} from './aggregate'

const categories = ['בית', 'מזון', 'כיף', 'דלק', 'גנים']

function tx(overrides) {
  return {
    id: Math.random().toString(36),
    date: '2026-06-15',
    month: '2026-06',
    type: 'expense',
    category: 'מזון',
    person: 'שרון',
    amount: 100,
    isFixed: false,
    ...overrides
  }
}

describe('monthOf', () => {
  it('extracts YYYY-MM from a date string', () => {
    expect(monthOf('2026-06-15')).toBe('2026-06')
  })
})

describe('filterTransactions', () => {
  const data = [
    tx({ month: '2026-06', person: 'שרון' }),
    tx({ month: '2026-06', person: 'יהונתן' }),
    tx({ month: '2026-07', person: 'שרון' })
  ]

  it('filters by month', () => {
    expect(filterTransactions(data, { month: '2026-06' })).toHaveLength(2)
  })

  it('filters by person, ignoring "הכל"', () => {
    expect(filterTransactions(data, { person: 'שרון' })).toHaveLength(2)
    expect(filterTransactions(data, { person: 'הכל' })).toHaveLength(3)
  })
})

describe('categoryTotals', () => {
  it('only totals variable (non-fixed) expenses, per category', () => {
    const data = [
      tx({ category: 'מזון', amount: 100 }),
      tx({ category: 'מזון', amount: 50 }),
      tx({ category: 'דלק', amount: 200 }),
      tx({ category: 'בית', amount: 999, isFixed: true }), // excluded - fixed
      tx({ category: 'משכורת', amount: 500, type: 'income' }) // excluded - income
    ]
    const { totals, grandTotal } = categoryTotals(data, categories)
    expect(totals['מזון']).toBe(150)
    expect(totals['דלק']).toBe(200)
    expect(totals['בית']).toBe(0)
    expect(grandTotal).toBe(350)
  })

  it('buckets unknown categories into otherTotal', () => {
    const data = [tx({ category: 'משהו שלא ברשימה', amount: 30 })]
    const { otherTotal, grandTotal } = categoryTotals(data, categories)
    expect(otherTotal).toBe(30)
    expect(grandTotal).toBe(30)
  })
})

describe('fixedExpenses / incomeSummary', () => {
  it('separates fixed expenses and income from the rest', () => {
    const data = [
      tx({ isFixed: true, amount: 6900, category: 'בית' }),
      tx({ isFixed: false, amount: 100 }),
      tx({ type: 'income', amount: 16000, category: 'משכורת' })
    ]
    expect(fixedExpenses(data).total).toBe(6900)
    expect(incomeSummary(data).total).toBe(16000)
  })
})

describe('monthSummary', () => {
  it('computes remaining = income - (variable + fixed) expenses', () => {
    const data = [
      tx({ category: 'מזון', amount: 1000, isFixed: false }),
      tx({ category: 'בית', amount: 2000, isFixed: true }),
      tx({ type: 'income', amount: 5000, category: 'משכורת' })
    ]
    const s = monthSummary(data, categories)
    expect(s.variableTotal).toBe(1000)
    expect(s.fixedTotal).toBe(2000)
    expect(s.incomeTotal).toBe(5000)
    expect(s.expenseTotal).toBe(3000)
    expect(s.remaining).toBe(2000)
  })

  it('handles floating point amounts without drift', () => {
    const data = [tx({ amount: 0.1 }), tx({ amount: 0.2 })]
    const s = monthSummary(data, categories)
    expect(s.variableTotal).toBe(0.3)
  })
})

describe('monthlyPivot', () => {
  it('produces one row per month, sorted ascending', () => {
    const data = [
      tx({ month: '2026-07', amount: 10 }),
      tx({ month: '2026-06', amount: 20 }),
      tx({ month: '2026-06', amount: 5 })
    ]
    const pivot = monthlyPivot(data, categories)
    expect(pivot.map((r) => r.month)).toEqual(['2026-06', '2026-07'])
    expect(pivot[0].variableTotal).toBe(25)
    expect(pivot[1].variableTotal).toBe(10)
  })
})
