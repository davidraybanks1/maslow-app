// Practice types: the six shapes a practice can take, and the pure helpers
// the builder sheet and Today rows share.
//
// Every type resolves to the same thing underneath: a check-in row for the
// day (checkins.count stays 1..2, so bubbles, streaks and the almanac keep
// working). What a type adds is an optional per-day `detail` object on that
// row, and a per-practice `config` object on the practice.
//
//   kind       config                                 checkins.detail
//   check      { target }                             { tally } (target > 1)
//   timed      { minutes, timer: 'on'|'off' }         { minutes }
//   checklist  { items[], need, reset }               { ticks[], items?[], manual? }
//   ritual     { anchor, steps[], setting, closing }  -
//   stretch    { small, cadence }                     { level: 0..10 }
//   boundary   { window: { from, until } }            { kept: true }

export const KINDS = ['check', 'timed', 'checklist', 'ritual', 'stretch', 'boundary']

export const MAX_ITEMS = 10
export const MAX_STEPS = 7
export const MAX_TALLY = 8
export const MAX_MINUTES = 240

export function fmtTime(t) {
  const h = Number(String(t).slice(0, 2))
  const m = String(t).slice(3, 5)
  return `${((h + 11) % 12) + 1}${m === '00' ? '' : ':' + m}${h < 12 ? 'am' : 'pm'}`
}

export function toMinutes(t) {
  return Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5))
}

export const STRETCH_WORDS = [
  'barely at all', 'a little', 'a little', 'some', 'some',
  'quite a bit', 'quite a bit', 'a lot', 'a lot',
  'as far as I could go', 'as far as I could go',
]

export const TYPES = [
  {
    id: 'check', label: 'check', noun: 'check', blurb: 'something that just needs doing.',
    fields: [
      { k: 'target', kind: 'stepper', label: 'times a day', min: 1, max: MAX_TALLY, def: 1,
        hint: '1 is a plain check. more makes it a tally, like water.' },
    ],
  },
  {
    id: 'timed', label: 'timed', noun: 'timed practice', blurb: 'do it for a set length of time.',
    fields: [
      { k: 'minutes', kind: 'choice', label: 'how long', opts: [5, 10, 20, 30], unit: ' min', custom: true, def: 10 },
      { k: 'timer', kind: 'choice', label: 'a timer',
        opts: [{ v: 'on', t: 'time it for me' }, { v: 'off', t: 'i’ll watch the clock' }], def: 'on' },
    ],
  },
  {
    id: 'checklist', label: 'checklist', noun: 'checklist', blurb: 'a few things that count as one.',
    fields: [
      { k: 'items', kind: 'steps', label: 'the items', ordered: false, min: 2, max: MAX_ITEMS, ph: 'an item',
        sugg: ['take vitamins', 'drink water', 'stretch', 'sunlight'] },
      { k: 'need', kind: 'choice', label: 'it counts when i do',
        opts: [{ v: 'all', t: 'all of them' }, { v: '1', t: 'any one' }, { v: '2', t: 'any two' }], def: 'all',
        hint: '“any one” turns it into a menu: pick what suits the day.' },
      { k: 'reset', kind: 'choice', label: 'the items',
        opts: [{ v: 'same', t: 'stay the same' }, { v: 'daily', t: 'change each day' }], def: 'same' },
    ],
  },
  {
    id: 'ritual', label: 'ritual', noun: 'ritual', blurb: 'steps, a setting, and a clear start and finish.',
    fields: [
      { k: 'anchor', kind: 'text', label: 'it begins', ph: 'after… or when…',
        hint: 'pin it to something you already do.',
        sugg: ['after I brush my teeth', 'when I close my laptop', 'after dinner', 'when I wake up'] },
      { k: 'steps', kind: 'steps', label: 'the steps, in order', ordered: true, min: 1, max: MAX_STEPS, ph: 'the first thing',
        sugg: ['dim the lights', 'phone across the room', 'make tea', 'stretch for two minutes', 'three slow breaths'] },
      { k: 'setting', kind: 'text', label: 'the setting', ph: 'where, and what’s around you',
        hint: 'place, light, sound, phone.',
        sugg: ['lamp only', 'phone in another room', 'tea in hand', 'same chair'] },
      { k: 'closing', kind: 'text', label: 'it ends with', ph: 'a small, clear finish',
        hint: 'so your body knows it’s over.',
        sugg: ['turn off the lamp', 'three slow breaths', 'close the notebook'] },
    ],
  },
  {
    id: 'stretch', label: 'stretch', noun: 'stretch', blurb: 'a small step outside your comfort zone.',
    fields: [
      { k: 'small', kind: 'text', label: 'the smallest version', ph: 'what would make it easier to start?',
        hint: 'small enough to do on a hard day.',
        sugg: ['say hi to someone new', 'order in person', 'ask one question'] },
      { k: 'cadence', kind: 'choice', label: 'how often',
        opts: [{ v: 'once a week', t: 'once a week' }, { v: 'twice a month', t: 'twice a month' }, { v: 'when ready', t: 'when i’m ready' }],
        def: 'once a week' },
    ],
  },
  {
    id: 'boundary', label: 'boundary', noun: 'boundary', blurb: 'something you choose not to do.',
    fields: [
      { k: 'window', kind: 'window', label: 'the window', def: { from: '21:00', until: '07:00' },
        hint: 'you check it off at the end of the window if you kept it.' },
    ],
  },
]

