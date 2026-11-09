import { describe, it, expect } from 'vitest'
import { dayNumber } from '../../src/lib/dayNumber'

describe('dayNumber', () => {
  it('is 001 all through the first local day', () => {
    expect(dayNumber('2026-11-09', new Date(2026, 10, 9, 0, 5))).toBe('001')
    expect(dayNumber('2026-11-09', new Date(2026, 10, 9, 23, 55))).toBe('001')
  })

  it('changes at local midnight, not after 24 hours', () => {
    expect(dayNumber('2026-11-09', new Date(2026, 10, 10, 0, 1))).toBe('002')
  })

  it('counts calendar days across a daylight-saving change', () => {
    // US clocks go back Nov 1 2026 and forward Mar 14 2027
    expect(dayNumber('2026-10-31', new Date(2026, 10, 2, 0, 30))).toBe('003')
    expect(dayNumber('2027-03-13', new Date(2027, 2, 15, 23, 30))).toBe('003')
  })

  it('is null without a usable onboarding date', () => {
    expect(dayNumber(null)).toBeNull()
    expect(dayNumber(undefined)).toBeNull()
    expect(dayNumber('')).toBeNull()
    expect(dayNumber('not a date')).toBeNull()
  })

  it('never goes below 001 if the device clock is behind', () => {
    expect(dayNumber('2026-11-09', new Date(2026, 10, 7, 12))).toBe('001')
  })
})
