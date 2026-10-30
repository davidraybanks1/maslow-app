import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { MODES } from '../lib/constants'
import { todayKey } from '../lib/store'
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
import styles from './DeskShell.module.css'

/* The desktop frame (≥900px): a 72px strip that is always one glance wide, and
   a 330px rail that opens beside it.

   The strip carries the four progress rings, the current vibration, the way
   around the app and the profile menu. The rail carries what you would want
   at your elbow while you write: notes to self, how you are, today's practices.

   States — collapsed → peek (hover the rings, or click them: floats over the
   page) → pinned (click the mark, the pin, or ⌘/ : docks and pushes the page).
   While the writing page is in focus the strip itself leaves; a hot zone on
   the left edge brings it back. Below 900px none of this renders. */

const NAV = [
  ['/write', 'write', <path key="a" d="M3 15l.8-3.6L12 3.2a1.4 1.4 0 012 2L5.8 13.4z M10.6 4.6l2.8 2.8" />],
  ['/today', 'today', <g key="a"><circle cx="9" cy="9" r="3" /><path d="M9 2v1.8M9 14.2V16M2 9h1.8M14.2 9H16M4.2 4.2l1.3 1.3M12.5 12.5l1.3 1.3M4.2 13.8l1.3-1.3M12.5 5.5l1.3-1.3" /></g>],
  ['/data', 'data', <g key="a"><rect x="2.5" y="9" width="3" height="6.5" rx="1" /><rect x="7.5" y="3.5" width="3" height="12" rx="1" /><rect x="12.5" y="6.5" width="3" height="9" rx="1" /></g>],
  ['/drafts', 'drafts', <g key="a"><rect x="4.5" y="2.5" width="10" height="12" rx="2" /><path d="M3 5.5v8.2a1.8 1.8 0 001.8 1.8H12 M7.5 6.5h4M7.5 9h4" /></g>],
  ['/practices', 'practices', <g key="a"><circle cx="9" cy="9" r="6.5" /><path d="M6.2 9.2l2 2 3.6-4" /></g>],
]

const R = 13
const CIRC = 2 * Math.PI * R

