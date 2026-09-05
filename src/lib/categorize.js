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
 * Optional amount: if a rule has amountCondition ('whole' | 'decimal'), it is
 * only applied when the amount matches (whole = no cents, decimal = has cents).
 */
export function suggestFromRules(description, rules, amount = null) {
  const d = (description || '').trim()
  if (!d) return null
  let best = null
  for (const rule of rules) {
    if (!rule.keyword) continue
    if (!d.includes(rule.keyword)) continue
    // Check optional amount condition
    if (rule.amountCondition && amount !== null) {
      const isWhole = Math.abs(amount) % 1 === 0
      if (rule.amountCondition === 'whole'   && !isWhole) continue
      if (rule.amountCondition === 'decimal' &&  isWhole) continue
    }
    if (!best || rule.keyword.length > best.keyword.length) best = rule
  }
  return best
}
