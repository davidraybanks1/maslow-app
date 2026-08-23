import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NEEDS, MODES, MODE_ORDER, MODE_MAX_BUBBLES, MODE_WEIGHTS, JOURNAL_TRUNCATE } from '../lib/constants'
import { currentSlot, precedingSlots, SLOT_NOUN, SLOT_GREETING } from '../lib/slots'
import { todayKey, loadJournalEntries, addJournalEntry, deleteJournalEntry, loadNoteDeck, loadCustomTags } from '../lib/store'
import { BUILTIN_NATURE_TYPES, BUILTIN_PEAK_TYPES } from '../lib/debriefTypes'
import { createDataStats, getCanvasGuidance } from '../lib/dataStats'
import { hapticTick } from '../lib/native'
import { useIsDesktop } from '../lib/useIsDesktop'
import ManageDeck from '../components/ManageDeck'
import ManageTags from '../components/ManageTags'
import NeedsPopup from '../components/NeedsPopup'
import styles from './Today.module.css'

const NOTE_DECK_MAX = 5
const MODE_THRESHOLDS = { exploration: 80, appreciation: 60, nourishment: 50, survival: 20 }

const MOODS = ['good', 'fine', 'bad']
const MOOD_FILL = {
  good: { background: 'var(--exploration)',  borderColor: 'var(--exploration)',  color: 'var(--card)' },
  fine: { background: 'var(--appreciation)', borderColor: 'var(--appreciation)', color: 'var(--ink)'  },
  bad:  { background: 'var(--survival)',     borderColor: 'var(--survival)',     color: 'var(--card)' },
}
const MOOD_PIP_COLOR = {
  good: 'var(--exploration)',
  fine: 'var(--appreciation-deep)',
  bad:  'var(--survival)',
}


// Shared math: each mode owns ≤25% of total; returns [{color, from, to}] in percent
function buildProgressSegments(arcs) {
  const segs = []
  let cursor = 0
  for (const { color, fill } of arcs) {
    const segPct = fill * 25
    if (segPct > 0.001) {
      segs.push({ color, from: cursor, to: cursor + segPct })
      cursor += segPct
    }
  }
  segs.push({ color: 'var(--track)', from: cursor, to: 100 })
  return segs
}

