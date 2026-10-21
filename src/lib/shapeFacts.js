// Writing "shapes" — rooms to write in instead of a blank page.
//
// Everything here is computed on the device from data the person already has
// in the app (check-ins, moods). Nothing is sent anywhere, and nothing here
// ever reads what they wrote in a draft. See the privacy policy.
import { needName, MODE_ORDER } from './constants'
import { normalizeBand, BAND_LABEL, FEELINGS } from './frequency'
import { buildLadder } from './ladder'
import { buildInsights } from './insights'
import { buildStreaks } from './streaks'
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
  { id: 'timer',        label: 'timer room',   blurb: 'you pick the time. it saves itself when the ring closes.' },
]

// what the pill on a saved entry says: the phone spaces were renamed, but the
// stored shape values (a DB check constraint) are the old ones
const CHIP_LABELS = { one_thing: 'gave and took', continue: 'revisit' }
export function shapeLabel(id) {
  return CHIP_LABELS[id] || SHAPES.find(s => s.id === id)?.label || null
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
// Every fact is a true statement drawn from what the person already has in
// the app — the same numbers the Data screen shows (observations, streaks,
// what changed, rhythm, vibrations) plus today's check-ins. All computed on
// the device; nothing is sent anywhere and no draft text is ever read.
//
// A fact: { id, label, text, kind: 'up' | 'down' | 'plain', dotBand?, dotMode? }
// `label` is the small caption (THIS WEEK, STREAK, WHAT CHANGED…), `text` is
// one sentence that stands on its own, `kind` says whether it gives or takes
// energy (used to build tension pairs).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const BAND_OF_FEELING = Object.fromEntries(
  Object.entries(FEELINGS).flatMap(([band, list]) => list.map(f => [f, band])),
)

// order the groups are dealt from, so any three facts tend to come from
// three different parts of the person's data
const GROUP_ORDER = [
  'FINDING', 'STREAK', 'WHAT CHANGED', 'OBSERVATION', 'YOUR RHYTHM',
  'YOUR VIBRATIONS', 'THIS WEEK', 'QUIET LATELY', 'TODAY', 'THIS MONTH', 'TRUE TODAY',
]

function safely(fn) {
  try { return fn() || [] } catch { return [] }
}

function insightFacts(state) {
  const ladder = buildLadder({
    canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [],
    practicesDB: state.practicesDB || [], modeOrder: MODE_ORDER,
  })
  const list = buildInsights({ ladder, moods: state.moods || [], checkins: state.checkins || {}, canvas: state.canvas || {} })
  return list.slice(0, 5).map(i => ({
    id: i.id,
    label: i.kind === 'finding' ? 'FINDING' : 'OBSERVATION',
    text: i.text,
    kind: i.kind === 'finding' ? 'up' : 'plain',
  }))
}

function streakFacts(state, today) {
  const list = buildStreaks({
    canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [],
    practicesDB: state.practicesDB || [], today,
  })
  const out = []
  for (const st of list.slice(0, 8)) {
    const key = `streak-${st.kind}-${st.name}-${st.quiet ? 'q' : 'r'}`
    const mode = st.mode || null
    if (st.quiet) {
      out.push({ id: key, label: 'QUIET LATELY', kind: 'down', dotMode: mode,
        text: `"${st.name}" has been quiet for ${st.days} days` })
    } else if (st.kind === 'practice') {
      out.push({ id: key, label: 'STREAK', kind: 'up', dotMode: mode,
        text: `"${st.name}" is on a ${st.days}-day run${st.isRecord ? ', your longest yet' : ''}` })
    } else if (st.kind === 'need') {
      out.push({ id: key, label: 'STREAK', kind: 'up', dotMode: mode,
        text: `${needName(st.name)} has been fully met ${st.days} days running` })
    } else if (st.kind === 'mode') {
      out.push({ id: key, label: 'STREAK', kind: 'up', dotMode: st.name,
        text: `every ${st.name} need met, ${st.days} days running` })
    } else if (st.kind === 'frequency') {
      out.push({ id: key, label: 'STREAK', kind: st.name === 'bad' ? 'down' : 'plain', dotBand: st.name,
        text: `${st.days} days running that were mostly ${BAND_LABEL[st.name] || st.name}` })
    }
  }
  return out
}

