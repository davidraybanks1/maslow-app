import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { todayKey, loadNoteDeck } from '../lib/store'
import { currentSlot, precedingSlots, slotAt, SLOTS, SLOT_GREETING } from '../lib/slots'
import { normalizeBand } from '../lib/frequency'
import { zonesFor } from '../lib/dayProgress'
import { createDataStats } from '../lib/dataStats'
import { usePracticeActions } from '../lib/usePracticeActions'
import { useDeskChrome } from '../lib/deskChrome'
import Wordmark from './Wordmark'
import ProfileMenu from './ProfileMenu'
import SignedImg from './SignedImg'
import StretchSheet from './StretchSheet'
import TimerTakeover from './TimerTakeover'
import NeedsSection from './NeedsSection'
import { CheckIn, Dateline, Greeting, ProgressRule, PullQuote, NoteFolio, DayLedger } from './loam'
import { DayToggle } from './DaypartTabs'
import dpStyles from './DaypartTabs.module.css'
import ManageDeck from './ManageDeck'
import ManageTags from './ManageTags'
import Data from '../screens/Data'
import Log from '../screens/Log'
import Practices from '../screens/Practices'
import CanvasScreen from '../screens/CanvasScreen'
import UpdatePassword from '../screens/UpdatePassword'
import styles from './DeskShell.module.css'

/* The desktop frame (≥900px).

   The writing page is the only full page. Around it: a 72px strip with the way
   around the app, and a side panel that opens beside it. Today, data and drafts
   all open in that panel (at the phone's layout, so everything on the phone is
   here too). Practices opens from a link inside the today panel. The profile and
   everything it links to (needs, practices, notes, tags, password) open in the
   same panel, so nothing but the writing page ever takes the whole window.

   On a wide window the panel docks and the page moves over to make room; on a
   narrower one it floats above the page. While the writing page is in focus the
   strip itself leaves; a hot zone on the left edge brings it back.
   Below 900px none of this renders. */

const NAV = [
  ['write', <path key="a" d="M3 15l.8-3.6L12 3.2a1.4 1.4 0 012 2L5.8 13.4z M10.6 4.6l2.8 2.8" />],
  ['today', <g key="a"><circle cx="9" cy="9" r="3" /><path d="M9 2v1.8M9 14.2V16M2 9h1.8M14.2 9H16M4.2 4.2l1.3 1.3M12.5 12.5l1.3 1.3M4.2 13.8l1.3-1.3M12.5 5.5l1.3-1.3" /></g>],
  ['data', <g key="a"><rect x="2.5" y="9" width="3" height="6.5" rx="1" /><rect x="7.5" y="3.5" width="3" height="12" rx="1" /><rect x="12.5" y="6.5" width="3" height="9" rx="1" /></g>],
  ['drafts', <g key="a"><rect x="4.5" y="2.5" width="10" height="12" rx="2" /><path d="M3 5.5v8.2a1.8 1.8 0 001.8 1.8H12 M7.5 6.5h4M7.5 9h4" /></g>],
]

/* ── notes to self: the phone's pull quote ───────────────────────────────────
   One note at a time, in the phone's treatment: the gold quote mark, the note
   in italic, and under it the folio (n/N →, edit). → moves to the next note,
   wrapping round, rather than dismissing it as a swipe does on the phone.
   Moving through the whole deck counts as the "notes to self" practice, as it
   does on the phone, so the ids you have looked at are kept for the session. */
const reviewedNotes = new Set()

function NoteLine({ cards, onSeen, onEdit }) {
  const [idx, setIdx] = useState(0)
  const n = cards.length
  const i = n ? Math.min(idx, n - 1) : 0
  const card = cards[i]

  function go(step) {
    const next = (i + step + n) % n
    onSeen([cards[i].id, cards[next].id])
    setIdx(next)
  }

  if (!card) {
    return (
      <section className={styles.note} aria-label="note to self">
        <PullQuote noTopRule>
          <button type="button" className={styles.noteAdd} onClick={onEdit}>+ add a note to self</button>
        </PullQuote>
        <NoteFolio />
      </section>
    )
  }

  return (
    <section className={styles.note} aria-label="note to self">
      <PullQuote noTopRule text={card.text}>
        {card.image_url && <SignedImg src={card.image_url} alt="" className={styles.noteThumb} />}
      </PullQuote>
      <NoteFolio index={i + 1} total={n} onNext={n > 1 ? () => go(1) : undefined} onEdit={onEdit} />
    </section>
  )
}

