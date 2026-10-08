import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import styles from './OnboardingTour.module.css'

// Listed top to bottom, the order they sit on Today. A step whose target is not
// on screen right now (e.g. the note deck once every note has been read) is
// skipped, and the eyebrow counts whatever is left.
const ALL_STEPS = [
  {
    target: 'space',
    top: true,            // lives in the header: always scroll back to the top first
    body: [
      "This is your loam. It fills as you check off your daily practices.",
      "The goal isn’t always 100%. It’s to figure out what works for you.",
    ],
  },
  {
    target: 'note',
    ring: true,
    body: ['Swipe through your notes to self to check off your first Reflection practice.'],
  },
  {
    target: 'modes',
    ring: true,
    place: 'above',       // the card stays above: the mode opens downward and must not move it
    body: ['Tap to show your needs and practices. Tap a practice to mark it complete.'],
  },
  {
    target: 'profile',
    top: true,
    ring: true,
    body: ['Open your profile to customize your needs, notes, tags, and reminders.'],
  },
]

const CARD_MARGIN = 40   // room for the arrow between the card and what it points at
const RING_PAD = 5       // the outline sits this far outside the thing it frames

// The part of the screen under the status bar / notch, so a target scrolled
// "into view" is never left tucked behind the clock.
function safeInsetTop() {
  const p = document.createElement('div')
  p.style.cssText = 'position:fixed;top:0;left:0;height:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none'
  document.body.appendChild(p)
  const v = p.getBoundingClientRect().height
  document.body.removeChild(p)
  return v || 0
}

const grow = (r, pad) => ({ left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad, width: r.width + pad * 2, height: r.height + pad * 2 })

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

// Walk up the DOM to find the ancestor that actually scrolls.
// scrollend fires on the scrolling element (it doesn't bubble), so we need
// the actual container — not document — to listen on. An element only counts
// if it really has overflow to scroll: setting overflow-x:hidden makes the
// browser compute overflow-y as auto too (Today's .screen does this), so the
// computed style alone would point at a box that never moves.
function findScrollParent(el) {
  let node = el.parentElement
  while (node && node !== document.documentElement) {
    const s = getComputedStyle(node)
    if (/(auto|scroll)/.test(s.overflow + s.overflowY) && node.scrollHeight > node.clientHeight + 1) return node
    node = node.parentElement
  }
  return document.querySelector('[data-scroll]') || window
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
    const behavior = reduceMotion ? 'auto' : 'smooth'
    const scroller = findScrollParent(match.el)
    const scrolledY = scroller === window ? window.scrollY : scroller.scrollTop
    const { top, bottom, left, right } = match.rect
    const vh = window.innerHeight

    // What is actually visible: below the status bar, above the tab bar.
    const nav = findLiveEl('nav')
    const floor = nav && nav.rect.top > vh / 2 ? nav.rect.top : vh
    const ceiling = safeInsetTop() + 12
    const inView = top >= ceiling && bottom <= floor - 12 && left >= 0 && right <= window.innerWidth

    let moves = false
    if (step.top) {
      // header targets: back to the very top, however far the last step scrolled
      if (scrolledY > 1) { scroller.scrollTo({ top: 0, behavior }); moves = true }
    } else if (!inView) {
      // centre it, so the card has room on whichever side it lands
      match.el.scrollIntoView({ behavior, block: 'center' })
      moves = true
    }

    if (!moves) { measureStep(index, steps); return }
    if (reduceMotion) { measureStep(index, steps); return }

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

  // Demo-ring: animate the completion ring while card 1 (space) is showing.
  useEffect(() => {
    if (!steps.length) return
    const step = steps[index]
    if (!step || step.target !== 'space') return
    window.dispatchEvent(new CustomEvent('maslow:demo-ring'))
    return () => {
      window.dispatchEvent(new CustomEvent('maslow:demo-ring-stop'))
    }
  }, [index, steps]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open the modes accordion while card 2 (modes) is showing.
  // Dispatch is delayed 1000ms so the user sees the card settle first.
  // Remeasure fires at 1700ms: after the 1000ms delay plus 390ms transition
  // plus a 310ms margin so the arrow targets the fully-expanded position.
  useEffect(() => {
    if (!steps.length) return
    const step = steps[index]
    if (!step || step.target !== 'modes') return

    const dispatchTimer = setTimeout(() => window.dispatchEvent(new CustomEvent('maslow:open-tier')), 1000)
    const remeasureTimer = setTimeout(() => measureStep(index, steps), 1700)
    return () => {
      clearTimeout(dispatchTimer)
      clearTimeout(remeasureTimer)
      window.dispatchEvent(new CustomEvent('maslow:close-tier'))
    }
  }, [index, steps]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute the curved arrow path after every layout caused by a spotRect change.
  // Both card and target are in viewport coordinates, so no offset arithmetic needed.
  function computeArrow() {
    if (!cardRef.current || !spotRect) { setArrowPath(null); return }
    const c = cardRef.current.getBoundingClientRect()
    const t = steps[index]?.ring ? grow(spotRect, RING_PAD) : spotRect
    const tCX = t.left + t.width / 2
    const tCY = t.top + t.height / 2
    const cCX = c.left + c.width / 2
    const cCY = c.top + c.height / 2

    // Classify as horizontal only when card and target have no x-axis overlap.
    // Centre-distance comparison misclassifies full-width cards whose centre
    // is far from the target horizontally but which still overlap the target.
    const isHoriz = (c.right < t.left) || (c.left > t.right)

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
    const bow = len * 0.18
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

  const t = step.ring ? grow(spotRect, RING_PAD) : spotRect
  let cardStyle

  if (isMobile) {
    const cardW = Math.min(380, vw - 32)
    const cardX = Math.max(16, (vw - cardW) / 2)
    const spCenterY = t.top + t.height / 2
    if (step.place === 'above' || spCenterY > vh / 2) {
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
              markerWidth="12"
              markerHeight="12"
              refX="6"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 0 L 11 6 L 0 12 Z" fill="#EFECE3" />
            </marker>
          </defs>
          <path
            d={arrowPath}
            stroke="#EFECE3"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            markerEnd="url(#tour-arrowhead)"
          />
        </svg>
      )}
      {step.ring && (
        <div
          className={styles.ring}
          aria-hidden="true"
          style={{ left: t.left, top: t.top, width: t.width, height: t.height }}
        />
      )}
      <div className={styles.card} ref={cardRef} style={cardStyle}>
        <div className={styles.topRow}>
          <span className={styles.eyebrow}>{steps.length} thing{steps.length !== 1 ? 's' : ''} to know</span>
          <div className={styles.dots}>
            {steps.map((_, i) => (
              <div key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
            ))}
          </div>
        </div>
        {step.body.map((para, i) => (
          <p key={i} className={styles.body}>{para}</p>
        ))}
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            onClick={index === 0 ? markTourSeen : () => setIndex(i => i - 1)}
          >
            {index === 0 ? 'skip' : 'back'}
          </button>
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
