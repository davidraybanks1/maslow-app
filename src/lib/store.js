import { useState, useEffect } from 'react'
import { defaultCanvas } from './constants'
import { supabase } from './supabase'

const STORAGE_KEY = 'maslow_state_v2'

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

export function initialState() {
  const saved = loadState()
  if (saved) return saved
  return {
    onboarded: false,
    userId: null,
    canvas: defaultCanvas(),
    practices: {},
    checkins: {},
    profile: { name: '' },
  }
}

async function restoreFromSupabase(userId) {
  try {
    const [{ data: user }, { data: checkins }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('checkins').select('*').eq('user_id', userId),
    ])
    if (!user) return null
    const checkinsMap = {}
    for (const row of (checkins || [])) {
      if (!checkinsMap[row.date_key]) checkinsMap[row.date_key] = []
      checkinsMap[row.date_key].push(row.need_id)
    }
    return {
      onboarded: user.onboarded,
      userId: user.id,
      canvas: user.canvas || defaultCanvas(),
      practices: user.practices || {},
      checkins: checkinsMap,
      profile: { name: user.name || '' },
    }
  } catch (e) {
    console.error('restoreFromSupabase error', e)
    return null
  }
}

export function useAppState() {
  const [state, setState] = useState(initialState)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const restored = await restoreFromSupabase(session.user.id)
        if (restored) { setState(restored); saveState(restored) }
      }
      setAuthLoading(false)
    }
    checkSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const restored = await restoreFromSupabase(session.user.id)
        if (restored) { setState(restored); saveState(restored) }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { saveState(state) }, [state])

  function updateCanvas(needId, mode) {
    setState(prev => {
      const newCanvas = { ...prev.canvas, [needId]: mode }
      if (prev.userId) {
        supabase.from('users').update({ canvas: newCanvas }).eq('id', prev.userId).then()
      }
      return { ...prev, canvas: newCanvas }
    })
  }

  function setPractice(needId, index, text) {
    setState(prev => {
      const needPractices = [...(prev.practices[needId] || [])]
      needPractices[index] = text
      const newPractices = { ...prev.practices, [needId]: needPractices }
      if (prev.userId) {
        supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId).then()
      }
      return { ...prev, practices: newPractices }
    })
  }

  function checkIn(needId, practiceIndex, date = todayKey()) {
    setState(prev => {
      const key = `${needId}_${practiceIndex}`
      const existing = prev.checkins[date] || []
      const updated = existing.includes(key)
        ? existing.filter(k => k !== key)
        : [...existing, key]
      if (prev.userId) {
        if (!existing.includes(key)) {
          supabase.from('checkins').insert({ user_id: prev.userId, date_key: date, need_id: key }).then()
        } else {
          supabase.from('checkins').delete().eq('user_id', prev.userId).eq('date_key', date).eq('need_id', key).then()
        }
      }
      return { ...prev, checkins: { ...prev.checkins, [date]: updated } }
    })
  }

  function completeOnboarding(canvas, profile) {
    setState(prev => ({ ...prev, onboarded: true, canvas, profile }))
  }

  return { state, authLoading, updateCanvas, setPractice, checkIn, completeOnboarding }
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