/* ── today: a note, how you are, today's practices ────────────────────────── */
function TodayView({ state, actions, onEditNotes, onOpenPractices, onGoNeeds }) {
  const [today, setToday] = useState(() => todayKey())
  const [slot, setSlot] = useState(() => currentSlot())
  useEffect(() => {
    const id = setInterval(() => { setToday(todayKey()); setSlot(currentSlot()) }, 60_000)
    return () => clearInterval(id)
  }, [])

  const checked = state.checkins?.[today] || []
  const practices = usePracticeActions({
    today, checked,
    checkIn: actions.checkIn,
    clearPracticeCheckins: actions.clearPracticeCheckins,
    incrementCheckinCount: actions.incrementCheckinCount,
    setCheckinDetail: actions.setCheckinDetail,
  })
  const zones = zonesFor(state, checked)

  const lastDone = useMemo(() => {
    const stats = createDataStats({ canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [], practices: state.practices || {}, practicesDB: state.practicesDB || [] })
    return new Map(stats.getPracticeStats().map(p => [p.practice?.id || `${p.need.id}_${p.text}`, p.daysSinceLast]))
  }, [state.canvas, state.checkins, state.moods, state.practices, state.practicesDB])

  const slotMood = (state.moods || []).find(m => m.date_key === today && m.prompt_time === slot)
  const band = slotMood ? normalizeBand(slotMood.mood) : null
  const feeling = slotMood?.feeling || null
  const [changing, setChanging] = useState(false) // reopening a saved check-in
  function setMood(b, f) {
    if (!state.userId) return
    actions.logMood?.(state.userId, slot, b, null, today, f || null)
  }

  // The day's earlier check-ins, as the phone's ledger under the check-in: each
  // part of the day with its answer, an earlier one can be added or revised.
  const [dayOpen, setDayOpen] = useState(false)
  const [openRetroSlot, setOpenRetroSlot] = useState(null)
  const todayMoods = (state.moods || []).filter(m => m.date_key === today)
  const moodFor = s => todayMoods.find(m => m.prompt_time === s)
  // an earlier part of the day, saved as the phone saves it (its note kept)
  function setSlotMood(s, b, f) {
    if (!state.userId || !s || !b) return
    actions.logMood?.(state.userId, s, b, moodFor(s)?.note || null, today, f || null)
  }
  // when a part of the day was answered, but only if within its own hours
  const answeredAt = s => {
    const at = moodFor(s)?.created_at
    return at && slotAt(at) === s ? at : null
  }
  const earlier = precedingSlots(slot)
  const ledgerItems = SLOTS.map(s => {
    const m = moodFor(s)
    return {
      name: s,
      isCurrent: s === slot,
      isSelected: s === (openRetroSlot || slot),
      band: m ? normalizeBand(m.mood) : null,
      hasFeeling: !!m?.feeling,
      feeling: m?.feeling || null,
      onTap: s === slot
        ? () => { setOpenRetroSlot(null); setChanging(c => !c) }
        : earlier.includes(s)
          ? () => { setChanging(false); setOpenRetroSlot(o => (o === s ? null : s)) }
          : null,
      isEarlier: earlier.includes(s),
      recordedAt: answeredAt(s),
    }
  })
  const canLookBack = ledgerItems.some(d => d.band) || earlier.length > 0
  const closeLedgerCard = () => { setOpenRetroSlot(null); setDayOpen(false) }

  const cards = state.noteDeck || []
  const [, setReviewTick] = useState(0)

  // Reading the whole deck is a practice: the 'notes to self' one is checked
  // for the day once every note has been looked at.
  const deckReviewed = cards.length > 0 && cards.every(c => reviewedNotes.has(c.id))
  const autoChecked = useRef(null)
  useEffect(() => {
    if (!deckReviewed || autoChecked.current === today) return
    const matches = label => /notes? to self/i.test(label || '')
    let hit = null
    if (state.practicesDB && state.practicesDB.length > 0) {
      const p = state.practicesDB.find(p => !p.archived_at && matches(p.label) && state.canvas?.[p.need_id])
      if (p) hit = { needId: p.need_id, label: p.label, id: p.id }
    } else {
      for (const needId of Object.keys(state.practices || {})) {
        const label = (state.practices[needId] || []).find(matches)
        if (label && state.canvas?.[needId]) { hit = { needId, label, id: null }; break }
      }
    }
    if (!hit) return
    autoChecked.current = today
    const done = checked.some(e => e.need_id === hit.needId && (hit.id && e.practice_id ? e.practice_id === hit.id : e.practice_text === hit.label))
    if (!done) actions.checkIn?.(hit.needId, hit.label, state.canvas[hit.needId], undefined, hit.id)
  }, [deckReviewed, today])

  const shown = zones.filter(z => z.rows.length > 0 || z.target > 0)
  const anyRows = zones.some(z => z.rows.length > 0)
  const doneTotal = zones.reduce((n, z) => n + z.done, 0)
  // the phone's completion rule: each mode's fill, a quarter of the day each
  const dayPct = Math.round(zones.reduce((n, z) => n + z.fill, 0) / zones.length * 100)

  // One need open at a time. It starts on the first one with something left to
  // do, and then stays where the person put it.
  const [openNeedId, setOpenNeedId] = useState(undefined) // undefined = not chosen yet, null = all closed
  useEffect(() => {
    if (openNeedId !== undefined || !anyRows) return
    const rows = shown.flatMap(z => z.rows)
    const first = rows.find(({ need, practice }) => !practices.statusOf(need, practice).done) || rows[0]
    setOpenNeedId(first.need.id)
  }, [openNeedId, anyRows])

  return (
    <div className={styles.view}>
      {/* the phone's head of the day, flush as it is there: date, greeting, the
          day's rule, the note, then how you are with the day's ledger */}
      <div className={styles.dayHead}>
        <Dateline onboardedAt={state.onboardedAt} />
        <Greeting word={SLOT_GREETING[slot]} />
        <ProgressRule tour={null} pct={dayPct} />

        <NoteLine
          cards={cards}
          onSeen={ids => { ids.forEach(id => reviewedNotes.add(id)); setReviewTick(t => t + 1) }}
          onEdit={onEditNotes}
        />

        <CheckIn
          band={band}
          feeling={feeling}
          onBand={b => setMood(b, band === b ? feeling : null)}
          onFeeling={f => {
            if (feeling === f) { setMood(band, null); return }
            setMood(band, f)
            setChanging(false)
          }}
          editing={changing}
          onToggleEdit={() => { setOpenRetroSlot(null); setChanging(c => !c) }}
          inlineFeeling
          stamp
          recordedAt={answeredAt(slot)}
          trailing={canLookBack ? <DayToggle open={dayOpen} onToggle={() => setDayOpen(o => !o)} controls="desk-day-vibrations" /> : null}
        />
        {canLookBack && (
          <div id="desk-day-vibrations" className={`${dpStyles.drop} ${dayOpen ? dpStyles.dropOpen : ''}`} aria-hidden={!dayOpen} {...(dayOpen ? {} : { inert: '' })}>
            <div className={dpStyles.dropClip}>
              <DayLedger
                items={ledgerItems}
                openSlot={openRetroSlot}
                editingCurrent={changing}
                onCardPick={(b, f) => { setSlotMood(openRetroSlot, b, f); setOpenRetroSlot(null) }}
                onCardClose={() => setOpenRetroSlot(null)}
                onReviseTick={() => {}}
                onReviseSave={(b, f) => { setSlotMood(openRetroSlot, b, f); closeLedgerCard() }}
                onReviseCancel={closeLedgerCard}
              />
            </div>
          </div>
        )}
      </div>

      <section className={styles.practices} aria-label="Today's practices">
        <NeedsSection
          state={state}
          checked={checked}
          practices={practices}
          lastDoneMap={lastDone}
          openNeedId={openNeedId}
          onOpenNeed={setOpenNeedId}
          navigate={onOpenPractices}
          onEditPractice={onOpenPractices}
        />
        <div className={styles.prFoot}>
          <span>{doneTotal} today</span>
          <button type="button" className={styles.miniLink} onClick={onOpenPractices}>edit →</button>
        </div>
        {!anyRows && (
          <button type="button" className={styles.empty} onClick={onGoNeeds}>
            choose your needs and practices to see them here →
          </button>
        )}
        {practices.notice && <p className={styles.notice} role="status">{practices.notice}</p>}
      </section>

      {practices.stretchFor && (
        <StretchSheet practice={practices.stretchFor.practice} onSave={practices.saveStretch} onClose={practices.closeStretch} />
      )}
      {practices.timerFor && (
        <TimerTakeover
          label={practices.timerFor.practice.label}
          minutes={practices.statusOf(practices.timerFor.need, practices.timerFor.practice).cfg.minutes}
          onFinish={practices.finishTimer}
          onClose={practices.endTimer}
        />
      )}
    </div>
  )
}

