import { useMemo, useState } from 'react'
import { normalizeBand } from '../lib/frequency'
import FinePrint from './FinePrint'
import styles from './StrataRibbon.module.css'

/* Absolute counts, not shares — a 100% stacked chart is necessarily a
   rectangle, and the whole point is that the silhouette should undulate.
   Thickness is how much you logged; the layers are how it felt. */

/* Drawn the way the roots are: a full-colour ridge line over a light fill,
   on the paper, rather than a solid gradient block. */
const BAND_C = {
  good: { line: '#0C5038', fill: 'rgba(12,80,56,.26)' },
  mid: { line: '#7E9478', fill: 'rgba(126,148,120,.14)' },
  bad: { line: '#E8461C', fill: 'rgba(232,70,28,.22)' },
}
const BANDS = ['good', 'mid', 'bad']
const RANGES = [
  { v: 7, label: 'week' }, { v: 14, label: '2 weeks' },
  { v: 21, label: '3 weeks' }, { v: 30, label: 'month' },
]
const W = 393, H = 196, TOP = 14, BOT = 190

/** Catmull-Rom through the points, emitted as cubic Béziers. */
function smoothPath(pts, close) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)},`
      + `${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)},`
      + `${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + (close || '')
}

/* One sentence for the whole shape, not just the share of good. Each day
   gets a score from -1 (all bad) to +1 (all good); the story is whichever of
   these the score does most clearly, in the order a friend would notice. */
function tellStory(raw, good, total) {
  const n = raw.length
  const score = raw.map(p => p.n ? (p.good - p.bad) / p.n : 0)
  const pct = Math.round((good / Math.max(total, 1)) * 100)
  const fmt = d => { const [, m, dd] = d.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${+dd}` }

  // red stretches: runs of days where bad held its own against good
  const runs = []
  let cur = null
  raw.forEach((p, i) => {
    const red = p.n > 0 && p.bad >= p.good
    if (red) { if (!cur) cur = { start: i, len: 0 }; cur.len++ }
    else if (cur) { runs.push(cur); cur = null }
  })
  if (cur) runs.push(cur)
  const tail = cur && cur.start + cur.len === n ? cur : null
  const longest = runs.reduce((a, r) => (!a || r.len > a.len ? r : a), null)

  if (tail && tail.len >= 3) {
    return { text: `You've been in the red for ${tail.len} days now.`, em: 'Be gentle with the next few.' }
  }
  if (longest && longest.len >= 3) {
    return {
      text: `There was a rough patch of ${longest.len} days around ${fmt(raw[longest.start].day)},`,
      em: 'and you came out of it.',
    }
  }

  // swings: how often the score crosses the middle, and how far it moves
  let crossings = 0, travel = 0
  for (let i = 1; i < n; i++) {
    if ((score[i] > 0.2 && score[i - 1] < -0.2) || (score[i] < -0.2 && score[i - 1] > 0.2)) crossings++
    travel += Math.abs(score[i] - score[i - 1])
  }
  if (n >= 10 && (crossings >= n / 5 || travel / (n - 1) > 0.6)) {
    return { text: 'Life has been a bit of a rollercoaster:', em: `${crossings} full swings in ${n} days.` }
  }

  // drift: the second half against the first
  const half = Math.floor(n / 2)
  const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1)
  const first = mean(score.slice(0, half)), second = mean(score.slice(half))
  if (n >= 10 && second - first > 0.2) {
    return { text: `You're getting good at feeling good.`, em: 'The second half of this stretch beat the first.' }
  }
  if (n >= 10 && first - second > 0.2) {
    return { text: `It started brighter than it's ending.`, em: 'The last stretch has run cooler than the first.' }
  }

  const mid = raw.reduce((s, p) => s + p.mid, 0), bad = total - good - mid
  const rest = mid >= bad ? 'and most of the rest was fine, not bad.' : 'and the rest leaned bad.'
  if (pct >= 60) {
    return { text: `Steady ground. Good took ${pct}% of these ${total} check-ins,`, em: n > 20 ? 'and the seam has barely moved.' : 'and it has held.' }
  }
  if (pct >= 40) {
    return { text: `A mixed stretch. Good took ${pct}% of these ${total} check-ins,`, em: rest }
  }
  return { text: `A heavy stretch. Good took only ${pct}% of these ${total} check-ins,`, em: rest }
}

