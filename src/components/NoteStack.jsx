import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './NoteStack.module.css'

/* A tinder-style deck: one note on top, a couple peeking behind it. The top
   note is dragged with a finger and let go - up, down, or to the left carries
   it off the screen and it is gone for the session; a release that falls
   short, or a drag to the right, springs back to centre. Everything below
   pointerdown is imperative (direct style writes on the DOM node), so a drag
   never waits on a re-render - React only hears about it once a note has
   actually left, via onDismiss. */

const THRESH = { left: 96, up: 88, down: 110 }
const FLING = { left: 620, up: 720, down: 720 }
const DEADZONE = 5

export default function NoteStack({ cards, onDismiss, renderCard }) {
  const [order, setOrder] = useState(cards)
  const idsKey = cards.map(c => c.id).join('|')

  // Only resync from the parent when the actual set of ids changes (a note
  // added or removed elsewhere, or the deck coming back on reopen) - not on
  // every unrelated re-render, which would otherwise fight the local order
  // as cards fly out one by one.
  useEffect(() => { setOrder(cards) }, [idsKey])

  const topRef = useRef(null)
  const drag = useRef(null)
  const justDragged = useRef(false)

  const settle = useCallback((id) => {
    setOrder(o => o.filter(c => c.id !== id))
    onDismiss(id)
  }, [onDismiss])

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

    const first = d.samples[0], last = d.samples[d.samples.length - 1]
    const dt = Math.max(1, last.t - first.t)
    const vx = (last.dx - first.dx) / dt, vy = (last.dy - first.dy) / dt   // px/ms

    const leftScore = (d.dx < -THRESH.left || (vx < -0.5 && d.dx < -24)) ? -d.dx / THRESH.left : 0
    const upScore = (d.dy < -THRESH.up || (vy < -0.5 && d.dy < -24)) ? -d.dy / THRESH.up : 0
    const downScore = (d.dy > THRESH.down || (vy > 0.5 && d.dy > 24)) ? d.dy / THRESH.down : 0
    const best = Math.max(leftScore, upScore, downScore)
    const dir = best === 0 ? null : best === leftScore ? 'left' : best === upScore ? 'up' : 'down'

    if (dir) {
      el.style.transition = 'transform 260ms cubic-bezier(.2,.7,.3,1), opacity 220ms ease-out'
      const rot = Math.max(-24, Math.min(24, d.dx / 9))
      const targets = {
        left: `translate(-${FLING.left}px, ${d.dy}px) rotate(${Math.min(rot, -14)}deg)`,
        up: `translate(${d.dx}px, -${FLING.up}px) rotate(${rot}deg)`,
        down: `translate(${d.dx}px, ${FLING.down}px) rotate(${rot}deg)`,
      }
      el.style.transform = targets[dir]
      el.style.opacity = '0'
      const id = d.id
      let done = false
      const finish = () => { if (done) return; done = true; el.removeEventListener('transitionend', finish); settle(id) }
      el.addEventListener('transitionend', finish)
      setTimeout(finish, 320)
    } else {
      el.style.transition = 'transform 340ms cubic-bezier(.34,1.4,.4,1), opacity 200ms ease-out'
      el.style.transform = 'translate(0px, 0px) rotate(0deg)'
      el.style.opacity = '1'
      const clear = () => { el.style.transition = 'none'; el.removeEventListener('transitionend', clear) }
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

  return (
    <div className={styles.stack}>
      {order.slice(0, 3).map((card, i) => (
        <div
          key={card.id}
          ref={i === 0 ? topRef : null}
          className={`${styles.card}${i > 0 ? ` ${styles.cardBehind}` : ''}`}
          style={i > 0 ? { transform: `translateY(${i * 14}px) scale(${1 - i * 0.045})`, opacity: i === 1 ? 0.9 : 0.55, zIndex: 10 - i } : { zIndex: 10 }}
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
