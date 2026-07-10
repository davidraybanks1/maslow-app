import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODES, MODE_ORDER, MODE_MAX_BUBBLES, MODE_WEIGHTS } from '../lib/constants'
import { loadPracticeCompletionStats } from '../lib/store'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import LiveCanvasCard from '../components/LiveCanvasCard'
import styles from './Data.module.css'

const MOOD_PERIODS = ['morning', 'midday', 'evening']
const WEEKDAY_LETTERS = ['m', 't', 'w', 't', 'f', 's', 's']

// ── Days tab helpers ───────────────────────────────────────────────────────────

const SPOKE_SIZE = 260
const SPOKE_MAX_R = 100
const SPOKE_MOOD_R = 20
const MOOD_COLORS = { good: '#1B3A2D', fine: '#B8C3B1', bad: '#D93B1C' }

function buildWindowKeys(period, dayOffset) {
  return Array.from({ length: period }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - dayOffset - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

function formatDayLabel(dateKey) {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).toLowerCase()
}

function fmtScore(v) {
  if (Math.abs((v % 1) - 0.5) < 0.01) return Math.floor(v) === 0 ? '½' : `${Math.floor(v)}½`
  return `${Math.round(v)}`
}

function getDominantMood(moodsList) {
  if (!moodsList || moodsList.length === 0) return null
  const c = {}
  for (const m of moodsList) c[m.mood] = (c[m.mood] || 0) + 1
  return Object.keys(c).length === 0 ? null : Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function drawSpokeCanvas(canvasEl, canvasConfig, checkins, practices, moods, period, windowKeys) {
  if (!canvasEl) return []
  const dpr = window.devicePixelRatio || 1
  canvasEl.width = SPOKE_SIZE * dpr
  canvasEl.height = SPOKE_SIZE * dpr
  const ctx = canvasEl.getContext('2d')
  ctx.scale(dpr, dpr)
  const cx = SPOKE_SIZE / 2, cy = SPOKE_SIZE / 2

  ctx.clearRect(0, 0, SPOKE_SIZE, SPOKE_SIZE)

  // Concentric rings
  for (let i = 1; i <= period; i++) {
    const r = (i / period) * SPOKE_MAX_R
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = i === period ? 'rgba(26,26,26,0.12)' : 'rgba(26,26,26,0.07)'
    ctx.lineWidth = i === period ? 1 : 0.75
    ctx.stroke()
  }

  // Collect practice spokes
  const items = []
  for (const needId of Object.keys(canvasConfig)) {
    const mode = canvasConfig[needId]
    const need = NEEDS.find(n => n.id === needId)
    if (!need) continue
    const color = MODES[mode]?.pip || '#999'
    for (const text of ((practices || {})[needId] || [])) {
      let streak = 0
      for (const dk of windowKeys) {
        if ((checkins[dk] || []).some(e => e.need_id === needId && e.practice_text === text)) streak++
        else break
      }
      if (streak > 0) items.push({ needId, needName: need.name, text, color, streak })
    }
  }

  const spokePositions = []
  const n = items.length
  items.forEach((item, i) => {
    const angle = (n > 0 ? i / n : 0) * Math.PI * 2 - Math.PI / 2
    const r = (item.streak / period) * SPOKE_MAX_R
    const ex = cx + r * Math.cos(angle)
    const ey = cy + r * Math.sin(angle)

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = item.color
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.stroke()

    // Label at tip
    const lr = Math.max(r + 14, SPOKE_MOOD_R + 18)
    const lx = cx + lr * Math.cos(angle)
    const ly = cy + lr * Math.sin(angle)
    ctx.font = `8px 'DM Mono', monospace`
    ctx.fillStyle = 'rgba(26,26,26,0.5)'
    ctx.textBaseline = 'middle'
    const cosA = Math.cos(angle)
    ctx.textAlign = cosA > 0.1 ? 'left' : cosA < -0.1 ? 'right' : 'center'
    ctx.fillText(item.text.split(' ')[0], lx, ly)

    spokePositions.push({ cx, cy, ex, ey, needName: item.needName, practice: item.text, streakCount: item.streak })
  })

  // Mood center
  const dom = getDominantMood(moods.filter(m => m.date_key === windowKeys[0]))
  ctx.beginPath()
  ctx.arc(cx, cy, SPOKE_MOOD_R, 0, Math.PI * 2)
  ctx.fillStyle = dom ? MOOD_COLORS[dom] : 'rgba(26,26,26,0.1)'
  ctx.fill()
  if (dom) {
    ctx.font = `bold 8px 'DM Mono', monospace`
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(dom, cx, cy)
  }

  return spokePositions
}

function buildWhenLabel(anchorMoods) {
  const byTime = {}
  for (const m of anchorMoods) byTime[m.prompt_time] = m.mood
  const times = ['morning', 'midday', 'evening'].filter(t => byTime[t])
  if (times.length === 0) return ''
  const L = { morning: 'this morning', midday: 'this afternoon', evening: 'this evening' }
  if (times.length === 1) return L[times[0]]
  if (times.length === 2) return `${L[times[0]]} and ${L[times[1]]}`
  return 'throughout the day'
}

function SynopsisCard({ canvasConfig, checkins, moods, period, windowKeys }) {
  const daysWithData = windowKeys.filter(k => (checkins[k] || []).length > 0).length

  if (daysWithData < Math.min(period, 2)) {
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>what created this day</div>
        <div className={styles.synopsisEmpty}>not enough data yet — check back after a few more days.</div>
      </div>
    )
  }

  const anchorKey = windowKeys[0]
  const anchorMoods = moods.filter(m => m.date_key === anchorKey)
  const windowMoods = period > 1 ? moods.filter(m => windowKeys.includes(m.date_key)) : anchorMoods
  const dom = getDominantMood(period === 1 ? anchorMoods : windowMoods)

  const needData = NEEDS.filter(n => canvasConfig[n.id]).map(need => {
    const mode = canvasConfig[need.id]
    const modeMax = MODE_MAX_BUBBLES[mode] || 1
    let completed = 0
    for (const dk of windowKeys) completed += (checkins[dk] || []).filter(e => e.need_id === need.id).length
    return { need, pct: Math.round((completed / (modeMax * period)) * 100), completed }
  })

  const highNeeds = needData.filter(n => n.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 2)
  const lowNeed = needData.find(n => n.completed === 0) || null
  const consistentStretch = period === 7 && daysWithData >= 6

  const sentences = []

  if (dom) {
    if (period === 1) {
      const when = buildWhenLabel(anchorMoods)
      if (when) sentences.push(<>you logged <em>{dom}</em> {when}.</>)
    } else {
      sentences.push(<>you mostly logged <em>{dom}</em> over the last {period} days.</>)
    }
  }

  if (highNeeds.length > 0) {
    if (period === 1) {
      const names = highNeeds.map(n => n.need.name.toLowerCase()).join(' and ')
      sentences.push(<><em>{names}</em> {highNeeds.length === 1 ? 'was' : 'were'} fully met.</>)
    } else {
      highNeeds.forEach(hn => sentences.push(
        <><em>{hn.need.name.toLowerCase()}</em> was at {hn.pct}% over the last {period} days.</>
      ))
    }
  }

  if (lowNeed) {
    sentences.push(
      <><em>{lowNeed.need.name.toLowerCase()}</em> was lighter than usual — nothing logged{period > 1 ? ` in the last ${period} days` : ' today'}.</>
    )
  }

  if (consistentStretch) sentences.push(<>your most consistent stretch in recent weeks.</>)
  if (sentences.length === 0) sentences.push(<>a day in progress — keep going.</>)

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>what created this day</div>
      <div className={styles.synopsisText}>
        {sentences.map((s, i) => <span key={i}>{s}{i < sentences.length - 1 ? ' ' : ''}</span>)}
      </div>
    </div>
  )
}

