import { useState, useEffect, useRef } from 'react'
import { IconChevronDown, IconChevronUp, IconChevronLeft } from '@tabler/icons-react'
import { CLAY, ON_CLAY } from '../lib/constants'
import styles from './TimerCard.module.css'

const TIMER_KEY = 'maslow_timer'
const DURATION_OPTIONS = [10, 15, 30, 45]
const RADIUS = 122
const SVG_SIZE = 270
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const CLAY_VARS = { '--clay': CLAY, '--on-clay': ON_CLAY }

function readTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeTimer(t) {
  try {
    if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t))
    else localStorage.removeItem(TIMER_KEY)
  } catch {}
}

// Remaining time is ALWAYS computed from wall clock, never stored as a decrementing value.
function computeRemaining(t) {
  if (!t) return 0
  if (t.pausedRemainingMs !== null && t.pausedRemainingMs !== undefined) {
    return Math.max(0, t.pausedRemainingMs)
  }
  if (t.startedAt !== null && t.startedAt !== undefined) {
    return Math.max(0, t.durationMs - (Date.now() - t.startedAt))
  }
  return 0
}

function formatTime(ms) {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TimerCard() {
  const [expanded, setExpanded] = useState(false)
  const [timer, setTimerRaw] = useState(null)
  const [fullScreen, setFullScreen] = useState(false)
  const [tick, setTick] = useState(0)
  const vibratedRef = useRef(false)

  function setTimer(t) {
    setTimerRaw(t)
    writeTimer(t)
  }

  // Restore from localStorage on mount. If the timer finished while the app was
  // closed, show the done state rather than silently discarding it.
  useEffect(() => {
    const t = readTimer()
    if (!t) return
    const rem = computeRemaining(t)
    setTimerRaw(t)
    setFullScreen(true)
    if (rem === 0) vibratedRef.current = true  // already done; skip vibration on mount
  }, [])

  // Interval fires every 100ms while the timer is running to trigger re-renders.
  // The displayed time is always recomputed from the wall clock, never decremented.
  const isRunning = !!timer && timer.startedAt !== null && timer.startedAt !== undefined && timer.pausedRemainingMs === null
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setTick(n => n + 1), 100)
    return () => clearInterval(id)
  }, [isRunning])

  // Re-read the wall clock when the page becomes visible again (background recovery).
  useEffect(() => {
    function onVisibility() { setTick(n => n + 1) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const remaining = computeRemaining(timer)
  const isDone = !!timer && remaining === 0

  // Fire haptic once when the timer reaches zero.
  useEffect(() => {
    if (isDone && !vibratedRef.current) {
      vibratedRef.current = true
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
    }
    if (!isDone) vibratedRef.current = false
  }, [isDone])

  function startTimer(minutes) {
    const durationMs = minutes * 60 * 1000
    const t = { durationMs, startedAt: Date.now(), pausedRemainingMs: null }
    setTimer(t)
    setFullScreen(true)
  }

  function pauseTimer() {
    if (!timer) return
    const rem = computeRemaining(timer)
    setTimer({ durationMs: timer.durationMs, startedAt: null, pausedRemainingMs: rem })
  }

  // Resume: durationMs becomes pausedRemainingMs so remaining = durationMs - elapsed
  // resolves to the correct value. Original duration is never touched.
  function resumeTimer() {
    if (!timer || timer.pausedRemainingMs === null) return
    setTimer({ durationMs: timer.pausedRemainingMs, startedAt: Date.now(), pausedRemainingMs: null })
  }

  function endTimer() {
    writeTimer(null)
    setTimerRaw(null)
    setFullScreen(false)
    vibratedRef.current = false
  }

  const isPaused = !!timer && timer.pausedRemainingMs !== null && timer.pausedRemainingMs !== undefined
  const elapsedFraction = timer ? Math.max(0, Math.min(1, 1 - remaining / timer.durationMs)) : 0
  const dashOffset = CIRCUMFERENCE * (1 - elapsedFraction)

  return (
    <>
      <div className={styles.card} style={CLAY_VARS}>
        <button
          className={styles.header}
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
        >
          <span className={styles.label}>set a timer</span>
          <span className={styles.chevron}>
            {expanded
              ? <IconChevronUp size={14} strokeWidth={2} />
              : <IconChevronDown size={14} strokeWidth={2} />}
          </span>
        </button>

        <div className={`${styles.drawer} ${expanded ? styles.drawerOpen : ''}`}>
          <div className={styles.pills}>
            {DURATION_OPTIONS.map(m => (
              <button key={m} className={styles.pill} onClick={() => startTimer(m)}>
                {m}
              </button>
            ))}
          </div>
          <div className={styles.minutesLabel}>minutes</div>
        </div>
      </div>

      {fullScreen && timer && (
        <div className={styles.fullScreen} style={CLAY_VARS}>
          <div className={styles.fsHeader}>
            <button className={styles.fsBack} onClick={endTimer} aria-label="close timer">
              <IconChevronLeft size={22} strokeWidth={1.75} />
            </button>
            <span className={styles.fsEyebrow}>TIMER</span>
            <span className={styles.fsSpacer} />
          </div>

          <div className={styles.fsBody}>
            <div className={styles.ringWrapper}>
              <svg
                width={SVG_SIZE}
                height={SVG_SIZE}
                className={styles.ring}
                aria-hidden="true"
              >
                {/* Track ring at 16% opacity */}
                <circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  opacity={0.16}
                />
                {/* Progress ring — fills as time elapses, full at zero remaining */}
                <circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className={styles.ringContent}>
                <div className={styles.timeDisplay}>{formatTime(remaining)}</div>
                <div className={styles.timeLabel}>{isDone ? 'DONE' : 'REMAINING'}</div>
              </div>
            </div>
          </div>

          <div className={styles.fsFooter}>
            {!isDone && (
              <button
                className={`${styles.fsBtn} ${styles.fsBtnOutline}`}
                onClick={isPaused ? resumeTimer : pauseTimer}
              >
                {isPaused ? 'resume' : 'pause'}
              </button>
            )}
            <button className={`${styles.fsBtn} ${styles.fsBtnFilled}`} onClick={endTimer}>
              {isDone ? 'close' : 'end'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
