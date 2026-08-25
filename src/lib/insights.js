import { filterTransactions, sumAmount, sortedMonths, round2 } from './aggregate.js'

/**
 * Compare current month spending per category to the average of previous months.
 * Returns anomalies: categories where spending > 150% of avg AND diff > 300 NIS.
 */
export function detectAnomalies(transactions, categories, currentMonth, prevN = 3) {
  const allMonths = sortedMonths(transactions)
  const prevMonths = allMonths.filter((m) => m < currentMonth).slice(-prevN)
  if (prevMonths.length === 0) return []

  const anomalies = []
  for (const cat of categories) {
    const currentSpend = sumAmount(
      filterTransactions(transactions, { month: currentMonth, type: 'expense' }).filter(
        (t) => !t.isFixed && t.category === cat
      )
    )
    const prevSpends = prevMonths.map((m) =>
      sumAmount(
        filterTransactions(transactions, { month: m, type: 'expense' }).filter(
          (t) => !t.isFixed && t.category === cat
        )
      )
    )
    const avg = round2(prevSpends.reduce((a, b) => a + b, 0) / prevSpends.length)
    if (avg > 0 && currentSpend > avg * 1.5 && currentSpend - avg > 300) {
      anomalies.push({ category: cat, currentSpend, avg, diff: round2(currentSpend - avg) })
    }
  }
  return anomalies.sort((a, b) => b.diff - a.diff)
}

/**
 * Forecast total month-end spend based on daily rate.
 * Uses only expense transactions (both fixed and variable).
 */
export function forecastMonthEnd(transactions, currentMonth) {
  const [year, mon] = currentMonth.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()

  const monthTx = filterTransactions(transactions, { month: currentMonth })
  const expenseTx = monthTx.filter((t) => t.type === 'expense')
  if (expenseTx.length === 0) return null

  const latestDate = expenseTx.reduce((max, t) => (t.date > max ? t.date : max), currentMonth + '-01')
  const daysElapsed = parseInt(latestDate.slice(8, 10), 10)
  if (daysElapsed < 3) return null

  // Fixed expenses are one-time — don't extrapolate them by daily rate
  const fixedSpend    = sumAmount(expenseTx.filter((t) => t.isFixed))
  const variableSpend = sumAmount(expenseTx.filter((t) => !t.isFixed))
  const remainingDays = daysInMonth - daysElapsed

  const variableDailyRate = variableSpend / daysElapsed
  const forecast = round2(fixedSpend + variableSpend + variableDailyRate * remainingDays)
  const currentSpend = round2(fixedSpend + variableSpend)

  return { currentSpend, forecast, daysInMonth, daysElapsed }
}

/**
 * Top N variable (non-fixed) expenses in a given month.
 */
export function topExpenses(transactions, currentMonth, n = 5) {
  return filterTransactions(transactions, { month: currentMonth, type: 'expense' })
    .filter((t) => !t.isFixed)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n)
}

/**
 * Average spending per category over the previous N months (excluding currentMonth).
 */
export function categoryAverages(transactions, categories, currentMonth, n = 3) {
  const allMonths = sortedMonths(transactions)
  const prevMonths = allMonths.filter((m) => m < currentMonth).slice(-n)
  if (prevMonths.length === 0) return {}

  const avgs = {}
  for (const cat of categories) {
    const spends = prevMonths.map((m) =>
      sumAmount(
        filterTransactions(transactions, { month: m, type: 'expense' }).filter(
          (t) => !t.isFixed && t.category === cat
        )
      )
    )
    avgs[cat] = round2(spends.reduce((a, b) => a + b, 0) / prevMonths.length)
  }
  return avgs
}
