import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, LAYERS } from '../lib/constants'
import { loadDebriefs } from '../lib/store'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import { natureTagStyle, ENVIRONMENT_TAG_STYLE } from '../lib/debriefTypes'
import styles from './Data.module.css'

const MOOD_PERIODS = ['morning', 'midday', 'evening']
const WEEKDAY_LETTERS = ['m', 't', 'w', 't', 'f', 's', 's']

const LC_MODE_COLORS = {
  purpose: '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment: '#E8B81F',
  survival: '#D93B1C',
}

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

function LiveCanvas({ stats, range }) {
  const { overallPace, canvasTarget, needRows, survivalNeeds } = stats.getLiveCanvas(range)

  return (
    <div className={styles.card}>
      <div className={styles.lcEyebrow}>LIVE CANVAS — {range}D PACE</div>

      <div className={styles.lcOverallRow}>
        <div className={styles.lcOverallLabel}>OVERALL</div>
        <div className={styles.lcOverallPace}>{overallPace}</div>
      </div>
      <div className={styles.lcTrackContainer}>
        <div className={styles.lcOverallTrack}>
          <div className={styles.lcOverallFill} style={{ width: `${overallPace}%` }} />
        </div>
        <div className={styles.lcTick} style={{ left: `${canvasTarget}%` }} />
      </div>
      <div className={styles.lcTrackTarget}>canvas target {canvasTarget}%</div>

      {needRows.length > 0 && <div className={styles.lcDivider} />}

      {needRows.map(({ needId, name, modeColor, pace, target }) => (
        <div key={needId} className={styles.lcNeedRow}>
          <div className={styles.lcPip} style={{ background: modeColor }} />
          <div className={styles.lcNeedName}>{name}</div>
          <div className={styles.lcNeedTrackContainer}>
            <div className={styles.lcNeedTrack}>
              <div className={styles.lcNeedFill} style={{ width: `${pace}%`, background: modeColor }} />
            </div>
            <div className={styles.lcNeedTick} style={{ left: `${target}%` }} />
          </div>
          <div className={styles.lcNeedPace}>{pace}%</div>
        </div>
      ))}

      {survivalNeeds.length > 0 && (
        <>
          <div className={styles.lcDivider} />
          <div className={styles.lcSurvivalRow}>
            <span className={styles.lcSurvivalX}>✕</span>
            <span className={styles.lcSurvivalNames}>{survivalNeeds.join(', ')}</span>
            <span className={styles.lcSurvivalNote}>survival — no tracking</span>
          </div>
        </>
      )}

      <div className={styles.lcDivider} />
      <div className={styles.lcLegend}>
        {['purpose', 'appreciation', 'nourishment', 'survival'].map(m => (
          <div key={m} className={styles.lcLegendItem}>
            <div className={styles.lcLegendPip} style={{ background: LC_MODE_COLORS[m] }} />
            <span className={styles.lcLegendLabel}>{m}</span>
          </div>
        ))}
        <div className={styles.lcLegendItem}>
          <div className={styles.lcLegendTick} />
          <span className={styles.lcLegendLabel}>mode target</span>
        </div>
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
              {pct !== null && <div className={styles.modeBarFill} style={{ width: `${pct}%`, background: LAYERS[mode].pip }} />}
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

const NEED_ACCORDION_MODES = ['purpose', 'appreciation', 'nourishment']

function NeedPracticesAccordion({ needStats, practiceStats }) {
  const [openNeeds, setOpenNeeds] = useState({})

  const practicesByNeed = {}
  for (const p of practiceStats) {
    if (!practicesByNeed[p.need.id]) practicesByNeed[p.need.id] = []
    practicesByNeed[p.need.id].push(p)
  }

  const orderedNeeds = NEED_ACCORDION_MODES.flatMap(mode => needStats.filter(n => n.mode === mode))

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
                <div className={styles.needsPip} style={{ background: LAYERS[mode].pip }} />
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
      <button className={styles.staleLink} onClick={() => navigate('/practices')}>review in library →</button>
    </div>
  )
}

function formatEpisodeDate(dateKey) {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
}

function DonutChart({ data }) {
  const canvasRef = useRef(null)
  const total = data.reduce((s, d) => s + d.count, 0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || total === 0) return
    const ctx = canvas.getContext('2d')
    const size = 100
    const cx = size / 2
    const cy = size / 2
    const outerRadius = size / 2
    const innerRadius = 22

    ctx.clearRect(0, 0, size, size)

    let angle = -Math.PI / 2
    for (const d of data) {
      const sliceAngle = (d.count / total) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, outerRadius, angle, angle + sliceAngle)
      ctx.closePath()
      ctx.fillStyle = d.color
      ctx.fill()
      angle += sliceAngle
    }

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    if (data.length > 1) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      angle = -Math.PI / 2
      for (const d of data) {
        const sliceAngle = (d.count / total) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + innerRadius * Math.cos(angle), cy + innerRadius * Math.sin(angle))
        ctx.lineTo(cx + outerRadius * Math.cos(angle), cy + outerRadius * Math.sin(angle))
        ctx.stroke()
        angle += sliceAngle
      }
    }
  }, [data, total])

  return <canvas ref={canvasRef} width={100} height={100} className={styles.donutCanvas} />
}

