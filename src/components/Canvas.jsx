import { useState } from 'react'
import { NEEDS, LAYERS, LAYER_ORDER, computeProgress } from '../lib/constants'
import styles from './Canvas.module.css'

// Layout rules per mode
const MODE_LAYOUT = {
  play:         { cols: 12, height: 200 },
  appreciation: { cols: 6,  height: 130 },
  nourishment:  { cols: 6,  height: 90  },
  survival:     { cols: 4,  height: 52  },
}

// Total canvas width = 12 cols
// Anxiety = remaining unfilled space

function computeAnxiety(canvas) {
  // Total filled area in col-row units
  const totalCols = 12
  // We'll measure by summing col*height for each need and compare to baseline
  const baselineArea = NEEDS.length * MODE_LAYOUT['nourishment'].cols * MODE_LAYOUT['nourishment'].height
  const usedArea = NEEDS.reduce((s, n) => {
    const layout = MODE_LAYOUT[canvas[n.id]]
    return s + layout.cols * layout.height
  }, 0)
  const pct = Math.min(usedArea / baselineArea, 1)
  return 1 - pct
}

export default function Canvas({ canvas, onChangeMode, readonly = false }) {
  const [openDropdown, setOpenDropdown] = useState(null)
  const pct = computeProgress(canvas)

  function handleSelect(needId, newMode) {
    setOpenDropdown(null)
    if (newMode === canvas[needId]) return
    const isUpgrade = LAYER_ORDER.indexOf(newMode) > LAYER_ORDER.indexOf(canvas[needId])
    onChangeMode && onChangeMode(needId, newMode, !isUpgrade)
  }

  // Close dropdown when clicking outside
  function handleWrapClick(e) {
    if (!e.target.closest(`.${styles.dropdownWrap}`)) {
      setOpenDropdown(null)
    }
  }

  const anxietyPct = computeAnxiety(canvas)

  return (
    <div className={styles.wrap} onClick={handleWrapClick}>

      {/* Legend */}
      <div className={styles.legend}>
        {[...LAYER_ORDER].reverse().map(m => {
          const lyr = LAYERS[m]
          return (
            <div key={m} className={styles.legendItem}>
              <div className={styles.legendPip} style={{ background: lyr.pip, border: m === 'appreciation' ? `1px solid ${lyr.border}` : 'none' }} />
              <span>{m}</span>
            </div>
          )
        })}
        <div className={styles.legendItem}>
          <div className={styles.legendPip} style={{ background: '#2C2820' }} />
          <span>anxiety</span>
        </div>
      </div>

      {/* Progress */}
      <div className={styles.progress}>
        <span className={styles.progressLabel}>canvas composed</span>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? '#1B3627' : pct >= 70 ? '#1A1A18' : '#E13E15',
            }}
          />
        </div>
        <span className={styles.progressPct} style={{ color: pct >= 100 ? '#1B3627' : pct >= 70 ? '#1A1A18' : '#E13E15' }}>
          {pct}%
        </span>
      </div>

      {/* Canvas grid */}
      <div className={styles.grid}>

        {/* Anxiety block — full width, height proportional to unfilled space */}
        {anxietyPct > 0.01 && (
          <div
            className={styles.anxietyBlock}
            style={{
              gridColumn: '1 / -1',
              height: Math.round(anxietyPct * 300),
            }}
          >
            {anxietyPct > 0.15 && (
              <>
                {anxietyPct > 0.25 && <span className={styles.anxietyEye}>blank space</span>}
                <span className={styles.anxietyText}>anxiety<br />grows here.</span>
              </>
            )}
          </div>
        )}

        {/* Need tiles */}
        {NEEDS.map(n => {
          const mode = canvas[n.id]
          const lyr = LAYERS[mode]
          const layout = MODE_LAYOUT[mode]
          const isOpen = openDropdown === n.id

          return (
            <div
              key={n.id}
              className={styles.tile}
              style={{
                gridColumn: `span ${layout.cols}`,
                height: layout.height,
                borderColor: lyr.border,
              }}
            >
              {/* Top row — pip, mode label, dropdown trigger */}
              <div className={styles.tileTop}>
                <div className={styles.tilePipLabel}>
                  <div className={styles.tilePip} style={{ background: lyr.pip }} />
                  <span className={styles.tileMode} style={{ color: lyr.text }}>{mode}</span>
                </div>

                {/* Dropdown */}
                {!readonly && (
                  <div className={styles.dropdownWrap}>
                    <button
                      className={styles.dropdownTrigger}
                      style={{ color: lyr.text }}
                      onClick={e => { e.stopPropagation(); setOpenDropdown(isOpen ? null : n.id) }}
                    >
                      ▾
                    </button>
                    {isOpen && (
                      <div className={styles.dropdown}>
                        {LAYER_ORDER.map(l => {
                          const lyrL = LAYERS[l]
                          const isActive = mode === l
                          return (
                            <div
                              key={l}
                              className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
                              onClick={e => { e.stopPropagation(); handleSelect(n.id, l) }}
                            >
                              <div className={styles.dropdownPip} style={{ background: lyrL.pip }} />
                              <span style={{ color: isActive ? lyrL.text : undefined }}>{l}</span>
                              {isActive && <span className={styles.dropdownCheck}>✓</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Need name */}
              <div
                className={styles.tileName}
                style={{
                  color: lyr.text,
                  fontSize: layout.height >= 200 ? 24 : layout.height >= 130 ? 18 : layout.height >= 90 ? 14 : 11,
                }}
              >
                {n.name}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}