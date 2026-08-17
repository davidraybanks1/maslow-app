import { useState } from 'react'
import styles from './Data.module.css'

const PERIODS = [
  { label: '3d', days: 3 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
]

function buildSubhead(period) {
  const today = new Date()
  if (period === 30) return 'last 30 days · compared with the 30 before'
  const start = new Date(today)
  start.setDate(today.getDate() - (period - 1))
  const fmtDay = d => {
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase()
    return `${weekday} ${d.getDate()}`
  }
  const month = today.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase()
  const comparison = period === 3 ? 'the 3 days before' : 'the week before'
  return `${fmtDay(start)} — ${fmtDay(today)} ${month} · compared with ${comparison}`
}

// eslint-disable-next-line no-unused-vars
export default function Data({ state }) {
  const [period, setPeriod] = useState(7)

  return (
    <div className={styles.screen}>
      <div className={styles.appBar}>
        <span className={styles.wordmark}>m</span>
        <div className={styles.periodToggle}>
          {PERIODS.map(p => (
            <button
              key={p.days}
              className={`${styles.periodPill}${period === p.days ? ` ${styles.periodPillActive}` : ''}`}
              onClick={() => setPeriod(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scrollArea}>
        <h1 className={styles.pageTitle}>data</h1>
        <p className={styles.pageSubhead}>{buildSubhead(period)}</p>
        {/* sections added in stages 2–9 */}
      </div>
    </div>
  )
}
