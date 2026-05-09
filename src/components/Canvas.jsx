import { CANVAS_COLUMNS, LAYER_HEIGHTS, LAYERS, LAYER_ORDER, GAP, baselineColumnHeight, computeProgress } from '../lib/constants'
import styles from './Canvas.module.css'

export default function Canvas({ canvas, onChangeMode, readonly = false }) {
  const pct = computeProgress(canvas)

  function canAccommodate(needId, newMode) {
    const colIdx = CANVAS_COLUMNS.findIndex(c => c.includes(needId))
    const colNeeds = CANVAS_COLUMNS[colIdx]
    const currentSum = colNeeds.reduce((s, id) => s + LAYER_HEIGHTS[canvas[id]], 0)
    const gaps = (colNeeds.length - 1) * GAP
    const diff = LAYER_HEIGHTS[newMode] - LAYER_HEIGHTS[canvas[needId]]
    return currentSum + gaps + diff <= baselineColumnHeight(colNeeds)
  }

  function handlePill(needId, newMode) {
    if (newMode === canvas[needId]) return
    const isUpgrade = LAYER_ORDER.indexOf(newMode) > LAYER_ORDER.indexOf(canvas[needId])
    const canFit = !isUpgrade || canAccommodate(needId, newMode)
    onChangeMode && onChangeMode(needId, newMode, canFit)
  }

  return (
    <div className={styles.wrap}>
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
        <span
          className={styles.progressPct}
          style={{ color: pct >= 100 ? '#1B3627' : pct >= 70 ? '#1A1A18' : '#E13E15' }}
        >
          {pct}%
        </span>
      </div>

      <div className={styles.grid}>
        {CANVAS_COLUMNS.map((colIds, ci) => {
          const canvasH = baselineColumnHeight(colIds)
          const needsH = colIds.reduce((s, id) => s + LAYER_HEIGHTS[canvas[id]], 0)
          const gaps = (colIds.length - 1) * GAP
          const anxietyH = canvasH - needsH - gaps

          return (
            <div key={ci} className={styles.col}>
              {anxietyH > 4 && (
                <div className={styles.anxietyBlock} style={{ height: anxietyH }}>
                  {ci === 0 && anxietyH > 60 && (
                    <>
                      {anxietyH > 80 && <span className={styles.anxietyEye}>blank space</span>}
                      <span className={styles.anxietyText}>anxiety<br />grows here.</span>
                    </>
                  )}
                </div>
              )}

              {colIds.map(id => {
                const mode = canvas[id]
                const lyr = LAYERS[mode]
                const h = LAYER_HEIGHTS[mode]

                return (
                  <div
                    key={id}
                    className={styles.tile}
                    style={{ height: h, borderColor: lyr.border }}
                  >
                    {!readonly && (
                      <div className={styles.tilePills}>
                        {LAYER_ORDER.map(l => {
                          const isActive = mode === l
                          const lyrL = LAYERS[l]
                          return (
                            <button
                              key={l}
                              className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
                              style={isActive ? {
                                borderColor: lyrL.border,
                                color: lyrL.text,
                                background: lyrL.bg,
                              } : {}}
                              onClick={() => handlePill(id, l)}
                            >
                              {l.slice(0, 3)}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <div
                      className={styles.tileName}
                      style={{
                        color: lyr.text,
                        fontSize: h >= 320 ? 22 : h >= 240 ? 18 : h >= 160 ? 14 : 11,
                      }}
                    >
                      {id.charAt(0).toUpperCase() + id.slice(1)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}