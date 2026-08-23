import { useState, useEffect, useRef } from 'react'
import styles from './OnboardingTour.module.css'

const ALL_STEPS = [
  {
    target: 'space',
    header: 'this is your space.',
    body1: 'It starts at 0 and fills throughout the day as you complete practices.',
    body2: "You don't have to hit 100% every day, or ever — the goal is to find what works for you.",
  },
  {
    target: 'note',
    header: 'Set your narrative',
    body: 'up to five notes, quotes, or mantras you want to remember every day. Edit and add your own.',
  },
  {
    target: 'mood',
    header: 'know your feels',
    body: "Track your mood three times a day. This turns into data to help see what's working.",
  },
  {
    target: 'modes',
    header: 'Own your space',
    body: 'Tap a mode to see your needs and practices. Tap a practice to mark it complete for the day. Exploration needs get more practices; survival needs get one.',
  },
  {
    target: 'journal',
    header: 'talk to yourself.',
    body: 'Write a line or a paragraph whenever you like. Add a tag and start to identify patterns.',
  },
  {
    target: 'nav',
    header: 'the other two screens.',
    body: "data is where you see what's working. Reflect is where you see patterns in your thinking. Both need a few days of data before they show anything helpful.",
  },
]

const CARD_MARGIN = 16

// Returns the first [data-tour="X"] element with a non-zero painted rect.
// Handles duplicate attribute names across mutually-exclusive branches
// (e.g. DesktopNav + TabBar both use data-tour="nav"; only the visible one
// has a live rect).
function findLiveEl(target) {
  const els = document.querySelectorAll(`[data-tour="${target}"]`)
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return { el, rect: r }
  }
  return null
}

export default function OnboardingTour({ markTourSeen }) {
  const [steps, setSteps] = useState([])
  const [index, setIndex] = useState(0)
  const [spotRect, setSpotRect] = useState(null)
  const debounceRef = useRef(null)

  function measureStep(idx, stps) {
    const step = (stps || steps)[idx]
    if (!step) return
    const match = findLiveEl(step.target)
    if (!match) return
    setSpotRect(match.rect)
  }

  useEffect(() => {
    const available = ALL_STEPS.filter(s => !!findLiveEl(s.target))
    setSteps(available)
    measureStep(0, available)
  }, [])

  useEffect(() => {
    if (!steps.length) return
    measureStep(index, steps)
  }, [index, steps])

  useEffect(() => {
    function onResize() {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => measureStep(index, steps), 100)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(debounceRef.current)
    }
  }, [index, steps])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') markTourSeen()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [markTourSeen])

  if (!steps.length || !spotRect) return null

  const step = steps[index]
  const isFirst = index === 0
  const isLast = index === steps.length - 1

  const inf = 8
  const spot = {
    left: spotRect.left - inf,
    top: spotRect.top - inf,
    width: spotRect.width + inf * 2,
    height: spotRect.height + inf * 2,
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const isMobile = vw < 900
  const DESKTOP_W = 320

  let cardStyle

  if (isMobile) {
    const cardW = Math.min(380, vw - 32)
    const cardX = Math.max(16, (vw - cardW) / 2)
    const spCenterY = spot.top + spot.height / 2
    if (spCenterY > vh / 2) {
      // target in bottom half (e.g. TabBar) — place card above spotlight
      cardStyle = {
        left: cardX,
        width: cardW,
        bottom: Math.max(16, vh - spot.top + CARD_MARGIN),
      }
    } else {
      // target in top half — place card below spotlight
      cardStyle = {
        left: cardX,
        width: cardW,
        top: Math.max(16, spot.top + spot.height + CARD_MARGIN),
      }
    }
  } else {
    const spRight = spot.left + spot.width
    const spTop = spot.top
    if (spRight + CARD_MARGIN + DESKTOP_W <= vw) {
      cardStyle = { left: spRight + CARD_MARGIN, top: Math.max(8, Math.min(spTop, vh - 8 - 300)), width: DESKTOP_W }
    } else if (spot.left - CARD_MARGIN - DESKTOP_W >= 0) {
      cardStyle = { left: spot.left - CARD_MARGIN - DESKTOP_W, top: Math.max(8, Math.min(spTop, vh - 8 - 300)), width: DESKTOP_W }
    } else {
      cardStyle = { left: Math.max(8, Math.min(vw - DESKTOP_W - 8, (vw - DESKTOP_W) / 2)), top: spot.top + spot.height + CARD_MARGIN, width: DESKTOP_W }
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="welcome tour">
      <div
        className={styles.spotlight}
        style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }}
      />
      <div className={styles.card} style={cardStyle}>
        <div className={styles.header}>{step.header}</div>
        {step.body1 ? (
          <div className={styles.bodyTwo}>
            <p className={styles.body}>{step.body1}</p>
            <p className={styles.body}>{step.body2}</p>
          </div>
        ) : (
          <p className={styles.body}>{step.body}</p>
        )}
        <div className={styles.dots}>
          {steps.map((_, i) => (
            <div key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
          ))}
        </div>
        <div className={styles.actions}>
          {isFirst ? (
            <button className={styles.secondary} onClick={markTourSeen}>skip</button>
          ) : (
            <button className={styles.secondary} onClick={() => setIndex(i => i - 1)}>back</button>
          )}
          <button
            className={styles.primary}
            onClick={isLast ? markTourSeen : () => setIndex(i => i + 1)}
          >
            {isLast ? 'start' : 'next'}
          </button>
        </div>
      </div>
    </div>
  )
}
