import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NEEDS, MODES, MODE_ORDER, MODE_MAX_BUBBLES, MODE_WEIGHTS, JOURNAL_TRUNCATE } from '../lib/constants'
import { currentSlot, precedingSlots, SLOTS, SLOT_NOUN, SLOT_GREETING } from '../lib/slots'
import { todayKey, loadJournalEntries, deleteJournalEntry, loadNoteDeck, loadCustomTags } from '../lib/store'
import { createDataStats, getCanvasGuidance } from '../lib/dataStats'
import { hapticTick, isNative, pendingNotifSlot } from '../lib/native'
import { normalizeBand, BAND_LABEL } from '../lib/frequency'
import { useIsDesktop } from '../lib/useIsDesktop'
import FrequencyCard, { MOOD_PIP_COLOR } from '../components/FrequencyCard'
import Glyph from '../lib/glyphs'
import Bloom from '../components/Bloom'
import NoteStack from '../components/NoteStack'
import JournalQuote from '../components/JournalQuote'
import ManageDeck from '../components/ManageDeck'
import ManageTags from '../components/ManageTags'
import NeedsPopup from '../components/NeedsPopup'
import styles from './Today.module.css'

const MODE_THRESHOLDS = { exploration: 80, appreciation: 60, nourishment: 50, survival: 20 }

