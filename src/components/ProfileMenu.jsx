import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isNative, checkNotifPermission, requestNotifPermission } from '../lib/native'
import styles from './ProfileMenu.module.css'

const SLOTS = ['morning', 'midday', 'evening']
const DEFAULT_SLOT_TIMES = { morning: '09:00', midday: '13:00', evening: '19:00' }
// quick picks, in minutes after midnight
const PRESETS = {
  morning: [420, 480, 540, 600],
  midday: [720, 780, 840],
  evening: [1140, 1200, 1230, 1290],
}
const TONES = [
  { key: 'streaks', label: 'streaks', desc: 'cheers you on when a practice keeps going', example: '“five mornings of stretching in a row.”' },
  { key: 'skips', label: 'skips', desc: 'lets you know when a practice has gone quiet', example: '“no walk for three days. today, maybe?”' },
  { key: 'plain', label: 'time reminders', desc: 'nudges you at the time you set on a practice', example: '“reading · 8:30 pm”' },
]
// the four modes as lit spheres: light / base / dark
const SPHERES = [
  ['#7c9a8b', '#1B3A2D', '#0f2219'],
  ['#eef3eb', '#ABBEA3', '#869c7d'],
  ['#feecb6', '#F5B622', '#c98d07'],
  ['#fdbba6', '#F55127', '#c63a14'],
]
const lit = ([a, b, c]) => `radial-gradient(circle at 34% 26%, ${a} 0%, ${b} 55%, ${c} 100%)`
const GREEN_SPHERE = lit(SPHERES[0])

const FEEDBACK_EMAIL = 'hello@mymaslow.com'
const APP_VERSION = '1.0'
const DAY_START = 360 // 6 am
const DAY_SPAN = 1020 // 6 am to 11 pm

