import { useEffect, useState } from 'react'

/* iOS does not shrink the layout viewport when the software keyboard opens.
   It shrinks the *visual* viewport and then re-pins position:fixed elements
   inside it — which is why the tab bar ends up floating on top of the
   composer, and why scrollIntoView thinks a field behind the keys is visible.
   Everything here is about telling the difference between those two
   viewports. */

const FIELD = el =>
  !!el && (
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable ||
    (el.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|file|range|color)$/i.test(el.type || 'text'))
  )

/* True while a text field holds focus, which is the honest proxy for "the
   keyboard is up" — the visual-viewport delta is zero on platforms that
   resize the layout viewport instead, and this is right on both. */
export function useTypingFocus() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let pending = null
    const on = e => {
      if (!FIELD(e.target)) return
      clearTimeout(pending)   // focus moving between two fields must not flicker
      setTyping(true)
    }
    const off = e => {
      if (!FIELD(e.target)) return
      clearTimeout(pending)
      pending = setTimeout(() => setTyping(false), 60)
    }
    document.addEventListener('focusin', on)
    document.addEventListener('focusout', off)
    return () => {
      clearTimeout(pending)
      document.removeEventListener('focusin', on)
      document.removeEventListener('focusout', off)
    }
  }, [])
  return typing
}

/* How many pixels of the layout viewport the keyboard is sitting on top of.
   Needed as a spacer, not just as a signal: scrolling the composer clear of
   the keys only works if there is something below it to scroll into, and the
   scroll container's 96px of tab-bar padding is well short of a keyboard. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const read = () => {
      const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop)
      setInset(covered > 80 ? covered : 0)   // below 80 it is browser chrome, not a keyboard
    }
    read()
    vv.addEventListener('resize', read)
    vv.addEventListener('scroll', read)
    return () => {
      vv.removeEventListener('resize', read)
      vv.removeEventListener('scroll', read)
    }
  }, [])
  return inset
}

/* Scroll just enough that `el`'s bottom clears the keyboard. A no-op when
   nothing is covered, so it is safe to fire more than once. */
export function revealAboveKeyboard(el, pad = 16) {
  if (!el) return
  const vv = window.visualViewport
  const floor = vv ? vv.offsetTop + vv.height : window.innerHeight
  const over = el.getBoundingClientRect().bottom + pad - floor
  if (over <= 1) return
  const sc = document.querySelector('[data-scroll]')
  if (sc) sc.scrollBy({ top: over, behavior: 'smooth' })
  else window.scrollBy({ top: over, behavior: 'smooth' })
}

/* The keyboard animates in over ~250-400ms and the visual viewport resizes in
   steps, so one shot at any single moment is a guess. Three idempotent passes
   cover the range without needing to know the platform's timing. */
export function revealWhenSettled(getEl, pad) {
  const timers = [120, 340, 620, 900].map(ms => setTimeout(() => revealAboveKeyboard(getEl(), pad), ms))
  return () => timers.forEach(clearTimeout)
}
