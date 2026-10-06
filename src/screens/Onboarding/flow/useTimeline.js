import { useCallback, useEffect, useRef } from 'react'

// at(ms, fn): runs fn after ms, unless the screen has gone by then. All timers
// are cleared on unmount (and between React strict-mode effect passes).
export default function useTimeline() {
  const ids = useRef([])
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      ids.current.forEach(clearTimeout)
      ids.current = []
    }
  }, [])
  return useCallback((ms, fn) => {
    const id = setTimeout(() => { if (alive.current) fn() }, ms)
    ids.current.push(id)
  }, [])
}

// Splits body copy into one block per sentence, without lookbehind (older
// iOS web views reject it at parse time).
export function splitSentences(text) {
  const out = []
  const re = /[.?!]\s+(?=[A-Z“‘"'])/g
  let start = 0
  let m
  while ((m = re.exec(text))) {
    out.push(text.slice(start, m.index + 1))
    start = m.index + m[0].length
  }
  out.push(text.slice(start))
  return out
}