// A docked panel needs room for the page beside it; below this it floats.
function useWide(px) {
  const q = `(min-width: ${px}px)`
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = e => setWide(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return wide
}

const PASSING = new Set(['/today', '/data', '/log', '/drafts', '/practices', '/canvas'])
// views that carry their own close / back control
const SELF_CLOSING = new Set(['profile', 'practices', 'needs', 'notes', 'tags', 'password'])

/* ── the frame ────────────────────────────────────────────────────────────── */
export default function DeskShell({ state, actions, name, email, remindersEnabled, updateRemindersEnabled, moodReminders, updateMoodReminder, notifTypes, updateNotifType, needCount, practiceCount, noteDeckCount, customTagCount, resetTour }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { focus, quiet, panel, setPanel } = useDeskChrome()
  const wide = useWide(1200)
  const [reveal, setReveal] = useState(false) // strip brought back while in focus
  const [host, setHost] = useState(null)  // where the profile portals its contents
  const [back, setBack] = useState(null)   // the panel a sub-view returns to
  const closeT = useRef(null)

  const onWrite = location.pathname === '/write'
  const open = !!panel && !focus
  const docked = open && wide && onWrite
  const stripHidden = focus && !reveal
  const dim = quiet && !reveal

  useEffect(() => { setReveal(false) }, [location.pathname])
  // The panel belongs to the writing page. Another full page (needs, say) takes
  // the window on its own, so the panel steps aside. The legacy paths are only
  // passing through DeskGo on their way to /write and keep what they opened.
  useEffect(() => {
    if (!PASSING.has(location.pathname) && location.pathname !== '/write') setPanel(null)
  }, [location.pathname])
  useEffect(() => () => clearTimeout(closeT.current), [])

  // Open a view that was reached from another panel, remembering the way back.
  function goPanel(view, from) {
    setBack(from ?? null)
    show(view)
  }
  function leave(fallback = 'today') {
    const to = back || fallback
    setBack(null)
    setPanel(to)
  }

  // ⌘/ opens or closes today's panel from anywhere; Esc closes whatever is open.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        show(panel === 'today' ? null : 'today')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function show(view) {
    if (!onWrite) navigate('/write')
    setPanel(view)
  }
  function pressNav(key) {
    setBack(null)
    if (key === 'write') { setPanel(null); if (!onWrite) navigate('/write'); return }
    show(panel === key ? null : key)
  }
  // practices, needs and notes belong to today unless the profile sent you there
  const current = ['practices', 'needs', 'notes'].includes(panel) ? (back === 'profile' ? null : 'today') : panel

  const profile = (
    <ProfileMenu
      desk={{
        open: panel === 'profile' && open,
        host,
        onToggle: () => { setBack(null); show(panel === 'profile' ? null : 'profile') },
        onClose: () => { setBack(null); setPanel(null) },
        onGo: view => goPanel(view, 'profile'),
      }}
      name={name} email={email}
      remindersEnabled={remindersEnabled} updateRemindersEnabled={updateRemindersEnabled}
      moodReminders={moodReminders} updateMoodReminder={updateMoodReminder}
      notifTypes={notifTypes} updateNotifType={updateNotifType}
      needCount={needCount} practiceCount={practiceCount}
      noteDeckCount={noteDeckCount} customTagCount={customTagCount}
      resetTour={resetTour}
    />
  )

  const refreshDeck = deck => actions.updateNoteDeck?.(deck)

  return (
    <>
      {focus && <div className={styles.hot} onMouseEnter={() => { clearTimeout(closeT.current); setReveal(true) }} aria-hidden="true" />}
      <div
        className={styles.dock}
        data-focus={focus ? '' : undefined}
        data-docked={docked ? '' : undefined}
        data-open={open ? '' : undefined}
        onMouseEnter={() => clearTimeout(closeT.current)}
        onMouseLeave={() => { if (focus) { clearTimeout(closeT.current); closeT.current = setTimeout(() => setReveal(false), 320) } }}
        onKeyDown={e => { if (e.key === 'Escape' && open) { setPanel(null) } }}
      >
        <aside
          className={`${styles.strip} ${stripHidden ? styles.stripAway : ''} ${dim ? styles.stripQuiet : ''}`}
          aria-label="Primary"
          data-tour="nav"
        >
          <button type="button" className={styles.brand} onClick={() => pressNav('write')} aria-label="Loam — back to the page" title="back to the page">
            <Wordmark size={21} />
          </button>
          <nav className={styles.nav}>
            {NAV.map(([key, icon]) => {
              const on = key === 'write' ? !open && onWrite : current === key && open
              return (
                <button
                  key={key} type="button"
                  className={`${styles.navItem} ${on ? styles.navOn : ''}`}
                  aria-label={key}
                  aria-pressed={on}
                  onClick={() => pressNav(key)}
                >
                  <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
                  <span className={styles.navLabel}>{key}</span>
                </button>
              )
            })}
          </nav>
          <div className={styles.foot}>{profile}</div>
        </aside>

        {panel && (
          <aside
            className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
            aria-label={panel}
            aria-hidden={open ? undefined : true}
            inert={open ? undefined : ''}
          >
            {!SELF_CLOSING.has(panel) && (
              <button type="button" className={styles.close} onClick={() => setPanel(null)} aria-label="close panel">✕</button>
            )}
            {panel === 'today' && (
              <TodayView
                state={state} actions={actions}
                onEditNotes={() => goPanel('notes', 'today')}
                onOpenPractices={() => goPanel('practices', 'today')}
                onGoNeeds={() => goPanel('needs', 'today')}
              />
            )}
            {panel === 'data' && <div className={styles.screenHost}><Data state={state} compact /></div>}
            {panel === 'drafts' && <div className={styles.screenHost}><Log state={state} syncCheckinDay={actions.syncCheckinDay} /></div>}
            {panel === 'practices' && (
              <div className={styles.screenHost}>
                <Practices
                  state={state}
                  addPractice={actions.addPractice}
                  updatePractice={actions.updatePractice}
                  archivePractice={actions.archivePractice}
                  setPracticeReminder={actions.setPracticeReminder}
                  stampReminderOffered={actions.stampReminderOffered}
                  incrementOffersDeclined={actions.incrementOffersDeclined}
                  completeOnboarding={actions.completeOnboarding}
                  onClose={() => leave('today')}
                  onNeeds={() => setPanel('needs')}
                  backTo={back === 'profile' ? 'profile' : undefined}
                />
              </div>
            )}
            {panel === 'needs' && (
              <div className={styles.screenHost}>
                <CanvasScreen
                  state={state}
                  updateCanvas={actions.updateCanvas}
                  addCustomNeed={actions.addCustomNeed}
                  renameCustomNeed={actions.renameCustomNeed}
                  deleteCustomNeed={actions.deleteCustomNeed}
                  archivePractice={actions.archivePractice}
                  onClose={() => leave('today')}
                  onPractices={() => setPanel('practices')}
                  backTo={back === 'profile' ? 'profile' : undefined}
                />
              </div>
            )}
            {panel === 'notes' && (
              <div className={styles.screenHost}>
                <ManageDeck
                  inline
                  userId={state.userId}
                  backTo={back === 'profile' ? 'profile' : undefined}
                  onClose={() => {
                    if (state.userId) loadNoteDeck(state.userId).then(refreshDeck)
                    leave('today')
                  }}
                  onDeckChanged={refreshDeck}
                />
              </div>
            )}
            {panel === 'tags' && (
              <div className={styles.screenHost}>
                <ManageTags
                  inline
                  userId={state.userId}
                  backTo="profile"
                  onClose={updatedTags => {
                    actions.setCustomTagCount?.(updatedTags.length)
                    leave('profile')
                  }}
                />
              </div>
            )}
            {panel === 'password' && (
              <div className={styles.screenHost}>
                <UpdatePassword inPanel onDone={() => leave('profile')} />
              </div>
            )}
            {panel === 'profile' && <div ref={setHost} className={styles.screenHost} />}
          </aside>
        )}
      </div>

    </>
  )
}
