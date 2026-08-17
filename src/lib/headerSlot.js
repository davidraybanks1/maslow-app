import { createContext } from 'react'

// Value is the setState setter from AppInner.
// Screens call setSlot(element) on mount/state-change to register a
// right-side control in the shell AppHeader, and return () => setSlot(null).
export const HeaderSlotContext = createContext(() => {})
