import { useState, useEffect } from 'react'
import { NEEDS, LAYERS } from '../lib/constants'
import { todayKey, loadJournalEntry } from '../lib/store'
import styles from './Data.module.css'

const MOOD_SCORE = { good: 3, fine: 2, bad: 1 }
const MOOD_LABEL = { 3: 'good', 2: 'fine', 1: 'bad' }
const MOOD_COLOR = { good: '#1B3A2D', fine: '#E8B81F', bad: '#D93B1C' }

function getLast7Days() {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

function getLast30Days() {
  return Array.from({ length: 30 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })
}

function formatDateShort(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MoodChart({ days, checkins, moods, canvas }) {
  const data = days.map(day => {
    const dayMoods = moods.filter(m => m.date_key === day)
    const avgMood = dayMoods.length
      ? dayMoods.reduce((s, m) => s + MOOD_SCORE[m.mood], 0) / dayMoods.length
      : null

    const dayCheckins = checkins[day] || []
    const totalBubbles = NEEDS.reduce((s, n) => {
      const mode = canvas[n.id]
      return s + (LAYERS[mode]?.bubbles || 0)
    }, 0)
    const completionPct = totalBubbles > 0 ? dayCheckins.length / totalBubbles : 0

    return { day, avgMood, completionPct }
  })

  const W = 100
  const H = 80
  const padL = 4
  const padR = 4
  const padT = 8
  const padB = 8
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n = data.length
  const stepX = n > 1 ? chartW / (n - 1) : chartW

  const moodPoints = data
    .map((d, i) => d.avgMood !== null ? { x: padL + i * stepX, y: padT + chartH - ((d.avgMood - 1) / 2) * chartH } : null)
    .filter(Boolean)

  const practicePoints = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - d.completionPct * chartH
  }))

  const moodPath = moodPoints.length > 1
    ? moodPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : ''

  const practicePath = practicePoints.length > 1
    ? practicePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : ''

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.5, 1].map(v => (
          <line
            key={v}
            x1={padL} y1={padT + chartH - v * chartH}
            x2={W - padR} y2={padT + chartH - v * chartH}
            stroke="#E8E8E8" strokeWidth="0.5"
          />
        ))}

        {/* Practice line */}
        {practicePath && (
          <path d={practicePath} fill="none" stroke="#E8B81F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        )}

        {/* Mood line */}
        {moodPath && (
          <path d={moodPath} fill="none" stroke="#1B3A2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Mood dots */}
        {moodPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#1B3A2D" />
        ))}
      </svg>

      {/* X axis labels */}
      <div className={styles.chartXAxis}>
        {days.length <= 7
          ? days.map(d => <span key={d} className={styles.chartXLabel}>{formatDateShort(d)}</span>)
          : [days[0], days[6], days[13], days[20], days[29]].map(d => (
              <span key={d} className={styles.chartXLabel}>{formatDateShort(d)}</span>
            ))
        }
      </div>

      {/* Legend */}
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <div className={styles.legendLine} style={{ background: '#1B3A2D' }} />
          <span>mood</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendLine} style={{ background: '#E8B81F', opacity: 0.6 }} />
          <span>practices</span>
        </div>
      </div>
    </div>
  )
}

const MODE_ORDER = ['purpose', 'appreciation', 'nourishment', 'survival']

function getDailyData(days, checkins, moods, canvas) {
  return days.map(day => {
    const dayMoods = moods.filter(m => m.date_key === day)
    const avgMood = dayMoods.length
      ? dayMoods.reduce((s, m) => s + MOOD_SCORE[m.mood], 0) / dayMoods.length
      : null
    const dayCheckins = checkins[day] || []
    const totalBubbles = NEEDS.reduce((s, n) => {
      const mode = canvas[n.id]
      return s + (LAYERS[mode]?.bubbles || 0)
    }, 0)
    const completionPct = totalBubbles > 0 ? dayCheckins.length / totalBubbles : 0
    return { day, avgMood, completionPct, checkinCount: dayCheckins.length, totalBubbles }
  })
}

function NeedsBreakdown({ days, checkins, canvas }) {
  const sortedNeeds = [...NEEDS].sort((a, b) => {
    const ai = MODE_ORDER.indexOf(canvas[a.id] || 'survival')
    const bi = MODE_ORDER.indexOf(canvas[b.id] || 'survival')
    return ai - bi
  })

  return (
    <div className={styles.needsBreakdown}>
      {sortedNeeds.map(need => {
        const mode = canvas[need.id]
        const lyr = LAYERS[mode]
        if (!lyr || lyr.bubbles === 0) {
          return (
            <div key={need.id} className={styles.breakdownRow}>
              <div className={styles.breakdownPip} style={{ background: '#D93B1C' }} />
              <div className={styles.breakdownNeed}>{need.name}</div>
              <div className={styles.breakdownBarWrap} />
              <div className={styles.breakdownPct} style={{ color: 'var(--ink4)' }}>survival</div>
            </div>
          )
        }
        const possible = days.length * lyr.bubbles
        const actual = days.reduce((total, day) => {
          const dayCheckins = checkins[day] || []
          return total + dayCheckins.filter(k => k.startsWith(`${need.id}_`)).length
        }, 0)
        const pct = possible > 0 ? Math.round((actual / possible) * 100) : 0
        return (
          <div key={need.id} className={styles.breakdownRow}>
            <div className={styles.breakdownPip} style={{ background: lyr.pip }} />
            <div className={styles.breakdownNeed}>{need.name}</div>
            <div className={styles.breakdownBarWrap}>
              <div className={styles.breakdownBar} style={{ width: `${pct}%`, background: lyr.pip }} />
            </div>
            <div className={styles.breakdownPct} style={{ color: pct > 0 ? lyr.pip : 'var(--ink4)' }}>{pct}%</div>
          </div>
        )
      })}
    </div>
  )
}

