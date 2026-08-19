export const SLOTS = ['morning', 'midday', 'evening']

// Noun used in mood questions ("how's the {X}?")
export const SLOT_NOUN = { morning: 'morning', midday: 'day', evening: 'evening' }

// Past-tense noun for retro questions ("how was the {X}?")
export const SLOT_PAST_NOUN = { morning: 'morning', midday: 'day', evening: 'evening' }

// Greeting copy — "good {X}." in the Today header
export const SLOT_GREETING = { morning: 'morning', midday: 'afternoon', evening: 'evening' }

export function currentSlot() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'midday'
  return 'evening'
}

export function precedingSlots(slot) {
  const idx = SLOTS.indexOf(slot)
  return SLOTS.slice(0, idx)
}
