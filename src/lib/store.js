import { useState, useEffect } from 'react'
import { defaultCanvas } from './constants'
import { supabase } from './supabase'

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
    userId: null,
    canvas: defaultCanvas(),
    intentions: {},
    checkins: {},
    feelings: [],
    weeklyNotes: {},
    streak: 0,
    profile: { name: '', lifeStage: '', intentions: '' },
  }
}

// Pull user data from Supabase and merge into state
async function restoreFromSupabase(userId) {
  try {
    const [{ data: user }, { data: intentions }, { data: checkins }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('intentions').select('*').eq('user_id', userId),
      supabase.from('checkins').select('*').eq('user_id', userId),
    ])

    if (!user) return null

    // Rebuild intentions map: weekKey -> { needId -> { action, freq } }
    const intentionsMap = {}
    for (const row of (intentions || [])) {
      if (!intentionsMap[row.week_key]) intentionsMap[row.week_key] = {}
      intentionsMap[row.week_key][row.need_id] = { action: row.action, freq: row.freq }
    }

    // Rebuild checkins map: dateKey -> [needId]
    const checkinsMap = {}
    for (const row of (checkins || [])) {
      if (!checkinsMap[row.date_key]) checkinsMap[row.date_key] = []
      checkinsMap[row.date_key].push(row.need_id)
    }

    return {
      onboarded: user.onboarded,
      userId: user.id,
      canvas: user.canvas || defaultCanvas(),
      profile: user.profile || { name: user.name, lifeStage: '', intentions: '' },
      intentions: intentionsMap,
      checkins: checkinsMap,
      feelings: [],
      weeklyNotes: {},
      streak: 0,
    }
  } catch (e) {
    console.error('restoreFromSupabase error', e)
    return null
  }
}

export function useAppState() {
  const [state, setState] = useState(initialState)
  const [authLoading, setAuthLoading] = useState(true)

  // On mount — check for existing Supabase session (handles magic link callback too)
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const restored = await restoreFromSupabase(session.user.id)
        if (restored) {
          setState(restored)
          saveState(restored)
        }
      }
      setAuthLoading(false)
    }

    checkSession()

    // Listen for auth state changes (magic link sign-in fires here)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const restored = await restoreFromSupabase(session.user.id)
        if (restored) {
          setState(restored)
          saveState(restored)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
    // Sync to Supabase
    if (state.userId) {
      const newCanvas = { ...state.canvas, [needId]: mode }
      supabase.from('users').update({ canvas: newCanvas }).eq('id', state.userId).then()
    }
  }

  function checkIn(needId, date = todayKey()) {
    setState(prev => {
      const existing = prev.checkins[date] || []
      const updated = existing.includes(needId)
        ? existing.filter(id => id !== needId)
        : [...existing, needId]
      // Sync to Supabase
      if (prev.userId) {
        if (!existing.includes(needId)) {
          supabase.from('checkins').insert({ user_id: prev.userId, date_key: date, need_id: needId }).then()
        } else {
          supabase.from('checkins').delete().eq('user_id', prev.userId).eq('date_key', date).eq('need_id', needId).then()
        }
      }
      return {
        ...prev,
        checkins: { ...prev.checkins, [date]: updated },
      }
    })
  }

  function logFeeling(energy, ease, trigger) {
    setState(prev => ({
      ...prev,
      feelings: [...prev.feelings, { ts: Date.now(), energy, ease, trigger }],
    }))
  }

  function setIntention(weekKey, needId, action, freq) {
    setState(prev => {
      const week = prev.intentions[weekKey] || {}
      // Sync to Supabase
      if (prev.userId) {
        supabase.from('intentions').upsert({
          user_id: prev.userId,
          week_key: weekKey,
          need_id: needId,
          action,
          freq,
        }, { onConflict: 'user_id,week_key,need_id' }).then()
      }
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
    authLoading,
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
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'https://app.mymaslow.com',
    },
  })
  return { error }
}