export const LIGHT_SERIES = [
  '#2a78d6', // כחול
  '#eb6834', // כתום
  '#1baf7a', // ירוק
  '#eda100', // זהב
  '#e87ba4', // ורוד
  '#008300', // ירוק כהה
  '#4a3aa7', // סגול
  '#e34948', // אדום
  '#00a8c6', // טורקיז
  '#8b5cf6', // סגול בהיר
  '#f59e0b', // ענבר
  '#10b981', // אמרלד
  '#ef4444', // אדום בהיר
  '#3b82f6', // כחול שמיים
  '#d946ef', // פוקסיה
  '#14b8a6', // טיל
  '#f97316', // כתום עמוק
  '#6366f1', // אינדיגו
  '#84cc16', // ליים
  '#ec4899', // ורוד חם
  '#06b6d4', // ציאן
  '#a855f7', // ענבית
  '#22c55e', // ירוק בהיר
  '#e11d48', // ורד
]

export const DARK_SERIES = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#00a000',
  '#9085e9',
  '#e66767',
  '#00bcd4',
  '#a78bfa',
  '#fbbf24',
  '#34d399',
  '#f87171',
  '#60a5fa',
  '#e879f9',
  '#2dd4bf',
  '#fb923c',
  '#818cf8',
  '#a3e635',
  '#f472b6',
  '#22d3ee',
  '#c084fc',
  '#4ade80',
  '#fb7185',
]

export const MUTED_LIGHT = '#898781'
export const MUTED_DARK = '#898781'

export function usePalette() {
  const isDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return isDark ? DARK_SERIES : LIGHT_SERIES
}

export function colorForCategory(category, categories, palette) {
  const idx = categories.indexOf(category)
  if (idx === -1 || idx >= palette.length) return MUTED_LIGHT
  return palette[idx]
}
