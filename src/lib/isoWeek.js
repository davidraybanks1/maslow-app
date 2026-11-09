/** ISO-8601 week number (weeks start Monday; week 1 holds the first Thursday) for a local YYYY-MM-DD key. */
export function isoWeek(dk) {
  const [y, m, d] = dk.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7)
}
