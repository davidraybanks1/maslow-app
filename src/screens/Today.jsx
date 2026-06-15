import { useState, useEffect, useRef } from 'react'
import { NEEDS, LAYERS, totalBubbles } from '../lib/constants'
import { todayKey, loadJournalEntry, saveJournalEntry, loadDebriefTypes } from '../lib/store'
import { createDataStats } from '../lib/dataStats'
import DebriefForm from '../components/DebriefForm'
import styles from './Today.module.css'

const LAYER_ORDER = ['purpose', 'appreciation', 'nourishment', 'survival']
const MOOD_PERIODS = ['morning', 'midday', 'evening']
const MOODS = ['good', 'fine', 'bad']
const MOOD_SELECTED_CLASS = { good: 'moodBtnGood', fine: 'moodBtnFine', bad: 'moodBtnBad' }


export default function Today({ state, checkIn, logMood }) {
  const today = todayKey()
  const checked = state.checkins[today] || []
  const total = totalBubbles(state.canvas)
  const done = checked.length
  const pct = total ? Math.round(done / total * 100) : 0

  const todayMoods = (state.moods || []).filter(m => m.date_key === today)

  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods: state.moods, practices: state.practices })
  const streak = stats.getStreak()
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()

  const [journalEntry, setJournalEntry] = useState('')
  const debounceRef = useRef(null)
  const journalRef = useRef(null)

  useEffect(() => {
    if (!state.userId) return
    loadJournalEntry(state.userId, today).then(entry => {
      setJournalEntry(entry)
      setTimeout(() => {
        if (journalRef.current && entry) {
          journalRef.current.style.height = 'auto'
          journalRef.current.style.height = journalRef.current.scrollHeight + 'px'
        }
      }, 50)
    })
  }, [state.userId, today])

  function handleJournalChange(e) {
    const val = e.target.value
    setJournalEntry(val)
    if (journalRef.current) {
      journalRef.current.style.height = 'auto'
      journalRef.current.style.height = journalRef.current.scrollHeight + 'px'
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (state.userId) saveJournalEntry(state.userId, today, val)
    }, 1500)
  }

  const [debriefExpanded, setDebriefExpanded] = useState(false)
  const [debriefTypes, setDebriefTypes] = useState({ nature: [], environment: [] })

  useEffect(() => {
    if (!state.userId) return
    loadDebriefTypes(state.userId).then(setDebriefTypes)
  }, [state.userId])

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

  async function handleMoodSelect(promptTime, mood) {
    setMoodSelections(prev => ({ ...prev, [promptTime]: mood }))
    if (!logMood) return
    const { error } = await logMood(state.userId, promptTime, mood, moodNotes[promptTime] || null, today)
    if (error) {
      setMoodSelections(prev => {
        const next = { ...prev }
        if (next[promptTime] === mood) delete next[promptTime]
        return next
      })
    }
  }

  function handleNoteBlur(promptTime) {
    if (!moodSelections[promptTime] || !logMood) return
    logMood(state.userId, promptTime, moodSelections[promptTime], moodNotes[promptTime] || null, today)
  }

  return (
    <div className={styles.screen}>

      {/* ── Greeting ── */}
      <div className={styles.header}>
        <div className={styles.eyebrow}>today</div>
        <div className={styles.greeting}>good {hour()}.</div>
        <div className={styles.subRow}>
          <span className={styles.dateLabel}>{dateLabel}</span>
          {streak > 1 && <span className={styles.streak}>{streak} days</span>}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className={styles.list}>

        {/* ── Progress bar ── */}
        <div className={styles.progressRow}>
          <span className={styles.progressCount}>{done} of {total}</span>
          <div className={styles.progTrack}>
            <div className={styles.progFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.progressPct}>{pct}%</span>
        </div>

        {/* ── Mood card ── */}
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>mood</span>
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
                          className={`${styles.moodBtn} ${moodSelections[period] === mood ? styles[MOOD_SELECTED_CLASS[mood]] : ''}`}
                          onClick={() => handleMoodSelect(period, mood)}
                        >
                          {mood}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(moodSelections[period] || moodNotes[period]) && (
                    <input
                      className={styles.moodNote}
                      placeholder="add a note…"
                      value={moodNotes[period] || ''}
                      onChange={e => setMoodNotes(prev => ({ ...prev, [period]: e.target.value }))}
                      onBlur={() => handleNoteBlur(period)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Journal card ── */}
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>thoughts</span>
          </div>
          <textarea
            ref={journalRef}
            className={styles.journalInput}
            placeholder="add your voiceover for the day…"
            value={journalEntry}
            onChange={handleJournalChange}
            rows={5}
          />

          <button className={styles.debriefToggle} onClick={() => setDebriefExpanded(e => !e)}>
            <span className={`${styles.chevron} ${debriefExpanded ? styles.chevronOpen : ''}`}>›</span>
            <span>anxiety debrief</span>
          </button>

          {debriefExpanded && (
            <>
              <div className={styles.debriefHairline} />
              <DebriefForm userId={state.userId} debriefTypes={debriefTypes} onSaved={() => setDebriefExpanded(false)} />
            </>
          )}
        </div>

        {/* ── Practices card ── */}
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>practices</span>
          </div>

          {LAYER_ORDER.filter(m => LAYERS[m].bubbles > 0).map(mode => {
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

          {(() => {
            const survivalNeeds = NEEDS.filter(n => state.canvas[n.id] === 'survival')
            if (!survivalNeeds.length) return null
            return (
              <>
                <div className={styles.sectionDivider} />
                <div className={styles.modeGroup}>
                  <div className={styles.modeLabel}>
                    <div className={styles.modePip} style={{ background: '#D93B1C' }} />
                    <span style={{ color: '#D93B1C' }}>survival</span>
                  </div>
                  <span className={styles.modeHint}>no effort needed today</span>
                </div>
                <div className={styles.survivalRow}>
                  {survivalNeeds.map(n => (
                    <div key={n.id} className={styles.survivalNeed}>
                      <span className={styles.survivalX}>✕</span>
                      <span className={styles.survivalName}>{n.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
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
