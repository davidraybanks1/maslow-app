import { useState, useRef, useEffect } from 'react'
import { NEEDS, MODE_ORDER } from '../lib/constants'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import styles from './CanvasScreen.module.css'

const UNIVERSAL_IDS = new Set(['movement', 'nutrition', 'rest'])

const MODE_COLORS = {
  exploration:  '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment:  '#E8B81F',
  survival:     '#D93B1C',
}

const MODE_BAND_TEXT = {
  exploration:  '#F6EFE9',
  appreciation: '#1A1A1A',
  nourishment:  '#1A1A1A',
  survival:     '#FFFFFF',
}

const MODE_NEED_LIMIT = { exploration: 1, appreciation: 2, nourishment: 4, survival: 4 }

const MODE_CARD_DESCS = {
  exploration:  'the one need that feels like a passion',
  appreciation: 'needs that bring enjoyment to your life',
  nourishment:  'needs that keep you from feeling drained',
  survival:     'needs that you just check the box on',
}

const MODE_PILL_STYLE = {
  exploration:  { background: 'rgba(27,58,45,0.12)',    color: '#1B3A2D' },
  appreciation: { background: 'rgba(184,195,177,0.35)', color: '#4a5e45' },
  nourishment:  { background: 'rgba(232,184,31,0.15)',  color: '#854F0B' },
  survival:     { background: 'rgba(217,59,28,0.10)',   color: '#993C1D' },
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function CanvasScreen({ state, updateCanvas, addPractice, archivePractice }) {
  const [customNeeds, setCustomNeeds]         = useState([])
  const [customInput, setCustomInput]         = useState('')
  const [openLibPicker, setOpenLibPicker]     = useState(null) // needId
  const [openModeFooter, setOpenModeFooter]   = useState(null) // mode
  const [openDrawer, setOpenDrawer]           = useState(null) // needId
  const [addInputs, setAddInputs]             = useState({})   // {needId: string}
  const [addOpen, setAddOpen]                 = useState(new Set())
  const [pickerError, setPickerError]         = useState(null)
  const [writeError, setWriteError]           = useState(null)
  const errTimer = useRef(null)

  useEffect(() => () => { if (errTimer.current) clearTimeout(errTimer.current) }, [])

  const allNeeds  = [...NEEDS, ...customNeeds]
  const useDB     = Array.isArray(state.practicesDB) && state.practicesDB.length > 0

  const stats       = createDataStats({ canvas: state.canvas, checkins: state.checkins, moods: state.moods, practices: state.practices, practicesDB: state.practicesDB })
  const lastDoneMap = new Map(stats.getPracticeStats().map(p => [p.practice?.id || `${p.need.id}_${p.text}`, p.daysSinceLast]))

  const unassigned = allNeeds.filter(n => !state.canvas[n.id])

  function needsInMode(mode) { return allNeeds.filter(n => state.canvas[n.id] === mode) }

  function isModeFull(mode, excludeId = null) {
    return allNeeds.filter(n => n.id !== excludeId && state.canvas[n.id] === mode).length >= MODE_NEED_LIMIT[mode]
  }

  function getPractices(needId) {
    if (useDB) return state.practicesDB.filter(p => p.need_id === needId && !p.archived_at)
    return (state.practices[needId] || []).map(label => ({ id: null, label, need_id: needId, archived_at: null }))
  }

  function showErr(msg, setFn) {
    if (errTimer.current) clearTimeout(errTimer.current)
    setFn(msg)
    errTimer.current = setTimeout(() => setFn(null), 3500)
  }

  async function handlePlace(needId, mode) {
    if (needId === 'rest' && (mode === 'exploration' || mode === 'appreciation')) {
      showErr('rest cannot go above nourishment', setPickerError); return
    }
    if (isModeFull(mode)) {
      showErr(`${mode} is full`, setPickerError); return
    }
    try {
      await updateCanvas(needId, mode)
      setOpenLibPicker(null)
      setOpenModeFooter(null)
      setPickerError(null)
    } catch { showErr('save failed — try again', setWriteError) }
  }

  async function handleMove(needId, newMode) {
    if (state.canvas[needId] === newMode) return
    if (needId === 'rest' && (newMode === 'exploration' || newMode === 'appreciation')) return
    if (isModeFull(newMode, needId)) {
      showErr(`${newMode} is full`, setWriteError); return
    }
    try { await updateCanvas(needId, newMode) }
    catch { showErr('save failed — try again', setWriteError) }
  }

  async function handleRemove(needId) {
    if (UNIVERSAL_IDS.has(needId)) return
    try {
      await updateCanvas(needId, null)
      setOpenDrawer(null)
    } catch { showErr('save failed — try again', setWriteError) }
  }

  function handleAddCustom() {
    const name = customInput.trim().toLowerCase()
    if (!name || allNeeds.find(n => n.name.toLowerCase() === name)) { setCustomInput(''); return }
    const id = `custom_${name.replace(/\s+/g, '_')}_${Date.now()}`
    setCustomNeeds(prev => [...prev, { id, name }])
    setCustomInput('')
  }

  function handleAddPractice(needId) {
    const text = (addInputs[needId] || '').trim()
    if (!text) return
    addPractice(needId, text)
    setAddInputs(prev => ({ ...prev, [needId]: '' }))
    setAddOpen(prev => { const s = new Set(prev); s.delete(needId); return s })
  }

  function renderModeCard(mode) {
    const inMode     = needsInMode(mode)
    const cap        = MODE_NEED_LIMIT[mode]
    const atCap      = inMode.length >= cap
    const color      = MODE_COLORS[mode]
    const textColor  = MODE_BAND_TEXT[mode]
    const footerOpen = openModeFooter === mode

    return (
      <div key={mode} className={styles.modeCard} style={{ borderLeft: `3px solid ${color}` }}>
        {/* Header band */}
        <div className={styles.modeBand} style={{ background: color }}>
          <span className={styles.modeBandName} style={{ color: textColor }}>
            {mode.toUpperCase()}
          </span>
          <span className={styles.modeBandCount} style={{ color: textColor }}>
            {inMode.length} of {cap}
          </span>
        </div>

        <p className={styles.modeDesc}>{MODE_CARD_DESCS[mode]}</p>

        {/* Need rows */}
        {inMode.map(need => {
          const isOpen     = openDrawer === need.id
          const practices  = getPractices(need.id)
          const addIsOpen  = addOpen.has(need.id)
          const isUniversal = UNIVERSAL_IDS.has(need.id)
          const modePills  = need.id === 'rest' ? ['nourishment', 'survival'] : MODE_ORDER

          return (
            <div key={need.id} className={styles.needRow}>
              <button
                className={styles.needToggle}
                onClick={() => setOpenDrawer(isOpen ? null : need.id)}
              >
                <span className={styles.needToggleName}>{need.name}</span>
                <span className={styles.needPracticeCount}>
                  {practices.length} {practices.length === 1 ? 'practice' : 'practices'}
                </span>
                <ChevronIcon className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
              </button>

              {isOpen && (
                <div className={styles.needDrawer}>
                  <p className={styles.drawerHint}>how {need.name} shows up in your day:</p>

                  {practices.length === 0 && (
                    <p className={styles.drawerEmpty}>no practices yet</p>
                  )}

                  {practices.map(p => {
                    const key     = p.id || `${need.id}_${p.label}`
                    const days    = lastDoneMap.get(key) ?? null
                    return (
                      <div key={key} className={styles.practiceRow}>
                        <span className={styles.practiceLabel}>{p.label}</span>
                        <span
                          className={styles.practiceLastDone}
                          style={days === null ? { color: '#D93B1C' } : undefined}
                        >
                          {formatLastDone(days)}
                        </span>
                        <button
                          className={styles.practiceArchiveBtn}
                          onClick={() => p.id && archivePractice(p.id)}
                          aria-label="archive practice"
                        >✕</button>
                      </div>
                    )
                  })}

                  {/* Add practice */}
                  {addIsOpen ? (
                    <div className={styles.addPracticeRow}>
                      <input
                        className={styles.addPracticeInput}
                        placeholder="new practice…"
                        value={addInputs[need.id] || ''}
                        onChange={e => setAddInputs(prev => ({ ...prev, [need.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddPractice(need.id)
                          if (e.key === 'Escape') setAddOpen(prev => { const s = new Set(prev); s.delete(need.id); return s })
                        }}
                        autoFocus
                      />
                      <button
                        className={styles.addPracticeBtn}
                        onClick={() => handleAddPractice(need.id)}
                        disabled={!(addInputs[need.id] || '').trim()}
                      >add</button>
                    </div>
                  ) : (
                    <button
                      className={styles.addPracticeToggle}
                      onClick={() => setAddOpen(prev => new Set([...prev, need.id]))}
                    >+ add practice</button>
                  )}

                  {/* Mode selector */}
                  <div className={styles.modeSelector}>
                    <span className={styles.modeSelectorLabel}>this need lives in:</span>
                    <div className={styles.modeSelectorPills}>
                      {modePills.map(m => {
                        const isActive = m === state.canvas[need.id]
                        const full     = !isActive && isModeFull(m, need.id)
                        return (
                          <button
                            key={m}
                            className={`${styles.modeSelectorPill} ${isActive ? styles.modeSelectorPillActive : ''} ${full ? styles.modeSelectorPillFull : ''}`}
                            style={isActive ? { background: MODE_COLORS[m], color: MODE_BAND_TEXT[m], borderColor: MODE_COLORS[m] } : undefined}
                            disabled={full}
                            onClick={() => handleMove(need.id, m)}
                          >
                            {m}{full ? ' · full' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {!isUniversal && (
                    <button className={styles.removeFromCanvasBtn} onClick={() => handleRemove(need.id)}>
                      remove from canvas — practices &amp; history kept
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Mode footer */}
        <div className={styles.modeFooter}>
          {atCap ? (
            <span className={styles.modeFooterDisabled}>
              {mode === 'exploration' ? 'exploration is full' : `${mode} is full`}
            </span>
          ) : unassigned.length === 0 ? (
            <span className={styles.modeFooterDisabled}>+ add a need to {mode}</span>
          ) : footerOpen ? (
            <div>
              <div className={styles.footerPickerChips}>
                {unassigned.map(n => {
                  const blocked = n.id === 'rest' && (mode === 'exploration' || mode === 'appreciation')
                  return (
                    <button
                      key={n.id}
                      className={`${styles.footerPickerChip} ${blocked ? styles.footerPickerChipBlocked : ''}`}
                      onClick={() => { if (!blocked) handlePlace(n.id, mode) }}
                    >
                      {n.name}
                    </button>
                  )
                })}
              </div>
              {pickerError && <div className={styles.pickerError}>{pickerError}</div>}
              <button className={styles.footerPickerCancel} onClick={() => { setOpenModeFooter(null); setPickerError(null) }}>cancel</button>
            </div>
          ) : (
            <button
              className={styles.modeFooterAdd}
              onClick={() => { setOpenModeFooter(mode); setOpenLibPicker(null); setPickerError(null) }}
            >
              + add a need to {mode}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.scroll}>

        {/* Page header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>your canvas.</h1>
          <p className={styles.pageLede}>
            pick <strong>needs</strong> from the library. place each in a{' '}
            <strong>mode</strong>. set your daily <strong>practices</strong>.
          </p>
        </div>

        <div className={styles.topSection}>
          {/* How-it-works strip */}
          <div className={styles.howItWorks}>
            <div className={styles.howCol}>
              <span className={styles.howKey}>needs</span>
              <span className={styles.howVal}>the parts of life that give you energy</span>
            </div>
            <div className={styles.howDivider} />
            <div className={styles.howCol}>
              <span className={styles.howKey}>modes</span>
              <span className={styles.howVal}>the emphasis a need warrants for you</span>
            </div>
            <div className={styles.howDivider} />
            <div className={styles.howCol}>
              <span className={styles.howKey}>practices</span>
              <span className={styles.howVal}>the daily acts that meet your needs</span>
            </div>
          </div>

          {/* Need library */}
          <div className={styles.libraryCard}>
            <div className={styles.libraryHeader}>
              <span className={styles.libraryLabel}>NEED LIBRARY</span>
              <span className={styles.libraryHint}>select or create a need to add to your canvas</span>
            </div>

            {unassigned.length > 0 ? (
              <div className={styles.libraryChips}>
                {unassigned.map(need => {
                  const isOpen    = openLibPicker === need.id
                  const pickerModes = need.id === 'rest' ? ['nourishment', 'survival'] : MODE_ORDER
                  return (
                    <div key={need.id} className={styles.libraryChipGroup}>
                      <button
                        className={`${styles.libraryChip} ${isOpen ? styles.libraryChipOpen : ''}`}
                        onClick={() => {
                          setOpenLibPicker(isOpen ? null : need.id)
                          setOpenModeFooter(null)
                          setPickerError(null)
                        }}
                      >
                        {need.name}
                      </button>
                      {isOpen && (
                        <div className={styles.chipModePicker}>
                          <div className={styles.chipModePickerPills}>
                            {pickerModes.map(m => {
                              const full = isModeFull(m)
                              return (
                                <button
                                  key={m}
                                  className={`${styles.chipModePill} ${full ? styles.chipModePillDisabled : ''}`}
                                  style={!full ? MODE_PILL_STYLE[m] : undefined}
                                  disabled={full}
                                  onClick={() => handlePlace(need.id, m)}
                                >
                                  {m}{full ? ' · full' : ''}
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
              </div>
            ) : (
              <p className={styles.allAssigned}>all needs are on your canvas</p>
            )}

            <div className={styles.addNeedRow}>
              <input
                className={styles.addNeedInput}
                placeholder="create a custom need…"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCustom() }}
              />
              <button className={styles.addNeedBtn} onClick={handleAddCustom}>add</button>
            </div>
          </div>
        </div>

        {writeError && <div className={styles.writeError}>{writeError}</div>}

        {/* Mode cards — 2-col on desktop */}
        <div className={styles.modeGrid}>
          <div className={styles.modeCol}>
            {renderModeCard('exploration')}
            {renderModeCard('appreciation')}
          </div>
          <div className={styles.modeCol}>
            {renderModeCard('nourishment')}
            {renderModeCard('survival')}
          </div>
        </div>

      </div>
    </div>
  )
}
