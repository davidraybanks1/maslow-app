import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import styles from './OnboardingTour.module.css'

const ALL_STEPS = [
  {
    target: 'space',
    body: "This is your space. It starts at 0 and fills throughout the day as you complete your practices. The goal isn't always 100%. It's to figure out what works for you.",
  },
  {
    target: 'modes',
    body: 'Expand the modes to see your needs and daily practices. Tap a practice to mark it complete for the day.',
  },
  {
    target: 'profile',
    body: 'Open your profile to personalize your canvas, notes, and notifications.',
  },
]

const CARD_MARGIN = 28

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

// Walk up the DOM to find the nearest scrollable ancestor.
// scrollend fires on the scrolling element (it doesn't bubble), so we need
// the actual container — not document — to listen on.
function findScrollParent(el) {
  let node = el.parentElement
  while (node && node !== document.documentElement) {
    const s = getComputedStyle(node)
    if (/(auto|scroll)/.test(s.overflow + s.overflowY)) return node
    node = node.parentElement
  }
  return window
}

export default function OnboardingTour({ markTourSeen }) {
  const [steps, setSteps] = useState([])
  const [index, setIndex] = useState(0)
  const [spotRect, setSpotRect] = useState(null)
  const [arrowPath, setArrowPath] = useState(null)
  const debounceRef = useRef(null)
  const cardRef = useRef(null)

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
    const step = steps[index]
    if (!step) return
    const match = findLiveEl(step.target)
    if (!match) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { top, bottom, left, right } = match.rect
    const alreadyInView = top >= 0 && bottom <= window.innerHeight && left >= 0 && right <= window.innerWidth

    if (alreadyInView || reduceMotion) {
      if (!alreadyInView) match.el.scrollIntoView({ behavior: 'auto', block: 'nearest' })
      measureStep(index, steps)
      return
    }

    match.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    const scroller = findScrollParent(match.el)
    let settled = false

    function settle() {
      if (settled) return
      settled = true
      clearTimeout(debounceRef.current)
      scroller.removeEventListener('scrollend', settle)
      if (scroller !== window) window.removeEventListener('scrollend', settle)
      measureStep(index, steps)
    }

    if ('onscrollend' in window) {
      scroller.addEventListener('scrollend', settle, { once: true })
      if (scroller !== window) window.addEventListener('scrollend', settle, { once: true })
    }
    debounceRef.current = setTimeout(settle, 700)

    return () => {
      settled = true
      clearTimeout(debounceRef.current)
      scroller.removeEventListener('scrollend', settle)
      if (scroller !== window) window.removeEventListener('scrollend', settle)
    }
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

  // Compute the curved arrow path after every layout caused by a spotRect change.
  // Both card and target are in viewport coordinates, so no offset arithmetic needed.
  function computeArrow() {
    if (!cardRef.current || !spotRect) { setArrowPath(null); return }
    const c = cardRef.current.getBoundingClientRect()
    const t = spotRect
    const tCX = t.left + t.width / 2
    const tCY = t.top + t.height / 2
    const cCX = c.left + c.width / 2
    const cCY = c.top + c.height / 2

    // Classify as horizontal (desktop: card beside target) or vertical (mobile: above/below).
    const isHoriz = Math.abs(tCX - cCX) > Math.abs(tCY - cCY)

    let sx, sy, ex, ey, gap

    if (isHoriz) {
      // Start: card's near horizontal edge, clamped to card height
      sy = Math.max(c.top + 20, Math.min(c.bottom - 20, tCY))
      ey = tCY
      if (cCX > tCX) {
        // card is to the right → arrow from card.left toward target.right
        sx = c.left; ex = t.right + 8; gap = c.left - t.right
      } else {
        // card is to the left → arrow from card.right toward target.left
        sx = c.right; ex = t.left - 8; gap = t.left - c.right
      }
    } else {
      // Start: card's near vertical edge, x clamped to card width
      sx = Math.max(c.left + 24, Math.min(c.right - 24, tCX))
      ex = tCX
      if (cCY > tCY) {
        // card is below target → arrow from card.top toward target.bottom
        sy = c.top; ey = t.bottom + 8; gap = c.top - t.bottom
      } else {
        // card is above target → arrow from card.bottom toward target.top
        sy = c.bottom; ey = t.top - 8; gap = t.top - c.bottom
      }
    }

    // Suppress only when card and target overlap or nearly touch.
    if (gap < 12) { setArrowPath(null); return }

    const dx = ex - sx, dy = ey - sy
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1) { setArrowPath(null); return }

    // Quadratic control point: midpoint + perpendicular offset (30% of length).
    const mx = (sx + ex) / 2, my = (sy + ey) / 2
    const perpX = -dy / len, perpY = dx / len
    const bow = len * 0.3
    const cx = (mx + perpX * bow).toFixed(1)
    const cy = (my + perpY * bow).toFixed(1)

    setArrowPath(`M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx} ${cy} ${ex.toFixed(1)} ${ey.toFixed(1)}`)
  }

  useLayoutEffect(() => {
    computeArrow()
  }, [spotRect]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!steps.length || !spotRect) return null

  const step = steps[index]
  const isLast = index === steps.length - 1

  const vw = window.innerWidth
  const vh = window.innerHeight
  const isMobile = vw < 900
  const DESKTOP_W = 320

  const t = spotRect
  let cardStyle

  if (isMobile) {
    const cardW = Math.min(380, vw - 32)
    const cardX = Math.max(16, (vw - cardW) / 2)
    const spCenterY = t.top + t.height / 2
    if (spCenterY > vh / 2) {
      cardStyle = {
        left: cardX, width: cardW,
        bottom: Math.max(16, vh - t.top + CARD_MARGIN),
      }
    } else {
      cardStyle = {
        left: cardX, width: cardW,
        top: Math.max(16, t.bottom + CARD_MARGIN),
      }
    }
  } else {
    if (t.right + CARD_MARGIN + DESKTOP_W <= vw) {
      cardStyle = { left: t.right + CARD_MARGIN, top: Math.max(8, Math.min(t.top, vh - 8 - 300)), width: DESKTOP_W }
    } else if (t.left - CARD_MARGIN - DESKTOP_W >= 0) {
      cardStyle = { left: t.left - CARD_MARGIN - DESKTOP_W, top: Math.max(8, Math.min(t.top, vh - 8 - 300)), width: DESKTOP_W }
    } else {
      cardStyle = { left: Math.max(8, Math.min(vw - DESKTOP_W - 8, (vw - DESKTOP_W) / 2)), top: t.bottom + CARD_MARGIN, width: DESKTOP_W }
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="welcome tour">
      {arrowPath && (
        <svg
          className={styles.arrowSvg}
          viewBox={`0 0 ${vw} ${vh}`}
          aria-hidden="true"
        >
          <defs>
            <marker
              id="tour-arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="5"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 0 L 9 5 L 0 10 Z" fill="rgba(239,236,227,0.85)" />
            </marker>
          </defs>
          <path
            d={arrowPath}
            stroke="rgba(239,236,227,0.85)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            markerEnd="url(#tour-arrowhead)"
          />
        </svg>
      )}
      <div className={styles.card} ref={cardRef} style={cardStyle}>
        <div className={styles.topRow}>
          <span className={styles.eyebrow}>3 things to know</span>
          <div className={styles.dots}>
            {steps.map((_, i) => (
              <div key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
            ))}
          </div>
        </div>
        <p className={styles.body}>{step.body}</p>
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={markTourSeen}>skip</button>
          <button
            className={styles.primary}
            onClick={isLast ? markTourSeen : () => setIndex(i => i + 1)}
          >
            {isLast ? 'done' : 'next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
