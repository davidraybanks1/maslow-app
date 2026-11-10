// The one way the app writes a clock time: 4:13PM, 9:00AM.
function clock(hours, minutes) {
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')}${hours < 12 ? 'AM' : 'PM'}`
}

/** A timestamp or Date, in local time. */
export function formatClock(ts) {
  const d = new Date(ts)
  return clock(d.getHours(), d.getMinutes())
}

/** A stored "HH:MM" time of day. */
export function formatTimeOfDay(t) {
  return clock(Number(String(t).slice(0, 2)), Number(String(t).slice(3, 5)))
}
