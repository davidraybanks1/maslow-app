import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NEEDS, MODES, MODE_ORDER, MODE_MAX_BUBBLES, MODE_WEIGHTS } from '../lib/constants'
import { todayKey, loadJournalEntry, saveJournalEntry, loadDebriefTypes, loadDebriefs, loadNoteDeck, addNoteDeckCard, updateNoteDeckCard, deleteNoteDeckCard, uploadNoteImage, reorderNoteDeck, loadNoteHistory } from '../lib/store'
import { createDataStats, getCanvasGuidance } from '../lib/dataStats'
import { hapticTick } from '../lib/native'
import DebriefForm from '../components/DebriefForm'
import PeakDebriefForm from '../components/PeakDebriefForm'
import styles from './Today.module.css'

function SortableDeckRow({ card, onEdit, onDelete, onLightbox }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={styles.deckListRow}
    >
      <span className={styles.deckListHandle} {...attributes} {...listeners}>⠿</span>
      {card.image_url && (
        <img
          src={card.image_url}
          alt=""
          className={styles.noteThumbnail}
          onClick={e => { e.stopPropagation(); onLightbox(card.image_url) }}
        />
      )}
      <span className={styles.deckListText} onClick={() => onEdit(card)}>{card.text}</span>
      <button className={styles.deckListDelete} onClick={() => onDelete(card.id)}>×</button>
    </div>
  )
}

const MOOD_PERIODS = ['morning', 'midday', 'evening']
const MOODS = ['good', 'fine', 'bad']
const MOOD_SELECTED_CLASS = { good: 'moodBtnGood', fine: 'moodBtnFine', bad: 'moodBtnBad' }

const JOURNAL_DRAFT_PREFIX = 'journal-draft-'
function journalDraftKey(dateKey) { return `${JOURNAL_DRAFT_PREFIX}${dateKey}` }

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

// Quiet streak-milestone greetings — copy only, shown for that one day.
const STREAK_LINES = {
  7: 'one week of showing up.',
  14: 'two weeks of showing up.',
  21: 'three weeks of showing up.',
  30: 'a month of showing up.',
  60: 'two months of showing up.',
  100: '100 days of showing up.',
  365: 'a year of showing up.',
}

