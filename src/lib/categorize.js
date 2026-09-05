const CARD_AGGREGATE_PATTERNS = [
  /חיוב לכרטיס/,
  /זיכוי לכרטיס/,
  /ח חיוב לכרטיס/,
  /ישראכרט/,
  /דיינרס/,
  /מקס איט פי/,
  /(^|\s)ויזה(\s|$)/,
  /מכרטיס\s*\d+/
]

const BALANCE_CARRY_PATTERNS = [/העברה מדף קודם/, /יתרה$/]

/**
 * Bank statements often show a lump "חיוב לכרטיס ויזה" line - the real
 * category breakdown (food/fuel/fun) lives in the detailed card statement.
 * Flag these so the review grid can warn about double-counting.
 */
export function isLikelyCardAggregate(description) {
  const d = description || ''
  return CARD_AGGREGATE_PATTERNS.some((re) => re.test(d))
}

export function isLikelyBalanceCarry(description) {
  const d = description || ''
  return BALANCE_CARRY_PATTERNS.some((re) => re.test(d))
}

/**
 * Longest-keyword-wins match against the description.
 * Supports optional conditions:
 *   amountCondition: 'whole' | 'decimal'
 *   fileTypes: ['card-1029', 'card-5128', ...]  — matches the imported file type
 * More specific rules (more conditions matched) beat less specific ones.
 */
export function suggestFromRules(description, rules, amount = null, fileType = null) {
  const d = (description || '').trim()
  if (!d) return null
  let best = null
  let bestScore = -1

  for (const rule of rules) {
    if (!rule.keyword) continue
    if (!d.includes(rule.keyword)) continue

    // Check amount condition
    if (rule.amountCondition && amount !== null) {
      const isWhole = Math.abs(amount) % 1 === 0
      if (rule.amountCondition === 'whole'   && !isWhole) continue
      if (rule.amountCondition === 'decimal' &&  isWhole) continue
    }

    // Check fileType condition — only skip if fileType is known AND doesn't match
    if (rule.fileTypes && rule.fileTypes.length > 0 && fileType) {
      if (!rule.fileTypes.includes(fileType)) continue
    }

    // Score: keyword length (×10) + specificity bonuses
    const score = rule.keyword.length * 10
      + (rule.amountCondition ? 5 : 0)
      + (rule.fileTypes       ? 5 : 0)

    if (score > bestScore) { bestScore = score; best = rule }
  }
  return best
}
