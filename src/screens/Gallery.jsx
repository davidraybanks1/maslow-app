import { NEEDS, LAYERS } from '../lib/constants'
import styles from './Gallery.module.css'

function getWeekKey(weeksAgo) {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() - weeksAgo * 7)
  return d.toISOString().slice(0, 10)
}

function fmt(wk) {
  const d = new Date(wk)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Gallery({ state }) {
  const weeks = Array.from({ length: 12 }, (_, i) => getWeekKey(i)).reverse()

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>gallery</div>
        <div className={styles.sub}>12 weeks of your canvas</div>
      </div>
      <div className={styles.grid}>
        {weeks.map((wk, i) => {
          const isCurrent = i === weeks.length - 1
          const intentions = state.intentions[wk] || {}
          const intentionCount = Object.keys(intentions).length
          const checkins = state.checkins || {}
          const completedCount = NEEDS.filter(n => {
            if (!intentions[n.id]) return false
            return Object.keys(checkins).some(dk => dk >= wk && dk <= wk + '9' && checkins[dk]?.[n.id])
          }).length
          const rate = intentionCount > 0 ? Math.round(completedCount / intentionCount * 100) : null

          return (
            <div key={wk} className={`${styles.card} ${isCurrent ? styles.cardCurrent : ''}`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardWeek}>{fmt(wk)}</span>
                {rate !== null && <span className={styles.cardRate} style={{ color: rate>=80?'#1B3A2D':rate>=50?'#8A6A00':'#D93B1C' }}>{rate}%</span>}
                {isCurrent && <span className={styles.cardCurrentBadge}>now</span>}
              </div>
              <div className={styles.miniCanvas}>
                {NEEDS.map(n => {
                  const mode = state.canvas[n.id] || 'nourishment'
                  const lyr = LAYERS[mode]
                  return (
                    <div key={n.id} className={styles.miniTile} style={{ borderColor: lyr.border }} title={`${n.name} — ${mode}`}>
                      <div className={styles.miniPip} style={{ background: lyr.pip }} />
                    </div>
                  )
                })}
              </div>
              {intentionCount === 0 && <div className={styles.cardEmpty}>no intentions set</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}