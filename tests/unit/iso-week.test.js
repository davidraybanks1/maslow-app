import { describe, expect, it } from 'vitest'
import { isoWeek } from '../../src/lib/isoWeek'

describe('isoWeek', () => {
  it('numbers the week the design shows', () => expect(isoWeek('2026-10-12')).toBe(42))
  it('keeps a whole Monday-to-Sunday week together', () => {
    expect(isoWeek('2026-11-09')).toBe(46)
    expect(isoWeek('2026-11-15')).toBe(46)
    expect(isoWeek('2026-11-16')).toBe(47)
  })
  it('puts early January in the last week of the year before when Thursday falls there', () => {
    expect(isoWeek('2027-01-03')).toBe(53)
    expect(isoWeek('2027-01-04')).toBe(1)
  })
})
