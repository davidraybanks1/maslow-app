import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, LAYERS } from '../lib/constants'
import { loadJournalEntry } from '../lib/store'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import styles from './Data.module.css'

const MOOD_COLOR = { good: '#1B3A2D', fine: '#E8B81F', bad: '#D93B1C' }
const MOOD_PERIODS = ['morning', 'midday', 'evening']
const WEEKDAY_LETTERS = ['m', 't', 'w', 't', 'f', 's', 's']

function LogCalendar({ checkins, canvas, moods, journalCache, onSelectDay, currentMonth, setCurrentMonth }) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = (firstDay.getDay() + 6) % 7 // Monday-first

  const totalBubbles = NEEDS.reduce((s, n) => {
    const mode = canvas[n.id]
    return s + (LAYERS[mode]?.bubbles || 0)
  }, 0)

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function dateKeyFor(d) {
    const dt = new Date(year, month, d)
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
  }

  return (
    <div className={styles.calendarWrap}>
      <div className={styles.calendarHeader}>
        <button className={styles.calNavBtn} onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>←</button>
        <div className={styles.calMonthLabel}>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <button className={styles.calNavBtn} onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>→</button>
      </div>
      <div className={styles.calWeekdays}>
        {['M','T','W','T','F','S','S'].map((d,i) => <div key={i} className={styles.calWeekday}>{d}</div>)}
      </div>
      <div className={styles.calGrid}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className={styles.calCellEmpty} />
          const key = dateKeyFor(d)
          const dayCheckins = checkins[key] || []
          const pct = totalBubbles > 0 ? dayCheckins.length / totalBubbles : 0
          const hasData = dayCheckins.length > 0 || (moods || []).some(m => m.date_key === key)
          return (
            <div
              key={i}
              className={styles.calCell}
              style={{ background: hasData ? '#E8B81F' : 'var(--border)', opacity: hasData ? Math.max(0.2, pct) : 0.3 }}
              onClick={() => onSelectDay(key)}
            >
              <span className={styles.calCellNum}>{d}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayDetailModal({ dateKey, checkins, moods, canvas, journalEntry, onClose }) {
  const dayCheckins = checkins[dateKey] || []
  const dayMoods = (moods || []).filter(m => m.date_key === dateKey)
  const totalBubbles = NEEDS.reduce((s, n) => {
    const mode = canvas[n.id]
    return s + (LAYERS[mode]?.bubbles || 0)
  }, 0)
  const pct = totalBubbles > 0 ? Math.round(dayCheckins.length / totalBubbles * 100) : 0
  const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>×</button>
        <div className={styles.modalDate}>{dateLabel}</div>
        <div className={styles.modalScore}>{pct}% · {dayCheckins.length} of {totalBubbles}</div>

        <div className={styles.modalSectionLabel}>mood</div>
        {dayMoods.length === 0 ? (
          <div className={styles.modalEmpty}>No mood data for this day.</div>
        ) : (
          <div className={styles.modalMoodList}>
            {dayMoods.map((m, i) => (
              <div key={i} className={styles.modalMoodRow}>
                <span className={styles.modalMoodTime}>{m.prompt_time}</span>
                <span className={styles.modalMoodBadge} style={{ background: MOOD_COLOR[m.mood] }}>{m.mood}</span>
              </div>
            ))}
            {dayMoods.filter(m => m.note).map((m, i) => (
              <div key={'note'+i} className={styles.modalMoodNote}>{m.note}</div>
            ))}
          </div>
        )}

        <div className={styles.modalSectionLabel}>practices</div>
        {dayCheckins.length === 0 ? (
          <div className={styles.modalEmpty}>No practices logged for this day.</div>
        ) : (
          <div className={styles.modalPracticeList}>
            {dayCheckins.map((c, i) => {
              const [needId, ...rest] = c.split('_')
              const need = NEEDS.find(n => n.id === needId)
              return (
                <div key={i} className={styles.modalPracticeRow}>
                  <span className={styles.modalPracticeNeed}>{need?.name}</span>
                  <span className={styles.modalPracticeText}>{rest.join('_')}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className={styles.modalSectionLabel}>thoughts</div>
        {journalEntry ? (
          <div className={styles.modalJournal}>{journalEntry}</div>
        ) : (
          <div className={styles.modalEmpty}>No journal entry for this day.</div>
        )}
      </div>
    </div>
  )
}

function StatCards({ stats, range }) {
  const { pct, delta, done, total } = stats.getCompletion(range)
  const streak = stats.getStreak()
  const { mode, prior, direction } = stats.getMoodMode(range)

  return (
    <div className={styles.statGrid}>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>streak</div>
        <div className={styles.statValue}>{streak} <span className={styles.statUnit}>days</span></div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>completion</div>
        <div className={styles.statValue}>{pct}% <span className={styles.statDelta}>{delta >= 0 ? '+' : ''}{delta}</span></div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>mood</div>
        <div className={styles.statValue}>{mode || '—'}</div>
        {direction && (
          <div className={styles.statSub}>{direction === 'up' ? '↑' : '↓'} {prior}</div>
        )}
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>practices done</div>
        <div className={styles.statValue}>{done} <span className={styles.statUnit}>of {total}</span></div>
      </div>
    </div>
  )
}

function Sparkline({ data, color }) {
  const W = 60, H = 20
  const n = data.length
  const stepX = n > 1 ? W / (n - 1) : W
  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${(H - (v / 100) * H).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.sparkline} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NeedsTable({ stats, canvas, range }) {
  const needStats = [...stats.getNeedStats(range)].sort((a, b) => b.pct - a.pct)
  const survivalNeeds = NEEDS.filter(n => canvas[n.id] === 'survival')

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>by need</div>
      <div className={styles.needsTable}>
        <div className={`${styles.needsRow} ${styles.needsHeaderRow}`}>
          <div className={styles.needsPipCol} />
          <div className={styles.needsNameCol} />
          <div className={`${styles.needsPctCol} ${styles.activeCol}`}>{range}d</div>
          <div className={styles.needsPctCol}>30d</div>
          <div className={styles.needsSparkCol} />
        </div>
        {needStats.map(({ need, mode, pct, referencePct, sparkline }) => (
          <div key={need.id} className={styles.needsRow}>
            <div className={styles.needsPipCol}>
              <div className={styles.needsPip} style={{ background: LAYERS[mode].pip }} />
            </div>
            <div className={styles.needsNameCol}>{need.name}</div>
            <div className={`${styles.needsPctCol} ${styles.activeCol}`}>{pct}%</div>
            <div className={styles.needsPctCol}>{referencePct}%</div>
            <div className={styles.needsSparkCol}>
              <Sparkline data={sparkline} color={LAYERS[mode].pip} />
            </div>
          </div>
        ))}
        {survivalNeeds.length > 0 && (
          <div className={styles.needsRow}>
            <div className={styles.needsPipCol}>
              <span className={styles.survivalX}>✕</span>
            </div>
            <div className={styles.needsNameCol}>{survivalNeeds.map(n => n.name).join(', ')}</div>
            <div className={styles.needsSurvivalNote}>survival — no tracking</div>
          </div>
        )}
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
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [journalEntry, setJournalEntry] = useState('')

  const moods = state.moods || []
  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods, practices: state.practices })

  useEffect(() => {
    if (selectedDay && state.userId) {
      loadJournalEntry(state.userId, selectedDay).then(setJournalEntry)
    }
  }, [selectedDay, state.userId])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>data</div>
        {view !== 'log' && (
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
        <button className={`${styles.viewBtn} ${view === 'log' ? styles.viewBtnActive : ''}`} onClick={() => setView('log')}>Log</button>
      </div>

      {view === 'overview' && (
        <div className={styles.section}>
          <StatCards stats={stats} range={range} />
          <NeedsTable stats={stats} canvas={state.canvas} range={range} />
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

      {view === 'log' && (
        <div className={styles.section}>
          <LogCalendar
            checkins={state.checkins}
            canvas={state.canvas}
            moods={moods}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            onSelectDay={setSelectedDay}
          />
        </div>
      )}

      {selectedDay && (
        <DayDetailModal
          dateKey={selectedDay}
          checkins={state.checkins}
          moods={moods}
          canvas={state.canvas}
          journalEntry={journalEntry}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
