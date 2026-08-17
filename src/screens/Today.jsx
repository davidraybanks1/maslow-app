import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NEEDS, MODES, MODE_ORDER, MODE_MAX_BUBBLES, MODE_WEIGHTS } from '../lib/constants'
import { currentSlot, precedingSlots, SLOT_NOUN } from '../lib/slots'
import { todayKey, loadJournalEntries, addJournalEntry, deleteJournalEntry, loadDebriefTypes, loadDebriefs, loadNoteDeck, addNoteDeckCard, updateNoteDeckCard, deleteNoteDeckCard, uploadNoteImage, reorderNoteDeck, loadNoteHistory } from '../lib/store'
import { BUILTIN_NATURE_TYPES, BUILTIN_PEAK_TYPES } from '../lib/debriefTypes'
import { createDataStats, getCanvasGuidance } from '../lib/dataStats'
import { hapticTick } from '../lib/native'
import DebriefForm from '../components/DebriefForm'
import PeakDebriefForm from '../components/PeakDebriefForm'
import TimerCard from '../components/TimerCard'
import DesktopModal from '../components/DesktopModal'
import { useIsDesktop } from '../lib/useIsDesktop'
import { useTimer } from '../lib/useTimer'
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

const MOODS = ['good', 'fine', 'bad']

function buildRingGradient(arcs) {
  const stops = []
  for (const { color, startPct, fill, endPct } of arcs) {
    const fillEndPct = startPct + fill * 25
    if (fill > 0) {
      stops.push(`${color} ${startPct.toFixed(2)}%`, `${color} ${fillEndPct.toFixed(2)}%`)
    }
    if (fillEndPct < endPct) {
      stops.push(`var(--track) ${fillEndPct.toFixed(2)}%`, `var(--track) ${endPct.toFixed(2)}%`)
    }
  }
  if (!stops.length) return `conic-gradient(var(--track) 0% 100%)`
  return `conic-gradient(from -90deg, ${stops.join(', ')})`
}

function CompletionRing({ arcs, pct }) {
  const gradient = buildRingGradient(arcs)
  return (
    <div className={styles.ring} style={{ background: gradient }} aria-label={`${pct}% complete today`} role="img">
      <div className={styles.ringInner}>
        <span className={styles.ringPct}>{pct}<span className={styles.ringPctSign}>%</span></span>
      </div>
    </div>
  )
}

function formatEntryTime(ts) {
  const d = new Date(ts)
  const h = d.getHours() % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() < 12 ? 'am' : 'pm'
  return `${h}:${m}${ampm}`
}

function entryStateStyle(name) {
  const nature = BUILTIN_NATURE_TYPES.find(t => t.name === name)
  if (nature) return { background: nature.bg, color: nature.text }
  const peak = BUILTIN_PEAK_TYPES.find(t => t.name === name)
  if (peak) return { background: peak.bg, color: peak.text }
  return { background: '#9A9690', color: '#fff' }
}

const NOTE_MAX_LENGTH = 120
const DECK_MAX = 5
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

