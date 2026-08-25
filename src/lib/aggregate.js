export function monthOf(dateStr) {
  return (dateStr || '').slice(0, 7)
}

export function filterTransactions(transactions, filters = {}) {
  const { month, person, type, isFixed, category } = filters
  return transactions.filter((t) => {
    if (month && t.month !== month) return false
    if (person && person !== 'הכל' && t.person !== person) return false
    if (type && t.type !== type) return false
    if (typeof isFixed === 'boolean' && !!t.isFixed !== isFixed) return false
    if (category && t.category !== category) return false
    return true
  })
}

export function sumAmount(transactions) {
  return round2(transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0))
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Variable (non-fixed) expenses, totaled per category - the "columns" view.
 */
export function categoryTotals(transactions, categories) {
  const variable = transactions.filter((t) => t.type === 'expense' && !t.isFixed)
  const totals = {}
  for (const cat of categories) {
    totals[cat] = sumAmount(variable.filter((t) => t.category === cat))
  }
  const known = new Set(categories)
  const other = variable.filter((t) => !known.has(t.category))
  return { totals, otherTotal: sumAmount(other), grandTotal: sumAmount(variable) }
}

export function fixedExpenses(transactions) {
  const fixed = transactions.filter((t) => t.type === 'expense' && !!t.isFixed)
  return { items: fixed, total: sumAmount(fixed) }
}

export function incomeSummary(transactions) {
  const income = transactions.filter((t) => t.type === 'income')
  return { items: income, total: sumAmount(income) }
}

export function monthSummary(transactions, categories) {
  const { totals: varTotals, otherTotal: varOtherTotal, grandTotal: variableTotal } = categoryTotals(transactions, categories)
  const { total: fixedTotal, items: fixedItems } = fixedExpenses(transactions)
  const { total: incomeTotal, items: incomeItems } = incomeSummary(transactions)

  // All expenses (variable + fixed) per category — for the category breakdown table
  const allExpenses = transactions.filter((t) => t.type === 'expense')
  const allTotals = {}
  for (const cat of categories) {
    allTotals[cat] = sumAmount(allExpenses.filter((t) => t.category === cat))
  }
  const known = new Set(categories)
  const allOtherTotal = sumAmount(allExpenses.filter((t) => !known.has(t.category)))

  const expenseTotal = round2(variableTotal + fixedTotal)
  const remaining = round2(incomeTotal - expenseTotal)
  return {
    categoryTotals: allTotals,
    otherTotal: allOtherTotal,
    varCategoryTotals: varTotals,
    varOtherTotal,
    variableTotal,
    fixedTotal,
    fixedItems,
    incomeTotal,
    incomeItems,
    expenseTotal,
    remaining
  }
}

export function sortedMonths(transactions) {
  return [...new Set(transactions.map((t) => t.month).filter(Boolean))].sort()
}

/**
 * rows = months, columns = categories, for the multi-month comparison view.
 */
export function monthlyPivot(transactions, categories) {
  const months = sortedMonths(transactions)
  return months.map((month) => {
    const monthTx = filterTransactions(transactions, { month })
    const summary = monthSummary(monthTx, categories)
    return { month, ...summary }
  })
}
