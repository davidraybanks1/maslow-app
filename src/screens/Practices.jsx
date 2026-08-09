import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODES, MODE_ORDER } from '../lib/constants'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import styles from './Practices.module.css'

const MAX = 10

// Starter practices — one tap to add, so an empty list is never a dead end.
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

export default function Practices({ state, addPractice, renamePractice, archivePractice, completeOnboarding }) {
  const navigate = useNavigate()
  const [inputs, setInputs] = useState({})
  const [openInputs, setOpenInputs] = useState({})
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [obDone, setObDone] = useState(() => !!localStorage.getItem(OB_FLAG))

  const useDB = Array.isArray(state.practicesDB) && state.practicesDB.length > 0
  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods: state.moods, practices: state.practices, practicesDB: state.practicesDB })
  const lastDoneByKey = new Map(stats.getPracticeStats().map(p => [p.practice?.id || `${p.need.id}_${p.text}`, p.daysSinceLast]))

  const totalPractices = useDB
    ? state.practicesDB.filter(p => !p.archived_at).length
    : Object.values(state.practices || {}).flat().length
  const showOnboardingCta = !obDone

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
                  {pool.map(p => (
                    <div key={p.id || p.label} className={styles.poolItem}>
                      {editMode && editingId === p.id ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <span
                            className={styles.poolText}
                            onClick={editMode && p.id ? () => handleStartRename(p) : undefined}
                            style={editMode && p.id ? { cursor: 'text' } : undefined}
                          >{p.label}</span>
                          {editMode ? (
                            <button className={styles.deleteBtn} onClick={() => archivePractice(p.id)}>×</button>
                          ) : (
                            <span className={styles.lastDone}>{formatLastDone(lastDoneByKey.get(p.id || `${n.id}_${p.label}`))}</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
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
