import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './ProfileMenu.module.css'

const FEEDBACK_EMAIL = 'hello@mymaslow.com'
const BUILD_TIME = import.meta.env.VITE_BUILD_TIME

const REVIEW_DAYS = [
  { value: 0, label: 'mon' },
  { value: 1, label: 'tue' },
  { value: 2, label: 'wed' },
  { value: 3, label: 'thu' },
  { value: 4, label: 'fri' },
  { value: 5, label: 'sat' },
  { value: 6, label: 'sun' },
]

function formatBuildTime(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }).toLowerCase()
  } catch { return null }
}

export default function ProfileMenu({
  name, email, dropUp = false,
  showNoteToSelf, updateShowNoteToSelf,
  reviewCadence, updateReviewCadence,
  reviewDay, reviewTime, updateReviewSchedule,
  noteDeckCount = 0,
  customTagCount = 0,
}) {
  const [phase, setPhase] = useState(null) // null | 'open' | 'closing'
  const [cadenceOpen, setCadenceOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const closeTimerRef = useRef(null)

  const mounted = phase !== null
  const isOpen = phase === 'open'

  const initial = ((name || email || '').trim()[0] || '?').toUpperCase()
  const cadence = reviewCadence || 'weekly'
  const builtAt = formatBuildTime(BUILD_TIME)

  // Cleanup timer on unmount
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  function openMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setCadenceOpen(false)
    setConfirmSignOut(false)
    setPhase('open')
  }

  function close(onDone) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPhase(null)
      setCadenceOpen(false)
      setConfirmSignOut(false)
      onDone?.()
      return
    }
    const mobile = !window.matchMedia('(min-width: 900px)').matches
    const duration = mobile ? 220 : 150
    setPhase('closing')
    closeTimerRef.current = setTimeout(() => {
      setPhase(null)
      setCadenceOpen(false)
      setConfirmSignOut(false)
      onDone?.()
    }, duration)
  }

  async function handleSignOut() {
    close()
    await supabase.auth.signOut()
    navigate('/signin')
  }

  useEffect(() => {
    if (!mounted) return
    function onOutside(e) {
      if (!wrapperRef.current?.contains(e.target)) close()
    }
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [mounted])

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        className={`${styles.avatar} ${isOpen ? styles.avatarOpen : ''}`}
        onClick={() => (phase === 'open' ? close() : openMenu())}
        aria-label="Account menu"
        aria-expanded={isOpen}
      >
        {initial}
      </button>

      {mounted && (
        <>
          <div
            className={`${styles.scrim} ${phase === 'closing' ? styles.scrimClosing : ''}`}
            onClick={close}
          />
          <div className={`${styles.menu} ${phase === 'closing' ? styles.menuClosing : ''} ${dropUp ? styles.menuDropUp : ''}`}>

            {/* ── Drag handle (mobile sheet only) ── */}
            <div className={styles.dragHandle} />

            {/* ── Sheet header (mobile only) ── */}
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>profile.</span>
              <button className={styles.closeBtn} onClick={close}>✕</button>
            </div>

            {/* ── Scrollable content (rows dissolve through the bottom fade) ── */}
            <div className={styles.scrollBody}>

            {/* ── PERSONALIZE ── */}
            <div className={styles.sectionLabel}>PERSONALIZE</div>
            <div className={styles.section}>
              <NavLink to="/canvas" className={styles.row} onClick={close}>
                <div className={styles.rowContent}>
                  <div className={styles.rowTitle}>your canvas</div>
                  <div className={styles.rowSub}>needs, modes &amp; practices</div>
                </div>
              </NavLink>
              <button
                className={styles.row}
                onClick={() => close(() => navigate('/today', { state: { openDeck: true } }))}
              >
                <div className={styles.rowContent}>
                  <div className={styles.rowTitle}>your note deck</div>
                  <div className={`${styles.rowSub} ${noteDeckCount > 5 ? styles.rowSubOver : ''}`}>
                    {noteDeckCount}/5 on your today screen
                  </div>
                </div>
              </button>
              <button
                className={styles.row}
                onClick={() => close(() => navigate('/today', { state: { openTags: true } }))}
              >
                <div className={styles.rowContent}>
                  <div className={styles.rowTitle}>your tags</div>
                  <div className={styles.rowSub}>
                    {customTagCount} custom tag{customTagCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </button>
              <button
                className={styles.row}
                onClick={() => { setConfirmSignOut(false); updateShowNoteToSelf?.(!showNoteToSelf) }}
              >
                <span className={styles.rowTitle}>show note to self</span>
                <div className={styles.toggleSwitch}>
                  <div className={`${styles.toggleTrack} ${showNoteToSelf ? styles.toggleTrackOn : ''}`}>
                    <span className={`${styles.toggleKnob} ${showNoteToSelf ? styles.toggleKnobOn : ''}`} />
                  </div>
                </div>
              </button>
              <button
                className={styles.row}
                onClick={() => { setConfirmSignOut(false); setCadenceOpen(o => !o) }}
              >
                <span className={styles.rowTitle}>review cadence</span>
                <span className={styles.rowMeta}>&nbsp;· {cadence}</span>
                <span className={styles.rowChevron}>›</span>
              </button>
              {cadenceOpen && (
                <div className={styles.cadencePicker}>
                  <div className={styles.cadenceSection}>
                    <button
                      className={`${styles.cadenceBtn} ${cadence === 'weekly' ? styles.cadenceBtnActive : ''}`}
                      onClick={() => updateReviewCadence?.('weekly')}
                    >weekly</button>
                    <button
                      className={`${styles.cadenceBtn} ${cadence === 'daily' ? styles.cadenceBtnActive : ''}`}
                      onClick={() => updateReviewCadence?.('daily')}
                    >daily</button>
                  </div>
                  {cadence === 'weekly' && (
                    <>
                      <div className={styles.cadenceFieldLabel}>day</div>
                      <div className={styles.cadenceDayRow}>
                        {REVIEW_DAYS.map(d => (
                          <button
                            key={d.value}
                            className={`${styles.cadenceDayBtn} ${reviewDay === d.value ? styles.cadenceBtnActive : ''}`}
                            onClick={() => updateReviewSchedule?.(d.value, reviewTime || '10:00')}
                          >{d.label}</button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className={styles.cadenceFieldLabel}>time</div>
                  <input
                    type="time"
                    className={styles.cadenceTimeInput}
                    value={reviewTime || '10:00'}
                    onChange={e => updateReviewSchedule?.(reviewDay ?? 0, e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* ── ACCOUNT ── */}
            <div className={styles.sectionLabel}>ACCOUNT</div>
            <div className={styles.section}>
              <div className={`${styles.row} ${styles.rowEmail}`}>{email}</div>
              <button
                className={`${styles.row} ${confirmSignOut ? styles.rowSignOutConfirm : styles.rowSignOut}`}
                onClick={() => {
                  if (confirmSignOut) {
                    handleSignOut()
                  } else {
                    setConfirmSignOut(true)
                  }
                }}
              >
                {confirmSignOut ? 'confirm sign out' : 'sign out'}
              </button>
            </div>

            {/* ── ABOUT ── */}
            <div className={styles.sectionLabel}>ABOUT</div>
            <div className={styles.section}>
              <a
                href={`mailto:${FEEDBACK_EMAIL}?subject=maslow%20feedback`}
                className={styles.row}
                onClick={() => { setConfirmSignOut(false); close() }}
              >suggest something</a>
              <a
                href="https://mymaslow.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.row}
                onClick={() => { setConfirmSignOut(false); close() }}
              >privacy</a>
              <a
                href="https://mymaslow.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.row}
                onClick={() => { setConfirmSignOut(false); close() }}
              >terms</a>
            </div>

            {/* ── Footer ── */}
            <div className={styles.footer}>
              <span>v1.0</span>
              {builtAt && <span>· built {builtAt}</span>}
            </div>

            </div>{/* end .scrollBody */}

          </div>
        </>
      )}
    </div>
  )
}
