import { describe, it, expect } from 'vitest'
import { splitMergedTrailingDateColumn, fixReversedDecimal, isBoilerplate, mergeOrphanDescriptionLines } from './importPdf.js'

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

describe('mergeOrphanDescriptionLines', () => {
  it('folds a wrapped merchant name forward and drops card-metadata noise, even when the description column shifts between rows', () => {
    // Real PDFs don't always put the merchant name in the same column
    // index - a slightly longer name can land one bin over. Row shape here
    // is [_, descA, descB, date, amount]; most rows use descA, one uses
    // descB - the collapse should handle both without losing text.
    const rows = [
      ['', 'בית עסק', '', 'תאריך עסקה', 'סכום העסקה'],
      ['', 'סטופמרקט יהלום', '', '07/08/2026', '281.89 ₪'],
      ['', '', 'APPLE.COM/BILL', '06/08/2026', '3.90 ₪'], // lands in descB, not descA
      ['', '', 'מזהה כרטיס', '', '6955'],
      ['', 'Apple Pay', '', '', ''],
      ['', 'YELLOW -גשר', '', '', ''], // orphan line 1 - no date, in descA
      ['', '', 'הארי', '', ''], // orphan line 2 - no date, in descB this time
      ['', '', 'מזהה כרטיס', '', '6955'],
      ['', '', '', '18/07/2026', '10.00 ₪'], // the real data line - description blank
      ['', 'Apple Pay', '', '', '']
    ]
    const result = mergeOrphanDescriptionLines(rows)
    const dataRow = result.find((r) => r[1] === '18/07/2026')
    expect(dataRow[0]).toBe('YELLOW -גשר הארי')
    const appleBillRow = result.find((r) => r[1] === '06/08/2026')
    expect(appleBillRow[0]).toBe('APPLE.COM/BILL')
    // marker-only rows should be gone entirely
    expect(result.some((r) => r.includes('מזהה כרטיס'))).toBe(false)
    expect(result.some((r) => r.includes('Apple Pay'))).toBe(false)
  })

  it('leaves rows unchanged when no clean date column is found', () => {
    const rows = [
      ['a', 'b'],
      ['c', 'd']
    ]
    expect(mergeOrphanDescriptionLines(rows)).toEqual(rows)
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
