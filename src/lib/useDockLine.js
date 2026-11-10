import { useEffect, useState } from 'react'

/* The scroller is App's [data-scroll] on a phone and the side panel's own box
   on a desktop; the header docks against whichever one this page is in. */
function scrollParent(el) {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n
  }
  return null
}

const DOCK_H = 48

/* Once a section with a data-dock line reaches the top, its line becomes the
   header. Above the first of them the page's own dateline is still on screen. */
export function useDockLine(rootRef) {
  const [line, setLine] = useState(null)
  useEffect(() => {
    const root = rootRef.current
    const scroller = scrollParent(root)
    if (!root || !scroller) return
    const read = () => {
      const edge = scroller.getBoundingClientRect().top + parseFloat(getComputedStyle(scroller).paddingTop || 0) + DOCK_H
      // the last section may be too short to ever reach the top; at the end of the page it has arrived
      const atEnd = scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
      let cur = null
      root.querySelectorAll('[data-dock]').forEach(s => { if (atEnd || s.getBoundingClientRect().top <= edge) cur = s.dataset.dock })
      setLine(cur)
    }
    read()
    scroller.addEventListener('scroll', read, { passive: true })
    // a strata range or an opened section can change the line without a scroll
    const mo = new MutationObserver(read)
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-dock'] })
    return () => { scroller.removeEventListener('scroll', read); mo.disconnect() }
  }, [rootRef])
  return line
}
