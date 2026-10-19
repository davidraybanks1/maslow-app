// Writing "shapes" — rooms to write in instead of a blank page.
//
// Everything here is computed on the device from data the person already has
// in the app (check-ins, moods). Nothing is sent anywhere, and nothing here
// ever reads what they wrote in a draft. See the privacy policy.
import { needName } from './constants'
import { normalizeBand, BAND_LABEL } from './frequency'
import { SLOTS } from './slots'

// shape id -> value stored in journal.shape (matches the DB check constraint)
export const SHAPE_DB = {
  three_truths: 'three_truths',
  tension: 'tension',
  sort_first: 'sort_first',
  continue: 'continue',
  one_thing: 'one_thing',
  timer: 'timer',
}

export const SHAPES = [
  { id: 'three_truths', label: 'three truths', blurb: 'three facts about you right now. write what they have in common.' },
  { id: 'tension',      label: 'tension',      blurb: 'two things pulling on you. write the space between.' },
  { id: 'sort_first',   label: 'sort first',   blurb: 'sort the day into three piles, a line each.' },
  { id: 'continue',     label: 'continue',     blurb: 'pick up a note from before and answer it.' },
  { id: 'one_thing',    label: 'one thing',    blurb: 'pick a need. write one thing about it.' },
  { id: 'timer',        label: 'timer room',   blurb: 'three minutes. it saves itself when the ring closes.' },
]

export function shapeLabel(id) {
  return SHAPES.find(s => s.id === id)?.label || null
}

/* ── date helpers ──────────────────────────────────────────── */
function keyFor(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function lastDays(n, from = new Date()) {
  const out = []
  for (let i = 0; i < n; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() - i)
    out.push(keyFor(d))
  }
  return out
}
function daysBetween(aKey, bKey) {
  const a = new Date(aKey + 'T12:00:00')
  const b = new Date(bKey + 'T12:00:00')
  return Math.round((b - a) / 86400000)
}

/* ── data readers ──────────────────────────────────────────── */
function checkinsOn(state, key) {
  const v = state.checkins?.[key]
  return Array.isArray(v) ? v : []
}

// The most recent mood logged today (latest slot wins).
export function latestMoodToday(state, today) {
  const rows = (state.moods || []).filter(m => m.date_key === today && m.mood)
  if (!rows.length) return null
  rows.sort((a, b) => SLOTS.indexOf(a.prompt_time) - SLOTS.indexOf(b.prompt_time))
  const m = rows[rows.length - 1]
  return { band: normalizeBand(m.mood), feeling: m.feeling || null }
}

function practiceCounts(state, days) {
  const byText = new Map()
  for (const key of days) {
    const seen = new Set()
    for (const c of checkinsOn(state, key)) {
      const t = (c.practice_text || '').trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      const cur = byText.get(t) || { text: t, needId: c.need_id, days: 0 }
      cur.days += 1
      byText.set(t, cur)
    }
  }
  return [...byText.values()].sort((a, b) => b.days - a.days)
}

function needLastSeen(state, today) {
  const last = {}
  for (const key of Object.keys(state.checkins || {})) {
    for (const c of checkinsOn(state, key)) {
      if (!c.need_id) continue
      if (!last[c.need_id] || key > last[c.need_id]) last[c.need_id] = key
    }
  }
  const out = []
  for (const needId of Object.keys(state.canvas || {})) {
    out.push({ needId, daysAgo: last[needId] ? daysBetween(last[needId], today) : null })
  }
  return out
}

function moodWeek(state, days) {
  const set = new Set(days)
  const tally = { good: 0, mid: 0, bad: 0 }
  let n = 0
  for (const m of state.moods || []) {
    if (!set.has(m.date_key) || !m.mood) continue
    const b = normalizeBand(m.mood)
    if (tally[b] != null) { tally[b] += 1; n += 1 }
  }
  if (n < 3) return null
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  return { band: top[0], count: top[1], total: n }
}

function plural(n, one, many) { return n === 1 ? one : many }

/* ── truths ────────────────────────────────────────────────── */
// A ranked pool of true statements, each from the person's own check-ins and
// moods. `kind` is "up" (gives energy), "down" (takes or is missing) or
// "plain". Always returns at least three: sparse accounts get gentle,
// still-true fallbacks.
export function truthPool(state, today) {
  const pool = []
  const week = lastDays(7, new Date(today + 'T12:00:00'))
  const month = lastDays(30, new Date(today + 'T12:00:00'))

  const counts = practiceCounts(state, week)
  if (counts[0] && counts[0].days >= 2) {
    pool.push({ id: 'p-top', kind: 'up', text: `you did "${counts[0].text}" on ${counts[0].days} of the last 7 days` })
  }
  if (counts[1] && counts[1].days >= 2) {
    pool.push({ id: 'p-second', kind: 'up', text: `"${counts[1].text}" showed up ${counts[1].days} ${plural(counts[1].days, 'day', 'days')} this week` })
  }

  const todayDone = checkinsOn(state, today)
  if (todayDone.length) {
    pool.push({ id: 'today-n', kind: 'up', text: `you've already checked in ${todayDone.length} ${plural(todayDone.length, 'practice', 'practices')} today` })
  }

  const mood = latestMoodToday(state, today)
  if (mood) {
    const w = mood.feeling || BAND_LABEL[mood.band] || mood.band
    pool.push({ id: 'mood-now', kind: mood.band === 'bad' ? 'down' : 'plain', text: `you checked in as ${w} today` })
  }

  const mw = moodWeek(state, week)
  if (mw) {
    pool.push({ id: 'mood-week', kind: mw.band === 'bad' ? 'down' : 'plain', text: `most of your check-ins this week were ${BAND_LABEL[mw.band] || mw.band}` })
  }

  const seen = needLastSeen(state, today)
  const neglected = seen
    .filter(n => n.daysAgo == null || n.daysAgo >= 5)
    .sort((a, b) => (b.daysAgo ?? 999) - (a.daysAgo ?? 999))[0]
  if (neglected) {
    pool.push({
      id: 'need-quiet',
      kind: 'down',
      text: neglected.daysAgo == null
        ? `${needName(neglected.needId)} hasn't had a check-in yet`
        : `${needName(neglected.needId)} hasn't had a check-in in ${neglected.daysAgo} days`,
    })
  }

  const needDays = {}
  for (const key of month) {
    const needs = new Set(checkinsOn(state, key).map(c => c.need_id).filter(Boolean))
    needs.forEach(id => { needDays[id] = (needDays[id] || 0) + 1 })
  }
  const topNeed = Object.entries(needDays).sort((a, b) => b[1] - a[1])[0]
  if (topNeed && topNeed[1] >= 4) {
    pool.push({ id: 'need-top', kind: 'up', text: `${needName(topNeed[0])} is the need you've shown up for most this month` })
  }

  // Always-true fallbacks, so a brand-new account still gets three.
  const fallbacks = [
    { id: 'f-here', kind: 'plain', text: `you're here, writing, on ${new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}` },
    { id: 'f-nobody', kind: 'plain', text: 'nobody has to read this' },
    { id: 'f-body', kind: 'plain', text: 'your body is somewhere right now, doing its best' },
    { id: 'f-day', kind: 'plain', text: 'today is only one day in a longer run' },
  ]
  for (const f of fallbacks) pool.push(f)
  return pool
}

