import { useEffect, useId, useMemo, useState } from 'react'
import { FEELINGS, THREADS, BANDS, threadOf } from '../lib/frequency'
import { loadAllJournalMeta } from '../lib/store'
import FinePrint from './FinePrint'
import styles from './ThreadsSection.module.css'

/* The twelve words are four threads at three depths — frequency.js has always
   known this and threadOf() has never been called. Reading the threads instead
   of the words gives four buckets instead of twelve, which is the difference
   between a grid that fills this year and one that does not.

   Drawn as four concentric rings instead of a 2x2 grid: the outer ring is the
   thread you lead with (a stronger vibration reaches farther from "you" at
   the center), each ring's own arc is split into its three words by count,
   green arcs deepen as they run outward (growing), red arcs are deepest at
   the edge closest to you and fade outward (pressing in), and the flat grey
   arcs simply sit there. A leader line names each ring by the single word you
   reach for most inside it. The legend below repeats everything as plain,
   accessible text and is where the exact per-word counts live. */

const RAMP = {
  good: ['#3FA87A', '#0C5038'],
  mid: ['#C7D2C0', '#66795F'],
  bad: ['#FF8A66', '#A81F06'],
}
const SPARK_COLOR = { good: '#5BD99B', bad: '#FF6A46' }

// outermost ring = the thread you lead with; radii evenly spaced like ripples
const RADII = [58, 92, 124, 156]
const GAP = 6
const MIN_EMPTY = 8
// one label per ring: true left, true right, and the other two spaced evenly
// between them through the top
const LABEL_ANGLES = [-90, -30, 30, 90]
const R_LABEL = 202
// wide enough that even the longest feeling word ("overwhelmed") clears the
// edge when it lands as a thread's top word at true left/right
const CX = 340
const CY = 240

function shapeOf(counts) {
  const [g, m, b] = counts
  const total = g + m + b
  if (total < 5) return 'barely logged'
  if (m === 0 && g > 0 && b > 0) return 'it splits'
  if (g > m + b) return 'runs warm'
  if (b > g + m) return 'runs hot'
  return 'sits in the middle'
}

function polar(r, deg) {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: r * Math.cos(a), y: r * Math.sin(a) }
}
function arcPath(r, startDeg, endDeg) {
  const s = polar(r, startDeg)
  const e = polar(r, endDeg)
  const large = (endDeg - startDeg) % 360 > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}
function bandArcs(rungs) {
  const zero = rungs.filter(r => r.n === 0).length
  const live = rungs.filter(r => r.n > 0)
  const liveTotal = live.reduce((s, r) => s + r.n, 0)
  const available = 360 - GAP * rungs.length - zero * MIN_EMPTY
  let angle = 0
  return rungs.map(r => {
    const deg = r.n > 0 ? (liveTotal ? (r.n / liveTotal) * available : available / live.length) : MIN_EMPTY
    const seg = { start: angle, end: angle + deg, band: r.band, n: r.n, word: r.word }
    angle += deg + GAP
    return seg
  })
}
function radiusFor(sortedIndex) {
  return RADII[RADII.length - 1 - sortedIndex]
}
function strokeFor(total, maxTotal) {
  return 11 + Math.sqrt(total / maxTotal) * 13
}
// small sparks drifting along a segment's own radial direction — outward for
// good, inward for bad — so the direction reads as motion, not just color
function sparksFor(seg, ringRadius) {
  if (seg.n <= 0 || seg.band === 'mid') return []
  const outward = seg.band === 'good'
  const span = seg.end - seg.start
  const count = span > 40 ? 3 : span > 18 ? 2 : 1
  const out = []
  for (let k = 1; k <= count; k++) {
    const angle = seg.start + span * (k / (count + 1))
    const p0 = polar(ringRadius, angle)
    const p1 = polar(outward ? ringRadius + 13 : ringRadius - 13, angle)
    out.push({
      key: `${seg.band}-${k}`,
      x: p0.x, y: p0.y,
      dx: `${(p1.x - p0.x).toFixed(2)}px`,
      dy: `${(p1.y - p0.y).toFixed(2)}px`,
      dur: `${(2.4 + (k % 3) * 0.35).toFixed(2)}s`,
      delay: `${(k * 0.45).toFixed(2)}s`,
      fill: SPARK_COLOR[seg.band],
    })
  }
  return out
}
function swatch(band) {
  return `linear-gradient(135deg,${RAMP[band][0]},${RAMP[band][1]})`
}

