import { useState } from 'react'
import { NEEDS, LAYERS, LAYER_ORDER } from '../lib/constants'
import { todayKey } from '../lib/store'
import { createDataStats } from '../lib/dataStats'
import styles from './CanvasScreen.module.css'

const RESTRICTED_MODES_FOR_REST = ['purpose', 'appreciation']

export default function CanvasScreen({ state, updateCanvas }) {
  const [selected, setSelected] = useState(null)
  const [editMode, setEditMode] = useState(false)

  const stats = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods: state.moods, practices: state.practices })
  const today = todayKey()

  function handleSelect(needId) {
    setSelected(selected === needId ? null : needId)
  }

  function handleSlot(mode) {
    if (!selected) return
    if (selected === 'rest' && RESTRICTED_MODES_FOR_REST.includes(mode)) return
    const lyr = LAYERS[mode]
    const currentInMode = NEEDS.filter(n => state.canvas[n.id] === mode)
    if (currentInMode.length >= lyr.slots) return
    updateCanvas(selected, mode)
    setSelected(null)
  }

  function handleRemove(needId, e) {
    e.stopPropagation()
    updateCanvas(needId, null)
    setSelected(null)
  }

  const unassigned = NEEDS.filter(n => !state.canvas[n.id])
  const allAssigned = unassigned.length === 0

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrowRow}>
          <div className={styles.eyebrow}>your canvas</div>
          <button className={styles.editToggle} onClick={() => setEditMode(e => !e)}>{editMode ? 'done' : 'edit'}</button>
        </div>
        <div className={styles.title}>{allAssigned ? 'your canvas' : 'assign your needs'}</div>
        <div className={styles.sub}>
          {selected
            ? `tap a slot to assign ${NEEDS.find(n => n.id === selected)?.name}`
            : allAssigned ? 'tap any need to reassign.' : 'tap a need, then tap a slot.'}
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
                    && !(selected === 'rest' && RESTRICTED_MODES_FOR_REST.includes(mode))
                  if (need) {
                    const isMet = stats.isNeedMet(need, today)
                    return (
                      <div
                        key={i}
                        className={`${styles.slotFilled} ${selected === need.id ? styles.slotSelected : ''}`}
                        style={{ width: sw }}
                        onClick={() => handleSelect(need.id)}
                      >
                        {mode !== 'survival' && (
                          <span
                            className={styles.statePip}
                            style={isMet ? { background: lyr.pip, borderColor: lyr.pip } : { borderColor: lyr.pip }}
                          />
                        )}
                        <span className={styles.slotName}>{need.name}</span>
                        {editMode && (
                          <span className={styles.slotX} onClick={e => handleRemove(need.id, e)}>×</span>
                        )}
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
              onClick={() => handleSelect(n.id)}
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