function weekChangeFacts(state, today) {
  const cur = lastDays(7, new Date(today + 'T12:00:00'))
  const prior = lastDays(14, new Date(today + 'T12:00:00')).slice(7)
  const out = []
  for (const needId of Object.keys(state.canvas || {})) {
    const pct = days => Math.round(days.filter(k => checkinsOn(state, k).some(c => c.need_id === needId)).length / days.length * 100)
    const delta = pct(cur) - pct(prior)
    if (delta >= 20) out.push({ id: `chg-up-${needId}`, label: 'WHAT CHANGED', kind: 'up', dotMode: state.canvas[needId], mag: delta,
      text: `${needName(needId)} is up ${delta} points on the week before` })
    if (delta <= -20) out.push({ id: `chg-down-${needId}`, label: 'WHAT CHANGED', kind: 'down', dotMode: state.canvas[needId], mag: -delta,
      text: `${needName(needId)} is down ${-delta} points on the week before` })
  }
  return out.sort((a, b) => b.mag - a.mag).slice(0, 4)
}

function rhythmFacts(state) {
  const byDay = Array.from({ length: 7 }, () => ({ good: 0, n: 0 }))
  for (const m of state.moods || []) {
    if (!m.date_key || !m.mood) continue
    const d = new Date(m.date_key + 'T12:00:00').getDay()
    byDay[d].n += 1
    if (normalizeBand(m.mood) === 'good') byDay[d].good += 1
  }
  const rated = byDay.map((r, d) => ({ d, n: r.n, pct: r.n ? Math.round(r.good / r.n * 100) : 0 })).filter(r => r.n >= 6)
  if (rated.length < 4) return []
  rated.sort((a, b) => b.pct - a.pct)
  const best = rated[0]
  const worst = rated[rated.length - 1]
  const out = [{ id: 'rhythm-best', label: 'YOUR RHYTHM', kind: 'up', dotBand: 'good',
    text: `${WEEKDAYS[best.d]}s are your strongest day, ${best.pct}% good check-ins` }]
  if (best.pct - worst.pct >= 15) out.push({ id: 'rhythm-worst', label: 'YOUR RHYTHM', kind: 'down', dotBand: 'mid',
    text: `${WEEKDAYS[worst.d]}s run quietest, ${worst.pct}% good check-ins` })
  return out
}