// Same thresholds as the almanac's observation cards (Data.jsx) - the two
// card types share a footprint, so a note steps its type down at the same
// lengths a finding does, rather than picking its own scale.
function noteLenAttr(text) {
  return text.length > 150 ? 'long' : text.length > 90 ? 'mid' : undefined
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

// Practice check gradient stops — hi/lo per mode, matches Bloom petal lighting
const MODE_CHECK_COLORS = {
  exploration:  ['#2E8A64', '#0C5038'],
  appreciation: ['#C7D4C1', '#9DB394'],
  nourishment:  ['#FFD166', '#F0A800'],
  survival:     ['#FF7A55', '#F03C10'],
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

function formatQuoteDate(dateKey) {
  if (!dateKey) return ''
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

/* Notes to self you have swiped past this session. Kept outside the
   component so a trip to another tab does not bring them back; cleared when
   the app is reopened, so every day starts with the full deck. */
const reviewedNotes = { ids: new Set(), token: 0 }
function clearReviewedNotes() { reviewedNotes.ids = new Set(); reviewedNotes.token++ }
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') clearReviewedNotes() })
  window.addEventListener('pageshow', clearReviewedNotes)
}

export default function Today({ state, checkIn, removeCheckin, clearPracticeCheckins, incrementCheckinCount, logMood, onActiveDeckChanged, onCustomTagsChanged }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isDesktop = useIsDesktop()
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

  // Cold-launch: mood reminder tapped while app was closed. App.jsx registers
  // the listener and stores the slot in pendingNotifSlot; Today.jsx consumes it
  // on mount so the scroll runs once Today's DOM is ready.
  useEffect(() => {
    if (!isNative() || !pendingNotifSlot.value) return
    pendingNotifSlot.value = null
    setTimeout(() => {
      try { document.querySelector('[data-tour="mood"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
    }, 300)
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
  const lastDoneMap = new Map(
    stats.getPracticeStats().map(p => [
      p.practice?.id || `${p.need.id}_${p.text}`,
      p.daysSinceLast,
    ])
  )
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

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

  // Cards swiped past drop out of the rail; a re-render is forced when the
  // session memory is cleared (the app coming back to the foreground).
  const [, setReviewedTick] = useState(0)
  useEffect(() => {
    const onShow = () => setReviewedTick(t => t + 1)
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('pageshow', onShow)
    return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('pageshow', onShow) }
  }, [])
  const visibleDeck = isDesktop ? noteDeck : noteDeck.filter(c => !reviewedNotes.ids.has(c.id))
  const deckReviewed = !isDesktop && noteDeck.length > 0 && visibleDeck.length === 0

  // Desktop only: the rail is a plain horizontal scroller, nothing leaves it.
  function handleDeckScroll() {
    const wrapper = deckWrapperRef.current
    if (!wrapper || wrapper.clientWidth === 0) return
    setActiveCardIndex(Math.round(wrapper.scrollLeft / wrapper.clientWidth))
  }

  // Mobile: a note that flies off the stack (NoteStack handles the drag and
  // the animation itself) is reviewed for the rest of the session.
  function handleNoteDismissed(id) {
    reviewedNotes.ids.add(id)
    setReviewedTick(t => t + 1)
  }

  // Reviewing the whole deck is a practice: when the last card goes, the
  // 'notes to self' practice (whatever it is called - read, review...) is
  // checked once for the day, which fills its bubble and lights the bloom.
  const autoCheckedFor = useRef(null)
  useEffect(() => {
    if (!deckReviewed || autoCheckedFor.current === today) return
    const matches = label => /notes? to self/i.test(label || '')
    let practice = null
    if (state.practicesDB && state.practicesDB.length > 0) {
      const p = state.practicesDB.find(p => !p.archived_at && matches(p.label) && state.canvas[p.need_id])
      if (p) practice = { needId: p.need_id, label: p.label, id: p.id }
    } else {
      for (const needId of Object.keys(state.practices || {})) {
        const label = (state.practices[needId] || []).find(matches)
        if (label && state.canvas[needId]) { practice = { needId, label, id: null }; break }
      }
    }
    if (!practice) return
    autoCheckedFor.current = today
    const done = checked.some(e => e.need_id === practice.needId && (practice.id && e.practice_id ? e.practice_id === practice.id : e.practice_text === practice.label))
    if (done) return
    checkIn(practice.needId, practice.label, state.canvas[practice.needId], undefined, practice.id)
    hapticTick()
  }, [deckReviewed, today])

  function openManageDeck() {
    setManageDeckOpen(true)
  }

  function advanceDeckCard(dir) {
    if (!noteDeck.length) return
    const next = (activeCardIndex + dir + noteDeck.length) % noteDeck.length
    setActiveCardIndex(next)
    const wrapper = deckWrapperRef.current
    if (wrapper) {
      const unit = isDesktop ? wrapper.clientWidth : 294
      wrapper.scrollTo({ left: next * unit, behavior: 'smooth' })
    }
  }

  const [journalEntries, setJournalEntries] = useState([])
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [expandedTodayEntries, setExpandedTodayEntries] = useState(() => new Set())
  const journalEntriesRef = useRef(null)

  useEffect(() => {
    if (!state.userId) return
    loadJournalEntries(state.userId, today).then(setJournalEntries)
  }, [state.userId, today])

  // The sticky global composer (same button, any screen — see GlobalComposer.jsx)
  // dispatches this after a successful save so Today's own list stays live
  // without needing a remount.
  useEffect(() => {
    function onEntryAdded(e) {
      if (e.detail?.dateKey === today) setJournalEntries(prev => [...prev, e.detail.entry])
    }
    window.addEventListener('maslow:entry-added', onEntryAdded)
    return () => window.removeEventListener('maslow:entry-added', onEntryAdded)
  }, [today])

  useEffect(() => {
    if (!pendingDeleteId) return
    function onDocMouseDown() { setPendingDeleteId(null) }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [pendingDeleteId])

  async function handleDeleteEntry(id) {
    if (pendingDeleteId === id) {
      setPendingDeleteId(null)
      const entry = journalEntries.find(e => e.id === id)
      setJournalEntries(prev => prev.filter(e => e.id !== id))
      await deleteJournalEntry(id, entry?.image_url)
    } else {
      setPendingDeleteId(id)
    }
  }


  const [justTapped, setJustTapped] = useState(null)
  const [openTier, setOpenTier] = useState(null)
  const [popupMode, setPopupMode] = useState(null)
  const tierElems = useRef({})
  const tierBtnElems = useRef({})
  // Frozen sort order per mode — set at open, cleared at close so re-open re-sorts
  const accordionSnapshots = useRef({})

  // Tour demo-ring: animate the completion ring while card 1 is visible.
  // Sweeps 0→100% over 1800ms, holds 800ms, eases back to the real value.
  // Under prefers-reduced-motion the animation is skipped entirely.
  const [demoRing, setDemoRing] = useState(null)
  const demoRingCancelRef = useRef(null)
  const ringPctRef = useRef(ringPct)
  useEffect(() => { ringPctRef.current = ringPct }, [ringPct])

  useEffect(() => {
    function onDemoRing() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      if (demoRingCancelRef.current) demoRingCancelRef.current()

      let rafId = null
      const timers = []
      let cancelled = false

      function cancel() {
        cancelled = true
        if (rafId) cancelAnimationFrame(rafId)
        timers.forEach(clearTimeout)
        setDemoRing(null)
        demoRingCancelRef.current = null
      }
      demoRingCancelRef.current = cancel

      timers.push(setTimeout(() => {
        if (cancelled) return
        const t0 = performance.now()
        function sweepUp(now) {
          if (cancelled) return
          const frac = Math.min((now - t0) / 1800, 1)
          setDemoRing(frac)
          if (frac < 1) { rafId = requestAnimationFrame(sweepUp); return }
          timers.push(setTimeout(() => {
            if (cancelled) return
            const real = ringPctRef.current / 100
            const t1 = performance.now()
            function sweepDown(now) {
              if (cancelled) return
              const t = Math.min((now - t1) / 700, 1)
              const ease = 1 - t * t  // ease-out quadratic
              const frac = real + (1 - real) * ease
              if (frac > real + 0.005) {
                setDemoRing(frac)
                rafId = requestAnimationFrame(sweepDown)
              } else {
                setDemoRing(null)
                demoRingCancelRef.current = null
              }
            }
            rafId = requestAnimationFrame(sweepDown)
          }, 800))
        }
        rafId = requestAnimationFrame(sweepUp)
      }, 600))
    }

    function onDemoRingStop() {
      if (demoRingCancelRef.current) demoRingCancelRef.current()
    }

    window.addEventListener('maslow:demo-ring', onDemoRing)
    window.addEventListener('maslow:demo-ring-stop', onDemoRingStop)
    return () => {
      window.removeEventListener('maslow:demo-ring', onDemoRing)
      window.removeEventListener('maslow:demo-ring-stop', onDemoRingStop)
      if (demoRingCancelRef.current) demoRingCancelRef.current()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tour cross-component nudge: open/close the first mode accordion.
  // Prefer exploration; fall back to the first mode in MODE_ORDER that has
  // at least one need on the canvas; dispatch nothing if canvas is empty.
  useEffect(() => {
    function onOpenTier() {
      const modeToOpen = MODE_ORDER.find(m => NEEDS.some(n => state.canvas[n.id] === m))
      if (!modeToOpen) return
      delete accordionSnapshots.current[modeToOpen]
      setOpenTier(modeToOpen)
    }
    function onCloseTier() {
      setOpenTier(prev => {
        if (prev) delete accordionSnapshots.current[prev]
        return null
      })
    }
    window.addEventListener('maslow:open-tier', onOpenTier)
    window.addEventListener('maslow:close-tier', onCloseTier)
    return () => {
      window.removeEventListener('maslow:open-tier', onOpenTier)
      window.removeEventListener('maslow:close-tier', onCloseTier)
    }
  }, [state.canvas]) // eslint-disable-line react-hooks/exhaustive-deps
  const [openRetroSlot, setOpenRetroSlot] = useState(null)

  const [moodSelections, setMoodSelections] = useState(() => {
    const init = {}
    todayMoods.forEach(m => { init[m.prompt_time] = normalizeBand(m.mood) })
    return init
  })

  const [moodFeelings, setMoodFeelings] = useState(() => {
    const init = {}
    todayMoods.forEach(m => { if (m.feeling) init[m.prompt_time] = m.feeling })
    return init
  })

  const [moodNotes, setMoodNotes] = useState(() => {
    const init = {}
    todayMoods.forEach(m => { init[m.prompt_time] = m.note || '' })
    return init
  })

  // Sync mood selections, feelings, and notes from the server after restoreFromSupabase loads.
  // Only fills empty slots — never overwrites live user input.
  useEffect(() => {
    const todayMoodsNow = (state.moods || []).filter(m => m.date_key === today)
    if (!todayMoodsNow.length) return
    setMoodSelections(prev => {
      const next = { ...prev }
      todayMoodsNow.forEach(m => { if (!next[m.prompt_time]) next[m.prompt_time] = normalizeBand(m.mood) })
      return next
    })
    setMoodFeelings(prev => {
      const next = { ...prev }
      todayMoodsNow.forEach(m => { if (!next[m.prompt_time] && m.feeling) next[m.prompt_time] = m.feeling })
      return next
    })
    setMoodNotes(prev => {
      const next = { ...prev }
      todayMoodsNow.forEach(m => { if (!next[m.prompt_time] && m.note) next[m.prompt_time] = m.note })
      return next
    })
  }, [state.moods])

  async function handleFrequencySettle(promptTime, band, feeling) {
    if (!band) return  // blank station → no write
    const priorBand = moodSelections[promptTime]
    const priorFeeling = moodFeelings[promptTime]
    setMoodSelections(prev => ({ ...prev, [promptTime]: band }))
    setMoodFeelings(prev => ({ ...prev, [promptTime]: feeling || null }))
    if (!logMood) return
    const { error } = await logMood(state.userId, promptTime, band, moodNotes[promptTime] || null, today, feeling || null)
    if (error) {
      setMoodSelections(prev => {
        const next = { ...prev }
        if (next[promptTime] !== band) return next
        if (priorBand !== undefined) next[promptTime] = priorBand; else delete next[promptTime]
        return next
      })
      setMoodFeelings(prev => {
        const next = { ...prev }
        if (next[promptTime] !== (feeling || null)) return next
        if (priorFeeling !== undefined) next[promptTime] = priorFeeling; else delete next[promptTime]
        return next
      })
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

  const daypartsData = SLOTS.map(s => ({
    name: s,
    isCurrent: s === slot,
    band: moodSelections[s] || null,
    hasFeeling: !!(moodFeelings[s]),
    onTap: precedingSlots(slot).includes(s) ? () => setOpenRetroSlot(o => o === s ? null : s) : null,
  }))

  return (
    <div className={styles.screen}>
    <div className={styles.desktopWrap}>

      {/* ── Greeting ── */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.dateLabel}>{dateLabel}</div>
            <div className={styles.greeting}>good {SLOT_GREETING[slot]}.</div>
          </div>
          <div className={styles.headerRingWrap} data-tour="space">
            <Bloom
              arcs={demoRing !== null ? ringArcs.map(a => ({ ...a, fill: demoRing })) : ringArcs}
              pct={demoRing !== null ? Math.round(demoRing * 100) : ringPct}
              variant={isDesktop ? 'wide' : 'classic'}
            />
          </div>
          <div className={styles.headerBarWrap} data-tour="space">
            <CompletionBar
              arcs={demoRing !== null ? ringArcs.map(a => ({ ...a, fill: demoRing })) : ringArcs}
              pct={demoRing !== null ? Math.round(demoRing * 100) : ringPct}
            />
          </div>
        </div>
      </div>

      {/* ── Scrollable / grid body ── */}
      <div className={styles.list}>
        <div className={styles.colLeft}>

        {/* ── Note to self deck ── */}
        {deckReviewed && <div className={styles.deckReviewedSpace} aria-hidden="true" />}
        {!deckReviewed && <div className={styles.reflectiveSection} data-tour="note">
            <div className={styles.noteDeckSection}>
              {!isDesktop && (
                <div className={styles.noteSectionHeader}>
                  <span className={styles.sectionLabel}>notes to self</span>
                </div>
              )}
              {noteDeck.length > 0 ? (
                isDesktop ? (
                  <div
                    className={styles.noteDeckWrapper}
                    ref={deckWrapperRef}
                    onScroll={handleDeckScroll}
                  >
                    {noteDeck.map((card, i) => (
                      <div
                        key={card.id}
                        className={styles.noteDeckCard}
                        ref={el => { cardRefs.current[i] = el }}
                      >
                        <div className={styles.noteDeckEyebrow}><Glyph kind="note" />NOTE TO SELF</div>
                        <div className={styles.noteDeckBody}>
                          <span className={styles.noteText} data-len={noteLenAttr(card.text)}>{card.text}</span>
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
                            <>
                              {noteDeck.length > 1 && (
                                <button className={styles.deckArrow} onClick={() => advanceDeckCard(-1)} aria-label="previous card">‹</button>
                              )}
                              <span className={styles.noteDeckCounter}>{Math.min(activeCardIndex + 1, noteDeck.length)}/{noteDeck.length}</span>
                              {noteDeck.length > 1 && (
                                <button className={styles.deckArrow} onClick={() => advanceDeckCard(1)} aria-label="next card">›</button>
                              )}
                            </>
                          </div>
                          <button className={styles.noteEditPill} onClick={openManageDeck}>edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <NoteStack
                      cards={visibleDeck}
                      onDismiss={handleNoteDismissed}
                      onCommit={hapticTick}
                      renderCard={card => (
                        <div className={`${styles.noteDeckBody} ${styles.noteStackBody}`}>
                          <span className={styles.noteText} data-len={noteLenAttr(card.text)}>{card.text}</span>
                          {card.image_url && (
                            <img
                              src={card.image_url}
                              alt=""
                              className={styles.noteThumbnail}
                              onClick={() => setLightboxImage(card.image_url)}
                            />
                          )}
                        </div>
                      )}
                    />
                    <div className={styles.deckFooterRow}>
                      <span className={styles.noteDeckCounter}>{Math.min(noteDeck.length - visibleDeck.length + 1, noteDeck.length)}/{noteDeck.length}</span>
                      <button className={styles.noteEditPill} onClick={openManageDeck}>edit</button>
                    </div>
                  </>
                )
              ) : deckLoaded ? (
                <div className={styles.noteDeckCard}>
                  <div className={styles.noteDeckEyebrow}><Glyph kind="note" />NOTE TO SELF</div>
                  <div className={styles.noteDeckBody}>
                    <button className={styles.noteAddBtn} onClick={openManageDeck}>+ add a note to self</button>
                  </div>
                  <div className={styles.noteDeckFooter}><span /></div>
                </div>
              ) : (
                <div className={styles.noteDeckCard}>
                  <div className={styles.noteDeckEyebrow}><Glyph kind="note" />NOTE TO SELF</div>
                  <div className={styles.noteDeckBody}>
                    <span className={styles.noteEmpty}>—</span>
                  </div>
                  <div className={styles.noteDeckFooter}><span /></div>
                </div>
              )}
            </div>
          </div>}

        {/* ── Guidance ── */}
        <div className={styles.guidanceSlot}>
          {showGuidance && <GuidanceCard type={guidanceType} onDismiss={handleDismissGuidance} />}
        </div>

        {/* ── Frequency section ── */}
        <div className={styles.moodCard} data-tour="mood">
          {!isDesktop && (
            <div className={styles.freqHeader}>
              <span className={styles.freqHeaderLabel}><Glyph kind="frequency" />VIBRATIONS</span>
            </div>
          )}
          <div className={styles.freqShell}>
            <FrequencyCard
              key={slot}
              initialBand={moodSelections[slot] || null}
              initialFeeling={moodFeelings[slot] || null}
              onSettle={(band, feeling) => handleFrequencySettle(slot, band, feeling)}
              dayparts={isDesktop ? daypartsData : null}
              bandAsBack={!isDesktop}
            />
          </div>
          {!isDesktop && (
            <div className={styles.freqHeaderDayparts}>
              {daypartsData.map(dp => {
                const color = dp.band ? MOOD_PIP_COLOR[dp.band] : null
                const dotStyle = !color ? undefined
                  : dp.hasFeeling
                    ? { background: color, borderColor: color }
                    : { background: `linear-gradient(to right, ${color} 50%, transparent 50%)`, borderColor: color }
                return (
                  <button
                    key={dp.name}
                    className={`${styles.freqHeaderDp} ${dp.isCurrent ? styles.freqHeaderDpCurrent : ''}`}
                    onClick={dp.onTap || undefined}
                    style={!dp.onTap ? { cursor: 'default' } : undefined}
                  >
                    <span className={styles.freqHeaderDot} style={dotStyle} />
                    <span className={styles.freqHeaderDpName}>{dp.name}</span>
                  </button>
                )
              })}
            </div>
          )}
          {openRetroSlot && (
            <div className={styles.retroRow}>
              <FrequencyCard
                key={openRetroSlot}
                initialBand={moodSelections[openRetroSlot] || null}
                initialFeeling={moodFeelings[openRetroSlot] || null}
                onSettle={(band, feeling) => { handleFrequencySettle(openRetroSlot, band, feeling); setOpenRetroSlot(null) }}
                pastTense
              />
            </div>
          )}
        </div>
        <div className={styles.moodDivider} />

        {/* ── Needs & Practices ── */}
        <div className={styles.practicesCard} data-tour="modes">
          <div className={styles.tierSectionHeader}>
            <span className={styles.tierSectionLabel}><Glyph kind="mode" />{isDesktop ? 'CANVAS' : 'MODES'}</span>
            {isDesktop && <span className={styles.tierSectionHint}>tap a mode to fill it</span>}
          </div>
          <div className={styles.tierList}>
            {MODE_ORDER.map((mode, mi) => {
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
                      <i className={`${styles.tierChevron} ${isOpen ? styles.tierChevronOpen : ''}`} aria-hidden="true" />
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
                                    style={count > 0
                                      ? { '--practice-paint-hi': (MODE_CHECK_COLORS[mode] || [])[0] || pip, '--practice-paint-lo': (MODE_CHECK_COLORS[mode] || [])[1] || pip, borderColor: 'transparent' }
                                      : { borderColor: pip }}
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
                  <span className={styles.journalEntriesEmpty}>nothing written yet — the ✎ button in the sidebar starts a draft</span>
                ) : journalEntries.map(e => {
                  return (
                  <div key={e.id} className={styles.journalEntryCard}>
                    <div className={styles.journalEntryMeta}>
                      {e.mood_band && <span className={styles.journalFreqChip}><span className={styles.journalFreqDot} style={{ background: MOOD_PIP_COLOR[e.mood_band] }} />{e.mood_feeling || e.mood_band}</span>}
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
                          {e.quoted_text && (
                            <JournalQuote
                              text={e.quoted_text}
                              dateLabel={formatQuoteDate(e.quoted_date)}
                              blockClass={styles.journalQuoteBlock}
                              dateClass={styles.journalQuoteDate}
                              textClass={styles.journalQuoteText}
                              readMoreClass={styles.journalQuoteReadMore}
                            />
                          )}
                          <div className={styles.journalEntryText}>{display}</div>
                          {!isExp && trunc && <button className={styles.journalReadMore} onClick={toggle}>read more</button>}
                          {e.image_url && <img src={e.image_url} className={styles.journalEntryImage} alt="" />}
                        </>
                      )
                    })()}
                  </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.cardJournal} data-tour="journal">
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}><Glyph kind="note" />drafts</span>
              <span className={styles.journalEntryCount}>
                {journalEntryCount > 0 ? `${journalEntryCount} ${journalEntryCount === 1 ? 'entry' : 'entries'} today` : ''}
              </span>
            </div>
            <>
              {journalEntries.length === 0 && (
                <span className={styles.journalEmptyMobile}>nothing written yet — the ✎ button below starts a draft</span>
              )}
              {journalEntries.length > 0 && (
                <div className={styles.journalMobileEntries}>
                  {journalEntries.map(e => {
                    return (
                    <div key={e.id} className={styles.journalEntryCard}>
                      <div className={styles.journalEntryMeta}>
                        {e.mood_band && <span className={styles.journalFreqChip}><span className={styles.journalFreqDot} style={{ background: MOOD_PIP_COLOR[e.mood_band] }} />{e.mood_feeling || e.mood_band}</span>}
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
                          {e.quoted_text && (
                            <JournalQuote
                              text={e.quoted_text}
                              dateLabel={formatQuoteDate(e.quoted_date)}
                              blockClass={styles.journalQuoteBlock}
                              dateClass={styles.journalQuoteDate}
                              textClass={styles.journalQuoteText}
                              readMoreClass={styles.journalQuoteReadMore}
                            />
                          )}
                          <div className={styles.journalEntryText}>{display}</div>
                          {!isExp && trunc && <button className={styles.journalReadMore} onClick={toggle}>read more</button>}
                          {e.image_url && <img src={e.image_url} className={styles.journalEntryImage} alt="" />}
                        </>
                      )
                    })()}
                    </div>
                    )
                  })}
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

