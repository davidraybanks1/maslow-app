import { NEEDS, LAYERS, totalBubbles } from '../lib/constants'
import { todayKey } from '../lib/store'
import styles from './Today.module.css'

const LAYER_ORDER = ['purpose', 'appreciation', 'nourishment', 'survival']

const PRACTICE_HINT = {
  purpose:      '3 practices',
  appreciation: '2 practices each',
  nourishment:  '1 practice each',
}

function MaslowMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="14" r="4" fill="#E8B81F"/>
      <circle cx="29" cy="28" r="4" fill="#1A1A1A"/>
      <circle cx="43" cy="28" r="4" fill="#1A1A1A"/>
      <circle cx="22" cy="42" r="4" fill="#1A1A1A"/>
      <circle cx="36" cy="42" r="4" fill="#1A1A1A"/>
      <circle cx="50" cy="42" r="4" fill="#1A1A1A"/>
      <circle cx="15" cy="56" r="4" fill="#1A1A1A"/>
      <circle cx="29" cy="56" r="4" fill="#1A1A1A"/>
      <circle cx="43" cy="56" r="4" fill="#1A1A1A"/>
      <circle cx="57" cy="56" r="4" fill="#1A1A1A"/>
    </svg>
  )
}

export default function Today({ state, checkIn, onMenuOpen }) {
  const today = todayKey()
  const checked = state.checkins[today] || []
  const total = totalBubbles(state.canvas)
  const done = checked.length
  const pct = total ? Math.round(done / total * 100) : 0

  return (
    <div className={styles.screen}>

      {/* ── Top bar: logo + hamburger ── */}
      <div className={styles.topBar}>
        <div className={styles.logoMark}>
          <MaslowMark />
          <span className={styles.wordmark}>maslow.</span>
        </div>
        <button className={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
          <span /><span /><span />
        </button>
      </div>

      {/* ── Greeting ── */}
      <div className={styles.header}>
        <div className={styles.greeting}>
          good {hour()}, <em>{state.profile?.name || 'friend'}.</em>
        </div>
      </div>

      {/* ── Progress ── */}
      <div className={styles.progressSection}>
        <div className={styles.progressScore}>
          <div className={styles.progLeft}>
            <span className={styles.progNum}>{done}</span>
            <span className={styles.progTotal}>/{total}</span>
          </div>
          <span className={styles.progPct}>{pct}%</span>
        </div>
        <div className={styles.progTrack}>
          <div className={styles.progFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Practice list ── */}
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
                const prefix = `${n.id}_`
                const checkedKeys = checked.filter(k => k.startsWith(prefix))
                const checkedTexts = checkedKeys.map(k => k.slice(prefix.length))
                const remainingSlots = lyr.bubbles - checkedKeys.length
                const availableChips = pool.filter(p => !checkedTexts.includes(p))

                return (
                  <div key={n.id}>
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