function DistributionRow({ label, data }) {
  return (
    <div className={styles.distRow}>
      <DonutChart data={data} />
      <div className={styles.distLegend}>
        <div className={styles.distLabel}>{label}</div>
        {data.map(d => (
          <div key={d.name} className={styles.distLegendItem}>
            <div className={styles.distDot} style={{ background: d.color }} />
            <span className={styles.distName}>{d.name}</span>
            <span className={styles.distCount}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DistributionCard({ byNature, byEnvironment, total }) {
  if (total < 3) {
    return (
      <div className={styles.card}>
        <div className={styles.dataEmpty}>patterns appear after a few debriefs</div>
      </div>
    )
  }
  return (
    <div className={styles.card}>
      <DistributionRow label="by nature" data={byNature} />
      <DistributionRow label="by environment" data={byEnvironment} />
    </div>
  )
}

function DebriefPatternCard({ pattern }) {
  if (!pattern) return null
  return (
    <div className={styles.patternCard}>
      <div className={styles.eyebrow}>pattern</div>
      <div className={styles.patternBody}>{pattern}</div>
    </div>
  )
}

function RecentEpisodesCard({ episodes }) {
  if (episodes.length === 0) return null
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>recent episodes</div>
      {episodes.slice(0, 5).map((e, i) => (
        <div key={i} className={`${styles.episodeRow} ${i > 0 ? styles.episodeRowDivider : ''}`}>
          <div className={styles.episodeTop}>
            <span className={styles.episodeDate}>{formatEpisodeDate(e.date)}</span>
            <div className={styles.episodeTags}>
              <span className={styles.tag} style={natureTagStyle(e.nature, [])}>{e.nature}</span>
              <span className={styles.tag} style={ENVIRONMENT_TAG_STYLE}>{e.environment}</span>
            </div>
          </div>
          <div className={styles.episodeExcerpt}>{e.excerpt}</div>
        </div>
      ))}
    </div>
  )
}

function DebriefsTab({ stats, debriefs }) {
  const { byNature, byEnvironment, pattern, recentEpisodes } = stats.getDebriefStats(debriefs)
  return (
    <>
      <DistributionCard byNature={byNature} byEnvironment={byEnvironment} total={debriefs.length} />
      <DebriefPatternCard pattern={pattern} />
      <RecentEpisodesCard episodes={recentEpisodes} />
    </>
  )
}

function PracticesTab({ stats, navigate }) {
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
    </>
  )
}

export default function Data({ state }) {
  const navigate = useNavigate()
  const [view, setView] = useState('overview')
  const [range, setRange] = useState(7)
  const [debriefs, setDebriefs] = useState([])

  const moods = state.moods || []
  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods, practices: state.practices })

  useEffect(() => {
    if (state.userId) loadDebriefs(state.userId).then(setDebriefs)
  }, [state.userId])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>data</div>
        {view !== 'debriefs' && (
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
        <button className={`${styles.viewBtn} ${view === 'debriefs' ? styles.viewBtnActive : ''}`} onClick={() => setView('debriefs')}>Debriefs</button>
      </div>

      {view === 'overview' && (
        <div className={styles.section}>
          <StatCards stats={stats} range={range} />
          <LiveCanvas stats={stats} range={range} />
          <ModeBars stats={stats} range={range} />
          <PatternCard stats={stats} />
        </div>
      )}

      {view === 'practices' && (
        <div className={styles.section}>
          <PracticesTab stats={stats} navigate={navigate} />
        </div>
      )}

      {view === 'mood' && (
        <div className={styles.section}>
          <MoodTab stats={stats} range={range} />
        </div>
      )}

      {view === 'debriefs' && (
        <div className={styles.section}>
          <DebriefsTab stats={stats} debriefs={debriefs} />
        </div>
      )}

    </div>
  )
}
