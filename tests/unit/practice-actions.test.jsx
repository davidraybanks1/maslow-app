import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

vi.mock('../../src/lib/native', () => ({ hapticTick: () => {} }))

import { usePracticeActions } from '../../src/lib/usePracticeActions'

const TODAY = '2026-10-16'
const need = { id: 'rest', name: 'rest' }
const mode = 'nourishment'

// A tiny in-memory stand-in for the store: check-ins for today, plus the
// five functions the hook calls. checkIn/clear/etc. mutate it so the hook
// sees the same state the real store would hand back after a render.
function setup(practice) {
  const calls = { checkIn: [], clear: [], inc: [], detail: [] }
  const hook = renderHook(() => {
    const [checked, setChecked] = useState([])
    let n = 0
    const api = usePracticeActions({
      today: TODAY,
      checked,
      checkIn: (needId, text, m, date, practiceId, detail) => {
        calls.checkIn.push({ needId, text, practiceId, detail })
        setChecked(c => [...c, { id: `e${c.length + 1}`, need_id: needId, practice_text: text, practice_id: practiceId, count: 1, detail: detail || null }])
      },
      clearPracticeCheckins: (needId, text) => {
        calls.clear.push(text)
        setChecked(c => c.filter(e => !(e.need_id === needId && e.practice_text === text)))
      },
      incrementCheckinCount: id => {
        calls.inc.push(id)
        setChecked(c => c.map(e => (e.id === id ? { ...e, count: 2 } : e)))
      },
      setCheckinDetail: (id, detail) => {
        calls.detail.push({ id, detail })
        setChecked(c => c.map(e => (e.id === id ? { ...e, detail } : e)))
      },
    })
    n += 1
    return { api, checked, n }
  })
  const st = () => hook.result.current.api.statusOf(need, practice)
  const act_ = fn => act(() => { fn(hook.result.current.api) })
  return { hook, calls, st, act_ }
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] }); vi.setSystemTime(new Date('2026-10-16T15:00:00')) })
afterEach(() => { vi.useRealTimers() })

describe('plain check', () => {
  const p = { id: 'p1', label: 'journal', kind: 'check', config: { target: 1 } }
  it('cycles one tap → ×2 → cleared, exactly as before', () => {
    const { st, act_, calls } = setup(p)
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn).toHaveLength(1)
    expect(calls.checkIn[0].detail).toBeUndefined()
    expect(st().done).toBe(true)
    act_(a => a.tap(need, mode, p))
    expect(calls.inc).toEqual(['e1'])
    expect(st().count).toBe(2)
    act_(a => a.tap(need, mode, p))
    expect(calls.clear).toEqual(['journal'])
    expect(st().done).toBe(false)
  })
  it('treats a practice with no kind as a plain check', () => {
    const legacy = { id: null, label: 'old one' }
    const { st, act_, calls } = setup(legacy)
    act_(a => a.tap(need, mode, legacy))
    expect(calls.checkIn).toHaveLength(1)
    expect(st().done).toBe(true)
  })
})

describe('tally', () => {
  const p = { id: 'p2', label: 'water', kind: 'check', config: { target: 3 } }
  it('counts up on this device and only logs when the target is reached', () => {
    const { st, act_, calls } = setup(p)
    act_(a => a.tap(need, mode, p))
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn).toHaveLength(0)
    expect(st().tally).toBe(2)
    expect(JSON.parse(localStorage.getItem('loam.practiceProgress.v1'))[TODAY].p2).toEqual({ tally: 2 })
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn).toHaveLength(1)
    expect(calls.checkIn[0].detail).toEqual({ tally: 3 })
    expect(st().done).toBe(true)
    expect(localStorage.getItem('loam.practiceProgress.v1')).toBeNull()
  })
  it('tapping a finished tally clears it', () => {
    const { st, act_, calls } = setup(p)
    for (let i = 0; i < 3; i++) act_(a => a.tap(need, mode, p))
    act_(a => a.tap(need, mode, p))
    expect(calls.clear).toEqual(['water'])
    expect(st().tally).toBe(0)
  })
  it('restores partial progress after a reload, same day', () => {
    localStorage.setItem('loam.practiceProgress.v1', JSON.stringify({ [TODAY]: { p2: { tally: 2 } } }))
    const { st } = setup(p)
    expect(st().tally).toBe(2)
  })
  it('drops progress from another day', () => {
    localStorage.setItem('loam.practiceProgress.v1', JSON.stringify({ '2026-10-15': { p2: { tally: 2 } } }))
    const { st } = setup(p)
    expect(st().tally).toBe(0)
  })
})