function ByNeedBarsCard({ canvasConfig, checkins, period, windowKeys }) {
  const activeNeeds = NEEDS.filter(n => canvasConfig[n.id])
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>by need — {period} day completion</div>
      {activeNeeds.map(need => {
        const mode = canvasConfig[need.id]
        const modeMax = MODE_MAX_BUBBLES[mode] || 1
        const color = MODES[mode]?.pip || '#999'
        let completed = 0
        for (const dk of windowKeys) completed += (checkins[dk] || []).filter(e => e.need_id === need.id).length
        const pct = Math.min(100, Math.round((completed / (modeMax * period)) * 100))
        return (
          <div key={need.id} className={styles.dayNeedRow}>
            <div className={styles.dayNeedPip} style={{ background: color }} />
            <div className={styles.dayNeedName}>{need.name}</div>
            <div className={styles.dayNeedBarTrack}>
              <div className={styles.dayNeedBarFill} style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className={styles.dayNeedPct}>{pct}%</div>
          </div>
        )
      })}
    </div>
  )
}

function DaysTab({ canvasConfig, checkins, moods, practices }) {
  const [period, setPeriod] = useState(1)
  const [dayOffset, setDayOffset] = useState(0)
  const [tooltip, setTooltip] = useState(null)
  const tooltipTimerRef = useRef(null)
  const canvasRef = useRef(null)
  const spokeDataRef = useRef([])

  const windowKeys = buildWindowKeys(period, dayOffset)
  const anchorKey = windowKeys[0]

  // Weighted score
  let score = 0, maxScore = 0
  for (const [needId, mode] of Object.entries(canvasConfig)) {
    const mm = MODE_MAX_BUBBLES[mode] || 1, wt = MODE_WEIGHTS[mode] || 1
    maxScore += mm * wt * period
    for (const dk of windowKeys) {
      const c = (checkins[dk] || []).filter(e => e.need_id === needId).length
      score += Math.min(c, mm) * wt + Math.max(0, c - mm) * 0.5
    }
  }

  const anchorMoods = moods.filter(m => m.date_key === anchorKey)
  const dominantMood = getDominantMood(anchorMoods)
  const progressPct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0

  // Draw spoke diagram
  useEffect(() => {
    const wk = buildWindowKeys(period, dayOffset)
    spokeDataRef.current = drawSpokeCanvas(canvasRef.current, canvasConfig, checkins, practices, moods, period, wk)
    setTooltip(null)
  }, [period, dayOffset, canvasConfig, checkins, moods, practices])

  // Cleanup tooltip timer on unmount
  useEffect(() => () => clearTimeout(tooltipTimerRef.current), [])

  function handleCanvasClick(e) {
    const el = canvasRef.current
    if (!el || spokeDataRef.current.length === 0) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    let nearest = null, nearestDist = Infinity
    for (const spoke of spokeDataRef.current) {
      const d = distToSegment(x, y, spoke.cx, spoke.cy, spoke.ex, spoke.ey)
      if (d < nearestDist) { nearestDist = d; nearest = spoke }
    }

    if (nearest && nearestDist <= 20) {
      clearTimeout(tooltipTimerRef.current)
      setTooltip({ practice: nearest.practice, needName: nearest.needName, streak: nearest.streakCount })
      tooltipTimerRef.current = setTimeout(() => setTooltip(null), 2500)
    } else {
      setTooltip(null)
    }
  }

  return (
    <>
      <div className={styles.periodSelector}>
        {[1, 3, 7].map(p => (
          <button
            key={p}
            className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
            onClick={() => { setPeriod(p); setDayOffset(0) }}
          >
            {p} day{p > 1 ? 's' : ''}
          </button>
        ))}
      </div>

      <div className={styles.dayNav}>
        <button className={styles.navArrow} onClick={() => setDayOffset(o => Math.min(o + 1, 30))} aria-label="go back">‹</button>
        <div className={styles.navCenter}>
          <div className={styles.navDate}>{formatDayLabel(anchorKey)}</div>
          <div className={styles.navMoodLabel}>mood: {dominantMood || '—'}</div>
          <div className={styles.navProgressRow}>
            <span className={styles.navProgressScore}>{fmtScore(score)} of {fmtScore(maxScore)}</span>
            <div className={styles.navProgressTrack}>
              <div className={styles.navProgressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <span className={styles.navProgressPct}>{Math.round(progressPct)}%</span>
          </div>
        </div>
        <button className={styles.navArrow} onClick={() => setDayOffset(o => Math.max(o - 1, 0))} disabled={dayOffset === 0} aria-label="go forward">›</button>
      </div>

      <div className={styles.spokeDiagramCard}>
        <div className={styles.spokeTooltipArea}>
          {tooltip && (
            <div className={styles.spokeTooltip}>
              <div style={{ fontWeight: 600 }}>{tooltip.practice}</div>
              <div>{tooltip.needName} · {tooltip.streak} of {period} day{period > 1 ? 's' : ''}</div>
              <div className={styles.spokeTooltipArrow} />
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className={styles.spokeCanvas} onClick={handleCanvasClick} />
        <div className={styles.spokeHint}>tap a spoke to see the practice</div>
      </div>

      <ByNeedBarsCard canvasConfig={canvasConfig} checkins={checkins} period={period} windowKeys={windowKeys} />
      <SynopsisCard canvasConfig={canvasConfig} checkins={checkins} moods={moods} period={period} windowKeys={windowKeys} />
    </>
  )
}

// ── Shared stat/chart components ───────────────────────────────────────────────

function StatCards({ stats, range }) {
  const streak = stats.getStreak()
  const { mode, prior, direction } = stats.getMoodMode(range)
  const [openTip, setOpenTip] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!openTip) return
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpenTip(null)
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [openTip])

  return (
    <div ref={wrapRef} className={styles.statGrid}>
      <div className={styles.statCard}>
        <div className={styles.statCardTop}>
          <div className={styles.statLabel}>STREAK</div>
          <button className={styles.infoBtn} onClick={() => setOpenTip(o => o === 'streak' ? null : 'streak')}>i</button>
        </div>
        {openTip === 'streak' && (
          <div className={styles.tooltip}>
            <div className={styles.tooltipArrow} />
            consecutive days where you completed 50% or more of your non-survival needs. today doesn't break your streak while it's still in progress.
          </div>
        )}
        <div className={styles.statValue}>
          {streak} <span className={styles.statUnit}>days</span>
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statCardTop}>
          <div className={styles.statLabel}>MOOD</div>
          <button className={styles.infoBtn} onClick={() => setOpenTip(o => o === 'mood' ? null : 'mood')}>i</button>
        </div>
        {openTip === 'mood' && (
          <div className={styles.tooltip}>
            <div className={styles.tooltipArrow} />
            the most common mood across all your check-ins in this period. up to 3 check-ins per day — morning, midday, and evening. the arrow shows whether that's higher or lower than the previous period.
          </div>
        )}
        <div className={styles.statValueMood}>{mode || '—'}</div>
        {direction && <div className={styles.statSub}>{direction === 'up' ? '↑' : '↓'} {prior}</div>}
      </div>
    </div>
  )
}

