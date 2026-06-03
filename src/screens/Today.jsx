import { NEEDS, LAYERS, totalBubbles } from '../lib/constants'
import { todayKey } from '../lib/store'
import styles from './Today.module.css'

const LAYER_ORDER = ['purpose', 'appreciation', 'nourishment', 'survival']

const PRACTICE_HINT = {
  purpose:      '3 practices',
  appreciation: '2 practices each',
  nourishment:  '1 practice each',
}

export default function Today({ state, checkIn }) {
  const today = todayKey()
  const checked = state.checkins[today] || []
  const total = totalBubbles(state.canvas)
  const done = checked.length

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.date}>{date}</div>
        <div className={styles.greeting}>
          good {hour()}, <em>{state.profile?.name || 'friend'}.</em>
        </div>
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progLeft}>
          <span className={styles.progNum}>{done}</span>
          <span className={styles.progTotal}>/{total}</span>
        </div>
        <div className={styles.progRight}>
          <span className={styles.progPct}>{total ? Math.round(done / total * 100) : 0}%</span>
          <div className={styles.progTrack}>
            <div className={styles.progFill} style={{ width: `${total ? Math.round(done / total * 100) : 0}%` }} />
          </div>
        </div>
      </div>

      <div className={styles.list}>
        {LAYER_ORDER.map(mode => {
          const modeNeeds = NEEDS.filter(n => state.canvas[n.id] === mode)
          if (!modeNeeds.length) return null
          const lyr = LAYERS[mode]
          if (lyr.bubbles === 0) return null
          return (
            <div key={mode} className={styles.modeGroup}>
              <div className={styles.modeLabel}>
                <div className={styles.modePip} style={{ background: lyr.pip }} />
                {mode}
                {PRACTICE_HINT[mode] && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink3)', marginLeft: 6 }}>
                    {PRACTICE_HINT[mode]}
                  </span>
                )}
              </div>
              {modeNeeds.map(n => {
                const pool = state.practices[n.id] || []
                // Practices checked off for this need today
                const prefix = `${n.id}_`
                const checkedKeys = checked.filter(k => k.startsWith(prefix))
                const checkedTexts = checkedKeys.map(k => k.slice(prefix.length))
                const remainingSlots = lyr.bubbles - checkedKeys.length
                const availableChips = pool.filter(p => !checkedTexts.includes(p))

                return (
                  <div key={n.id}>
                    {/* One row per already-checked practice */}
                    {checkedTexts.map(practiceText => (
                      <div
                        key={practiceText}
                        className={`${styles.bubbleRow} ${styles.bubbleRowDone}`}
                        onClick={() => checkIn(n.id, practiceText)}
                      >
                        <div
                          className={`${styles.bubble} ${styles.bubbleDone}`}
                          style={{ background: lyr.pip, borderColor: lyr.pip }}
                        >
                          <span className={styles.check}>✓</span>
                        </div>
                        <div className={styles.bubbleInfo}>
                          <div className={styles.bubbleNeed}>{n.name}</div>
                          <div className={styles.bubblePractice}>{practiceText}</div>
                        </div>
                      </div>
                    ))}

                    {/* One unchecked row showing the chip pool, if slots remain */}
                    {remainingSlots > 0 && (
                      <div className={styles.bubbleRow}>
                        <div className={styles.bubble} />
                        <div className={styles.bubbleInfo}>
                          <div className={styles.bubbleNeed}>{n.name}</div>
                          {pool.length === 0 ? (
                            <div className={styles.noPractice}>No practices set — add some in Practices</div>
                          ) : availableChips.length === 0 ? (
                            <div className={styles.noPractice}>All pool practices done</div>
                          ) : (
                            <div className={styles.chipRow}>
                              {availableChips.map(p => (
                                <button
                                  key={p}
                                  className={styles.practiceChip}
                                  onClick={e => { e.stopPropagation(); checkIn(n.id, p) }}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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

function hour() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