describe('timed', () => {
  const p = { id: 'p3', label: 'walk', kind: 'timed', config: { minutes: 30, timer: 'off' } }
  it('logs the full length with the circle', () => {
    const { st, act_, calls } = setup(p)
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn[0].detail).toEqual({ minutes: 30 })
    expect(st().done).toBe(true)
    act_(a => a.tap(need, mode, p))
    expect(st().done).toBe(false)
  })
  it('finishing the timer logs once; ending early logs nothing', () => {
    const t = { ...p, config: { minutes: 10, timer: 'on' } }
    const { act_, calls, hook } = setup(t)
    act_(a => a.beginTimer(need, mode, t))
    act_(a => a.endTimer())
    expect(calls.checkIn).toHaveLength(0)
    act_(a => a.beginTimer(need, mode, t))
    act_(a => a.finishTimer())
    expect(calls.checkIn).toHaveLength(1)
    expect(calls.checkIn[0].detail).toEqual({ minutes: 10 })
    expect(hook.result.current.api.timerFor).toBeNull()
  })
})

describe('checklist', () => {
  const p = { id: 'p4', label: 'basics', kind: 'checklist', config: { items: ['a', 'b', 'c'], need: '2', reset: 'same' } }
  it('completes once enough items are ticked and un-completes when one is removed', () => {
    const { st, act_, calls } = setup(p)
    act_(a => a.toggleItem(need, mode, p, 0))
    expect(calls.checkIn).toHaveLength(0)
    expect(st().ticked).toBe(1)
    act_(a => a.toggleItem(need, mode, p, 2))
    expect(calls.checkIn).toHaveLength(1)
    expect(calls.checkIn[0].detail).toEqual({ ticks: [true, false, true] })
    expect(st().done).toBe(true)
    act_(a => a.toggleItem(need, mode, p, 1))
    expect(calls.detail).toHaveLength(1)
    expect(st().ticked).toBe(3)
    act_(a => a.toggleItem(need, mode, p, 0))
    act_(a => a.toggleItem(need, mode, p, 1))
    expect(calls.clear).toEqual(['basics'])
    expect(st().done).toBe(false)
    expect(st().ticked).toBe(1)
  })
  it('the circle marks it done by hand, and un-ticking drops that', () => {
    const { st, act_, calls } = setup(p)
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn[0].detail).toMatchObject({ manual: true })
    expect(st().done).toBe(true)
    act_(a => a.tap(need, mode, p))
    expect(st().done).toBe(false)
  })
  it('daily lists keep their own items', () => {
    const d = { id: 'p5', label: 'today', kind: 'checklist', config: { items: ['x'], need: 'all', reset: 'daily' } }
    const { st, act_, calls } = setup(d)
    act_(a => a.addItem(need, mode, d, 'email Priya'))
    expect(st().items).toEqual(['x', 'email Priya'])
    act_(a => a.toggleItem(need, mode, d, 0))
    act_(a => a.toggleItem(need, mode, d, 1))
    expect(calls.checkIn[0].detail).toEqual({ ticks: [true, true], items: ['x', 'email Priya'] })
  })
  it('does not accept items on a list that stays the same', () => {
    const { act_, st } = setup(p)
    act_(a => a.addItem(need, mode, p, 'nope'))
    expect(st().items).toEqual(['a', 'b', 'c'])
  })
})

describe('stretch', () => {
  const p = { id: 'p6', label: 'say hi', kind: 'stretch', config: { cadence: 'once a week', small: '' } }
  it('opens the slider, then logs the level; changing it updates the same row', () => {
    const { st, act_, calls, hook } = setup(p)
    act_(a => a.tap(need, mode, p))
    expect(hook.result.current.api.stretchFor).not.toBeNull()
    expect(calls.checkIn).toHaveLength(0)
    act_(a => a.saveStretch(7))
    expect(calls.checkIn[0].detail).toEqual({ level: 7 })
    expect(st().done).toBe(true)
    act_(a => a.openStretch(need, mode, p))
    act_(a => a.saveStretch(3))
    expect(calls.detail[0].detail).toEqual({ level: 3 })
    expect(calls.checkIn).toHaveLength(1)
  })
})

describe('boundary', () => {
  const p = { id: 'p7', label: 'screens off', kind: 'boundary', config: { window: { from: '21:00', until: '07:00' } } }
  it('cannot be checked off inside its window', () => {
    vi.setSystemTime(new Date('2026-10-16T22:30:00'))
    const { st, act_, calls, hook } = setup(p)
    expect(st().phase).toBe('in')
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn).toHaveLength(0)
    expect(hook.result.current.api.notice).toMatch(/7am/)
  })
  it('can once the window has ended', () => {
    const { st, act_, calls } = setup(p)
    expect(st().phase).toBe('ended')
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn[0].detail).toEqual({ kept: true })
    expect(st().done).toBe(true)
  })
})

describe('ritual', () => {
  const p = { id: 'p8', label: 'porch coffee', kind: 'ritual', config: { steps: ['a'] } }
  it('is one tap, same as a check', () => {
    const { st, act_, calls } = setup(p)
    act_(a => a.tap(need, mode, p))
    expect(calls.checkIn).toHaveLength(1)
    expect(st().done).toBe(true)
  })
})
