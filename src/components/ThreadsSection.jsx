import { useEffect, useId, useMemo, useState } from 'react'
import { FEELINGS, THREADS, BANDS, THREAD_COPY, threadOf, splitFrequencyWords } from '../lib/frequency'
import { loadAllJournalMeta } from '../lib/store'
import { useChartCapture } from '../lib/useChartCapture'
import FinePrint from './FinePrint'
import styles from './ThreadsSection.module.css'

/* The twelve words are four threads at three depths — frequency.js has always
   known this and threadOf() has never been called. Reading the threads instead
   of the words gives four buckets instead of twelve, which is the difference
   between a grid that fills this year and one that does not.

   Drawn as four concentric rings instead of a 2x2 grid: the outer, biggest
   ring is the thread you lead with (a stronger vibration reaches farther from
   "you" at the center); the innermost, smallest is your quietest. Each ring
   draws only ONE arc — its own leading feeling's share of that thread,
   starting at the top and sweeping clockwise — rather than splitting into all
   three words, so the answer to "which one do I reach for" is the ring
   itself, not something you have to piece together from three segments. A few
   small points drift along that arc to show which way it's moving: green
   drifts outward (opening up), red drifts inward (pressing in), and a pale
   arc just holds still and breathes in place. Each thread's label lives at
   its own fixed spot — one to a quadrant — so a ring can grow or shrink with
   the data without its label ever moving or crowding another. The legend
   below repeats everything as plain, accessible text and is where the exact
   per-word counts live. */

const RAMP = {
  good: ['#3FA87A', '#0C5038'],
  mid: ['#C7D2C0', '#66795F'],
  bad: ['#FF8A66', '#A81F06'],
}
const SPARK_COLOR = { good: '#5BD99B', bad: '#FF6A46', mid: '#8FA184' }

