// ─── Layer / Mode system ──────────────────────────────────────────
export const LAYERS = {
  survival: {
    name: 'survival',
    rowSpan: 1,
    pct: 2.5,
    border: '#E13E15',
    text: '#E13E15',
    pip: '#E13E15',
    bg: '#FFF0EC',
    description: "You're keeping this need alive. Nothing more. It's not feeding you — but you've chosen to let it take a back seat so something else can have the space it deserves.",
  },
  nourishment: {
    name: 'nourishment',
    rowSpan: 4,
    pct: 10,
    border: '#CC9C00',
    text: '#8A6A00',
    pip: '#FFC300',
    bg: '#FFF9E0',
    description: "You're meeting this need in a way that genuinely sustains you. It's not exciting — it's better than that. It's steady. The foundation everything else is built on.",
  },
  appreciation: {
    name: 'appreciation',
    rowSpan: 6,
    pct: 15,
    border: '#A8B8B0',
    text: '#4A6860',
    pip: '#D8E2DC',
    bg: '#F2F5F3',
    description: "This need brings you real joy. You're not just maintaining it — you're present for it. It gives back more than the minimum. This is the texture of a life well lived.",
  },
  play: {
    name: 'play',
    rowSpan: 8,
    pct: 20,
    border: '#1B3627',
    text: '#1B3627',
    pip: '#1B3627',
    bg: '#E8EFE9',
    description: "This need has become part of who you are. It's no longer something you do — it's something you live. Time spent here doesn't feel like effort. This is your ground.",
  },
}

export const LAYER_ORDER = ['survival', 'nourishment', 'appreciation', 'play']

// ─── 10 Core needs ───────────────────────────────────────────────
export const NEEDS = [
  {
    id: 'movement',
    name: 'Movement',
    description: 'Exercise, mobility, physical vitality',
    defaultMode: 'nourishment',
  },
  {
    id: 'community',
    name: 'Community',
    description: 'Friendship, family, belonging',
    defaultMode: 'nourishment',
  },
  {
    id: 'reflection',
    name: 'Reflection',
    description: 'Journaling, self-awareness, inner life',
    defaultMode: 'nourishment',
  },
  {
    id: 'purpose',
    name: 'Purpose',
    description: 'Meaning, contribution, creative output',
    defaultMode: 'nourishment',
  },
  {
    id: 'nutrition',
    name: 'Nutrition',
    description: 'Food, hydration, relationship with eating',
    defaultMode: 'nourishment',
  },
  {
    id: 'rest',
    name: 'Rest',
    description: 'Sleep, stillness, nervous system recovery',
    defaultMode: 'nourishment',
  },
  {
    id: 'beauty',
    name: 'Beauty',
    description: 'Art, music, nature, aesthetic experience',
    defaultMode: 'nourishment',
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Financial stability, safety, structure',
    defaultMode: 'nourishment',
  },
  {
    id: 'dwelling',
    name: 'Dwelling',
    description: 'Home, environment, cleanliness',
    defaultMode: 'nourishment',
  },
  {
    id: 'intimacy',
    name: 'Intimacy',
    description: 'Romance, deep partnership, vulnerability',
    defaultMode: 'nourishment',
  },
]

// ─── Canvas layout ────────────────────────────────────────────────
// Three columns — needs assigned to each
export const CANVAS_COLUMNS = [
  ['movement', 'reflection', 'security'],
  ['community', 'purpose', 'rest', 'dwelling'],
  ['nutrition', 'beauty', 'intimacy'],
]

// Fixed pixel heights per layer
export const LAYER_HEIGHTS = {
  survival: 52,
  nourishment: 160,
  appreciation: 240,
  play: 320,
}

export const GAP = 6

// Baseline canvas height — all needs at nourishment
export function baselineColumnHeight(colIds) {
  return colIds.length * LAYER_HEIGHTS.nourishment + (colIds.length - 1) * GAP
}

// Progress: 100% = all nourishment
export function computeProgress(canvas) {
  const ids = Object.keys(canvas)
  const total = ids.reduce((s, id) => {
    const h = LAYER_HEIGHTS[canvas[id]] || LAYER_HEIGHTS.nourishment
    const base = LAYER_HEIGHTS.nourishment
    return s + Math.min(h / base, 1)
  }, 0)
  return Math.round((total / ids.length) * 100)
}

// Default canvas state
export function defaultCanvas() {
  return Object.fromEntries(NEEDS.map(n => [n.id, n.defaultMode]))
}
