/**
 * Every run currently going, across the four things the app tracks.
 *
 * A streak is not only a thing you are doing — a practice you have quietly
 * stopped is also a run, and the screen says so in unlit black rather than
 * pretending it isn't there. Quiet runs are only counted for practices you
 * have actually done ten or more times, so a thing you tried twice in June
 * never comes back as a reproach.
 */

const MIN_RUN = 3          // below this it is not a streak, it is a Tuesday
const QUIET_MIN_HISTORY = 10 // never shame a practice you barely started
const METER = 12           // days drawn in the little strip

const dayBefore = dk => {
  const d = new Date(dk + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Walk back from `today` while `hit` holds. Returns the run and its strip. */
function runBack(today, hit, want = true) {
  let dk = today, n = 0
  // a run that has not been logged today is still alive if yesterday held
  if (hit(dk) !== want) dk = dayBefore(dk)
  while (hit(dk) === want) { n++; dk = dayBefore(dk) }
  const strip = []
  let c = today
  for (let i = 0; i < METER; i++) { strip.unshift(hit(c) === want); c = dayBefore(c) }
  return { n, strip }
}

/** Longest run of `hit` anywhere in the logged history — for "longest yet". */
function longestRun(days, hit, want = true) {
  let best = 0, run = 0
  for (const dk of days) { if (hit(dk) === want) { run++; if (run > best) best = run } else run = 0 }
  return best
}

export function buildStreaks({ canvas, checkins, moods, practicesDB = [], today }) {
  const dayKeys = Object.keys(checkins || {}).filter(k => (checkins[k] || []).length)
  const moodDays = [...new Set((moods || []).map(m => m.date_key).filter(Boolean))]
  const all = [...new Set([...dayKeys, ...moodDays])].sort()
  if (!all.length) return []
  const end = today || all[all.length - 1]

  const didPrac = (p, dk) => (checkins[dk] || []).some(e =>
    p.id && e.practice_id ? e.practice_id === p.id : e.practice_text === p.label)

  // A need only counts as "met" for the day once every one of its active
  // practices landed - 2/2, 3/3 - not the moment any single one does.
  const practicesByNeed = {}
  for (const p of practicesDB) {
    if (p.archived_at || !p.need_id) continue
    ;(practicesByNeed[p.need_id] ||= []).push(p)
  }
  const metNeed = (needId, dk) => {
    const ps = practicesByNeed[needId]
    return !!ps && ps.length > 0 && ps.every(p => didPrac(p, dk))
  }

  const out = []
  const push = (kind, name, mode, hit, opts = {}) => {
    const { n, strip } = runBack(end, hit, !opts.quiet)
    if (n < MIN_RUN) return
    const best = longestRun(all, hit, !opts.quiet)
    out.push({
      kind, name, mode, days: n, strip,
      quiet: !!opts.quiet,
      isRecord: n >= best,
      key: `${kind}:${name}`,
      ...opts.extra,
    })
  }

  // needs
  const needIds = Object.keys(canvas || {}).filter(k => canvas[k])
  for (const id of needIds) push('need', id, canvas[id], dk => metNeed(id, dk))

  // modes — skipped when a mode has one need, because the card would be a copy
  const byMode = {}
  for (const id of needIds) (byMode[canvas[id]] ||= []).push(id)
  for (const [mode, ids] of Object.entries(byMode)) {
    if (ids.length < 2) continue
    push('mode', mode, mode, dk => ids.every(id => metNeed(id, dk)))
  }

  // practices, running and quiet
  for (const p of practicesDB) {
    if (p.archived_at) continue
    push('practice', p.label, p.need_id ? canvas[p.need_id] : null, dk => didPrac(p, dk))
    const history = all.filter(dk => didPrac(p, dk)).length
    if (history >= QUIET_MIN_HISTORY)
      push('practice', p.label, p.need_id ? canvas[p.need_id] : null, dk => didPrac(p, dk), { quiet: true })
  }

  // frequency — consecutive days spent mostly in one band
  const bandOf = {}
  for (const m of moods || []) {
    if (!m?.date_key) continue
    const b = m.mood === 'fine' ? 'mid' : m.mood
    const r = (bandOf[m.date_key] ||= { good: 0, mid: 0, bad: 0, n: 0 })
    if (r[b] !== undefined) r[b]++
    r.n++
  }
  const dayBand = dk => {
    const r = bandOf[dk]
    if (!r || !r.n) return null
    return ['good', 'mid', 'bad'].reduce((a, b) => (r[b] > r[a] ? b : a), 'good')
  }
  for (const band of ['good', 'mid', 'bad'])
    push('frequency', band, null, dk => dayBand(dk) === band)

  const rank = { practice: 0, need: 1, mode: 2, frequency: 3 }
  return out.sort((a, b) =>
    Number(a.quiet) - Number(b.quiet) || b.days - a.days || rank[a.kind] - rank[b.kind])
}

export const STREAK_KINDS = [
  { v: 'all', label: 'all' },
  { v: 'mode', label: 'modes' },
  { v: 'need', label: 'needs' },
  { v: 'practice', label: 'practices' },
  { v: 'frequency', label: 'vibrations' },
]