export function typeOf(kind) {
  return TYPES.find(t => t.id === kind) || TYPES[0]
}

export function defaultValue(field) {
  if (field.kind === 'steps') return ['']
  if (field.kind === 'text') return ''
  if (field.def === undefined) return ''
  return typeof field.def === 'object' ? JSON.parse(JSON.stringify(field.def)) : field.def
}

export function defaultConfig(kind) {
  const cfg = {}
  for (const f of typeOf(kind).fields) cfg[f.k] = defaultValue(f)
  return cfg
}

const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/

// Clean a config before it is saved or trusted: right shape for the kind,
// trimmed strings, clamped numbers, no unknown keys. Anything unusable falls
// back to the type's default, so a malformed row can never break a screen.
export function sanitizeConfig(kind, raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const def = defaultConfig(kind)
  const str = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const list = (v, max, len) => (Array.isArray(v) ? v.map(s => str(s, len)).filter(Boolean).slice(0, max) : [])
  switch (kind) {
    case 'timed': {
      const m = Math.round(Number(src.minutes))
      return {
        minutes: m > 0 ? Math.min(m, MAX_MINUTES) : def.minutes,
        timer: src.timer === 'off' ? 'off' : 'on',
      }
    }
    case 'checklist': {
      const items = list(src.items, MAX_ITEMS, 60)
      return {
        items,
        need: src.need === '1' || src.need === '2' ? src.need : 'all',
        reset: src.reset === 'daily' ? 'daily' : 'same',
      }
    }
    case 'ritual':
      return {
        anchor: str(src.anchor),
        steps: list(src.steps, MAX_STEPS, 60),
        setting: str(src.setting),
        closing: str(src.closing),
      }
    case 'stretch':
      return {
        small: str(src.small),
        cadence: ['once a week', 'twice a month', 'when ready'].includes(src.cadence) ? src.cadence : def.cadence,
      }
    case 'boundary': {
      const w = src.window && typeof src.window === 'object' ? src.window : {}
      return {
        window: {
          from: TIME_OK.test(w.from) ? w.from : def.window.from,
          until: TIME_OK.test(w.until) ? w.until : def.window.until,
        },
      }
    }
    default: {
      const t = Math.round(Number(src.target))
      return { target: t > 1 ? Math.min(t, MAX_TALLY) : 1 }
    }
  }
}

export function configOf(practice) {
  return sanitizeConfig(practice?.kind || 'check', practice?.config)
}

// A name plus a config is saveable when every list field has its minimum.
export function isConfigComplete(kind, cfg) {
  const clean = sanitizeConfig(kind, cfg)
  for (const f of typeOf(kind).fields) {
    if (f.kind === 'steps' && clean[f.k].length < f.min) return false
  }
  if (kind === 'boundary' && clean.window.from === clean.window.until) return false
  return true
}

// ── Kind-specific reading of a practice ───────────────────────────────────

export function isTally(practice) {
  return (practice?.kind || 'check') === 'check' && configOf(practice).target > 1
}

