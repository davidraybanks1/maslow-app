export const MODES = {
  exploration:  { name: 'exploration',  color: '#1B3A2D', pip: '#1B3A2D' },
  appreciation: { name: 'appreciation', color: '#B8C3B1', pip: '#B8C3B1' },
  nourishment:  { name: 'nourishment',  color: '#E8B81F', pip: '#E8B81F' },
  survival:     { name: 'survival',     color: '#D93B1C', pip: '#D93B1C' },
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

export const MODE_MAX_BUBBLES = { exploration: 3, appreciation: 2, nourishment: 1, survival: 1 }
export const MODE_WEIGHTS     = { exploration: 1, appreciation: 1, nourishment: 1, survival: 0.5 }
