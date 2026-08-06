import { describe, it, expect } from 'vitest'
import { normalizeDate, normalizeAmount } from './parseDate'

describe('normalizeDate', () => {
  it('passes through ISO dates', () => {
    expect(normalizeDate('2026-06-15')).toBe('2026-06-15')
  })

  it('converts DD/MM/YYYY (Israeli convention)', () => {
    expect(normalizeDate('15/06/2026')).toBe('2026-06-15')
  })

  it('converts DD.MM.YYYY', () => {
    expect(normalizeDate('05.08.2026')).toBe('2026-08-05')
  })

  it('converts an Excel serial date number', () => {
    // 46238 -> 2026-08-04 (verified against the real bank export sample)
    expect(normalizeDate('46238')).toBe('2026-08-04')
  })

  it('returns null for garbage input', () => {
    expect(normalizeDate('לא תאריך')).toBeNull()
    expect(normalizeDate('')).toBeNull()
    expect(normalizeDate(null)).toBeNull()
  })
})

describe('normalizeAmount', () => {
  it('parses plain numbers', () => {
    expect(normalizeAmount('123.45')).toBe(123.45)
  })

  it('strips thousands separators and currency symbol', () => {
    expect(normalizeAmount('1,300.00 ₪')).toBe(1300)
  })

  it('treats parens as negative', () => {
    expect(normalizeAmount('(500)')).toBe(-500)
  })

  it('returns 0 for blank', () => {
    expect(normalizeAmount('')).toBe(0)
    expect(normalizeAmount(undefined)).toBe(0)
  })
})
