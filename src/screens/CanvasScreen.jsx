import { useState } from 'react'
import { NEEDS, LAYERS, LAYER_ORDER } from '../lib/constants'
import styles from './CanvasScreen.module.css'

export default function CanvasScreen({ state, updateCanvas }) {
  const [selected, setSelected] = useState(null)

  function handleChip(needId) {
    setSelected(selected === needId ? null : needId)
  }

  function handleSlot(mode) {
    if (!selected) return
    const lyr = LAYERS[mode]
    const currentInMode = NEEDS.filter(n => state.canvas[n.id] === mode)
    if (currentInMode.length >= lyr.slots) return
    updateCanvas(selected, mode)
    setSelected(null)
  }

  function handleRemove(needId) {
    updateCanvas(needId, null)
    setSelected(null)
  }

  const unassigned = NEEDS.filter(n => !state.canvas[n.id] || state.canvas[n.id] === null)

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>your canvas</div>
        <div className={styles.title}>assign your needs</div>
        <div className={styles.sub}>
          {selected ? `Tap a slot to assign ${NEEDS.find(n => n.id === selected)?.name}` : 'Tap a need, then tap a slot.'}
        </div>
      </div>
      <div className={styles.scroll}>
        {LAYER_ORDER.map(mode => {
          const lyr = LAYERS[mode]
          const assigned = NEEDS.filter(n => state.canvas[n.id] === mode)
          const sw = lyr.slots === 1 ? '100%' : lyr.slots === 2 ? 'calc(50% - 3px)' : 'calc(33.3% - 4px)'
          return (
            <div key={mode} className={styles.modeSection}>
              <div className={styles.modeHead}>
                <div className={styles.modeLabel}>
                  <div className={styles.pip} style={{ background: lyr.pip }} />
                  {mode}
                </div>
                <div className={styles.modeCount}>{assigned.length}/{lyr.slots}</div>
              </div>
              <div className={styles.slots}>
                {Array.from({ length: lyr.slots }).map((_, i) => {
                  const need = assigned[i]
                  const canAccept = selected && assigned.length < lyr.slots
                  if (need) {
                    return (
                      <div key={i} className={styles.slotFilled} style={{ width: sw }} onClick={() => handleRemove(need.id)}>
                        <span className={styles.slotName}>{need.name}</span>
                        <span className={styles.slotX}>×</span>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={i}
                      className={`${styles.slotEmpty} ${canAccept ? styles.slotHighlight : ''}`}
                      style={{ width: sw }}
                      onClick={() => handleSlot(mode)}
                    >
                      {canAccept ? 'tap to assign' : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className={styles.lotDivider} />
        <div className={styles.lotLabel}>unassigned</div>
        <div className={styles.chips}>
          {unassigned.map(n => (
            <div
              key={n.id}
              className={`${styles.chip} ${selected === n.id ? styles.chipSelected : ''}`}
              onClick={() => handleChip(n.id)}
            >
              {n.name}
            </div>
          ))}
          {unassigned.length === 0 && (
            <div className={styles.allAssigned}>all needs assigned ✓</div>
          )}
        </div>
      </div>
    </div>
  )
}