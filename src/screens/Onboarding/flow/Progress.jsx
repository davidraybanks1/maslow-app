import styles from './Flow.module.css'

// value is 0..1
export default function Progress({ value }) {
  const pct = Math.max(0, Math.min(1, value))
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label="onboarding progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
    >
      <div className={styles.progressFill} style={{ width: `${(pct * 100).toFixed(1)}%` }} />
    </div>
  )
}
