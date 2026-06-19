export const DEBRIEF_TIMER_SECONDS = 420

export const BUILTIN_NATURE_TYPES = [
  { name: 'frenetic', bg: '#D93B1C', text: '#fff' },
  { name: 'overwhelm', bg: '#E8B81F', text: 'var(--ink)' },
  { name: 'apathy', bg: '#B8C3B1', text: 'var(--ink)' },
]

export const BUILTIN_PEAK_TYPES = [
  { name: 'confident', bg: '#1B3A2D', text: '#fff' },
  { name: 'creative', bg: '#E8B81F', text: 'var(--ink)' },
  { name: 'curious', bg: '#B8C3B1', text: 'var(--ink)' },
]

export const BUILTIN_ENVIRONMENT_TYPES = ['work', 'home', 'social', 'personal']

export const ENVIRONMENT_TAG_STYLE = { background: '#1A1A1A', color: '#F5F3ED' }

export const CUSTOM_TYPE_SWATCHES = ['#C47B3A', '#7A8FA6', '#9E7B5A', '#7A6B8A', '#7A6BAA']

export function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function natureTagStyle(name, customNatureTypes) {
  const builtin = BUILTIN_NATURE_TYPES.find(t => t.name === name)
  if (builtin) return { background: builtin.bg, color: builtin.text }
  const custom = (customNatureTypes || []).find(t => t.name === name)
  if (custom) return { background: custom.color, color: '#fff' }
  return { background: '#9A9690', color: '#fff' }
}

const PEAK_TAG_TINTS = {
  confident: { background: 'rgba(27,58,45,0.1)', color: '#1B3A2D' },
  creative: { background: 'rgba(232,184,31,0.12)', color: '#854F0B' },
  curious: { background: 'rgba(184,195,177,0.25)', color: '#4a5e45' },
}

export function peakTagStyle(name, customPeakTypes) {
  if (PEAK_TAG_TINTS[name]) return PEAK_TAG_TINTS[name]
  const custom = (customPeakTypes || []).find(t => t.name === name)
  if (custom) return { background: custom.color, color: '#fff' }
  return { background: '#9A9690', color: '#fff' }
}