export default function ThreadsSection({ userId, moods }) {
  const [journal, setJournal] = useState(null)
  const [selected, setSelected] = useState(null)
  const gid = useId().replace(/:/g, '')

  useEffect(() => {
    let alive = true
    // no user, no journal — still render from the mood rows rather than vanishing
    if (!userId) { setJournal([]); return }
    loadAllJournalMeta(userId)
      .then(rows => { if (alive) setJournal(rows || []) })
      .catch(() => { if (alive) setJournal([]) })
    return () => { alive = false }
  }, [userId])

  const { grid, total, wordsUsed, since } = useMemo(() => {
    const tally = {}
    let first = null
    const add = (feeling, day) => {
      const t = threadOf(feeling)
      if (!t) return
      const band = BANDS.find(b => FEELINGS[b].includes(feeling))
      ;(tally[t] ||= { good: 0, mid: 0, bad: 0 })[band]++
      if (day && (!first || day < first)) first = day
    }
    for (const m of moods || []) if (m?.feeling) add(m.feeling, m.date_key)
    for (const j of journal || []) if (j?.mood_feeling) add(j.mood_feeling)

    const grid = THREADS.map((t, i) => {
      const counts = BANDS.map(b => tally[t]?.[b] ?? 0)
      const rungs = BANDS.map((b, k) => ({ band: b, word: FEELINGS[b][i], n: counts[k] }))
      const topWord = rungs.reduce((a, b) => (b.n > a.n ? b : a)).word
      return {
        key: t,
        rungs,
        total: counts.reduce((s, n) => s + n, 0),
        shape: shapeOf(counts),
        topWord,
      }
    })
    const total = grid.reduce((s, g) => s + g.total, 0)
    const wordsUsed = grid.reduce((s, g) => s + g.rungs.filter(r => r.n > 0).length, 0)
    return { grid, total, wordsUsed, since: first }
  }, [moods, journal])

  const sorted = useMemo(() => [...grid].sort((a, b) => b.total - a.total), [grid])
  const maxTotal = Math.max(1, ...sorted.map(t => t.total))

  if (journal === null) return null
  if (total < 3) return null

  const loudest = sorted[0]
  const split = grid.find(g => g.shape === 'it splits')
  // default to the thread you lead with until you pick one yourself
  const activeKey = selected ?? loudest.key

  return (
    <section className={styles.section}>
      <div className={styles.pad}>
        <h2 className={styles.title}>Your vibrations</h2>
        <p className={styles.sub}>
          {total} reading{total === 1 ? '' : 's'}
          {since ? ` since ${since}` : ''} · {wordsUsed} of 12 words used
        </p>
        {split ? (
          <p className={styles.claim}>
            <em>{split.key}</em> is the one that splits. {split.total} readings and not one landed
            on {split.rungs[1].word} — you are {split.rungs[0].word}, or you are {split.rungs[2].word}.
          </p>
        ) : (
          <p className={styles.claim}>
            <em>{loudest.key}</em> is the thread you name most — {loudest.total} of your{' '}
            {total} readings.
          </p>
        )}

        <div className={styles.ringsWrap}>
          <svg className={styles.rings} viewBox="0 0 680 480" aria-hidden="true">
            <defs>
              {sorted.map((t, i) => {
                const r = radiusFor(i)
                const sw = strokeFor(t.total, maxTotal)
                const outerEdge = r + sw / 2
                const innerEdge = r - sw / 2
                const innerFrac = Math.max(0, innerEdge / outerEdge)
                return t.rungs
                  .filter(rg => rg.n > 0 && rg.band !== 'mid')
                  .map(rg => {
                    const inner = rg.band === 'good' ? RAMP.good[0] : RAMP.bad[1]
                    const outer = rg.band === 'good' ? RAMP.good[1] : RAMP.bad[0]
                    return (
                      <radialGradient
                        key={`${t.key}-${rg.band}`}
                        id={`${gid}-grad-${t.key}-${rg.band}`}
                        gradientUnits="userSpaceOnUse"
                        cx="0" cy="0" r={outerEdge}
                      >
                        <stop offset={innerFrac} stopColor={inner} />
                        <stop offset="1" stopColor={outer} />
                      </radialGradient>
                    )
                  })
              })}
            </defs>

            <g transform={`translate(${CX},${CY})`}>
              <circle className={`${styles.pulse} ${styles.pulse1}`} r="20" />
              <circle className={`${styles.pulse} ${styles.pulse2}`} r="20" />
              <circle className={`${styles.pulse} ${styles.pulse3}`} r="20" />
            </g>

            {sorted.map((t, i) => {
              const r = radiusFor(i)
              const sw = strokeFor(t.total, maxTotal)
              const segs = bandArcs(t.rungs)
              const on = activeKey === t.key
              return (
                <g
                  key={t.key}
                  className={`${styles.ringGroup} ${on ? styles.ringOn : styles.ringDim}`}
                  transform={`translate(${CX},${CY}) rotate(${i * 7})`}
                  onClick={() => setSelected(t.key)}
                >
                  {segs.map((seg, si) => {
                    if (seg.n > 0) {
                      const stroke = seg.band === 'mid' ? RAMP.mid[0] : `url(#${gid}-grad-${t.key}-${seg.band})`
                      return (
                        <path key={si} className={styles.ringSeg} d={arcPath(r, seg.start, seg.end)}
                          stroke={stroke} strokeWidth={sw} strokeLinecap="butt" fill="none" />
                      )
                    }
                    return (
                      <path key={si} className={styles.ringSegEmpty} d={arcPath(r, seg.start, seg.end)}
                        strokeWidth={Math.max(sw * 0.4, 4)} strokeLinecap="round" fill="none" />
                    )
                  })}
                  {segs.flatMap(seg => sparksFor(seg, r)).map(sp => (
                    <circle
                      key={sp.key} className={styles.spark} r="1.9"
                      cx={sp.x} cy={sp.y} fill={sp.fill}
                      style={{ '--dx': sp.dx, '--dy': sp.dy, animationDuration: sp.dur, animationDelay: sp.delay }}
                    />
                  ))}
                  <circle className={styles.ringHit} r={r} strokeWidth={sw + 8} fill="none" />
                </g>
              )
            })}

            {sorted.map((t, i) => {
              const r = radiusFor(i)
              const sw = strokeFor(t.total, maxTotal)
              const angle = LABEL_ANGLES[i]
              const side = angle < 0 ? -1 : 1
              const lineStart = polar(r + sw / 2 + 3, angle)
              const lineEnd = polar(R_LABEL, angle)
              const on = activeKey === t.key
              return (
                <g
                  key={t.key}
                  className={`${styles.labelGroup}${on ? ` ${styles.labelOn}` : ''}`}
                  transform={`translate(${CX},${CY})`}
                  onClick={() => setSelected(t.key)}
                >
                  <line className={styles.labelLine} x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} />
                  <circle className={styles.labelDot} cx={lineStart.x} cy={lineStart.y} r="2.5" />
                  <text
                    className={styles.labelText}
                    x={lineEnd.x + side * 7} y={lineEnd.y} dy=".32em"
                    textAnchor={side < 0 ? 'end' : 'start'}
                  >
                    {t.topWord}
                  </text>
                </g>
              )
            })}

            <g transform={`translate(${CX},${CY})`}>
              <circle className={styles.you} r="7" />
              <text className={styles.youLabel} y="22">you</text>
            </g>
          </svg>
        </div>

        <div className={styles.legend}>
          {grid.map(g => {
            const on = activeKey === g.key
            const dominant = g.rungs.reduce((a, b) => (b.n > a.n ? b : a)).band
            return (
              <div key={g.key} className={`${styles.legendRow}${on ? ` ${styles.legendOn}` : ''}`}>
                <button type="button" className={styles.legendHead} onClick={() => setSelected(g.key)}
                  aria-expanded={on}>
                  <span className={styles.legendDot} style={{ background: swatch(dominant) }} />
                  <span className={styles.legendName}>{g.key}</span>
                  <span className={styles.legendShape}>{g.shape}</span>
                  <span className={styles.legendN}>{g.total}</span>
                  <span className={styles.legendCaret} aria-hidden="true">›</span>
                </button>
                <div className={styles.rungsPanel}>
                  <div className={styles.rungsPanelInner}>
                    <div className={styles.rungs}>
                      {g.rungs.map(r => (
                        <div key={r.word} className={`${styles.rung}${r.n ? '' : ` ${styles.rungOff}`}`}>
                          <span className={styles.rungDot} style={r.n ? { background: swatch(r.band) } : undefined} />
                          <span className={styles.rungWord}>{r.word}</span>
                          <span className={styles.rungCount}>{r.n || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.key}>
          {BANDS.map(b => (
            <span key={b}>
              <i style={{ background: swatch(b) }} />
              {b === 'mid' ? 'fine' : b}
            </span>
          ))}
          <span className={styles.keyRight}>ring width = readings · outer ring = who you lead with</span>
        </div>

        <FinePrint>
          <p>The twelve feeling words you pick from are really four threads, each at three depths. <b>Capacity</b> runs calm, steady, overwhelmed. <b>Engagement</b> runs curious, flat, apathetic. <b>Drive</b> runs creative, restless, frenetic. <b>Posture</b> runs confident, braced, small.</p>
          <p>Each ring is a thread — the outer ring is the one you reach for most, and its width is how often you've named it. A ring's color runs from calm and settled near you to a deep, saturated green as it grows outward when things are going well, and runs the opposite way, deepest right at the edge closest to you, when the reading is hard — like something pressing in rather than opening out. The word on the ring's label is whichever of its three words you've picked most.</p>
        </FinePrint>
      </div>
    </section>
  )
}
