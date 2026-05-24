export const LAYERS = {
  survival: {
    name: 'survival',
    pip: '#D93B1C',
    border: '#D93B1C',
    text: '#D93B1C',
    bg: '#FFF0EC',
    slots: 4,
    bubbles: 0,
  },
  nourishment: {
    name: 'nourishment',
    pip: '#E8B81F',
    border: '#CC9C00',
    text: '#8A6A00',
    bg: '#FFF9E0',
    slots: 3,
    bubbles: 1,
  },
  appreciation: {
    name: 'appreciation',
    pip: '#B8C3B1',
    border: '#A8B8B0',
    text: '#4A6860',
    bg: '#F2F5F3',
    slots: 2,
    bubbles: 2,
  },
  play: {
    name: 'play',
    pip: '#1B3A2D',
    border: '#1B3A2D',
    text: '#1B3A2D',
    bg: '#E8EFE9',
    slots: 1,
    bubbles: 3,
  },
}

export const LAYER_ORDER = ['play', 'appreciation', 'nourishment', 'survival']

export const NEEDS = [
  { id: 'movement',   name: 'Movement',   description: 'Exercise, mobility, physical vitality' },
  { id: 'community',  name: 'Community',  description: 'Friendship, family, belonging' },
  { id: 'reflection', name: 'Reflection', description: 'Journaling, self-awareness, inner life' },
  { id: 'purpose',    name: 'Purpose',    description: 'Meaning, contribution, creative output' },
  { id: 'nutrition',  name: 'Nutrition',  description: 'Food, hydration, relationship with eating' },
  { id: 'rest',       name: 'Rest',       description: 'Sleep, stillness, nervous system recovery' },
  { id: 'beauty',     name: 'Beauty',     description: 'Art, music, nature, aesthetic experience' },
  { id: 'security',   name: 'Security',   description: 'Financial stability, safety, structure' },
  { id: 'dwelling',   name: 'Dwelling',   description: 'Home, environment, cleanliness' },
  { id: 'intimacy',   name: 'Intimacy',   description: 'Romance, deep partnership, vulnerability' },
]

export function defaultCanvas() {
  return {
    movement:   'nourishment',
    community:  'nourishment',
    reflection: 'nourishment',
    purpose:    'nourishment',
    nutrition:  'nourishment',
    rest:       'nourishment',
    beauty:     'nourishment',
    security:   'nourishment',
    dwelling:   'nourishment',
    intimacy:   'nourishment',
  }
}

export function totalBubbles(canvas) {
  return NEEDS.reduce((s, n) => s + (LAYERS[canvas[n.id]]?.bubbles || 0), 0)
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}