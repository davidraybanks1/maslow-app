import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODES, MODE_ORDER, TIME_RE } from '../lib/constants'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import { isNative, checkNotifPermission, requestNotifPermission, scheduleReminders } from '../lib/native'
import styles from './Practices.module.css'

const MAX = 10

const STARTERS = {
  movement:    ['walk', 'stretch', 'run', 'lift'],
  nutrition:   ['cook a meal', 'full water bottle', 'greens'],
  rest:        ['7 hours', 'nap', 'screens off by 10'],
  reflection:  ['journal', 'morning minutes', 'read'],
  community:   ['thoughtful text', 'call a friend', 'family dinner'],
  beauty:      ['time in nature', 'music', 'make something'],
  play:        ['game night', 'no-screen play', 'something silly'],
  information: ['learn one thing', 'read the news once'],
  intimacy:    ['check in with your person', 'undistracted time together'],
  touch:       ['hug someone', 'physical affection'],
  thrill:      ['something thrilling', 'cold plunge'],
  money:       ['review budget', 'no-spend day'],
  dwelling:    ['tidy one surface', '10-minute reset'],
}
const OB_FLAG = 'onboardingPracticesDone'

export default function Practices({ state, addPractice, renamePractice, archivePractice, setPracticeReminder, stampReminderOffered, incrementOffersDeclined, completeOnboarding }) {
  const navigate = useNavigate()
  const [inputs, setInputs] = useState({})
  const [openInputs, setOpenInputs] = useState({})
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [obDone, setObDone] = useState(() => !!localStorage.getItem(OB_FLAG))

  // Reminder state — native only
  const [notifPermission, setNotifPermission] = useState('prompt')
  const [pickerOpenFor, setPickerOpenFor] = useState(null)
  const [draftTimes, setDraftTimes] = useState({})
  const [permissionErrors, setPermissionErrors] = useState(new Set())

  const native = isNative()

  useEffect(() => {
    if (!native) return
    checkNotifPermission().then(setNotifPermission)
  }, [native])

  const useDB = Array.isArray(state.practicesDB) && state.practicesDB.length > 0
  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods: state.moods, practices: state.practices, practicesDB: state.practicesDB })
  const lastDoneByKey = new Map(stats.getPracticeStats().map(p => [p.practice?.id || `${p.need.id}_${p.text}`, p.daysSinceLast]))

  const activeReminderCount = (state.practicesDB || []).filter(p => p.reminder_on).length

  // Count checkins per practice_id (from the last 30 days in state)
  const checkinCounts = useMemo(() => {
    const counts = {}
    for (const entries of Object.values(state.checkins || {})) {
      for (const entry of (entries || [])) {
        if (entry.practice_id) counts[entry.practice_id] = (counts[entry.practice_id] || 0) + 1
      }
    }
    return counts
  }, [state.checkins])

  // Brake checked here, before rendering — if declined >= 2, offerPracticeId is null and nothing renders
  const offerPracticeId = useMemo(() => {
    if (!native) return null
    if (notifPermission === 'denied') return null
    if ((state.reminderOffersDeclined ?? 0) >= 2) return null
    if (activeReminderCount >= 3) return null
    const candidates = (state.practicesDB || [])
      .filter(p =>
        !p.archived_at &&
        !p.reminder_on &&
        !p.reminder_offered_at &&
        (checkinCounts[p.id] || 0) >= 3
      )
      .sort((a, b) => (checkinCounts[b.id] || 0) - (checkinCounts[a.id] || 0))
    return candidates[0]?.id ?? null
  }, [native, notifPermission, state.reminderOffersDeclined, state.practicesDB, activeReminderCount, checkinCounts])

  const totalPractices = useDB
    ? state.practicesDB.filter(p => !p.archived_at).length
    : Object.values(state.practices || {}).flat().length
  const showOnboardingCta = !obDone

  function doSchedule(overridePracticesDB) {
    scheduleReminders({
      remindersEnabled: state.remindersEnabled,
      moodReminders: state.moodReminders,
      reviewReminderEnabled: state.reviewReminderEnabled,
      reviewCadence: state.reviewCadence,
      reviewDay: state.reviewDay ?? 0,
      reviewTime: state.reviewTime || '10:00',
      practicesDB: overridePracticesDB ?? state.practicesDB,
    })
  }

  function getTakenTimes(excludeId) {
    const taken = []
    const mr = state.moodReminders || {}
    for (const [slot, data] of Object.entries(mr)) {
      if (data?.on && TIME_RE.test(data?.time)) taken.push({ time: data.time, label: `${slot} mood` })
    }
    if (state.reviewReminderEnabled && TIME_RE.test(state.reviewTime)) {
      taken.push({ time: state.reviewTime, label: `${state.reviewCadence === 'daily' ? 'daily' : 'weekly'} review` })
    }
    for (const p of (state.practicesDB || [])) {
      if (p.id !== excludeId && p.reminder_on && TIME_RE.test(p.reminder_time)) {
        taken.push({ time: p.reminder_time, label: p.label })
      }
    }
    return taken.sort((a, b) => a.time.localeCompare(b.time))
  }

  async function handleToggleReminder(practice) {
    if (practice.reminder_on) {
      const newDB = (state.practicesDB || []).map(p =>
        p.id === practice.id ? { ...p, reminder_on: false } : p
      )
      try {
        await setPracticeReminder(practice.id, { on: false })
        doSchedule(newDB)
      } catch (e) { console.warn('[Practices] toggle off failed', e) }
      return
    }

    if (activeReminderCount >= 3) return

    let perm = notifPermission
    if (perm === 'prompt') {
      perm = await requestNotifPermission()
      setNotifPermission(perm)
    }
    if (perm !== 'granted') {
      setPermissionErrors(prev => new Set([...prev, practice.id]))
      return
    }
    setPermissionErrors(prev => { const n = new Set(prev); n.delete(practice.id); return n })

    const time = TIME_RE.test(practice.reminder_time) ? practice.reminder_time : '08:00'
    const newDB = (state.practicesDB || []).map(p =>
      p.id === practice.id ? { ...p, reminder_on: true, reminder_time: time } : p
    )
    try {
      await setPracticeReminder(practice.id, { on: true, time })
      doSchedule(newDB)
      setPickerOpenFor(practice.id)
    } catch (e) { console.warn('[Practices] toggle on failed', e) }
  }

  async function handleCommitTime(practiceId) {
    const draft = draftTimes[practiceId]
    setDraftTimes(prev => { const n = { ...prev }; delete n[practiceId]; return n })
    if (draft === undefined) return
    const practice = (state.practicesDB || []).find(p => p.id === practiceId)
    if (!practice) return
    const persisted = practice.reminder_time || ''
    if (TIME_RE.test(draft) && draft !== persisted) {
      const newDB = (state.practicesDB || []).map(p =>
        p.id === practiceId ? { ...p, reminder_time: draft } : p
      )
      try {
        await setPracticeReminder(practiceId, { on: true, time: draft })
        doSchedule(newDB)
      } catch (e) { console.warn('[Practices] time commit failed', e) }
    }
  }

  async function handleAcceptOffer(practice) {
    let perm = notifPermission
    if (perm === 'prompt') {
      perm = await requestNotifPermission()
      setNotifPermission(perm)
    }
    stampReminderOffered(practice.id)
    if (perm !== 'granted') {
      setPermissionErrors(prev => new Set([...prev, practice.id]))
      return
    }
    const time = TIME_RE.test(practice.reminder_time) ? practice.reminder_time : '08:00'
    const newDB = (state.practicesDB || []).map(p =>
      p.id === practice.id ? { ...p, reminder_on: true, reminder_time: time } : p
    )
    try {
      await setPracticeReminder(practice.id, { on: true, time })
      doSchedule(newDB)
      setPickerOpenFor(practice.id)
    } catch (e) { console.warn('[Practices] accept offer failed', e) }
  }

  function handleDeclineOffer(practice) {
    stampReminderOffered(practice.id)
    incrementOffersDeclined()
  }

  function handleAdd(needId) {
    const text = (inputs[needId] || '').trim()
    if (!text) return
    addPractice(needId, text)
    setInputs(prev => ({ ...prev, [needId]: '' }))
  }

  function handleStartRename(practice) {
    setEditingId(practice.id)
    setRenameValue(practice.label)
  }

  function handleCommitRename(practiceId) {
    if (renameValue.trim()) renamePractice(practiceId, renameValue)
    setEditingId(null)
  }

  function handleToggleEdit() {
    setEditMode(e => {
      if (e) setEditingId(null)
      return !e
    })
  }

  function handleOnboardingDone() {
    localStorage.setItem(OB_FLAG, '1')
    setObDone(true)
    if (!state.onboarded && completeOnboarding) completeOnboarding()
    navigate('/today')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrowRow}>
          <button className={styles.editToggle} onClick={handleToggleEdit}>{editMode ? 'done' : 'edit'}</button>
        </div>
        <div className={styles.title}>your practices.</div>
        <div className={styles.sub}>add or remove practices available for each need.</div>
      </div>
      <div className={`${styles.list} ${showOnboardingCta ? styles.listWithCta : ''}`}>
        {MODE_ORDER.map(mode => {
          const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
          if (!modeNeeds.length) return null
          const modeColor = MODES[mode]?.pip
          return modeNeeds.map(n => {
            const pool = useDB
              ? state.practicesDB.filter(p => p.need_id === n.id && !p.archived_at)
              : (state.practices[n.id] || []).map(label => ({ id: null, label }))
            const atMax = pool.length >= MAX
            const showInput = !atMax && openInputs[n.id]
            return (
              <div key={n.id} className={styles.needGroup}>
                <div className={styles.needHeader}>
                  <div className={styles.needPip} style={{ background: modeColor }} />
                  <div className={styles.needName}>{n.name}</div>
                  <div className={styles.needTag}>{pool.length}/{MAX}</div>
                </div>

                <div className={styles.pool}>
                  {pool.length === 0 && (
                    (STARTERS[n.id] || []).length > 0 ? (
                      <div className={styles.starterWrap}>
                        <div className={styles.starterLabel}>starters — tap to add</div>
                        <div className={styles.starterChips}>
                          {STARTERS[n.id].map(t => (
                            <button key={t} className={styles.starterChip} onClick={() => addPractice(n.id, t)}>+ {t}</button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.empty}>no practices yet.</div>
                    )
                  )}
                  {pool.map(p => {
                    const takenTimes = native && !editMode && pickerOpenFor === p.id
                      ? getTakenTimes(p.id)
                      : []
                    const isAtCap = native && activeReminderCount >= 3 && !p.reminder_on
                    const hasPermError = native && permissionErrors.has(p.id)
                    return (
                      <div key={p.id || p.label} className={styles.poolItem}>
                        {editMode && editingId === p.id ? (
                          <div className={styles.poolRow}>
                            <input
                              className={styles.renameInput}
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCommitRename(p.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                            />
                            <button className={styles.saveBtn} onClick={() => handleCommitRename(p.id)}>save</button>
                          </div>
                        ) : (
                          <>
                            <div className={styles.poolRow}>
                              <span
                                className={styles.poolText}
                                onClick={editMode && p.id ? () => handleStartRename(p) : undefined}
                                style={editMode && p.id ? { cursor: 'text' } : undefined}
                              >{p.label}</span>

                              {editMode ? (
                                <button
                                  className={styles.archiveBtn}
                                  aria-label="archive — stops appearing, history kept"
                                  onClick={() => archivePractice(p.id)}
                                >archive</button>

                              ) : native ? (
                                /* ── Reminder affordance (native only) ── */
                                <div className={styles.reminderControl}>
                                  {hasPermError ? (
                                    <span className={styles.reminderError}>enable in ios settings</span>
                                  ) : p.reminder_on ? (
                                    <>
                                      <input
                                        type="time"
                                        className={styles.reminderTimeInput}
                                        value={pickerOpenFor === p.id && draftTimes[p.id] !== undefined
                                          ? draftTimes[p.id]
                                          : (p.reminder_time || '08:00')}
                                        onFocus={() => setPickerOpenFor(p.id)}
                                        onChange={e => setDraftTimes(prev => ({ ...prev, [p.id]: e.target.value }))}
                                        onBlur={() => { handleCommitTime(p.id); setPickerOpenFor(null) }}
                                        onClick={e => e.stopPropagation()}
                                      />
                                      <button
                                        className={styles.rToggleBtn}
                                        onClick={() => handleToggleReminder(p)}
                                        aria-label="turn off reminder"
                                      >
                                        <div className={`${styles.rTrack} ${styles.rTrackOn}`}>
                                          <span className={`${styles.rKnob} ${styles.rKnobOn}`} />
                                        </div>
                                      </button>
                                    </>
                                  ) : isAtCap ? (
                                    <span className={styles.reminderCapped}>3 reminders is the maximum</span>
                                  ) : p.id === offerPracticeId ? null : (
                                    <button
                                      className={styles.reminderOffBtn}
                                      onClick={() => handleToggleReminder(p)}
                                    >remind me</button>
                                  )}
                                </div>

                              ) : (
                                <span className={styles.lastDone}>{formatLastDone(lastDoneByKey.get(p.id || `${n.id}_${p.label}`))}</span>
                              )}
                            </div>

                            {/* Taken times — shown while this practice's picker is focused */}
                            {takenTimes.length > 0 && (
                              <div className={styles.reminderTaken}>
                                <span className={styles.reminderTakenHead}>taken · </span>
                                {takenTimes.map((t, i) => (
                                  <span key={t.time + t.label} className={styles.reminderTakenItem}>
                                    {i > 0 ? ' · ' : ''}{t.time} {t.label}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Once-only reminder offer — appears below the row */}
                            {!editMode && p.id === offerPracticeId && (
                              <div className={styles.offerRow}>
                                <span className={styles.offerCopy}>remind me about this?</span>
                                <button className={styles.offerSetTime} onClick={() => handleAcceptOffer(p)}>set a time</button>
                                <button className={styles.offerNotNow} onClick={() => handleDeclineOffer(p)}>not now</button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {atMax ? (
                  <div className={styles.maxNote}>max {MAX} practices reached.</div>
                ) : showInput ? (
                  <div className={styles.addRow}>
                    <input
                      className={styles.addInput}
                      placeholder="new practice…"
                      value={inputs[n.id] || ''}
                      onChange={e => setInputs(prev => ({ ...prev, [n.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAdd(n.id)}
                      autoFocus
                    />
                    <button
                      className={styles.addBtn}
                      onClick={() => handleAdd(n.id)}
                      disabled={!(inputs[n.id] || '').trim()}
                    >
                      add
                    </button>
                  </div>
                ) : (
                  <button className={styles.addToggle} onClick={() => setOpenInputs(prev => ({ ...prev, [n.id]: true }))}>+ add practice</button>
                )}
              </div>
            )
          })
        })}
      </div>

      {showOnboardingCta && (
        <div className={styles.obFooter}>
          <button className={styles.obBtn} onClick={handleOnboardingDone}>
            {totalPractices === 0 ? "i'm done adding practices →" : 'start my day →'}
          </button>
        </div>
      )}
    </div>
  )
}
