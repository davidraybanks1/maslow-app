import { useState } from 'react'
import { NEEDS, LAYERS, totalBubbles } from '../lib/constants'
import { todayKey } from '../lib/store'
import styles from './Today.module.css'

const LAYER_ORDER = ['purpose', 'appreciation', 'nourishment', 'survival']
const MOOD_PERIODS = ['morning', 'midday', 'evening']
const MOODS = ['good', 'fine', 'bad']

const PRACTICE_HINT = {
  purpose:      '3 practices',
  appreciation: '2 practices each',
  nourishment:  '1 practice each',
}

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
          return (
            <div key={mode} className={styles.modeGroup}>
              <div className={styles.modeLabel}>
                <div className={styles.modePip} style={{ background: lyr.pip }} />
                {mode}
                {PRACTICE_HINT[mode] && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink3)', marginLeft: 6 }}>
                    {PRACTICE_HINT[mode]}
                  </span>
                )}
              </div>
              {modeNeeds.map(n => {
                const pool = state.practices[n.id] || []
                const prefix = `${n.id}_`
                const checkedKeys = checked.filter(k => k.startsWith(prefix))
                const checkedTexts = checkedKeys.map(k => k.slice(prefix.length))
                const remainingSlots = lyr.bubbles - checkedKeys.length
                const availableChips = pool.filter(p => !checkedTexts.includes(p))

                return (
                  <div key={n.id}>
                    {checkedTexts.map(practiceText => (
                      <div
                        key={practiceText}
                        className={`${styles.bubbleRow} ${styles.bubbleRowDone}`}
                        onClick={() => checkIn(n.id, practiceText)}
                      >
                        <div
                          className={`${styles.bubble} ${styles.bubbleDone}`}
                          style={{ background: lyr.pip, borderColor: lyr.pip }}
                        >
                          <span className={styles.check}>✓</span>
                        </div>
                        <div className={styles.bubbleInfo}>
                          <div className={styles.bubbleNeed}>{n.name}</div>
                          <div className={styles.bubblePractice}>{practiceText}</div>
                        </div>
                      </div>
                    ))}

                    {remainingSlots > 0 && (
                      <div className={styles.bubbleRow}>
                        <div className={styles.bubble} />
                        <div className={styles.bubbleInfo}>
                          <div className={styles.bubbleNeed}>{n.name}</div>
                          {pool.length === 0 ? (
                            <div className={styles.noPractice}>No practices set — add some in Practices</div>
                          ) : availableChips.length === 0 ? (
                            <div className={styles.noPractice}>All pool practices done</div>
                          ) : (
                            <div className={styles.chipRow}>
                              {availableChips.map(p => (
                                <button
                                  key={p}
                                  className={styles.practiceChip}
                                  onClick={e => { e.stopPropagation(); checkIn(n.id, p) }}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