function Ring({ color, fill, label }) {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" role="img" aria-label={label}>
      <circle cx="17" cy="17" r={R} fill="none" stroke="var(--track)" strokeWidth="3" />
      <circle
        cx="17" cy="17" r={R} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${(fill * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`}
        transform="rotate(-90 17 17)"
        style={{ transition: 'stroke-dasharray 400ms ease' }}
      />
    </svg>
  )
}

function relative(days) {
  if (days == null) return ''
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/* ── notes to self: a row you scroll sideways ─────────────────────────────── */
function NotesRail({ cards, onAdd }) {
  const ref = useRef(null)
  const [i, setI] = useState(0)
  const STEP = 242 // card + gap
  function onScroll() {
    const el = ref.current
    if (el) setI(Math.min(cards.length - 1, Math.max(0, Math.round(el.scrollLeft / STEP))))
  }
  return (
    <section className={styles.notesWrap} aria-label="Notes to self">
      <div className={styles.notesHead}>
        <span className={styles.lbl}>notes to self</span>
        {cards.length > 0 && <span className={styles.count}>{i + 1}/{cards.length}</span>}
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

/* ── the rail ─────────────────────────────────────────────────────────────── */
function Rail({ state, actions, pinned, onPin, onNavigate }) {
  const navigate = useNavigate()
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
    <div className={styles.railInner}>
      <div className={styles.railHead}>
        <h2 className={styles.railTitle}>today.</h2>
        <button type="button" className={styles.pinBtn} onClick={onPin} aria-pressed={pinned}>
          {pinned ? 'unpin' : 'pin'} <kbd>⌘/</kbd>
        </button>
      </div>

      <NotesRail cards={cards} onAdd={() => { onNavigate?.(); navigate('/today', { state: { openDeck: true } }) }} />

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
          <button type="button" className={styles.empty} onClick={() => { onNavigate?.(); navigate('/canvas') }}>
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

// A docked rail needs room for a page beside it; below this it stays a peek.
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

/* ── the frame ────────────────────────────────────────────────────────────── */
export default function DeskShell({ state, actions, name, email, remindersEnabled, updateRemindersEnabled, moodReminders, updateMoodReminder, notifTypes, updateNotifType, needCount, practiceCount, noteDeckCount, customTagCount, resetTour }) {
  const { pathname } = useLocation()
  const { focus, quiet, pinned, setPinned } = useDeskChrome()
  const railAvailable = pathname !== '/today' // Today already is the rail, bigger
  const [peek, setPeek] = useState(false)
  const [reveal, setReveal] = useState(false) // strip brought back while in focus
  const openT = useRef(null)
  const closeT = useRef(null)
  const dockRef = useRef(null)

  const today = todayKey()
  const checked = state.checkins?.[today] || []
  const zones = zonesFor(state, checked)
  const slot = currentSlot()
  const slotMood = (state.moods || []).find(m => m.date_key === today && m.prompt_time === slot)
  const band = slotMood ? normalizeBand(slotMood.mood) : null

  const wide = useWide(1200)
  const railPinned = railAvailable && pinned && !focus && wide
  const railOpen = railAvailable && (railPinned || peek)
  const stripHidden = focus && !reveal
  const dim = quiet && !peek && !reveal

  // Esc / route change closes any floating state.
  useEffect(() => { setPeek(false); setReveal(false) }, [pathname])

  // ⌘/ (ctrl+/) pins or unpins the rail from anywhere.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        if (railAvailable) setPinned(p => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [railAvailable, setPinned])

  useEffect(() => () => { clearTimeout(openT.current); clearTimeout(closeT.current) }, [])

  function scheduleOpen() {
    clearTimeout(closeT.current)
    if (!railAvailable || railOpen) return
    clearTimeout(openT.current)
    openT.current = setTimeout(() => setPeek(true), 160)
  }
  function scheduleClose() {
    clearTimeout(openT.current)
    clearTimeout(closeT.current)
    closeT.current = setTimeout(() => { setPeek(false); setReveal(false) }, 320)
  }
  function cancelClose() { clearTimeout(closeT.current) }

  const glance = (
    <div
      className={styles.glance}
      onMouseEnter={scheduleOpen}
      onClick={() => { clearTimeout(openT.current); if (railAvailable) setPeek(p => !p) }}
      role="button"
      tabIndex={0}
      aria-label="today at a glance — open the rail"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (railAvailable) setPeek(p => !p) } }}
    >
      <div className={styles.rings}>
        {zones.map(z => <Ring key={z.mode} color={MODES[z.mode].pip} fill={z.fill} label={`${z.mode} ${z.done} of ${z.target}`} />)}
      </div>
      <div className={styles.vd} title="how you are right now">{band ? BAND_LABEL[band] : '–'}</div>
    </div>
  )

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

  return (
    <>
      {focus && <div className={styles.hot} onMouseEnter={() => { clearTimeout(closeT.current); setReveal(true) }} aria-hidden="true" />}
      <div
        ref={dockRef}
        className={styles.dock}
        data-focus={focus ? '' : undefined}
        data-pinned={railPinned ? '' : undefined}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onKeyDown={e => { if (e.key === 'Escape') { setPeek(false); setReveal(false) } }}
      >
        <aside
          className={`${styles.strip} ${stripHidden ? styles.stripAway : ''} ${dim ? styles.stripQuiet : ''}`}
          aria-label="Primary"
          data-tour="nav"
        >
          <button
            type="button" className={styles.brand}
            onClick={() => railAvailable && setPinned(p => !p)}
            aria-label={railPinned ? 'unpin the rail' : 'pin the rail'}
            title={railAvailable ? 'pin the rail (⌘/)' : 'Loam'}
          >
            <LoamMark width={34} />
          </button>
          {glance}
          <nav className={styles.nav}>
            {NAV.map(([to, label, icon]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navOn : ''}`} aria-label={label} title={label}>
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
                <span className={styles.navLabel}>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className={styles.foot}>{profile}</div>
        </aside>

        {railAvailable && (
          <aside
            className={`${styles.rail} ${railOpen && !stripHidden ? styles.railOpen : ''} ${railPinned ? styles.railPinned : ''}`}
            aria-label="Today"
            aria-hidden={railOpen ? undefined : true}
            inert={railOpen ? undefined : ''}
          >
            <Rail
              state={state} actions={actions} pinned={railPinned}
              onPin={() => setPinned(p => !p)}
              onNavigate={() => setPeek(false)}
            />
          </aside>
        )}
      </div>
    </>
  )
}