function buildRingGradient(arcs) {
  const segs = buildProgressSegments(arcs)
  const stops = segs.flatMap(s => [`${s.color} ${s.from.toFixed(2)}%`, `${s.color} ${s.to.toFixed(2)}%`])
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

function CompletionBar({ arcs, pct }) {
  const segs = buildProgressSegments(arcs)
  return (
    <div className={styles.progressBarOuter} aria-label={`${pct}% complete today`} role="img">
      <div className={styles.progressBarTrack}>
        {segs.map((s, i) => (
          <div key={i} className={styles.progressBarSeg} style={{ width: `${s.to - s.from}%`, background: s.color }} />
        ))}
      </div>
      <span className={styles.progressBarPct}>{pct}<span className={styles.progressBarPctSign}>%</span></span>
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

export default function Today({ state, checkIn, removeCheckin, clearPracticeCheckins, incrementCheckinCount, logMood, onActiveDeckChanged, onCustomTagsChanged }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [today, setToday] = useState(() => todayKey())
  const [slot, setSlot] = useState(() => currentSlot())
  const checked = state.checkins[today] || []

  useEffect(() => {
    const id = setInterval(() => {
      setToday(todayKey())
      setSlot(currentSlot())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Completion ring: segments pack contiguously from 12 o'clock in mode order.
  const ringArcs = []
  let totalRingFraction = 0
  for (const mode of MODE_ORDER) {
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
    ringArcs.push({ color: MODES[mode].pip, fill })
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
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [customTags, setCustomTags] = useState([])
  const [profileReturnTo, setProfileReturnTo] = useState(null)

  useEffect(() => {
    if (!state.userId) return
    loadCustomTags(state.userId).then(setCustomTags)
  }, [state.userId])

  // Open edit / tags when navigated here from profile sheet.
  // Dep on location.state (not []) so this re-fires when profile pushes the same
  // /today route while Today is already mounted — without it the state change is
  // invisible because useEffect([]) only runs on initial mount.
  useEffect(() => {
    const { openDeck, openTags, fromProfile, returnTo } = location.state || {}
    if (fromProfile && returnTo) setProfileReturnTo(returnTo)
    if (openDeck) {
      openManageDeck()
      navigate(location.pathname, { replace: true, state: {} })
    } else if (openTags) {
      setManageTagsOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadDeck() {
    if (!state.userId) { console.error('[loadDeck] called without userId — session may be invalid'); return }
    loadNoteDeck(state.userId).then(deck => { setNoteDeck(deck); onActiveDeckChanged?.(deck) })
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
  }

  function advanceDeckCard(dir) {
    if (!noteDeck.length) return
    const next = (activeCardIndex + dir + noteDeck.length) % noteDeck.length
    setActiveCardIndex(next)
    const wrapper = deckWrapperRef.current
    if (wrapper) wrapper.scrollTo({ left: next * wrapper.clientWidth, behavior: 'smooth' })
  }

  const [journalEntries, setJournalEntries] = useState([])
  const [journalSaveError, setJournalSaveError] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [expandedTodayEntries, setExpandedTodayEntries] = useState(() => new Set())
  const [draftText, setDraftText] = useState('')
  const [draftNeedId, setDraftNeedId] = useState(null)
  const [draftState, setDraftState] = useState(null)
  const [draftCustom, setDraftCustom] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [needPickerOpen, setNeedPickerOpen] = useState(false)
  const [statePickerOpen, setStatePickerOpen] = useState(false)
  const [customPickerOpen, setCustomPickerOpen] = useState(false)
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
      custom: draftCustom,
    })
    if (error) { setJournalSaveError('save failed — try again'); return }
    setJournalEntries(prev => [...prev, data])
    setDraftText('')
    setDraftNeedId(null)
    setDraftState(null)
    setDraftCustom(null)
    setJournalSaveError(null)
    setNeedPickerOpen(false)
    setStatePickerOpen(false)
    setCustomPickerOpen(false)
  }

  function handleComposerKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleAddEntry()
    }
  }

  useEffect(() => {
    if (!pendingDeleteId) return
    function onDocMouseDown() { setPendingDeleteId(null) }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [pendingDeleteId])

  async function handleDeleteEntry(id) {
    if (pendingDeleteId === id) {
      setPendingDeleteId(null)
      setJournalEntries(prev => prev.filter(e => e.id !== id))
      await deleteJournalEntry(id)
    } else {
      setPendingDeleteId(id)
    }
  }

  const isDesktop = useIsDesktop()
  const [justTapped, setJustTapped] = useState(null)
  const [openTier, setOpenTier] = useState(null)
  const [popupMode, setPopupMode] = useState(null)
  const tierElems = useRef({})
  const tierBtnElems = useRef({})
  // Frozen sort order per mode — set at open, cleared at close so re-open re-sorts
  const accordionSnapshots = useRef({})
  const [openRetroSlot, setOpenRetroSlot] = useState(null)

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
    const prior = moodSelections[promptTime]
    setMoodSelections(prev => ({ ...prev, [promptTime]: mood }))
    if (!logMood) return
    const { error } = await logMood(state.userId, promptTime, mood, moodNotes[promptTime] || null, today)
    if (error) {
      setMoodSelections(prev => {
        const next = { ...prev }
        if (next[promptTime] !== mood) return next
        if (prior !== undefined) { next[promptTime] = prior } else { delete next[promptTime] }
        return next
      })
      setMoodNotes(prev => ({ ...prev, [promptTime]: '' }))
    }
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


  return (
    <div className={styles.screen}>
    <div className={styles.desktopWrap}>

      {/* ── Greeting ── */}
      <div className={styles.header}>
        <div className={styles.headerRow} data-tour="space">
          <div className={styles.headerLeft}>
            <div className={styles.dateLabel}>{dateLabel}</div>
            <div className={styles.greeting}>good {SLOT_GREETING[slot]}.</div>
            {STREAK_LINES[streak] && <div className={styles.milestoneLine}>{STREAK_LINES[streak]}</div>}
          </div>
          <div className={styles.headerRingWrap}>
            <CompletionRing arcs={ringArcs} pct={ringPct} />
          </div>
          <div className={styles.headerBarWrap}>
            <CompletionBar arcs={ringArcs} pct={ringPct} />
          </div>
        </div>
      </div>

      {/* ── Scrollable / grid body ── */}
      <div className={`${styles.list}${!state.showNoteToSelf && isDesktop ? ` ${styles.listNoNote}` : ''}`}>
        <div className={styles.colLeft}>

        {/* ── Note to self deck ── */}
        {state.showNoteToSelf && (
          <div className={styles.reflectiveSection} data-tour="note">
            <div className={styles.noteDeckSection}>
              {noteDeck.length > 0 ? (
                <>
                  <div
                    className={styles.noteDeckWrapper}
                    style={!isDesktop && deckHeight ? { height: deckHeight } : undefined}
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
                          <div className={styles.deckControls}>
                            {noteDeck.length > NOTE_DECK_MAX ? (
                              <span className={styles.noteDeckCounter} style={{ color: 'var(--survival)' }}>{noteDeck.length}/{NOTE_DECK_MAX}</span>
                            ) : (
                              <>
                                {noteDeck.length > 1 && (
                                  <button className={styles.deckArrow} onClick={() => advanceDeckCard(-1)} aria-label="previous card">‹</button>
                                )}
                                <span className={styles.noteDeckCounter}>{activeCardIndex + 1}/{noteDeck.length}</span>
                                {noteDeck.length > 1 && (
                                  <button className={styles.deckArrow} onClick={() => advanceDeckCard(1)} aria-label="next card">›</button>
                                )}
                              </>
                            )}
                          </div>
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

        {/* ── Guidance ── */}
        <div className={styles.guidanceSlot}>
          {showGuidance && <GuidanceCard type={guidanceType} onDismiss={handleDismissGuidance} />}
        </div>

        {/* ── Mood section ── */}
        <div className={styles.moodCard} data-tour="mood">
          <div className={styles.moodEyebrow}>MOOD CHECK</div>
          <div className={styles.moodRow}>
            <div className={styles.moodLeft}>
              <div className={styles.moodQuestion}>how's the {SLOT_NOUN[slot]}?</div>
              {precedingSlots(slot).length > 0 && (
                <div className={styles.moodPipRow}>
                  {precedingSlots(slot).map(prevSlot => (
                    <button key={prevSlot} className={styles.moodPip} aria-expanded={openRetroSlot === prevSlot}
                      onClick={() => setOpenRetroSlot(o => o === prevSlot ? null : prevSlot)}>
                      <span
                        className={`${styles.moodPipDot} ${moodSelections[prevSlot] ? styles.moodPipDotFilled : ''}`}
                        style={moodSelections[prevSlot] ? { background: MOOD_PIP_COLOR[moodSelections[prevSlot]], borderColor: MOOD_PIP_COLOR[moodSelections[prevSlot]] } : undefined}
                      />
                      <span className={styles.moodPipLabel}>{prevSlot}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.moodCircles}>
              {MOODS.map(mood => (
                <button
                  key={mood}
                  className={`${styles.moodCircle} ${moodSelections[slot] === mood ? styles.moodCircleSelected : ''}`}
                  style={moodSelections[slot] === mood ? MOOD_FILL[mood] : undefined}
                  onClick={() => handleMoodSelect(slot, mood)}
                >{mood}</button>
              ))}
            </div>
          </div>
          {/* Retro slot detail */}
          {openRetroSlot && (
            <div className={styles.retroRow}>
              <div className={styles.retroQ}>how was the {SLOT_NOUN[openRetroSlot]}?</div>
              <div className={styles.moodCircles}>
                {MOODS.map(mood => (
                  <button key={mood} className={`${styles.moodCircle} ${styles.moodCircleSm} ${moodSelections[openRetroSlot] === mood ? styles.moodCircleSelected : ''}`}
                    style={moodSelections[openRetroSlot] === mood ? MOOD_FILL[mood] : undefined}
                    onClick={() => { handleMoodSelect(openRetroSlot, mood); setOpenRetroSlot(null) }}>{mood}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={styles.moodDivider} />

        {/* ── Needs & Practices ── */}
        <div className={styles.practicesCard} data-tour="modes">
          <div className={styles.tierSectionHeader}>
            <span className={styles.tierSectionLabel}>NEEDS & PRACTICES</span>
            <span className={styles.tierSectionHint}>tap a mode to fill it</span>
          </div>
          <div className={styles.tierList}>
            {MODE_ORDER.map(mode => {
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

              if (isDesktop) {
                const isPopupOpen = popupMode === mode
                return (
                  <div
                    key={mode}
                    className={styles.tier}
                    ref={el => { tierElems.current[mode] = el }}
                  >
                    <button
                      className={styles.tierHeader}
                      onClick={() => setPopupMode(isPopupOpen ? null : mode)}
                      aria-expanded={isPopupOpen}
                      aria-controls={`needs-popup-${mode}`}
                      ref={el => { tierBtnElems.current[mode] = el }}
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
                      <div className={styles.tierNeedLabels}>
                        {modeNeeds.map(n => n.name).join(', ')}
                      </div>
                    </button>
                  </div>
                )
              }

              // Mobile: inline accordion with frozen sort order
              const isOpen = openTier === mode
              function getPracticeCount(n, practice) {
                return checked
                  .filter(e => {
                    if (e.need_id !== n.id) return false
                    if (practice.id && e.practice_id) return e.practice_id === practice.id
                    return e.practice_text === practice.label
                  })
                  .reduce((s, e) => s + (e.count || 1), 0)
              }

              // Snapshot: sort order is captured at open and held for the accordion's life.
              // Tapping a practice updates counts but rows do not reorder mid-session.
              // Closing clears the snapshot; reopening re-sorts at the current counts.
              if (isOpen && !accordionSnapshots.current[mode]) {
                accordionSnapshots.current[mode] = modeNeeds.map(n => {
                  const pool = (state.practicesDB && state.practicesDB.length > 0)
                    ? state.practicesDB.filter(p => p.need_id === n.id && !p.archived_at)
                    : (state.practices[n.id] || []).map(label => ({ id: null, label }))
                  return { need: n, sorted: [...pool].sort((a, b) => getPracticeCount(n, a) - getPracticeCount(n, b)) }
                })
              }
              const pools = isOpen ? accordionSnapshots.current[mode] : []

              return (
                <div
                  key={mode}
                  className={`${styles.tier} ${isOpen ? styles.tierOpen : ''}`}
                >
                  <button
                    className={styles.tierHeader}
                    onClick={() => {
                      if (openTier === mode) {
                        delete accordionSnapshots.current[mode]
                        setOpenTier(null)
                      } else {
                        delete accordionSnapshots.current[mode]
                        setOpenTier(mode)
                      }
                    }}
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
                    {!isOpen && (
                      <div className={styles.tierNeedLabels}>
                        {modeNeeds.map(n => n.name).join(', ')}
                      </div>
                    )}
                  </button>

                  <div className={`${styles.tierContent} ${isOpen ? styles.tierContentOpen : ''}`}>
                    <div className={styles.tierContentInner}>
                      {pools.map(({ need: n, sorted }) => {
                        const needDone = Math.min(
                          checked.filter(e => e.need_id === n.id).reduce((s, e) => s + (e.count || 1), 0),
                          maxBubbles
                        )
                        return (
                          <div key={n.id} className={styles.needGroup}>
                            <div className={styles.needSubHeader}>
                              <span className={styles.needSubName}>{n.name}</span>
                              <span className={styles.needSubCount}>{needDone}/{maxBubbles}</span>
                            </div>
                            {sorted.length === 0 ? (
                              <div className={styles.noPractice}>
                                no practices — <span className={styles.noPracticeLink} onClick={() => navigate('/canvas')}>add some</span>
                              </div>
                            ) : sorted.map(practice => {
                              const practiceKey = practice.id || `${n.id}_${practice.label}`
                              const count = getPracticeCount(n, practice)
                              const isJustNow = justTapped === practiceKey
                              const lastDays = lastDoneMap.get(practiceKey) ?? null
                              const meta = isJustNow ? 'just now' : count >= 1 ? 'today' : (lastDays !== null && lastDays > 0 ? `${lastDays}d ago` : '')
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
                                    {count >= 2 && <span className={styles.practiceX2}>×2</span>}
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
          {isDesktop && popupMode && (() => {
            const pNeeds = NEEDS.filter(n => state.canvas[n.id] === popupMode)
            return (
              <NeedsPopup
                key={popupMode}
                mode={popupMode}
                pip={MODES[popupMode]?.pip}
                modeNeeds={pNeeds}
                maxBubbles={MODE_MAX_BUBBLES[popupMode] || 0}
                checked={checked}
                justTapped={justTapped}
                lastDoneMap={lastDoneMap}
                state={state}
                handlePracticeTap={handlePracticeTap}
                navigate={navigate}
                triggerEl={tierBtnElems.current[popupMode]}
                onClose={() => setPopupMode(null)}
              />
            )
          })()}
        </div>

        </div>{/* /colLeft */}

        <div className={styles.colRight}>

        {/* ── Journal ── */}
        {isDesktop ? (
          <div className={styles.journalSection}>
            <div className={styles.journalDeskHeader}>
              <span className={styles.journalDeskLabel}>JOURNAL</span>
              {journalEntryCount > 0 && (
                <span className={styles.journalDeskCount}> / {journalEntryCount} {journalEntryCount === 1 ? 'entry' : 'entries'} today</span>
              )}
            </div>
            <div className={styles.journalScroll} ref={journalEntriesRef}>
              <div className={styles.journalEntries}>
                {journalEntries.length === 0 ? (
                  <span className={styles.journalEntriesEmpty}>nothing written yet — start typing below</span>
                ) : journalEntries.map(e => {
                  const entryMoodKey = !e.state && e.slot ? moodSelections[e.slot] : null
                  return (
                  <div key={e.id} className={styles.journalEntryCard}>
                    <div className={styles.journalEntryMeta}>
                      {entryMoodKey && <span className={styles.journalMoodDot} style={{ background: MOOD_PIP_COLOR[entryMoodKey] }} />}
                      <span className={styles.journalEntryTime}>{formatEntryTime(e.created_at)}</span>
                      {e.slot && <span className={styles.journalSlotChip}>{e.slot}</span>}
                      {e.state && <span className={styles.journalStateTag}>{e.state}</span>}
                      {e.need_id && <span className={styles.journalNeedTag}>{e.need_id}</span>}
                      {e.custom && <span className={styles.journalNeedTag}>{e.custom}</span>}
                      <button
                        className={`${styles.journalEntryDelete}${pendingDeleteId === e.id ? ` ${styles.journalEntryDeletePending}` : ''}`}
                        onMouseDown={ev => ev.stopPropagation()}
                        onClick={() => handleDeleteEntry(e.id)}
                        aria-label={pendingDeleteId === e.id ? 'confirm delete' : 'delete entry'}
                      >{pendingDeleteId === e.id ? 'delete?' : '×'}</button>
                    </div>
                    {(() => {
                      const body = e.entry || ''
                      const isExp = expandedTodayEntries.has(e.id)
                      const trunc = body.length > JOURNAL_TRUNCATE
                      const display = !isExp && trunc ? body.slice(0, JOURNAL_TRUNCATE).trimEnd() + '…' : body
                      const toggle = () => setExpandedTodayEntries(prev => { const s = new Set(prev); isExp ? s.delete(e.id) : s.add(e.id); return s })
                      return (
                        <>
                          <div className={styles.journalEntryText}>{display}</div>
                          {!isExp && trunc && <button className={styles.journalReadMore} onClick={toggle}>read more</button>}
                        </>
                      )
                    })()}
                  </div>
                  )
                })}
              </div>
            </div>
            <div className={styles.journalBottom}>
              <div className={styles.journalComposerCard} data-tour="journal">
                <div className={styles.composerChips}>
                  <span className={styles.composerTimeChip}>{formatEntryTime(new Date().toISOString())}</span>
                  <span className={styles.composerSlotChip}>{slot}</span>
                  {draftState ? (
                    <button className={styles.composerTagActive} onClick={() => setDraftState(null)}>{draftState} ×</button>
                  ) : (
                    <button className={styles.composerTagBtn} onClick={() => { setStatePickerOpen(o => !o); setNeedPickerOpen(false); setCustomPickerOpen(false) }}>+ state</button>
                  )}
                  {draftNeedId ? (
                    <button className={styles.composerTagActive} onClick={() => setDraftNeedId(null)}>{draftNeedId} ×</button>
                  ) : (
                    <button className={styles.composerTagBtn} onClick={() => { setNeedPickerOpen(o => !o); setStatePickerOpen(false); setCustomPickerOpen(false) }}>+ need</button>
                  )}
                  {customTags.length > 0 && (draftCustom ? (
                    <button className={styles.composerTagActive} onClick={() => setDraftCustom(null)}>{draftCustom} ×</button>
                  ) : (
                    <button className={styles.composerTagBtn} onClick={() => { setCustomPickerOpen(o => !o); setNeedPickerOpen(false); setStatePickerOpen(false) }}>+ custom</button>
                  ))}
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
                      <button key={t.name} className={styles.composerPickerItem} onClick={() => { setDraftState(t.name); setStatePickerOpen(false) }}>{t.name}</button>
                    ))}
                  </div>
                )}
                {customPickerOpen && customTags.length > 0 && (
                  <div className={styles.composerPicker}>
                    {customTags.map(t => (
                      <button key={t.id} className={styles.composerPickerItem} onClick={() => { setDraftCustom(t.label); setCustomPickerOpen(false) }}>{t.label}</button>
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
            </div>
          </div>
        ) : (
          <div className={styles.cardJournal} data-tour="journal">
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>journal</span>
              <span className={styles.journalEntryCount}>
                {journalEntryCount > 0 ? `${journalEntryCount} ${journalEntryCount === 1 ? 'entry' : 'entries'} today` : ''}
              </span>
            </div>
            <>
              {journalEntries.length > 0 && (
                <div className={styles.journalMobileEntries}>
                  {journalEntries.map(e => {
                    const entryMoodKey = !e.state && e.slot ? moodSelections[e.slot] : null
                    return (
                    <div key={e.id} className={styles.journalEntryCard}>
                      <div className={styles.journalEntryMeta}>
                        {entryMoodKey && <span className={styles.journalMoodDot} style={{ background: MOOD_PIP_COLOR[entryMoodKey] }} />}
                        <span className={styles.journalEntryTime}>{formatEntryTime(e.created_at)}</span>
                        {e.slot && <span className={styles.journalSlotChip}>{e.slot}</span>}
                        {e.state && <span className={styles.journalStateTag}>{e.state}</span>}
                        {e.need_id && <span className={styles.journalNeedTag}>{e.need_id}</span>}
                        <button
                          className={`${styles.journalEntryDelete}${pendingDeleteId === e.id ? ` ${styles.journalEntryDeletePending}` : ''}`}
                          onMouseDown={ev => ev.stopPropagation()}
                          onClick={() => handleDeleteEntry(e.id)}
                          aria-label={pendingDeleteId === e.id ? 'confirm delete' : 'delete entry'}
                        >{pendingDeleteId === e.id ? 'delete?' : '×'}</button>
                      </div>
                      {(() => {
                      const body = e.entry || ''
                      const isExp = expandedTodayEntries.has(e.id)
                      const trunc = body.length > JOURNAL_TRUNCATE
                      const display = !isExp && trunc ? body.slice(0, JOURNAL_TRUNCATE).trimEnd() + '…' : body
                      const toggle = () => setExpandedTodayEntries(prev => { const s = new Set(prev); isExp ? s.delete(e.id) : s.add(e.id); return s })
                      return (
                        <>
                          <div className={styles.journalEntryText}>{display}</div>
                          {!isExp && trunc && <button className={styles.journalReadMore} onClick={toggle}>read more</button>}
                        </>
                      )
                    })()}
                    </div>
                    )
                  })}
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
                      <button className={styles.composerTagBtn} onClick={() => { setNeedPickerOpen(o => !o); setStatePickerOpen(false); setCustomPickerOpen(false) }}>+ need</button>
                    )}
                    {draftState ? (
                      <button className={styles.composerTagActive} onClick={() => setDraftState(null)}>{draftState} ×</button>
                    ) : (
                      <button className={styles.composerTagBtn} onClick={() => { setStatePickerOpen(o => !o); setNeedPickerOpen(false); setCustomPickerOpen(false) }}>+ state</button>
                    )}
                    {customTags.length > 0 && (draftCustom ? (
                      <button className={styles.composerTagActive} onClick={() => setDraftCustom(null)}>{draftCustom} ×</button>
                    ) : (
                      <button className={styles.composerTagBtn} onClick={() => { setCustomPickerOpen(o => !o); setNeedPickerOpen(false); setStatePickerOpen(false) }}>+ custom</button>
                    ))}
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
                        <button key={t.name} className={styles.composerPickerItem} onClick={() => { setDraftState(t.name); setStatePickerOpen(false) }}>{t.name}</button>
                      ))}
                    </div>
                  )}
                  {customPickerOpen && customTags.length > 0 && (
                    <div className={styles.composerPicker}>
                      {customTags.map(t => (
                        <button key={t.id} className={styles.composerPickerItem} onClick={() => { setDraftCustom(t.label); setCustomPickerOpen(false) }}>{t.label}</button>
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
                    <button className={styles.composerCancelBtn} onClick={() => { setComposerOpen(false); setNeedPickerOpen(false); setStatePickerOpen(false); setCustomPickerOpen(false) }}>cancel</button>
                    <button className={styles.journalAddBtn} onClick={handleAddEntry} disabled={!draftText.trim()}>add</button>
                  </div>
                  {journalSaveError && <div className={styles.journalSaveError}>{journalSaveError}</div>}
                </div>
              )}
            </>
          </div>
        )}

        </div>{/* /colRight */}

      </div>
    </div>{/* /desktopWrap */}

      {manageDeckOpen && (
        <ManageDeck
          userId={state.userId}
          onClose={() => {
            setManageDeckOpen(false)
            loadDeck()
            if (profileReturnTo) {
              navigate(profileReturnTo, { state: { openProfile: true } })
              setProfileReturnTo(null)
            }
          }}
          onDeckChanged={deck => { setNoteDeck(deck); onActiveDeckChanged?.(deck) }}
        />
      )}

      {manageTagsOpen && (
        <ManageTags
          userId={state.userId}
          onClose={updatedTags => {
            setManageTagsOpen(false)
            setCustomTags(updatedTags)
            onCustomTagsChanged?.(updatedTags.length)
            if (profileReturnTo) {
              navigate(profileReturnTo, { state: { openProfile: true } })
              setProfileReturnTo(null)
            }
          }}
        />
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

