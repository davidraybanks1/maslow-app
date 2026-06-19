import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const STORAGE_KEY = 'maslow_state'
const STATE_VERSION = 2

const UNIVERSAL_NEEDS = ['movement', 'nutrition', 'rest']
const ABOVE_NOURISHMENT_MODES = ['exploration', 'appreciation']

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

function logSupabaseError(fn, error) {
  console.error(`[${fn}] supabase error`, error)
}

// Set skip=true before supabase.auth.signUp() during onboarding to prevent
// the SIGNED_IN handler from navigating away from the post-signup destination.
export const signInNavRef = { skip: false }

const VALID_MODES = new Set(['exploration', 'appreciation', 'nourishment', 'survival'])

function sanitizeCanvas(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'string') continue
    out[k] = v === 'purpose' ? 'exploration' : VALID_MODES.has(v) ? v : null
    if (out[k] === null) delete out[k]
  }
  return out
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
    if (!saved.checkins || typeof saved.checkins !== 'object') saved.checkins = {}
    if (!saved.practices || typeof saved.practices !== 'object') saved.practices = {}
    saved.canvas = sanitizeCanvas(saved.canvas)

    return saved
  } catch (e) {
    console.error('migrateState error', e)
    return {
      _version: STATE_VERSION,
      onboarded: saved.onboarded || false,
      userId: saved.userId || null,
      canvas: sanitizeCanvas(saved.canvas),
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
    canvas: {},
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
    const canvas = sanitizeCanvas(user.canvas)
    return {
      _version: STATE_VERSION,
      onboarded: user.onboarded,
      userId: user.id,
      canvas,
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
  const checkinsRef = useRef(state.checkins)

  useEffect(() => { checkinsRef.current = state.checkins }, [state.checkins])

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
      try {
        if (event === 'SIGNED_IN' && session?.user) {
          const restored = await restoreFromSupabase(session.user.id, session.user.email)
          if (restored) {
            setState(restored)
            saveState(restored)
            const shouldSkip = signInNavRef.skip
            signInNavRef.skip = false
            if (!shouldSkip) onSignIn?.()
          }
        }
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('maslow_state')
          setState(initialState())
        }
      } catch (e) {
        console.error('onAuthStateChange error', e)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { saveState(state) }, [state])

  function updateCanvas(needId, mode) {
    if (mode == null && UNIVERSAL_NEEDS.includes(needId)) return Promise.resolve()

    if (needId === 'rest' && ABOVE_NOURISHMENT_MODES.includes(mode)) {
      console.warn(`updateCanvas: rest cannot be set to "${mode}" — capping at nourishment`)
      mode = 'nourishment'
    }

    return new Promise((resolve, reject) => {
      setState(prev => {
        const previousCanvas = prev.canvas
        const newCanvas = { ...prev.canvas }
        if (mode == null) {
          delete newCanvas[needId]
        } else {
          newCanvas[needId] = mode
        }
        if (prev.userId) {
          supabase.from('users').update({ canvas: newCanvas }).eq('id', prev.userId).then(({ error }) => {
            if (error) {
              logSupabaseError('updateCanvas', error)
              setState(p => ({ ...p, canvas: previousCanvas }))
              reject(error)
            } else {
              resolve()
            }
          })
        } else {
          resolve()
        }
        return { ...prev, canvas: newCanvas }
      })
    })
  }

  function addPractice(needId, text) {
    if (!text.trim()) return
    setState(prev => {
      const current = prev.practices[needId] || []
      if (current.length >= 10) return prev
      const previousPractices = prev.practices
      const newPractices = { ...prev.practices, [needId]: [...current, text.trim()] }
      if (prev.userId) {
        supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId).then(({ error }) => {
          if (error) {
            logSupabaseError('addPractice', error)
            setState(p => ({ ...p, practices: previousPractices }))
          }
        })
      }
      return { ...prev, practices: newPractices }
    })
  }

  function removePractice(needId, index) {
    setState(prev => {
      const previousPractices = prev.practices
      const current = [...(prev.practices[needId] || [])]
      current.splice(index, 1)
      const newPractices = { ...prev.practices, [needId]: current }
      if (prev.userId) {
        supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId).then(({ error }) => {
          if (error) {
            logSupabaseError('removePractice', error)
            setState(p => ({ ...p, practices: previousPractices }))
          }
        })
      }
      return { ...prev, practices: newPractices }
    })
  }

  function checkIn(needId, practiceText, date = todayKey()) {
    const key = `${needId}_${practiceText}`
    const existing = checkinsRef.current[date] || []
    const isRemoving = existing.includes(key)
    const updated = isRemoving ? existing.filter(k => k !== key) : [...existing, key]
    const newCheckins = { ...checkinsRef.current, [date]: updated }
    checkinsRef.current = newCheckins

    setState(prev => ({ ...prev, checkins: newCheckins }))

    function revert() {
      setState(prev => {
        const current = prev.checkins[date] || []
        const restored = isRemoving
          ? (current.includes(key) ? current : [...current, key])
          : current.filter(k => k !== key)
        const reverted = { ...prev.checkins, [date]: restored }
        checkinsRef.current = reverted
        return { ...prev, checkins: reverted }
      })
    }

    if (state.userId) {
      if (!isRemoving) {
        supabase.from('checkins').insert({ user_id: state.userId, date_key: date, need_id: key }).then(({ error }) => {
          if (error) {
            logSupabaseError('checkIn', error)
            revert()
          }
        })
      } else {
        supabase.from('checkins').delete().eq('user_id', state.userId).eq('date_key', date).eq('need_id', key).then(({ error }) => {
          if (error) {
            logSupabaseError('checkIn', error)
            revert()
          }
        })
      }
    }
  }

  async function logMood(userId, promptTime, mood, note, date) {
    if (!userId) return { error: 'Not authenticated' }
    const previous = (state.moods || []).find(
      m => m.date_key === date && m.prompt_time === promptTime
    ) || null

    setState(prev => {
      const filtered = (prev.moods || []).filter(
        m => !(m.date_key === date && m.prompt_time === promptTime)
      )
      return { ...prev, moods: [{ user_id: userId, date_key: date, prompt_time: promptTime, mood, note: note || null }, ...filtered] }
    })

    const { error } = await supabase
      .from('moods')
      .upsert({ user_id: userId, date_key: date, prompt_time: promptTime, mood, note: note || null },
        { onConflict: 'user_id,date_key,prompt_time' })

    if (error) {
      logSupabaseError('logMood', error)
      setState(prev => {
        const filtered = (prev.moods || []).filter(
          m => !(m.date_key === date && m.prompt_time === promptTime)
        )
        return { ...prev, moods: previous ? [previous, ...filtered] : filtered }
      })
    }

    return { error }
  }

  async function loadMoods() {
    if (!state.userId) return
    const moods = await fetchMoods(state.userId)
    setState(prev => ({ ...prev, moods }))
  }

  function completeOnboarding(canvas, practices, profile) {
    const { userId, ...profileData } = profile || {}
    setState(prev => ({
      ...prev,
      onboarded: true,
      onboardedAt: todayKey(),
      canvas: canvas || prev.canvas,
      practices: practices || prev.practices,
      profile: profile ? profileData : prev.profile,
      userId: userId || prev.userId,
    }))
  }

  function saveProfile({ name, phone, smsEnabled }) {
    setState(prev => {
      const newProfile = { ...prev.profile, smsEnabled }
      if (prev.userId) {
        supabase
          .from('users')
          .update({ name: name || null, phone: phone || null, profile: newProfile })
          .eq('id', prev.userId)
          .then(({ error }) => { if (error) logSupabaseError('saveProfile', error) })
      }
      return { ...prev, profile: newProfile }
    })
  }

  return { state, authLoading, updateCanvas, addPractice, removePractice, checkIn, logMood, completeOnboarding, loadMoods, saveProfile }
}

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

