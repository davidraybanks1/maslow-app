import { describe, expect, it } from 'vitest'
import { formatClock, formatTimeOfDay } from '../../src/lib/formatTime'

describe('one clock format', () => {
  it('writes timestamps in 12-hour time', () => {
    expect(formatClock(new Date(2026, 10, 9, 16, 13))).toBe('4:13PM')
    expect(formatClock(new Date(2026, 10, 9, 9, 5))).toBe('9:05AM')
  })
  it('handles noon and midnight', () => {
    expect(formatClock(new Date(2026, 10, 9, 12, 0))).toBe('12:00PM')
    expect(formatClock(new Date(2026, 10, 9, 0, 30))).toBe('12:30AM')
  })
  it('writes stored times of day the same way', () => {
    expect(formatTimeOfDay('21:00')).toBe('9:00PM')
    expect(formatTimeOfDay('07:30')).toBe('7:30AM')
  })
})
