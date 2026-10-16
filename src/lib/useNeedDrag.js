import { useState, useRef, useEffect } from 'react'
import { hapticTick } from './native'

// Drag a chip onto any element marked data-drop="<key>". Written with pointer
// events so one code path serves mouse, finger and pen (HTML5 drag-and-drop
// doesn't work on touch in the iOS web view).
//
//   mouse    picks up after a few pixels of movement
//   touch    picks up after a short hold, so a swipe still scrolls the page.
//            Once something is held, touchmove is cancelled so the page stays
//            put while the finger moves.
//
// A tap (no pickup) falls through to the button's own click.

const HOLD_MS = 220          // touch hold before pickup
const HOLD_SLOP = 9          // finger may drift this far while holding
const MOUSE_SLOP = 4
const EDGE = 84              // autoscroll band at the top and bottom of the scroller
const MAX_SPEED = 16

function scrollerFor(el) {
  return el?.closest?.('[data-scroll]') || document.scrollingElement || document.documentElement
}

function dropKeyAt(x, y) {
  const hit = document.elementFromPoint(x, y)
  const zone = hit?.closest?.('[data-drop]')
  return zone ? zone.getAttribute('data-drop') : null
}

// All the pointer bookkeeping lives in one closure built once per mount, so the
// window listeners it adds and removes are always the same function objects.
function makeController(setDrag, onDropRef) {
  let pending = null   // pointer is down, not yet picked up
  let active = null    // picked up
  let holdTimer = 0
  let raf = 0
  let suppressClick = false

  function cleanup() {
    clearTimeout(holdTimer)
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    pending = null
    active = null
    setDrag(null)
  }

  function refresh() {
    if (!active) return
    active.over = dropKeyAt(active.x, active.y)
    setDrag({ ...active })
  }

  // Keep the page scrolling while a chip is held near its top or bottom edge.
  function tick() {
    if (!active) return
    const sc = scrollerFor(active.el)
    const rect = sc === document.scrollingElement || sc === document.documentElement
      ? { top: 0, bottom: window.innerHeight }
      : sc.getBoundingClientRect()
    let v = 0
    if (active.y < rect.top + EDGE) v = -MAX_SPEED * Math.min(1, (rect.top + EDGE - active.y) / EDGE)
    else if (active.y > rect.bottom - EDGE) v = MAX_SPEED * Math.min(1, (active.y - (rect.bottom - EDGE)) / EDGE)
    if (v) {
      sc.scrollTop += v
      refresh() // content moved under the finger
    }
    raf = requestAnimationFrame(tick)
  }

  function pickUp(p, x, y) {
    active = { ...p, x, y, over: dropKeyAt(x, y) }
    hapticTick()
    setDrag({ ...active })
    tick()
  }

  function onMove(e) {
    if (active) {
      if (e.pointerId !== active.pointerId) return
      active.x = e.clientX
      active.y = e.clientY
      refresh()
      return
    }
    if (!pending || e.pointerId !== pending.pointerId) return
    const moved = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY)
    if (pending.type === 'mouse') {
      if (moved > MOUSE_SLOP) pickUp(pending, e.clientX, e.clientY)
    } else if (moved > HOLD_SLOP) {
      cleanup() // they are scrolling, not dragging
    }
  }

  function onUp(e) {
    if (active && e.pointerId === active.pointerId) {
      suppressClick = true
      setTimeout(() => { suppressClick = false }, 0)
      const id = active.id
      const over = dropKeyAt(e.clientX, e.clientY)
      cleanup()
      onDropRef.current(id, over)
      return
    }
    if (pending && e.pointerId === pending.pointerId) cleanup()
  }

  function onCancel(e) {
    const p = active || pending
    if (p && e.pointerId === p.pointerId) cleanup()
  }

  function down(e, id, label) {
    if (pending || active) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const p = {
      id, label, el,
      pointerId: e.pointerId,
      type: e.pointerType === 'mouse' ? 'mouse' : 'touch',
      startX: e.clientX, startY: e.clientY,
      ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, h: r.height,
    }
    pending = p
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    if (p.type === 'touch') {
      holdTimer = setTimeout(() => { if (pending === p) pickUp(p, p.startX, p.startY) }, HOLD_MS)
    }
  }

  return {
    down,
    cleanup,
    isActive: () => !!active,
    consumeClick: () => suppressClick,
  }
}

export function useNeedDrag({ onDrop }) {
  const [drag, setDrag] = useState(null) // { id, label, x, y, ox, oy, w, h, over }
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop
  const ctl = useRef(null)
  if (!ctl.current) ctl.current = makeController(setDrag, onDropRef)

  useEffect(() => {
    const c = ctl.current
    // The page must not scroll under a held finger. Registered once, up front,
    // because iOS only honours preventDefault on listeners present at touchstart.
    const block = e => { if (c.isActive()) e.preventDefault() }
    window.addEventListener('touchmove', block, { passive: false })
    return () => {
      window.removeEventListener('touchmove', block)
      c.cleanup()
    }
  }, [])

  // Props to spread on each draggable chip (a <button>).
  function chipProps(id, label, onTap) {
    return {
      onPointerDown: e => ctl.current.down(e, id, label),
      onContextMenu: e => e.preventDefault(),
      onClick: e => {
        if (ctl.current.consumeClick()) { e.preventDefault(); return }
        onTap?.(id)
      },
    }
  }

  return { drag, chipProps }
}
