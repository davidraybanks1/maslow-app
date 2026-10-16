export const CLAY    = '#3E2D26'
export const ON_CLAY = '#F6EFE9'

export const MODES = {
  exploration:  { name: 'exploration',  color: '#1B3A2D', pip: '#1B3A2D' },
  appreciation: { name: 'appreciation', color: '#ABBEA3', pip: '#ABBEA3' },
  nourishment:  { name: 'nourishment',  color: '#F5B622', pip: '#F5B622' },
  survival:     { name: 'survival',     color: '#F55127', pip: '#F55127' },
}

export const MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

export const NEEDS = [
  { id: 'movement',    name: 'movement',    ring: 'universal' },
  { id: 'nutrition',   name: 'nutrition',   ring: 'universal' },
  { id: 'rest',        name: 'rest',        ring: 'universal' },
  { id: 'community',   name: 'community',   ring: 'personal' },
  { id: 'beauty',      name: 'beauty',      ring: 'personal' },
  { id: 'intimacy',    name: 'intimacy',    ring: 'personal' },
  { id: 'reflection',  name: 'reflection',  ring: 'personal' },
  { id: 'play',        name: 'play',        ring: 'personal' },
  { id: 'money',       name: 'money',       ring: 'personal' },
  { id: 'dwelling',    name: 'dwelling',    ring: 'personal' },
  { id: 'information', name: 'information', ring: 'personal' },
  { id: 'touch',       name: 'touch',       ring: 'personal' },
  { id: 'thrill',      name: 'thrill',      ring: 'personal' },
]

export const UNIVERSAL_NEEDS = ['movement', 'nutrition', 'rest']

// A person's own needs ({ id: 'c_xxxxxxxx', name }) sit beside the 13 above.
// They arrive with the user's data, so the store hands them over here once per
// render (setCustomNeeds) and everything that walks the needs asks allNeeds().
// NEEDS itself stays the fixed built-in list.
export const MAX_CUSTOM_NEEDS = 6
export const MAX_CUSTOM_NEED_NAME = 24
let customNeeds = []
let allCache = NEEDS
export function setCustomNeeds(list) {
  const next = Array.isArray(list) ? list : []
  if (next === customNeeds) return
  customNeeds = next
  allCache = next.length
    ? [...NEEDS, ...next.map(c => ({ id: c.id, name: c.name, ring: 'custom', custom: true }))]
    : NEEDS
}
export function allNeeds() { return allCache }

// A need's name from its id. A custom need that was deleted reads as a plain
// "removed need" in old history instead of showing its raw id.
export function needName(id) {
  const hit = allCache.find(n => n.id === id)
  if (hit) return hit.name
  return typeof id === 'string' && id.startsWith('c_') ? 'removed need' : id
}

export const MODE_MAX_BUBBLES = { exploration: 3, appreciation: 2, nourishment: 1, survival: 1 }
export const MODE_NEED_CAP    = { exploration: 1, appreciation: 2, nourishment: 3, survival: 4 }
export const MODE_DESCS = {
  exploration:  'the one need that gives you energy',
  appreciation: 'the needs that bring joy',
  nourishment:  'the needs that keep you from running empty',
  survival:     'the needs you just check the box on',
}
export const JOURNAL_TRUNCATE = 150
export const MODE_WEIGHTS     = { exploration: 1, appreciation: 1, nourishment: 1, survival: 0.5 }

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
