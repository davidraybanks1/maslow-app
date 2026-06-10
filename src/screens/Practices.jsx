import { useState } from 'react'
import { NEEDS, LAYERS, LAYER_ORDER } from '../lib/constants'
import styles from './Practices.module.css'

const MAX = 10

export default function Practices({ state, addPractice, removePractice }) {
  const [inputs, setInputs] = useState({})

  function handleAdd(needId) {
    const text = (inputs[needId] || '').trim()
    if (!text) return
    addPractice(needId, text)
    setInputs(prev => ({ ...prev, [needId]: '' }))
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>your practices</div>
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
                      <button className={styles.deleteBtn} onClick={() => removePractice(n.id, i)}>×</button>
                    </div>
                  ))}
                </div>

                {atMax ? (
                  <div className={styles.maxNote}>Max {MAX} practices reached.</div>
                ) : (
                  <div className={styles.addRow}>
                    <input
                      className={styles.addInput}
                      placeholder="New practice…"
                      value={inputs[n.id] || ''}
                      onChange={e => setInputs(prev => ({ ...prev, [n.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAdd(n.id)}
                    />
                    <button
                      className={styles.addBtn}
                      onClick={() => handleAdd(n.id)}
                      disabled={!(inputs[n.id] || '').trim()}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}
