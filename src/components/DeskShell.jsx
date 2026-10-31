import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MODES } from '../lib/constants'
import { todayKey, loadNoteDeck } from '../lib/store'
import { currentSlot } from '../lib/slots'
import { normalizeBand, BAND_LABEL, BANDS, FEELINGS } from '../lib/frequency'
import { zonesFor } from '../lib/dayProgress'
import { createDataStats } from '../lib/dataStats'
import { usePracticeActions } from '../lib/usePracticeActions'
import { useDeskChrome } from '../lib/deskChrome'
import LoamMark from './LoamMark'
import ProfileMenu from './ProfileMenu'
import SignedImg from './SignedImg'
import StretchSheet from './StretchSheet'
import ManageDeck from './ManageDeck'
import ManageTags from './ManageTags'
import Data from '../screens/Data'
import Log from '../screens/Log'
import Practices from '../screens/Practices'
import styles from './DeskShell.module.css'

/* The desktop frame (≥900px).

   The writing page is the only full page. Around it: a 72px strip with the way
   around the app, and a side panel that opens beside it. Today, data and drafts
   all open in that panel (at the phone's layout, so everything on the phone is
   here too), and practices opens from a link inside the today panel.

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

function relative(days) {
  if (days == null) return ''
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/* ── notes to self: a row you scroll sideways ─────────────────────────────── */
function NotesRail({ cards, onAdd, onEdit }) {
  const ref = useRef(null)
  const [i, setI] = useState(0)
  const STEP = 242 // card + gap
  function onScroll() {
    const el = ref.current
    if (el) setI(Math.min(Math.max(cards.length - 1, 0), Math.max(0, Math.round(el.scrollLeft / STEP))))
  }
  return (
    <section className={styles.notesWrap} aria-label="Notes to self">
      <div className={styles.notesHead}>
        <span className={styles.lbl}>notes to self</span>
        <span className={styles.headRight}>
          {cards.length > 0 && <span className={styles.count}>{i + 1}/{cards.length}</span>}
          <button type="button" className={styles.miniLink} onClick={onEdit}>edit</button>
        </span>
      </div>
      <div
        className={styles.notes}
        ref={ref}
        onScroll={onScroll}
        tabIndex={0}
        role="group"
        aria-label="scroll sideways through your notes"
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { e.preventDefault(); ref.current?.scrollBy({ left: STEP, behavior: 'smooth' }) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); ref.current?.scrollBy({ left: -STEP, behavior: 'smooth' }) }
        }}
      >
        {cards.map(c => (
          <div key={c.id} className={`${styles.nc} ${c.image_url ? styles.ncPhoto : ''}`}>
            {c.image_url && <SignedImg src={c.image_url} alt="" className={styles.ncImg} />}
            {c.text && <span className={c.image_url ? styles.ncCap : styles.ncText}>{c.text}</span>}
          </div>
        ))}
        <button type="button" className={`${styles.nc} ${styles.ncAdd}`} onClick={onAdd}>+ add a note</button>
      </div>
      {cards.length > 1 && (
        <div className={styles.dots} aria-hidden="true">
          {cards.map((c, k) => <i key={c.id} className={k === i ? styles.dotOn : ''} />)}
        </div>
      )}
    </section>
  )
}

