import { describe, it, expect } from 'vitest'
import { isLikelyCardAggregate, isLikelyBalanceCarry, suggestFromRules } from './categorize'

describe('isLikelyCardAggregate', () => {
  it('flags lump credit-card charge lines from a bank statement', () => {
    expect(isLikelyCardAggregate('חיוב לכרטיס ויזה 5128')).toBe(true)
    expect(isLikelyCardAggregate('ח ישראכרט חיוב')).toBe(true)
    expect(isLikelyCardAggregate('מקס איט פי חיוב')).toBe(true)
  })

  it('does not flag ordinary transactions', () => {
    expect(isLikelyCardAggregate('חברת החשמל')).toBe(false)
    expect(isLikelyCardAggregate('העברה מביטון שגיא יצחק')).toBe(false)
  })
})

describe('isLikelyBalanceCarry', () => {
  it('flags opening-balance carry-forward lines', () => {
    expect(isLikelyBalanceCarry('אוגוסט 2025 העברה מדף קודם')).toBe(true)
  })
})

describe('suggestFromRules', () => {
  const rules = [
    { keyword: 'משכנתא', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
    { keyword: 'דסק-משכנתא', category: 'בית', person: 'בית', isFixed: true, type: 'expense' },
    { keyword: 'ביטוח לאומי', category: 'קצבאות', person: 'בית', isFixed: false, type: 'income' }
  ]

  it('matches a rule whose keyword is contained in the description', () => {
    const match = suggestFromRules('ח ביטוח לאומי - ילדים', rules)
    expect(match).not.toBeNull()
    expect(match.category).toBe('קצבאות')
  })

  it('prefers the longest matching keyword', () => {
    const match = suggestFromRules('ח דסק-משכנתא חיוב', rules)
    expect(match.keyword).toBe('דסק-משכנתא')
  })

  it('returns null when nothing matches', () => {
    expect(suggestFromRules('קניה בסופר', rules)).toBeNull()
  })
})
