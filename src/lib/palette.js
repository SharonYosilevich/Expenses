export const LIGHT_SERIES = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948'
]

export const DARK_SERIES = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767'
]

export const MUTED_LIGHT = '#898781'
export const MUTED_DARK = '#898781'

export function usePalette() {
  const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  return isDark ? DARK_SERIES : LIGHT_SERIES
}

export function colorForCategory(category, categories, palette) {
  const idx = categories.indexOf(category)
  if (idx === -1 || idx >= palette.length) return MUTED_LIGHT
  return palette[idx]
}
