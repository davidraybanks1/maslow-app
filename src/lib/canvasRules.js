import { allNeeds, needName, MODE_NEED_CAP, UNIVERSAL_NEEDS } from './constants'

// What the needs page lets a need do. The store enforces the same two limits
// (movement, nutrition and rest can't leave the canvas; rest can't sit above
// nourishment), but the page checks first so a drop can bounce back with a
// reason instead of quietly doing something different.
const ABOVE_NOURISHMENT = ['exploration', 'appreciation']


export function countIn(canvas, mode, exceptId = null) {
  return allNeeds().filter(n => canvas[n.id] === mode && n.id !== exceptId).length
}

// target: a mode key, or null to take the need off the canvas (the library).
// → { ok: true, noop?: true } | { ok: false, reason }
export function canPlace(needId, target, canvas) {
  const current = canvas[needId] || null
  if (target === current) return { ok: true, noop: true }

  if (target == null) {
    if (UNIVERSAL_NEEDS.includes(needId)) {
      return { ok: false, reason: `${needName(needId)} stays in a mode. you can move it.` }
    }
    return { ok: true }
  }

  if (needId === 'rest' && ABOVE_NOURISHMENT.includes(target)) {
    return { ok: false, reason: 'rest stays in nourishment or survival.' }
  }

  const cap = MODE_NEED_CAP[target]
  if (countIn(canvas, target, needId) >= cap) {
    return { ok: false, reason: `${target} is full. move one out first.` }
  }
  return { ok: true }
}
