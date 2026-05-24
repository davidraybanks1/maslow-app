import { NEEDS, LAYERS, totalBubbles } from '../lib/constants'
import { todayKey } from '../lib/store'
import styles from './Today.module.css'

const LAYER_ORDER = ['play', 'appreciation', 'nourishment']

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
          return (
            <div key={mode} className={styles.modeGroup}>
              <div className={styles.modeLabel}>
                <div className={styles.modePip} style={{ background: lyr.pip }} />
                {mode}
              </div>
              {modeNeeds.map(n => {
                const practices = state.practices[n.id] || []
                return Array.from({ length: lyr.bubbles }).map((_, i) => {
                  const key = `${n.id}_${i}`
                  const isDone = checked.includes(key)
                  const practice = practices[i]
                  return (
                    <div
                      key={key}
                      className={`${styles.bubbleRow} ${isDone ? styles.bubbleRowDone : ''}`}
                      onClick={() => checkIn(n.id, i)}
                    >
                      <div
                        className={`${styles.bubble} ${isDone ? styles.bubbleDone : ''}`}
                        style={isDone ? { background: lyr.pip, borderColor: lyr.pip } : {}}
                      >
                        {isDone && <span className={styles.check}>✓</span>}
                      </div>
                      <div className={styles.bubbleInfo}>
                        <div className={styles.bubbleNeed}>{n.name}</div>
                        <div className={styles.bubblePractice}>
                          {practice || <span className={styles.noPractice}>no practice set</span>}
                        </div>
                      </div>
                    </div>
                  )
                })
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