import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setCustomNeeds, allNeeds, needName, NEEDS } from '../../src/lib/constants'
import { canPlace } from '../../src/lib/canvasRules'

describe('custom needs registry', () => {
  beforeEach(() => setCustomNeeds([{ id: 'c_abc12345', name: 'creativity' }]))
  afterEach(() => setCustomNeeds([]))

  it('appends custom needs after the built-ins', () => {
    const all = allNeeds()
    expect(all.length).toBe(NEEDS.length + 1)
    expect(all.at(-1)).toMatchObject({ id: 'c_abc12345', name: 'creativity', custom: true })
  })
  it('names built-in, custom and removed needs', () => {
    expect(needName('rest')).toBe(allNeeds().find(n => n.id === 'rest').name)
    expect(needName('c_abc12345')).toBe('creativity')
    expect(needName('c_gone0000')).toBe('removed need')
  })
  it('drops back to the built-ins when cleared', () => {
    setCustomNeeds([])
    expect(allNeeds().length).toBe(NEEDS.length)
  })
  it('places a custom need under the same mode caps', () => {
    expect(canPlace('c_abc12345', 'exploration', {})).toEqual({ ok: true })
    const full = canPlace('c_abc12345', 'exploration', { play: 'exploration' })
    expect(full.ok).toBe(false)
    expect(full.reason).toMatch(/exploration is full/)
  })
  it('lets a custom need leave its mode (it is not universal)', () => {
    expect(canPlace('c_abc12345', null, { c_abc12345: 'survival' })).toEqual({ ok: true })
  })
})
