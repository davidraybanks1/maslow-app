import { useEffect, useMemo, useRef } from 'react'
import styles from './LoadingScreen.module.css'

/* Daily ritual: the screen starts fully black — anxiety owns all of it.
   take (red) → up (gold) → space. (green) rise one at a time, each word
   pushing the black up a little further. The mark lands, the final push
   sends the black off the top, the stack settles at center, and a slow
   burst of mode-colored circles floats up from the bottom. Once per day. */

const WORDS = [
  { text: 'take',   color: 'var(--survival)',    italic: false },
  { text: 'up',     color: 'var(--nourishment)', italic: false },
  { text: 'space.', color: 'var(--exploration)', italic: true },
]
const LINE = 54            // word slot height
const LOGO_H = 42
const LOGO_PAD = 12
const STEP_EASE = 'cubic-bezier(0.3, 0.9, 0.3, 1)'
const EXIT_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'
const PUSH_TIMES = [450, 1100, 1750, 2400]
const CENTER_TIME = 3050
const BURST_COLORS = ['#1B3A2D', '#B8C3B1', '#E8B81F', '#D93B1C']

function fireBurst(container) {
  if (!container || typeof container.appendChild !== 'function') return
  for (let i = 0; i < 26; i++) {
    const d = document.createElement('div')
    const size = 5 + Math.random() * 8
    const x = 5 + Math.random() * 90
    d.className = styles.burstDot
    d.style.left = x.toFixed(1) + '%'
    d.style.width = size.toFixed(0) + 'px'
    d.style.height = size.toFixed(0) + 'px'
    d.style.background = BURST_COLORS[i % 4]
    container.appendChild(d)
    const rise = 240 + Math.random() * 340
    const drift = (Math.random() - 0.5) * 90
    if (typeof d.animate === 'function') {
      d.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
          { transform: `translate(${drift.toFixed(0)}px, -${rise.toFixed(0)}px) scale(0.4)`, opacity: 0 },
        ],
        { duration: 1500 + Math.random() * 800, delay: Math.random() * 350, easing: 'cubic-bezier(0.15, 0.6, 0.35, 1)', fill: 'forwards' }
      )
    } else {
      d.remove()
    }
  }
}

export default function LoadingScreen({ greeting = 'hey, you', fading = false }) {
  const reduce = useMemo(
    () => typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  const panelRef = useRef(null)
  const stackRef = useRef(null)
  const burstRef = useRef(null)
  const logoWrapRef = useRef(null)
  const logoRef = useRef(null)
  const wordRefs = useRef([])

  useEffect(() => {
    if (reduce) return
    const panel = panelRef.current
    const stack = stackRef.current
    if (!panel || !stack) return

    const base = Math.max(0, window.innerHeight - stack.getBoundingClientRect().bottom)
    const pushes = [
      base + LINE,
      base + LINE * 2,
      base + LINE * 3,
      base + LINE * 3 + LOGO_H + LOGO_PAD,
    ]

    const timers = PUSH_TIMES.map((t, i) => setTimeout(() => {
      panel.style.transition = `transform 0.55s ${STEP_EASE}`
      panel.style.transform = `translateY(-${pushes[i]}px)`
      if (i < WORDS.length) {
        const slot = wordRefs.current[i]
        if (!slot) return
        slot.style.transition = `height 0.55s ${STEP_EASE}`
        slot.style.height = LINE + 'px'
        const inner = slot.firstElementChild
        inner.style.transition = `transform 0.55s ${STEP_EASE}`
        inner.style.transform = 'translateY(0)'
      } else {
        const wrap = logoWrapRef.current
        const svg = logoRef.current
        if (!wrap || !svg) return
        wrap.style.transition = `height 0.55s ${STEP_EASE}, padding-top 0.55s ${STEP_EASE}`
        wrap.style.height = LOGO_H + 'px'
        wrap.style.paddingTop = LOGO_PAD + 'px'
        svg.style.transition = `transform 0.55s ${STEP_EASE}`
        svg.style.transform = 'translateY(0)'
      }
    }, t))

    timers.push(setTimeout(() => {
      panel.style.transition = `transform 0.85s ${EXIT_EASE}`
      panel.style.transform = 'translateY(-102%)'
      const r = stack.getBoundingClientRect()
      const delta = (r.top + r.height / 2) - window.innerHeight / 2
      stack.style.transition = `transform 0.85s ${EXIT_EASE}`
      stack.style.transform = `translateY(${(-delta).toFixed(0)}px)`
      fireBurst(burstRef.current)
    }, CENTER_TIME))

    return () => timers.forEach(clearTimeout)
  }, [reduce])

  return (
    <div
      className={`${styles.overlay} ${fading ? styles.overlayFading : ''}`}
      role="status"
      aria-live="polite"
    >
      {!reduce && <div className={styles.blackPanel} ref={panelRef} />}
      <div className={styles.burst} ref={burstRef} />
      <div className={`${styles.stack} ${reduce ? styles.stackStatic : ''}`} ref={stackRef}>
        {WORDS.map((w, i) => (
          <div
            key={w.text}
            className={styles.wordSlot}
            ref={el => { wordRefs.current[i] = el }}
            style={reduce ? { height: LINE } : undefined}
          >
            <div
              className={styles.word}
              style={{ color: w.color, fontStyle: w.italic ? 'italic' : 'normal', ...(reduce ? { transform: 'none' } : {}) }}
            >
              {w.text}
            </div>
          </div>
        ))}
        <div
          className={styles.logoSlot}
          ref={logoWrapRef}
          style={reduce ? { height: LOGO_H, paddingTop: LOGO_PAD } : undefined}
        >
          <svg
            ref={logoRef}
            className={styles.logoSvg}
            style={reduce ? { transform: 'none' } : undefined}
            width="34" height="42" viewBox="0 0 52 52" fill="none" aria-hidden="true"
          >
            <circle cx="26" cy="10" r="3" fill="#E8B81F" />
            <circle cx="21" cy="20" r="3" fill="var(--ink)" />
            <circle cx="31" cy="20" r="3" fill="var(--ink)" />
            <circle cx="16" cy="30" r="3" fill="var(--ink)" />
            <circle cx="26" cy="30" r="3" fill="var(--ink)" />
            <circle cx="36" cy="30" r="3" fill="var(--ink)" />
            <circle cx="11" cy="40" r="3" fill="var(--ink)" />
            <circle cx="21" cy="40" r="3" fill="var(--ink)" />
            <circle cx="31" cy="40" r="3" fill="var(--ink)" />
            <circle cx="41" cy="40" r="3" fill="var(--ink)" />
          </svg>
        </div>
      </div>
      <span className={styles.srOnly}>{greeting} — loading</span>
    </div>
  )
}
