import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/* Desktop chrome state shared between the shell (strip + rail) and the screens.

   focus   — the writing page has asked for the whole window. The strip slides
             away and the rail goes with it; a hot zone on the left edge brings
             the strip back for as long as the pointer is there.
   quiet   — the person is mid-sentence. The strip and the page furniture dim to
             a whisper (see Write.jsx); any pointer movement brings them back.
   pinned  — the rail is docked open and pushes the page over, rather than
             floating over it. Remembered on this device.

   None of this exists below 900px. */

const PIN_KEY = 'loam_desk_rail_pinned'

function readPinned() {
  try { return localStorage.getItem(PIN_KEY) === '1' } catch { return false }
}

const DeskChromeContext = createContext(null)

export function DeskChromeProvider({ children }) {
  const [focus, setFocus] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const [pinned, setPinnedState] = useState(readPinned)

  const setPinned = useCallback(next => {
    setPinnedState(prev => {
      const v = typeof next === 'function' ? next(prev) : next
      try { localStorage.setItem(PIN_KEY, v ? '1' : '0') } catch {}
      return v
    })
  }, [])

  const value = useMemo(
    () => ({ focus, setFocus, quiet, setQuiet, pinned, setPinned }),
    [focus, quiet, pinned, setPinned],
  )
  return <DeskChromeContext.Provider value={value}>{children}</DeskChromeContext.Provider>
}

const FALLBACK = { focus: false, setFocus() {}, quiet: false, setQuiet() {}, pinned: false, setPinned() {} }
export function useDeskChrome() {
  return useContext(DeskChromeContext) || FALLBACK
}
