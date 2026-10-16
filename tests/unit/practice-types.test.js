import { describe, it, expect } from 'vitest'
import {
  sanitizeConfig, defaultConfig, isConfigComplete, boundaryPhase, checklistRequired,
  tickCount, isTally, isSplit, subLabel, poolTag, fmtTime, configOf,
} from '../../src/lib/practiceTypes'

describe('sanitizeConfig', () => {
  it('turns a missing or malformed config into the type default', () => {
    expect(sanitizeConfig('check', null)).toEqual({ target: 1 })
    expect(sanitizeConfig('check', 'nope')).toEqual({ target: 1 })
    expect(sanitizeConfig('timed', {})).toEqual({ minutes: 10, timer: 'on' })
  })
  it('clamps numbers and drops unknown keys', () => {
    expect(sanitizeConfig('check', { target: 99, junk: 1 })).toEqual({ target: 8 })
    expect(sanitizeConfig('timed', { minutes: 9999, timer: 'off', x: 1 })).toEqual({ minutes: 240, timer: 'off' })
    expect(sanitizeConfig('timed', { minutes: -5 }).minutes).toBe(10)
  })
  it('trims strings and removes blank list entries', () => {
    const c = sanitizeConfig('ritual', { anchor: '  after dinner ', steps: [' a ', '', '  ', 'b'], setting: 5, closing: 'x' })
    expect(c).toEqual({ anchor: 'after dinner', steps: ['a', 'b'], setting: '', closing: 'x' })
  })
  it('caps list lengths', () => {
    expect(sanitizeConfig('ritual', { steps: Array(20).fill('s') }).steps).toHaveLength(7)
    expect(sanitizeConfig('checklist', { items: Array(20).fill('i') }).items).toHaveLength(10)
  })
  it('rejects bad enums and times', () => {
    expect(sanitizeConfig('checklist', { items: ['a', 'b'], need: '9', reset: 'weekly' })).toMatchObject({ need: 'all', reset: 'same' })
    expect(sanitizeConfig('stretch', { cadence: 'hourly' }).cadence).toBe('once a week')
    expect(sanitizeConfig('boundary', { window: { from: '25:00', until: '07:00' } }).window).toEqual({ from: '21:00', until: '07:00' })
  })
  it('output always fits the database size limit', () => {
    const big = sanitizeConfig('ritual', { anchor: 'a'.repeat(500), steps: Array(7).fill('s'.repeat(500)), setting: 'x'.repeat(500), closing: 'y'.repeat(500) })
    expect(JSON.stringify(big).length).toBeLessThan(8000)
  })
})

describe('completeness', () => {
  it('needs enough list entries', () => {
    expect(isConfigComplete('ritual', { steps: [] })).toBe(false)
    expect(isConfigComplete('ritual', { steps: ['one'] })).toBe(true)
    expect(isConfigComplete('checklist', { items: ['one'] })).toBe(false)
    expect(isConfigComplete('checklist', { items: ['one', 'two'] })).toBe(true)
  })
  it('a boundary window must have a length', () => {
    expect(isConfigComplete('boundary', { window: { from: '09:00', until: '09:00' } })).toBe(false)
    expect(isConfigComplete('boundary', defaultConfig('boundary'))).toBe(true)
  })
})

describe('boundaryPhase', () => {
  const same = { window: { from: '18:00', until: '20:00' } }
  const night = { window: { from: '21:00', until: '07:00' } }
  const m = (h, min = 0) => h * 60 + min
  it('same-day window', () => {
    expect(boundaryPhase(same, m(8))).toBe('before')
    expect(boundaryPhase(same, m(18))).toBe('in')
    expect(boundaryPhase(same, m(19, 59))).toBe('in')
    expect(boundaryPhase(same, m(20))).toBe('ended')
    expect(boundaryPhase(same, m(23))).toBe('ended')
  })
  it('window that crosses midnight', () => {
    expect(boundaryPhase(night, m(22))).toBe('in')
    expect(boundaryPhase(night, m(2))).toBe('in')
    expect(boundaryPhase(night, m(7))).toBe('ended')
    expect(boundaryPhase(night, m(15))).toBe('ended')
    expect(boundaryPhase(night, m(20, 59))).toBe('ended')
    expect(boundaryPhase(night, m(21))).toBe('in')
  })
})

describe('kind helpers', () => {
  it('reads practices with no kind as plain checks', () => {
    expect(configOf({ label: 'x' })).toEqual({ target: 1 })
    expect(isTally({ label: 'x' })).toBe(false)
    expect(isSplit({ label: 'x' })).toBe(false)
  })
  it('knows tallies and split rows', () => {
    expect(isTally({ kind: 'check', config: { target: 8 } })).toBe(true)
    expect(isSplit({ kind: 'timed', config: { timer: 'on' } })).toBe(true)
    expect(isSplit({ kind: 'timed', config: { timer: 'off' } })).toBe(false)
    expect(isSplit({ kind: 'ritual', config: {} })).toBe(true)
  })
  it('checklist requirement', () => {
    expect(checklistRequired({ kind: 'checklist', config: { need: 'all' } }, 4)).toBe(4)
    expect(checklistRequired({ kind: 'checklist', config: { need: '2' } }, 4)).toBe(2)
    expect(checklistRequired({ kind: 'checklist', config: { need: '2' } }, 1)).toBe(1)
    expect(tickCount([true, false, true], 3)).toBe(2)
    expect(tickCount([true, true, true], 2)).toBe(2)
  })
  it('formats times and labels', () => {
    expect(fmtTime('00:00')).toBe('12am')
    expect(fmtTime('12:30')).toBe('12:30pm')
    expect(fmtTime('21:00')).toBe('9pm')
    expect(poolTag({ kind: 'timed', config: { minutes: 20 } })).toBe('20 min')
    expect(poolTag({ kind: 'check', config: { target: 1 } })).toBe('')
    expect(subLabel({ kind: 'ritual', config: { steps: ['a'] } })).toBe('1 step')
  })
})
