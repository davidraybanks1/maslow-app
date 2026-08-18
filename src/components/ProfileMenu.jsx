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
}) {
  const [open, setOpen] = useState(false)
  const [cadenceOpen, setCadenceOpen] = useState(false)
  const navigate = useNavigate()
  const wrapperRef = useRef(null)

  const initial = ((name || email || '').trim()[0] || '?').toUpperCase()
  const cadence = reviewCadence || 'weekly'
  const builtAt = formatBuildTime(BUILD_TIME)

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    navigate('/signin')
  }

  function close() { setOpen(false) }

  useEffect(() => {
    if (!open) { setCadenceOpen(false); return }
    function onOutside(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        className={`${styles.avatar} ${open ? styles.avatarOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <>
          <div className={styles.scrim} onClick={close} />
          <div className={`${styles.menu} ${dropUp ? styles.menuDropUp : ''}`}>

            {/* ── PERSONALIZE ── */}
            <div className={styles.sectionLabel}>PERSONALIZE</div>
            <div className={styles.section}>
              <NavLink to="/canvas" className={styles.row} onClick={close}>
                <div>
                  <div className={styles.rowLabel}>your canvas</div>
                  <div className={styles.rowSub}>needs, modes &amp; practices</div>
                </div>
              </NavLink>
              <button
                className={styles.row}
                onClick={() => { close(); navigate('/today', { state: { openDeck: true } }) }}
              >
                <span className={styles.rowLabel}>your note deck</span>
              </button>
              <button
                className={styles.row}
                onClick={() => updateShowNoteToSelf?.(!showNoteToSelf)}
              >
                <span className={styles.rowLabel}>show note to self</span>
                <div className={styles.toggleSwitch}>
                  <div className={`${styles.toggleTrack} ${showNoteToSelf ? styles.toggleTrackOn : ''}`}>
                    <div className={`${styles.toggleThumb} ${showNoteToSelf ? styles.toggleThumbOn : ''}`} />
                  </div>
                </div>
              </button>
              <button
                className={styles.row}
                onClick={() => setCadenceOpen(o => !o)}
              >
                <span className={styles.rowLabel}>review cadence</span>
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
              <button className={styles.row} onClick={handleSignOut}>sign out</button>
            </div>

            {/* ── ABOUT ── */}
            <div className={styles.sectionLabel}>ABOUT</div>
            <div className={styles.section}>
              <a
                href={`mailto:${FEEDBACK_EMAIL}?subject=maslow%20feedback`}
                className={styles.row}
                onClick={close}
              >suggest something</a>
              <a
                href="https://mymaslow.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.row}
                onClick={close}
              >privacy</a>
              <a
                href="https://mymaslow.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.row}
                onClick={close}
              >terms</a>
            </div>

            {/* ── Footer ── */}
            <div className={styles.footer}>
              <span>v1.0</span>
              {builtAt && <span>· built {builtAt}</span>}
            </div>

          </div>
        </>
      )}
    </div>
  )
}
