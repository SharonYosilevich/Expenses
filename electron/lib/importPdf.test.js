import { describe, it, expect } from 'vitest'
import { splitMergedTrailingDateColumn, fixReversedDecimal, isBoilerplate } from './importPdf.js'

describe('fixReversedDecimal', () => {
  it('un-reverses a bidi-split decimal amount', () => {
    expect(fixReversedDecimal('.89 281 ₪')).toBe('281.89 ₪')
  })

  it('handles thousands separators', () => {
    expect(fixReversedDecimal('.80 3,387 ₪')).toBe('3,387.80 ₪')
  })

  it('leaves ordinary text untouched', () => {
    expect(fixReversedDecimal('סטופמרקט יהלום')).toBe('סטופמרקט יהלום')
    expect(fixReversedDecimal('281.89 ₪')).toBe('281.89 ₪')
  })
})

describe('splitMergedTrailingDateColumn', () => {
  it('splits a merchant+date column into two when most values match the pattern', () => {
    const rows = [
      ['בית עסק תאריך עסקה', 'סכום העסקה'],
      ['סטופמרקט יהלום 07/08/2026', '281.89 ₪'],
      ['סטופמרקט יהלום 06/08/2026', '59.43 ₪'],
      ['ג\'מס הרצליה 03/08/2026', '181.00 ₪'],
      ['Apple Pay', ''] // noise row without a trailing date - should not block detection
    ]
    const result = splitMergedTrailingDateColumn(rows)
    expect(result[1]).toEqual(['סטופמרקט יהלום', '07/08/2026', '281.89 ₪'])
    expect(result[2]).toEqual(['סטופמרקט יהלום', '06/08/2026', '59.43 ₪'])
    expect(result[3]).toEqual(["ג'מס הרצליה", '03/08/2026', '181.00 ₪'])
  })

  it('leaves rows unchanged when no column looks like a merged date', () => {
    const rows = [
      ['תאריך', 'תיאור', 'סכום'],
      ['07/08/2026', 'סטופמרקט יהלום', '281.89 ₪']
    ]
    expect(splitMergedTrailingDateColumn(rows)).toEqual(rows)
  })
})

describe('isBoilerplate', () => {
  it('filters known footer/header noise', () => {
    expect(isBoilerplate('מסגרת אשראי כוללת: 10,000 ש"ח')).toBe(true)
    expect(isBoilerplate('')).toBe(true)
  })

  it('keeps real transaction text', () => {
    expect(isBoilerplate('סטופמרקט יהלום')).toBe(false)
  })
})
