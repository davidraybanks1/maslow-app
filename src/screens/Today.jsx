import { useState } from 'react'
import { NEEDS, LAYERS, totalBubbles } from '../lib/constants'
import { todayKey } from '../lib/store'
import styles from './Today.module.css'

const LAYER_ORDER = ['purpose', 'appreciation', 'nourishment', 'survival']
const MOOD_PERIODS = ['morning', 'midday', 'evening']
const MOODS = ['good', 'fine', 'bad']


export default function Today({ state, checkIn, logMood }) {
  const today = todayKey()
  const checked = state.checkins[today] || []
  const total = totalBubbles(state.canvas)
  const done = checked.length
  const pct = total ? Math.round(done / total * 100) : 0

  const todayMoods = (state.moods || []).filter(m => m.date_key === today)

  const [moodSelections, setMoodSelections] = useState(() => {
    const init = {}
    todayMoods.forEach(m => { init[m.prompt_time] = m.mood })
    return init
  })

  const [moodNotes, setMoodNotes] = useState(() => {
    const init = {}
    todayMoods.forEach(m => { init[m.prompt_time] = m.note || '' })
    return init
  })

  function handleMoodSelect(promptTime, mood) {
    setMoodSelections(prev => ({ ...prev, [promptTime]: mood }))
    if (logMood) logMood(state.userId, promptTime, mood, moodNotes[promptTime] || null, today)
  }

  function handleNoteBlur(promptTime) {
    if (!moodSelections[promptTime] || !logMood) return
    logMood(state.userId, promptTime, moodSelections[promptTime], moodNotes[promptTime] || null, today)
  }

  return (
    <div className={styles.screen}>

      {/* ── Greeting ── */}
      <div className={styles.header}>
        <div className={styles.greeting}>
          good {hour()}, <em>{state.profile?.name || 'friend'}.</em>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className={styles.list}>

        {/* ── Mood section ── */}
        <div className={styles.sectionDivider} />
        <div className={styles.sectionHeader}>
          <span>mood</span>
          <span style={{ color: 'var(--ink3)', fontWeight: 200 }}>today</span>
        </div>
        <div className={styles.moodSection}>
          {MOOD_PERIODS.map((period, idx) => (
            <div key={period}>
              {idx > 0 && <div className={styles.moodDivider} />}
              <div className={styles.moodRow}>
                <div className={styles.moodRowTop}>
                  <span className={styles.moodLabel}>{period}</span>
                  <div className={styles.moodBtns}>
                    {MOODS.map(mood => (
                      <button
                        key={mood}
                        className={`${styles.moodBtn} ${moodSelections[period] === mood ? styles.moodBtnSelected : ''}`}
                        onClick={() => handleMoodSelect(period, mood)}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  className={styles.moodNote}
                  placeholder="add a note…"
                  value={moodNotes[period] || ''}
                  onChange={e => setMoodNotes(prev => ({ ...prev, [period]: e.target.value }))}
                  onBlur={() => handleNoteBlur(period)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── Progress bar ── */}
        <div className={styles.progTrack}>
          <div className={styles.progFill} style={{ width: `${pct}%` }} />
        </div>

        {/* ── Practices section ── */}
        <div className={styles.sectionHeader}>
          <span>practices</span>
          <span style={{ color: 'var(--ink3)', fontWeight: 200 }}>{done}/{total}</span>
        </div>

        {LAYER_ORDER.map(mode => {
          const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
          if (!modeNeeds.length) return null
          const lyr = LAYERS[mode]
          if (lyr.bubbles === 0) return null

          const modeTotalBubbles = lyr.bubbles * modeNeeds.length
          const modeFilledCount = modeNeeds.reduce((sum, n) => {
            const prefix = `${n.id}_`
            return sum + checked.filter(k => k.startsWith(prefix)).length
          }, 0)

          return (
            <div key={mode} className={styles.modeGroup}>
              <div className={styles.modeLabel}>
                <div className={styles.modePip} style={{ background: lyr.pip }} />
                <span>{mode}</span>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginLeft: 'auto' }}>
                  {Array.from({ length: modeTotalBubbles }).map((_, i) => (
                    <div
                      key={i}
                      className={i < modeFilledCount ? styles.bubbleDot : `${styles.bubbleDot} ${styles.bubbleDotEmpty}`}
                      style={i < modeFilledCount
                        ? { background: lyr.pip }
                        : { border: `1.5px solid ${lyr.pip}` }
                      }
                    />
                  ))}
                </div>
              </div>

              {modeNeeds.map(n => {
                const pool = state.practices[n.id] || []
                const prefix = `${n.id}_`
                const checkedTexts = checked.filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))

                return (
                  <div key={n.id} className={styles.needSection}>
                    <div className={styles.needLabel}>{n.name}</div>
                    {pool.length === 0 ? (
                      <div className={styles.noPractice} style={{ paddingLeft: 15 }}>
                        No practices set — add some in Practices
                      </div>
                    ) : (
                      <div className={styles.chipRow}>
                        {pool.map(p => {
                          const isDone = checkedTexts.includes(p)
                          return (
                            <button
                              key={p}
                              className={isDone ? styles.practiceChipDone : styles.practiceChip}
                              style={isDone ? { background: lyr.pip } : {}}
                              onClick={() => checkIn(n.id, p)}
                            >
                              {p}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function hour() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
