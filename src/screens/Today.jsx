import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODES, MODE_ORDER, MODE_MAX_BUBBLES, MODE_WEIGHTS } from '../lib/constants'
import { todayKey, loadJournalEntry, saveJournalEntry, loadDebriefTypes, loadDebriefs, loadNoteToSelf, saveNoteToSelf } from '../lib/store'
import { createDataStats, getCanvasGuidance } from '../lib/dataStats'
import DebriefForm from '../components/DebriefForm'
import PeakDebriefForm from '../components/PeakDebriefForm'
import styles from './Today.module.css'

const MOOD_PERIODS = ['morning', 'midday', 'evening']
const MOODS = ['good', 'fine', 'bad']
const MOOD_SELECTED_CLASS = { good: 'moodBtnGood', fine: 'moodBtnFine', bad: 'moodBtnBad' }

const NOTE_MAX_LENGTH = 120
const NOTE_LIBRARY = [
  'everything can be appreciated. most things can be enjoyed. everything else can be learned from.',
  'take up space.',
  'anxiety is just a misfired neurotransmission that was given room to grow.',
  'everything you want is on the other side of discomfort.',
  "don't play it safe.",
]

function formatNoteDate(dateKey) {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
}

function formatScore(v) {
  return Number.isInteger(v) ? String(v) : `${Math.floor(v)}½`
}

