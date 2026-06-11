import { useState } from 'react'
import { NEEDS, LAYERS, LAYER_ORDER } from '../lib/constants'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import styles from './Practices.module.css'

const MAX = 10

export default function Practices({ state, addPractice, removePractice }) {
  const [inputs, setInputs] = useState({})
  const [openInputs, setOpenInputs] = useState({})
  const [editMode, setEditMode] = useState(false)

  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods: state.moods, practices: state.practices })
  const lastDoneByKey = new Map(stats.getPracticeStats().map(p => [`${p.need.id}_${p.text}`, p.daysSinceLast]))

  function handleAdd(needId) {
    const text = (inputs[needId] || '').trim()
    if (!text) return
    addPractice(needId, text)
    setInputs(prev => ({ ...prev, [needId]: '' }))
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrowRow}>
          <div className={styles.eyebrow}>your practices</div>
          <button className={styles.editToggle} onClick={() => setEditMode(e => !e)}>{editMode ? 'done' : 'edit'}</button>
        </div>
        <div className={styles.title}>build your library</div>
        <div className={styles.sub}>Each day you pick from your library. Up to 10 per need.</div>
      </div>
      <div className={styles.list}>
        {LAYER_ORDER.filter(m => LAYERS[m].bubbles > 0).map(mode => {
          const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
          if (!modeNeeds.length) return null
          const lyr = LAYERS[mode]
          return modeNeeds.map(n => {
            const pool = state.practices[n.id] || []
            const atMax = pool.length >= MAX
            const showInput = !atMax && openInputs[n.id]
            return (
              <div key={n.id} className={styles.needGroup}>
                <div className={styles.needHeader}>
                  <div className={styles.needPip} style={{ background: lyr.pip }} />
                  <div className={styles.needName}>{n.name}</div>
                  <div className={styles.needTag}>{pool.length}/{MAX}</div>
                </div>

                <div className={styles.pool}>
                  {pool.length === 0 && (
                    <div className={styles.empty}>No practices yet.</div>
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
                  <div className={styles.maxNote}>Max {MAX} practices reached.</div>
                ) : showInput ? (
                  <div className={styles.addRow}>
                    <input
                      className={styles.addInput}
                      placeholder="New practice…"
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
                      Add
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
    </div>
  )
}