export async function loadJournalEntry(userId, dateKey) {
  const { data } = await supabase
    .from('journal')
    .select('entry')
    .eq('user_id', userId)
    .eq('date_key', dateKey)
    .maybeSingle()
  return data?.entry || ''
}

export async function saveJournalEntry(userId, dateKey, entry) {
  const { error } = await supabase
    .from('journal')
    .upsert({ user_id: userId, date_key: dateKey, entry }, { onConflict: 'user_id,date_key' })
  if (error) logSupabaseError('saveJournalEntry', error)
  return { error }
}

export async function loadDebriefs(userId) {
  const { data } = await supabase
    .from('debriefs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function saveDebrief(userId, { dateKey, nature, environment, entry, stepsCompleted, type = 'anxiety' }) {
  const { data, error } = await supabase
    .from('debriefs')
    .insert({
      user_id: userId,
      date_key: dateKey,
      nature,
      environment,
      entry,
      steps_completed: stepsCompleted,
      type,
    })
    .select()
    .single()
  if (error) logSupabaseError('saveDebrief', error)
  return { data, error }
}

export async function loadDebriefTypes(userId) {
  const { data } = await supabase
    .from('debrief_types')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
  const result = { nature: [], environment: [], peak: [] }
  for (const row of (data || [])) {
    if (result[row.category]) result[row.category].push(row)
  }
  return result
}

export async function saveDebriefType(userId, { category, name, color }) {
  const { data, error } = await supabase
    .from('debrief_types')
    .upsert({ user_id: userId, category, name, color }, { onConflict: 'user_id,category,name' })
    .select()
  if (error) logSupabaseError('saveDebriefType', error)
  return { data, error }
}

export async function deleteDebriefType(userId, { category, name }) {
  const { error } = await supabase
    .from('debrief_types')
    .delete()
    .eq('user_id', userId)
    .eq('category', category)
    .eq('name', name)
  if (error) logSupabaseError('deleteDebriefType', error)
  return { error }
}