// outermost ring = the thread you lead with; radii evenly spaced like ripples
const RADII = [58, 92, 124, 156]
const STROKE = 15
// one label per thread, fixed to its own quadrant — never reshuffles with
// the data, so a ring resizing day to day never sends its label into
// another ring's territory
const LABEL_DEG = { capacity: 315, engagement: 45, drive: 135, posture: 225 } // NW, NE, SE, SW
// clears every ring, even the largest, with room for the longest word
// ("overwhelmed") landing at true left or right
const R_LABEL = 202
const CX = 340
const CY = 240
const SPARK_FRACS = [0.15, 0.38, 0.62, 0.85]
// This SVG's viewBox (680 wide) renders far narrower than that on an actual
// phone screen — full-bleed inside the app it lands around 390 real CSS px,
// so 1 viewBox unit paints as only ~0.57 real px. A spark radius or font-size
// entered as a raw viewBox number quietly ends up well under --type-floor.
// SVG_SCALE inverts that ratio so the sizes below can be set to the real
// on-screen size they should read as, not the pre-shrink number.
const SVG_SCALE = 680 / 390

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
function radiusFor(sortedIndex) {
  return RADII[RADII.length - 1 - sortedIndex]
}
// small points along an arc, staggered so they read as a continuous drift
// rather than one blinking dot — outward for good, inward for bad, holding
// still and breathing in place for fine. startDeg lets this be reused for
// a segment that doesn't begin at the top (the exploded, full-ring view).
function sparksForRing(band, startDeg, shareDeg, r) {
  const fill = SPARK_COLOR[band]
  return SPARK_FRACS.map((f, k) => {
    const angle = startDeg + f * shareDeg
    const p0 = polar(r, angle)
    if (band === 'mid') {
      return { key: `${band}-${k}`, x: p0.x, y: p0.y, pulse: true, delay: `${(k * 0.6).toFixed(2)}s`, fill }
    }
    const p1 = polar(band === 'good' ? r + 16 : r - 16, angle)
    return {
      key: `${band}-${k}`,
      x: p0.x, y: p0.y,
      dx: `${(p1.x - p0.x).toFixed(2)}px`,
      dy: `${(p1.y - p0.y).toFixed(2)}px`,
      dur: `${(2.4 + (k % 3) * 0.35).toFixed(2)}s`,
      delay: `${(k * 0.55).toFixed(2)}s`,
      fill,
    }
  })
}
// the full breakdown for an expanded ring: each band with any readings gets
// its own consecutive slice — good, then fine, then bad — tiling the whole
// circle instead of just the leading feeling's share of it
function ringSegments(rungs, r) {
  const circumference = 2 * Math.PI * r
  const total = rungs.reduce((s, rg) => s + rg.n, 0)
  let cum = 0
  const segs = []
  for (const rung of rungs) {
    if (!rung.n) continue
    const len = (rung.n / total) * circumference
    segs.push({ band: rung.band, word: rung.word, n: rung.n, len, startDeg: (cum / circumference) * 360, shareDeg: (len / circumference) * 360 })
    cum += len
  }
  return { segs, circumference }
}
function swatch(band) {
  return `linear-gradient(135deg,${RAMP[band][0]},${RAMP[band][1]})`
}
// area-scaled so the biggest of a thread's three rung dots reads as clearly
// bigger, not just barely — sqrt because it's a circle's AREA that should
// track the count, not its diameter. Zero readings keep the pre-existing
// 8px size; rungOff's hollow-ring treatment already marks those as quiet.
const RUNG_DOT_MIN = 8, RUNG_DOT_MAX = 18
function rungDotSize(n, maxN) {
  if (!n || !maxN) return RUNG_DOT_MIN
  return Math.round(RUNG_DOT_MIN + (RUNG_DOT_MAX - RUNG_DOT_MIN) * Math.sqrt(n / maxN))
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

  const { grid, total } = useMemo(() => {
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
      const lead = rungs.reduce((a, b) => (b.n > a.n ? b : a))
      const total = counts.reduce((s, n) => s + n, 0)
      return {
        key: t,
        rungs,
        total,
        shape: shapeOf(counts),
        topWord: lead.word,
        leadBand: lead.band,
        leadN: lead.n,
        share: total ? lead.n / total : 0,
      }
    })
    const total = grid.reduce((s, g) => s + g.total, 0)
    const wordsUsed = grid.reduce((s, g) => s + g.rungs.filter(r => r.n > 0).length, 0)
    return { grid, total, wordsUsed, since: first }
  }, [moods, journal])

  const sorted = useMemo(() => [...grid].sort((a, b) => b.total - a.total), [grid])
  const radiusByKey = useMemo(
    () => Object.fromEntries(sorted.map((t, i) => [t.key, radiusFor(i)])),
    [sorted]
  )
  const chartRef = useChartCapture('data-vibrations', 'your vibrations')

  if (journal === null) return null
  if (total < 3) return null

  const split = grid.find(g => g.shape === 'it splits')
  // the single word you reach for most, across all twelve — not just the
  // top word within your busiest thread, which isn't always the same one
  const topOverall = grid
    .flatMap(g => g.rungs.map(r => ({ ...r, thread: g.key })))
    .reduce((a, b) => (b.n > a.n ? b : a))
  // nothing is picked until you tap one — every ring starts equal, at full
  // opacity and showing just its own leading arc; only a tap dims the rest
  // and fills the picked one in
  const activeKey = selected

  return (
    <section ref={chartRef} className={styles.section}>
      <div className={styles.pad}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Your vibrations</h2>
          <div className={styles.titleKey}>
            {BANDS.map(b => (
              <span key={b}>
                <i style={{ background: swatch(b) }} />
                {b === 'mid' ? 'fine' : b}
              </span>
            ))}
          </div>
        </div>
        {split ? (
          <p className={styles.claim}>
            <em>{split.key}</em> is the one that splits. {split.total} readings and not one landed
            on {split.rungs[1].word} — you are {split.rungs[0].word}, or you are {split.rungs[2].word}.
          </p>
        ) : (
          <p className={styles.claim}>
            You lead with <em>{topOverall.word}</em>. {topOverall.n} of your {total} readings —
            under {topOverall.thread}.
          </p>
        )}

        <div className={styles.ringsWrap}>
          <svg className={styles.rings} viewBox="0 0 680 480" aria-hidden="true">
            <defs>
              {/* one gradient per band, shared by every ring — a thread's
                  leading-arc color and, once expanded, each of its other
                  slices all draw from the same three */}
              {BANDS.map(b => (
                <radialGradient key={b} id={`${gid}-band-${b}`} cx="34%" cy="26%" r="75%">
                  <stop offset="0%" stopColor={RAMP[b][0]} />
                  <stop offset="100%" stopColor={RAMP[b][1]} />
                </radialGradient>
              ))}
            </defs>

            <g transform={`translate(${CX},${CY})`}>
              <circle className={`${styles.pulse} ${styles.pulse1}`} r="20" />
              <circle className={`${styles.pulse} ${styles.pulse2}`} r="20" />
              <circle className={`${styles.pulse} ${styles.pulse3}`} r="20" />
            </g>

            {sorted.map((t, i) => {
              const r = radiusFor(i)
              const shareDeg = t.share * 360
              const circumference = 2 * Math.PI * r
              const arcLen = t.share * circumference
              const on = activeKey === t.key
              // only dim the others once something is actually picked —
              // with nothing selected, every ring sits at full opacity
              const dimmed = activeKey != null && !on
              // picked: the full ring, broken into every band that has a
              // reading — "fill in the rest of the ring" once you tap in.
              // otherwise: just the leading feeling's own share, as before.
              const { segs } = on && t.total > 0 ? ringSegments(t.rungs, r) : { segs: null }
              return (
                <g
                  key={t.key}
                  className={`${styles.ringGroup}${on ? ` ${styles.ringOn}` : ''}${dimmed ? ` ${styles.ringDim}` : ''}`}
                  transform={`translate(${CX},${CY})`}
                  onClick={() => setSelected(t.key)}
                >
                  <circle className={styles.ringTrack} r={r} strokeWidth={STROKE} fill="none" />
                  {segs ? (
                    segs.map(seg => (
                      <g key={seg.band}>
                        <circle
                          className={styles.ringArc}
                          r={r} fill="none" strokeWidth={STROKE} strokeLinecap="butt"
                          stroke={`url(#${gid}-band-${seg.band})`}
                          strokeDasharray={`${seg.len.toFixed(1)} ${(circumference - seg.len).toFixed(1)}`}
                          strokeDashoffset={(-(seg.startDeg / 360) * circumference).toFixed(1)}
                          transform="rotate(-90)"
                        />
                        {sparksForRing(seg.band, seg.startDeg, seg.shareDeg, r).map(sp => sp.pulse ? (
                          <circle
                            key={sp.key} className={styles.sparkPulse} r={(2.3 * SVG_SCALE).toFixed(1)}
                            cx={sp.x} cy={sp.y} fill={sp.fill}
                            style={{ animationDelay: sp.delay }}
                          />
                        ) : (
                          <circle
                            key={sp.key} className={styles.spark} r={(2 * SVG_SCALE).toFixed(1)}
                            cx={sp.x} cy={sp.y} fill={sp.fill}
                            style={{ '--dx': sp.dx, '--dy': sp.dy, animationDuration: sp.dur, animationDelay: sp.delay }}
                          />
                        ))}
                      </g>
                    ))
                  ) : t.total > 0 && arcLen > 0.5 && (
                    <>
                      <circle
                        className={styles.ringArc}
                        r={r} fill="none" strokeWidth={STROKE} strokeLinecap="round"
                        stroke={`url(#${gid}-band-${t.leadBand})`}
                        strokeDasharray={`${arcLen.toFixed(1)} ${(circumference - arcLen).toFixed(1)}`}
                        transform="rotate(-90)"
                      />
                      {sparksForRing(t.leadBand, 0, shareDeg, r).map(sp => sp.pulse ? (
                        <circle
                          key={sp.key} className={styles.sparkPulse} r={(2.3 * SVG_SCALE).toFixed(1)}
                          cx={sp.x} cy={sp.y} fill={sp.fill}
                          style={{ animationDelay: sp.delay }}
                        />
                      ) : (
                        <circle
                          key={sp.key} className={styles.spark} r={(2 * SVG_SCALE).toFixed(1)}
                          cx={sp.x} cy={sp.y} fill={sp.fill}
                          style={{ '--dx': sp.dx, '--dy': sp.dy, animationDuration: sp.dur, animationDelay: sp.delay }}
                        />
                      ))}
                    </>
                  )}
                  <circle className={styles.ringHit} r={r} strokeWidth={STROKE + 10} fill="none" />
                </g>
              )
            })}

            {grid.map(g => {
              const r = radiusByKey[g.key]
              const deg = LABEL_DEG[g.key]
              const tickFrom = polar(r + STROKE / 2 + 2, deg)
              const lp = polar(R_LABEL, deg)
              const isRightSide = deg === 45 || deg === 135 // NE, SE
              const anchor = isRightSide ? 'start' : 'end'
              const on = activeKey === g.key
              return (
                <g
                  key={g.key}
                  className={`${styles.labelGroup}${on ? ` ${styles.labelOn}` : ''}`}
                  transform={`translate(${CX},${CY})`}
                  onClick={() => setSelected(g.key)}
                >
                  <line className={styles.labelTick} x1={tickFrom.x} y1={tickFrom.y} x2={lp.x} y2={lp.y} />
                  {g.total > 0 ? (
                    <>
                      {/* category first (which thread this is), the word you
                          actually lead with underneath it, count last — the
                          category is the label for the quadrant itself, so it
                          reads before the specific word it's naming */}
                      <text className={styles.labelSub} x={lp.x} y={lp.y - 10} textAnchor={anchor}>
                        {g.key.toUpperCase()}
                      </text>
                      <text className={styles.labelWord} x={lp.x} y={lp.y + 18} textAnchor={anchor}>
                        {g.topWord}
                      </text>
                      <text className={styles.labelCount} x={lp.x} y={lp.y + 40} textAnchor={anchor}>
                        {g.leadN}/{g.total}
                      </text>
                    </>
                  ) : (
                    <text className={styles.labelSub} x={lp.x} y={lp.y + 8} textAnchor={anchor}>
                      {g.key.toUpperCase()} · —
                    </text>
                  )}
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
                      {(() => {
                        const maxRungN = Math.max(...g.rungs.map(r => r.n))
                        return g.rungs.map(r => {
                          const size = rungDotSize(r.n, maxRungN)
                          return (
                            <div key={r.word} className={`${styles.rung}${r.n ? '' : ` ${styles.rungOff}`}`}>
                              <span
                                className={styles.rungDot}
                                style={{ width: size, height: size, flex: '0 0 auto', ...(r.n ? { background: swatch(r.band) } : null) }}
                              />
                              <span className={styles.rungWord}>{r.word}</span>
                              <span className={styles.rungCount}>{r.n || '—'}</span>
                            </div>
                          )
                        })
                      })()}
                    </div>
                    {/* what this thread means, and what to do about its bad-band
                        word — same panel you land in from a tap on the ring,
                        its SVG label, or this row, since all three share activeKey */}
                    <div className={styles.threadCopy}>
                      <p>{splitFrequencyWords(THREAD_COPY[g.key].definition).map((seg, i) =>
                        seg.bold ? <b key={i}>{seg.text}</b> : seg.text
                      )}</p>
                      <p>{splitFrequencyWords(THREAD_COPY[g.key].guidance).map((seg, i) =>
                        seg.bold ? <b key={i}>{seg.text}</b> : seg.text
                      )}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className={styles.footnote}>ring size = how active you are there · arc = your leading feeling's share</p>

        <FinePrint>
          <p>The twelve feeling words you pick from are really four threads, each at three depths. <b>Capacity</b> runs calm, steady, overwhelmed. <b>Engagement</b> runs curious, flat, apathetic. <b>Drive</b> runs creative, restless, frenetic. <b>Posture</b> runs confident, braced, small.</p>
          <p>Each ring is a thread — the bigger, outer rings are the ones you reach for most. Only the arc for your leading feeling in that thread is drawn, starting at the top and sweeping clockwise; the rest of the ring stays quiet. A few small points drift along the arc to show which way it's moving: green drifts outward, red drifts inward, and a pale arc just holds still and breathes in place. The word on the ring's label is whichever of its three feelings you've picked most, with its thread and count right below it.</p>
        </FinePrint>
      </div>
    </section>
  )
}