export default function Today({ state, checkIn, removeCheckin, logMood }) {
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
    const completions = checked.filter(e => e.need_id === n.id).length
    const filled = Math.min(completions, maxBubbles)
    const bonus = Math.max(0, completions - maxBubbles)
    currentScore += filled * weight + bonus * 0.5
  }
  const piePct = maxScore > 0 ? currentScore / maxScore : 0

  // Space-owned bar: today's practices claim colored space from anxiety's black.
  // Unweighted practice counts (capped per need) so the bar reads as literal space.
  const spaceByMode = {}
  let spaceMax = 0
  let spaceDoneCount = 0
  for (const n of NEEDS) {
    const mode = state.canvas[n.id]
    if (!mode) continue
    const maxBubbles = MODE_MAX_BUBBLES[mode] || 0
    spaceMax += maxBubbles
    const filled = Math.min(checked.filter(e => e.need_id === n.id).length, maxBubbles)
    if (filled > 0) spaceByMode[mode] = (spaceByMode[mode] || 0) + filled
    spaceDoneCount += filled
  }
  const spaceLeft = Math.max(0, spaceMax - spaceDoneCount)
  const spaceComplete = spaceMax > 0 && spaceLeft === 0
  const spacePct = spaceMax > 0 ? Math.round((spaceDoneCount / spaceMax) * 100) : 0

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
  const [deckLoaded, setDeckLoaded] = useState(state.noteDeck != null && state.noteDeck !== undefined)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [deckHeight, setDeckHeight] = useState(undefined)
  const deckWrapperRef = useRef(null)
  const cardRefs = useRef([])

  const [lightboxImage, setLightboxImage] = useState(null)
  const [manageDeckOpen, setManageDeckOpen] = useState(false)
  const [manageDeckClosing, setManageDeckClosing] = useState(false)
  const [composer, setComposer] = useState(null) // null = list view; {} = new card; {id,text,image_url} = editing
  const [noteHistory, setNoteHistory] = useState([])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
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
  useEffect(() => {
    setNoteDeck(state.noteDeck || [])
    setDeckLoaded(true)
  }, [state.noteDeck])

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
    setManageDeckClosing(false)
    setComposer(null)
    if (state.userId) loadNoteHistory(state.userId).then(setNoteHistory)
  }

  function closeManageDeck() {
    setManageDeckClosing(true)
    setTimeout(() => { setManageDeckOpen(false); setManageDeckClosing(false) }, 200)
  }

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = noteDeck.findIndex(c => c.id === active.id)
    const newIndex = noteDeck.findIndex(c => c.id === over.id)
    const previousDeck = noteDeck
    const reordered = arrayMove(noteDeck, oldIndex, newIndex)
    setNoteDeck(reordered)
    reorderNoteDeck(reordered).catch(err => {
      console.error('[handleDragEnd] reorder failed — reverting', err)
      setNoteDeck(previousDeck)
    })
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
        ;({ error } = await updateNoteDeckCard(composer.id, { text, imageUrl: composerImageUrl, userId: state.userId, previousText: composer.text }))
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
    const card = noteDeck.find(c => c.id === id)
    await deleteNoteDeckCard(id, state.userId, card?.text)
    loadDeck()
  }

  const [journalEntry, setJournalEntry] = useState('')
  const [journalSaveError, setJournalSaveError] = useState(null)
  const debounceRef = useRef(null)
  const journalRef = useRef(null)
  const journalUserIdRef = useRef(state.userId)
  const journalTextRef = useRef('')   // always holds latest text for event listeners
  const journalDateRef = useRef(today)
  useEffect(() => { journalUserIdRef.current = state.userId }, [state.userId])
  useEffect(() => { journalDateRef.current = today }, [today])

  useEffect(() => {
    if (!state.userId) { console.error('[loadJournalEntry] called without userId — session may be invalid'); return }

    // Clean up draft keys from previous days on every load
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(JOURNAL_DRAFT_PREFIX) && key !== journalDraftKey(today)) {
          localStorage.removeItem(key)
        }
      }
    } catch {}

    loadJournalEntry(state.userId, today).then(serverEntry => {
      const localDraft = (() => { try { return localStorage.getItem(journalDraftKey(today)) || '' } catch { return '' } })()
      // Prefer local draft when it has more content than Supabase (unsaved keystrokes survived an exit)
      const entry = localDraft.length > (serverEntry || '').length ? localDraft : (serverEntry || '')
      setJournalEntry(entry)
      journalTextRef.current = entry
      if (localDraft.length > (serverEntry || '').length) {
        // Flush recovered draft to Supabase now so it isn't lost again
        saveJournalEntry(state.userId, today, localDraft)
      }
      setTimeout(() => {
        if (journalRef.current && entry) {
          journalRef.current.style.height = 'auto'
          journalRef.current.style.height = journalRef.current.scrollHeight + 'px'
        }
      }, 50)
    })
  }, [state.userId, today])

  // Flush the pending debounce when the page is hidden (PWA backgrounded / tab switched / closed).
  // visibilitychange is the only event that fires reliably on mobile; beforeunload/pagehide do not.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'hidden') return
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
      const uid = journalUserIdRef.current
      if (uid) saveJournalEntry(uid, journalDateRef.current, journalTextRef.current)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, []) // empty — reads only from refs

  function handleJournalChange(e) {
    const val = e.target.value
    setJournalEntry(val)
    journalTextRef.current = val
    // Synchronous local backup — survives any exit before the debounce fires
    try { localStorage.setItem(journalDraftKey(today), val) } catch {}
    if (journalRef.current) {
      journalRef.current.style.height = 'auto'
      journalRef.current.style.height = journalRef.current.scrollHeight + 'px'
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const uid = journalUserIdRef.current
      if (!uid) {
        console.error('[saveJournalEntry] no userId at save time — entry not persisted')
        setJournalSaveError('session error — entry saved locally, will sync on next open')
        return
      }
      saveJournalEntry(uid, today, val).then(({ error }) => {
        if (error) setJournalSaveError('save failed — entry preserved locally')
        else setJournalSaveError(null)
      })
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

  // Rows with a saved note start expanded; others start collapsed
  const [expandedNoteRows, setExpandedNoteRows] = useState(() => {
    const set = new Set()
    todayMoods.forEach(m => { if (m.note) set.add(m.prompt_time) })
    return set
  })
  const moodNoteRefs = useRef({})

  function toggleNoteRow(period) {
    setExpandedNoteRows(prev => {
      const next = new Set(prev)
      if (next.has(period)) {
        next.delete(period)
      } else {
        next.add(period)
        // auto-focus on next tick
        setTimeout(() => moodNoteRefs.current[period]?.focus(), 0)
      }
      return next
    })
  }

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
    // Expand rows that have saved notes
    setExpandedNoteRows(prev => {
      const next = new Set(prev)
      todayMoodsNow.forEach(m => { if (m.note) next.add(m.prompt_time) })
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
      setMoodNotes(prev => ({ ...prev, [promptTime]: '' }))
    }
  }

  function handleNoteBlur(promptTime) {
    if (!moodSelections[promptTime] || !logMood) return
    logMood(state.userId, promptTime, moodSelections[promptTime], moodNotes[promptTime] || null, today)
  }

  function handleChipClick(needId, mode, practiceText) {
    hapticTick()
    checkIn(needId, practiceText, mode)
  }

  function handleBubbleRemove(needId) {
    removeCheckin(needId)
  }

  return (
    <div className={styles.screen}>

      {/* ── Greeting ── */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.dateLabel}>{dateLabel}</div>
            <div className={styles.greeting}>good {hour()}.</div>
            {STREAK_LINES[streak] && <div className={styles.milestoneLine}>{STREAK_LINES[streak]}</div>}
          </div>
          <div className={styles.headerRight}>
            <div className={styles.spacePct}>{spacePct}%</div>
            <div className={styles.pieLabel}>space owned</div>
          </div>
        </div>
        {spaceMax > 0 && (
          <div
            className={`${styles.spaceBar} ${spaceComplete ? styles.spaceBarComplete : ''}`}
            aria-label={`space owned: ${spaceDoneCount} of ${spaceMax} practices`}
          >
            {MODE_ORDER.map(mode =>
              spaceByMode[mode] > 0 ? (
                <span key={mode} className={styles.spaceSeg} style={{ flexGrow: spaceByMode[mode], background: `var(--${mode})` }} />
              ) : null
            )}
            {spaceLeft > 0 && <span className={`${styles.spaceSeg} ${styles.spaceSegAnxiety}`} style={{ flexGrow: spaceLeft }} />}
          </div>
        )}
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
                </>
              ) : deckLoaded ? (
                <div className={styles.noteDeckCard}>
                  <div className={styles.noteDeckEyebrow}>NOTE TO SELF</div>
                  <div className={styles.noteDeckBody}>
                    <span className={styles.noteEmpty}>no notes yet — tap manage to add one</span>
                  </div>
                  <div className={styles.noteDeckFooter}>
                    <span />
                    <button className={styles.notePencilBtn} onClick={openManageDeck}>manage ✎</button>
                  </div>
                </div>
              ) : (
                <div className={styles.noteDeckCard}>
                  <div className={styles.noteDeckEyebrow}>NOTE TO SELF</div>
                  <div className={styles.noteDeckBody}>
                    <span className={styles.noteEmpty}>—</span>
                  </div>
                  <div className={styles.noteDeckFooter}><span /></div>
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
                  {expandedNoteRows.has(period) ? (
                    <input
                      ref={el => { moodNoteRefs.current[period] = el }}
                      className={styles.moodNote}
                      placeholder="add a note…"
                      value={moodNotes[period] || ''}
                      onChange={e => setMoodNotes(prev => ({ ...prev, [period]: e.target.value }))}
                      onBlur={() => {
                        handleNoteBlur(period)
                        // Collapse if still empty after blur
                        if (!moodNotes[period]?.trim()) {
                          setExpandedNoteRows(prev => { const n = new Set(prev); n.delete(period); return n })
                        }
                      }}
                    />
                  ) : (
                    <button className={styles.moodNoteToggle} onClick={() => toggleNoteRow(period)}>
                      + note
                    </button>
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
                  const checkedForNeed = checked.filter(e => e.need_id === n.id)
                  const completions = checkedForNeed.length
                  const filledBubbles = Math.min(completions, maxBubbles)
                  const bonusBubbles = Math.max(0, completions - maxBubbles)

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
                                ? { background: pip, border: `1.5px solid ${pip}`, cursor: i === filledBubbles - 1 && bonusBubbles === 0 ? 'pointer' : undefined }
                                : { background: 'transparent', border: `1.5px solid ${pip}` }
                              }
                              onClick={i < filledBubbles ? () => handleBubbleRemove(n.id) : undefined}
                            />
                          ))}
                          {Array.from({ length: bonusBubbles }).map((_, i) => (
                            <div
                              key={`bonus-${i}`}
                              className={styles.bubbleBonus}
                              style={{ border: `1.5px dashed ${pip}` }}
                              onClick={() => handleBubbleRemove(n.id)}
                            />
                          ))}
                        </div>
                      </div>
                      {pool.length === 0 ? (
                        <div className={styles.noPractice}>No practices set — add some <span className={styles.noPracticeLink} onClick={() => navigate('/practices')}>in Practices</span></div>
                      ) : (
                        <div className={styles.chipRow}>
                          {pool.map(p => {
                            const isDone = checkedForNeed.some(e => e.practice_text === p)
                            return (
                              <button
                                key={p}
                                className={isDone ? styles.practiceChipDone : styles.practiceChip}
                                style={isDone ? {
                                  background: pip,
                                  color: (mode === 'appreciation' || mode === 'nourishment') ? 'var(--ink)' : '#fff'
                                } : {}}
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
          {journalSaveError && <div className={styles.journalSaveError}>{journalSaveError}</div>}

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
        <div className={`${styles.noteOverlay} ${manageDeckClosing ? styles.noteOverlayClosing : ''}`}>
          <div className={styles.noteOverlayHeader}>
            <div className={styles.noteOverlayTitle}>{composer ? (composer.id ? 'edit note' : 'new note') : 'manage deck'}</div>
            <button
              className={styles.noteOverlayClose}
              onClick={() => { if (composer) setComposer(null); else closeManageDeck() }}
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

                <div className={styles.noteSectionLabel}>FROM THE LIBRARY</div>
                <div className={styles.noteLibraryList}>
                  {NOTE_LIBRARY.map((text, i) => (
                    <div key={i} className={styles.noteCard} onClick={() => setComposerText(text)}>
                      {text}
                    </div>
                  ))}
                </div>

                {noteHistory.length > 0 && (
                  <>
                    <div className={styles.noteSectionLabel}>FROM YOUR HISTORY</div>
                    <div className={styles.noteLibraryList}>
                      {noteHistory.map((item, i) => (
                        <div key={i} className={styles.noteHistoryCard} onClick={() => setComposerText(item.text)}>
                          <span className={styles.noteHistoryText}>{item.text}</span>
                          <span className={styles.noteHistoryDate}>{item.date}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

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
              </>
            ) : (
              <>
                <button className={styles.addDeckCardBtn} onClick={openComposerForNew}>+ add note</button>
                {noteDeck.length > 0 && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={noteDeck.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <div className={styles.noteLibraryList}>
                        {noteDeck.map(card => (
                          <SortableDeckRow
                            key={card.id}
                            card={card}
                            onEdit={openComposerForEdit}
                            onDelete={handleDeleteCard}
                            onLightbox={setLightboxImage}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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
