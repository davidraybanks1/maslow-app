import { useEffect, useRef } from 'react'
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

// Which tile does a press belong to? Normally the one the browser says was
// touched. But on iOS the reported target has been seen to be the tile BELOW
// the one under the finger, so the press is routed by where the finger really
// is: if the point is inside a different hold-card than the target's own, that
// card takes the press (and keeps it, through move / up / cancel).
const registry = new WeakMap()       // card element -> its hold controller
const owners = new Map()             // pointerId -> controller that owns the press

function contains(el, x, y) {
  const r = el.getBoundingClientRect()
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

function cardAt(x, y) {
  if (typeof document === 'undefined') return null
  for (const el of document.querySelectorAll('[data-hold-card]')) {
    if (contains(el, x, y)) return el
  }
  return null
}

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

  const api = {
    down(e) {
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
    move(e) {
      const st = s.current
      if (!st.down || e.pointerId !== st.pid || st.fired) return
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > SLOP) { st.down = false; settle() }
    },
    up(e) {
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
    cancel() {
      const st = s.current
      if (!st.down) return
      st.down = false
      if (!st.fired) settle()
    },
    leave(e) {
      if (e.pointerType !== 'mouse') return
      const st = s.current
      if (!st.down) return
      st.down = false
      if (!st.fired) settle()
    },
  }

  useEffect(() => {
    const el = cardRef.current
    if (!el) return undefined
    registry.set(el, api)
    return () => { registry.delete(el) }
  }, [])

  const press = {
    onPointerDown(e) {
      let owner = api
      const own = cardRef.current
      if (own && !contains(own, e.clientX, e.clientY)) {
        const hit = cardAt(e.clientX, e.clientY)
        const other = hit && registry.get(hit)
        if (other) owner = other
      }
      owners.set(e.pointerId, owner)
      owner.down(e)
    },
    onPointerMove(e) { (owners.get(e.pointerId) || api).move(e) },
    onPointerUp(e) {
      const owner = owners.get(e.pointerId) || api
      owners.delete(e.pointerId)
      owner.up(e)
    },
    onPointerCancel(e) {
      const owner = owners.get(e.pointerId) || api
      owners.delete(e.pointerId)
      owner.cancel(e)
    },
    onPointerLeave(e) { (owners.get(e.pointerId) || api).leave(e) },
    onContextMenu(e) { e.preventDefault() },
    onClick(e) {
      // keyboard / screen reader activation: no hold possible, so just do it
      if (e.detail === 0) cb.current.onComplete?.()
    },
  }

  return { cardRef, fillRef, press }
}
