import { describe, it, expect } from 'vitest'
import { guessHeaderRowIndex } from './importExcel.js'

describe('guessHeaderRowIndex', () => {
  it('picks the text header row over numeric-heavy data rows above and below it', () => {
    const rows = [
      ['עובר ושב'],
      [],
      ["חשבון: 0173406248", "יוסילביץ' יהונתן"],
      [],
      ['תאריך', 'תיאור התנועה', 'זכות/חובה', 'יתרה'],
      ['46238', 'הע. לאיסטרייכר אלי', '-1860', '38334.02'],
      ['46236', 'קופת גמל ל חיוב', '-200', '40194.02']
    ]
    expect(guessHeaderRowIndex(rows)).toBe(4)
  })

  it('is not fooled by a numeric summary row that happens to precede the real header', () => {
    const rows = [
      ['26 עסקאות לחיוב הקודם', '', '', '', '', '', '', 'סה"כ חיוב:', '3,267.18'],
      ['בית עסק', 'תאריך עסקה', 'סכום העסקה', 'פירוט', 'תאריך החיוב', 'סכום החיוב'],
      ['סטופמרקט יהלום', '07/08/2026', '281.89', '', '20260810', '281.89']
    ]
    expect(guessHeaderRowIndex(rows)).toBe(1)
  })
})
