import { useState, useMemo, useEffect, useRef } from 'react'
import { NEEDS, MODE_ORDER } from '../lib/constants'
import { createDataStats } from '../lib/dataStats'
import { normalizeBand, BAND_LABEL } from '../lib/frequency'
import { useIsDesktop } from '../lib/useIsDesktop'
import { useChartCapture } from '../lib/useChartCapture'
import RootsSection from '../components/RootsSection'
import ThreadsSection from '../components/ThreadsSection'
import StreaksRail from '../components/StreaksRail'
import StrataRibbon from '../components/StrataRibbon'
import FinePrint from '../components/FinePrint'
import { buildLadder } from '../lib/ladder'
import { buildInsights } from '../lib/insights'
import styles from './Data.module.css'

const PERIODS = [
  { label: 'week', days: 7 },
  { label: 'month', days: 30 },
]

const MODE_THRESHOLDS = { exploration: 80, appreciation: 60, nourishment: 50, survival: 20 }

// 7px dots use deep sage for appreciation (< 12px threshold)
const TIER_DOT = {
  exploration: '#1B3A2D',
  appreciation: '#9DB394',
  nourishment: '#E8B81F',
  survival: '#D93B1C',
}
// bars keep brand sage for appreciation
const TIER_BAR = {
  exploration: '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment: '#E8B81F',
  survival: '#D93B1C',
}
// One light source at 34% / 26%, the way every other object in the app is lit.
// Appreciation runs to ink because sage on paper is about 1.8:1.
const TIER_RAMP = {
  exploration: ['#2E8A64', '#0C5038'],
  appreciation: ['#B4C4AC', '#536E4D'],
  nourishment: ['#FFD166', '#F0A800'],
  survival: ['#FF7A55', '#F03C10'],
}
// The run behind you is a wash of the same colour; only the run you are on is
// paint. Contrast is value, not alpha — the same hue at lower opacity left
// sage sitting on sage.
const TIER_WASH = {
  exploration: '#2E8A6459',
  appreciation: '#B0C2A8',
  nourishment: '#FFD166A6',
  survival: '#FF7A5559',
}
const petal = mode => {
  const r = TIER_RAMP[mode] || TIER_RAMP.exploration
  return `radial-gradient(circle at 34% 26%, ${r[0]}, ${r[1]})`
}

