import { useState, useRef, useEffect } from 'react'
import styles from './CanvasScreen.module.css'

const UNIVERSAL_IDS = new Set(['movement', 'nutrition', 'rest'])

const BUILT_IN_NEEDS = [
  { id: 'movement',    name: 'movement' },
  { id: 'nutrition',   name: 'nutrition' },
  { id: 'rest',        name: 'rest' },
  { id: 'community',   name: 'community' },
  { id: 'beauty',      name: 'beauty' },
  { id: 'intimacy',    name: 'intimacy' },
  { id: 'reflection',  name: 'reflection' },
  { id: 'play',        name: 'play' },
  { id: 'money',       name: 'money' },
  { id: 'dwelling',    name: 'dwelling' },
  { id: 'information', name: 'information' },
  { id: 'touch',       name: 'touch' },
  { id: 'thrill',      name: 'thrill' },
]

const MODES = ['exploration', 'appreciation', 'nourishment', 'survival']
const MODE_MAX = { exploration: 1, appreciation: 2, nourishment: 4, survival: 4 }

const MODE_COLORS = {
  exploration:  '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment:  '#E8B81F',
  survival:     '#D93B1C',
}

const MODE_PILL_STYLE = {
  exploration:  { background: 'rgba(27,58,45,0.1)',    color: '#1B3A2D' },
  appreciation: { background: 'rgba(184,195,177,0.3)', color: '#4a5e45' },
  nourishment:  { background: 'rgba(232,184,31,0.12)', color: '#854F0B' },
  survival:     { background: 'rgba(217,59,28,0.08)',  color: '#993C1D' },
}

const VALID_MODES = new Set(MODES)

function initCanvas(stored) {
  const c = {}
  for (const n of BUILT_IN_NEEDS) {
    const m = stored[n.id]
    c[n.id] = VALID_MODES.has(m) ? m : null
  }
  return c
}

