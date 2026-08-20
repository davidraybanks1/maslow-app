import { useState, useMemo, useCallback, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeaderSlotContext } from '../lib/headerSlot'
import { NEEDS, MODE_ORDER } from '../lib/constants'
import { createDataStats } from '../lib/dataStats'
import { useIsDesktop } from '../lib/useIsDesktop'
import styles from './Data.module.css'

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
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

// Rolling window ending today; comparison = same length immediately prior.
// 7d: today-6 through today inclusive. 30d: same pattern.
function buildWindowKeys(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - offset - (n - 1 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

function buildSubhead(period) {
  const today = new Date()
  if (period === 30) return 'last 30 days · compared with the 30 before'
  const start = new Date(today)
  start.setDate(today.getDate() - (period - 1))
  const fmtDay = d => {
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase()
    return `${weekday} ${d.getDate()}`
  }
  const month = today.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase()
  return `${fmtDay(start)} — ${fmtDay(today)} ${month} · compared with the week before`
}

function buildNeedDeltas(canvas, checkins, period) {
  const cur = buildWindowKeys(period, 0)
  const pri = buildWindowKeys(period, period)
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

function cap(str) { return str[0].toUpperCase() + str.slice(1) }
function pts(n) { return `${n} pt${n === 1 ? '' : 's'}` }

function buildHeadlineSegments(canvas, checkins, period) {
  const days = buildWindowKeys(period, 0)
  const activeNeeds = NEEDS.filter(n => canvas[n.id])
  const possible = period * activeNeeds.length
  if (possible === 0) return { basePct: 0, surplusPct: 0, surplusNeeds: [] }

  let totalToward = 0, totalSurplus = 0
  const surplusPerNeed = []
  for (const need of activeNeeds) {
    const doneDays = days.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length
    const targetDays = (MODE_THRESHOLDS[canvas[need.id]] ?? 50) / 100 * period
    const toward = Math.min(doneDays, targetDays)
    const surplus = Math.max(0, doneDays - targetDays)
    totalToward += toward
    totalSurplus += surplus
    if (surplus > 0) surplusPerNeed.push({ need, surplus })
  }

  surplusPerNeed.sort((a, b) => b.surplus - a.surplus)
  return {
    basePct: totalToward / possible * 100,
    surplusPct: totalSurplus / possible * 100,
    surplusNeeds: surplusPerNeed.slice(0, 2).map(s => s.need.name),
  }
}

function buildHeadlineSentence(diff, canvasTarget, modeStats, surplusNeeds) {
  const p = `${canvasTarget}%`
  if (Math.abs(diff) < 3) return `right on your pace of ${p}.`
  if (diff > 0) {
    const needPhrase = surplusNeeds.length === 0 ? ''
      : surplusNeeds.length === 1 ? ` — mostly extra ${surplusNeeds[0]}`
      : ` — mostly extra ${surplusNeeds[0]} and ${surplusNeeds[1]}`
    return `${pts(diff)} ahead of your own pace of ${p}${needPhrase}.`
  }
  const behind = modeStats.filter(ms => ms.pct < MODE_THRESHOLDS[ms.mode])
  const modeClause = behind.length === 0 ? ''
    : behind.length === 1 ? ` ${cap(behind[0].mode)} is the only mode still behind.`
    : behind.length === modeStats.length ? ' All modes are running below target.'
    : ` ${behind.map(m => cap(m.mode)).join(' and ')} are still behind.`
  return `${pts(Math.abs(diff))} behind your own pace of ${p}.${modeClause}`
}

function HeadlineCard({ period, stats, canvas, checkins }) {
  const { pct, delta } = stats.getCompletion(period)
  const activeNeeds = NEEDS.filter(n => canvas[n.id])
  const canvasTarget = activeNeeds.length > 0
    ? Math.round(activeNeeds.reduce((s, n) => s + (MODE_THRESHOLDS[canvas[n.id]] || 50), 0) / activeNeeds.length)
    : 50
  const modeStats = stats.getModeStats(period).filter(ms => NEEDS.some(n => canvas[n.id] === ms.mode))
  const periodLabel = period === 7 ? 'last week' : 'last 30d'
  const { basePct, surplusPct, surplusNeeds } = buildHeadlineSegments(canvas, checkins, period)
  const diff = pct - canvasTarget
  const showSurplus = diff > 0 && surplusPct > 0.1

  // Assert: bar segments sum to the headline pct (if they diverge, math has drifted)
  console.assert(
    Math.abs(Math.round(basePct + surplusPct) - pct) <= 1,
    `Headline bar math diverged: bar=${(basePct + surplusPct).toFixed(2)} vs headline=${pct}`
  )

  return (
    <div className={styles.headlineCard}>
      <div className={styles.headlineTop}>
        <span className={styles.headlineLabel}>THE HEADLINE</span>
        {delta !== 0 && (
          <span className={`${styles.headlineDelta}${delta < 0 ? ` ${styles.headlineDeltaDown}` : ''}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs {periodLabel}
          </span>
        )}
      </div>
      <div className={styles.headlineNumberRow}>
        <span className={styles.headlineBig}>{pct}</span>
        <span className={styles.headlinePct}>%</span>
        <div className={styles.headlineContext}>
          <span>of your needs have been met for this time period.</span>
        </div>
      </div>
      <div className={styles.headlineBarWrap}>
        <div className={styles.headlineBarTrack}>
          <div
            className={styles.headlineBarBase}
            style={{ width: `${showSurplus ? basePct : Math.min(pct, 100)}%` }}
          />
          {showSurplus && (
            <div
              className={styles.headlineBarSurplus}
              style={{ left: `${basePct}%`, width: `${surplusPct}%` }}
            />
          )}
        </div>
        <div className={styles.headlinePaceTick} style={{ left: `${canvasTarget}%` }} />
      </div>
      <p className={styles.headlineSentence}>{buildHeadlineSentence(diff, canvasTarget, modeStats, surplusNeeds)}</p>
    </div>
  )
}

function WhatChanged({ period, canvas, checkins }) {
  const needDeltas = useMemo(
    () => buildNeedDeltas(canvas, checkins, period),
    [canvas, checkins, period]
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
        <span className={styles.sectionMeta}>biggest movers</span>
      </div>
      {rows.map(ns => (
        <div key={ns.need.id} className={styles.moverRow}>
          <span className={styles.moverDot} style={{ background: TIER_DOT[ns.mode] }} />
          <span className={styles.moverName}>{ns.need.name}</span>
          <div className={styles.moverBarTrack}>
            <div className={styles.moverBarFill} style={{ width: `${Math.min(ns.pct, 100)}%`, background: TIER_BAR[ns.mode] }} />
          </div>
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

// Current week keys, Monday-first
function currentWeekKeys() {
  const today = new Date()
  const mondayOffset = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
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
  for (const m of dayMoods) c[m.mood] = (c[m.mood] || 0) + 1
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
}

const RHYTHM_MOOD_DOT = { good: '#1B3A2D', fine: '#9DB394', bad: '#D93B1C' }

function RhythmSection({ stats, canvas, checkins, moods }) {
  const weekKeys = useMemo(() => currentWeekKeys(), [])
  const todayKey = buildWindowKeys(1, 0)[0]

  const moodByWeekday = useMemo(() => stats.getMoodByWeekday(), [stats])
  const moodByPeriod  = useMemo(() => stats.getMoodByPeriod(30), [stats])
  const closingRead = stats.getWeekdaySummary(moodByWeekday) ?? stats.getTimeOfDaySummary(moodByPeriod)

  return (
    <section className={`${styles.section} ${styles.sectionCard} ${styles.rhythmCard}`}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>YOUR RHYTHM</span>
        <span className={styles.sectionMeta}>bar = practices met · dot = mood</span>
      </div>
      <div className={styles.rhythmGrid}>
        {weekKeys.map((dk, i) => {
          const pct = dayCompPct(canvas, checkins, dk)
          const mood = dominantMoodFor(moods, dk)
          const isToday = dk === todayKey
          const isFuture = dk > todayKey
          const barColor = isToday || pct >= 70 ? '#E8B81F' : 'rgba(232,184,31,.45)'
          const dotColor = mood ? RHYTHM_MOOD_DOT[mood] : 'rgba(0,0,0,.06)'
          return (
            <div key={dk} className={styles.rhythmCol}>
              <div className={styles.rhythmBarArea}>
                {!isFuture && pct > 0 && (
                  <div className={styles.rhythmBar} style={{ height: `${pct}%`, background: barColor }} />
                )}
              </div>
              <div className={styles.rhythmDot} style={{ background: dotColor }} />
              <span className={`${styles.rhythmLetter}${isToday ? ` ${styles.rhythmLetterToday}` : ''}`}>
                {WEEKDAY_LETTERS[i]}
              </span>
            </div>
          )
        })}
      </div>
      {closingRead && <p className={styles.rhythmRead}>{closingRead}</p>}
    </section>
  )
}


function practicesColor(pct) {
  if (pct < 30) return 'rgba(28,58,46,.14)'
  if (pct < 50) return 'rgba(28,58,46,.34)'
  if (pct < 70) return 'rgba(28,58,46,.56)'
  if (pct < 85) return 'rgba(28,58,46,.78)'
  return '#1B3A2D'
}
const MOOD_LENS_COLOR = { good: '#1B3A2D', fine: '#9DB394', bad: '#D93B1C' }
const EMPTY_CELL = 'rgba(0,0,0,.06)'

const MOBILE_WINDOW = 30
const DESKTOP_WINDOW = 90

function LongViewSection({ canvas, checkins, moods, stats, days, windowLen }) {
  const [lens, setLens] = useState('practices')
  const todayKey = buildWindowKeys(1, 0)[0]

  const monthGroups = useMemo(() => {
    const groups = []
    days.forEach(dk => {
      const mon = dk.slice(0, 7)
      if (!groups.length || groups[groups.length - 1].key !== mon) {
        groups.push({ key: mon, span: 1 })
      } else {
        groups[groups.length - 1].span++
      }
    })
    return groups.map(g => ({
      label: new Date(g.key + '-15').toLocaleDateString('en-GB', { month: 'short' }).toLowerCase(),
      span: g.span,
    }))
  }, [days])

  const moodByPeriod = useMemo(() => stats.getMoodByPeriod(30), [stats])
  const closingRead = stats.getTimeOfDaySummary(moodByPeriod)

  const activeDays = days.filter(dk =>
    (checkins[dk] || []).length > 0 || moods.some(m => m.date_key === dk)
  ).length

  const readFallback = `${activeDays} of ${windowLen} days with data.`

  return (
    <section className={`${styles.section} ${styles.sectionCard}`}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>THE LONG VIEW</span>
        <div className={styles.lensPills}>
          {['practices', 'mood'].map(l => (
            <button
              key={l}
              className={`${styles.lensPill}${lens === l ? ` ${styles.lensPillActive}` : ''}`}
              onClick={() => setLens(l)}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Month labels — span proportional to day count per month */}
      <div className={styles.monthRow}>
        {monthGroups.map(g => (
          <span key={g.key} className={styles.monthLabel} style={{ flex: g.span }}>{g.label}</span>
        ))}
      </div>

      {/* One cell per day */}
      <div className={styles.longViewGrid}>
        {days.map(dk => {
          const isFuture = dk > todayKey
          let color = EMPTY_CELL
          if (!isFuture) {
            if (lens === 'practices') {
              color = (checkins[dk] || []).length > 0
                ? practicesColor(dayCompPct(canvas, checkins, dk))
                : EMPTY_CELL
            } else {
              const mood = dominantMoodFor(moods, dk)
              color = mood ? MOOD_LENS_COLOR[mood] : EMPTY_CELL
            }
          }
          return <div key={dk} className={styles.longViewCell} style={{ background: color }} />
        })}
      </div>

      {/* Legend */}
      {lens === 'practices' ? (
        <div className={styles.legend}>
          <span className={styles.legendText}>not logged</span>
          <span className={styles.legendSwatch} style={{ background: EMPTY_CELL }} />
          <span className={styles.legendText}>less met</span>
          {['rgba(28,58,46,.14)', 'rgba(28,58,46,.34)', 'rgba(28,58,46,.56)', 'rgba(28,58,46,.78)', '#1B3A2D'].map((c, i) => (
            <span key={i} className={styles.legendSwatch} style={{ background: c }} />
          ))}
          <span className={styles.legendText}>more met</span>
        </div>
      ) : (
        <div className={styles.legend}>
          <span className={styles.legendText}>mood</span>
          {Object.entries(MOOD_LENS_COLOR).map(([k, c]) => (
            <span key={k} className={styles.legendSwatch} style={{ background: c }} />
          ))}
          <span className={styles.legendText}>good · fine · bad</span>
          <span className={styles.legendSwatch} style={{ background: EMPTY_CELL }} />
          <span className={styles.legendText}>not logged</span>
        </div>
      )}

      <p className={styles.rhythmRead}>{closingRead ?? readFallback}</p>
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

function RibbonsSection({ canvas, checkins, practicesDB, days, windowLen }) {
  const [openNeed, setOpenNeed] = useState(null)
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
        ? new Date(lastLoggedDk + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long' }).toLowerCase()
        : null
      return { need, mode, daysActive, isDormant, sinceMonth }
    }).sort((a, b) => b.daysActive - a.daysActive)
  }, [canvas, checkins, days, recent30, recent90])

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>EACH NEED, DAY BY DAY</span>
        <span className={styles.sectionMeta}>held ▸ faded</span>
      </div>
      <div className={styles.ribbonStack}>
        {needRows.map(({ need, mode, daysActive, isDormant, sinceMonth }) => {
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
                  <span className={styles.ribbonStat}>{daysActive} of {windowLen} days</span>
                )}
                <span className={styles.ribbonChevron}>{isOpen ? '▴' : '▾'}</span>
              </button>

              {/* Need band — one cell per day */}
              <div className={styles.ribbonBand}>
                {days.map(dk => (
                  <div
                    key={dk}
                    className={styles.ribbonCell}
                    style={{
                      background: (checkins[dk] || []).some(e => e.need_id === need.id)
                        ? TIER_BAR[mode]
                        : EMPTY_CELL,
                    }}
                  />
                ))}
              </div>

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
                        const daysSince = lastDk
                          ? Math.round((new Date(todayKey + 'T12:00:00') - new Date(lastDk + 'T12:00:00')) / 86400000)
                          : null
                        const isQuiet = daysSince === null || daysSince > 30
                        return (
                          <div key={p.id ?? p.label} className={styles.practiceRow}>
                            <div className={styles.practiceRowTop}>
                              <span className={styles.practiceName}>{p.label}</span>
                              <span className={`${styles.practiceStat}${isQuiet ? ` ${styles.practiceStatQuiet}` : ''}`}>
                                {isQuiet ? `${daysSince ?? '∞'}d quiet` : `${daysP}/${windowLen}`}
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

const QUIET_GROUPS = [
  { key: 'month+',  label: 'a month or more',    min: 30,  max: Infinity },
  { key: '3to4w',   label: 'three to four weeks', min: 21,  max: 29 },
  { key: '2to3w',   label: 'two to three weeks',  min: 14,  max: 20 },
]

function GoneQuietSection({ canvas, checkins, practicesDB, archivePractice, isDesktop }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(['month+']))
  const [retireConfirm, setRetireConfirm] = useState(null)
  const toggleGroup = key => setOpenGroups(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
  const navigate = useNavigate()

  const recent90 = useMemo(() => buildWindowKeys(90, 0), [])
  const todayKey = buildWindowKeys(1, 0)[0]

  const quietPractices = useMemo(() => {
    const result = []
    for (const need of NEEDS) {
      const mode = canvas[need.id]
      if (!mode) continue
      const practices = practicesDB.filter(p => p.need_id === need.id && !p.archived_at)
      for (const p of practices) {
        const lastDk = recent90.slice().reverse().find(dk =>
          (checkins[dk] || []).some(e =>
            e.need_id === need.id &&
            (p.id && e.practice_id ? e.practice_id === p.id : e.practice_text === p.label)
          )
        ) ?? null
        const daysSince = lastDk
          ? Math.round((new Date(todayKey + 'T12:00:00') - new Date(lastDk + 'T12:00:00')) / 86400000)
          : 99
        if (daysSince >= 14) result.push({ need, mode, practice: p, daysSince })
      }
    }
    return result.sort((a, b) => b.daysSince - a.daysSince)
  }, [canvas, checkins, practicesDB, recent90, todayKey])

  const total = quietPractices.length
  if (total === 0) return null

  // Closing read: dominant mode among quiet practices
  const modeCounts = {}
  for (const { mode } of quietPractices) modeCounts[mode] = (modeCounts[mode] || 0) + 1
  const [topMode, topCount] = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]
  const closingRead = total >= 3 && topCount >= Math.ceil(total / 2)
    ? `${topCount} of these ${total} belong to ${topMode}. That is a mode going dormant, not ${total} separate failures — retire what you have outgrown.`
    : `${total} practice${total !== 1 ? 's' : ''} have gone quiet. Review each to retire or restart.`

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>GONE QUIET</span>
        <span className={styles.sectionMeta}>{total} practice{total !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.quietGroups}>
        {QUIET_GROUPS.map(grp => {
          const rows = quietPractices.filter(p => p.daysSince >= grp.min && p.daysSince <= grp.max)
          if (!isDesktop && rows.length === 0) return null
          const isOpen = openGroups.has(grp.key)
          return (
            <div key={grp.key} className={styles.quietCard}>
              <button
                className={styles.quietCardHeader}
                onClick={() => toggleGroup(grp.key)}
              >
                <span className={styles.quietCardTitle}>{grp.label}</span>
                <span className={styles.quietCardCount}>{rows.length}</span>
                <span className={styles.ribbonChevron}>{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                rows.length === 0 ? (
                  <p className={styles.quietEmpty}>nothing in this range.</p>
                ) : (
                  rows.map(({ need, mode, practice }) => (
                    <div key={practice.id ?? practice.label} className={styles.quietRow}>
                      <span className={styles.moverDot} style={{ background: TIER_DOT[mode] }} />
                      <span className={styles.quietPracticeName}>{practice.label}</span>
                      <div className={styles.quietActions}>
                        <button className={styles.quietBtn} onClick={() => navigate('/today')}>log</button>
                        {archivePractice && practice.id && (
                          retireConfirm === practice.id ? (
                            <button
                              className={`${styles.quietBtn} ${styles.quietBtnConfirm}`}
                              onClick={() => { archivePractice(practice.id); setRetireConfirm(null) }}
                            >confirm retire</button>
                          ) : (
                            <button className={styles.quietBtn} onClick={() => setRetireConfirm(practice.id)}>retire</button>
                          )
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          )
        })}
      </div>
      <p className={styles.sectionRead}>{closingRead}</p>
    </section>
  )
}

function buildInsightCopy(link) {
  const r = link.ratio
  const mult = r < 2 ? `~${r.toFixed(1)}×` : `${r.toFixed(1)}×`
  const n = link.need.name
  let finding
  if (link.direction === 'met') {
    finding = link.daypart === 'morning'
      ? `On days you log ${n}, the next morning feels good ${mult} more often.`
      : `On days you log ${n}, your evening mood feels good ${mult} more often.`
  } else {
    finding = link.daypart === 'morning'
      ? `On days ${n} goes unmet, the next morning feels bad ${mult} more often.`
      : `On days ${n} goes unmet, your evening mood feels bad ${mult} more often.`
  }
  return {
    finding,
    basis: `based on ${link.metCount} days with ${n} logged vs ${link.unmetCount} without.`,
  }
}

function InsightsCard({ stats, checkins, moods }) {
  const [idx, setIdx] = useState(0)
  const links = useMemo(() => stats.getNeedMoodLinks(), [stats])
  const advance = useCallback(() => setIdx(i => (i + 1) % links.length), [links.length])

  if (!links.length) {
    const allValidCount = [...new Set(moods.map(m => m.date_key))]
      .filter(dk => (checkins[dk] || []).length > 0).length
    const needed = Math.max(0, 14 - allValidCount)
    return (
      <div className={styles.insightCard}>
        <div className={styles.insightLabel}>YOUR INSIGHTS</div>
        <p className={styles.insightFinding}>
          {needed > 0
            ? `log ${needed} more day${needed === 1 ? '' : 's'} with mood and practices checked in to unlock insights.`
            : 'keep going — insights appear once a need has 10 or more days on each side.'}
        </p>
      </div>
    )
  }
  const link = links[idx % links.length]
  const { finding, basis } = buildInsightCopy(link)

  return (
    <div className={styles.insightCard}>
      <div className={styles.insightLabel}>YOUR INSIGHTS</div>
      <p className={styles.insightFinding}>{finding}</p>
      <p className={styles.insightBasis}>{basis}</p>
      {links.length > 1 && (
        <button className={styles.insightNext} onClick={advance}>show another</button>
      )}
    </div>
  )
}

function AllNumbersSection({ period, canvas, checkins }) {
  const [open, setOpen] = useState(false)
  const periodDays = useMemo(() => buildWindowKeys(period, 0), [period])

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
  }, [period, canvas, checkins, periodDays])

  if (!modeData.length) return null

  return (
    <section className={styles.section}>
      <button className={styles.allNumsHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel}>ALL THE NUMBERS</span>
        <span className={styles.sectionMeta}>by mode and need</span>
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
          <p className={styles.allNumsFooter}>
            tick marks are the pace your canvas implies. Percentages are practices met out of practices possible in the window.
          </p>
        </>
      )}
    </section>
  )
}

export default function Data({ state, archivePractice }) {
  const [period, setPeriod] = useState(7)
  const isDesktop = useIsDesktop()

  const setHeaderSlot = useContext(HeaderSlotContext)
  useEffect(() => {
    setHeaderSlot(
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
    return () => setHeaderSlot(null)
  }, [period, setHeaderSlot])

  const canvas    = state?.canvas    ?? {}
  const checkins  = state?.checkins  ?? {}
  const moods     = state?.moods     ?? []
  const practices = state?.practices ?? {}
  const practicesDB = state?.practicesDB ?? []

  const stats = useMemo(
    () => createDataStats({ canvas, checkins, moods, practices, practicesDB }),
    [canvas, checkins, moods, practices, practicesDB]
  )

  const windowLen = isDesktop ? DESKTOP_WINDOW : MOBILE_WINDOW
  const dayKeys = useMemo(() => buildWindowKeys(windowLen, 0), [windowLen])
  const hasCanvas = Object.keys(canvas).length > 0

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
          <div className={styles.pageTitleBlock}>
            <h1 className={styles.pageTitle}>data.</h1>
            <p className={styles.pageSubhead}>{buildSubhead(period)}</p>
          </div>
          <div className={styles.deskToggle}>{periodToggleEl}</div>
        </div>

        {!hasCanvas && (
          <p className={styles.emptyState}>set up your canvas to see your data.</p>
        )}

        {hasCanvas && (
          <>
            <div className={styles.dRow2}>
              <HeadlineCard period={period} stats={stats} canvas={canvas} checkins={checkins} />
              <InsightsCard stats={stats} checkins={checkins} moods={moods} />
            </div>
            <div className={styles.dRow3}>
              <WhatChanged period={period} canvas={canvas} checkins={checkins} />
              <RhythmSection stats={stats} canvas={canvas} checkins={checkins} moods={moods} />
            </div>
            <LongViewSection canvas={canvas} checkins={checkins} moods={moods} stats={stats} days={dayKeys} windowLen={windowLen} />
            <RibbonsSection canvas={canvas} checkins={checkins} practicesDB={practicesDB} days={dayKeys} windowLen={windowLen} />
            <GoneQuietSection canvas={canvas} checkins={checkins} practicesDB={practicesDB} archivePractice={archivePractice} isDesktop={isDesktop} />
            <AllNumbersSection period={period} canvas={canvas} checkins={checkins} />
          </>
        )}
      </div>
    </div>
  )
}
