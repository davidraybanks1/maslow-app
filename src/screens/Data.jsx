import { useState, useMemo, useCallback } from 'react'
import { NEEDS, MODE_ORDER } from '../lib/constants'
import { createDataStats } from '../lib/dataStats'
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

function headlineSentence(pct, canvasTarget, modeStats) {
  const diff = pct - canvasTarget
  const pacePhrase = Math.abs(diff) < 3
    ? 'Right on your pace.'
    : `${Math.abs(diff)} pts ${diff > 0 ? 'ahead of' : 'behind'} your own pace.`
  const behind = modeStats.filter(ms => ms.pct < MODE_THRESHOLDS[ms.mode])
  if (behind.length === 0) return pacePhrase
  const modeClause = behind.length === 1
    ? `${cap(behind[0].mode)} is the only mode still behind.`
    : behind.length === modeStats.length
    ? 'All modes are running below target.'
    : `${behind.map(m => cap(m.mode)).join(' and ')} are still behind.`
  return `${pacePhrase} ${modeClause}`
}

function HeadlineCard({ period, stats, canvas }) {
  const { pct, delta } = stats.getCompletion(period)
  const activeNeeds = NEEDS.filter(n => canvas[n.id])
  const canvasTarget = activeNeeds.length > 0
    ? Math.round(activeNeeds.reduce((s, n) => s + (MODE_THRESHOLDS[canvas[n.id]] || 50), 0) / activeNeeds.length)
    : 50
  const modeStats = stats.getModeStats(period).filter(ms => NEEDS.some(n => canvas[n.id] === ms.mode))
  const periodLabel = period === 7 ? 'last week' : 'last 30d'

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
          <span>of your canvas met</span>
          <span>you set a pace of {canvasTarget}%</span>
        </div>
      </div>
      <div className={styles.headlineBarWrap}>
        <div className={styles.headlineBarTrack}>
          <div className={styles.headlineBarFill} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className={styles.headlinePaceTick} style={{ left: `${canvasTarget}%` }} />
      </div>
      <p className={styles.headlineSentence}>{headlineSentence(pct, canvasTarget, modeStats)}</p>
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
    <section className={styles.section}>
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
    <section className={styles.section}>
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

// 34 weeks ending this week, oldest first. Each entry = 7 date-key strings Mon–Sun.
function buildLongViewWeeks() {
  const today = new Date()
  const mondayOffset = (today.getDay() + 6) % 7
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - mondayOffset)
  return Array.from({ length: 34 }, (_, wi) => {
    const weekMonday = new Date(thisMonday)
    weekMonday.setDate(thisMonday.getDate() - (33 - wi) * 7)
    return Array.from({ length: 7 }, (_, di) => {
      const d = new Date(weekMonday)
      d.setDate(weekMonday.getDate() + di)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  })
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

function LongViewSection({ canvas, checkins, moods, stats, weeks }) {
  const [lens, setLens] = useState('practices')
  const todayKey = buildWindowKeys(1, 0)[0]

  // Month labels: group weeks by the month of their Monday
  const monthGroups = useMemo(() => {
    const groups = []
    weeks.forEach(wk => {
      const mon = wk[0].slice(0, 7)
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
  }, [weeks])

  const moodByPeriod = useMemo(() => stats.getMoodByPeriod(30), [stats])
  const closingRead = stats.getTimeOfDaySummary(moodByPeriod)

  const activeWeeks = weeks.filter(wk =>
    wk.some(dk => (checkins[dk] || []).length > 0 || moods.some(m => m.date_key === dk))
  ).length

  const readFallback = `${activeWeeks} of 34 weeks with data.`

  return (
    <section className={styles.section}>
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

      {/* Month labels */}
      <div className={styles.monthRow}>
        {monthGroups.map(g => (
          <span key={g.key} className={styles.monthLabel} style={{ flex: g.span }}>{g.label}</span>
        ))}
      </div>

      {/* Grid */}
      <div className={styles.longViewGrid}>
        {weeks.map((wk, wi) => {
          const isCurrentWeek = wk.includes(todayKey)
          return (
            <div key={wi} className={`${styles.weekCol}${isCurrentWeek ? ` ${styles.weekColSelected}` : ''}`}>
              {wk.map(dk => {
                const isFuture = dk > todayKey
                let color = EMPTY_CELL
                if (!isFuture) {
                  if (lens === 'practices') {
                    const hasPractice = (checkins[dk] || []).length > 0
                    color = hasPractice ? practicesColor(dayCompPct(canvas, checkins, dk)) : EMPTY_CELL
                  } else {
                    const hasMood = moods.some(m => m.date_key === dk)
                    const mood = hasMood ? dominantMoodFor(moods, dk) : null
                    color = mood ? MOOD_LENS_COLOR[mood] : EMPTY_CELL
                  }
                }
                return <div key={dk} className={styles.longViewCell} style={{ background: color }} />
              })}
            </div>
          )
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

function weekNeedDays(checkins, needId, week) {
  return week.filter(dk => (checkins[dk] || []).some(e => e.need_id === needId)).length
}

function ribbonNeedColor(days, mode) {
  if (days === 0) return 'rgba(0,0,0,.05)'
  if (days < 4) return 'rgba(0,0,0,.12)'
  return TIER_BAR[mode]
}

function weekPracticeDone(checkins, needId, practiceId, practiceLabel, week) {
  return week.some(dk =>
    (checkins[dk] || []).some(e =>
      e.need_id === needId &&
      (practiceId && e.practice_id ? e.practice_id === practiceId : e.practice_text === practiceLabel)
    )
  )
}

function practiceClosingLine(allCount, activeCount) {
  if (allCount === 0) return null
  if (activeCount === allCount) return `All ${allCount} practice${allCount === 1 ? '' : 's'} are still running.`
  if (activeCount === 1) return 'One practice is the whole need — worth adding a second so a bad week does not empty it.'
  if (activeCount === 0) return 'No practices have run recently — consider retiring or restarting them.'
  const word = activeCount === 2 ? 'two' : activeCount === 3 ? 'three' : `${activeCount}`
  return `${activeCount} of ${allCount} practices still run. The need looks alive because ${word} practices carry it.`
}

function RibbonsSection({ canvas, checkins, practicesDB, weeks }) {
  const [openNeed, setOpenNeed] = useState(null)
  const recent30 = useMemo(() => buildWindowKeys(30, 0), [])
  const todayKey = buildWindowKeys(1, 0)[0]

  const needRows = useMemo(() => {
    return NEEDS.filter(n => canvas[n.id]).map(need => {
      const mode = canvas[need.id]
      const weekActivity = weeks.map(wk => weekNeedDays(checkins, need.id, wk))
      const weeksActive = weekActivity.filter(d => d > 0).length
      const isDormant = !recent30.some(dk => (checkins[dk] || []).some(e => e.need_id === need.id))
      const lastLoggedDk = weeks.flat().reverse().find(dk =>
        (checkins[dk] || []).some(e => e.need_id === need.id)
      ) ?? null
      const sinceMonth = lastLoggedDk
        ? new Date(lastLoggedDk + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long' }).toLowerCase()
        : null
      return { need, mode, weekActivity, weeksActive, isDormant, sinceMonth }
    }).sort((a, b) => b.weeksActive - a.weeksActive)
  }, [canvas, checkins, weeks, recent30])

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>EACH NEED, WEEK BY WEEK</span>
        <span className={styles.sectionMeta}>held ▸ faded</span>
      </div>
      <div className={styles.ribbonStack}>
        {needRows.map(({ need, mode, weekActivity, weeksActive, isDormant, sinceMonth }) => {
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
                  <span className={styles.ribbonStat}>{weeksActive} of 34 weeks</span>
                )}
                <span className={styles.ribbonChevron}>{isOpen ? '▴' : '▾'}</span>
              </button>

              {/* Need band — 34 weekly cells */}
              <div className={styles.ribbonBand}>
                {weekActivity.map((days, wi) => (
                  <div
                    key={wi}
                    className={styles.ribbonCell}
                    style={{ background: ribbonNeedColor(days, mode) }}
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
                        const practiceWeeks = weeks.map(wk =>
                          weekPracticeDone(checkins, need.id, p.id, p.label, wk)
                        )
                        const weeksP = practiceWeeks.filter(Boolean).length
                        const lastDk = weeks.flat().reverse().find(dk =>
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
                                {isQuiet ? `${daysSince ?? '∞'}d quiet` : `${weeksP}/34`}
                              </span>
                            </div>
                            <div className={styles.practiceBand}>
                              {practiceWeeks.map((done, wi) => (
                                <div
                                  key={wi}
                                  className={styles.practiceBandCell}
                                  style={{ background: done ? TIER_BAR[mode] : 'rgba(0,0,0,.05)' }}
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

function buildInsightCopy(link, checkins, moods) {
  const days30 = buildWindowKeys(30, 0)
  const validDays = days30.filter(dk =>
    moods.some(m => m.date_key === dk) && (checkins[dk] || []).length > 0
  )
  const metDays = validDays.filter(dk =>
    (checkins[dk] || []).some(e => e.need_id === link.need.id)
  )
  const unmetDays = validDays.filter(dk =>
    !(checkins[dk] || []).some(e => e.need_id === link.need.id)
  )
  const r = link.ratio
  const mult = r < 2 ? `~${r.toFixed(1)}×` : `${r.toFixed(1)}×`
  const n = link.need.name
  let finding
  if (link.direction === 'met') {
    finding = link.daypart === 'morning'
      ? `On days you log ${n}, the next morning runs good ${mult} more often.`
      : `On days you log ${n}, your evening mood runs good ${mult} more often.`
  } else {
    finding = link.daypart === 'morning'
      ? `On days ${n} goes unmet, the next morning runs bad ${mult} more often.`
      : `On days ${n} goes unmet, your evening mood runs bad ${mult} more often.`
  }
  return {
    finding,
    basis: `based on ${metDays.length} days with ${n} logged vs ${unmetDays.length} without.`,
  }
}

function InsightsCard({ stats, checkins, moods }) {
  const [idx, setIdx] = useState(0)
  const links = useMemo(() => stats.getNeedMoodLinks(), [stats])
  const advance = useCallback(() => setIdx(i => (i + 1) % links.length), [links.length])

  if (!links.length) return null
  const link = links[idx % links.length]
  const { finding, basis } = buildInsightCopy(link, checkins, moods)

  return (
    <div className={styles.insightCard}>
      <div className={styles.insightLabel}>YOUR INSIGHTS</div>
      <p className={styles.insightFinding}>{finding}</p>
      <p className={styles.insightBasis}>{basis}</p>
      {links.length > 1 && (
        <button className={styles.insightNext} onClick={advance}>next insight</button>
      )}
    </div>
  )
}

export default function Data({ state }) {
  const [period, setPeriod] = useState(7)

  const canvas    = state?.canvas    ?? {}
  const checkins  = state?.checkins  ?? {}
  const moods     = state?.moods     ?? []
  const practices = state?.practices ?? {}
  const practicesDB = state?.practicesDB ?? []

  const stats = useMemo(
    () => createDataStats({ canvas, checkins, moods, practices, practicesDB }),
    [canvas, checkins, moods, practices, practicesDB]
  )

  const longViewWeeks = useMemo(() => buildLongViewWeeks(), [])
  const hasCanvas = Object.keys(canvas).length > 0

  return (
    <div className={styles.screen}>
      <div className={styles.appBar}>
        <span className={styles.wordmark}>m</span>
        <div className={styles.periodToggle}>
          {PERIODS.map(p => (
            <button
              key={p.days}
              className={`${styles.periodPill}${period === p.days ? ` ${styles.periodPillActive}` : ''}`}
              onClick={() => setPeriod(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scrollArea}>
        <h1 className={styles.pageTitle}>data</h1>
        <p className={styles.pageSubhead}>{buildSubhead(period)}</p>

        {hasCanvas && (
          <>
            <HeadlineCard period={period} stats={stats} canvas={canvas} />
            <InsightsCard stats={stats} checkins={checkins} moods={moods} />
            <WhatChanged period={period} canvas={canvas} checkins={checkins} />
            <RhythmSection stats={stats} canvas={canvas} checkins={checkins} moods={moods} />
            <LongViewSection canvas={canvas} checkins={checkins} moods={moods} stats={stats} weeks={longViewWeeks} />
            <RibbonsSection canvas={canvas} checkins={checkins} practicesDB={practicesDB} weeks={longViewWeeks} />
          </>
        )}

        {/* sections 3–9 added in later stages */}
      </div>
    </div>
  )
}
