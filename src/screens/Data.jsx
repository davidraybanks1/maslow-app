import { useState, useMemo, useEffect, useRef, cloneElement } from 'react'
import { allNeeds, MODE_ORDER } from '../lib/constants'
import { createDataStats } from '../lib/dataStats'
import { normalizeBand, BAND_LABEL } from '../lib/frequency'
import { useIsDesktop } from '../lib/useIsDesktop'
import { useChartCapture } from '../lib/useChartCapture'
import { isoWeek } from '../lib/isoWeek'
import { useDockLine } from '../lib/useDockLine'
import RootsSection from '../components/RootsSection'
import ThreadsSection from '../components/ThreadsSection'
import StreaksRail from '../components/StreaksRail'
import StrataRibbon from '../components/StrataRibbon'
import FinePrint from '../components/FinePrint'
import FirstWeekCard from '../components/FirstWeekCard'
import GhostPreview from '../components/GhostPreview'
import { Dateline, LabelRow, ProfileBadge, ProgressRule, SectionTitle, WordTabs } from '../components/loam'
import { sampleAlmanacData } from '../lib/previewSamples'
import { buildLadder } from '../lib/ladder'
import { buildInsights } from '../lib/insights'
import styles from './Data.module.css'

const PERIODS = [
  { label: 'week', days: 7 },
  { label: 'month', days: 30 },
]

const MODE_THRESHOLDS = { exploration: 80, appreciation: 60, nourishment: 50, survival: 20 }

const MODE_FILL = {
  exploration: 'var(--loam-exploration)',
  appreciation: 'var(--loam-appreciation)',
  nourishment: 'var(--loam-nourishment)',
  survival: 'var(--loam-survival)',
}
const MOOD_FILL = { good: 'var(--loam-mood-good)', mid: 'var(--loam-mood-fine)', bad: 'var(--loam-mood-bad)' }