/* ── today: notes, how you are, today's practices ─────────────────────────── */
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
  function setMood(b, f) {
    if (!state.userId) return
    actions.logMood?.(state.userId, slot, b, null, today, f || null)
  }

  const cards = state.noteDeck || []
  const anyRows = zones.some(z => z.rows.length > 0)

  return (
    <div className={styles.view}>
      <h2 className={styles.viewTitle}>today.</h2>

      <NotesRail cards={cards} onAdd={onEditNotes} onEdit={onEditNotes} />

      <section className={styles.card} aria-label="Vibrations">
        <div className={styles.lbl}>vibrations</div>
        <div className={styles.vibQ}>how are you this {slot === 'midday' ? 'afternoon' : slot}?</div>
        <div className={styles.vib} role="group" aria-label="mood">
          {BANDS.map(b => (
            <button
              key={b} type="button"
              className={`${styles.vibBtn} ${band === b ? styles.vibSel : ''}`}
              aria-pressed={band === b}
              onClick={() => setMood(b, band === b ? feeling : null)}
            >{BAND_LABEL[b]}</button>
          ))}
        </div>
        {band && (
          <div className={styles.feels} role="group" aria-label="vibration">
            {FEELINGS[band].map(f => (
              <button
                key={f} type="button"
                className={`${styles.feel} ${feeling === f ? styles.feelSel : ''}`}
                aria-pressed={feeling === f}
                onClick={() => setMood(band, feeling === f ? null : f)}
              >{f}</button>
            ))}
          </div>
        )}
      </section>

      <section className={styles.card} aria-label="Today's practices">
        <div className={styles.cardHead}>
          <span className={styles.lbl}>practices</span>
          <button type="button" className={styles.miniLink} onClick={onOpenPractices}>edit practices →</button>
        </div>
        {zones.filter(z => z.rows.length > 0 || z.target > 0).map(z => (
          <div key={z.mode} className={styles.zone}>
            <div className={styles.zoneHead}>
              <span className={styles.zoneName}><i className={styles.zdot} style={{ background: MODES[z.mode].pip }} />{z.mode}</span>
              <span className={styles.zoneN}>{z.done}/{z.target}</span>
            </div>
            <div className={styles.bar}><i style={{ width: `${Math.round(z.fill * 100)}%`, background: MODES[z.mode].pip }} /></div>
            {z.rows.map(({ need, practice }) => {
              const st = practices.statusOf(need, practice)
              const days = lastDone.get(practice.id || `${need.id}_${practice.label}`)
              const tally = st.kind === 'check' && st.cfg.target > 1 && !st.done && st.tally > 0 ? `${st.tally}/${st.cfg.target}` : null
              return (
                <button
                  key={st.key} type="button"
                  className={`${styles.pr} ${st.done ? styles.prDone : ''}`}
                  aria-pressed={st.done}
                  onClick={() => practices.tap(need, z.mode, practice)}
                >
                  <span className={styles.chk} aria-hidden="true">
                    {st.done && (
                      <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="var(--exploration)" /><path d="M4.6 8.2l2.3 2.3 4.5-4.6" stroke="#EFEADD" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </span>
                  <span className={styles.prName}>{practice.label}</span>
                  <small>{st.done ? (st.count > 1 ? `×${st.count}` : 'today') : (tally || relative(days))}</small>
                </button>
              )
            })}
          </div>
        ))}
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

const PASSING = new Set(['/today', '/data', '/log', '/drafts', '/practices'])

/* ── the frame ────────────────────────────────────────────────────────────── */
export default function DeskShell({ state, actions, name, email, remindersEnabled, updateRemindersEnabled, moodReminders, updateMoodReminder, notifTypes, updateNotifType, needCount, practiceCount, noteDeckCount, customTagCount, resetTour }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { focus, quiet, panel, setPanel } = useDeskChrome()
  const wide = useWide(1200)
  const [reveal, setReveal] = useState(false) // strip brought back while in focus
  const [deckOpen, setDeckOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const closeT = useRef(null)
  const fromProfile = useRef(false)

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

  // Handed over from the profile menu (it opens the notes and tags managers by
  // navigating to Today, and remembers where to go back to).
  useEffect(() => {
    const st = location.state || {}
    if (st.fromProfile) fromProfile.current = true
    if (st.openDeck) { setDeckOpen(true); navigate(location.pathname, { replace: true, state: {} }) }
    else if (st.openTags) { setTagsOpen(true); navigate(location.pathname, { replace: true, state: {} }) }
  }, [location.state])

  function backToProfile() {
    if (!fromProfile.current) return false
    fromProfile.current = false
    navigate('/write', { replace: true, state: { openProfile: true } })
    return true
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
    if (key === 'write') { setPanel(null); if (!onWrite) navigate('/write'); return }
    show(panel === key ? null : key)
  }
  const current = panel === 'practices' ? 'today' : panel

  const profile = (
    <ProfileMenu
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
        data-view={panel === 'today' ? 'today' : 'wide'}
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
            <LoamMark width={34} />
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
            {panel !== 'practices' && (
              <button type="button" className={styles.close} onClick={() => setPanel(null)} aria-label="close panel">✕</button>
            )}
            {panel === 'today' && (
              <TodayView
                state={state} actions={actions}
                onEditNotes={() => setDeckOpen(true)}
                onOpenPractices={() => setPanel('practices')}
                onGoNeeds={() => { setPanel(null); navigate('/canvas') }}
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
                  onClose={() => { if (backToProfile()) setPanel(null); else setPanel('today') }}
                />
              </div>
            )}
          </aside>
        )}
      </div>

      {deckOpen && (
        <ManageDeck
          userId={state.userId}
          onClose={() => {
            setDeckOpen(false)
            if (state.userId) loadNoteDeck(state.userId).then(refreshDeck)
            backToProfile()
          }}
          onDeckChanged={refreshDeck}
        />
      )}
      {tagsOpen && (
        <ManageTags
          userId={state.userId}
          onClose={updatedTags => {
            setTagsOpen(false)
            actions.setCustomTagCount?.(updatedTags.length)
            backToProfile()
          }}
        />
      )}
    </>
  )
}
