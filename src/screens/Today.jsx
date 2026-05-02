import { useState } from 'react'
import { NEEDS, LAYERS } from '../lib/constants'
import { todayKey, weekKey } from '../lib/store'
import styles from './Today.module.css'

export default function Today({ state, checkIn }) {
  const today = todayKey()
  const wk = weekKey()
  const checkedIn = state.checkins[today] || []
  const intentions = state.intentions[wk] || {}
  const needsWithIntentions = NEEDS.filter(n => intentions[n.id])
  const doneCount = needsWithIntentions.filter(n => checkedIn.includes(n.id)).length
  const totalCount = needsWithIntentions.length || NEEDS.length

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const weekNum = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 604800000)

  return (
    <div className={styles.screen}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.date}>{dayName} · week {weekNum}</div>
        <div className={styles.bigNum}>{doneCount}</div>
        <div className={styles.bigLabel}>of {totalCount} done today</div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color: '#1B3627' }}>
            {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%
          </div>
          <div className={styles.statLabel}>today</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>wk {weekNum}</div>
          <div className={styles.statLabel}>building</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>{Object.keys(state.canvas).filter(id => state.canvas[id] !== 'survival').length}</div>
          <div className={styles.statLabel}>active needs</div>
        </div>
      </div>

      {/* Checklist */}
      <div className={styles.list}>
        {(needsWithIntentions.length > 0 ? needsWithIntentions : NEEDS).map(n => {
          const mode = state.canvas[n.id]
          const lyr = LAYERS[mode]
          const done = checkedIn.includes(n.id)
          const intention = intentions[n.id]

          return (
            <div
              key={n.id}
              className={`${styles.item} ${done ? styles.itemDone : ''}`}
              onClick={() => checkIn(n.id)}
            >
              <div
                className={`${styles.check} ${done ? styles.checkDone : ''}`}
                style={done ? { background: lyr.pip, borderColor: lyr.pip } : {}}
              >
                {done && <div className={styles.tick} />}
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemNeed} style={{ color: lyr.text }}>
                  {n.id} · {mode}
                </div>
                <div className={`${styles.itemAction} ${done ? styles.itemActionDone : ''}`}>
                  {intention?.action || n.description}
                </div>
              </div>
              <div className={styles.itemPip} style={{ background: lyr.pip }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
