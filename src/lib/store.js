import { useState, useEffect } from 'react'
import { defaultCanvas } from './constants'
import { supabase } from './supabase'

const STORAGE_KEY = 'maslow_state'
const STATE_VERSION = 2

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

function migrateState(saved) {
  try {
    const version = saved._version || 1

    if (version < 2) {
      // v1 → v2: replace intentions/feelings/weeklyNotes with practices
      // Reset checkins — old format used needId, new uses needId_index
      saved.practices = {}
      saved.checkins = {}
      delete saved.intentions
      delete saved.feelings
      delete saved.weeklyNotes
      delete saved.streak
      saved._version = 2
    }

    if (!saved.moods) saved.moods = []

    return saved
  } catch (e) {
    console.error('migrateState error', e)
    // If migration fails return a fresh state but keep onboarded/canvas/profile
    return {
      _version: STATE_VERSION,
      onboarded: saved.onboarded || false,
      userId: saved.userId || null,
      canvas: saved.canvas || defaultCanvas(),
      practices: {},
      checkins: {},
      moods: [],
      profile: saved.profile || { name: '' },
    }
  }
}

export function initialState() {
  const saved = loadState()
  if (saved) return migrateState(saved)
  return {
    _version: STATE_VERSION,
    onboarded: false,
    userId: null,
    canvas: defaultCanvas(),
    practices: {},
    checkins: {},
    moods: [],
    profile: { name: '' },
  }
}

async function fetchMoods(userId) {
  const { data } = await supabase
    .from('moods')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

async function restoreFromSupabase(userId, email) {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single()
    if (!user) return null

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)

    const [{ data: checkins }, moods] = await Promise.all([
      supabase.from('checkins').select('*').eq('user_id', user.id).gte('date_key', cutoff),
      fetchMoods(user.id),
    ])
    const checkinsMap = {}
    for (const row of (checkins || [])) {
      if (!checkinsMap[row.date_key]) checkinsMap[row.date_key] = []
      checkinsMap[row.date_key].push(row.need_id)
    }
    return {
      _version: STATE_VERSION,
      onboarded: user.onboarded,
      userId: user.id,
      canvas: user.canvas || defaultCanvas(),
      practices: user.practices || {},
      checkins: checkinsMap,
      moods,
      profile: { name: user.name || '' },
    }
  } catch (e) {
    console.error('restoreFromSupabase error', e)
    return null
  }
}

export function useAppState(onSignIn) {
  const [state, setState] = useState(initialState)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setAuthLoading(false)
        if (session?.user) {
          const restored = await restoreFromSupabase(session.user.id, session.user.email)
          if (restored) { setState(restored); saveState(restored) }
        }
      } catch (e) {
        console.error('checkSession error', e)
        setAuthLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const restored = await restoreFromSupabase(session.user.id, session.user.email)
        if (restored) { setState(restored); saveState(restored); onSignIn?.() }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { saveState(state) }, [state])

  function updateCanvas(needId, mode) {
    setState(prev => {
      const newCanvas = { ...prev.canvas }
      if (mode == null) {
        delete newCanvas[needId]
      } else {
        newCanvas[needId] = mode
      }
      if (prev.userId) {
        supabase.from('users').update({ canvas: newCanvas }).eq('id', prev.userId).then()
      }
      return { ...prev, canvas: newCanvas }
    })
  }

  function addPractice(needId, text) {
    if (!text.trim()) return
    setState(prev => {
      const current = prev.practices[needId] || []
      if (current.length >= 10) return prev
      const newPractices = { ...prev.practices, [needId]: [...current, text.trim()] }
      if (prev.userId) {
        supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId).then()
      }
      return { ...prev, practices: newPractices }
    })
  }

  function removePractice(needId, index) {
    setState(prev => {
      const current = [...(prev.practices[needId] || [])]
      current.splice(index, 1)
      const newPractices = { ...prev.practices, [needId]: current }
      if (prev.userId) {
        supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId).then()
      }
      return { ...prev, practices: newPractices }
    })
  }

  function checkIn(needId, practiceText, date = todayKey()) {
    const key = `${needId}_${practiceText}`
    const existing = state.checkins[date] || []
    const isRemoving = existing.includes(key)

    setState(prev => {
      const prevExisting = prev.checkins[date] || []
      const updated = prevExisting.includes(key)
        ? prevExisting.filter(k => k !== key)
        : [...prevExisting, key]
      return { ...prev, checkins: { ...prev.checkins, [date]: updated } }
    })

    if (state.userId) {
      if (!isRemoving) {
        supabase.from('checkins').insert({ user_id: state.userId, date_key: date, need_id: key }).then()
      } else {
        supabase.from('checkins').delete().eq('user_id', state.userId).eq('date_key', date).eq('need_id', key).then()
      }
    }
  }

  async function loadMoods() {
    if (!state.userId) return
    const moods = await fetchMoods(state.userId)
    setState(prev => ({ ...prev, moods }))
  }

  function completeOnboarding(canvas, practices, profile) {
    const { userId, ...profileData } = profile
    setState(prev => ({
      ...prev,
      onboarded: true,
      canvas,
      practices,
      profile: profileData,
      userId: userId || prev.userId,
    }))
  }

  return { state, authLoading, updateCanvas, addPractice, removePractice, checkIn, completeOnboarding, loadMoods }
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
    options: { emailRedirectTo: 'https://app.mymaslow.com' },
  })
  return { error }
}

export async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}