// Ledger cells: the run you are on is solid, days behind it are a lighter tint
// of the same colour. Appreciation steps down to its text shade, because its
// fill at lower alpha disappears into the paper.
const CELL_SOLID = {
  exploration: 'var(--loam-exploration)',
  appreciation: 'var(--loam-appreciation-text)',
  nourishment: 'var(--loam-nourishment)',
  survival: 'var(--loam-survival)',
}
const CELL_TINT = {
  exploration: '#1E3B2E73',
  appreciation: 'var(--loam-appreciation)',
  nourishment: '#F2AE1A73',
  survival: '#E8502E73',
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

const MON_CAPS = MONTHS.map(m => m.slice(0, 3).toUpperCase())

/** OCT 12–18 for a week, OCT 26–NOV 1 across a month, SEPTEMBER for a month. */
function spanLabel(keys, period) {
  const [, m0, d0] = keys[0].split('-').map(Number)
  if (period === 30) return MONTHS[m0 - 1].toUpperCase()
  const [, m1, d1] = keys[keys.length - 1].split('-').map(Number)
  return m0 === m1 ? `${MON_CAPS[m0 - 1]} ${d0}–${d1}` : `${MON_CAPS[m0 - 1]} ${d0}–${MON_CAPS[m1 - 1]} ${d1}`
}

function buildNeedDeltas(canvas, checkins, cur, pri) {
  if (!cur.length || !pri.length) return []
  return allNeeds().filter(n => canvas[n.id]).map(need => {
    const pct = Math.round(
      cur.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length / cur.length * 100
    )
    const priorPct = Math.round(
      pri.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length / pri.length * 100
    )
    return { need, mode: canvas[need.id], pct, priorPct, delta: pct - priorPct }
  })
}

/** Where the need was (○), where it is (●), and the move between. */
function MoverSlope({ pct, delta, mode }) {
  const clamp = v => Math.max(2, Math.min(98, v))
  const was = clamp(pct - delta), now = clamp(pct)
  const color = MODE_FILL[mode] || 'var(--loam-ink)'
  return (
    <div className={styles.moverTrack}>
      <span className={styles.moverLine} />
      <span className={styles.moverRun} style={{ left: `${Math.min(was, now)}%`, width: `${Math.abs(now - was)}%`, background: color }} />
      <span className={styles.moverWas} style={{ left: `${was}%` }} />
      <span className={styles.moverNow} style={{ left: `${now}%`, background: color }} />
    </div>
  )
}

const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`

function compareLabels(range, offset) {
  const unit = range.keys.length > 7 ? 'MONTH' : 'WEEK'
  if (offset === 0) return { cur: `THIS ${unit}`, prev: `LAST ${unit}` }
  if (offset === 1) return { cur: `LAST ${unit}`, prev: `${unit} BEFORE` }
  return { cur: `THAT ${unit}`, prev: `${unit} BEFORE` }
}

function WhatChanged({ range, offset, canvas, checkins, dock }) {
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
    ? `${topEntry[1] === fallers.length ? 'all' : 'two'} of the needs losing ground are in ${topEntry[0]}.`
    : null
  const { cur, prev } = compareLabels(range, offset)

  return (
    <section className={styles.block} data-dock={dock}>
      <SectionTitle lead="what" turn="changed." />
      <div className={styles.afterTitle}><LabelRow left="NEED" right={`${prev} ○ → ● ${cur}`} /></div>
      {rows.map(ns => (
        <div key={ns.need.id} className={styles.moverRow}>
          <span className={styles.moverName}>{ns.need.name}</span>
          <MoverSlope pct={ns.pct} delta={ns.delta} mode={ns.mode} />
          <span className={`${styles.moverDelta} ${ns.delta > 0 ? styles.moverDeltaUp : styles.moverDeltaDown}`}>{signed(ns.delta)}</span>
        </div>
      ))}
      {closingRead && <p className={styles.closingRead}>{closingRead}</p>}
    </section>
  )
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAY_LETTERS = ['m', 't', 'w', 't', 'f', 's', 's']

function formatDkLabel(dk) {
  const [y, m, d] = dk.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function dayCompPct(canvas, checkins, dk) {
  const active = allNeeds().filter(n => canvas[n.id])
  if (!active.length) return 0
  const met = active.filter(n => (checkins[dk] || []).some(e => e.need_id === n.id)).length
  return Math.round(met / active.length * 100)
}

const SLOT_RANK = { morning: 0, midday: 1, evening: 2 }

/** Every check-in's band for each day, in the order of the day. */
function moodsByDay(moods) {
  const out = {}
  for (const m of moods || []) {
    if (!m?.date_key) continue
    ;(out[m.date_key] ||= []).push(m)
  }
  for (const list of Object.values(out)) list.sort((a, b) => (SLOT_RANK[a.prompt_time] ?? 9) - (SLOT_RANK[b.prompt_time] ?? 9))
  return out
}

const SLOT_ORDER = ['morning', 'midday', 'evening']
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** The day's check-ins as one bar under its needs rule: a segment per slot,
    hollow where the slot went unanswered. A late answer keeps its own slot. */
function FeelBar({ list, show }) {
  const bySlot = {}
  for (const m of list) bySlot[m.prompt_time] = normalizeBand(m.mood)
  return (
    <span className={styles.feelBar}>
      {show && SLOT_ORDER.map(s => {
        const b = bySlot[s]
        return b
          ? <i key={s} style={{ background: MOOD_FILL[b] || 'var(--loam-track)' }} />
          : <i key={s} className={styles.feelHollow} />
      })}
    </span>
  )
}

function laneAria(i, future, pct, list) {
  if (future) return `${WEEKDAY_NAMES[i]}, still to come`
  const said = list.filter(m => SLOT_ORDER.includes(m.prompt_time)).map(m => BAND_LABEL[normalizeBand(m.mood)] || m.mood)
  return `${WEEKDAY_NAMES[i]}, ${pct}% of needs met, ${said.length ? `check-ins: ${said.join(', ')}` : 'no check-ins'}`
}

function MoodDots({ list }) {
  return (
    <span className={styles.dots}>
      {list.map((m, i) => {
        const band = normalizeBand(m.mood)
        return <i key={i} style={{ background: MOOD_FILL[band] || 'var(--loam-track)' }} />
      })}
    </span>
  )
}

function dayAria(dk, pct, list) {
  const bands = list.map(m => BAND_LABEL[normalizeBand(m.mood)] || m.mood).join(', ')
  return `${formatDkLabel(dk)}: ${pct}% of needs met${bands ? `; checked in ${bands}` : ''}`
}

function RhythmSection({ canvas, checkins, moods, range, keyDots = true, lanes = false }) {
  const monthly = range.keys.length > 7
  const { keys, todayKey } = range
  const chartRef = useChartCapture('data-rhythm', 'this week')
  const byDay = useMemo(() => moodsByDay(moods), [moods])
  const [y0, m0, d0] = keys[0].split('-').map(Number)
  const blanks = (new Date(y0, m0 - 1, d0).getDay() + 6) % 7

  return (
    <div ref={chartRef}>
      {monthly ? (
        <div className={styles.calendar}>
          {WEEKDAY_LETTERS.map((l, i) => <span key={i} className={styles.calHead}>{l}</span>)}
          {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
          {keys.map(dk => {
            const pct = dayCompPct(canvas, checkins, dk)
            const list = byDay[dk] || []
            const future = dk > todayKey
            const today = dk === todayKey
            return (
              <div key={dk} className={`${styles.calCell}${future ? ` ${styles.future}` : ''}`}>
                <span className={`${styles.calDay}${today ? ` ${styles.today}` : ''}`}>{Number(dk.slice(8))}</span>
                <span className={styles.calPct}>{future ? '–' : pct}</span>
                <ProgressRule bare tour={null} muted={future} pct={future ? 0 : pct} label={future ? `${formatDkLabel(dk)}: still to come` : dayAria(dk, pct, list)} />
                <MoodDots list={list} />
              </div>
            )
          })}
        </div>
      ) : keys.map((dk, i) => {
        const pct = dayCompPct(canvas, checkins, dk)
        const list = byDay[dk] || []
        const future = dk > todayKey
        // phone week: the check-ins under the needs rule, on the same axis
        if (lanes) return (
          <div key={dk} className={`${styles.dayRow} ${styles.laneRow}`} role="img" aria-label={laneAria(i, future, pct, list)}>
            <span className={`${styles.dayName}${future ? ` ${styles.future}` : ''}${dk === todayKey ? ` ${styles.today}` : ''}`}>{WEEKDAYS[i]}</span>
            <span className={styles.lane}>
              <ProgressRule bare tour={null} muted={future} pct={future ? 0 : pct} label={future ? `${formatDkLabel(dk)}: still to come` : dayAria(dk, pct, list)} />
              <FeelBar list={list} show={!future && (pct > 0 || list.length > 0)} />
            </span>
            <span className={styles.dayPct}>{future ? '–' : `${pct}%`}</span>
          </div>
        )
        return (
          <div key={dk} className={styles.dayRow}>
            <span className={`${styles.dayName}${future ? ` ${styles.future}` : ''}${dk === todayKey ? ` ${styles.today}` : ''}`}>{WEEKDAYS[i]}</span>
            <ProgressRule bare tour={null} muted={future} pct={future ? 0 : pct} label={future ? `${formatDkLabel(dk)}: still to come` : dayAria(dk, pct, list)} />
            <span className={styles.dayPct}>{future ? '–' : `${pct}%`}</span>
            <MoodDots list={list} />
          </div>
        )
      })}
      {lanes && !monthly ? (
        <div className={styles.legend}>
          <span className={styles.legendKey}>
            <span><i style={{ background: 'var(--loam-gold)' }} />needs met</span>
            {['good', 'mid', 'bad'].map(b => <span key={b}><i style={{ background: MOOD_FILL[b] }} />{BAND_LABEL[b]}</span>)}
          </span>
        </div>
      ) : (
      <div className={styles.legend}>
        <span>RULE = NEEDS MET</span>
        {/* on the phone the feels legend right below carries the colours */}
        {keyDots && (
          <span className={styles.legendKey}>
            {['good', 'mid', 'bad'].map(b => <span key={b}><i style={{ background: MOOD_FILL[b] }} />{BAND_LABEL[b]}</span>)}
          </span>
        )}
      </div>
      )}
    </div>
  )
}

const EMPTY_CELL = 'var(--loam-track)'

const MOBILE_WINDOW = 30
const DESKTOP_WINDOW = 30

/* ── How the days felt: one column each, folded under this week ──────── */

function FeelsChart({ days, peak, monthly, todayKey, dayLabel }) {
  const chartRef = useChartCapture('data-feels', 'how the days felt')
  return (
    <div ref={chartRef} className={styles.feels}>
      <div className={styles.legendKey}>
        {['good', 'mid', 'bad'].map(b => <span key={b}><i style={{ background: MOOD_FILL[b] }} />{BAND_LABEL[b]}</span>)}
      </div>
      <div className={`${styles.feelGrid}${monthly ? ` ${styles.feelGridMonth}` : ''}`}>
        {days.map((d, i) => (
          <div key={d.dk} className={styles.feelCol}>
            <div className={styles.feelStack}>
              {d.dk <= todayKey && d.n === 0 && <i className={styles.feelEmpty} />}
              {['bad', 'mid', 'good'].map(b => d[b] > 0 && (
                <i key={b} style={{ height: `${(d[b] / peak) * 100}%`, background: MOOD_FILL[b] }} />
              ))}
            </div>
            <span className={`${styles.feelLabel}${d.dk === todayKey ? ` ${styles.feelLabelToday}` : ''}`}>{dayLabel(d.dk, i)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeelsSection({ moods, range, alwaysOpen = false }) {
  const [open, setOpen] = useState(false)
  const monthly = range.keys.length > 7
  const { keys, todayKey } = range

  const { days, total } = useMemo(() => {
    const tally = keys.map(dk => ({ dk, good: 0, mid: 0, bad: 0, n: 0 }))
    const idx = new Map(keys.map((dk, i) => [dk, i]))
    for (const m of moods || []) {
      if (!m?.date_key) continue
      const band = normalizeBand(m.mood)
      const i = idx.get(m.date_key)
      if (i !== undefined) {
        const t = tally[i]
        if (t[band] !== undefined) t[band]++
        t.n++
      }
    }
    return { days: tally, total: tally.reduce((s, t) => s + t.n, 0) }
  }, [moods, keys])

  if (!total) return null

  const peak = Math.max(...days.map(d => d.n), 1)
  const dayLabel = (dk, i) => {
    if (!monthly) return WEEKDAY_LETTERS[i]
    const [y, m, d] = dk.split('-').map(Number)
    return new Date(y, m - 1, d).getDay() === 1 ? String(d) : ''
  }

  // the phone shows the chart outright; the desktop panel keeps the fold
  if (alwaysOpen) return <FeelsChart days={days} peak={peak} monthly={monthly} todayKey={todayKey} dayLabel={dayLabel} />

  return (
    <div>
      <button type="button" className={styles.foldLink} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        how the days felt {open ? '▴' : '▾'}
      </button>
      {open && <FeelsChart days={days} peak={peak} monthly={monthly} todayKey={todayKey} dayLabel={dayLabel} />}
    </div>
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
    return allNeeds().filter(n => canvas[n.id]).map(need => {
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
    <section ref={chartRef} className={styles.block} data-dock="DATA · LAST 30 DAYS">
      <SectionTitle lead="your" turn="ledger." />
      <div className={styles.afterTitle}><LabelRow left="EACH NEED, DAY BY DAY" right={`${windowLen} DAYS`} /></div>
      <div>
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
                type="button"
                className={styles.ribbonHeader}
                aria-expanded={isOpen}
                onClick={() => setOpenNeed(isOpen ? null : need.id)}
              >
                <span className={`${styles.ribbonName}${isDormant ? ` ${styles.ribbonNameDormant}` : ''}`}>
                  {need.name}
                </span>
                {isDormant ? (
                  <span className={styles.ribbonStat}>
                    {sinceMonth ? `NOTHING LOGGED SINCE ${sinceMonth.toUpperCase()}` : 'NOTHING LOGGED'}
                  </span>
                ) : (
                  <span className={styles.ribbonStat}>
                    {daysActive} OF {windowLen}
                    {run && ` · ${run.count}${run.atEdge ? '+' : ''}${run.isStreak ? '-DAY STREAK' : ' DAYS QUIET'}`}
                  </span>
                )}
                <span className={styles.ribbonChevron} aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
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
                          ? CELL_SOLID[mode]
                          : (CELL_TINT[mode] || CELL_TINT.exploration),
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
                                  style={{ background: done ? CELL_SOLID[mode] : EMPTY_CELL }}
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

function InsightsCard({ insights, dock }) {
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
    <section className={styles.block} data-dock={dock}>
      <div className={styles.obsHead}>OBSERVATION</div>
      <div ref={wrapperRef} className={styles.obsDeck} onScroll={handleScroll}>
        {cards.map(insight => (
          <div key={insight ? insight.id : 'empty'} className={styles.obsSlide}>
            {insight ? (
              <>
                {insight.stat && <span className={styles.obsStat}>{insight.stat}</span>}
                <p className={styles.obsText}>{insight.rest ?? insight.text}</p>
                <p className={styles.obsBasis}>{insight.basis}</p>
              </>
            ) : (
              <p className={styles.obsText}>log moods and practices for a few more days — patterns take a little time to emerge.</p>
            )}
          </div>
        ))}
      </div>
      {insights.length > 1 && (
        <div className={styles.pager}>
          <button type="button" className={styles.pagerBtn} onClick={() => advance(-1)} aria-label="previous insight">←</button>
          <span>{activeIdx + 1}/{insights.length}</span>
          <button type="button" className={styles.pagerBtn} onClick={() => advance(1)} aria-label="next insight">→</button>
        </div>
      )}
    </section>
  )
}

function AllNumbersSection({ range, canvas, checkins, days }) {
  const [open, setOpen] = useState(false)
  const periodDays = range.elapsed
  const priorDays = range.prevKeys
  const unit = range.keys.length > 7 ? 'MONTH' : 'WEEK'

  const { modeData, totals } = useMemo(() => {
    const countMet = (need, keys) => keys.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length
    const totals = { met: 0, possible: 0, lastMet: 0, lastPossible: 0, windowMet: 0, windowPossible: 0 }
    const modeData = MODE_ORDER.map(mode => {
      const needsInMode = allNeeds().filter(n => canvas[n.id] === mode)
      if (!needsInMode.length) return null
      let totalMet = 0, totalPossible = 0
      const needRows = needsInMode.map(need => {
        const met = countMet(need, periodDays)
        const total = periodDays.length
        const last = countMet(need, priorDays)
        const inWindow = countMet(need, days)
        totalMet += met
        totalPossible += total
        totals.lastMet += last
        totals.lastPossible += priorDays.length
        totals.windowMet += inWindow
        totals.windowPossible += days.length
        return {
          need, met, total, last, lastTotal: priorDays.length,
          pct: total > 0 ? Math.round(met / total * 100) : 0,
          windowPct: days.length > 0 ? Math.round(inWindow / days.length * 100) : 0,
        }
      })
      totals.met += totalMet
      totals.possible += totalPossible
      const modePct = totalPossible > 0 ? Math.round(totalMet / totalPossible * 100) : 0
      return { mode, modePct, needRows }
    }).filter(Boolean)
    return { modeData, totals }
  }, [canvas, checkins, periodDays, priorDays, days])

  if (!modeData.length) return null

  return (
    <>
      <button type="button" className={styles.foldLink} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        all the numbers {open ? '▴' : '▾'}
      </button>

      {open && (
        <section className={styles.block} data-dock="DATA · ALL THE NUMBERS">
          <SectionTitle lead="all the" turn="numbers." sub="every need, plainly. grouped by chapter, i. to iv." />
          <div className={`${styles.numsGrid} ${styles.numsHead}`}>
            <span>NEED</span><span>{unit}</span><span>LAST</span><span>30D</span>
          </div>
          {modeData.map(({ mode, modePct, needRows }) => (
            <div key={mode} className={styles.numsChapter}>
              {needRows.map(({ need, met, total, pct, last, lastTotal, windowPct }) => (
                <div key={need.id} className={`${styles.numsGrid} ${styles.numsRow}`}>
                  <span className={styles.numsName}><i style={{ background: MODE_FILL[mode] }} />{need.name}</span>
                  <span>{met}/{total} <small>{pct}%</small></span>
                  <span className={styles.numsLast}>{last}/{lastTotal}</span>
                  <span>{windowPct}%</span>
                </div>
              ))}
              <div className={styles.numsSubtotal}>
                <span>{mode}</span>
                <span>{modePct}% · pace {MODE_THRESHOLDS[mode]}</span>
              </div>
            </div>
          ))}
          <div className={styles.numsTotal}>
            <span>TOTAL</span>
            <span>
              {totals.met}/{totals.possible} · {totals.lastMet}/{totals.lastPossible} · {totals.windowPossible > 0 ? Math.round(totals.windowMet / totals.windowPossible * 100) : 0}%
            </span>
          </div>
          <FinePrint>
            <p>Each chapter&apos;s number is how often you met its needs in this window: days you logged something for a need, out of the days you could have. The needs above it are the same thing, one at a time.</p>
            <p>Pace is what your canvas implies for that chapter. Past it, you&apos;re doing more than you set out to; short of it, less. Neither is a grade.</p>
          </FinePrint>
          <p className={styles.closingRead}>that&apos;s the end of the page.</p>
        </section>
      )}
    </>
  )
}

export default function Data({ state, profileMenu, profileMenuRef, compact = false }) {
  const [period, setPeriodRaw] = useState(7)
  const [offset, setOffset] = useState(0)
  const setPeriod = p => { setPeriodRaw(p); setOffset(0) }
  // `compact` is the side panel on a desktop: the phone layout, in a narrow column
  const isDesktop = useIsDesktop() && !compact
  // /data on a desktop is DeskShell, which mounts this as `compact`; anything else is the phone
  const phone = !compact && !isDesktop
  const rootRef = useRef(null)
  const dockLine = useDockLine(rootRef)

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

  const prevLabel = spanLabel(buildRange(period, offset + 1).keys, period)
  const nextLabel = spanLabel(buildRange(period, offset - 1).keys, period)
  const rangeLine = period === 30
    ? `${spanLabel(range.keys, period)} ${range.keys[0].slice(0, 4)}`
    : spanLabel(range.keys, period)
  const masthead = period === 30 ? `DATA · ${rangeLine}` : `DATA · ${rangeLine} · WEEK ${isoWeek(range.keys[0])}`
  const dock = `DATA · ${rangeLine}`
  const unit = period === 30 ? 'month' : 'week'

  const initial = ((state?.profile?.name || state?.email || '?').trim()[0] || '?').toUpperCase()
  const badge = docked => profileMenuRef
    ? <ProfileBadge docked={docked} initial={initial} onClick={() => profileMenuRef.current?.open()} {...(docked ? {} : { 'data-tour': 'profile' })} />
    : null

  return (
    <div ref={rootRef} className={styles.screen}>
      {/* zero-height so appearing never moves the page */}
      <div className={styles.dockAnchor}>
        {dockLine && <div className={styles.dock}><Dateline text={dockLine} flush>{badge(true)}</Dateline></div>}
      </div>

      <Dateline text={masthead} flush>{badge(false)}</Dateline>
      {profileMenuRef && profileMenu && cloneElement(profileMenu, { hideTrigger: true })}
      <div className={styles.greeting}><GreetingTitle /></div>

      {!hasCanvas && <p className={styles.emptyState}>set up your canvas to see your data.</p>}

      {hasCanvas && totalCheckinDays < 7 && (
        <FirstWeekCard title="After about a week, you’ll see your data start to tell a story." />
      )}

      {hasCanvas && phone && (
        <>
          <StreaksRail canvas={canvas} checkins={checkins} moods={moods} practicesDB={practicesDB} glyphs={false} />

          {/* the week or month: title, stepper, then the charts it steps */}
          <section className={styles.period} data-dock={dock}>
            <LabelRow
              left={range.title.toUpperCase()}
              right={<WordTabs label="period" options={PERIODS.map(p => ({ v: p.days, label: p.label }))} value={period} onChange={setPeriod} />}
            />
            <div className={`${styles.folio} ${styles.folioTop}`}>
              <button type="button" className={styles.folioBtn} onClick={() => setOffset(o => o + 1)} disabled={!canGoBack} aria-label={`previous ${unit}`}>← {prevLabel}</button>
              {offset > 0
                ? <button type="button" className={styles.folioNow} onClick={() => setOffset(0)}>now</button>
                : <span className={styles.folioHere}>THIS {unit.toUpperCase()}</span>}
              <button type="button" className={styles.folioBtn} onClick={() => setOffset(o => o - 1)} disabled={offset === 0} aria-label={`next ${unit}`}>{nextLabel} →</button>
            </div>
            <RhythmSection stats={stats} canvas={canvas} checkins={checkins} moods={moods} range={range} keyDots={false} lanes />
            {/* the week carries its check-ins in the lanes; the month keeps the chart */}
            {period === 30 && <FeelsSection moods={moods} range={range} alwaysOpen />}
          </section>
        </>
      )}

      {hasCanvas && !phone && (
        <>
          <LabelRow
            left={range.title.toUpperCase()}
            right={<WordTabs label="period" options={PERIODS.map(p => ({ v: p.days, label: p.label }))} value={period} onChange={setPeriod} />}
          />
          <RhythmSection stats={stats} canvas={canvas} checkins={checkins} moods={moods} range={range} />
          <div className={styles.folio}>
            <button type="button" className={styles.folioBtn} onClick={() => setOffset(o => o + 1)} disabled={!canGoBack} aria-label={`previous ${unit}`}>← {prevLabel}</button>
            {offset > 0
              ? <button type="button" className={styles.folioNow} onClick={() => setOffset(0)}>now</button>
              : <span className={styles.folioHere}>THIS {unit.toUpperCase()}</span>}
            <button type="button" className={styles.folioBtn} onClick={() => setOffset(o => o - 1)} disabled={offset === 0} aria-label={`next ${unit}`}>{nextLabel} →</button>
          </div>
          <FeelsSection moods={moods} range={range} />

          <StreaksRail canvas={canvas} checkins={checkins} moods={moods} practicesDB={practicesDB} />
        </>
      )}

      {hasCanvas && (
        <>
          <WhatChanged range={range} offset={offset} canvas={canvas} checkins={checkins} dock={dock} />
          <InsightsCard insights={insights} dock={dock} />

          {totalCheckinDays < 7 ? (
            <GhostAlmanac />
          ) : (
            <>
              <RootsSection canvas={canvas} checkins={checkins} moods={moods} practicesDB={practicesDB} />
              <ThreadsSection userId={state?.userId} moods={moods} />
              <StrataRibbon moods={moods} />
            </>
          )}

          <RibbonsSection canvas={canvas} checkins={checkins} practicesDB={practicesDB} days={dayKeys} windowLen={windowLen} isDesktop={isDesktop} />
          <AllNumbersSection range={range} canvas={canvas} checkins={checkins} days={dayKeys} />
        </>
      )}
    </div>
  )
}

function GreetingTitle() {
  return <h1 className={styles.title}>what&apos;s<br /><em>working.</em></h1>
}

// What roots, feelings and strata will look like once there's a week of
// data behind them: the real drawings on made-up readings, washed out.
function GhostAlmanac() {
  const sample = useMemo(() => sampleAlmanacData(), [])
  return (
    <>
      <GhostPreview>
        <RootsSection canvas={sample.canvas} checkins={sample.checkins} moods={sample.moods} practicesDB={sample.practicesDB} ghost />
      </GhostPreview>
      <GhostPreview>
        <ThreadsSection moods={sample.moods} ghost />
      </GhostPreview>
      <GhostPreview>
        <StrataRibbon moods={sample.moods} ghost />
      </GhostPreview>
    </>
  )
}
