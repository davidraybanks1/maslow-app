import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './NoteStack.module.css'

/* A tinder-style deck: one note on top, a couple peeking behind it. The top
   note is dragged with a finger and let go - up, down, left or right carries
   it off the screen and it is gone for the session; a release that falls
   short springs back to centre. Everything below
   pointerdown is imperative (direct style writes on the DOM node), so a drag
   never waits on a re-render - React only hears about it once a note has
   actually left, via onDismiss.

   The moment a swipe is committed (pointerup past the threshold), two things
   fire at once, not one after the other: onCommit (the haptic - it should
   land the instant the decision is made, not once the card has finished
   leaving) and the fling itself - it shrinks as it goes, like something
   tossed rather than politely slid away, and it now blooms a warm yellow
   glow/tint as it goes, the same beat as the fling itself, so the color is
   part of the exit rather than a flash tacked onto it. The card behind it
   is never told to wait: it is always one class away from full size, so
   the instant the departing card's DOM node stops claiming that class (on
   removal), the browser's own transition carries it up to full size with a
   small overshoot - the "next card" pop needs no timer of its own. */

const THRESH = { left: 64, right: 64, up: 60, down: 72 }
const FLING = { left: 640, right: 640, up: 760, down: 760 }
// a quick flick counts even when it is short: this fast (px/ms), over at least
// this far (px), measured across the last VELOCITY_WINDOW ms of the drag
const FLICK_SPEED = 0.35
const FLICK_MIN = 18
const VELOCITY_WINDOW = 110
const DEADZONE = 5
const FLING_MS = 260   // slightly slower than the original 200ms toss
const FLING_FALLBACK_MS = 320
// the flourish: a warm nourishment-yellow glow + tint, matching the bloom's
// own lit color rather than an arbitrary yellow
const FLOURISH_GLOW_LIT = '0 0 48px 16px rgba(240,168,0,.55), 0 10px 30px rgba(240,168,0,.25)'
const FLOURISH_TINT = 'rgba(255,209,102,.85)'

