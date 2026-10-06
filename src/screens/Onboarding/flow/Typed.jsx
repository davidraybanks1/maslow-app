import { useEffect, useMemo, useRef } from 'react'
import styles from './Flow.module.css'

export const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Per-character timing: a steady ~28ms keystroke with small deterministic
// jitter, a beat after punctuation, and the whole line capped so a long
// paragraph speeds up instead of dragging.
function timesFor(text) {
  const chars = Array.from(text)
  const times = []
  let t = 0
  chars.forEach((ch, i) => {
    let step = 28 + (((i * 37) % 11) - 5) * 2.4
    if (/[.?!]/.test(ch)) step += 170
    else if (/[,;:—]/.test(ch)) step += 80
    times.push(t)
    t += step
  })
  const k = t > 3400 ? 3400 / t : 1
  return { chars, times, k, total: t * k }
}

// How long `text` takes to type, so callers can line other beats up with the
// end of a line.
export function typingMs(text) {
  return REDUCED_MOTION ? 0 : timesFor(text).total
}

// Types `text` one character at a time with a caret riding the leading edge.
//   run    — starts when this turns true (the text is invisible until then)
//   delay  — ms to wait after `run` before the first character
//   hold   — ms the caret keeps blinking after the last character
//   onDone — fires once the typing and the hold have both finished
// The characters are plain spans whose visibility is toggled through refs, so
// typing never re-renders the component.
export default function Typed({ text, run = true, delay = 0, hold = 0, onDone, as: Tag = 'span', className }) {
  const rootRef = useRef(null)
  const doneRef = useRef(onDone)
  useEffect(() => { doneRef.current = onDone })

  const words = useMemo(() => {
    const out = []
    let word = null
    let n = 0
    for (const ch of Array.from(text)) {
      if (/\s/.test(ch)) { out.push({ space: ch }); word = null; n++; continue }
      if (!word) { word = { chars: [] }; out.push(word) }
      word.chars.push({ ch, i: n })
      n++
    }
    return out
  }, [text])

  useEffect(() => {
    if (!run) return undefined
    if (REDUCED_MOTION) {
      const id = setTimeout(() => { if (doneRef.current) doneRef.current() }, 0)
      return () => clearTimeout(id)
    }
    const nodes = Array.from(rootRef.current.querySelectorAll('[data-c]'))
    // a re-run (React strict mode) starts from a blank line
    nodes.forEach(n => n.classList.remove(styles.chOn, styles.chCaret, styles.chBlink))
    const { times, k, total } = timesFor(text)
    const timers = []
    let caretOn = null
    nodes.forEach(node => {
      const i = Number(node.dataset.c)
      timers.push(setTimeout(() => {
        node.classList.add(styles.chOn)
        if (caretOn) caretOn.classList.remove(styles.chCaret, styles.chBlink)
        node.classList.add(styles.chCaret)
        caretOn = node
      }, delay + times[i] * k))
    })
    if (hold) timers.push(setTimeout(() => { if (caretOn) caretOn.classList.add(styles.chBlink) }, delay + total))
    timers.push(setTimeout(() => {
      if (caretOn) caretOn.classList.remove(styles.chCaret, styles.chBlink)
    }, delay + total + (hold || 420)))
    timers.push(setTimeout(() => { if (doneRef.current) doneRef.current() }, delay + total + hold))
    return () => timers.forEach(clearTimeout)
    // `text`, `delay` and `hold` are read at the moment `run` flips.
  }, [run])

  return (
    <Tag className={className} ref={rootRef}>
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        {words.map((w, wi) => w.space !== undefined
          ? w.space
          : (
            <span key={wi} className={styles.chWord}>
              {w.chars.map(c => (
                <span key={c.i} data-c={c.i} className={`${styles.ch}${REDUCED_MOTION ? ` ${styles.chOn}` : ''}`}>{c.ch}</span>
              ))}
            </span>
          ))}
      </span>
    </Tag>
  )
}
