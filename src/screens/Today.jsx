import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODES, MODE_ORDER, MODE_MAX_BUBBLES, MODE_WEIGHTS } from '../lib/constants'
import { todayKey, loadJournalEntry, saveJournalEntry, loadDebriefTypes, loadDebriefs, loadNoteDeck, addNoteDeckCard, updateNoteDeckCard, deleteNoteDeckCard, uploadNoteImage } from '../lib/store'
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

export default function Today({ state, checkIn, logMood }) {
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
  const piePct = maxScore > 0 ? currentScore / maxScore : 0

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

  const [noteDeck, setNoteDeck] = useState(() => state.noteDeck || [])
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [deckHeight, setDeckHeight] = useState(undefined)
  const deckWrapperRef = useRef(null)
  const cardRefs = useRef([])
  const pieRef = useRef(null)

  const [lightboxImage, setLightboxImage] = useState(null)
  const [manageDeckOpen, setManageDeckOpen] = useState(false)
  const [composer, setComposer] = useState(null) // null = list view; {} = new card; {id,text,image_url} = editing
  const [composerText, setComposerText] = useState('')
  const [composerImageUrl, setComposerImageUrl] = useState(null)
  const [composerUploading, setComposerUploading] = useState(false)
  const [composerError, setComposerError] = useState(null)
  const fileInputRef = useRef(null)

  function loadDeck() {
    if (!state.userId) { console.error('[loadDeck] called without userId — session may be invalid'); return }
    loadNoteDeck(state.userId).then(setNoteDeck)
  }

  // Sync local deck state whenever restoreFromSupabase pushes a fresh noteDeck
  useEffect(() => { setNoteDeck(state.noteDeck || []) }, [state.noteDeck])

  useEffect(() => {
    const canvas = pieRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const size = 44
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 1
    const innerR = r * 0.55
    const bg2 = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#F5F3ED'
    ctx.clearRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(26,26,26,0.08)'
    ctx.fill()
    if (piePct > 0) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + piePct * 2 * Math.PI)
      ctx.closePath()
      ctx.fillStyle = piePct >= 1 ? '#1B3A2D' : '#1A1A1A'
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
    ctx.fillStyle = bg2
    ctx.fill()
  }, [currentScore, maxScore])

  useLayoutEffect(() => {
    const heights = cardRefs.current.filter(Boolean).map(el => el.offsetHeight)
    if (heights.length) setDeckHeight(Math.max(...heights))
  }, [noteDeck])

  function handleDeckScroll() {
    const wrapper = deckWrapperRef.current
    if (!wrapper || wrapper.clientWidth === 0) return
    setActiveCardIndex(Math.round(wrapper.scrollLeft / wrapper.clientWidth))
  }

  function openManageDeck() {
    setManageDeckOpen(true)
    setComposer(null)
  }

  function openComposerForNew() {
    setComposer({})
    setComposerText('')
    setComposerImageUrl(null)
    setComposerError(null)
  }

  function openComposerForEdit(card) {
    setComposer(card)
    setComposerText(card.text || '')
    setComposerImageUrl(card.image_url || null)
    setComposerError(null)
  }

  async function handleComposerImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!state.userId) { console.error('[handleComposerImageSelect] called without userId — session may be invalid'); navigate('/signin'); return }
    setComposerUploading(true)
    const { url } = await uploadNoteImage(state.userId, file)
    if (url) setComposerImageUrl(url)
    setComposerUploading(false)
    e.target.value = ''
  }

  async function handleComposerSave() {
    const text = composerText.trim()
    if (!text) return
    if (!state.userId) { console.error('[handleComposerSave] called without userId — session may be invalid'); navigate('/signin'); return }
    setComposerError(null)

    try {
      let error
      if (composer?.id) {
        ;({ error } = await updateNoteDeckCard(composer.id, { text, imageUrl: composerImageUrl }))
      } else {
        ;({ error } = await addNoteDeckCard(state.userId, { text, imageUrl: composerImageUrl }))
      }
      if (error) throw error
      setComposer(null)
      loadDeck()
    } catch (err) {
      console.error('handleComposerSave:', err)
      setComposerError(err?.message || 'failed to save — please try again')
    }
  }

  async function handleDeleteCard(id) {
    if (!state.userId) { console.error('[handleDeleteCard] called without userId — session may be invalid'); navigate('/signin'); return }
    await deleteNoteDeckCard(id)
    loadDeck()
  }

  const [journalEntry, setJournalEntry] = useState('')
  const debounceRef = useRef(null)
  const journalRef = useRef(null)

  useEffect(() => {
    if (!state.userId) { console.error('[loadJournalEntry] called without userId — session may be invalid'); return }
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
      saveJournalEntry(state.userId, today, val)
    }, 1500)
  }

  function handleInsertTimestamp() {
    const now = new Date()
    const h = now.getHours() % 12 || 12
    const m = String(now.getMinutes()).padStart(2, '0')
    const ampm = now.getHours() < 12 ? 'am' : 'pm'
    const stamp = '[' + h + ':' + m + ampm + ']'
    const insertion = journalEntry.length === 0 ? `${stamp} ` : `\n\n${stamp} `
    const newValue = journalEntry + insertion
    handleJournalChange({ target: { value: newValue } })
    setTimeout(() => {
      if (journalRef.current) {
        journalRef.current.focus()
        journalRef.current.selectionStart = journalRef.current.selectionEnd = newValue.length
      }
    }, 0)
  }

  const [debriefExpanded, setDebriefExpanded] = useState(false)
  const [peakExpanded, setPeakExpanded] = useState(false)
  const [debriefTypes, setDebriefTypes] = useState({ nature: [], environment: [], peak: [] })
  const [todayDebriefCount, setTodayDebriefCount] = useState(0)
  const [todayPeakCount, setTodayPeakCount] = useState(0)

  useEffect(() => {
    if (!state.userId) { console.error('[loadDebriefTypes] called without userId — session may be invalid'); return }
    loadDebriefTypes(state.userId).then(setDebriefTypes)
  }, [state.userId])

  useEffect(() => {
    if (!state.userId) { console.error('[loadDebriefs] called without userId — session may be invalid'); return }
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

  // Sync mood selections and notes from the server after restoreFromSupabase loads.
  // Only fills empty slots — never overwrites live user input.
  useEffect(() => {
    const todayMoodsNow = (state.moods || []).filter(m => m.date_key === today)
    if (!todayMoodsNow.length) return
    setMoodSelections(prev => {
      const next = { ...prev }
      todayMoodsNow.forEach(m => { if (!next[m.prompt_time]) next[m.prompt_time] = m.mood })
      return next
    })
    setMoodNotes(prev => {
      const next = { ...prev }
      todayMoodsNow.forEach(m => { if (!next[m.prompt_time] && m.note) next[m.prompt_time] = m.note })
      return next
    })
  }, [state.moods])

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
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.dateLabel}>{dateLabel}</div>
            <div className={styles.greeting}>good {hour()}.</div>
          </div>
          <div className={styles.headerRight}>
            <canvas ref={pieRef} width={44} height={44} className={styles.pieCanvas} />
            <div className={styles.pieLabel}>{formatScore(currentScore)} of {formatScore(maxScore)}</div>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className={styles.list}>

        {/* ── Note to self deck ── */}
        {state.showNoteToSelf && (
          <div className={styles.reflectiveSection}>
            <div className={styles.noteDeckSection}>
              {noteDeck.length > 0 ? (
                <>
                  <div
                    className={styles.noteDeckWrapper}
                    style={deckHeight ? { height: deckHeight } : undefined}
                    ref={deckWrapperRef}
                    onScroll={handleDeckScroll}
                  >
                    {noteDeck.map((card, i) => (
                      <div key={card.id} className={styles.noteDeckCard} ref={el => { cardRefs.current[i] = el }}>
                        <div className={styles.noteDeckEyebrow}>NOTE TO SELF</div>
                        <div className={styles.noteDeckBody}>
                          <span className={styles.noteText}>{card.text}</span>
                          {card.image_url && (
                            <img
                              src={card.image_url}
                              alt=""
                              className={styles.noteThumbnail}
                              onClick={() => setLightboxImage(card.image_url)}
                            />
                          )}
                        </div>
                        <div className={styles.noteDeckFooter}>
                          <div className={styles.noteDeckDots}>
                            {noteDeck.map((_, j) => (
                              <span key={j} className={`${styles.noteDeckDot} ${j === activeCardIndex ? styles.noteDeckDotActive : ''}`} />
                            ))}
                          </div>
                          <button className={styles.notePencilBtn} onClick={openManageDeck}>manage ✎</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {noteDeck.length > 1 && (
                    <div className={styles.noteDeckSwipeHint}>← →</div>
                  )}
                </>
              ) : (
                <div className={styles.noteDeckCard}>
                  <div className={styles.noteDeckEyebrow}>NOTE TO SELF</div>
                  <div className={styles.noteDeckBody}>
                    <span className={styles.noteEmpty}>no notes yet</span>
                  </div>
                  <div className={styles.noteDeckFooter}>
                    <span />
                    <button className={styles.notePencilBtn} onClick={openManageDeck}>manage ✎</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
            <button className={styles.journalTimestampBtn} onClick={handleInsertTimestamp}>⏱</button>
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

      {manageDeckOpen && (
        <div className={styles.noteOverlay}>
          <div className={styles.noteOverlayHeader}>
            <div className={styles.noteOverlayTitle}>{composer ? (composer.id ? 'edit note' : 'new note') : 'manage deck'}</div>
            <button
              className={styles.noteOverlayClose}
              onClick={() => { if (composer) setComposer(null); else setManageDeckOpen(false) }}
            >
              ×
            </button>
          </div>
          <div className={styles.noteOverlayContent}>
            {composer ? (
              <>
                <div className={styles.noteSectionLabel}>WRITE YOUR OWN</div>
                <textarea
                  className={styles.noteTextarea}
                  value={composerText}
                  onChange={e => setComposerText(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="what does your future self need to remember?"
                  rows={3}
                />
                <div className={styles.noteCharCount}>{NOTE_MAX_LENGTH - composerText.length} characters remaining</div>

                <div className={styles.noteSectionLabel}>IMAGE</div>
                {composerImageUrl ? (
                  <div className={styles.composerImageRow}>
                    <img
                      src={composerImageUrl}
                      alt=""
                      className={styles.noteThumbnail}
                      onClick={() => setLightboxImage(composerImageUrl)}
                    />
                    <button className={styles.composerImageRemove} onClick={() => setComposerImageUrl(null)}>remove image</button>
                  </div>
                ) : (
                  <button
                    className={styles.composerAddImageBtn}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={composerUploading}
                  >
                    {composerUploading ? 'uploading…' : '+ add image'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleComposerImageSelect}
                />

                <div className={styles.noteSectionLabel}>OR CHOOSE FROM THE LIBRARY</div>
                <div className={styles.noteLibraryList}>
                  {NOTE_LIBRARY.map((text, i) => (
                    <div key={i} className={styles.noteCard} onClick={() => setComposerText(text)}>
                      {text}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button className={styles.addDeckCardBtn} onClick={openComposerForNew}>+ add note</button>
                {noteDeck.length > 0 && (
                  <div className={styles.noteLibraryList}>
                    {noteDeck.map(card => (
                      <div key={card.id} className={styles.deckListRow}>
                        {card.image_url && (
                          <img
                            src={card.image_url}
                            alt=""
                            className={styles.noteThumbnail}
                            onClick={e => { e.stopPropagation(); setLightboxImage(card.image_url) }}
                          />
                        )}
                        <span className={styles.deckListText} onClick={() => openComposerForEdit(card)}>{card.text}</span>
                        <button className={styles.deckListDelete} onClick={() => handleDeleteCard(card.id)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {composer && (
            <div className={styles.noteOverlayFooter}>
              {composerError && <div className={styles.composerError}>{composerError}</div>}
              <button className={styles.noteSaveBtn} onClick={handleComposerSave} disabled={!composerText.trim()}>
                save note →
              </button>
            </div>
          )}
        </div>
      )}

      {lightboxImage && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxImage(null)}>×</button>
          <img src={lightboxImage} alt="" className={styles.lightboxImage} onClick={e => e.stopPropagation()} />
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