// Split journal text at [H:MMam/pm] markers so they can be styled separately.
const TIMESTAMP_RE = /(\[\d{1,2}:\d{2}(?:am|pm)\])/g
function parseJournalEntry(text, timestampClass) {
  return text.split(TIMESTAMP_RE).map((part, i) =>
    /^\[\d{1,2}:\d{2}(?:am|pm)\]$/.test(part)
      ? <span key={i} className={timestampClass}>{part}</span>
      : part
  )
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

export default function Today({ state, checkIn, removeCheckin, clearPracticeCheckins, incrementCheckinCount, logMood }) {
  const navigate = useNavigate()
  const today = todayKey()
  const checked = state.checkins[today] || []
  const slot = currentSlot()

  // Completion ring: each mode gets 1/4 of the ring, filled proportionally
  const ringArcs = []
  let totalRingFraction = 0
  for (let i = 0; i < MODE_ORDER.length; i++) {
    const mode = MODE_ORDER[i]
    const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
    const maxBubbles = MODE_MAX_BUBBLES[mode] || 0
    const modeTarget = maxBubbles * modeNeeds.length
    let modeCompletions = 0
    for (const n of modeNeeds) {
      modeCompletions += Math.min(
        checked.filter(e => e.need_id === n.id).reduce((s, e) => s + (e.count || 1), 0),
        maxBubbles
      )
    }
    const fill = modeTarget > 0 ? Math.min(modeCompletions / modeTarget, 1) : 0
    ringArcs.push({ mode, color: MODES[mode].pip, startPct: i * 25, fill, endPct: (i + 1) * 25 })
    totalRingFraction += fill / 4
  }
  const ringPct = Math.round(totalRingFraction * 100)

  // Space-owned: kept for Data/Log screens (not shown on Today any more)
  const spaceByMode = {}
  let spaceMax = 0
  let spaceDoneCount = 0
  for (const n of NEEDS) {
    const mode = state.canvas[n.id]
    if (!mode) continue
    const maxBubbles = MODE_MAX_BUBBLES[mode] || 0
    spaceMax += maxBubbles
    const filled = Math.min(checked.filter(e => e.need_id === n.id).reduce((s, e) => s + (e.count || 1), 0), maxBubbles)
    if (filled > 0) spaceByMode[mode] = (spaceByMode[mode] || 0) + filled
    spaceDoneCount += filled
  }
  const spaceLeft = Math.max(0, spaceMax - spaceDoneCount)

  const todayMoods = (state.moods || []).filter(m => m.date_key === today)
  const stats = createDataStats({ canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [], practices: state.practices || {}, practicesDB: state.practicesDB || [] })
  const streak = stats.getStreak()
  const lastDoneMap = new Map(
    stats.getPracticeStats().map(p => [
      p.practice?.id || `${p.need.id}_${p.text}`,
      p.daysSinceLast,
    ])
  )
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
    if (!composer?.id && noteDeck.length >= DECK_MAX) {
      setComposerError('deck is full — remove a card to add another')
      return
    }
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

  const [journalEntries, setJournalEntries] = useState([])
  const [journalSaveError, setJournalSaveError] = useState(null)
  const [draftText, setDraftText] = useState('')
  const [draftNeedId, setDraftNeedId] = useState(null)
  const [draftState, setDraftState] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [needPickerOpen, setNeedPickerOpen] = useState(false)
  const [statePickerOpen, setStatePickerOpen] = useState(false)
  const journalEntriesRef = useRef(null)

  useEffect(() => {
    if (!state.userId) return
    loadJournalEntries(state.userId, today).then(setJournalEntries)
  }, [state.userId, today])

  async function handleAddEntry() {
    const text = draftText.trim()
    if (!text || !state.userId) return
    const { data, error } = await addJournalEntry(state.userId, today, {
      entry: text,
      slot: currentSlot(),
      needId: draftNeedId,
      state: draftState,
    })
    if (error) { setJournalSaveError('save failed — try again'); return }
    setJournalEntries(prev => [...prev, data])
    setDraftText('')
    setDraftNeedId(null)
    setDraftState(null)
    setJournalSaveError(null)
    setNeedPickerOpen(false)
    setStatePickerOpen(false)
  }

  function handleComposerKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleAddEntry()
    }
  }

  async function handleDeleteEntry(id) {
    setJournalEntries(prev => prev.filter(e => e.id !== id))
    await deleteJournalEntry(id)
  }

  const isDesktop = useIsDesktop()
  const timerState = useTimer()
  const [debriefExpanded, setDebriefExpanded] = useState(false)
  const [peakExpanded, setPeakExpanded] = useState(false)
  const [debriefDirty, setDebriefDirty] = useState(false)
  const [peakDirty, setPeakDirty] = useState(false)
  const [debriefTypes, setDebriefTypes] = useState({ nature: [], environment: [], peak: [] })

  function handleDebriefClose() { setDebriefExpanded(false); setDebriefDirty(false) }
  function handleDebriefDismiss() {
    if (debriefDirty && !window.confirm('Discard your debrief?')) return
    setDebriefExpanded(false); setDebriefDirty(false)
  }
  function handlePeakClose() { setPeakExpanded(false); setPeakDirty(false) }
  function handlePeakDismiss() {
    if (peakDirty && !window.confirm('Discard your peak debrief?')) return
    setPeakExpanded(false); setPeakDirty(false)
  }
  const [todayDebriefCount, setTodayDebriefCount] = useState(0)
  const [todayPeakCount, setTodayPeakCount] = useState(0)
  const [justTapped, setJustTapped] = useState(null)
  const [openTier, setOpenTier] = useState('survival')
  const [openRetroSlot, setOpenRetroSlot] = useState(null)

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

  function handlePracticeTap(needId, mode, practiceText, practiceId) {
    hapticTick()
    function matchEntry(e) {
      if (e.need_id !== needId) return false
      if (practiceId && e.practice_id) return e.practice_id === practiceId
      return e.practice_text === practiceText
    }
    const practiceEntries = checked.filter(matchEntry)
    const totalCount = practiceEntries.reduce((s, e) => s + (e.count || 1), 0)
    const practiceKey = practiceId || `${needId}_${practiceText}`
    if (totalCount === 0) {
      checkIn(needId, practiceText, mode, undefined, practiceId)
      setJustTapped(practiceKey)
    } else if (totalCount === 1) {
      const entry = practiceEntries[practiceEntries.length - 1]
      incrementCheckinCount(entry.id)
      setJustTapped(practiceKey)
    } else {
      clearPracticeCheckins(needId, practiceText)
      setJustTapped(null)
    }
  }

  const journalEntryCount = journalEntries.length
  const activeNeeds = NEEDS.filter(n => state.canvas[n.id])

  useEffect(() => {
    if (isDesktop && journalEntriesRef.current) {
      journalEntriesRef.current.scrollTop = journalEntriesRef.current.scrollHeight
    }
  }, [journalEntries, isDesktop])

  return (
    <div className={styles.screen}>
    <div className={styles.desktopWrap}>

      {/* ── Greeting ── */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.dateLabel}>{dateLabel}</div>
            <div className={styles.greeting}>good {slot}.</div>
            {STREAK_LINES[streak] && <div className={styles.milestoneLine}>{STREAK_LINES[streak]}</div>}
          </div>
          <div className={styles.headerRight}>
            <CompletionRing arcs={ringArcs} pct={ringPct} />
          </div>
        </div>
      </div>

      {/* ── Scrollable / grid body ── */}
      <div className={styles.list}>
        <div className={styles.colLeft}>

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
                          <span className={styles.noteDeckCounter}>{activeCardIndex + 1}/{noteDeck.length}</span>
                          <button className={styles.noteEditPill} onClick={openManageDeck}>edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : deckLoaded ? (
                <div className={styles.noteDeckCard}>
                  <div className={styles.noteDeckEyebrow}>NOTE TO SELF</div>
                  <div className={styles.noteDeckBody}>
                    <span className={styles.noteEmpty}>no notes yet — tap edit to add one</span>
                  </div>
                  <div className={styles.noteDeckFooter}>
                    <span />
                    <button className={styles.noteEditPill} onClick={openManageDeck}>edit</button>
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

        {/* ── Timer card ── */}
        <div className={styles.timerSlot}>
          <TimerCard {...timerState} />
        </div>

        {/* ── Guidance ── */}
        <div className={styles.guidanceSlot}>
          {showGuidance && <GuidanceCard type={guidanceType} onDismiss={handleDismissGuidance} />}
        </div>

        {/* ── Mood card ── */}
        <div className={`${styles.card} ${styles.moodCard}`}>
          {/* Preceding slot pips */}
          {precedingSlots(slot).length > 0 && (
            <div className={styles.moodPips}>
              {precedingSlots(slot).map(prevSlot => (
                <div key={prevSlot}>
                  <button
                    className={styles.moodPip}
                    aria-expanded={openRetroSlot === prevSlot}
                    onClick={() => setOpenRetroSlot(o => o === prevSlot ? null : prevSlot)}
                  >
                    <span className={`${styles.moodPipDot} ${moodSelections[prevSlot] ? styles.moodPipDotFilled : ''}`} />
                    <span className={styles.moodPipLabel}>{SLOT_NOUN[prevSlot]}</span>
                  </button>
                  {openRetroSlot === prevSlot && (
                    <div className={styles.retroRow}>
                      <div className={styles.retroQ}>how was the {SLOT_NOUN[prevSlot]}?</div>
                      <div className={styles.moodCircles}>
                        {MOODS.map(mood => (
                          <button
                            key={mood}
                            className={`${styles.moodCircle} ${styles.moodCircleSm} ${moodSelections[prevSlot] === mood ? styles.moodCircleSelected : ''}`}
                            onClick={() => { handleMoodSelect(prevSlot, mood); setOpenRetroSlot(null) }}
                          >{mood}</button>
                        ))}
                      </div>
                      {moodSelections[prevSlot] && expandedNoteRows.has(prevSlot) && (
                        <textarea
                          ref={el => { moodNoteRefs.current[prevSlot] = el }}
                          className={styles.moodNote}
                          placeholder={`what made it ${moodSelections[prevSlot]}?`}
                          value={moodNotes[prevSlot] || ''}
                          onChange={e => setMoodNotes(prev => ({ ...prev, [prevSlot]: e.target.value }))}
                          onBlur={() => { handleNoteBlur(prevSlot); if (!moodNotes[prevSlot]?.trim()) setExpandedNoteRows(prev => { const n = new Set(prev); n.delete(prevSlot); return n }) }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Current slot */}
          <div className={styles.moodQuestion}>how's the {SLOT_NOUN[slot]}?</div>
          <div className={styles.moodCircles}>
            {MOODS.map(mood => (
              <button
                key={mood}
                className={`${styles.moodCircle} ${moodSelections[slot] === mood ? styles.moodCircleSelected : ''}`}
                onClick={() => handleMoodSelect(slot, mood)}
              >{mood}</button>
            ))}
          </div>
          {moodSelections[slot] && !expandedNoteRows.has(slot) && (
            <button className={styles.moodNoteAffordance} onClick={() => toggleNoteRow(slot)}>
              — add a note about your mood
            </button>
          )}
          {expandedNoteRows.has(slot) && (
            <textarea
              ref={el => { moodNoteRefs.current[slot] = el }}
              className={styles.moodNote}
              placeholder={`what made it ${moodSelections[slot] || ''}?`}
              value={moodNotes[slot] || ''}
              onChange={e => setMoodNotes(prev => ({ ...prev, [slot]: e.target.value }))}
              onBlur={() => { handleNoteBlur(slot); if (!moodNotes[slot]?.trim()) setExpandedNoteRows(prev => { const n = new Set(prev); n.delete(slot); return n }) }}
            />
          )}
        </div>

        {/* ── Needs & Practices ── */}
        <div className={styles.practicesCard}>
          <div className={styles.tierSectionHeader}>
            <span className={styles.tierSectionLabel}>NEEDS & PRACTICES</span>
            <span className={styles.tierSectionHint}>tap a tier to fill it</span>
          </div>
          <div className={styles.tierList}>
            {[...MODE_ORDER].reverse().map(mode => {
              const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
              if (!modeNeeds.length) return null
              const pip = MODES[mode]?.pip
              const maxBubbles = MODE_MAX_BUBBLES[mode] || 0
              const totalPossible = maxBubbles * modeNeeds.length
              let modeDone = 0
              for (const n of modeNeeds) {
                modeDone += Math.min(
                  checked.filter(e => e.need_id === n.id).reduce((s, e) => s + (e.count || 1), 0),
                  maxBubbles
                )
              }
              const progressPct = totalPossible > 0 ? Math.round((modeDone / totalPossible) * 100) : 0
              const isOpen = openTier === mode

              return (
                <div key={mode} className={`${styles.tier} ${isOpen ? styles.tierOpen : ''}`}>
                  <button
                    className={styles.tierHeader}
                    onClick={() => setOpenTier(prev => prev === mode ? null : mode)}
                    aria-expanded={isOpen}
                  >
                    <div className={styles.tierHeaderTop}>
                      <div className={styles.tierDot} style={{ background: pip }} />
                      <span className={styles.tierName}>{mode}</span>
                      <span className={styles.tierCount}>{modeDone}/{totalPossible}</span>
                    </div>
                    <div className={styles.tierBar}>
                      <div
                        className={styles.tierBarFill}
                        style={{ width: `${progressPct}%`, background: pip }}
                      />
                    </div>
                  </button>

                  <div className={`${styles.tierContent} ${isOpen ? styles.tierContentOpen : ''}`}>
                    <div className={styles.tierContentInner}>
                      {modeNeeds.map(n => {
                        const pool = (state.practicesDB && state.practicesDB.length > 0)
                          ? state.practicesDB.filter(p => p.need_id === n.id && !p.archived_at)
                          : (state.practices[n.id] || []).map(label => ({ id: null, label }))

                        const needDone = Math.min(
                          checked.filter(e => e.need_id === n.id).reduce((s, e) => s + (e.count || 1), 0),
                          maxBubbles
                        )

                        function getPracticeCount(practice) {
                          return checked
                            .filter(e => {
                              if (e.need_id !== n.id) return false
                              if (practice.id && e.practice_id) return e.practice_id === practice.id
                              return e.practice_text === practice.label
                            })
                            .reduce((s, e) => s + (e.count || 1), 0)
                        }

                        const sorted = [...pool].sort((a, b) => getPracticeCount(a) - getPracticeCount(b))

                        return (
                          <div key={n.id} className={styles.needGroup}>
                            <div className={styles.needSubHeader}>
                              <span className={styles.needSubName}>{n.name}</span>
                              <span className={styles.needSubCount}>{needDone}/{maxBubbles}</span>
                            </div>
                            {pool.length === 0 ? (
                              <div className={styles.noPractice}>
                                no practices — <span className={styles.noPracticeLink} onClick={() => navigate('/canvas')}>add some</span>
                              </div>
                            ) : sorted.map(practice => {
                              const practiceKey = practice.id || `${n.id}_${practice.label}`
                              const count = getPracticeCount(practice)
                              const isJustNow = justTapped === practiceKey
                              const lastDays = lastDoneMap.get(practiceKey) ?? null
                              const isX2 = count >= 2

                              const meta = isJustNow
                                ? 'just now'
                                : count >= 1
                                  ? 'today'
                                  : lastDays !== null && lastDays > 0
                                    ? `${lastDays}d ago`
                                    : ''

                              return (
                                <div
                                  key={practiceKey}
                                  className={styles.practiceRow}
                                  onClick={e => { e.stopPropagation(); handlePracticeTap(n.id, mode, practice.label, practice.id) }}
                                >
                                  <div
                                    className={`${styles.practiceCheck} ${count > 0 ? styles.practiceCheckFilled : ''}`}
                                    style={count > 0 ? { background: pip, borderColor: pip } : { borderColor: pip }}
                                  />
                                  <span className={styles.practiceLabel}>{practice.label}</span>
                                  <div className={styles.practiceMeta}>
                                    {isX2 && <span className={styles.practiceX2}>×2</span>}
                                    {meta && <span className={styles.practiceStamp}>{meta}</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        </div>{/* /colLeft */}

        <div className={styles.colRight}>

        {/* ── Journal card (hero on desktop) ── */}
        <div className={styles.cardJournal}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>journal</span>
            <span className={styles.journalEntryCount}>
              {journalEntryCount > 0 ? `${journalEntryCount} ${journalEntryCount === 1 ? 'entry' : 'entries'} today` : ''}
            </span>
          </div>

          {isDesktop ? (
            <div className={styles.journalScroll} ref={journalEntriesRef}>
              <div className={styles.journalEntries}>
                {journalEntries.length === 0 ? (
                  <span className={styles.journalEntriesEmpty}>nothing written yet — start typing below</span>
                ) : journalEntries.map(e => (
                  <div key={e.id} className={styles.journalEntryCard}>
                    <div className={styles.journalEntryMeta}>
                      {e.slot && <span className={styles.journalSlotChip}>{e.slot}</span>}
                      <span className={styles.journalEntryTime}>{formatEntryTime(e.created_at)}</span>
                      {e.state && <span className={styles.journalStateTag} style={entryStateStyle(e.state)}>{e.state}</span>}
                      {e.need_id && <span className={styles.journalNeedTag}>{e.need_id}</span>}
                      <button className={styles.journalEntryDelete} onClick={() => handleDeleteEntry(e.id)} aria-label="delete entry">×</button>
                    </div>
                    <div className={styles.journalEntryText}>{e.entry}</div>
                  </div>
                ))}
              </div>
              <div className={styles.journalComposer}>
                <div className={styles.composerChips}>
                  <span className={styles.composerSlotChip}>{slot}</span>
                  {draftNeedId ? (
                    <button className={styles.composerTagActive} onClick={() => setDraftNeedId(null)}>{draftNeedId} ×</button>
                  ) : (
                    <button className={styles.composerTagBtn} onClick={() => { setNeedPickerOpen(o => !o); setStatePickerOpen(false) }}>+ need</button>
                  )}
                  {draftState ? (
                    <button className={styles.composerTagActive} style={entryStateStyle(draftState)} onClick={() => setDraftState(null)}>{draftState} ×</button>
                  ) : (
                    <button className={styles.composerTagBtn} onClick={() => { setStatePickerOpen(o => !o); setNeedPickerOpen(false) }}>+ state</button>
                  )}
                </div>
                {needPickerOpen && activeNeeds.length > 0 && (
                  <div className={styles.composerPicker}>
                    {activeNeeds.map(n => (
                      <button key={n.id} className={styles.composerPickerItem} onClick={() => { setDraftNeedId(n.id); setNeedPickerOpen(false) }}>{n.name}</button>
                    ))}
                  </div>
                )}
                {statePickerOpen && (
                  <div className={styles.composerPicker}>
                    {[...BUILTIN_NATURE_TYPES, ...BUILTIN_PEAK_TYPES].map(t => (
                      <button key={t.name} className={styles.composerPickerItem} style={{ background: t.bg, color: t.text }} onClick={() => { setDraftState(t.name); setStatePickerOpen(false) }}>{t.name}</button>
                    ))}
                  </div>
                )}
                <div className={styles.journalComposerWrap}>
                  <textarea
                    className={styles.journalComposerInput}
                    placeholder="add a thought…"
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={3}
                  />
                  <div className={styles.journalComposerFooter}>
                    <span className={styles.journalHint}>⌘↵</span>
                    <button className={styles.journalAddBtn} onClick={handleAddEntry} disabled={!draftText.trim()}>add</button>
                  </div>
                </div>
                {journalSaveError && <div className={styles.journalSaveError}>{journalSaveError}</div>}
              </div>
              <div className={styles.debriefPillRow}>
                <button className={`${styles.debriefPill} ${debriefExpanded ? styles.debriefPillOpen : ''}`} onClick={() => { setDebriefExpanded(e => !e); setPeakExpanded(false) }}>
                  {todayDebriefCount > 0 && <span className={styles.debriefDot} />}
                  <span>anxiety debrief</span>
                  {todayDebriefCount > 0 && <span className={styles.debriefCount}>· {todayDebriefCount}</span>}
                </button>
                <button className={`${styles.debriefPill} ${peakExpanded ? styles.debriefPillOpen : ''}`} onClick={() => { setPeakExpanded(e => !e); setDebriefExpanded(false) }}>
                  {todayPeakCount > 0 && <span className={styles.debriefDot} />}
                  <span>peak debrief</span>
                  {todayPeakCount > 0 && <span className={styles.debriefCount}>· {todayPeakCount}</span>}
                </button>
              </div>
            </div>
          ) : (
            <>
              {journalEntries.length > 0 && (
                <div className={styles.journalMobileEntries}>
                  {journalEntries.map(e => (
                    <div key={e.id} className={styles.journalEntryCard}>
                      <div className={styles.journalEntryMeta}>
                        {e.slot && <span className={styles.journalSlotChip}>{e.slot}</span>}
                        <span className={styles.journalEntryTime}>{formatEntryTime(e.created_at)}</span>
                        {e.state && <span className={styles.journalStateTag} style={entryStateStyle(e.state)}>{e.state}</span>}
                        {e.need_id && <span className={styles.journalNeedTag}>{e.need_id}</span>}
                        <button className={styles.journalEntryDelete} onClick={() => handleDeleteEntry(e.id)} aria-label="delete entry">×</button>
                      </div>
                      <div className={styles.journalEntryText}>{e.entry}</div>
                    </div>
                  ))}
                </div>
              )}
              {!composerOpen ? (
                <button className={styles.composerCollapsed} onClick={() => setComposerOpen(true)}>
                  + add a thought…
                </button>
              ) : (
                <div className={styles.journalComposer}>
                  <div className={styles.composerChips}>
                    <span className={styles.composerSlotChip}>{slot}</span>
                    {draftNeedId ? (
                      <button className={styles.composerTagActive} onClick={() => setDraftNeedId(null)}>{draftNeedId} ×</button>
                    ) : (
                      <button className={styles.composerTagBtn} onClick={() => { setNeedPickerOpen(o => !o); setStatePickerOpen(false) }}>+ need</button>
                    )}
                    {draftState ? (
                      <button className={styles.composerTagActive} style={entryStateStyle(draftState)} onClick={() => setDraftState(null)}>{draftState} ×</button>
                    ) : (
                      <button className={styles.composerTagBtn} onClick={() => { setStatePickerOpen(o => !o); setNeedPickerOpen(false) }}>+ state</button>
                    )}
                  </div>
                  {needPickerOpen && activeNeeds.length > 0 && (
                    <div className={styles.composerPicker}>
                      {activeNeeds.map(n => (
                        <button key={n.id} className={styles.composerPickerItem} onClick={() => { setDraftNeedId(n.id); setNeedPickerOpen(false) }}>{n.name}</button>
                      ))}
                    </div>
                  )}
                  {statePickerOpen && (
                    <div className={styles.composerPicker}>
                      {[...BUILTIN_NATURE_TYPES, ...BUILTIN_PEAK_TYPES].map(t => (
                        <button key={t.name} className={styles.composerPickerItem} style={{ background: t.bg, color: t.text }} onClick={() => { setDraftState(t.name); setStatePickerOpen(false) }}>{t.name}</button>
                      ))}
                    </div>
                  )}
                  <textarea
                    autoFocus
                    className={styles.journalInput}
                    placeholder="what's on your mind?"
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={4}
                  />
                  <div className={styles.composerMobileFooter}>
                    <button className={styles.composerCancelBtn} onClick={() => { setComposerOpen(false); setNeedPickerOpen(false); setStatePickerOpen(false) }}>cancel</button>
                    <button className={styles.journalAddBtn} onClick={handleAddEntry} disabled={!draftText.trim()}>add</button>
                  </div>
                  {journalSaveError && <div className={styles.journalSaveError}>{journalSaveError}</div>}
                </div>
              )}
              <div className={styles.debriefPillRow}>
                <button className={`${styles.debriefPill} ${debriefExpanded ? styles.debriefPillOpen : ''}`} onClick={() => { setDebriefExpanded(e => !e); setPeakExpanded(false) }}>
                  {todayDebriefCount > 0 && <span className={styles.debriefDot} />}
                  <span>anxiety debrief</span>
                  {todayDebriefCount > 0 && <span className={styles.debriefCount}>· {todayDebriefCount}</span>}
                </button>
                <button className={`${styles.debriefPill} ${peakExpanded ? styles.debriefPillOpen : ''}`} onClick={() => { setPeakExpanded(e => !e); setDebriefExpanded(false) }}>
                  {todayPeakCount > 0 && <span className={styles.debriefDot} />}
                  <span>peak debrief</span>
                  {todayPeakCount > 0 && <span className={styles.debriefCount}>· {todayPeakCount}</span>}
                </button>
              </div>
              {debriefExpanded && (
                <>
                  <div className={styles.debriefHairline} />
                  <DebriefForm userId={state.userId} debriefTypes={debriefTypes} onDirtyChange={setDebriefDirty} onSaved={() => { setDebriefExpanded(false); setDebriefDirty(false); setTodayDebriefCount(c => c + 1) }} />
                </>
              )}
              {peakExpanded && (
                <>
                  <div className={styles.debriefHairline} />
                  <PeakDebriefForm userId={state.userId} debriefTypes={debriefTypes} onDirtyChange={setPeakDirty} onSaved={() => { setPeakExpanded(false); setPeakDirty(false); setTodayPeakCount(c => c + 1) }} />
                </>
              )}
            </>
          )}
        </div>

        </div>{/* /colRight */}

      </div>
    </div>{/* /desktopWrap */}

      {isDesktop && debriefExpanded && (
        <DesktopModal title="anxiety debrief" onClose={handleDebriefClose} onDismiss={handleDebriefDismiss}>
          <DebriefForm
            userId={state.userId}
            debriefTypes={debriefTypes}
            onDirtyChange={setDebriefDirty}
            onSaved={() => { handleDebriefClose(); setTodayDebriefCount(c => c + 1) }}
          />
        </DesktopModal>
      )}

      {isDesktop && peakExpanded && (
        <DesktopModal title="peak debrief" onClose={handlePeakClose} onDismiss={handlePeakDismiss}>
          <PeakDebriefForm
            userId={state.userId}
            debriefTypes={debriefTypes}
            onDirtyChange={setPeakDirty}
            onSaved={() => { handlePeakClose(); setTodayPeakCount(c => c + 1) }}
          />
        </DesktopModal>
      )}

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
                {noteDeck.length >= DECK_MAX ? (
                  <div className={styles.deckFullMsg}>deck is full — remove a card to add another</div>
                ) : (
                  <button className={styles.addDeckCardBtn} onClick={openComposerForNew}>+ add note</button>
                )}
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
              {!composer.id && noteDeck.length >= DECK_MAX && (
                <div className={styles.deckFullMsg}>deck is full — remove a card to add another</div>
              )}
              {composerError && <div className={styles.composerError}>{composerError}</div>}
              <button
                className={styles.noteSaveBtn}
                onClick={handleComposerSave}
                disabled={!composerText.trim() || (!composer.id && noteDeck.length >= DECK_MAX)}
              >
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

