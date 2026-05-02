import { useState, useEffect } from 'react'
import { defaultCanvas } from './constants'

const STORAGE_KEY = 'maslow_state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export function initialState() {
  const saved = loadState()
  if (saved) return saved
  return {
    onboarded: false,
    canvas: defaultCanvas(),
    intentions: {}, // weekKey -> { needId -> { action, freq } }
    checkins: {}, // dateKey -> [needId]
    feelings: [], // [{ ts, energy, ease, trigger }]
    weeklyNotes: {}, // weekKey -> string
    profile: {
      name: '',
      lifeStage: '',
      intentions: '',
    },
  }
}

export function useAppState() {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    saveState(state)
  }, [state])

  function update(partial) {
    setState(prev => ({ ...prev, ...partial }))
  }

  function updateCanvas(needId, mode) {
    setState(prev => ({
      ...prev,
      canvas: { ...prev.canvas, [needId]: mode },
    }))
  }

  function checkIn(needId, date = todayKey()) {
    setState(prev => {
      const existing = prev.checkins[date] || []
      const updated = existing.includes(needId)
        ? existing.filter(id => id !== needId)
        : [...existing, needId]
      return {
        ...prev,
        checkins: { ...prev.checkins, [date]: updated },
      }
    })
  }

  function logFeeling(energy, ease, trigger) {
    setState(prev => ({
      ...prev,
      feelings: [
        ...prev.feelings,
        { ts: Date.now(), energy, ease, trigger },
      ],
    }))
  }

  function setIntention(weekKey, needId, action, freq) {
    setState(prev => {
      const week = prev.intentions[weekKey] || {}
      return {
        ...prev,
        intentions: {
          ...prev.intentions,
          [weekKey]: { ...week, [needId]: { action, freq } },
        },
      }
    })
  }

  function completeOnboarding(canvas, profile) {
    setState(prev => ({
      ...prev,
      onboarded: true,
      canvas,
      profile,
    }))
  }

  return {
    state,
    update,
    updateCanvas,
    checkIn,
    logFeeling,
    setIntention,
    completeOnboarding,
  }
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function weekKey(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // Sunday
  return d.toISOString().slice(0, 10)
}