export default function CanvasScreen({ state, updateCanvas }) {
  const [canvas, setCanvas] = useState(() => initCanvas(state.canvas))
  const [customNeeds, setCustomNeeds] = useState([])
  const [customInput, setCustomInput] = useState('')
  const [openPicker, setOpenPicker] = useState(null)
  // openPicker: { type: 'change', needId } | { type: 'add', mode } | { type: 'pool', needId } | null
  const [pickerError, setPickerError] = useState(null)
  const [removeError, setRemoveError] = useState(null) // { needId, message }
  const errorTimer = useRef(null)
  const removeTimer = useRef(null)

  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current)
    if (removeTimer.current) clearTimeout(removeTimer.current)
  }, [])

  const allNeeds = [...BUILT_IN_NEEDS, ...customNeeds]
  const explorationCount = allNeeds.filter(n => canvas[n.id] === 'exploration').length
  const canSave = explorationCount === 1

  function inMode(mode) {
    return allNeeds.filter(n => canvas[n.id] === mode)
  }

  function pool() {
    return allNeeds.filter(n => !canvas[n.id])
  }

  function showPickerError(msg) {
    if (errorTimer.current) clearTimeout(errorTimer.current)
    setPickerError(msg)
    errorTimer.current = setTimeout(() => setPickerError(null), 3000)
  }

  function showRemoveError(needId, msg) {
    if (removeTimer.current) clearTimeout(removeTimer.current)
    setRemoveError({ needId, message: msg })
    removeTimer.current = setTimeout(() => setRemoveError(null), 3000)
  }

  function closePicker() {
    setOpenPicker(null)
    setPickerError(null)
    if (errorTimer.current) { clearTimeout(errorTimer.current); errorTimer.current = null }
  }

  function openNewPicker(picker) {
    closePicker()
    setOpenPicker(picker)
  }

  function tryAssign(needId, mode) {
    if (needId === 'rest' && (mode === 'exploration' || mode === 'appreciation')) {
      showPickerError('rest cannot be set above nourishment.')
      return false
    }
    const countInMode = allNeeds.filter(n => n.id !== needId && canvas[n.id] === mode).length
    if (countInMode >= MODE_MAX[mode]) {
      const maxLabel = { exploration: 'max 1', appreciation: 'max 2', nourishment: 'max 4', survival: 'max 4' }
      showPickerError(`${mode} is full (${maxLabel[mode]}).`)
      return false
    }
    setCanvas(prev => ({ ...prev, [needId]: mode }))
    return true
  }

  function tryRemove(needId) {
    const expNeeds = allNeeds.filter(n => canvas[n.id] === 'exploration')
    if (expNeeds.length === 1 && expNeeds[0].id === needId) {
      showRemoveError(needId, 'move this need to another mode before removing it from exploration.')
      return
    }
    setCanvas(prev => ({ ...prev, [needId]: null }))
    closePicker()
  }

  function handleSave() {
    if (!canSave) return
    for (const need of allNeeds) {
      updateCanvas(need.id, canvas[need.id])
    }
  }

  function handleAddCustom() {
    const name = customInput.trim().toLowerCase()
    if (!name) return
    if (allNeeds.find(n => n.name.toLowerCase() === name)) { setCustomInput(''); return }
    const id = `custom_${Date.now()}`
    setCustomNeeds(prev => [...prev, { id, name }])
    setCanvas(prev => ({ ...prev, [id]: null }))
    setCustomInput('')
  }

  const poolNeeds = pool()

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>YOUR CANVAS</div>
        <div className={styles.title}>your canvas</div>
        <div className={styles.sub}>assign each need a mode. one exploration, up to two appreciation, four nourishment, four survival.</div>
      </div>

      <div className={styles.scroll}>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          style={!canSave ? { opacity: 0.35, pointerEvents: 'none' } : {}}
        >
          save canvas
        </button>
        {!canSave && (
          <div className={styles.saveNote}>add a need to exploration mode to save your canvas.</div>
        )}

        {MODES.map(mode => {
          const needsInMode = inMode(mode)
          const isAddOpen = openPicker?.type === 'add' && openPicker.mode === mode
          const poolEmpty = poolNeeds.length === 0

          return (
            <div key={mode} className={styles.modeCard} style={{ borderLeft: `3px solid ${MODE_COLORS[mode]}` }}>
              <div className={styles.modeCardHead}>
                <div className={styles.modeCardLabel}>
                  <span>{mode}</span>
                </div>
                <div className={styles.modeCount}>{needsInMode.length} of {MODE_MAX[mode]}</div>
              </div>

              {needsInMode.length === 0 && mode === 'exploration' && (
                <div className={styles.emptyNote}>add the one need you're most committed to exploring right now.</div>
              )}
              {needsInMode.length === 0 && mode === 'appreciation' && (
                <div className={styles.emptyNote}>you don't have any needs in appreciation mode. that's your choice. appreciation is about getting real joy from your day — being present for what you're meeting, not just checking it off. if you can't prioritize that right now, that's ok.</div>
              )}

              {needsInMode.map(need => {
                const isChangeOpen = openPicker?.type === 'change' && openPicker.needId === need.id
                const isUniversal = UNIVERSAL_IDS.has(need.id)
                const pickerModes = MODES.filter(m =>
                  m !== mode && !(need.id === 'rest' && (m === 'exploration' || m === 'appreciation'))
                )

                return (
                  <div key={need.id}>
                    <div className={styles.needRow}>
                      <span className={styles.needName}>{need.name}</span>
                      <div className={styles.needRowActions}>
                        <button
                          className={styles.changeModeBtn}
                          onClick={() => isChangeOpen ? closePicker() : openNewPicker({ type: 'change', needId: need.id })}
                        >
                          change mode
                        </button>
                        {!isUniversal && (
                          <button className={styles.removeBtn} onClick={() => tryRemove(need.id)}>×</button>
                        )}
                      </div>
                    </div>
                    {removeError?.needId === need.id && (
                      <div className={styles.removeError}>{removeError.message}</div>
                    )}
                    {isChangeOpen && (
                      <div className={styles.inlinePicker}>
                        <div className={styles.pickerDivider} />
                        <div className={styles.pickerPills}>
                          {pickerModes.map(m => (
                            <button
                              key={m}
                              className={styles.modePill}
                              style={MODE_PILL_STYLE[m]}
                              onClick={() => { if (tryAssign(need.id, m)) closePicker() }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        {pickerError && <div className={styles.pickerError}>{pickerError}</div>}
                      </div>
                    )}
                  </div>
                )
              })}

              <div
                className={`${styles.addRow} ${poolEmpty ? styles.addRowDisabled : ''}`}
                onClick={() => {
                  if (poolEmpty) return
                  isAddOpen ? closePicker() : openNewPicker({ type: 'add', mode })
                }}
              >
                + add a need to {mode}
              </div>

              {isAddOpen && (
                <div className={styles.addPoolSelector}>
                  <div className={styles.addPoolChips}>
                    {poolNeeds.map(n => {
                      const blocked = n.id === 'rest' && (mode === 'exploration' || mode === 'appreciation')
                      return (
                        <button
                          key={n.id}
                          className={styles.poolSelChip}
                          style={blocked ? { opacity: 0.35 } : {}}
                          onClick={() => {
                            if (blocked) { showPickerError('rest cannot be set above nourishment.'); return }
                            if (tryAssign(n.id, mode)) closePicker()
                          }}
                        >
                          {n.name}
                        </button>
                      )
                    })}
                  </div>
                  {pickerError && <div className={styles.pickerError}>{pickerError}</div>}
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned pool */}
        <div className={styles.poolSection}>
          <div className={styles.sectionEyebrow}>UNASSIGNED</div>
          {poolNeeds.length === 0 ? (
            <div className={styles.allAssigned}>all needs assigned</div>
          ) : (
            <div className={styles.poolChips}>
              {poolNeeds.map(need => {
                const isPoolPickerOpen = openPicker?.type === 'pool' && openPicker.needId === need.id
                const pickerModes = need.id === 'rest' ? ['nourishment', 'survival'] : MODES

                return (
                  <div key={need.id} className={styles.poolChipGroup}>
                    <div
                      className={`${styles.poolChip} ${isPoolPickerOpen ? styles.poolChipActive : ''}`}
                      onClick={() => isPoolPickerOpen ? closePicker() : openNewPicker({ type: 'pool', needId: need.id })}
                    >
                      {need.name}
                    </div>
                    {isPoolPickerOpen && (
                      <div className={styles.poolChipPicker}>
                        <div className={styles.pickerPills}>
                          {pickerModes.map(m => (
                            <button
                              key={m}
                              className={styles.modePill}
                              style={MODE_PILL_STYLE[m]}
                              onClick={() => { if (tryAssign(need.id, m)) closePicker() }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        {pickerError && <div className={styles.pickerError}>{pickerError}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className={styles.poolSub}>needs not yet on your canvas. tap one to place it.</div>
        </div>

        {/* Add your own */}
        <div className={styles.addOwnSection}>
          <div className={styles.sectionEyebrow}>ADD YOUR OWN</div>
          <div className={styles.addOwnRow}>
            <input
              className={styles.addOwnInput}
              placeholder="name a need…"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCustom() }}
            />
            <button className={styles.addOwnBtn} onClick={handleAddCustom}>add</button>
          </div>
        </div>
      </div>
    </div>
  )
}
