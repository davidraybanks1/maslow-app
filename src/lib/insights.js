/**
 * Two kinds of card, and they are never dressed the same.
 *
 * A FINDING has come down the ladder and survived a correction for everything
 * it was compared against. An OBSERVATION is a count — it cannot be wrong
 * because it claims nothing beyond arithmetic.
 *
 * The old generator mixed them: getNeedMoodLinks ran ~10 uncorrected
 * comparisons with no control for how full the day was, which is how a card
 * reading "on days you log beauty, the next morning feels good 3.8x more
 * often" reached the screen. Beauty days average 7.0 needs met against 4.5 on
 * skip days; hold that constant and the odds ratio is 1.10, p = 0.95. Nothing.
 *
 * So: findings come only from the ladder, observations only from counts, and
 * neither is ever phrased as a multiplier — "82% against 52%" is the same fact
 * and much harder to oversell.
 */

import { walkLadder, oneIn } from './ladder'

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const SLOTS = [['morning', 'mornings'], ['midday', 'middays'], ['evening', 'evenings']]

function moodPanel(moods) {
  const byDay = new Map()
  for (const m of moods || []) {
    if (!m?.date_key) continue
    let r = byDay.get(m.date_key)
    if (!r) byDay.set(m.date_key, (r = { good: 0, rows: 0 }))
    r.rows++
    if (m.mood === 'good') r.good++
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, r]) => ({ day, ...r }))
}

function longestRun(seq, pred) {
  let best = 0, run = 0
  for (const x of seq) { if (pred(x)) { run++; best = Math.max(best, run) } else run = 0 }
  return best
}

/** Findings: only what the ladder was willing to call significant. */
function findings(ladder) {
  const out = []
  walkLadder(ladder || [], node => {
    if (node.tier !== 'significant') return
    const verb = node.kind === 'practice' ? 'do' : 'meet'
    out.push({
      id: `finding-${node.kind}-${node.name}`,
      kind: 'finding',
      text: `${node.hi}% of your check-ins come out good on the days you ${verb} ${node.name} — ${node.lo}% on the days you don't.`,
      basis: `${node.days} days against ${node.off} · luck would do this ${oneIn(node.p)}`,
      weight: 100 - Math.abs(node.gap || 0),
    })
  })
  return out
}

/** Observations: arithmetic, and nothing beyond it. */
function observations({ moods, checkins, canvas }) {
  const out = []
  const panel = moodPanel(moods)
  const rows = (moods || []).length
  if (!panel.length || rows < 30) return out

  const good = (moods || []).filter(m => m.mood === 'good').length
  const bad = (moods || []).filter(m => m.mood === 'bad').length

  // the day climbs, or it doesn't
  const slots = SLOTS.map(([slot, plural]) => {
    const ms = (moods || []).filter(m => m.prompt_time === slot)
    return { slot, plural, n: ms.length, pct: pct(ms.filter(m => m.mood === 'good').length, ms.length) }
  }).filter(s => s.n >= 12)
  if (slots.length === 3 && slots[2].pct - slots[0].pct >= 12) {
    out.push({
      id: 'obs-daypart', kind: 'obs', weight: 20,
      text: `Your day climbs. ${slots[0].plural} run ${slots[0].pct}% good, ${slots[1].plural} ${slots[1].pct}%, ${slots[2].plural} ${slots[2].pct}%.`,
      basis: `${rows} check-ins, sorted by the slot they came from`,
    })
  }

  // how much of the bloom is worth filling, and where it stops paying
  const sized = panel.map(d => ({ ...d, met: new Set((checkins[d.day] || []).map(e => e.need_id).filter(Boolean)).size }))
  const total = Object.keys(canvas || {}).filter(k => canvas[k]).length
  if (total >= 6 && sized.length >= 40) {
    const at = k => {
      const g = sized.filter(d => d.met >= k)
      return { pct: pct(g.reduce((s, d) => s + d.good, 0), g.reduce((s, d) => s + d.rows, 0)), days: g.length }
    }
    let knee = null
    for (let k = 3; k <= total - 1; k++) {
      const a = at(k), b = at(k + 1)
      if (a.days >= 12 && b.days >= 12 && b.pct - a.pct <= 1 && a.pct - at(k - 1).pct >= 5) { knee = { k, ...a }; break }
    }
    if (knee) out.push({
      id: 'obs-knee', kind: 'obs', weight: 22,
      text: `${knee.k} is your number. Meeting ${knee.k} needs puts you at ${knee.pct}% good — and the next one adds nothing at all.`,
      basis: `${knee.days} of ${sized.length} logged days reached it`,
    })
  }

  // hard days, and how hard they actually are
  if (bad > 0 && bad / rows <= 0.08) out.push({
    id: 'obs-bad-rare', kind: 'obs', weight: 26,
    text: `Bad is rare for you. ${bad} bad check-in${bad === 1 ? '' : 's'} in ${rows}. Your hard days are middling, not dark.`,
    basis: `${pct(good, rows)}% good, ${pct(rows - good - bad, rows)}% fine, ${pct(bad, rows)}% bad`,
  })

  // the floor, which is the number that actually frightens people
  const flatDays = panel.filter(d => d.good === 0).length
  if (flatDays > 0) {
    const worst = longestRun(panel, d => d.good === 0)
    const best = longestRun(panel, d => d.good === d.rows)
    out.push({
      id: 'obs-floor', kind: 'obs', weight: 24,
      text: `You have never had ${worst + 1} flat days running. ${flatDays} day${flatDays === 1 ? '' : 's'} had no good check-in in ${flatDays === 1 ? 'it' : 'them'}, and the longest run of those was ${worst}.`,
      basis: `${panel.length} logged days · longest all-good stretch was ${best}`,
    })
  }

  return out
}

/**
 * @returns [{ id, kind: 'finding' | 'obs', text, basis }] — findings first.
 */
export function buildInsights({ ladder, moods, checkins, canvas }) {
  const f = findings(ladder)
  const o = observations({ moods, checkins, canvas })
  const rank = x => (x.kind === 'finding' ? 0 : 1)
  return [...f, ...o].sort((a, b) => rank(a) - rank(b) || a.weight - b.weight)
}

export const INSIGHT_KIND = {
  finding: { label: 'finding', note: 'survived a correction for everything it was compared against' },
  obs: { label: 'observation', note: 'a count — it claims nothing beyond arithmetic' },
}
