/**
 * The ladder: mode → need → practice, tested down the canvas.
 *
 * The canvas is fixed before any of this is measured, so walking down it is a
 * closed testing procedure: each level is corrected only against its own
 * siblings, and a branch is never opened if its parent did not hold. That is
 * what buys back the power a flat scan over every practice throws away.
 *
 * Nothing here touches React or the store — pass it the same shapes the Data
 * screen already has.
 */

/* ── exact tests ───────────────────────────────────────────────────────── */

const LN_FACT = [0, 0]
function lnFact(n) {
  if (n < LN_FACT.length) return LN_FACT[n]
  for (let i = LN_FACT.length; i <= n; i++) LN_FACT[i] = LN_FACT[i - 1] + Math.log(i)
  return LN_FACT[n]
}
const lnChoose = (n, k) => (k < 0 || k > n ? -Infinity : lnFact(n) - lnFact(k) - lnFact(n - k))

/**
 * Two-sided Fisher exact on a 2x2. Worked in log space because the middle of
 * a 250-row table produces binomials that overflow a double.
 */
export function fisherExact(a, b, c, d) {
  const row1 = a + b, row2 = c + d, col1 = a + c, n = row1 + row2
  if (row1 === 0 || row2 === 0 || col1 === 0 || col1 === n) return 1
  const lnDen = lnChoose(n, col1)
  const p = k => Math.exp(lnChoose(row1, k) + lnChoose(row2, col1 - k) - lnDen)
  const obs = p(a) * (1 + 1e-9)
  let total = 0
  for (let k = Math.max(0, col1 - row2); k <= Math.min(row1, col1); k++) {
    const v = p(k)
    if (v <= obs) total += v
  }
  return Math.min(total, 1)
}

/**
 * Mantel–Haenszel odds ratio across strata. Used to hold day fullness
 * constant, so a mode does not get credit for simply being logged on busy days.
 */
export function mhOddsRatio(strata) {
  let num = 0, den = 0
  for (const { a, b, c, d } of strata) {
    const n = a + b + c + d
    if (!n) continue
    num += (a * d) / n
    den += (b * c) / n
  }
  return den > 1e-9 ? num / den : null
}

/* ── tiers ─────────────────────────────────────────────────────────────── */

export const TIERS = ['significant', 'close', 'testing', 'quiet', 'new']
export const TIER_COPY = {
  significant: 'too large for luck to be a comfortable explanation, even after correcting for everything it was compared against',
  close: 'it would already be significant if it were the only thing being tested',
  testing: 'large enough to matter, too thin to trust — the tier to run a deliberate experiment on',
  quiet: 'nothing showing, and not enough precision to rule an effect out either',
  new: 'too few days on one side to say anything at all',
}
const MIN_DAYS = 8       // days on each side before a row is testable at all
const MIN_ROWS = 10      // check-ins on each side
const WORTH_TESTING = 10 // points of gap that make a row worth an experiment

/* Two doors, one error budget. The gate (mode, then need, then practice,
   each corrected only against its siblings) is a shortcut that makes the
   bar fair for a practice whose need has already earned scrutiny - but it
   is a wall for a practice whose need failed. So there is a second door:
   every practice is also tested flat, corrected against all practices at
   once. A practice that clears THAT is significant whatever its parents
   did, because it cleared the bar the gate was only ever a shortcut around.
   The 0.05 is split between the doors so the two together still hold it. */
const ALPHA = 0.05
const GATE_ALPHA = ALPHA / 2
const WILD_ALPHA = ALPHA / 2

/** How often luck alone would produce this, phrased for a human. */
export function oneIn(p) {
  if (p == null || p <= 0) return 'never, in a run this size'
  const k = 1 / p
  if (k >= 1e5) return '1 day in millions'
  if (k >= 1000) return `1 day in ${(Math.round(k / 1000) * 1000).toLocaleString('en-US')}`
  return `1 day in ${Math.round(k)}`
}

/* ── the panel ─────────────────────────────────────────────────────────── */

function buildPanel({ checkins, moods }) {
  const byDay = new Map()
  for (const m of moods) {
    if (!m?.date_key) continue
    let r = byDay.get(m.date_key)
    if (!r) byDay.set(m.date_key, (r = { day: m.date_key, good: 0, rows: 0, needs: new Set(), pracs: new Set(), volume: 0 }))
    r.rows++
    if (m.mood === 'good') r.good++
  }
  for (const [day, r] of byDay) {
    for (const e of checkins[day] || []) {
      if (e.need_id) r.needs.add(e.need_id)
      if (e.practice_id) r.pracs.add(e.practice_id)
      r.volume++
    }
  }
  return [...byDay.values()].sort((x, y) => (x.day < y.day ? -1 : 1))
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const i = s.length >> 1
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2
}