function vibrationFacts(state, today) {
  const set = new Set(lastDays(30, new Date(today + 'T12:00:00')))
  const tally = {}
  for (const m of state.moods || []) {
    if (!set.has(m.date_key) || !m.feeling) continue
    tally[m.feeling] = (tally[m.feeling] || 0) + 1
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  if (!top || top[1] < 4) return []
  const band = BAND_OF_FEELING[top[0]] || null
  return [{ id: 'vib-top', label: 'YOUR VIBRATIONS', kind: band === 'bad' ? 'down' : 'plain', dotBand: band,
    text: `${top[0]} is the vibration you have felt most this month, ${top[1]} check-ins` }]
}

// A ranked pool of true statements. Always returns at least three: sparse
// accounts get gentle, still-true fallbacks.
export function truthPool(state, today) {
  const all = []
  const week = lastDays(7, new Date(today + 'T12:00:00'))
  const month = lastDays(30, new Date(today + 'T12:00:00'))

  all.push(...safely(() => insightFacts(state)))
  all.push(...safely(() => streakFacts(state, today)))
  all.push(...safely(() => weekChangeFacts(state, today)))
  all.push(...safely(() => rhythmFacts(state)))
  all.push(...safely(() => vibrationFacts(state, today)))

  const counts = practiceCounts(state, week)
  if (counts[0] && counts[0].days >= 2) {
    all.push({ id: 'p-top', label: 'THIS WEEK', kind: 'up', dotMode: state.canvas?.[counts[0].needId] || null,
      text: `you did "${counts[0].text}" on ${counts[0].days} of the last 7 days` })
  }
  if (counts[1] && counts[1].days >= 2) {
    all.push({ id: 'p-second', label: 'THIS WEEK', kind: 'up', dotMode: state.canvas?.[counts[1].needId] || null,
      text: `"${counts[1].text}" showed up ${counts[1].days} ${plural(counts[1].days, 'day', 'days')} this week` })
  }

  const todayDone = checkinsOn(state, today)
  if (todayDone.length) {
    all.push({ id: 'today-n', label: 'TODAY', kind: 'up',
      text: `you have checked in ${todayDone.length} ${plural(todayDone.length, 'practice', 'practices')} today` })
  }
  const mood = latestMoodToday(state, today)
  if (mood) {
    const w = mood.feeling || BAND_LABEL[mood.band] || mood.band
    all.push({ id: 'mood-now', label: 'TODAY', kind: mood.band === 'bad' ? 'down' : 'plain', dotBand: mood.band,
      text: `you checked in as ${w} today` })
  }

  const seen = needLastSeen(state, today)
  const neglected = seen
    .filter(n => n.daysAgo == null || n.daysAgo >= 5)
    .sort((a, b) => (b.daysAgo ?? 999) - (a.daysAgo ?? 999))[0]
  if (neglected) {
    all.push({
      id: 'need-quiet', label: 'QUIET LATELY', kind: 'down', dotMode: state.canvas?.[neglected.needId] || null,
      text: neglected.daysAgo == null
        ? `${needName(neglected.needId)} has not had a check-in yet`
        : `${needName(neglected.needId)} has not had a check-in in ${neglected.daysAgo} days`,
    })
  }

  const needDays = {}
  for (const key of month) {
    const needs = new Set(checkinsOn(state, key).map(c => c.need_id).filter(Boolean))
    needs.forEach(id => { needDays[id] = (needDays[id] || 0) + 1 })
  }
  const topNeed = Object.entries(needDays).sort((a, b) => b[1] - a[1])[0]
  if (topNeed && topNeed[1] >= 4) {
    all.push({ id: 'need-top', label: 'THIS MONTH', kind: 'up', dotMode: state.canvas?.[topNeed[0]] || null,
      text: `${needName(topNeed[0])} is the need you have shown up for most this month` })
  }

  const weekday = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
  all.push(
    { id: 'f-here', label: 'TRUE TODAY', kind: 'plain', text: `you are here, writing, on a ${weekday}` },
    { id: 'f-nobody', label: 'TRUE TODAY', kind: 'plain', text: 'nobody has to read this' },
    { id: 'f-body', label: 'TRUE TODAY', kind: 'plain', text: 'your body is somewhere right now, doing its best' },
  )

  // dedupe by id, then deal round-robin across groups
  const byId = new Map()
  for (const f of all) if (!byId.has(f.id)) byId.set(f.id, f)
  const groups = new Map(GROUP_ORDER.map(g => [g, []]))
  for (const f of byId.values()) (groups.get(f.label) || groups.set(f.label, []).get(f.label)).push(f)
  const ordered = []
  for (let r = 0; ; r++) {
    let any = false
    for (const list of groups.values()) if (list[r]) { ordered.push(list[r]); any = true }
    if (!any) break
  }
  return ordered
}

// Pick three, starting somewhere that changes daily, and `offset` places
// along, so "show me three others" rotates through the pool.
export function pickTruths(pool, offset = 0, seed = 0) {
  const n = pool.length
  const start = (seed * 3 + offset * 3) % n
  const out = []
  for (let i = 0; i < Math.min(3, n); i++) out.push(pool[(start + i) % n])
  return out
}

// Two things pulling on you: one that gives energy, one that takes it or is
// missing. Falls back to plain framing when there isn't enough data.
export function tensionPair(state, today, offset = 0, seed = 0) {
  const pool = truthPool(state, today)
  const ups = pool.filter(t => t.kind === 'up')
  const downs = pool.filter(t => t.kind === 'down')
  const a = ups.length ? ups[(seed + offset) % ups.length] : { id: 'a-fb', label: 'GIVING ENERGY', kind: 'up', text: 'something that has been giving you energy lately' }
  const b = downs.length ? downs[(seed + offset) % downs.length] : { id: 'b-fb', label: 'TAKING ENERGY', kind: 'down', text: 'something that has been taking it' }
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

// A number that changes each day, so the same three facts don't greet you every time.
export function daySeed(dateKey) {
  return Math.floor(new Date(dateKey + 'T12:00:00').getTime() / 86400000)
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

