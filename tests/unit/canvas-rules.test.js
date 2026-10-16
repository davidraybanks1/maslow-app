import { describe, it, expect } from 'vitest'
import { canPlace, countIn } from '../../src/lib/canvasRules'

const canvas = {
  movement: 'nourishment', nutrition: 'nourishment', rest: 'survival',
  reflection: 'appreciation', community: 'appreciation',
}

describe('canPlace', () => {
  it('allows a free slot', () => {
    expect(canPlace('play', 'survival', canvas)).toEqual({ ok: true })
  })
  it('treats the current mode as a no-op', () => {
    expect(canPlace('reflection', 'appreciation', canvas)).toEqual({ ok: true, noop: true })
    expect(canPlace('play', null, canvas)).toEqual({ ok: true, noop: true })
  })
  it('bounces a drop on a full mode with a reason', () => {
    const r = canPlace('play', 'appreciation', canvas)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/appreciation is full/)
  })
  it('lets a need swap within a mode that only looks full because of itself', () => {
    expect(canPlace('reflection', 'appreciation', canvas).ok).toBe(true)
    expect(countIn(canvas, 'appreciation', 'reflection')).toBe(1)
  })
  it('does not let a need into a full exploration slot', () => {
    expect(canPlace('play', 'exploration', { ...canvas, beauty: 'exploration' }).ok).toBe(false)
  })
  it('keeps movement, nutrition and rest on the canvas', () => {
    for (const id of ['movement', 'nutrition', 'rest']) {
      const r = canPlace(id, null, canvas)
      expect(r.ok).toBe(false)
      expect(r.reason).toMatch(/stays in a mode/)
    }
  })
  it('keeps rest at nourishment or below', () => {
    expect(canPlace('rest', 'exploration', canvas).ok).toBe(false)
    expect(canPlace('rest', 'appreciation', { ...canvas, community: undefined }).ok).toBe(false)
    expect(canPlace('rest', 'nourishment', { ...canvas, nutrition: undefined }).ok).toBe(true)
  })
  it('lets a personal need leave the canvas', () => {
    expect(canPlace('reflection', null, canvas)).toEqual({ ok: true })
  })
})
