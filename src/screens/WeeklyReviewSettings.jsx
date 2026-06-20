import { useState, useEffect } from 'react'
import { loadWeeklyReviews } from '../lib/store'
import styles from './WeeklyReviewSettings.module.css'

const REVIEW_DAYS = [
  { value: 0, label: 'mon' },
  { value: 1, label: 'tue' },
  { value: 2, label: 'wed' },
  { value: 3, label: 'thu' },
  { value: 4, label: 'fri' },
  { value: 5, label: 'sat' },
  { value: 6, label: 'sun' },
]

function formatWeekStarting(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
}

export default function WeeklyReviewSettings({ state, updateReviewSchedule }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (state.userId) loadWeeklyReviews(state.userId, 4).then(setHistory)
  }, [state.userId])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>weekly review</div>
        <div className={styles.sub}>choose when your weekly review nudge arrives.</div>
      </div>

      <div className={styles.card}>
        <div className={styles.fieldLabel}>DAY</div>
        <div className={styles.dayRow}>
          {REVIEW_DAYS.map(d => (
            <button
              key={d.value}
              className={`${styles.dayBtn} ${state.reviewDay === d.value ? styles.dayBtnActive : ''}`}
              onClick={() => updateReviewSchedule(d.value, state.reviewTime || '10:00')}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className={styles.fieldLabel} style={{ marginTop: 18 }}>TIME</div>
        <input
          type="time"
          className={styles.timeInput}
          value={state.reviewTime || '10:00'}
          onChange={e => updateReviewSchedule(state.reviewDay ?? 0, e.target.value)}
        />
      </div>

      <div className={styles.sectionLabel}>review history</div>
      {history.length === 0 ? (
        <div className={styles.empty}>your past reviews will appear here.</div>
      ) : (
        <div className={styles.card}>
          {history.map((r, i) => (
            <div key={r.id}>
              {i > 0 && <div className={styles.historyDivider} />}
              <div className={styles.historyRow}>
                <span className={styles.historyWeek}>week of {formatWeekStarting(r.week_starting)}</span>
                <span className={styles.historyMood}>{r.weekly_mood || '—'}</span>
                <span className={styles.historySteps}>{r.steps_completed} step{r.steps_completed === 1 ? '' : 's'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