function dateKeyForOffset(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isGuidanceDismissed(type) {
  for (let i = 0; i < 7; i++) {
    if (localStorage.getItem(`guidanceDismissed_${type}_${dateKeyForOffset(i)}`)) return true
  }
  return false
}

function GuidanceCard({ type, onDismiss }) {
  const navigate = useNavigate()

  if (type === 'grow') {
    return (
      <div className={styles.guidanceCardGrow}>
        <div className={styles.guidanceEyebrowGrow}>14-DAY STREAK</div>
        <div className={styles.guidanceHeadline}>you've built the muscle. ready to try something new?</div>
        <div className={styles.guidanceBody}>two weeks of consistent practice means your canvas is working. this is a good moment to add a need or raise a need to a higher mode — one small step, not an overhaul.</div>
        <div className={styles.guidanceActions}>
          <button className={styles.guidanceCtaGrow} onClick={() => navigate('/canvas')}>update my canvas →</button>
          <button className={styles.guidanceSecondary} onClick={onDismiss}>not yet</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.guidanceCardSimplify}>
      <div className={styles.guidanceEyebrowSimplify}>CANVAS CHECK-IN</div>
      <div className={styles.guidanceHeadline}>the best athletes know when to pull back.</div>
      <div className={styles.guidanceBody}>a tighter canvas is a stronger one. consider removing a need or moving one to a lower mode — not as a failure, but as a deliberate choice to build real consistency before adding more.</div>
      <div className={styles.guidanceActions}>
        <button className={styles.guidanceCtaSimplify} onClick={() => navigate('/canvas')}>adjust my canvas →</button>
        <button className={styles.guidanceSecondary} onClick={onDismiss}>keep as is</button>
      </div>
    </div>
  )
}

export default function Today({ state, checkIn, logMood, setNoteToSelf }) {
  const navigate = useNavigate()
  const today = todayKey()
  const checked = state.checkins[today] || []

  let maxScore = 0
  let currentScore = 0
  for (const n of NEEDS) {
    const mode = state.canvas[n.id]
    if (!mode) continue
    const maxBubbles = MODE_MAX_BUBBLES[mode] || 0
    const weight = MODE_WEIGHTS[mode] || 0
    maxScore += maxBubbles * weight
    const prefix = `${n.id}_`
    const filledBubbles = Math.min(checked.filter(k => k.startsWith(prefix)).length, maxBubbles)
    currentScore += filledBubbles * weight
  }
  const pct = maxScore > 0 ? Math.round(currentScore / maxScore * 100) : 0
  const progressLabel = `${formatScore(currentScore)} of ${formatScore(maxScore)} practices`

  const todayMoods = (state.moods || []).filter(m => m.date_key === today)
  const stats = createDataStats({ canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [], practices: state.practices || {} })
  const streak = stats.getStreak()
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()

  const [guidanceDismissedNow, setGuidanceDismissedNow] = useState(false)
  const onboardedToday = state.onboardedAt === today
  const guidanceType = onboardedToday ? null : getCanvasGuidance(state.checkins || {}, state.canvas || {})
  const showGuidance = !!guidanceType && !guidanceDismissedNow && !isGuidanceDismissed(guidanceType)

  function handleDismissGuidance() {
    localStorage.setItem(`guidanceDismissed_${guidanceType}_${today}`, '1')
    setGuidanceDismissedNow(true)
  }

  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteHistory, setNoteHistory] = useState([])
  const [noteSaveStatus, setNoteSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'

  function openNoteEditor() {
    setNoteDraft(state.noteToSelf || '')
    setNoteEditorOpen(true)
    if (state.userId) {
      loadNoteToSelf(state.userId).then(({ history }) => setNoteHistory(history))
    }
  }

  async function handleSaveNote() {
    setNoteSaveStatus('saving')
    if (state.userId) {
      await saveNoteToSelf(state.userId, noteDraft)
    }
    setNoteToSelf?.(noteDraft)
    setNoteSaveStatus('saved')
    setTimeout(() => {
      setNoteSaveStatus('idle')
      setNoteEditorOpen(false)
    }, 1000)
  }

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
  const [peakExpanded, setPeakExpanded] = useState(false)
  const [debriefTypes, setDebriefTypes] = useState({ nature: [], environment: [], peak: [] })
  const [todayDebriefCount, setTodayDebriefCount] = useState(0)
  const [todayPeakCount, setTodayPeakCount] = useState(0)

  useEffect(() => {
    if (!state.userId) return
    loadDebriefTypes(state.userId).then(setDebriefTypes)
  }, [state.userId])

  useEffect(() => {
    if (!state.userId) return
    loadDebriefs(state.userId).then(debriefs => {
      const todayDebriefs = debriefs.filter(d => d.date_key === today)
      setTodayDebriefCount(todayDebriefs.filter(d => !d.type || d.type === 'anxiety').length)
      setTodayPeakCount(todayDebriefs.filter(d => d.type === 'peak').length)
    })
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

  function handleChipClick(needId, mode, practiceText) {
    const maxBubbles = MODE_MAX_BUBBLES[mode]
    const prefix = `${needId}_`
    const checkedForNeed = checked.filter(k => k.startsWith(prefix))
    const isChecked = checkedForNeed.includes(`${needId}_${practiceText}`)
    if (!isChecked && checkedForNeed.length >= maxBubbles) {
      const oldestText = checkedForNeed[0].slice(prefix.length)
      checkIn(needId, oldestText)
    }
    checkIn(needId, practiceText)
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

        {state.showNoteToSelf && state.noteToSelf && (
          <>
            <div className={styles.noteRow}>
              <span className={styles.noteLabel}>note to self:</span>
              <span className={styles.noteText}>{state.noteToSelf}</span>
              <button className={styles.notePencilBtn} onClick={openNoteEditor}>✎</button>
            </div>
            <div className={styles.noteHairline} />
          </>
        )}

        {/* ── Progress bar ── */}
        <div className={styles.progressRow}>
          <span className={styles.progressCount}>{progressLabel}</span>
          <div className={styles.progTrack}>
            <div className={styles.progFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.progressPct}>{pct}%</span>
        </div>

        {showGuidance && <GuidanceCard type={guidanceType} onDismiss={handleDismissGuidance} />}

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

        {/* ── Practices card ── */}
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>practices</span>
          </div>

          {MODE_ORDER.map((mode, modeIdx) => {
            const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
            if (!modeNeeds.length) return null
            const pip = MODES[mode]?.pip
            const maxBubbles = MODE_MAX_BUBBLES[mode]

            return (
              <div key={mode}>
                {modeIdx > 0 && <div className={styles.modeSeparator} />}
                <div className={styles.modeHeader}>
                  <div className={styles.modeHeaderPip} style={{ background: pip }} />
                  <span className={styles.modeHeaderName}>{mode}</span>
                </div>

                {modeNeeds.map((n, needIdx) => {
                  const pool = state.practices[n.id] || []
                  const prefix = `${n.id}_`
                  const checkedForNeed = checked.filter(k => k.startsWith(prefix))
                  const filledBubbles = Math.min(checkedForNeed.length, maxBubbles)

                  return (
                    <div key={n.id}>
                      {needIdx > 0 && <div className={styles.needSeparator} />}
                      <div className={styles.needRow}>
                        <span className={styles.needName}>{n.name}</span>
                        <div className={styles.bubbleRow}>
                          {Array.from({ length: maxBubbles }).map((_, i) => (
                            <div
                              key={i}
                              className={styles.bubble}
                              style={i < filledBubbles
                                ? { background: pip, border: `1.5px solid ${pip}` }
                                : { background: 'transparent', border: `1.5px solid ${pip}` }
                              }
                            />
                          ))}
                        </div>
                      </div>
                      {pool.length === 0 ? (
                        <div className={styles.noPractice}>No practices set — add some <span className={styles.noPracticeLink} onClick={() => navigate('/practices')}>in Practices</span></div>
                      ) : (
                        <div className={styles.chipRow}>
                          {pool.map(p => {
                            const isDone = checkedForNeed.includes(`${n.id}_${p}`)
                            return (
                              <button
                                key={p}
                                className={isDone ? styles.practiceChipDone : styles.practiceChip}
                                style={isDone ? { background: pip } : {}}
                                onClick={() => handleChipClick(n.id, mode, p)}
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

        {/* ── Journal card ── */}
        <div className={styles.cardJournal}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>journal</span>
          </div>
          <textarea
            ref={journalRef}
            className={styles.journalInput}
            placeholder="add your thoughts for the day…"
            value={journalEntry}
            onChange={handleJournalChange}
            rows={5}
          />

          {/* Anxiety debrief */}
          <button className={styles.debriefToggle} onClick={() => setDebriefExpanded(e => !e)}>
            <span className={`${styles.chevron} ${debriefExpanded ? styles.chevronOpen : ''}`}>›</span>
            {todayDebriefCount > 0 && <span className={styles.debriefDot} />}
            <span>anxiety debrief</span>
            {todayDebriefCount > 0 && <span className={styles.debriefCount}>· {todayDebriefCount}</span>}
          </button>

          {debriefExpanded && (
            <>
              <div className={styles.debriefHairline} />
              <DebriefForm
                userId={state.userId}
                debriefTypes={debriefTypes}
                onSaved={() => {
                  setDebriefExpanded(false)
                  setTodayDebriefCount(c => c + 1)
                }}
              />
            </>
          )}

          {/* Peak debrief */}
          <button className={styles.debriefToggle} onClick={() => setPeakExpanded(e => !e)}>
            <span className={`${styles.chevron} ${peakExpanded ? styles.chevronOpen : ''}`}>›</span>
            {todayPeakCount > 0 && <span className={styles.debriefDot} />}
            <span>peak debrief</span>
            {todayPeakCount > 0 && <span className={styles.debriefCount}>· {todayPeakCount}</span>}
          </button>

          {peakExpanded && (
            <>
              <div className={styles.debriefHairline} />
              <PeakDebriefForm
                userId={state.userId}
                debriefTypes={debriefTypes}
                onSaved={() => {
                  setPeakExpanded(false)
                  setTodayPeakCount(c => c + 1)
                }}
              />
            </>
          )}
        </div>

      </div>

      {noteEditorOpen && (
        <div className={styles.noteOverlay}>
          <div className={styles.noteOverlayHeader}>
            <div className={styles.noteOverlayTitle}>note to self</div>
            <button className={styles.noteOverlayClose} onClick={() => setNoteEditorOpen(false)}>×</button>
          </div>
          <div className={styles.noteOverlayContent}>
            <div className={styles.noteSectionLabel}>WRITE YOUR OWN</div>
            <textarea
              className={styles.noteTextarea}
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
              maxLength={NOTE_MAX_LENGTH}
              placeholder="what does your future self need to remember this week?"
              rows={3}
            />
            <div className={styles.noteCharCount}>{NOTE_MAX_LENGTH - noteDraft.length} characters remaining</div>

            <div className={styles.noteSectionLabel}>FROM THE LIBRARY</div>
            <div className={styles.noteLibraryList}>
              {NOTE_LIBRARY.map((text, i) => (
                <div key={i} className={styles.noteCard} onClick={() => setNoteDraft(text)}>
                  {text}
                </div>
              ))}
            </div>

            {noteHistory.length > 0 && (
              <>
                <div className={styles.noteSectionLabel}>FROM YOUR HISTORY</div>
                <div className={styles.noteLibraryList}>
                  {noteHistory.map((h, i) => (
                    <div key={i} className={styles.noteHistoryCard} onClick={() => setNoteDraft(h.text)}>
                      <span className={styles.noteHistoryText}>{h.text}</span>
                      <span className={styles.noteHistoryDate}>{formatNoteDate(h.date)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className={styles.noteOverlayFooter}>
            <button className={styles.noteSaveBtn} onClick={handleSaveNote} disabled={noteSaveStatus === 'saving'}>
              {noteSaveStatus === 'saved' ? 'saved ✓' : 'save note →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function hour() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