// Rolling window ending today; comparison = same length immediately prior.
// 7d: today-6 through today inclusive. 30d: same pattern.
function buildWindowKeys(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - offset - (n - 1 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

// Returns { count, isStreak, atEdge } or null if run < 3.
// Mirrors getStreak(): if today has no check-in data at all, start from yesterday.
function computeRun(days, checkins, testFn) {
  const todayDk = days[days.length - 1]
  const todayHasAnyData = (checkins[todayDk] || []).length > 0
  const startIdx = todayHasAnyData ? days.length - 1 : days.length - 2
  if (startIdx < 0) return null
  const startMet = testFn(days[startIdx])
  let count = 0, atEdge = false
  for (let i = startIdx; i >= 0; i--) {
    if (testFn(days[i]) !== startMet) break
    count++
    if (i === 0) atEdge = true
  }
  if (count < 3) return null
  return { count, isStreak: startMet, atEdge }
}

const dkOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/* The span "This week" looks at: a calendar week (Monday first) or a
   calendar month, stepped back by `offset`. Every card under the title
   reads the same keys, and compares against the span before. */
function buildRange(period, offset) {
  const today = new Date()
  const todayKey = dkOf(today)
  const span = n => {
    if (period === 30) {
      const first = new Date(today.getFullYear(), today.getMonth() - n, 1)
      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
      return Array.from({ length: days }, (_, i) => dkOf(new Date(first.getFullYear(), first.getMonth(), i + 1)))
    }
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - n * 7)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return dkOf(d) })
  }
  const keys = span(offset), prevKeys = span(offset + 1)
  const fmt = dk => { const [, m, d] = dk.split('-').map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3)}` }
  const title = period === 30
    ? (offset === 0 ? 'This month' : offset === 1 ? 'Last month' : MONTHS[+keys[0].split('-')[1] - 1])
    : (offset === 0 ? 'This week' : offset === 1 ? 'Last week' : `${fmt(keys[0])} — ${fmt(keys[6])}`)
  const label = period === 30
    ? `${MONTHS[+keys[0].split('-')[1] - 1]} ${keys[0].slice(0, 4)}`
    : `${fmt(keys[0])} — ${fmt(keys[6])}`
  return { keys, prevKeys, title, label, todayKey, elapsed: keys.filter(dk => dk <= todayKey) }
}

function buildNeedDeltas(canvas, checkins, cur, pri) {
  if (!cur.length || !pri.length) return []
  return NEEDS.filter(n => canvas[n.id]).map(need => {
    const pct = Math.round(
      cur.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length / cur.length * 100
    )
    const priorPct = Math.round(
      pri.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length / pri.length * 100
    )
    return { need, mode: canvas[need.id], pct, priorPct, delta: pct - priorPct }
  })
}

/** Where the need was, where it is, and the move between — the ladder's grammar. */
function MoverSlope({ pct, delta }) {
  const clamp = v => Math.max(2, Math.min(98, v))
  const was = clamp(pct - delta), now = clamp(pct)
  const up = delta >= 0
  const ramp = up ? ['#3FA87A', '#07301F'] : ['#FF8A66', '#A81F06']
  return (
    <div className={styles.moverBarTrack}>
      <span className={styles.moverSlopeLine} />
      <span className={styles.moverSlopeRun} style={{
        left: `${Math.min(was, now)}%`, width: `${Math.abs(now - was)}%`,
        background: `linear-gradient(90deg, ${ramp[0]}, ${ramp[1]})`,
      }} />
      <span className={styles.moverSlopeDot} style={{ left: `${was}%`, background: 'rgba(0,0,0,.18)' }} />
      <span className={styles.moverSlopeDot} style={{
        left: `${now}%`, background: `radial-gradient(circle at 34% 26%, ${ramp[0]}, ${ramp[1]})`,
      }} />
    </div>
  )
}

function WhatChanged({ range, canvas, checkins }) {
  // only the days that have happened count against you
  const needDeltas = useMemo(
    () => buildNeedDeltas(canvas, checkins, range.elapsed, range.prevKeys),
    [canvas, checkins, range]
  )
  const sorted = [...needDeltas].sort((a, b) => b.delta - a.delta)
  const risers = sorted.filter(n => n.delta > 0).slice(0, 3)
  const fallers = [...sorted].reverse().filter(n => n.delta < 0).slice(0, 3)
  const rows = [...risers, ...fallers]
  if (rows.length === 0) return null

  const modeCounts = {}
  for (const ns of fallers) modeCounts[ns.mode] = (modeCounts[ns.mode] || 0) + 1
  const topEntry = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]
  const closingRead = topEntry && topEntry[1] >= 2 && fallers.length >= 2
    ? `${topEntry[1] === fallers.length ? 'All' : topEntry[1]} of the needs losing ground are in ${topEntry[0]} mode.`
    : null

  return (
    <section className={`${styles.section} ${styles.sectionCard}`}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>WHAT CHANGED</span>
        <span className={styles.sectionMeta}>against the {range.keys.length > 7 ? 'month' : 'week'} before</span>
      </div>
      {rows.map(ns => (
        <div key={ns.need.id} className={styles.moverRow}>
          <span className={styles.moverDot} style={{ background: petal(ns.mode) }} />
          <span className={styles.moverName}>{ns.need.name}</span>
          <MoverSlope pct={ns.pct} delta={ns.delta} />
          <span className={styles.moverValue}>{ns.pct}%</span>
          <span className={`${styles.moverDelta} ${ns.delta > 0 ? styles.moverDeltaUp : ns.delta < 0 ? styles.moverDeltaDown : styles.moverDeltaFlat}`}>
            {ns.delta > 0 ? '+' : ''}{ns.delta}
          </span>
        </div>
      ))}
      {closingRead && <p className={styles.sectionRead}>{closingRead}</p>}
    </section>
  )
}

const WEEKDAY_LETTERS = ['m', 't', 'w', 't', 'f', 's', 's']

function formatDkLabel(dk) {
  const [y, m, d] = dk.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function dayCompPct(canvas, checkins, dk) {
  const active = NEEDS.filter(n => canvas[n.id])
  if (!active.length) return 0
  const met = active.filter(n => (checkins[dk] || []).some(e => e.need_id === n.id)).length
  return Math.round(met / active.length * 100)
}

function dominantMoodFor(moods, dk) {
  const dayMoods = moods.filter(m => m.date_key === dk)
  if (!dayMoods.length) return null
  const c = {}
  for (const m of dayMoods) { const band = normalizeBand(m.mood); c[band] = (c[band] || 0) + 1 }
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
}

/* One light source at 34% / 26%, the way the bloom and the streak glyphs
   are lit. A bar that met the day is nourishment's full ramp; a bar that
   fell short is the same ramp washed back. The mood dots and the feels
   stacks use the band ramps. */
const LIT = (a, b) => `radial-gradient(circle at 34% 26%, ${a}, ${b})`
const BAR_FULL = LIT('#FFD166', '#F0A800')
const BAR_WASH = LIT('#FFE6A6', '#F5C542')
const MOOD_RAMP = { good: ['#3FA87A', '#07301F'], mid: ['#B4C4AC', '#3E5238'], bad: ['#FF8A66', '#A81F06'] }
const MOOD_LIT = Object.fromEntries(Object.entries(MOOD_RAMP).map(([k, [a, b]]) => [k, LIT(a, b)]))

function RhythmSection({ canvas, checkins, moods, range }) {
  const monthly = range.keys.length > 7
  const { keys, todayKey } = range
  const chartRef = useChartCapture('data-rhythm', 'your rhythm')
  // in the month view a Monday is labelled with its date; the rest stay blank
  const dayLabel = (dk, i) => {
    if (!monthly) return WEEKDAY_LETTERS[i]
    const [y, m, d] = dk.split('-').map(Number)
    return new Date(y, m - 1, d).getDay() === 1 ? String(d) : ''
  }

  return (
    <section ref={chartRef} className={`${styles.section} ${styles.sectionCard} ${styles.rhythmCard}`}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>YOUR RHYTHM</span>
      </div>
      <div className={`${styles.rhythmGrid}${monthly ? ` ${styles.rhythmGridMonth}` : ''}`}>
        {keys.map((dk, i) => {
          const pct = dayCompPct(canvas, checkins, dk)
          const mood = dominantMoodFor(moods, dk)
          const isToday = dk === todayKey
          const isFuture = dk > todayKey
          const barColor = isToday || pct >= 70 ? BAR_FULL : BAR_WASH
          const dotColor = mood ? MOOD_LIT[mood] : 'rgba(0,0,0,.06)'
          return (
            <div key={dk} className={styles.rhythmCol}>
              <div className={styles.rhythmBarArea}>
                {!isFuture && pct > 0 && (
                  <div className={styles.rhythmBar} style={{ height: `${pct}%`, background: barColor }} />
                )}
              </div>
              <div className={styles.rhythmDot} style={{ background: dotColor }} />
              <span className={`${styles.rhythmLetter}${isToday ? ` ${styles.rhythmLetterToday}` : ''}`}>
                {dayLabel(dk, i)}
              </span>
            </div>
          )
        })}
      </div>
      <p className={styles.rhythmLegend}>{'bar\u00a0=\u00a0practices met · dot\u00a0=\u00a0mood'}</p>
    </section>
  )
}

const MOOD_LENS_COLOR = { good: '#1B3A2D', mid: '#9DB394', bad: '#D93B1C' }
const EMPTY_CELL = 'rgba(0,0,0,.06)'

const MOBILE_WINDOW = 30
// Clamped to store's 30-day checkins fetch; raise both together when that widens.
const DESKTOP_WINDOW = 30

/* ── Your feels: how the days felt, one column each ──────────────────── */

function FeelsSection({ moods, range }) {
  const monthly = range.keys.length > 7
  const { keys, prevKeys, todayKey } = range
  const chartRef = useChartCapture('data-feels', 'your feels')

  const { days, total } = useMemo(() => {
    const tally = keys.map(dk => ({ dk, good: 0, mid: 0, bad: 0, n: 0 }))
    const idx = new Map(keys.map((dk, i) => [dk, i]))
    const prev = new Set(prevKeys)
    let prevGood = 0, prevN = 0
    const wc = {}
    for (const m of moods || []) {
      if (!m?.date_key) continue
      const band = normalizeBand(m.mood)
      const i = idx.get(m.date_key)
      if (i !== undefined) {
        const t = tally[i]
        if (t[band] !== undefined) t[band]++
        t.n++
        if (m.feeling) wc[m.feeling] = (wc[m.feeling] || 0) + 1
      } else if (prev.has(m.date_key)) {
        prevN++
        if (band === 'good') prevGood++
      }
    }
    const total = tally.reduce((s, t) => s + t.n, 0)
    const good = tally.reduce((s, t) => s + t.good, 0)
    const words = Object.entries(wc).sort((a, b) => b[1] - a[1]).slice(0, 2)
    return { days: tally, total, good, prevPct: prevN ? Math.round(prevGood / prevN * 100) : null, prevTotal: prevN, words }
  }, [moods, keys, prevKeys])

  if (!total) return null

  const peak = Math.max(...days.map(d => d.n), 1)
  const dayLabel = (dk, i) => {
    if (!monthly) return WEEKDAY_LETTERS[i]
    const [y, m, d] = dk.split('-').map(Number)
    return new Date(y, m - 1, d).getDay() === 1 ? String(d) : ''
  }

  return (
    <section ref={chartRef} className={`${styles.section} ${styles.sectionCard}`}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>YOUR FEELS</span>
        <span className={styles.sectionMeta}>
          {['good', 'mid', 'bad'].map(b => (
            <span key={b} className={styles.feelKey}><i style={{ background: MOOD_LIT[b] }} />{BAND_LABEL[b]}</span>
          ))}
        </span>
      </div>
      <div className={`${styles.feelGrid}${monthly ? ` ${styles.feelGridMonth}` : ''}`}>
        {days.map((d, i) => {
          const isToday = d.dk === todayKey
          const isFuture = d.dk > todayKey
          return (
            <div key={d.dk} className={styles.feelCol}>
              <div className={styles.feelStack}>
                {!isFuture && d.n === 0 && <i className={styles.feelEmpty} />}
                {['bad', 'mid', 'good'].map(b => d[b] > 0 && (
                  <i key={b} style={{ height: `${(d[b] / peak) * 100}%`, background: MOOD_LIT[b] }} />
                ))}
              </div>
              <span className={`${styles.rhythmLetter}${isToday ? ` ${styles.rhythmLetterToday}` : ''}`}>{dayLabel(d.dk, i)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function practiceClosingLine(allCount, activeCount) {
  if (allCount === 0) return null
  if (activeCount === allCount) return `All ${allCount} practice${allCount === 1 ? '' : 's'} are still running.`
  if (activeCount === 1) return 'One practice is the whole need — worth adding a second so a bad stretch does not empty it.'
  if (activeCount === 0) return 'No practices have run recently — consider retiring or restarting them.'
  const word = activeCount === 2 ? 'two' : activeCount === 3 ? 'three' : `${activeCount}`
  return `${activeCount} of ${allCount} practices still run. The need looks alive because ${word} practices carry it.`
}

function RibbonsSection({ canvas, checkins, practicesDB, days, windowLen, isDesktop }) {
  const [openNeed, setOpenNeed] = useState(null)
  const [tooltipInfo, setTooltipInfo] = useState(null)
  const ribbonTimerRef = useRef(null)
  const chartRef = useChartCapture('data-ledger', 'your ledger')
  const recent30 = useMemo(() => buildWindowKeys(30, 0), [])
  const recent90 = useMemo(() => buildWindowKeys(90, 0), [])
  const todayKey = buildWindowKeys(1, 0)[0]

  const needRows = useMemo(() => {
    return NEEDS.filter(n => canvas[n.id]).map(need => {
      const mode = canvas[need.id]
      const daysActive = days.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length
      const isDormant = !recent30.some(dk => (checkins[dk] || []).some(e => e.need_id === need.id))
      const lastLoggedDk = recent90.slice().reverse().find(dk =>
        (checkins[dk] || []).some(e => e.need_id === need.id)
      ) ?? null
      const sinceMonth = lastLoggedDk
        ? new Date(lastLoggedDk + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long' })
        : null
      const run = isDormant ? null : computeRun(days, checkins, dk => (checkins[dk] || []).some(e => e.need_id === need.id))
      return { need, mode, daysActive, isDormant, sinceMonth, run }
    }).sort((a, b) => b.daysActive - a.daysActive)
  }, [canvas, checkins, days, recent30, recent90])

  function showRibbonTooltip(needId, dk) {
    setTooltipInfo({ needId, dk })
    clearTimeout(ribbonTimerRef.current)
    ribbonTimerRef.current = setTimeout(() => setTooltipInfo(null), 2500)
  }
  useEffect(() => () => clearTimeout(ribbonTimerRef.current), [])

  return (
    <section ref={chartRef} className={`${styles.section} ${styles.sectionCard}`}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>EACH NEED, DAY BY DAY</span>
        <span className={styles.sectionMeta}>lit = running now</span>
      </div>
      <div className={styles.ribbonStack}>
        {needRows.map(({ need, mode, daysActive, isDormant, sinceMonth, run }) => {
          const isOpen = openNeed === need.id
          const practices = practicesDB.filter(p => p.need_id === need.id)
          const activePractices = practices.filter(p =>
            recent30.some(dk =>
              (checkins[dk] || []).some(e =>
                e.need_id === need.id &&
                (p.id && e.practice_id ? e.practice_id === p.id : e.practice_text === p.label)
              )
            )
          )
          const closingLine = practiceClosingLine(practices.length, activePractices.length)

          return (
            <div key={need.id} className={styles.ribbonRow}>
              <button
                className={styles.ribbonHeader}
                onClick={() => setOpenNeed(isOpen ? null : need.id)}
              >
                <span className={styles.moverDot} style={{ background: TIER_DOT[mode] }} />
                <span className={`${styles.ribbonName}${isDormant ? ` ${styles.ribbonNameDormant}` : ''}`}>
                  {need.name}
                </span>
                {isDormant ? (
                  <span className={styles.ribbonStatDormant}>
                    {sinceMonth ? `nothing logged since ${sinceMonth}` : 'nothing logged'}
                  </span>
                ) : (
                  <span className={styles.ribbonStat}>
                    {daysActive} of {windowLen} days
                    {run && ` · ${run.count}${run.atEdge ? '+' : ''} ${run.isStreak ? 'day streak' : 'days quiet'}`}
                  </span>
                )}
                <span className={styles.ribbonChevron}>{isOpen ? '▴' : '▾'}</span>
              </button>

              {/* Need band — one cell per day */}
              <div className={styles.ribbonBand}>
                {days.map((dk, i) => (
                  <div
                    key={dk}
                    className={`${styles.ribbonCell}${isDesktop ? ` ${styles.ribbonCellClickable}` : ''}`}
                    title={formatDkLabel(dk)}
                    onClick={isDesktop ? () => showRibbonTooltip(need.id, dk) : undefined}
                    style={{
                      background: !(checkins[dk] || []).some(e => e.need_id === need.id)
                        ? EMPTY_CELL
                        : run?.isStreak && i >= days.length - run.count
                          ? petal(mode)
                          : (TIER_WASH[mode] || TIER_WASH.exploration),
                    }}
                  />
                ))}
              </div>
              {isDesktop && tooltipInfo?.needId === need.id && (
                <div className={styles.dateHint}>{formatDkLabel(tooltipInfo.dk)}</div>
              )}

              {/* Practice expansion */}
              {isOpen && (
                <div className={styles.ribbonExpand}>
                  {practices.length === 0 ? (
                    <p className={styles.ribbonExpandNote}>no practices recorded.</p>
                  ) : (
                    <>
                      {practices.map(p => {
                        const practiceDays = days.map(dk =>
                          (checkins[dk] || []).some(e =>
                            e.need_id === need.id &&
                            (p.id && e.practice_id ? e.practice_id === p.id : e.practice_text === p.label)
                          )
                        )
                        const daysP = practiceDays.filter(Boolean).length
                        const lastDk = days.slice().reverse().find(dk =>
                          (checkins[dk] || []).some(e =>
                            e.need_id === need.id &&
                            (p.id && e.practice_id ? e.practice_id === p.id : e.practice_text === p.label)
                          )
                        ) ?? null
                        const neverLogged = lastDk === null
                        // daysSince > 30 is unreachable with a 30-day window (lastDk is always within days)
                        const practiceRun = !neverLogged ? computeRun(days, checkins, dk =>
                          (checkins[dk] || []).some(e =>
                            e.need_id === need.id &&
                            (p.id && e.practice_id ? e.practice_id === p.id : e.practice_text === p.label)
                          )
                        ) : null
                        return (
                          <div key={p.id ?? p.label} className={styles.practiceRow}>
                            <div className={styles.practiceRowTop}>
                              <span className={styles.practiceName}>{p.label}</span>
                              <span className={styles.practiceStat}>
                                {neverLogged
                                  ? 'not yet logged'
                                  : practiceRun
                                    ? `${daysP}/${windowLen} · ${practiceRun.count}${practiceRun.atEdge ? '+' : ''}d ${practiceRun.isStreak ? 'streak' : 'quiet'}`
                                    : `${daysP}/${windowLen}`
                                }
                              </span>
                            </div>
                            <div className={styles.practiceBand}>
                              {practiceDays.map((done, i) => (
                                <div
                                  key={i}
                                  className={styles.practiceBandCell}
                                  style={{ background: done ? TIER_BAR[mode] : EMPTY_CELL }}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {closingLine && <p className={styles.ribbonExpandNote}>{closingLine}</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InsightsCard({ insights }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapperRef = useRef(null)

  function handleScroll() {
    const w = wrapperRef.current
    if (!w || w.clientWidth === 0) return
    setActiveIdx(Math.round(w.scrollLeft / w.clientWidth))
  }

  function advance(dir) {
    if (!insights.length) return
    const next = (activeIdx + dir + insights.length) % insights.length
    setActiveIdx(next)
    const w = wrapperRef.current
    if (w) w.scrollTo({ left: next * w.clientWidth, behavior: 'smooth' })
  }

  const cards = insights.length > 0 ? insights : [null]

  return (
    <div className={styles.insightDeck}>
      <div ref={wrapperRef} className={styles.insightDeckWrapper} onScroll={handleScroll}>
        {cards.map((insight, i) => (
          <div key={insight ? insight.id : 'empty'} className={styles.insightCard}>
            <div className={styles.insightLabel}>
              {insight ? 'OBSERVATION' : 'OBSERVATIONS'}
            </div>
            {insight ? (
              <>
                <p className={styles.insightFinding} data-len={insight.text.length > 150 ? 'long' : insight.text.length > 90 ? 'mid' : undefined}>{insight.text}</p>
                <p className={styles.insightBasis}>{insight.basis}</p>
              </>
            ) : (
              <p className={styles.insightFinding}>log moods and practices for a few more days — patterns take a little time to emerge.</p>
            )}
          </div>
        ))}
      </div>
      {insights.length > 1 && (
        <div className={styles.insightDeckFooter}>
          <span className={styles.insightDeckCounter}>{activeIdx + 1}/{insights.length}</span>
          <button className={styles.insightSeeAnother} onClick={() => advance(1)}>see another</button>
          <div className={styles.insightDeckNav}>
            <button className={styles.insightDeckArrow} onClick={() => advance(-1)} aria-label="previous insight">‹</button>
            <button className={styles.insightDeckArrow} onClick={() => advance(1)} aria-label="next insight">›</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AllNumbersSection({ range, canvas, checkins }) {
  const [open, setOpen] = useState(false)
  const periodDays = range.elapsed

  const modeData = useMemo(() => {
    return MODE_ORDER.map(mode => {
      const needsInMode = NEEDS.filter(n => canvas[n.id] === mode)
      if (!needsInMode.length) return null
      let totalMet = 0, totalPossible = 0
      const needRows = needsInMode.map(need => {
        const met = periodDays.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length
        const total = periodDays.length
        totalMet += met
        totalPossible += total
        return { need, met, total, pct: total > 0 ? Math.round(met / total * 100) : 0 }
      })
      const modePct = totalPossible > 0 ? Math.round(totalMet / totalPossible * 100) : 0
      return { mode, modePct, needRows }
    }).filter(Boolean)
  }, [canvas, checkins, periodDays])

  if (!modeData.length) return null

  return (
    <section className={styles.section}>
      <button className={styles.allNumsHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel}>ALL THE NUMBERS</span>
        <span className={styles.sectionMeta}>by mode and need · {range.title.toLowerCase()}</span>
        <span className={styles.ribbonChevron}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <>
          <div className={styles.allNumsCards}>
            {modeData.map(({ mode, modePct, needRows }) => (
              <div key={mode} className={styles.allNumsCard}>
                <div className={styles.allNumsModeHeader}>
                  <span className={styles.moverDot} style={{ background: TIER_DOT[mode] }} />
                  <span className={styles.allNumsModeName}>{mode}</span>
                  <span className={styles.allNumsModeValue}>{modePct}%</span>
                </div>
                <div className={styles.allNumsBarWrap}>
                  <div className={styles.allNumsBarTrack}>
                    <div className={styles.allNumsBarFill} style={{ width: `${modePct}%`, background: TIER_BAR[mode] }} />
                  </div>
                  <div className={styles.allNumsPaceTick} style={{ left: `${MODE_THRESHOLDS[mode]}%` }} />
                </div>
                {needRows.map(({ need, met, total, pct }) => (
                  <div key={need.id} className={styles.allNumsNeedRow}>
                    <span className={styles.allNumsNeedName}>{need.name}</span>
                    <span className={styles.allNumsFraction}>{met} of {total}</span>
                    <span className={styles.allNumsPct}>{pct}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <FinePrint>
            <p>Each bar is how often you met that mode's needs in this window: days you logged something for a need, out of the days you could have. The needs underneath are the same thing, one at a time.</p>
            <p>The little tick on each bar is the pace your canvas implies for that mode. Past the tick, you're doing more than you set out to; short of it, less. Neither is a grade.</p>
          </FinePrint>
        </>
      )}
    </section>
  )
}

/* A titled band of the page. The four drawn sections carry their own; these
   wrap the cards that live in this file. */
function Group({ title, sub, aside, first, children }) {
  return (
    <section className={`${styles.group}${first ? ` ${styles.groupFirst}` : ''}`}>
      <div className={styles.groupHead}>
        <div>
          <h2 className={styles.groupTitle}>{title}</h2>
          {sub && <div className={styles.groupSub}>{sub}</div>}
        </div>
        {aside}
      </div>
      <div className={styles.groupBody}>{children}</div>
    </section>
  )
}

export default function Data({ state, profileMenu }) {
  const [period, setPeriodRaw] = useState(7)
  const [offset, setOffset] = useState(0)
  const setPeriod = p => { setPeriodRaw(p); setOffset(0) }
  const isDesktop = useIsDesktop()

  const canvas      = state?.canvas      ?? {}
  const checkins    = state?.checkins    ?? {}
  const moods       = state?.moods       ?? []
  const practices   = state?.practices   ?? {}
  const practicesDB = state?.practicesDB ?? []
  const onboardedAt = state?.onboardedAt ?? null

  const stats = useMemo(
    () => createDataStats({ canvas, checkins, moods, practices, practicesDB, onboardedAt }),
    [canvas, checkins, moods, practices, practicesDB, onboardedAt]
  )
  const insights = useMemo(() => {
    const ladder = buildLadder({ canvas, checkins, moods, practicesDB, modeOrder: MODE_ORDER })
    return buildInsights({ ladder, moods, checkins, canvas })
  }, [canvas, checkins, moods, practicesDB])

  const windowLen = isDesktop ? DESKTOP_WINDOW : MOBILE_WINDOW
  const dayKeys = useMemo(() => buildWindowKeys(windowLen, 0), [windowLen])
  const hasCanvas = Object.keys(canvas).length > 0
  const totalCheckinDays = useMemo(() => Object.keys(checkins).filter(dk => (checkins[dk] || []).length > 0).length, [checkins])
  const range = useMemo(() => buildRange(period, offset), [period, offset])
  const earliestDk = useMemo(() => {
    const dks = [...Object.keys(checkins).filter(dk => (checkins[dk] || []).length > 0), ...moods.map(m => m.date_key)].sort()
    return dks[0] ?? null
  }, [checkins, moods])
  const canGoBack = !!earliestDk && earliestDk < range.keys[0]
  const rangeNav = (
    <div className={styles.rangeNav}>
      <button type="button" className={styles.rangeBtn} onClick={() => setOffset(o => o + 1)} disabled={!canGoBack} aria-label={`previous ${period === 30 ? 'month' : 'week'}`}>‹</button>
      <span className={styles.rangeLabel}>{range.label}</span>
      <button type="button" className={styles.rangeBtn} onClick={() => setOffset(o => o - 1)} disabled={offset === 0} aria-label={`next ${period === 30 ? 'month' : 'week'}`}>›</button>
      {offset > 0 && <button type="button" className={styles.rangeNow} onClick={() => setOffset(0)}>now</button>}
    </div>
  )

  const periodToggleEl = (
    <div className={styles.periodToggle}>
      {PERIODS.map(p => (
        <button
          key={p.days}
          className={`${styles.periodPill}${period === p.days ? ` ${styles.periodPillActive}` : ''}`}
          onClick={() => setPeriod(p.days)}
        >{p.label}</button>
      ))}
    </div>
  )

  return (
    <div className={styles.screen}>
      <div className={styles.desktopWrap}>
        <div className={styles.pageHeaderRow}>
          <h1 className={styles.pageTitle}>almanac.</h1>
          <div className={styles.pageHeaderAccount}>{profileMenu}</div>
        </div>

        {!hasCanvas && (
          <p className={styles.emptyState}>set up your canvas to see your data.</p>
        )}

        {hasCanvas && totalCheckinDays < 7 && (
          <p className={styles.historyNote}>as you complete your practices and mood check-ins, your data starts filling in. it takes about a week before the patterns get interesting.</p>
        )}

        {hasCanvas && (
          <>
            <StreaksRail canvas={canvas} checkins={checkins} moods={moods} practicesDB={practicesDB} first />

            <Group title={range.title} sub={rangeNav} aside={periodToggleEl}>
              <div className={styles.dRow3}>
                <RhythmSection stats={stats} canvas={canvas} checkins={checkins} moods={moods} range={range} />
                <FeelsSection moods={moods} range={range} />
                <WhatChanged range={range} canvas={canvas} checkins={checkins} />
              </div>
            </Group>

            <Group title="Observations">
              <InsightsCard insights={insights} />
            </Group>

            <StrataRibbon moods={moods} />
            <RootsSection canvas={canvas} checkins={checkins} moods={moods} practicesDB={practicesDB} />
            <ThreadsSection userId={state?.userId} moods={moods} />

            <Group title="Your ledger">
              <RibbonsSection canvas={canvas} checkins={checkins} practicesDB={practicesDB} days={dayKeys} windowLen={windowLen} isDesktop={isDesktop} />
              <AllNumbersSection range={range} canvas={canvas} checkins={checkins} />
            </Group>
          </>
        )}
      </div>
    </div>
  )
}
