import { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import styles from './NoteStack.module.css'

/* The phone's notes to self: one note at a time, sitting on the paper. Drag it
   sideways and the next note comes in from the other edge with the finger, the
   way the Observation pager moves on Data. Past the threshold (or on a quick
   flick) it slides off and is gone for the session; a short release returns.
   The drag writes styles straight to the DOM, so it never waits on a render.
   React only hears about a note once it has actually left, via onDismiss.

   The moment a note is committed, onCommit (the haptic) and the slide fire
   together: the tick is the decision, not a reward for waiting out the motion.

   Only horizontal drags belong to the note. touch-action: pan-y leaves vertical
   movement to the page. */

const THRESH = 64
// a quick flick counts even when it is short: this fast (px/ms), over at least
// this far (px), measured across the last VELOCITY_WINDOW ms of the drag
const FLICK_SPEED = 0.35
const FLICK_MIN = 18
const VELOCITY_WINDOW = 110
const DEADZONE = 5
// a decelerating curve, close to a scroll-snap settle. Real scroll-snap only
// reports where it landed after the fact, which would make the tick late.
const SLIDE_MS = 320
const CLOSE_MS = 220
const EASE = 'cubic-bezier(.22,.61,.36,1)'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const offset = x => `translate3d(${x}px, 0, 0)`
const currentX = el => new DOMMatrix(getComputedStyle(el).transform).m41

// One run per element: starting another supersedes the first, whose `done`
// then never fires, so a note retargeted mid-flight keeps only its last job.
const runs = new WeakMap()
function animate(el, prop, value, ms, done) {
  const run = {}
  runs.set(el, run)
  let timer
  const finish = ev => {
    if (ev && (ev.target !== el || ev.propertyName !== prop)) return
    el.removeEventListener('transitionend', finish)
    clearTimeout(timer)
    if (runs.get(el) !== run) return
    runs.delete(el)
    el.style.transition = ''
    done?.()
  }
  el.style.transition = `${prop} ${ms}ms ${EASE}`
  el.style[prop] = value
  el.addEventListener('transitionend', finish)
  // a value that did not change never fires transitionend
  timer = setTimeout(finish, ms + 60)
}

// Stop whatever is moving this element and hold it where it is.
function hold(el, prop, value) {
  runs.delete(el)
  el.style.transition = 'none'
  el.style[prop] = value
}

export default function NoteStack({ cards, onDismiss, onCommit, onClosed, closeRef, renderCard, dataTour, footer }) {
  const [order, setOrder] = useState(cards)
  // Notes already committed but still sliding off. They leave `order` at once
  // so the next note is live for the very next touch, and stay in the tree,
  // inert, until their slide finishes.
  const [leaving, setLeaving] = useState([])
  const idsKey = cards.map(c => c.id).join('|')

  // Only resync when the actual set of ids changes (a note added elsewhere, the
  // deck coming back on reopen), so a re-render can't fight notes on their way out.
  useEffect(() => { setOrder(cards) }, [idsKey])

  const stackRef = useRef(null)
  const topRef = useRef(null)
  const peekRef = useRef(null)
  const drag = useRef(null)
  const justDragged = useRef(false)

  const land = id => setLeaving(l => l.filter(c => c.id !== id))

  function closeSection(stack) {
    const section = closeRef?.current
    const finish = () => {
      // unmount first: clearing the height while the section is still on the
      // page would show it again for a frame
      flushSync(() => onClosed?.())
      if (section) { section.style.overflow = ''; section.style.height = '' }
      stack.style.height = ''
    }
    if (!section) return finish()
    section.style.overflow = 'hidden'
    hold(section, 'height', `${section.offsetHeight}px`)
    void section.offsetHeight
    animate(section, 'height', '0px', CLOSE_MS, finish)
  }

  function commit(dir) {
    const el = topRef.current
    const card = order[0]
    if (!el || !card) return
    onCommit?.(dir)

    const rest = order.slice(1)
    if (reducedMotion()) {
      setOrder(rest)
      onDismiss(card.id, false)
      return
    }

    const stack = stackRef.current
    const peek = peekRef.current
    const sign = dir === 'left' ? -1 : 1
    const travel = window.innerWidth

    hold(stack, 'height', `${stack.offsetHeight}px`)
    if (peek) {
      // the arrow arrives with the next note still parked; a drag already has
      // it on the correct side
      if (peek.style.visibility !== 'visible' || currentX(peek) * sign >= 0) {
        hold(peek, 'transform', offset(-sign * travel))
        peek.style.visibility = 'visible'
      }
      void peek.offsetWidth
      const nextHeight = peek.offsetHeight
      animate(peek, 'transform', offset(0), SLIDE_MS, () => {
        peek.style.transform = ''
        peek.style.visibility = ''
      })
      animate(stack, 'height', `${nextHeight}px`, SLIDE_MS, () => { stack.style.height = '' })
    }

    animate(el, 'transform', offset(sign * travel), SLIDE_MS, () => {
      land(card.id)
      if (!peek) closeSection(stack)
    })

    setOrder(rest)
    setLeaving(l => [...l, card])
    onDismiss(card.id, true)
  }

  function returnToRest(d) {
    const el = topRef.current
    const peek = peekRef.current
    const stack = stackRef.current
    if (el) animate(el, 'transform', offset(0), SLIDE_MS, () => { el.style.transform = '' })
    if (peek && d?.peekSide) {
      animate(peek, 'transform', offset(d.peekSide * window.innerWidth), SLIDE_MS, () => {
        peek.style.transform = ''
        peek.style.visibility = ''
      })
    }
    if (stack && stack.style.height) {
      animate(stack, 'height', `${el ? el.offsetHeight : stack.offsetHeight}px`, SLIDE_MS, () => { stack.style.height = '' })
    }
  }

  function onPointerDown(e) {
    const id = order[0]?.id
    if (id == null) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // the edit link and the arrow stay plain buttons
    if (e.target.closest?.('button, a')) return
    const el = topRef.current
    // a swipe has to begin on the note itself
    if (!el || !el.contains(e.target)) return
    el.setPointerCapture?.(e.pointerId)
    const reduced = reducedMotion()
    // a note still sliding in can be caught where it is
    const base = reduced ? 0 : currentX(el)
    if (!reduced) hold(el, 'transform', offset(base))
    drag.current = { x0: e.clientX, y0: e.clientY, dx: 0, base, axis: null, reduced, peekSide: 0, samples: [{ t: performance.now(), dx: 0 }] }
  }

  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.axis) {
      if (Math.hypot(dx, dy) < DEADZONE) return
      d.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
      if (d.axis === 'y') {
        drag.current = null
        if (d.base) returnToRest(d)
        return
      }
      justDragged.current = true
      const stack = stackRef.current
      const peek = peekRef.current
      if (!d.reduced && peek) {
        d.h0 = stack.offsetHeight
        d.h1 = peek.offsetHeight
        hold(stack, 'height', `${d.h0}px`)
      }
    }
    e.preventDefault()
    d.dx = dx
    const now = performance.now()
    d.samples.push({ t: now, dx })
    if (d.samples.length > 6) d.samples.shift()
    // reduced motion: nothing follows the finger, the note just swaps on release
    if (d.reduced) return

    const travel = window.innerWidth
    const x = d.base + dx
    topRef.current.style.transform = offset(x)
    const peek = peekRef.current
    if (peek) {
      d.peekSide = x < 0 ? 1 : -1
      hold(peek, 'transform', offset(x + d.peekSide * travel))
      peek.style.visibility = x === 0 ? 'hidden' : 'visible'
      stackRef.current.style.height = `${d.h0 + (d.h1 - d.h0) * Math.min(1, Math.abs(x) / travel)}px`
    }
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.axis) {
      justDragged.current = false
      if (d.base) returnToRest(d)
      return
    }
    setTimeout(() => { justDragged.current = false }, 0)

    // speed over the final stretch only: a slow start must not drag down a
    // flick that ended fast
    const last = d.samples[d.samples.length - 1]
    let first = last
    for (let k = d.samples.length - 2; k >= 0; k--) {
      if (last.t - d.samples[k].t > VELOCITY_WINDOW) break
      first = d.samples[k]
    }
    const vx = (last.dx - first.dx) / Math.max(8, last.t - first.t)
    // a finger that has stopped before lifting is a placement, not a flick
    const idle = performance.now() - last.t > 120
    const flick = !idle && Math.abs(vx) > FLICK_SPEED && Math.abs(d.dx) > FLICK_MIN && Math.sign(vx) === Math.sign(d.dx)

    if (Math.abs(d.dx) > THRESH || flick) commit(d.dx < 0 ? 'left' : 'right')
    else if (!d.reduced) returnToRest(d)
  }

  function onPointerCancel() {
    const d = drag.current
    drag.current = null
    if (d && !d.reduced && d.axis) returnToRest(d)
  }

  function onClickCapture(e) {
    if (justDragged.current) { e.preventDefault(); e.stopPropagation() }
  }

  // One flat, keyed list, always in this order, so a note keeps its DOM node
  // (and its running transition) as it goes from next, to top, to leaving.
  const shown = new Set(order.slice(0, 2).map(c => c.id))
  const items = [
    ...leaving.filter(c => !shown.has(c.id)).map(card => ({ card, cls: styles.ghost })),
    ...order.slice(0, 2).map((card, i) => ({ card, i, cls: i === 0 ? '' : styles.peek })),
  ]

  return (
    <div
      className={styles.surface}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      <div ref={stackRef} className={styles.stack}>
        {items.map(({ card, i, cls }) => (
          <div
            key={card.id}
            ref={i === 0 ? topRef : i === 1 ? peekRef : null}
            // the tour frames the top note itself
            data-tour={i === 0 ? dataTour : undefined}
            className={`${styles.note} ${cls}`}
            aria-hidden={i === 0 ? undefined : 'true'}
          >
            {renderCard(card)}
          </div>
        ))}
      </div>
      {footer?.(() => commit('left'))}
    </div>
  )
}
