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

export default function Practices({ state, addPractice, removePractice, completeOnboarding }) {
  const navigate = useNavigate()
  const [inputs, setInputs] = useState({})
  const [openInputs, setOpenInputs] = useState({})
  const [editMode, setEditMode] = useState(false)
  const [obDone, setObDone] = useState(() => !!localStorage.getItem(OB_FLAG))

  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods: state.moods, practices: state.practices })
  const lastDoneByKey = new Map(stats.getPracticeStats().map(p => [`${p.need.id}_${p.text}`, p.daysSinceLast]))

  const totalPractices = Object.values(state.practices || {}).flat().length
  const showOnboardingCta = !obDone

  function handleAdd(needId) {
    const text = (inputs[needId] || '').trim()
    if (!text) return
    addPractice(needId, text)
    setInputs(prev => ({ ...prev, [needId]: '' }))
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
          <button className={styles.editToggle} onClick={() => setEditMode(e => !e)}>{editMode ? 'done' : 'edit'}</button>
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
            const pool = state.practices[n.id] || []
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
                  {pool.map((p, i) => (
                    <div key={i} className={styles.poolItem}>
                      <span className={styles.poolText}>{p}</span>
                      {editMode ? (
                        <button className={styles.deleteBtn} onClick={() => removePractice(n.id, i)}>×</button>
                      ) : (
                        <span className={styles.lastDone}>{formatLastDone(lastDoneByKey.get(`${n.id}_${p}`))}</span>
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
