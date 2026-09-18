import { useLayoutEffect, useRef, useState } from 'react'

/* Text that grows to fill the box it is in: a short note sets large, a long
   one steps down until it fits. The size is found by measuring, starting
   from `max` and shrinking a point at a time while the parent overflows, so
   the note takes up as much of its card as it can. Re-measured when the
   text or the parent's size changes. */
export default function FitText({ text, className, max = 30, min = 14, style }) {
  const ref = useRef(null)
  const [size, setSize] = useState(max)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.parentElement
    if (!box) return
    const fit = () => {
      let s = max
      el.style.fontSize = `${s}px`
      el.style.lineHeight = lineHeight(s)
      while (s > min && (box.scrollHeight > box.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        s -= 1
        el.style.fontSize = `${s}px`
        el.style.lineHeight = lineHeight(s)
      }
      setSize(s)
    }
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(box)
    const onFonts = () => fit()
    document.fonts?.ready?.then(onFonts)
    return () => ro?.disconnect()
  }, [text, max, min])

  return (
    <span ref={ref} className={className} style={{ ...style, fontSize: size, lineHeight: lineHeight(size) }}>{text}</span>
  )
}

// big type sits tighter; small type needs more air between lines
function lineHeight(px) { return px >= 24 ? '1.22' : px >= 18 ? '1.32' : '1.45' }