/** One row of the ladder: the split, the two rates, the interval, the tier. */
function measure(panel, isOn, name, kind, floor, extra = {}) {
  let a = 0, b = 0, c = 0, d = 0, onDays = 0, offDays = 0
  const on = []
  for (const r of panel) {
    const hit = isOn(r)
    on.push(hit)
    if (hit) { onDays++; a += r.good; b += r.rows - r.good }
    else { offDays++; c += r.good; d += r.rows - r.good }
  }
  const base = { name, kind, days: onDays, off: offDays, floor: +floor.toFixed(4), ...extra }
  if (onDays < MIN_DAYS || offDays < MIN_DAYS || a + b < MIN_ROWS || c + d < MIN_ROWS)
    return { ...base, tier: 'new' }

  const p1 = a / (a + b), p0 = c / (c + d)
  const gap = (p1 - p0) * 100
  const se = Math.sqrt((p1 * (1 - p1)) / (a + b) + (p0 * (1 - p0)) / (c + d)) * 100
  const p = fisherExact(a, b, c, d)

  // day fullness held constant across tertiles of that day's check-in volume
  const vols = panel.map(r => r.volume)
  const q1 = median(vols.filter(v => v <= median(vols)))
  const q2 = median(vols.filter(v => v > median(vols)))
  const strata = [[-Infinity, q1], [q1, q2], [q2, Infinity]].map(([lo, hi]) => {
    let A = 0, B = 0, C = 0, D = 0
    panel.forEach((r, i) => {
      if (r.volume <= lo || r.volume > hi) return
      if (on[i]) { A += r.good; B += r.rows - r.good } else { C += r.good; D += r.rows - r.good }
    })
    return { a: A, b: B, c: C, d: D }
  })

  let tier
  if (p < floor) tier = 'significant'
  else if (p < ALPHA) tier = 'close'
  else if (Math.abs(gap) >= WORTH_TESTING) tier = 'testing'
  else tier = 'quiet'

  return {
    ...base,
    hi: Math.round(p1 * 100),
    lo: Math.round(p0 * 100),
    gap: +gap.toFixed(1),
    ci: [Math.round(gap - 1.96 * se), Math.round(gap + 1.96 * se)],
    p,
    or: mhOddsRatio(strata),
    tier,
  }
}

const RANK = Object.fromEntries(TIERS.map((t, i) => [t, i]))
const byTier = (x, y) => RANK[x.tier] - RANK[y.tier] || Math.abs(y.gap || 0) - Math.abs(x.gap || 0)

/**
 * @returns [{ ...mode, children: [{ ...need, children: [practice] }] }]
 *          sorted so whatever survives sits at the top of its level.
 */
export function buildLadder({ canvas, checkins, moods, practicesDB = [], modeOrder }) {
  const panel = buildPanel({ checkins, moods })
  if (panel.length < MIN_DAYS * 2) return []

  const needsOf = {}
  for (const [needId, mode] of Object.entries(canvas || {})) {
    if (!mode) continue
    ;(needsOf[mode] ||= []).push(needId)
  }
  const modes = (modeOrder || Object.keys(needsOf)).filter(m => needsOf[m]?.length)

  return modes.map(mode => {
    const ns = needsOf[mode]
    const counts = panel.map(r => ns.filter(n => r.needs.has(n)).length)
    let cut = median(counts)
    if (counts.every(c => c > cut) || counts.every(c => c <= cut))
      cut = counts.reduce((s, c) => s + c, 0) / counts.length
    const node = measure(panel, r => ns.filter(n => r.needs.has(n)).length > cut, mode, 'mode', GATE_ALPHA / modes.length)

    node.children = ns.map(needId => {
      const kid = measure(panel, r => r.needs.has(needId), needId, 'need', GATE_ALPHA / ns.length)
      const ps = practicesDB.filter(p => p.need_id === needId && !p.archived_at)
      kid.children = ps
        .map(p => measure(panel, r => r.pracs.has(p.id), p.label, 'practice', GATE_ALPHA / Math.max(ps.length, 1), { id: p.id }))
        .sort(byTier)
      return kid
    }).sort(byTier)

    return node
  }).sort(byTier)
}

/**
 * The second door. Every practice against the flat bar - WILD_ALPHA over the
 * number of live practices - regardless of its parents. A practice that
 * clears it while its chain above did not is a wild root: it carries a need
 * that otherwise isn't. Mutates the tree in place; returns the wild ones.
 */
export function openSecondDoor(tree, practicesDB = []) {
  const live = practicesDB.filter(p => !p.archived_at).length || 1
  const flat = WILD_ALPHA / live
  const wild = []
  walkLadder(tree, (n, depth, chain) => {
    if (n.kind !== 'practice' || n.p == null) return
    n.flatFloor = +flat.toFixed(6)
    const gatedOpen = chain.every(a => a.tier === 'significant')
    if (n.p < flat && !gatedOpen) {
      n.tier = 'significant'
      n.wild = true
      wild.push(n)
    }
  })
  return wild
}

/** Flatten for counting, badges, and the insight generator. */
export function walkLadder(tree, fn) {
  const go = (n, depth, chain) => { fn(n, depth, chain); (n.children || []).forEach(k => go(k, depth + 1, [...chain, n])) }
  ;(tree || []).forEach(n => go(n, 0, []))
}

export function tierCounts(tree) {
  const out = Object.fromEntries(TIERS.map(t => [t, 0]))
  let total = 0
  walkLadder(tree, n => { out[n.tier]++; total++ })
  return { ...out, total }
}