export default function NoteStack({ cards, onDismiss, onCommit, renderCard }) {
  const [order, setOrder] = useState(cards)
  // Cards already thrown but still mid-flight. They leave `order` the instant
  // the swipe commits (so the next card is live and draggable straight away)
  // and are only kept in the tree - inert - until their animation finishes.
  const [leaving, setLeaving] = useState([])
  const idsKey = cards.map(c => c.id).join('|')

  // Only resync from the parent when the actual set of ids changes (a note
  // added or removed elsewhere, or the deck coming back on reopen) - not on
  // every unrelated re-render, which would otherwise fight the local order
  // as cards fly out one by one.
  useEffect(() => { setOrder(cards) }, [idsKey])

  const topRef = useRef(null)
  const drag = useRef(null)
  const justDragged = useRef(false)

  const commitOut = useCallback((card) => {
    setOrder(o => o.filter(c => c.id !== card.id))
    setLeaving(l => [...l, card])
    onDismiss(card.id)
  }, [onDismiss])

  const land = useCallback((id) => {
    setLeaving(l => l.filter(c => c.id !== id))
  }, [])

  function onPointerDown(e, id) {
    if (order[0]?.id !== id) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = topRef.current
    if (!el) return
    el.setPointerCapture?.(e.pointerId)
    el.style.transition = 'none'
    drag.current = { id, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, samples: [{ t: performance.now(), dx: 0, dy: 0 }] }
  }

  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const el = topRef.current
    d.dx = e.clientX - d.x0
    d.dy = e.clientY - d.y0
    if (Math.hypot(d.dx, d.dy) < DEADZONE) return
    justDragged.current = true
    e.preventDefault()
    const now = performance.now()
    d.samples.push({ t: now, dx: d.dx, dy: d.dy })
    if (d.samples.length > 6) d.samples.shift()
    const rot = Math.max(-16, Math.min(16, d.dx / 11))
    // fade a little as the drag nears whichever dismiss threshold it is closest to
    const prog = Math.min(1, Math.max(
      d.dx < 0 ? -d.dx / THRESH.left : 0,
      d.dx > 0 ? d.dx / THRESH.right : 0,
      d.dy < 0 ? -d.dy / THRESH.up : 0,
      d.dy > 0 ? d.dy / THRESH.down : 0,
    ))
    el.style.transform = `translate(${d.dx}px, ${d.dy}px) rotate(${rot}deg)`
    el.style.opacity = String(1 - prog * 0.45)
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    const el = topRef.current
    if (!el) return
    if (Math.hypot(d.dx, d.dy) < DEADZONE) { justDragged.current = false; return }
    setTimeout(() => { justDragged.current = false }, 0)

    // speed over the final stretch of the drag only - a slow start must not
    // drag down a flick that ended fast
    const last = d.samples[d.samples.length - 1]
    let first = last
    for (let k = d.samples.length - 2; k >= 0; k--) {
      if (last.t - d.samples[k].t > VELOCITY_WINDOW) break
      first = d.samples[k]
    }
    const dt = Math.max(8, last.t - first.t)
    const vx = (last.dx - first.dx) / dt, vy = (last.dy - first.dy) / dt   // px/ms
    // a finger that has stopped before lifting is a placement, not a flick
    const idle = performance.now() - last.t > 120

    const leftScore = (d.dx < -THRESH.left || (!idle && vx < -FLICK_SPEED && d.dx < -FLICK_MIN)) ? -d.dx / THRESH.left : 0
    const rightScore = (d.dx > THRESH.right || (!idle && vx > FLICK_SPEED && d.dx > FLICK_MIN)) ? d.dx / THRESH.right : 0
    const upScore = (d.dy < -THRESH.up || (!idle && vy < -FLICK_SPEED && d.dy < -FLICK_MIN)) ? -d.dy / THRESH.up : 0
    const downScore = (d.dy > THRESH.down || (!idle && vy > FLICK_SPEED && d.dy > FLICK_MIN)) ? d.dy / THRESH.down : 0
    const best = Math.max(leftScore, rightScore, upScore, downScore)
    const dir = best === 0 ? null
      : best === leftScore ? 'left'
      : best === rightScore ? 'right'
      : best === upScore ? 'up' : 'down'

    if (dir) {
      // the haptic and the throw fire together - the tick is the moment of
      // commitment, not a reward for waiting out the animation
      onCommit?.(dir)
      // box-shadow's "from" is whatever the card already has (its resting
      // drop-shadow) - no need to set a starting point by hand, the browser
      // transitions from the current computed value on its own
      el.style.transition = `transform ${FLING_MS}ms cubic-bezier(.32,.94,.6,1), opacity ${FLING_MS}ms ease-out, box-shadow ${FLING_MS}ms ease-out, background-color ${FLING_MS}ms ease-out`
      const rot = Math.max(-28, Math.min(28, d.dx / 7))
      const targets = {
        left: `translate(-${FLING.left}px, ${d.dy - 30}px) rotate(${Math.min(rot, -20)}deg) scale(.9)`,
        right: `translate(${FLING.right}px, ${d.dy - 30}px) rotate(${Math.max(rot, 20)}deg) scale(.9)`,
        up: `translate(${d.dx}px, -${FLING.up}px) rotate(${rot}deg) scale(.88)`,
        down: `translate(${d.dx}px, ${FLING.down}px) rotate(${rot}deg) scale(.88)`,
      }
      el.style.transform = targets[dir]
      el.style.opacity = '0'
      el.style.boxShadow = FLOURISH_GLOW_LIT
      el.style.backgroundColor = FLOURISH_TINT
      // the card leaves the deck right now - the next one is live for the
      // very next touch - and the thrown one just finishes its flight inert
      const card = order.find(c => c.id === d.id)
      if (card) commitOut(card)
      const id = d.id
      let done = false
      const finish = (ev) => {
        if (ev && ev.target !== el) return   // a child's transition bubbling up
        if (done) return
        done = true
        el.removeEventListener('transitionend', finish)
        land(id)
      }
      el.addEventListener('transitionend', finish)
      setTimeout(() => finish(), FLING_FALLBACK_MS)
    } else {
      el.style.transition = 'transform 340ms cubic-bezier(.34,1.4,.4,1), opacity 200ms ease-out'
      el.style.transform = 'translate(0px, 0px) rotate(0deg)'
      el.style.opacity = '1'
      // only the spring itself (transform) ends the spring-back - the opacity
      // fade finishes sooner and must not cut the transform off mid-bounce
      const clear = (ev) => {
        if (ev.target !== el || ev.propertyName !== 'transform') return
        el.style.transition = 'none'
        el.removeEventListener('transitionend', clear)
      }
      el.addEventListener('transitionend', clear)
    }
  }

  function onPointerCancel() {
    drag.current = null
    const el = topRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = 'translate(0px, 0px) rotate(0deg)'
    el.style.opacity = '1'
  }

  function onClickCapture(e) {
    if (justDragged.current) { e.preventDefault(); e.stopPropagation() }
  }

  // One flat, keyed list - thrown cards first, then the live deck - so a card
  // keeps its DOM node (and its in-flight transition) when it moves from the
  // deck to the leaving set. Ghosts sit first so the live cards never get
  // re-ordered around them.
  const items = [
    ...leaving.map(card => ({ card, ghost: true })),
    ...order.slice(0, 3).map((card, i) => ({ card, i })),
  ]

  return (
    <div className={styles.stack}>
      {items.map(({ card, ghost, i }) => ghost ? (
        <div
          key={card.id}
          className={styles.card}
          style={{ zIndex: 2, pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {renderCard(card)}
        </div>
      ) : (
        <div
          key={card.id}
          ref={i === 0 ? topRef : null}
          className={`${styles.card}${i > 0 ? ` ${styles.cardBehind}` : ''}`}
          // Kept low on purpose: the bloom sits at z-index 2 (Today.module.css's
          // .headerRingWrap), and neither .stack nor its ancestors isolate a
          // stacking context, so these numbers compete directly against it in
          // the same context. 1/0/-1 preserves the deck's own front-to-back
          // order (top card above its peeks) while staying under the bloom,
          // so the flower overlaps the card's corner instead of the reverse.
          style={i > 0 ? { transform: `translateY(${i * 14}px) scale(${1 - i * 0.045})`, opacity: i === 1 ? 0.9 : 0.55, zIndex: 1 - i } : { zIndex: 1 }}
          onPointerDown={i === 0 ? e => onPointerDown(e, card.id) : undefined}
          onPointerMove={i === 0 ? onPointerMove : undefined}
          onPointerUp={i === 0 ? onPointerUp : undefined}
          onPointerCancel={i === 0 ? onPointerCancel : undefined}
          onClickCapture={i === 0 ? onClickCapture : undefined}
        >
          {renderCard(card)}
        </div>
      ))}
    </div>
  )
}
