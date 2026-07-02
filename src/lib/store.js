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
    if (!saved.noteDeck) saved.noteDeck = []
    if (saved.showNoteToSelf === undefined) saved.showNoteToSelf = true
    if (saved.reviewDay === undefined) saved.reviewDay = 0
    if (saved.reviewTime === undefined) saved.reviewTime = '10:00'
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
    noteDeck: [],
    profile: { name: '' },
    showNoteToSelf: true,
    reviewDay: 0,
    reviewTime: '10:00',
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

    // Rows created before users.id was set to auth.uid() may still carry a mismatched id.
    if (user.id !== userId) {
      console.warn('restoreFromSupabase: users.id does not match auth.uid() — likely a pre-migration row', { usersId: user.id, authUid: userId })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoff = thirtyDaysAgo.toLocaleDateString('en-CA')

    const [{ data: checkins }, moods, noteDeck] = await Promise.all([
      supabase.from('checkins').select('*').eq('user_id', user.id).gte('date_key', cutoff),
      fetchMoods(user.id),
      loadNoteDeck(user.id),
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
      noteDeck: noteDeck || [],
      profile: { name: user.name || '' },
      showNoteToSelf: user.show_note_to_self !== false,
      reviewDay: user.review_day ?? 0,
      reviewTime: user.review_time || '10:00',
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
  const userIdRef = useRef(state.userId)

  useEffect(() => { checkinsRef.current = state.checkins }, [state.checkins])
  useEffect(() => { userIdRef.current = state.userId }, [state.userId])

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
          // Capture skip flag before the async restoreFromSupabase call so that
          // an in-progress onboarding sign-up doesn't get its state overwritten
          // when the restored data arrives (the onboarding upsert may not have
          // committed yet when we read the DB).
          const shouldSkip = signInNavRef.skip
          signInNavRef.skip = false
          const restored = await restoreFromSupabase(session.user.id, session.user.email)
          if (restored) {
            if (!shouldSkip) {
              setState(restored)
              saveState(restored)
              onSignIn?.()
            } else {
              // Onboarding path: persist to disk but don't overwrite the state
              // that completeOnboarding is building in memory.
              saveState(restored)
            }
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

    const uid = userIdRef.current
    if (!uid) {
      console.error('[checkIn] called without userId — practice not persisted')
      revert()
      return
    }
    if (!isRemoving) {
      supabase.from('checkins').insert({ user_id: uid, date_key: date, need_id: key }).then(({ error }) => {
        if (error) { logSupabaseError('checkIn', error); revert() }
      })
    } else {
      supabase.from('checkins').delete().eq('user_id', uid).eq('date_key', date).eq('need_id', key).then(({ error }) => {
        if (error) { logSupabaseError('checkIn', error); revert() }
      })
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
      // Only update profile if caller actually passed profile fields beyond userId.
      profile: Object.keys(profileData).length > 0 ? profileData : prev.profile,
      userId: userId || prev.userId,
    }))
  }

  function updateShowNoteToSelf(value) {
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ show_note_to_self: value }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('updateShowNoteToSelf', error)
        })
      }
      return { ...prev, showNoteToSelf: value }
    })
  }

  function updateReviewSchedule(day, time) {
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ review_day: day, review_time: time }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('updateReviewSchedule', error)
        })
      }
      return { ...prev, reviewDay: day, reviewTime: time }
    })
  }

  function saveProfile({ name, phone, smsEnabled }) {
    setState(prev => {
      const newProfile = { ...prev.profile, name: name || '', smsEnabled }
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

  function replaceCanvas(fullCanvas) {
    return new Promise((resolve, reject) => {
      setState(prev => {
        const previousCanvas = prev.canvas
        if (prev.userId) {
          supabase.rpc('save_canvas', { p_canvas: fullCanvas }).then(({ error }) => {
            if (error) {
              logSupabaseError('replaceCanvas', error)
              setState(p => ({ ...p, canvas: previousCanvas }))
              reject(error)
            } else {
              resolve()
            }
          })
        } else {
          console.error('[replaceCanvas] called without userId')
          reject(new Error('not authenticated'))
        }
        return { ...prev, canvas: fullCanvas }
      })
    })
  }

  return { state, authLoading, updateCanvas, replaceCanvas, addPractice, removePractice, checkIn, logMood, completeOnboarding, loadMoods, saveProfile, updateShowNoteToSelf, updateReviewSchedule }
}

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function weekKey(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))  // Monday-anchored (was Sunday-anchored)
  return d.toLocaleDateString('en-CA')
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

// Loads every note_deck card for a user, ordered for the swipe deck. If the user has no
// deck cards yet but has a legacy single note_to_self value, lazily migrates it into the
// deck (position 0) so existing notes aren't lost by the move to the deck model.
export async function loadNoteDeck(userId) {
  const { data } = await supabase
    .from('note_deck')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (data && data.length > 0) return data

  const { data: user } = await supabase.from('users').select('note_to_self').eq('id', userId).single()
  if (!user?.note_to_self) return []

  const { data: inserted, error } = await supabase
    .from('note_deck')
    .insert({ user_id: userId, text: user.note_to_self, position: 0 })
    .select()
  if (error) { logSupabaseError('loadNoteDeck (legacy migration)', error); return [] }
  return inserted || []
}

export async function addNoteDeckCard(userId, { text, imageUrl }) {
  const { data: existing } = await supabase
    .from('note_deck')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
  const nextPosition = existing && existing[0] ? existing[0].position + 1 : 0

  const { data, error } = await supabase
    .from('note_deck')
    .insert({ user_id: userId, text, image_url: imageUrl || null, position: nextPosition })
    .select()
    .single()
  if (error) logSupabaseError('addNoteDeckCard', error)
  return { data, error }
}

async function appendNoteHistory(userId, text) {
  const trimmed = text?.trim()
  if (!trimmed || !userId) return
  const { error } = await supabase.rpc('append_note_history', {
    p_text: trimmed,
    p_date: new Date().toLocaleDateString('en-CA'),
  })
  if (error) logSupabaseError('appendNoteHistory', error)
}

export async function updateNoteDeckCard(id, { text, imageUrl, userId, previousText }) {
  if (userId && previousText?.trim() && previousText.trim() !== text?.trim()) {
    await appendNoteHistory(userId, previousText)
  }
  const { data, error } = await supabase
    .from('note_deck')
    .update({ text, image_url: imageUrl || null })
    .eq('id', id)
    .select()
    .single()
  if (error) logSupabaseError('updateNoteDeckCard', error)
  return { data, error }
}

export async function deleteNoteDeckCard(id, userId, text) {
  await appendNoteHistory(userId, text)
  const { error } = await supabase.from('note_deck').delete().eq('id', id)
  if (error) logSupabaseError('deleteNoteDeckCard', error)
  return { error }
}

export async function reorderNoteDeck(cards) {
  const positions = cards.map((card, i) => ({ id: card.id, position: i }))
  const { error } = await supabase.rpc('reorder_note_deck', { p_positions: positions })
  if (error) {
    logSupabaseError('reorderNoteDeck', error)
    throw error
  }
}

export async function loadNoteHistory(userId) {
  const { data } = await supabase.from('users').select('note_history').eq('id', userId).single()
  return data?.note_history || []
}

export async function uploadNoteImage(userId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('note-images').upload(path, file)
  if (error) { logSupabaseError('uploadNoteImage', error); return { url: null, error } }
  const { data } = supabase.storage.from('note-images').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function loadWeeklyReviews(userId, limit) {
  let query = supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('week_starting', { ascending: false })
  if (limit) query = query.limit(limit)
  const { data } = await query
  return data || []
}

export async function loadUserCreatedAt(userId) {
  const { data } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .single()
  return data?.created_at || null
}

export async function saveWeeklyReview(userId, { weekStarting, weeklyMood, stepsCompleted }) {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .upsert(
      { user_id: userId, week_starting: weekStarting, weekly_mood: weeklyMood, steps_completed: stepsCompleted },
      { onConflict: 'user_id,week_starting' }
    )
    .select()
    .single()
  if (error) logSupabaseError('saveWeeklyReview', error)
  return { data, error }
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