function ModeBars({ stats, range }) {
  const modeStats = stats.getModeStats(range)
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>by mode</div>
      <div className={styles.modeBars}>
        {modeStats.map(({ mode, pct }) => (
          <div key={mode} className={styles.modeBarRow}>
            <div className={styles.modeBarName}>{mode}</div>
            <div className={styles.modeBarTrack}>
              {pct !== null && <div className={styles.modeBarFill} style={{ width: `${pct}%`, background: mode === 'appreciation' ? 'var(--appreciation-strong)' : MODES[mode]?.pip }} />}
            </div>
            <div className={styles.modeBarPct}>{pct === null ? '—' : `${pct}%`}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PatternCard({ stats }) {
  const ratio = stats.getPattern()
  if (ratio === null) return null
  return (
    <div className={styles.patternCard}>
      <div className={styles.eyebrow}>pattern</div>
      <div className={styles.patternBody}>
        on days you complete 80%+ of your practices, you log <em className={styles.patternGood}>good</em> {ratio.toFixed(1)}× more often than on days below 50%.
      </div>
    </div>
  )
}

function renderTimeOfDaySummary(text) {
  if (text === 'your days tend to get better as they go.') {
    return <>your days tend to <em className={styles.summaryEm}>get better as they go</em>.</>
  }
  return <>your days <em className={styles.summaryEm}>start strong and fade</em>.</>
}

function renderWeekdaySummary(text) {
  const match = text.match(/^(.*) (run harder than the rest of your week\.)$/)
  if (!match) return text
  return <><em className={styles.summaryEm}>{match[1]}</em> {match[2]}</>
}

function MoodByTimeCard({ moodByPeriod, summary }) {
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>by time of day</div>
      {MOOD_PERIODS.map(period => {
        const p = moodByPeriod[period]
        return (
          <div key={period} className={styles.moodTimeRow}>
            <div className={styles.moodTimeLabel}>{period}</div>
            <div className={styles.moodStackedBar}>
              <div style={{ flex: p.goodShare, background: '#1B3A2D' }} />
              <div style={{ flex: p.fineShare, background: '#B8C3B1' }} />
              <div style={{ flex: p.badShare, background: '#D93B1C' }} />
            </div>
            <div className={styles.moodTimePct}>{Math.round(p.goodShare * 100)}% good</div>
          </div>
        )
      })}
      {summary && <div className={styles.summaryLine}>{renderTimeOfDaySummary(summary)}</div>}
    </div>
  )
}

function MoodByWeekdayCard({ moodByWeekday, summary }) {
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>by day of week</div>
      <div className={styles.weekdayMoodGrid}>
        {moodByWeekday.map((d, i) => (
          <div key={i} className={styles.weekdayMoodCol}>
            <div className={styles.weekdayMoodBar}>
              <div style={{ flex: d.goodShare, background: '#1B3A2D' }} />
              <div style={{ flex: d.fineShare, background: '#B8C3B1' }} />
              <div style={{ flex: d.badShare, background: '#D93B1C' }} />
            </div>
            <div className={styles.weekdayMoodLabel}>{WEEKDAY_LETTERS[i]}</div>
          </div>
        ))}
      </div>
      {summary && <div className={styles.summaryLine}>{renderWeekdaySummary(summary)}</div>}
    </div>
  )
}

function linkSentence({ need, daypart, direction, ratio }) {
  const name = <em className={styles.linkNeedName}>{need.name.toLowerCase()}</em>
  const ratioLabel = `${ratio.toFixed(1)}×`
  if (direction === 'met' && daypart === 'evening') {
    return <>on days you complete {name}, you log good in the evening {ratioLabel} more often.</>
  }
  if (direction === 'met' && daypart === 'morning') {
    return <>on days you complete {name}, your next morning runs good {ratioLabel} more often.</>
  }
  if (direction === 'unmet' && daypart === 'evening') {
    return <>when {name} goes unmet, your evening runs bad {ratioLabel} more often.</>
  }
  return <>when {name} goes unmet, your next morning runs bad {ratioLabel} more often.</>
}

function NeedMoodLinksCard({ links }) {
  return (
    <div className={styles.patternCard}>
      <div className={styles.eyebrow}>needs → mood</div>
      {links.map((link, i) => (
        <div key={i} className={`${styles.linkRow} ${i > 0 ? styles.linkRowDivider : ''}`}>
          {linkSentence(link)}
        </div>
      ))}
    </div>
  )
}

function MoodTab({ stats, range }) {
  const moodByPeriod = stats.getMoodByPeriod(range)
  const moodByWeekday = stats.getMoodByWeekday()
  const needMoodLinks = stats.getNeedMoodLinks()

  const hasTime = !!moodByPeriod
  const hasWeekday = !!moodByWeekday
  const hasLinks = needMoodLinks.length > 0

  if (!hasTime && !hasWeekday && !hasLinks) {
    return <div className={styles.dataEmpty}>patterns appear after about a week of check-ins</div>
  }

  return (
    <>
      <div className={styles.moodLegend}>
        <div className={styles.moodLegendItem}><div className={styles.moodLegendDot} style={{ background: '#1B3A2D' }} />good</div>
        <div className={styles.moodLegendItem}><div className={styles.moodLegendDot} style={{ background: '#B8C3B1' }} />fine</div>
        <div className={styles.moodLegendItem}><div className={styles.moodLegendDot} style={{ background: '#D93B1C' }} />bad</div>
      </div>
      {hasTime && <MoodByTimeCard moodByPeriod={moodByPeriod} summary={stats.getTimeOfDaySummary(moodByPeriod)} />}
      {hasWeekday && <MoodByWeekdayCard moodByWeekday={moodByWeekday} summary={stats.getWeekdaySummary(moodByWeekday)} />}
      {hasLinks && <NeedMoodLinksCard links={needMoodLinks} />}
      <div className={styles.dataFooter}>more patterns appear as check-ins accumulate</div>
    </>
  )
}

function GoingWellCard({ goingWell }) {
  if (!goingWell) return null
  return (
    <div className={styles.goingWellCard}>
      <div className={styles.eyebrow}>going well</div>
      {goingWell.map((p, i) => (
        <div key={i} className={`${styles.goingWellRow} ${i > 0 ? styles.goingWellRowDivider : ''}`}>
          <em className={styles.goingWellName}>{p.text}</em> — {p.completionPct}%, done {formatLastDone(p.daysSinceLast)}
        </div>
      ))}
    </div>
  )
}

const NEED_ACCORDION_MODES = MODE_ORDER

function NeedPracticesAccordion({ needStats, practiceStats }) {
  const [openNeeds, setOpenNeeds] = useState({})

  const practicesByNeed = {}
  for (const p of practiceStats) {
    if (!practicesByNeed[p.need.id]) practicesByNeed[p.need.id] = []
    practicesByNeed[p.need.id].push(p)
  }

  const orderedNeeds = NEED_ACCORDION_MODES.flatMap(mode =>
    needStats.filter(n => n.mode === mode).slice().sort((a, b) => b.pct - a.pct)
  )

  function toggle(needId) {
    setOpenNeeds(prev => ({ ...prev, [needId]: !prev[needId] }))
  }

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>by need</div>
      <div className={styles.needsTable}>
        {orderedNeeds.map(({ need, mode, pct }) => {
          const pool = (practicesByNeed[need.id] || []).slice().sort((a, b) => a.completionPct - b.completionPct)
          const isOpen = !!openNeeds[need.id]
          return (
            <div key={need.id} className={styles.needGroup}>
              <div className={styles.needRow} onClick={() => toggle(need.id)}>
                <div className={styles.needsPip} style={{ background: MODES[mode]?.pip }} />
                <div className={styles.needRowName}>{need.name}</div>
                <div className={styles.needRowCount}>{pool.length} practice{pool.length === 1 ? '' : 's'}</div>
                <div className={styles.needRowPct}>{pct}%</div>
                <div className={`${styles.needRowChevron} ${isOpen ? styles.needRowChevronOpen : ''}`}>⌄</div>
              </div>
              {isOpen && (
                pool.length === 0 ? (
                  <div className={styles.needBodyEmpty}>no practices yet</div>
                ) : (
                  <div className={styles.needBody}>
                    {pool.map((p, i) => (
                      <div key={i} className={styles.practiceSubRow}>
                        <span className={styles.practiceSubName}>{p.text}</span>
                        <span className={styles.practiceSubPct}>{p.completionPct}%</span>
                        {p.totalCompletions > 0 && (
                          <span className={styles.practiceSubTotal}>×{p.totalCompletions}</span>
                        )}
                        <span className={styles.practiceSubLast}>{formatLastDone(p.daysSinceLast)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeeklyRhythmCard({ completionByWeekday }) {
  if (!completionByWeekday) return null
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>weekly rhythm</div>
      <div className={styles.rhythmGrid}>
        {completionByWeekday.map((d, i) => (
          <div key={i} className={styles.rhythmCol}>
            <div className={styles.rhythmTrack}>
              <div className={styles.rhythmFill} style={{ height: `${d.pct}%` }} />
            </div>
            <div className={styles.rhythmLabel}>{WEEKDAY_LETTERS[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StaleFlagsCard({ practiceStats, navigate }) {
  const stale = practiceStats
    .map(p => ({ ...p, staleDays: p.daysSinceLast === null ? 30 : p.daysSinceLast }))
    .filter(p => p.staleDays >= 14)
    .sort((a, b) => b.staleDays - a.staleDays)

  if (stale.length === 0) return null

  return (
    <div className={styles.staleCard}>
      <div className={styles.eyebrow}>needs attention</div>
      {stale.map((p, i) => (
        <div key={i} className={styles.staleRow}>
          <em className={styles.staleName}>{p.text}</em> — not done in {p.staleDays} days
        </div>
      ))}
      <div className={styles.staleFooter}>are these practices still important to you? if not, you can remove them <span className={styles.staleFooterLink} onClick={() => navigate('/practices')}>in Practices</span>.</div>
    </div>
  )
}

function PracticeFrequencyCard({ canvas, practiceCompletionStats }) {
  if (!practiceCompletionStats) {
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>all-time frequency</div>
        <div className={styles.freqLoading}>—</div>
      </div>
    )
  }

  const needGroups = {}
  for (const s of practiceCompletionStats) {
    if (!canvas[s.need_id]) continue
    if (!needGroups[s.need_id]) needGroups[s.need_id] = { mode: canvas[s.need_id], rows: [] }
    needGroups[s.need_id].rows.push(s)
  }

  for (const [needId, mode] of Object.entries(canvas)) {
    if (!needGroups[needId]) needGroups[needId] = { mode, rows: [] }
  }

  const orderedNeeds = NEEDS.filter(n => needGroups[n.id])

  if (orderedNeeds.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>all-time frequency</div>
        <div className={styles.dataEmpty}>no completions logged yet</div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>all-time frequency</div>
      {orderedNeeds.map((need, ni) => {
        const { mode, rows } = needGroups[need.id]
        const pip = MODES[mode]?.pip
        return (
          <div key={need.id} className={`${styles.freqNeedGroup} ${ni > 0 ? styles.freqNeedGroupDivider : ''}`}>
            <div className={styles.freqNeedHeader}>
              <div className={styles.freqPip} style={{ background: pip }} />
              <span className={styles.freqNeedName}>{need.name}</span>
            </div>
            {rows.length === 0 ? (
              <div className={styles.freqEmpty}>no completions yet</div>
            ) : (
              rows.map((s, i) => (
                <div key={i} className={styles.freqRow}>
                  <span className={styles.freqPracticeName}>{s.practice_text}</span>
                  <span className={styles.freqCounts}>
                    <span className={styles.freqTotal}>{s.total}</span>
                    <span className={styles.freqSep}>/</span>
                    <span className={styles.freqMonth}>{s.month} this mo.</span>
                  </span>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

function PracticesTab({ stats, navigate, canvas, practiceCompletionStats }) {
  const practiceStats = stats.getPracticeStats()
  const completionByWeekday = stats.getCompletionByWeekday()
  const goingWell = stats.getGoingWell()
  const needStats = stats.getNeedStats(30)

  return (
    <>
      <StaleFlagsCard practiceStats={practiceStats} navigate={navigate} />
      <GoingWellCard goingWell={goingWell} />
      <NeedPracticesAccordion needStats={needStats} practiceStats={practiceStats} />
      <WeeklyRhythmCard completionByWeekday={completionByWeekday} />
      <PracticeFrequencyCard canvas={canvas} practiceCompletionStats={practiceCompletionStats} />
    </>
  )
}

export default function Data({ state }) {
  const navigate = useNavigate()
  const [view, setView] = useState('overview')
  const [range, setRange] = useState(7)
  const [practiceCompletionStats, setPracticeCompletionStats] = useState(null)

  const moods = state.moods || []
  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods, practices: state.practices })

  useEffect(() => {
    if (view !== 'practices' || !state.userId) return
    if (practiceCompletionStats !== null) return
    loadPracticeCompletionStats(state.userId).then(setPracticeCompletionStats)
  }, [view, state.userId])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>data</div>
        {view !== 'days' && (
          <div className={styles.rangeToggle}>
            <button className={`${styles.rangeBtn} ${range === 7 ? styles.rangeBtnActive : ''}`} onClick={() => setRange(7)}>7d</button>
            <button className={`${styles.rangeBtn} ${range === 30 ? styles.rangeBtnActive : ''}`} onClick={() => setRange(30)}>30d</button>
          </div>
        )}
      </div>

      <div className={styles.viewToggle}>
        <button className={`${styles.viewBtn} ${view === 'overview' ? styles.viewBtnActive : ''}`} onClick={() => setView('overview')}>Overview</button>
        <button className={`${styles.viewBtn} ${view === 'practices' ? styles.viewBtnActive : ''}`} onClick={() => setView('practices')}>Practices</button>
        <button className={`${styles.viewBtn} ${view === 'mood' ? styles.viewBtnActive : ''}`} onClick={() => setView('mood')}>Mood</button>
        <button className={`${styles.viewBtn} ${view === 'days' ? styles.viewBtnActive : ''}`} onClick={() => setView('days')}>Days</button>
      </div>

      {view === 'overview' && (
        <div className={styles.section}>
          <StatCards stats={stats} range={range} />
          <LiveCanvasCard stats={stats} range={range} />
          <ModeBars stats={stats} range={range} />
          <PatternCard stats={stats} />
        </div>
      )}

      {view === 'practices' && (
        <div className={styles.section}>
          <PracticesTab stats={stats} navigate={navigate} canvas={state.canvas} practiceCompletionStats={practiceCompletionStats} />
        </div>
      )}

      {view === 'mood' && (
        <div className={styles.section}>
          <MoodTab stats={stats} range={range} />
        </div>
      )}

      {view === 'days' && (
        <div className={styles.section}>
          <DaysTab
            canvasConfig={state.canvas}
            checkins={state.checkins}
            moods={state.moods || []}
            practices={state.practices}
          />
        </div>
      )}
    </div>
  )
}