// check and ritual keep the original tap cycle (0 → 1 → ×2 → cleared);
// a tally counts up to its target instead.
export function usesCounts(practice) {
  const k = practice?.kind || 'check'
  return k === 'check' || k === 'ritual'
}

// Does tapping the row's leading tile mean "this opens something" (as opposed
// to the whole row being the tap target)? Mirrors the prototype's split rows.
export function isSplit(practice) {
  const k = practice?.kind || 'check'
  if (k === 'ritual' || k === 'checklist' || k === 'stretch' || k === 'boundary') return true
  return k === 'timed' && configOf(practice).timer === 'on'
}

export function checklistItems(practice, detail) {
  const cfg = configOf(practice)
  if (cfg.reset === 'daily' && Array.isArray(detail?.items) && detail.items.length) return detail.items
  return cfg.items
}

export function checklistRequired(practice, itemCount) {
  const cfg = configOf(practice)
  return cfg.need === 'all' ? itemCount : Math.min(Number(cfg.need), itemCount)
}

export function tickCount(ticks, itemCount) {
  let n = 0
  for (let i = 0; i < itemCount; i++) if (ticks && ticks[i]) n++
  return n
}

// 'before' | 'in' | 'ended'. A window that crosses midnight (21:00 → 07:00)
// is 'ended' for the whole day outside it: you answer "kept it?" the morning
// after, or any time before the next one begins.
export function boundaryPhase(cfg, nowMinutes) {
  const f = toMinutes(cfg.window.from)
  const u = toMinutes(cfg.window.until)
  const cross = f > u
  const inWindow = cross ? (nowMinutes >= f || nowMinutes < u) : (nowMinutes >= f && nowMinutes < u)
  if (inWindow) return 'in'
  return cross ? 'ended' : (nowMinutes < f ? 'before' : 'ended')
}

export function crossesMidnight(cfg) {
  return toMinutes(cfg.window.from) > toMinutes(cfg.window.until)
}

export function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes()
}

// The quiet second line under a practice's name.
export function subLabel(practice, { done = false, phase = null, items = null } = {}) {
  const kind = practice?.kind || 'check'
  const c = configOf(practice)
  switch (kind) {
    case 'timed':
      return `${c.minutes} min${c.timer === 'on' ? ' · timer' : ''}`
    case 'checklist': {
      const n = (items || c.items).length
      return `${n} items · ${c.need === 'all' ? 'all' : `any ${c.need}`}${c.reset === 'daily' ? ' · fresh daily' : ''}`
    }
    case 'ritual':
      return `${c.steps.length} ${c.steps.length === 1 ? 'step' : 'steps'}`
    case 'stretch':
      return c.cadence
    case 'boundary': {
      const win = `${fmtTime(c.window.from)} – ${fmtTime(c.window.until)}`
      if (done) return crossesMidnight(c) ? 'last night' : win
      if (phase === 'before') return `begins ${fmtTime(c.window.from)}`
      if (phase === 'in') return `holding until ${fmtTime(c.window.until)}`
      if (phase === 'ended') return crossesMidnight(c) ? 'last night · kept it?' : `ended ${fmtTime(c.window.until)} · kept it?`
      return `not ${win}`
    }
    default:
      return c.target > 1 ? `a tally of ${c.target}` : ''
  }
}

// What the practices list shows beside a practice when it isn't "last done".
export function poolTag(practice) {
  const kind = practice?.kind || 'check'
  const c = configOf(practice)
  switch (kind) {
    case 'timed': return `${c.minutes} min`
    case 'checklist': return `${c.items.length} items`
    case 'ritual': return `${c.steps.length} ${c.steps.length === 1 ? 'step' : 'steps'}`
    case 'stretch': return c.cadence
    case 'boundary': return `not ${fmtTime(c.window.from)} – ${fmtTime(c.window.until)}`
    default: return c.target > 1 ? `×${c.target} a day` : ''
  }
}

// Starter practices that arrive pre-shaped. Plain strings stay plain checks.
export const TYPED_STARTERS = {
  rest: [
    {
      label: 'evening wind-down', kind: 'ritual',
      config: {
        anchor: 'after dinner, dishes done',
        steps: ['dim the lights', 'phone on the charger, across the room', 'make tea', 'three slow pages of something calm'],
        setting: 'lamp only, same chair',
        closing: 'turn off the lamp',
      },
    },
  ],
}
