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
    if (!saved.practicesDB) saved.practicesDB = []
    if (!saved.noteDeck) saved.noteDeck = []
    if (saved.onboardedAt === undefined) saved.onboardedAt = null
    if (saved.showNoteToSelf === undefined) saved.showNoteToSelf = true
    if (saved.reviewDay === undefined) saved.reviewDay = 0
    if (saved.reviewTime === undefined) saved.reviewTime = '10:00'
    if (saved.reviewCadence === undefined) saved.reviewCadence = 'weekly'
    if (saved.remindersEnabled === undefined) saved.remindersEnabled = null
    if (saved.reviewReminderEnabled === undefined) saved.reviewReminderEnabled = true
    if (saved.notifPrimedAt === undefined) saved.notifPrimedAt = null
    if (saved.tourSeenAt === undefined) saved.tourSeenAt = null
    if (!saved.moodReminders) saved.moodReminders = { morning: { on: true, time: '09:00' }, midday: { on: true, time: '13:00' }, evening: { on: true, time: '19:00' } }
    saved.canvas = sanitizeCanvas(saved.canvas)

    // Migrate old checkin format (string array like 'movement_go for a run')
    // to new object array format [{ id, need_id, practice_text, mode, completed_at }]
    for (const [dateKey, entries] of Object.entries(saved.checkins)) {
      if (!Array.isArray(entries) || entries.length === 0) continue
      if (typeof entries[0] !== 'string') continue
      saved.checkins[dateKey] = entries.map(key => {
        const sep = key.indexOf('_')
        return {
          id: null,
          need_id: sep > 0 ? key.slice(0, sep) : key,
          practice_text: sep > 0 ? key.slice(sep + 1) : '',
          mode: null,
          completed_at: null,
        }
      })
    }

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
      email: saved.email || '',
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
    practicesDB: [],
    checkins: {},
    moods: [],
    noteDeck: [],
    profile: { name: '' },
    email: '',
    showNoteToSelf: true,
    reviewDay: 0,
    reviewTime: '10:00',
    reviewCadence: 'weekly',
    remindersEnabled: null,
    reviewReminderEnabled: true,
    notifPrimedAt: null,
    tourSeenAt: null,
    moodReminders: { morning: { on: true, time: '09:00' }, midday: { on: true, time: '13:00' }, evening: { on: true, time: '19:00' } },
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

    const [{ data: checkins }, moods, noteDeck, { data: practicesRows }] = await Promise.all([
      supabase.from('checkins').select('*').eq('user_id', user.id).gte('date_key', cutoff),
      fetchMoods(user.id),
      loadNoteDeck(user.id),
      supabase.from('practices').select('id, label, need_id, created_at, archived_at').eq('user_id', user.id).order('created_at'),
    ])
    const checkinsMap = {}
    for (const row of (checkins || [])) {
      if (!checkinsMap[row.date_key]) checkinsMap[row.date_key] = []
      checkinsMap[row.date_key].push({
        id: row.id,
        need_id: row.need_id,
        practice_text: row.practice_text || '',
        practice_id: row.practice_id || null,
        mode: row.mode || null,
        completed_at: row.completed_at || null,
        count: row.count || 1,
      })
    }
    const canvas = sanitizeCanvas(user.canvas)
    return {
      _version: STATE_VERSION,
      onboarded: user.onboarded,
      userId: user.id,
      canvas,
      practices: user.practices || {},
      practicesDB: practicesRows || [],
      checkins: checkinsMap,
      moods,
      noteDeck: noteDeck || [],
      profile: { name: user.name || '' },
      email: email,
      onboardedAt: user.onboarded_at || null,
      showNoteToSelf: user.show_note_to_self !== false,
      reviewDay: user.review_day ?? 0,
      reviewTime: user.review_time || '10:00',
      reviewCadence: user.review_cadence || 'weekly',
      remindersEnabled: user.reminders_enabled ?? null,
      reviewReminderEnabled: user.review_reminder_enabled !== false,
      notifPrimedAt: user.notif_primed_at || null,
      tourSeenAt: user.tour_seen_at || null,
      moodReminders: user.mood_reminders || { morning: { on: true, time: '09:00' }, midday: { on: true, time: '13:00' }, evening: { on: true, time: '19:00' } },
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
        // getSession() can hang (auth lock contention / stalled token refresh).
        // Race it against a timeout so the loader always dismisses; if the real
        // call resolves later, restore the session in the background.
        const sessionPromise = supabase.auth.getSession()
        const timeoutMs = 5000
        const result = await Promise.race([
          sessionPromise,
          new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), timeoutMs)),
        ])
        setAuthLoading(false)

        async function restore(session) {
          if (!session?.user) return
          const restored = await restoreFromSupabase(session.user.id, session.user.email)
          if (restored) { setState(restored); saveState(restored) }
        }

        if (result?.timedOut) {
          console.warn(`checkSession: getSession() did not resolve within ${timeoutMs}ms — showing app from cached state`)
          sessionPromise.then(({ data }) => restore(data?.session)).catch(e => console.error('checkSession late-resolve error', e))
        } else {
          await restore(result?.data?.session)
        }
      } catch (e) {
        console.error('checkSession error', e)
        setAuthLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // NEVER await a Supabase call inside this callback — it holds the auth lock
      // and any nested Supabase call will deadlock. Defer all async work via setTimeout.
      if (event === 'SIGNED_IN' && session?.user) {
        // Capture both flags synchronously before yielding to the event loop.
        const shouldSkip = signInNavRef.skip
        signInNavRef.skip = false
        const { id, email } = session.user
        setTimeout(() => {
          restoreFromSupabase(id, email)
            .then(restored => {
              if (!restored) return
              if (!shouldSkip) {
                setState(restored)
                saveState(restored)
                onSignIn?.()
              } else {
                // Onboarding path: persist to disk but don't overwrite the state
                // that completeOnboarding is building in memory.
                saveState(restored)
              }
            })
            .catch(e => console.error('onAuthStateChange restore error', e))
        }, 0)
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('maslow_state')
        setState(initialState())
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
      const label = text.trim()
      const previousPractices = prev.practices
      const previousPracticesDB = prev.practicesDB
      const newPractices = { ...prev.practices, [needId]: [...current, label] }
      const tempId = `pending_${Date.now()}_${Math.random()}`
      const tempRecord = { id: tempId, label, need_id: needId, created_at: new Date().toISOString(), archived_at: null }
      if (prev.userId) {
        supabase.from('practices')
          .insert({ user_id: prev.userId, label, need_id: needId })
          .select('id, label, need_id, created_at, archived_at')
          .single()
          .then(({ data, error }) => {
            if (error) {
              logSupabaseError('addPractice', error)
              setState(p => ({ ...p, practices: previousPractices, practicesDB: previousPracticesDB }))
            } else if (data) {
              // Replace temp record with real DB record
              setState(p => ({ ...p, practicesDB: p.practicesDB.map(r => r.id === tempId ? data : r) }))
            }
            // Also sync the JSONB for backward compat
            supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId)
          })
      }
      return { ...prev, practices: newPractices, practicesDB: [...prev.practicesDB, tempRecord] }
    })
  }

  function renamePractice(practiceId, newLabel) {
    if (!newLabel.trim()) return
    const label = newLabel.trim()
    setState(prev => {
      const record = prev.practicesDB.find(p => p.id === practiceId)
      if (!record) return prev
      const previousPracticesDB = prev.practicesDB
      const previousPractices = prev.practices
      const updatedDB = prev.practicesDB.map(p => p.id === practiceId ? { ...p, label } : p)
      // Update JSONB: replace old label with new label in the need's array
      const needArr = (prev.practices[record.need_id] || []).map(t => t === record.label ? label : t)
      const newPractices = { ...prev.practices, [record.need_id]: needArr }
      if (prev.userId) {
        supabase.from('practices').update({ label }).eq('id', practiceId).then(({ error }) => {
          if (error) {
            logSupabaseError('renamePractice', error)
            setState(p => ({ ...p, practicesDB: previousPracticesDB, practices: previousPractices }))
          }
        })
        supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId)
      }
      return { ...prev, practicesDB: updatedDB, practices: newPractices }
    })
  }

  function archivePractice(practiceId) {
    setState(prev => {
      const record = prev.practicesDB.find(p => p.id === practiceId)
      if (!record) return prev
      const previousPracticesDB = prev.practicesDB
      const previousPractices = prev.practices
      const archivedAt = new Date().toISOString()
      const updatedDB = prev.practicesDB.map(p => p.id === practiceId ? { ...p, archived_at: archivedAt } : p)
      // Remove from JSONB for backward compat
      const needArr = (prev.practices[record.need_id] || []).filter(t => t !== record.label)
      const newPractices = { ...prev.practices, [record.need_id]: needArr }
      if (prev.userId) {
        supabase.from('practices').update({ archived_at: archivedAt }).eq('id', practiceId).then(({ error }) => {
          if (error) {
            logSupabaseError('archivePractice', error)
            setState(p => ({ ...p, practicesDB: previousPracticesDB, practices: previousPractices }))
          }
        })
        supabase.from('users').update({ practices: newPractices }).eq('id', prev.userId)
      }
      return { ...prev, practicesDB: updatedDB, practices: newPractices }
    })
  }

  // Keep old removePractice for any callers not yet migrated
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

  function checkIn(needId, practiceText, mode, date = todayKey(), practiceId = null) {
    const uid = userIdRef.current
    if (!uid) {
      console.error('[checkIn] called without userId — practice not persisted')
      return
    }

    const completedAt = new Date().toISOString()
    const tempId = `pending_${Date.now()}_${Math.random()}`
    const newEntry = { id: tempId, need_id: needId, practice_text: practiceText, practice_id: practiceId, mode: mode || null, completed_at: completedAt, count: 1 }

    const newCheckins = {
      ...checkinsRef.current,
      [date]: [...(checkinsRef.current[date] || []), newEntry],
    }
    checkinsRef.current = newCheckins
    setState(prev => ({ ...prev, checkins: newCheckins }))

    supabase.from('checkins')
      .insert({ user_id: uid, date_key: date, need_id: needId, practice_text: practiceText, practice_id: practiceId, mode: mode || null, completed_at: completedAt, count: 1 })
      .select('id, practice_id').single()
      .then(({ data, error }) => {
        if (error) {
          logSupabaseError('checkIn', error)
          setState(prev => {
            const day = (prev.checkins[date] || []).filter(e => e.id !== tempId)
            const reverted = { ...prev.checkins, [date]: day }
            checkinsRef.current = reverted
            return { ...prev, checkins: reverted }
          })
        } else if (data) {
          setState(prev => {
            const day = (prev.checkins[date] || []).map(e =>
              e.id === tempId ? { ...e, id: data.id, practice_id: data.practice_id || e.practice_id } : e
            )
            const updated = { ...prev.checkins, [date]: day }
            checkinsRef.current = updated
            return { ...prev, checkins: updated }
          })
        }
      })
  }

  function removeCheckin(needId, date = todayKey()) {
    const uid = userIdRef.current
    const existing = checkinsRef.current[date] || []

    // Find the most recent entry for this need (last one in the append-ordered array)
    let lastIdx = -1
    for (let i = existing.length - 1; i >= 0; i--) {
      if (existing[i].need_id === needId) { lastIdx = i; break }
    }
    if (lastIdx === -1) return

    const removed = existing[lastIdx]
    const updated = existing.filter((_, i) => i !== lastIdx)
    const newCheckins = { ...checkinsRef.current, [date]: updated }
    checkinsRef.current = newCheckins
    setState(prev => ({ ...prev, checkins: newCheckins }))

    // Pending entries (not yet saved) have no real DB row to delete
    if (!uid || !removed.id || String(removed.id).startsWith('pending_')) return

    supabase.from('checkins').delete().eq('id', removed.id).then(({ error }) => {
      if (error) {
        logSupabaseError('removeCheckin', error)
        setState(prev => {
          const reverted = { ...prev.checkins, [date]: [...(prev.checkins[date] || []), removed] }
          checkinsRef.current = reverted
          return { ...prev, checkins: reverted }
        })
      }
    })
  }

  function clearPracticeCheckins(needId, practiceText, date = todayKey()) {
    const uid = userIdRef.current
    const existing = checkinsRef.current[date] || []

    const toRemove = existing.filter(e => e.need_id === needId && e.practice_text === practiceText)
    if (toRemove.length === 0) return

    const kept = existing.filter(e => !(e.need_id === needId && e.practice_text === practiceText))
    const newCheckins = { ...checkinsRef.current, [date]: kept }
    checkinsRef.current = newCheckins
    setState(prev => ({ ...prev, checkins: newCheckins }))

    const realIds = toRemove.map(e => e.id).filter(id => id && !String(id).startsWith('pending_'))
    if (!uid || realIds.length === 0) return

    supabase.from('checkins').delete().in('id', realIds).then(({ error }) => {
      if (error) {
        logSupabaseError('clearPracticeCheckins', error)
        setState(prev => {
          const reverted = { ...prev.checkins, [date]: [...(prev.checkins[date] || []), ...toRemove] }
          checkinsRef.current = reverted
          return { ...prev, checkins: reverted }
        })
      }
    })
  }

  function incrementCheckinCount(entryId, date = todayKey()) {
    const uid = userIdRef.current
    setState(prev => {
      const day = (prev.checkins[date] || []).map(e =>
        e.id === entryId ? { ...e, count: 2 } : e
      )
      const updated = { ...prev.checkins, [date]: day }
      checkinsRef.current = updated
      if (uid && entryId && !String(entryId).startsWith('pending_')) {
        supabase.from('checkins').update({ count: 2 }).eq('id', entryId).then(({ error }) => {
          if (error) {
            logSupabaseError('incrementCheckinCount', error)
            setState(p => {
              const d = (p.checkins[date] || []).map(e =>
                e.id === entryId ? { ...e, count: 1 } : e
              )
              const rev = { ...p.checkins, [date]: d }
              checkinsRef.current = rev
              return { ...p, checkins: rev }
            })
          }
        })
      }
      return { ...prev, checkins: updated }
    })
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

  function updateReviewCadence(cadence) {
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ review_cadence: cadence }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('updateReviewCadence', error)
        })
      }
      return { ...prev, reviewCadence: cadence }
    })
  }

  function updateRemindersEnabled(value) {
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ reminders_enabled: value }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('updateRemindersEnabled', error)
        })
      }
      return { ...prev, remindersEnabled: value }
    })
  }

  function updateReviewReminderEnabled(value) {
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ review_reminder_enabled: value }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('updateReviewReminderEnabled', error)
        })
      }
      return { ...prev, reviewReminderEnabled: value }
    })
  }

  function updateMoodReminder(slot, { on, time }) {
    setState(prev => {
      const updated = { ...prev.moodReminders, [slot]: { on, time } }
      if (prev.userId) {
        supabase.from('users').update({ mood_reminders: updated }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('updateMoodReminder', error)
        })
      }
      return { ...prev, moodReminders: updated }
    })
  }

  function markNotifPrimed() {
    const now = new Date().toISOString()
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ notif_primed_at: now }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('markNotifPrimed', error)
        })
      }
      return { ...prev, notifPrimedAt: now }
    })
  }

  function markTourSeen() {
    const now = new Date().toISOString()
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ tour_seen_at: now }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('markTourSeen', error)
        })
      }
      return { ...prev, tourSeenAt: now }
    })
  }

  function resetTour() {
    setState(prev => {
      if (prev.userId) {
        supabase.from('users').update({ tour_seen_at: null }).eq('id', prev.userId).then(({ error }) => {
          if (error) logSupabaseError('resetTour', error)
        })
      }
      return { ...prev, tourSeenAt: null }
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

  function updateNoteDeck(deck) {
    setState(prev => ({ ...prev, noteDeck: deck }))
  }

  function syncCheckinDay(date, dayCheckins) {
    const newCheckins = { ...checkinsRef.current, [date]: dayCheckins }
    checkinsRef.current = newCheckins
    setState(prev => ({ ...prev, checkins: newCheckins }))
  }

  return { state, authLoading, updateCanvas, replaceCanvas, addPractice, renamePractice, archivePractice, removePractice, checkIn, removeCheckin, clearPracticeCheckins, incrementCheckinCount, logMood, completeOnboarding, updateShowNoteToSelf, updateReviewSchedule, updateReviewCadence, updateRemindersEnabled, updateReviewReminderEnabled, updateMoodReminder, markNotifPrimed, markTourSeen, resetTour, updateNoteDeck, syncCheckinDay }
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

export async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function loadJournalEntries(userId, dateKey) {
  const { data } = await supabase
    .from('journal')
    .select('id, entry, slot, need_id, state, custom, image_url, favorite, revisit, quoted_text, quoted_date, created_at')
    .eq('user_id', userId)
    .eq('date_key', dateKey)
    .order('created_at', { ascending: true })
  return data || []
}

export async function addJournalEntry(userId, dateKey, { entry, slot, needId, state, custom, imageUrl, quotedText, quotedDate }) {
  const { data, error } = await supabase
    .from('journal')
    .insert({ user_id: userId, date_key: dateKey, entry, slot: slot || null, need_id: needId || null, state: state || null, custom: custom || null, image_url: imageUrl || null, quoted_text: quotedText || null, quoted_date: quotedDate || null })
    .select('id, entry, slot, need_id, state, custom, image_url, favorite, revisit, quoted_text, quoted_date, created_at')
    .single()
  if (error) logSupabaseError('addJournalEntry', error)
  return { data, error }
}

export async function loadAllJournalMeta(userId) {
  const { data } = await supabase
    .from('journal')
    .select('id, need_id, state, custom')
    .eq('user_id', userId)
  return data || []
}

export async function loadJournalArchive(userId) {
  const { data } = await supabase
    .from('journal')
    .select('id, date_key, entry, slot, need_id, state, custom, image_url, favorite, revisit, quoted_text, quoted_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function toggleJournalFavorite(id, favorite) {
  const { error } = await supabase.from('journal').update({ favorite }).eq('id', id)
  if (error) logSupabaseError('toggleJournalFavorite', error)
  return { error }
}

export async function toggleJournalRevisit(id, revisit) {
  const { error } = await supabase.from('journal').update({ revisit }).eq('id', id)
  if (error) logSupabaseError('toggleJournalRevisit', error)
  return { error }
}

export async function loadRevisitQueue(userId) {
  const { data } = await supabase
    .from('journal')
    .select('id, date_key, entry, favorite, created_at')
    .eq('user_id', userId)
    .eq('revisit', true)
    .order('created_at', { ascending: false })
  return data || []
}

export async function loadDayCheckins(userId, dateKey) {
  const { data } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('date_key', dateKey)
  return (data || []).map(row => ({
    id: row.id,
    need_id: row.need_id,
    practice_text: row.practice_text || '',
    practice_id: row.practice_id || null,
    mode: row.mode || null,
    completed_at: row.completed_at || null,
    count: row.count || 1,
  }))
}

export async function updateJournalEntryTags(id, { needId, stateName, customLabel }) {
  const updates = {}
  if (needId !== undefined) updates.need_id = needId
  if (stateName !== undefined) updates.state = stateName
  if (customLabel !== undefined) updates.custom = customLabel
  const { error } = await supabase.from('journal').update(updates).eq('id', id)
  if (error) logSupabaseError('updateJournalEntryTags', error)
  return { error }
}

// ── Custom tags ─────────────────────────────────────────────────────────────

export async function loadCustomTags(userId) {
  const { data } = await supabase
    .from('custom_tags')
    .select('id, label, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function createCustomTag(userId, label) {
  const { data, error } = await supabase
    .from('custom_tags')
    .insert({ user_id: userId, label })
    .select('id, label, created_at')
    .single()
  if (error) logSupabaseError('createCustomTag', error)
  return { data, error }
}

export async function deleteCustomTag(id) {
  const { error } = await supabase
    .from('custom_tags')
    .delete()
    .eq('id', id)
  if (error) logSupabaseError('deleteCustomTag', error)
  return { error }
}

export async function loadCustomTagUsageCounts(userId) {
  const { data } = await supabase
    .from('journal')
    .select('custom')
    .eq('user_id', userId)
    .not('custom', 'is', null)
  const counts = {}
  for (const row of data || []) {
    if (row.custom) counts[row.custom] = (counts[row.custom] || 0) + 1
  }
  return counts
}

export async function deleteJournalEntry(id, imageUrl) {
  removeStorageImage(imageUrl)
  const { error } = await supabase
    .from('journal')
    .delete()
    .eq('id', id)
  if (error) logSupabaseError('deleteJournalEntry', error)
  return { error }
}

// Legacy single-blob helpers — kept for Log/Data screens that haven't migrated yet
export async function loadJournalEntry(userId, dateKey) {
  const entries = await loadJournalEntries(userId, dateKey)
  return entries.map(e => e.entry || '').filter(Boolean).join('\n\n')
}

export async function saveJournalEntry(userId, dateKey, entry) {
  return addJournalEntry(userId, dateKey, { entry, slot: null, needId: null, state: null })
}

// Loads active (archived_at null) note_deck cards ordered for the swipe deck.
// Lazily migrates a legacy note_to_self value if no rows exist yet.
export async function loadNoteDeck(userId) {
  const { data } = await supabase
    .from('note_deck')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
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

// Loads archived (library) note_deck cards, newest first.
export async function loadNoteLibrary(userId) {
  const { data } = await supabase
    .from('note_deck')
    .select('*')
    .eq('user_id', userId)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  return data || []
}

// Saves a brand-new note directly to the library (archived_at = now).
export async function addNoteToLibrary(userId, { text, imageUrl }) {
  const { data, error } = await supabase
    .from('note_deck')
    .insert({ user_id: userId, text, image_url: imageUrl || null, position: 0, archived_at: new Date().toISOString() })
    .select()
    .single()
  if (error) logSupabaseError('addNoteToLibrary', error)
  return { data, error }
}

// Moves a deck card into the library by setting archived_at.
export async function archiveNoteDeckCard(id) {
  const { error } = await supabase
    .from('note_deck')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) logSupabaseError('archiveNoteDeckCard', error)
  return { error }
}

// Restores a library card to the deck end; DB trigger rejects if deck already has 5 active.
export async function restoreNoteDeckCard(userId, id) {
  const { data: existing } = await supabase
    .from('note_deck')
    .select('position')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('position', { ascending: false })
    .limit(1)
  const nextPosition = existing?.[0] ? existing[0].position + 1 : 0
  const { error } = await supabase
    .from('note_deck')
    .update({ archived_at: null, position: nextPosition })
    .eq('id', id)
  if (error) logSupabaseError('restoreNoteDeckCard', error)
  return { error }
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

function removeStorageImage(imageUrl) {
  if (!imageUrl) return
  const parts = imageUrl.split('/storage/v1/object/public/note-images/')
  if (parts[1]) supabase.storage.from('note-images').remove([parts[1]])
}

export async function deleteNoteDeckCard(id, userId, text, imageUrl) {
  await appendNoteHistory(userId, text)
  removeStorageImage(imageUrl)
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

export async function saveWeeklyReview(userId, { weekStarting, weeklyMood, stepsCompleted, reviewDate, cadence }) {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .upsert(
      {
        user_id: userId,
        week_starting: weekStarting,
        weekly_mood: weeklyMood,
        steps_completed: stepsCompleted,
        review_date: reviewDate || null,
        cadence: cadence || 'weekly',
      },
      { onConflict: 'user_id,week_starting' }
    )
    .select()
    .single()
  if (error) logSupabaseError('saveWeeklyReview', error)
  return { data, error }
}

export async function loadPracticeCompletionStats(userId) {
  const now = new Date()
  const monthStartKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data } = await supabase
    .from('checkins')
    .select('need_id, practice_text, date_key')
    .eq('user_id', userId)
  if (!data) return []

  const map = new Map()
  for (const row of data) {
    if (!row.practice_text) continue
    const key = `${row.need_id}|${row.practice_text}`
    if (!map.has(key)) map.set(key, { need_id: row.need_id, practice_text: row.practice_text, total: 0, month: 0 })
    const entry = map.get(key)
    entry.total++
    if (row.date_key >= monthStartKey) entry.month++
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
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
