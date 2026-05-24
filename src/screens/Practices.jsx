import { useState } from 'react'
import { NEEDS, LAYERS, LAYER_ORDER } from '../lib/constants'
import styles from './Practices.module.css'

export default function Practices({ state, setPractice }) {
  const [saved, setSaved] = useState({})

  function handleChange(needId, index, value) {
    setPractice(needId, index, value)
    const key = `${needId}_${index}`
    setSaved(prev => ({ ...prev, [key]: false }))
  }

  function handleBlur(needId, index) {
    const key = `${needId}_${index}`
    setSaved(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 1500)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>your practices</div>
        <div className={styles.title}>what will you do?</div>
        <div className={styles.sub}>Practices align to your modes.</div>
      </div>
      <div className={styles.list}>
        {LAYER_ORDER.filter(m => LAYERS[m].bubbles > 0).map(mode => {
          const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
          if (!modeNeeds.length) return null
          const lyr = LAYERS[mode]
          return modeNeeds.map(n => {
            const count = lyr.bubbles
            const current = state.practices[n.id] || []
            return (
              <div key={n.id} className={styles.needGroup}>
                <div className={styles.needHeader}>
                  <div className={styles.needPip} style={{ background: lyr.pip }} />
                  <div className={styles.needName}>{n.name}</div>
                  <div className={styles.needTag}>{mode} · {count} practice{count > 1 ? 's' : ''}</div>
                </div>
                <div className={styles.inputs}>
                  {Array.from({ length: count }).map((_, i) => {
                    const key = `${n.id}_${i}`
                    return (
                      <div key={i} className={styles.inputRow}>
                        <input
                          className={styles.input}
                          placeholder={`practice ${i + 1}…`}
                          value={current[i] || ''}
                          onChange={e => handleChange(n.id, i, e.target.value)}
                          onBlur={() => handleBlur(n.id, i)}
                        />
                        {saved[key] && <span className={styles.savedMark}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}