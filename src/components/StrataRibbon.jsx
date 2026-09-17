import { useMemo, useState } from 'react'
import { normalizeBand } from '../lib/frequency'
import styles from './StrataRibbon.module.css'

/* Absolute counts, not shares — a 100% stacked chart is necessarily a
   rectangle, and the whole point is that the silhouette should undulate.
   Thickness is how much you logged; the layers are how it felt. */

const BAND_C = {
  good: ['#3FA87A', '#0C5038', '#07301F'],
  mid: ['#D2DECB', '#9DB394', '#6E8566'],
  bad: ['#FF8A66', '#F03C10', '#A81F06'],
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

export default function StrataRibbon({ moods }) {
  const [range, setRange] = useState(30)

  const { pts, total, good, from, to } = useMemo(() => {
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
    return { pts, total, good, from: days[0], to: days[days.length - 1] }
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
    return { band, d }
  })

  return (
    <section className={styles.section}>
      <div className={styles.pad}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Your strata</h2>
          <div className={styles.legend}>
            {BANDS.map(b => (
              <span key={b}>
                <i style={{ background: `linear-gradient(160deg,${BAND_C[b][0]},${BAND_C[b][2]})` }} />
                {b === 'mid' ? 'fine' : b}
              </span>
            ))}
          </div>
        </div>
        <p className={styles.sub}>{pts.length} days · {from?.slice(5)} — {to?.slice(5)}</p>
        <p className={styles.story}>
          Good took {Math.round((good / Math.max(total, 1)) * 100)}% of these {total} <span className={styles.nb}>check-ins</span>
          {pts.length > 20 ? <>, <em>and the seam has barely moved.</em></> : '.'}
        </p>
      </div>

      <figure className={styles.fig}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="How your days have layered up">
          <defs>
            {BANDS.map(b => (
              <linearGradient key={b} id={`st-${b}`} x1="14%" y1="4%" x2="86%" y2="96%">
                <stop offset="0%" stopColor={BAND_C[b][0]} />
                <stop offset="34%" stopColor={BAND_C[b][1]} />
                <stop offset="100%" stopColor={BAND_C[b][2]} />
              </linearGradient>
            ))}
          </defs>
          {layers.map(l => <path key={l.band} d={l.d} fill={`url(#st-${l.band})`} />)}
        </svg>
      </figure>

      <div className={styles.pad}>
        <p className={styles.read}>
          Thickness is how much you logged that day; the layers are how it felt.
          {pts.length > 14 && ' Days are smoothed across their neighbours at this length, so the shape reads as terrain rather than as a sawtooth.'}
        </p>
        <div className={styles.kinds}>
          {RANGES.map(r => (
            <button
              key={r.v} type="button" aria-pressed={range === r.v}
              className={`${styles.kindPill}${range === r.v ? ` ${styles.kindOn}` : ''}`}
              onClick={() => setRange(r.v)}
            >{r.label}</button>
          ))}
        </div>
      </div>
    </section>
  )
}
