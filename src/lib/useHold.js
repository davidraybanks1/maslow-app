import { useRef } from 'react'
import { hapticTick, hapticSuccess } from './native'

// Press and hold to do something. A light buzz when the finger lands, a fill that
// runs across the element for HOLD_MS, then a firmer buzz and onComplete().
// Let go early and the fill drains away. A quick tap (under TAP_MS) calls onTap
// instead, so a card can still do something on a plain tap, like opening.
//
//   const hold = useHold({ onComplete, onTap })
//   <div ref={hold.cardRef} {...hold.press}>
//     <span ref={hold.fillRef} />   // scaled 0 → 1 while held
//
// A keyboard or assistive-tech click (event.detail === 0) completes straight
// away, since there is no way to "hold" it.

export const HOLD_MS = 1000
const TAP_MS = 350
const SLOP = 10
const FLASH_MS = 360

export function useHold({ onComplete, onTap, fill = true, ms = HOLD_MS }) {
  const cardRef = useRef(null)
  const fillRef = useRef(null)
  const s = useRef({ down: false, pid: null, x: 0, y: 0, t0: 0, raf: 0, fired: false, flash: 0 })
  const cb = useRef({})
  cb.current = { onComplete, onTap, fill, ms }

  function paint(p) {
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`
  }

  function settle() {
    const st = s.current
    cancelAnimationFrame(st.raf)
    st.raf = 0
    const card = cardRef.current
    if (card) delete card.dataset.holding
    paint(0)
  }

  function tick(now) {
    const st = s.current
    const p = Math.min(1, (now - st.t0) / cb.current.ms)
    if (cb.current.fill) paint(p)
    if (p < 1) { st.raf = requestAnimationFrame(tick); return }
    // finished
    st.fired = true
    st.raf = 0
    hapticSuccess()
    const card = cardRef.current
    if (card) {
      delete card.dataset.holding
      if (cb.current.fill) {
        card.dataset.flash = '1'
        clearTimeout(st.flash)
        st.flash = setTimeout(() => {
          const c = cardRef.current
          if (c) delete c.dataset.flash
          paint(0)
        }, FLASH_MS)
      }
    }
    cb.current.onComplete?.()
  }

  const press = {
    onPointerDown(e) {
      const st = s.current
      if (st.down) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      st.down = true
      st.pid = e.pointerId
      st.x = e.clientX
      st.y = e.clientY
      st.fired = false
      st.t0 = performance.now()
      const card = cardRef.current
      if (card) { delete card.dataset.flash; card.dataset.holding = '1' }
      clearTimeout(st.flash)
      paint(0)
      hapticTick()
      st.raf = requestAnimationFrame(tick)
    },
    onPointerMove(e) {
      const st = s.current
      if (!st.down || e.pointerId !== st.pid || st.fired) return
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > SLOP) { st.down = false; settle() }
    },
    onPointerUp(e) {
      const st = s.current
      if (!st.down || e.pointerId !== st.pid) return
      const held = performance.now() - st.t0
      const fired = st.fired
      st.down = false
      if (!fired) {
        settle()
        if (held < TAP_MS) cb.current.onTap?.()
      }
    },
    onPointerCancel() {
      const st = s.current
      if (!st.down) return
      st.down = false
      if (!st.fired) settle()
    },
    onPointerLeave(e) {
      if (e.pointerType !== 'mouse') return
      const st = s.current
      if (!st.down) return
      st.down = false
      if (!st.fired) settle()
    },
    onContextMenu(e) { e.preventDefault() },
    onClick(e) {
      // keyboard / screen reader activation: no hold possible, so just do it
      if (e.detail === 0) cb.current.onComplete?.()
    },
  }

  return { cardRef, fillRef, press }
}
