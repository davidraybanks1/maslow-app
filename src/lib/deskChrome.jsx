import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/* Desktop chrome state shared between the shell (strip + rail) and the screens.

   focus   — the writing page has asked for the whole window. The strip slides
             away and the rail goes with it; a hot zone on the left edge brings
             the strip back for as long as the pointer is there.
   quiet   — the person is mid-sentence. The strip and the page furniture dim to
             a whisper (see Write.jsx); any pointer movement brings them back.
   panel   — which view the side panel is showing: 'today' | 'data' | 'drafts' |
             'practices', or null when it is closed. The writing page is the only
             full page; everything else opens here, beside it.

   None of this exists below 900px. */

const DeskChromeContext = createContext(null)

export function DeskChromeProvider({ children }) {
  const [focus, setFocus] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const [panel, setPanelState] = useState(null)

  const setPanel = useCallback(next => setPanelState(next), [])
  // focus gives the page the whole window, so it closes the panel
  useEffect(() => { if (focus) setPanelState(null) }, [focus])

  const value = useMemo(
    () => ({ focus, setFocus, quiet, setQuiet, panel, setPanel }),
    [focus, quiet, panel, setPanel],
  )
  return <DeskChromeContext.Provider value={value}>{children}</DeskChromeContext.Provider>
}

const FALLBACK = { focus: false, setFocus() {}, quiet: false, setQuiet() {}, panel: null, setPanel() {} }
export function useDeskChrome() {
  return useContext(DeskChromeContext) || FALLBACK
}