export default function StrataRibbon({ moods }) {
  const [range, setRange] = useState(30)

  const { pts, from, to, story } = useMemo(() => {
    const byDay = new Map()
    for (const m of moods || []) {
      if (!m?.date_key) continue
      const b = normalizeBand(m.mood)
      const r = byDay.get(m.date_key) || { good: 0, mid: 0, bad: 0, n: 0 }
      if (r[b] !== undefined) r[b]++
      r.n++
      byDay.set(m.date_key, r)
    }
    const days = [...byDay.keys()].sort().slice(-range)
    const raw = days.map(d => ({ day: d, ...byDay.get(d) }))
    /* With two or three check-ins a day a raw series is a sawtooth, not
       terrain. Past a fortnight the counts get a 1-2-1 rolling mean. */
    const pts = raw.length <= 14 ? raw : raw.map((p, i, a) => {
      const lo = a[Math.max(i - 1, 0)], hi = a[Math.min(i + 1, a.length - 1)]
      const mean = k => (lo[k] + 2 * p[k] + hi[k]) / 4
      return { day: p.day, good: mean('good'), mid: mean('mid'), bad: mean('bad'), n: mean('n') }
    })
    const total = raw.reduce((s, p) => s + p.n, 0)
    const good = raw.reduce((s, p) => s + p.good, 0)
    return { pts, total, good, from: days[0], to: days[days.length - 1], story: tellStory(raw, good, total) }
  }, [moods, range])

  if (pts.length < 3) return null

  const peak = Math.max(...pts.map(p => p.n), 1)
  const x = i => (i / (pts.length - 1)) * (W + 24) - 12   // runs past both edges by design
  const h = v => ((v / peak) * (BOT - TOP))

  // stack from the baseline up: good, then fine, then bad
  let floor = pts.map(() => BOT)
  const layers = BANDS.map(band => {
    const lower = floor.map((y, i) => [x(i), y])
    const upper = floor.map((y, i) => [x(i), y - h(pts[i][band])])
    floor = upper.map(p => p[1])
    const rev = [...lower].reverse()
    // strip only the moveto; the curve back has to follow the lower edge, not cut across it
    const back = smoothPath(rev).replace(/^M\s*-?[\d.]+\s+-?[\d.]+/, '')
    const d = smoothPath(upper) + ` L${rev[0][0].toFixed(1)} ${rev[0][1].toFixed(1)}` + back + ' Z'
    return { band, d, ridge: smoothPath(upper) }
  })

  return (
    <section className={styles.section}>
      <div className={styles.pad}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Your strata</h2>
          <div className={styles.legend}>
            {BANDS.map(b => (
              <span key={b}>
                <i style={{ background: BAND_C[b].fill, boxShadow: `inset 0 1.5px 0 ${BAND_C[b].line}` }} />
                {b === 'mid' ? 'fine' : b}
              </span>
            ))}
          </div>
        </div>
        <p className={styles.sub}>{pts.length} days · {from?.slice(5)} — {to?.slice(5)}</p>
        <p className={styles.story}>
          {story.text} <em>{story.em}</em>
        </p>
      </div>

      <figure className={styles.fig}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="How your days have layered up">
          {layers.map(l => <path key={l.band} d={l.d} fill={BAND_C[l.band].fill} />)}
          {/* ridges drawn top layer first, so where a band is empty the one beneath shows through in its own colour */}
          {[...layers].reverse().map(l => <path key={`${l.band}-r`} d={l.ridge} fill="none" stroke={BAND_C[l.band].line} strokeWidth="1.6" strokeLinejoin="round" />)}
        </svg>
      </figure>

      <div className={styles.pad}>
        <div className={styles.kinds}>
          {RANGES.map(r => (
            <button
              key={r.v} type="button" aria-pressed={range === r.v}
              className={`${styles.kindPill}${range === r.v ? ` ${styles.kindOn}` : ''}`}
              onClick={() => setRange(r.v)}
            >{r.label}</button>
          ))}
        </div>
        <FinePrint>
          <p>Each day is a slice of ground. The taller the slice, the more check-ins you logged that day. The colours are how those check-ins felt, stacked from the bottom up: green for good, pale for fine, red for bad.</p>
          {pts.length > 14 && <p>At this length each day is blended a little with the day either side of it. Without that, two or three check-ins a day make a saw blade instead of land.</p>}
        </FinePrint>
      </div>
    </section>
  )
}