function PracticesChart({ data }) {
  const W = 100, H = 60, padL = 2, padR = 2, padT = 6, padB = 6
  const chartW = W - padL - padR, chartH = H - padT - padB
  const n = data.length
  const stepX = n > 1 ? chartW / (n - 1) : chartW
  const barW = Math.max(0.8, chartW / n - 0.6)

  const points = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - d.completionPct * chartH
  }))

  // Simple moving average for trend line (window of 5)
  const trendPoints = data.map((d, i) => {
    const window = data.slice(Math.max(0, i - 2), i + 3)
    const avg = window.reduce((s, w) => s + w.completionPct, 0) / window.length
    return { x: padL + i * stepX, y: padT + chartH - avg * chartH }
  })

  const trendPath = trendPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const avgPct = Math.round(data.reduce((s, d) => s + d.completionPct, 0) / data.length * 100)

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartTitle}>daily completion</div>
      <div className={styles.chartSubtitle}>last {data.length} days · avg {avgPct}%</div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} preserveAspectRatio="none">
        {[0, 0.5, 1].map(v => (
          <line key={v} x1={padL} y1={padT + chartH - v * chartH} x2={W - padR} y2={padT + chartH - v * chartH} stroke="#E8E8E8" strokeWidth="0.5" />
        ))}
        {points.map((p, i) => (
          <rect key={i} x={p.x - barW/2} y={p.y} width={barW} height={padT + chartH - p.y} fill="#E8B81F" opacity="0.25" />
        ))}
        <path d={trendPath} fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className={styles.chartXAxis}>
        <span className={styles.chartXLabel}>{formatDateShort(data[0].day)}</span>
        <span className={styles.chartXLabel}>{formatDateShort(data[data.length-1].day)}</span>
      </div>
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}><div className={styles.legendSwatch} style={{ background: '#E8B81F', opacity: 0.25 }} /><span>daily %</span></div>
        <div className={styles.legendItem}><div className={styles.legendLine} style={{ background: '#1A1A1A' }} /><span>trend</span></div>
      </div>
    </div>
  )
}

function MoodTrendChart({ data }) {
  const W = 100, H = 60, padL = 8, padR = 2, padT = 6, padB = 6
  const chartW = W - padL - padR, chartH = H - padT - padB
  const n = data.length
  const stepX = n > 1 ? chartW / (n - 1) : chartW

  const moodData = data.filter(d => d.avgMood !== null)
  const points = moodData.map(d => {
    const i = data.indexOf(d)
    return { x: padL + i * stepX, y: padT + chartH - ((d.avgMood - 1) / 2) * chartH }
  })

  const trendPath = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : ''

  const avgMood = moodData.length
    ? moodData.reduce((s, d) => s + d.avgMood, 0) / moodData.length
    : null
  const avgLabel = avgMood === null ? '—' : avgMood >= 2.5 ? 'good' : avgMood >= 1.5 ? 'fine' : 'bad'

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartTitle}>mood trend</div>
      <div className={styles.chartSubtitle}>last {data.length} days · avg {avgLabel}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} preserveAspectRatio="none">
        {[0, 0.5, 1].map(v => (
          <line key={v} x1={padL} y1={padT + chartH - v * chartH} x2={W - padR} y2={padT + chartH - v * chartH} stroke="#E8E8E8" strokeWidth="0.5" />
        ))}
        <text x="0" y={padT + chartH - 0 * chartH + 1.5} fontFamily="monospace" fontSize="3.5" fill="#A8A8A8">bad</text>
        <text x="0" y={padT + chartH - 0.5 * chartH + 1.5} fontFamily="monospace" fontSize="3.5" fill="#A8A8A8">fine</text>
        <text x="0" y={padT + chartH - 1 * chartH + 1.5} fontFamily="monospace" fontSize="3.5" fill="#A8A8A8">good</text>
        {trendPath && <path d={trendPath} fill="none" stroke="#1B3A2D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />}
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.2" fill="#1B3A2D" />)}
      </svg>
      <div className={styles.chartXAxis}>
        <span className={styles.chartXLabel}>{formatDateShort(data[0].day)}</span>
        <span className={styles.chartXLabel}>{formatDateShort(data[data.length-1].day)}</span>
      </div>
    </div>
  )
}

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

export default function Data({ state }) {
  const [view, setView] = useState('overview')
  const [range, setRange] = useState(7)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [journalEntry, setJournalEntry] = useState('')

  const days = range === 7 ? getLast7Days() : getLast30Days()
  const moods = state.moods || []
  const filteredMoods = moods.filter(m => days.includes(m.date_key))
  const dailyData = getDailyData(days, state.checkins, filteredMoods, state.canvas)

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
          <MoodChart days={days} checkins={state.checkins} moods={filteredMoods} canvas={state.canvas} />
          <div className={styles.sectionLabel} style={{ marginTop: 24 }}>needs breakdown</div>
          <NeedsBreakdown days={days} checkins={state.checkins} canvas={state.canvas} />
        </div>
      )}

      {view === 'practices' && (
        <div className={styles.section}>
          <PracticesChart data={dailyData} />
          <div className={styles.sectionLabel} style={{ marginTop: 24 }}>needs breakdown</div>
          <NeedsBreakdown days={days} checkins={state.checkins} canvas={state.canvas} />
        </div>
      )}

      {view === 'mood' && (
        <div className={styles.section}>
          <MoodTrendChart data={dailyData} />
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