// Pick three, starting `offset` places along, so "shuffle" rotates.
export function pickTruths(pool, offset = 0) {
  const n = pool.length
  const out = []
  for (let i = 0; i < Math.min(3, n); i++) out.push(pool[(offset * 3 + i) % n])
  return out
}

// Two things pulling on you: one that gives energy, one that takes it or is
// missing. Falls back to plain framing when there isn't enough data.
export function tensionPair(state, today, offset = 0) {
  const pool = truthPool(state, today)
  const ups = pool.filter(t => t.kind === 'up')
  const downs = pool.filter(t => t.kind === 'down')
  const a = ups.length ? ups[offset % ups.length] : { id: 'a-fb', kind: 'up', text: 'something that has been giving you energy lately' }
  const b = downs.length ? downs[offset % downs.length] : { id: 'b-fb', kind: 'down', text: 'something that has been taking it' }
  return [a, b]
}

// Today's check-ins as chips for "sort first".
export function todayChips(state, today) {
  const seen = new Set()
  const out = []
  for (const c of checkinsOn(state, today)) {
    const t = (c.practice_text || '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.slice(0, 8)
}

/* ── one thing: angles per need ────────────────────────────── */
const ANGLES = {
  movement:    ['what did your body ask for today?', 'when did you last move without a reason?', 'what would a kind amount of movement be right now?'],
  nutrition:   ['what is one thing you ate that you actually liked?', 'what does your body seem to want?', 'where did a meal feel rushed, or easy?'],
  rest:        ['what would feel like real rest today?', 'what is asking you to keep going?', 'when did you last feel fully off?'],
  community:   ['who did you think of today?', 'who would be easy to be around right now?', 'what are you carrying alone?'],
  beauty:      ['what did you notice today that was lovely?', 'what would you stop and look at if you had five minutes?', 'where is there more beauty than you let in?'],
  intimacy:    ['who knows how you really are?', 'what is hard to say out loud?', 'what closeness do you want more of?'],
  reflection:  ['what keeps coming back around?', 'what are you still turning over?', 'what do you understand now that you did not last month?'],
  play:        ['when did you last lose track of time?', 'what would be fun and pointless?', 'what did you enjoy as a kid that you have dropped?'],
  money:       ['what is one number you are avoiding?', 'what would enough look like?', 'what did money make easier this week?'],
  dwelling:    ['what in your space is helping you?', 'what corner is asking for attention?', 'where do you feel most at home?'],
  information: ['what did you take in today that you wish you had not?', 'what are you curious about?', 'what do you need to know that you have been putting off?'],
  touch:       ['when did you last feel held, or hold something?', 'what textures or temperatures feel good to you?', 'where does your body want contact?'],
  thrill:      ['what would feel a little brave?', 'when did you last feel your heart pick up, in a good way?', 'what are you curious to try?'],
}
const GENERIC_ANGLES = [
  'what is one true thing about this today?',
  'what is it asking of you?',
  'what would a small step look like?',
]
export function anglesFor(needId) {
  return ANGLES[needId] || GENERIC_ANGLES
}

/* ── which shape fits today's mood ─────────────────────────── */
const BY_FEELING = {
  braced: 'tension', restless: 'tension',
  overwhelmed: 'timer', frenetic: 'timer',
  apathetic: 'one_thing', flat: 'one_thing', small: 'one_thing',
  calm: 'three_truths', steady: 'three_truths', curious: 'three_truths', creative: 'three_truths', confident: 'three_truths',
}

export function suggestShape(mood) {
  if (!mood || !mood.feeling) return null
  const id = BY_FEELING[mood.feeling]
  if (!id) return null
  return { id, line: `you checked in as ${mood.feeling}. ${shapeLabel(id)} might fit.` }
}

/* ── small formatting helpers ──────────────────────────────── */
export function daysAgoLabel(dateKey, today) {
  const n = daysBetween(dateKey, today)
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  return `${n} days ago`
}

export function shortDate(dateKey) {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function clip(text, max = 240) {
  const t = (text || '').trim()
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t
}
