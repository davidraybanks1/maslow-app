import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODE_ORDER, MODES } from '../lib/constants'
import { createDataStats, formatLastDone } from '../lib/dataStats'
import styles from './CanvasScreen.module.css'

// Capacity: how many needs each mode can hold
const MODE_NEED_CAP = { exploration: 1, appreciation: 2, nourishment: 3, survival: 4 }

const MODE_DESCS = {
  exploration:  'the one need that feels like a passion',
  appreciation: 'needs that bring enjoyment to your life',
  nourishment:  'needs that keep you from feeling drained',
  survival:     'needs you just check the box on',
}

const MODE_ABBR = { exploration: 'explr', appreciation: 'apprc', nourishment: 'nrsh', survival: 'srvl' }

// Modes with a light fill — use dark text when selected
const LIGHT_FILL_MODES = new Set(['appreciation', 'nourishment'])

const GUIDE_KEY = 'maslow_canvas_guide_seen'

export default function CanvasScreen({ state, updateCanvas, addPractice, renamePractice, archivePractice }) {
  const navigate = useNavigate()
  const [guideOpen, setGuideOpen] = useState(() => {
    try { return !localStorage.getItem(GUIDE_KEY) } catch { return true }
  })

  // Stage 2/3 state
  const [openNeed, setOpenNeed]           = useState(null)
  const [practiceMenu, setPracticeMenu]   = useState(null)   // practice id
  const [practiceDraft, setPracticeDraft] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)   // practice id

  // For Stage 5 scroll-to-mode behavior
  const modeRefs = useRef({})

  useEffect(() => {
    if (guideOpen) {
      try { localStorage.setItem(GUIDE_KEY, '1') } catch {}
    }
  }, [])

  const useDB = Array.isArray(state.practicesDB) && state.practicesDB.length > 0

  function needsInMode(mode) {
    return NEEDS.filter(n => state.canvas[n.id] === mode)
  }

  function getPractices(needId) {
    if (useDB) return state.practicesDB.filter(p => p.need_id === needId && !p.archived_at)
    return (state.practices[needId] || []).map((label, i) => ({ id: `${needId}_${i}`, label, need_id: needId, archived_at: null }))
  }

  // Build lastDoneMap keyed by practice id (DB) or "needId:label" (legacy)
  const statsObj = createDataStats(state)
  const practiceStatsList = statsObj?.getPracticeStats ? statsObj.getPracticeStats(30) : []
  const lastDoneMap = {}
  for (const ps of practiceStatsList) {
    if (ps.practice.id != null) {
      lastDoneMap[ps.practice.id] = ps.daysSinceLast
    } else {
      lastDoneMap[`${ps.need.id}:${ps.text}`] = ps.daysSinceLast
    }
  }

  function getLast(practice) {
    if (practice.id != null && practice.id in lastDoneMap) return lastDoneMap[practice.id]
    const legacyKey = `${practice.need_id}:${practice.label}`
    if (legacyKey in lastDoneMap) return lastDoneMap[legacyKey]
    return null
  }

  // Derived counts
  const needCount     = NEEDS.filter(n => state.canvas[n.id]).length
  const practiceCount = NEEDS.reduce((sum, n) => sum + getPractices(n.id).length, 0)
  const totalCap      = Object.values(MODE_NEED_CAP).reduce((a, b) => a + b, 0) // 10
  const openSlots     = totalCap - needCount
  const openSlotPhrase = openSlots === 0
    ? 'every mode at capacity'
    : openSlots === 1
      ? '1 open slot'
      : `${openSlots} open slots`

  function toggleNeed(needId) {
    const isOpening = openNeed !== needId
    setOpenNeed(isOpening ? needId : null)
    setPracticeMenu(null)
    setPracticeDraft('')
    setDeleteConfirm(null)
  }

  function openMenuFor(practiceId, label) {
    setPracticeMenu(practiceId)
    setPracticeDraft(label)
    setDeleteConfirm(null)
  }

  function closeMenu() {
    setPracticeMenu(null)
    setPracticeDraft('')
    setDeleteConfirm(null)
  }

  function handleSave(practiceId) {
    renamePractice(practiceId, practiceDraft)
    closeMenu()
  }

  function handleArchive(practiceId) {
    archivePractice(practiceId)
    closeMenu()
  }

  function handleAddPractice(needId) {
    const label = window.prompt('Name this practice:')
    if (label && label.trim()) addPractice(needId, label.trim())
  }

  function practiceCountLabel(count) {
    if (count === 0) return 'no practices'
    if (count === 1) return '1 practice'
    return `${count} practices`
  }

  function circleStyle(days, tierColor) {
    if (days === null) return { borderColor: 'rgba(0,0,0,.18)', background: 'transparent' }
    if (days === 0 || days === 1) return { borderColor: tierColor, background: tierColor }
    return { borderColor: tierColor, background: 'transparent' }
  }

  return (
    <div className={styles.screen}>
      {/* ── Static header ── */}
      <div className={styles.staticHeader}>
        <div className={styles.appBar}>
          <span className={styles.wordmark}>m</span>
          <button
            className={`${styles.guidePill} ${guideOpen ? styles.guidePillActive : ''}`}
            onClick={() => setGuideOpen(o => !o)}
          >
            {guideOpen ? 'hide guide' : 'what is this?'}
          </button>
        </div>

        {guideOpen && (
          <div className={styles.guideCard}>
            <div className={styles.guideTerm}>
              <span className={styles.guideTermLabel}>needs</span>
              <span className={styles.guideTermDef}>the parts of life that give you energy.</span>
            </div>
            <div className={styles.guideTerm}>
              <span className={styles.guideTermLabel}>modes</span>
              <span className={styles.guideTermDef}>the emphasis a need warrants for you right now — from just checking the box to real passion.</span>
            </div>
            <div className={styles.guideTerm}>
              <span className={styles.guideTermLabel}>practices</span>
              <span className={styles.guideTermDef}>the daily acts that meet a need.</span>
            </div>
          </div>
        )}

        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>your canvas.</h1>
          <p className={styles.pageSubhead}>
            {needCount} {needCount === 1 ? 'need' : 'needs'} placed · {practiceCount} {practiceCount === 1 ? 'practice' : 'practices'} · {openSlotPhrase}
          </p>
        </div>

        <div className={styles.headerHairline} />
      </div>

      {/* ── Scroll area — mode cards ── */}
      <div className={styles.scrollArea}>
        {MODE_ORDER.map(mode => {
          const tierColor = MODES[mode].color
          const placed    = needsInMode(mode)
          const cap       = MODE_NEED_CAP[mode]
          const full      = placed.length >= cap

          return (
            <div
              key={mode}
              ref={el => { modeRefs.current[mode] = el }}
              className={styles.modeCard}
            >
              {/* Header row */}
              <div className={styles.modeHeader}>
                <span className={styles.modeDot} style={{ background: tierColor }} />
                <span className={styles.modeName}>{mode}</span>
                <span className={styles.modeCount}>{placed.length} of {cap}</span>
              </div>

              {/* Blurb */}
              <p className={styles.modeBlurb}>{MODE_DESCS[mode]}</p>

              {/* Capacity bar */}
              <div className={styles.capacityTrack}>
                <div
                  className={styles.capacityFill}
                  style={{
                    width: cap > 0 ? `${(placed.length / cap) * 100}%` : '0%',
                    background: tierColor,
                  }}
                />
              </div>

              {/* Need rows */}
              {placed.map(need => {
                const practices = getPractices(need.id)
                const isOpen    = openNeed === need.id

                return (
                  <div key={need.id} className={styles.needBlock}>
                    <button className={styles.needRow} onClick={() => toggleNeed(need.id)}>
                      <span className={styles.needName}>{need.name}</span>
                      <span className={styles.practiceCount}>{practiceCountLabel(practices.length)}</span>
                      <span className={styles.needChevron}>{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div className={styles.needDetail}>
                        {/* Section label */}
                        <div className={styles.sectionLabel}>HOW IT SHOWS UP IN YOUR DAY</div>

                        {/* Practice rows */}
                        {practices.map(practice => {
                          const days       = getLast(practice)
                          const isMenuOpen = practiceMenu === practice.id

                          if (isMenuOpen) {
                            return (
                              <div key={practice.id} className={styles.practiceEditor}>
                                <input
                                  className={styles.renameField}
                                  value={practiceDraft}
                                  onChange={e => setPracticeDraft(e.target.value)}
                                  autoFocus
                                />
                                <div className={styles.editorActions}>
                                  <button className={styles.saveBtn} onClick={() => handleSave(practice.id)}>
                                    save
                                  </button>
                                  <button className={styles.cancelBtn} onClick={closeMenu}>
                                    cancel
                                  </button>
                                  <button
                                    className={`${styles.removeBtn}${deleteConfirm === practice.id ? ` ${styles.removeBtnConfirm}` : ''}`}
                                    onClick={() => {
                                      if (deleteConfirm === practice.id) {
                                        handleArchive(practice.id)
                                      } else {
                                        setDeleteConfirm(practice.id)
                                      }
                                    }}
                                  >
                                    {deleteConfirm === practice.id ? 'confirm remove' : 'remove'}
                                  </button>
                                </div>
                                {deleteConfirm === practice.id && (
                                  <p className={styles.removeWarning}>
                                    this removes {practice.label} and its history. tap remove again to confirm.
                                  </p>
                                )}
                              </div>
                            )
                          }

                          return (
                            <div key={practice.id} className={styles.practiceRow}>
                              <span className={styles.practiceCircle} style={circleStyle(days, tierColor)} />
                              <span className={styles.practiceName}>{practice.label}</span>
                              <span className={styles.practiceMeta}>{formatLastDone(days)}</span>
                              <button
                                className={styles.menuBtn}
                                onClick={() => openMenuFor(practice.id, practice.label)}
                              >
                                ⋯
                              </button>
                            </div>
                          )
                        })}

                        {/* Add a practice */}
                        <button
                          className={styles.addPracticeBtn}
                          onClick={() => handleAddPractice(need.id)}
                        >
                          <span className={styles.addPracticePlus}>+</span>
                          <span className={styles.addPracticeLabel}>add a practice</span>
                        </button>

                        {/* Mode selector */}
                        <div className={styles.modeSelectorSection}>
                          <div className={styles.sectionLabel}>MODE</div>
                          <div className={styles.modeSelectorRow}>
                            {MODE_ORDER.map(m => {
                              const mc        = MODES[m].color
                              const isCurrent = state.canvas[need.id] === m
                              const mPlaced   = needsInMode(m).length
                              const mCap      = MODE_NEED_CAP[m]
                              const mFull     = !isCurrent && mPlaced >= mCap
                              const isLight   = LIGHT_FILL_MODES.has(m)

                              const btnStyle = isCurrent
                                ? { background: mc, borderColor: mc }
                                : mFull ? { opacity: 0.4 } : {}

                              const dotColor = isCurrent
                                ? (isLight ? 'rgba(0,0,0,.4)' : 'rgba(252,250,244,.9)')
                                : mc

                              const labelColor = isCurrent
                                ? (isLight ? 'rgba(0,0,0,.8)' : 'rgba(252,250,244,.9)')
                                : 'rgba(0,0,0,.5)'

                              const hint = isCurrent ? 'here' : mFull ? 'full' : `${mPlaced}/${mCap}`
                              const hintColor = isCurrent
                                ? (isLight ? 'rgba(0,0,0,.5)' : 'rgba(252,250,244,.7)')
                                : 'rgba(0,0,0,.4)'

                              return (
                                <button
                                  key={m}
                                  className={styles.modeSelectorBtn}
                                  style={btnStyle}
                                  disabled={mFull}
                                  onClick={() => { if (!isCurrent && !mFull) updateCanvas(need.id, m) }}
                                >
                                  <span className={styles.modeSelectorDot} style={{ background: dotColor }} />
                                  <span className={styles.modeSelectorAbbr} style={{ color: labelColor }}>{MODE_ABBR[m]}</span>
                                  <span className={styles.modeSelectorHint} style={{ color: hintColor }}>{hint}</span>
                                </button>
                              )
                            })}
                          </div>
                          <p className={styles.modeSelectorNote}>
                            moving a need keeps every practice and all of its history.
                          </p>
                        </div>

                        {/* Remove from canvas */}
                        <div className={styles.removeSection}>
                          <button
                            className={styles.removeFromCanvasBtn}
                            onClick={() => updateCanvas(need.id, null)}
                          >
                            remove from canvas
                          </button>
                          <p className={styles.removeFromCanvasNote}>
                            practices and history are kept — you can place it again anytime.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Mode footer */}
              <div className={styles.modeFooter}>
                {full ? (
                  <>
                    <span className={styles.atCapacityLabel}>at capacity</span>
                    <button className={styles.swapNeedBtn} style={{ color: tierColor }}>
                      swap a need →
                    </button>
                  </>
                ) : (
                  <button className={styles.addNeedRow}>
                    <span className={styles.addNeedPlus} style={{ color: tierColor }}>+</span>
                    <span className={styles.addNeedLabel}>add a need to {mode}</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
