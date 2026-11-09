/* The dateline's NO.: whole calendar days since onboarding, plus one.
   users.onboarded_at is a Postgres `date`, so it arrives as YYYY-MM-DD. Parsing
   that with new Date() reads it as UTC midnight, which puts anyone west of UTC
   a day ahead by evening. Both ends are compared as local date keys instead,
   counted through Date.UTC so a daylight-saving change can't shift the result. */
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})/

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function keyToDayCount(key) {
  const [, y, m, d] = key.match(DATE_KEY)
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86400000
}

/* Returns the zero-padded NO., or null when there is no usable onboarding date. */
export function dayNumber(onboardedAt, now = new Date()) {
  if (typeof onboardedAt !== 'string' || !DATE_KEY.test(onboardedAt)) return null
  const elapsed = keyToDayCount(localKey(now)) - keyToDayCount(onboardedAt)
  if (Number.isNaN(elapsed)) return null
  return String(Math.max(1, elapsed + 1)).padStart(3, '0')
}
