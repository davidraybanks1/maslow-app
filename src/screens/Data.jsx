import { useState } from 'react'
import { NEEDS, LAYERS } from '../lib/constants'
import { todayKey } from '../lib/store'
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

function CanvasCompletion({ days, checkins, canvas }) {
  const sortedNeeds = [...NEEDS].sort((a, b) => {
    const ai = MODE_ORDER.indexOf(canvas[a.id] || 'survival')
    const bi = MODE_ORDER.indexOf(canvas[b.id] || 'survival')
    return ai - bi
  })

  return (
    <div className={styles.canvasCompletion}>
      {sortedNeeds.map(need => {
        const mode = canvas[need.id]
        const lyr = LAYERS[mode]
        if (!lyr || lyr.bubbles === 0) {
          return (
            <div key={need.id} className={styles.completionRow}>
              <div className={styles.completionNeed}>{need.name}</div>
              <div className={styles.completionBarWrap}>
                <div className={styles.completionBar} style={{ width: '0%', background: '#E8E8E8' }} />
              </div>
              <div className={styles.completionPct} style={{ color: 'var(--ink4)' }}>survival</div>
            </div>
          )
        }

        const possibleCheckins = days.length * lyr.bubbles
        const actualCheckins = days.reduce((total, day) => {
          const dayCheckins = checkins[day] || []
          const needCheckins = dayCheckins.filter(k => k.startsWith(`${need.id}_`))
          return total + needCheckins.length
        }, 0)

        const pct = possibleCheckins > 0 ? Math.round((actualCheckins / possibleCheckins) * 100) : 0

        return (
          <div key={need.id} className={styles.completionRow}>
            <div className={styles.completionNeed}>{need.name}</div>
            <div className={styles.completionBarWrap}>
              <div
                className={styles.completionBar}
                style={{ width: `${pct}%`, background: lyr.pip }}
              />
            </div>
            <div className={styles.completionPct} style={{ color: pct > 0 ? lyr.pip : 'var(--ink4)' }}>
              {pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MoodLog({ moods }) {
  if (!moods.length) {
    return <div className={styles.empty}>No mood data yet. Mood check-ins will appear here.</div>
  }

  const grouped = moods.reduce((acc, m) => {
    if (!acc[m.date_key]) acc[m.date_key] = []
    acc[m.date_key].push(m)
    return acc
  }, {})

  return (
    <div className={styles.moodLog}>
      {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(day => (
        <div key={day} className={styles.moodDay}>
          <div className={styles.moodDayLabel}>{formatDateShort(day)}</div>
          {grouped[day].map((m, i) => (
            <div key={i} className={styles.moodEntry}>
              <div className={styles.moodBadge} style={{ background: MOOD_COLOR[m.mood] }}>
                {m.mood}
              </div>
              <div className={styles.moodMeta}>
                <span className={styles.moodTime}>{m.prompt_time}</span>
                {m.note && <span className={styles.moodNote}>{m.note}</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function Data({ state }) {
  const [view, setView] = useState('chart')
  const [range, setRange] = useState(7)

  const days = range === 7 ? getLast7Days() : getLast30Days()
  const moods = state.moods || []
  const filteredMoods = moods.filter(m => days.includes(m.date_key))

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>data</div>
        <div className={styles.rangeToggle}>
          <button
            className={`${styles.rangeBtn} ${range === 7 ? styles.rangeBtnActive : ''}`}
            onClick={() => setRange(7)}
          >7d</button>
          <button
            className={`${styles.rangeBtn} ${range === 30 ? styles.rangeBtnActive : ''}`}
            onClick={() => setRange(30)}
          >30d</button>
        </div>
      </div>

      <div className={styles.viewToggle}>
        <button
          className={`${styles.viewBtn} ${view === 'chart' ? styles.viewBtnActive : ''}`}
          onClick={() => setView('chart')}
        >Mood & Practices</button>
        <button
          className={`${styles.viewBtn} ${view === 'canvas' ? styles.viewBtnActive : ''}`}
          onClick={() => setView('canvas')}
        >Canvas</button>
        <button
          className={`${styles.viewBtn} ${view === 'log' ? styles.viewBtnActive : ''}`}
          onClick={() => setView('log')}
        >Log</button>
      </div>

      {view === 'chart' && (
        <div className={styles.section}>
          {filteredMoods.length === 0 && (
            <div className={styles.empty}>No mood data yet for this period.</div>
          )}
          <MoodChart
            days={days}
            checkins={state.checkins}
            moods={filteredMoods}
            canvas={state.canvas}
          />
        </div>
      )}

      {view === 'canvas' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Need completion over {range} days</div>
          <CanvasCompletion
            days={days}
            checkins={state.checkins}
            canvas={state.canvas}
          />
        </div>
      )}

      {view === 'log' && (
        <div className={styles.section}>
          <MoodLog moods={filteredMoods} />
        </div>
      )}
    </div>
  )
}