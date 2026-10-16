// In-progress state for typed practices that has not become a check-in yet:
// "5 of 8 glasses of water", "2 of 3 checklist items ticked", today's custom
// checklist items. Nothing here is a completion, so it never touches the
// database; it lives on this device for the current day only and is dropped
// the day after. The moment a practice is actually done, its detail is written
// to the check-in row and this entry is cleared.

const KEY = 'loam.practiceProgress.v1'

function readAll() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// { [practiceKey]: { tally?, ticks?, items?, manual? } } for one date.
export function readProgress(dateKey) {
  const all = readAll()
  const day = all[dateKey]
  return day && typeof day === 'object' ? day : {}
}

// Replace the whole day's progress. Older days are dropped on every write.
export function writeProgress(dateKey, day) {
  try {
    const keys = Object.keys(day || {})
    if (keys.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify({ [dateKey]: day }))
  } catch {
    // private mode / blocked storage: progress just won't survive a reload
  }
}