const toMinutes = hhmm => {
  const [h, m] = String(hhmm || '').split(':').map(n => parseInt(n, 10))
  return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0)
}
const wrap = m => ((m % 1440) + 1440) % 1440
const toHHMM = m => {
  const v = wrap(m)
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}
function fmt(m) {
  const v = wrap(m), h = Math.floor(v / 60), mm = v % 60
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
function short(m) {
  const v = wrap(m), h = Math.floor(v / 60), mm = v % 60
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`
}
const dayPos = m => `${Math.min(100, Math.max(0, ((m - DAY_START) / DAY_SPAN) * 100)).toFixed(1)}%`

function Toggle({ on, onClick, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
      onClick={onClick}
    >
      <span className={styles.toggleKnob} />
    </button>
  )
}

function Chevron({ dir = 'right' }) {
  if (dir === 'down') {
    return <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true"><path d="M1 1l6 6 6-6" fill="none" stroke="#8a8273" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
  return <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="#8a8273" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function ProfileMenu({
  name, email,
  remindersEnabled, updateRemindersEnabled,
  moodReminders, updateMoodReminder,
  notifTypes, updateNotifType,
  needCount = 0,
  noteDeckCount = 0,
  customTagCount = 0,
  resetTour,
}) {
  const [phase, setPhase] = useState(null) // null | 'open' | 'closing'
  const [page, setPage] = useState('home') // 'home' | 'reminders'
  const [moreOpen, setMoreOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null | slot
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [notifPermission, setNotifPermission] = useState('prompt')
  const navigate = useNavigate()
  const location = useLocation()
  const avatarRef = useRef(null)
  const panelRef = useRef(null)
  const bodyRef = useRef(null)
  const closeTimerRef = useRef(null)

  const mounted = phase !== null
  const isOpen = phase === 'open'
  const on = !!remindersEnabled

  const initial = ((name || email || '').trim()[0] || '?').toUpperCase()
  const displayName = (name || (email || '').split('@')[0] || 'you').trim().toLowerCase()

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  // Re-open the profile when returning from a profile sub-page (needs / notes / tags).
  // The navigate state { openProfile: true } is set by the sub-page's ✕ button.
  useEffect(() => {
    if (!location.state?.openProfile) return
    openMenu()
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isNative()) return
    checkNotifPermission().then(p => setNotifPermission(p))
  }, [])

  // While reminders are off the body is dimmed and shouldn't take focus either.
  useEffect(() => {
    if (!bodyRef.current) return
    if (on) bodyRef.current.removeAttribute('inert')
    else bodyRef.current.setAttribute('inert', '')
  }, [on, page, mounted])

  // Focus the panel when it opens so Escape and tabbing start inside it.
  useEffect(() => {
    if (isOpen) panelRef.current?.focus()
  }, [isOpen])

  function resetView() {
    setPage('home')
    setMoreOpen(false)
    setEditing(null)
    setConfirmSignOut(false)
  }

  function openMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    resetView()
    setPhase('open')
  }

  function close(onDone) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      setPhase(null)
      resetView()
      if (!onDone) avatarRef.current?.focus()
      onDone?.()
    }
    if (reduced) { finish(); return }
    const mobile = !window.matchMedia('(min-width: 900px)').matches
    setPhase('closing')
    closeTimerRef.current = setTimeout(finish, mobile ? 220 : 150)
  }

  useEffect(() => {
    if (!mounted) return
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (confirmSignOut) setConfirmSignOut(false)
      else close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  async function handleSignOut() {
    close()
    await supabase.auth.signOut()
    navigate('/signin')
  }

  async function handleMasterToggle() {
    if (on) { updateRemindersEnabled?.(false); return }
    if (!isNative()) {
      // On web there's no OS permission to ask for; record the setting for the iOS app.
      updateRemindersEnabled?.(true)
      return
    }
    let p = notifPermission
    if (p === 'prompt') {
      p = await requestNotifPermission()
      setNotifPermission(p)
    }
    if (p === 'granted') updateRemindersEnabled?.(true)
    // 'denied': don't flip; the caption points to iOS settings instead.
  }

  const slotData = slot => moodReminders?.[slot] || { on: true, time: DEFAULT_SLOT_TIMES[slot] }
  const slotMinutes = slot => toMinutes(slotData(slot).time || DEFAULT_SLOT_TIMES[slot])
  function saveSlot(slot, { minutes, on: slotOn }) {
    updateMoodReminder?.(slot, { on: slotOn, time: toHHMM(minutes ?? slotMinutes(slot)) })
  }

  const toneOn = key => (notifTypes ? notifTypes[key] !== false : true)
  const slotsOn = SLOTS.filter(s => slotData(s).on).length
  const tonesOn = TONES.filter(t => toneOn(t.key)).length
  const permissionDenied = isNative() && notifPermission === 'denied' && !on

  const goTo = (path, state) => close(() => navigate(path, { state: { fromProfile: true, returnTo: location.pathname, ...state } }))

  const home = (
    <div className={`${styles.view} ${styles.viewIn}`} key="home">
      <div className={styles.titleRow}>
        <h2 className={styles.title}>profile.</h2>
        <button type="button" className={styles.closeBtn} aria-label="close" onClick={() => close()}>
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="#1d1b16" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className={`${styles.card} ${styles.identity}`}>
        <div className={styles.name}>{displayName}</div>
        <div className={styles.mono}>
          {needCount} need{needCount !== 1 ? 's' : ''} · {noteDeckCount} note{noteDeckCount !== 1 ? 's' : ''} to self
        </div>
      </div>

      <div className={styles.tiles}>
        <button type="button" className={`${styles.card} ${styles.tile}`} onClick={() => goTo('/canvas')}>
          <div className={styles.spheres} aria-hidden="true">
            {SPHERES.map((s, i) => <span key={i} className={styles.sphere9} style={{ background: lit(s) }} />)}
          </div>
          <div className={styles.tileText}><span className={styles.tileLabel}>needs</span><span className={styles.mono}>{needCount} · modes</span></div>
        </button>
        <button type="button" className={`${styles.card} ${styles.tile}`} onClick={() => goTo('/today', { openDeck: true })}>
          <span className={styles.tileNum}>{noteDeckCount}</span>
          <div className={styles.tileText}><span className={styles.tileLabel}>notes to self</span><span className={styles.mono}>on today</span></div>
        </button>
        <button type="button" className={`${styles.card} ${styles.tile}`} onClick={() => goTo('/today', { openTags: true })}>
          <span className={styles.tileNum}>{customTagCount}</span>
          <div className={styles.tileText}><span className={styles.tileLabel}>tags</span><span className={styles.mono}>custom</span></div>
        </button>
      </div>

      <button type="button" className={`${styles.card} ${styles.remCard}`} onClick={() => setPage('reminders')}>
        <div className={styles.remHead}>
          <div className={styles.remTitleCol}>
            <span className={styles.remTitle}>reminders</span>
            <span className={styles.mono}>
              {on ? `${slotsOn} check-in${slotsOn !== 1 ? 's' : ''} · ${tonesOn} practice nudge${tonesOn !== 1 ? 's' : ''} on` : 'off'}
            </span>
          </div>
          <Chevron />
        </div>
        <div className={styles.dayLine}>
          <div className={styles.dayRule} />
          <span className={`${styles.dayEnd} ${styles.dayEndL}`}>6 am</span>
          <span className={`${styles.dayEnd} ${styles.dayEndR}`}>11 pm</span>
          {SLOTS.map(s => {
            const d = slotData(s), m = slotMinutes(s), lightOn = on && d.on
            return (
              <div key={s} className={styles.dayStop} style={{ left: dayPos(m) }}>
                <span
                  className={`${styles.daySphere} ${lightOn ? '' : styles.daySphereOff}`}
                  style={lightOn ? { background: GREEN_SPHERE } : undefined}
                />
                <span className={`${styles.dayTime} ${lightOn ? '' : styles.dayTimeOff}`}>{lightOn ? short(m) : 'off'}</span>
              </div>
            )
          })}
        </div>
      </button>

      <div className={styles.more}>
        <button type="button" className={styles.moreHead} aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>
          <div className={styles.moreText}>
            <span className={styles.moreTitle}>account, help &amp; about</span>
            <span className={styles.mono}>{email ? `${email} · ` : ''}version {APP_VERSION}</span>
          </div>
          <span className={`${styles.moreChevron} ${moreOpen ? styles.moreChevronOpen : ''}`}><Chevron dir="down" /></span>
        </button>
        {moreOpen && (
          <div className={styles.moreList}>
            {email && (
              <div className={styles.moreRow}><span>email address</span><span className={styles.mono}>{email}</span></div>
            )}
            <button type="button" className={styles.moreRow} onClick={() => close(() => navigate('/password'))}>change password</button>
            {resetTour && (
              <button type="button" className={styles.moreRow} onClick={() => { resetTour(); close() }}>show hints again</button>
            )}
            <a className={styles.moreRow} href={`mailto:${FEEDBACK_EMAIL}?subject=Loam%20feedback`} onClick={() => close()}>suggest something</a>
            <div className={styles.legalRow}>
              <a href="https://mymaslow.com/privacy" target="_blank" rel="noopener noreferrer">privacy</a>
              <a href="https://mymaslow.com/terms" target="_blank" rel="noopener noreferrer">terms</a>
            </div>
          </div>
        )}
      </div>

      <button type="button" className={styles.signOut} onClick={() => setConfirmSignOut(true)}>sign out</button>
    </div>
  )

  const reminders = (
    <div className={`${styles.view} ${styles.viewIn}`} key="reminders">
      <div className={styles.remPageHead}>
        <button type="button" className={styles.back} onClick={() => { setPage('home'); setEditing(null) }}>
          <svg width="7" height="12" viewBox="0 0 8 14" aria-hidden="true"><path d="M7 1L1 7l6 6" fill="none" stroke="#3d392f" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          profile
        </button>
        <div className={styles.remPageRow}>
          <h2 className={styles.title}>reminders.</h2>
          <Toggle on={on} onClick={handleMasterToggle} label="all reminders" />
        </div>
        <div className={styles.mono}>
          {permissionDenied
            ? 'turn on notifications for Loam in your ios settings.'
            : on ? 'nudges arrive on your iphone' : 'off · you won’t get any nudges'}
        </div>
      </div>

      <div ref={bodyRef} className={`${styles.remBody} ${on ? '' : styles.remBodyOff}`}>
        <div className={`${styles.card} ${styles.listCard}`}>
          <div className={`${styles.mono} ${styles.cardLabel}`}>mood check-ins</div>
          {SLOTS.map((slot, i) => {
            const d = slotData(slot), m = slotMinutes(slot), sel = editing === slot
            return (
              <div key={slot} className={`${styles.slot} ${i < SLOTS.length - 1 ? styles.rule : ''}`}>
                <div className={styles.slotRow}>
                  <div className={styles.slotText}>
                    <span className={styles.slotLabel}>{slot}</span>
                    <span className={styles.mono}>{d.on ? `${slot} check-in · ${fmt(m)}` : `no ${slot} check-in`}</span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.pill} ${sel ? styles.pillEditing : ''} ${d.on ? '' : styles.pillOff}`}
                    aria-expanded={sel}
                    aria-label={`${slot} time, ${d.on ? fmt(m) : 'off'}`}
                    onClick={() => setEditing(sel ? null : slot)}
                  >{d.on ? fmt(m) : 'off'}</button>
                  <Toggle on={!!d.on} onClick={() => saveSlot(slot, { on: !d.on })} label={`${slot} check-in`} />
                </div>
                {sel && (
                  <div className={styles.editor}>
                    <div className={styles.stepper}>
                      <button type="button" className={styles.stepBtn} onClick={() => saveSlot(slot, { minutes: m - 15, on: true })}>− 15 min</button>
                      <span className={styles.stepTime}>{fmt(m)}</span>
                      <button type="button" className={styles.stepBtn} onClick={() => saveSlot(slot, { minutes: m + 15, on: true })}>+ 15 min</button>
                    </div>
                    <div className={styles.presets}>
                      {PRESETS[slot].map(t => {
                        const active = d.on && m === t
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`${styles.preset} ${active ? styles.presetActive : ''}`}
                            onClick={() => saveSlot(slot, { minutes: t, on: true })}
                          >{fmt(t)}</button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className={`${styles.card} ${styles.listCard}`}>
          <div className={`${styles.mono} ${styles.cardLabel}`}>practice reminders</div>
          {TONES.map((t, i) => (
            <div key={t.key} className={`${styles.tone} ${i < TONES.length - 1 ? styles.rule : ''}`}>
              <div className={styles.toneText}>
                <span className={styles.toneLabel}>{t.label}</span>
                <span className={`${styles.mono} ${styles.toneDesc}`}>{t.desc}</span>
                <span className={styles.toneExample}>{t.example}</span>
              </div>
              <Toggle on={toneOn(t.key)} onClick={() => updateNotifType?.(t.key, !toneOn(t.key))} label={t.label} />
            </div>
          ))}
        </div>
        {notifTypes && Object.values(notifTypes).every(v => v === false) && (
          <div className={`${styles.mono} ${styles.foot}`}>with all three off, practice reminders stay silent.</div>
        )}
        <div className={`${styles.mono} ${styles.foot}`}>you’ll get these on your iphone.</div>
      </div>
    </div>
  )

  const confirmEl = confirmSignOut && (
    <div className={styles.confirmScrim} onClick={() => setConfirmSignOut(false)}>
      <div className={`${styles.card} ${styles.dialog}`} role="dialog" aria-modal="true" aria-label="sign out" onClick={e => e.stopPropagation()}>
        <div className={styles.dialogTitle}>sign out of Loam?</div>
        <div className={styles.dialogBody}>
          {email ? `everything stays saved to ${email}. you can sign back in any time.` : 'everything stays saved. you can sign back in any time.'}
        </div>
        <div className={styles.dialogBtns}>
          <button type="button" className={styles.dialogPrimary} onClick={handleSignOut}>sign out</button>
          <button type="button" className={styles.dialogCancel} onClick={() => setConfirmSignOut(false)}>not now</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.wrapper}>
      <button
        ref={avatarRef}
        data-tour="profile"
        className={`${styles.avatar} ${isOpen ? styles.avatarOpen : ''}`}
        onClick={() => (phase === 'open' ? close() : openMenu())}
        aria-label="Account menu"
        aria-expanded={isOpen}
      >
        {initial}
      </button>

      {mounted && createPortal(
        <div className={styles.layer}>
          <div className={`${styles.scrim} ${phase === 'closing' ? styles.scrimClosing : ''}`} onClick={() => close()} />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="profile"
            className={`${styles.panel} ${phase === 'closing' ? styles.panelClosing : ''}`}
          >
            <div className={styles.scroll}>
              {page === 'home' ? home : reminders}
            </div>
            {confirmEl}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
