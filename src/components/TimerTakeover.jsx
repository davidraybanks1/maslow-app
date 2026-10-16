import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './TimerTakeover.module.css'

// The orb's outline: a circle with a slow three-lobed wobble, the same blob
// the rest of the app draws its orbs with.
function blobPath(radius, phase) {
  const amp = radius * 0.042
  let d = ''
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2
    const r = radius + amp * Math.sin(3 * t + phase)
    d += `${i ? 'L' : 'M'}${(r * Math.cos(t)).toFixed(2)},${(r * Math.sin(t)).toFixed(2)}`
  }
  return `${d}Z`
}

function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const RING = 142
const CIRC = 2 * Math.PI * RING

// Full-screen timer. Tap the orb to pause. "end" asks first and, if you do,
// logs nothing: a practice you stopped halfway isn't recorded as done. Time is
// read from the wall clock, so a locked screen doesn't stall it.
export default function TimerTakeover({ label, minutes, onFinish, onClose }) {
  const total = minutes * 60
  const [left, setLeft] = useState(total)
  const [paused, setPaused] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)
  const blobRef = useRef(null)
  const ringRef = useRef(null)
  const endRef = useRef(null)
  const run = useRef({ t0: Date.now(), acc: 0, pausedAt: 0, paused: false, done: false, phase: 0, last: 0 })
  const cb = useRef({ onFinish, onClose })
  cb.current = { onFinish, onClose }

  function setPause(v) {
    const r = run.current
    if (r.done) return
    if (v && !r.paused) { r.paused = true; r.pausedAt = Date.now() }
    else if (!v && r.paused) { r.paused = false; r.acc += Date.now() - r.pausedAt }
    setPaused(r.paused)
  }

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let shown = total
    function frame(now) {
      const r = run.current
      const dt = r.last ? Math.min((now - r.last) / 1000, 0.05) : 0
      r.last = now
      const elapsedMs = (r.paused ? r.pausedAt : Date.now()) - r.t0 - r.acc
      const el = Math.max(0, elapsedMs / 1000)
      const p = Math.min(1, el / total)
      if (!r.paused && !reduce) r.phase += 0.5 * dt
      const breath = reduce || r.paused ? 0 : Math.sin((now / 1000) * Math.PI * 2 / 10)
      const radius = 76 + 5 * breath + (r.done ? 6 : 0)
      blobRef.current?.setAttribute('d', blobPath(radius, r.phase))
      ringRef.current?.setAttribute('stroke-dasharray', `${(p * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`)
      const remaining = Math.ceil(total - el)
      if (remaining !== shown) { shown = remaining; setLeft(Math.max(0, remaining)) }
      if (!r.done && el >= total) {
        r.done = true
        setDone(true)
        setConfirm(false)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [total])

  useEffect(() => {
    if (!done) return undefined
    const t = setTimeout(() => cb.current.onFinish(), 2600)
    return () => clearTimeout(t)
  }, [done])

  useEffect(() => {
    endRef.current?.focus({ preventScroll: true })
    function onKey(e) {
      if (e.key === 'Escape' && !run.current.done) { setPause(true); setConfirm(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function askEnd() {
    if (run.current.done) return
    setPause(true)
    setConfirm(true)
  }

  return createPortal(
    <div className={styles.take} role="dialog" aria-modal="true" aria-label={`${label} timer`}>
      <button type="button" ref={endRef} className={styles.end} onClick={askEnd}>end</button>
      <button
        type="button"
        className={styles.svg}
        aria-label={paused ? 'resume' : 'pause'}
        onClick={() => { if (!confirm) setPause(!run.current.paused) }}
      >
        <svg viewBox="-160 -160 320 320" width="100%" height="100%" aria-hidden="true" style={{ overflow: 'visible' }}>
          <defs>
            <radialGradient id="take-orb" cx="34%" cy="26%">
              <stop offset="0%" stopColor="#FFD166" />
              <stop offset="100%" stopColor="#F0A800" />
            </radialGradient>
          </defs>
          <circle r={RING} fill="none" stroke="#F2F0E8" strokeOpacity=".12" strokeWidth="2" />
          <circle ref={ringRef} r={RING} fill="none" stroke="#F2F0E8" strokeOpacity=".55" strokeWidth="2"
            strokeLinecap="round" transform="rotate(-90)" strokeDasharray={`0 ${CIRC.toFixed(1)}`} />
          <path ref={blobRef} fill="url(#take-orb)" d={blobPath(76, 0)} />
        </svg>
      </button>
      <div className={styles.time} aria-live="off">{done ? 'done.' : clock(left)}</div>
      <div className={styles.name}>{done ? `${minutes} min logged` : label}</div>
      <div className={styles.hint}>
        {done || confirm ? '' : paused ? 'paused · tap the orb to resume' : 'tap the orb to pause'}
      </div>
      {confirm && !done && (
        <div className={styles.confirm}>
          <span>end early? your time won’t be logged.</span>
          <button type="button" onClick={() => { setConfirm(false); setPause(false) }}>keep going</button>
          <button type="button" onClick={() => cb.current.onClose()}>end</button>
        </div>
      )}
    </div>,
    document.body,
  )
}
