import styles from './Flow.module.css'

// The four parts of the flow, for the folio over the progress line. The line
// itself stays continuous; a part only names where you are.
const PARTS = [
  { numeral: 'i', name: 'hello' },
  { numeral: 'ii', name: 'your needs' },
  { numeral: 'iii', name: 'a practice' },
  { numeral: 'iv', name: 'last steps' },
]
const PART_OF = { intro: 0, hypotheses: 0, how: 0, sort: 1, rank: 1, recap: 1, practice: 2, almanac: 2, notes: 3, account: 3 }

// value is 0..1
export default function Progress({ value, step }) {
  const pct = Math.max(0, Math.min(1, value))
  const part = PARTS[PART_OF[step] ?? 0]
  const width = `${(pct * 100).toFixed(1)}%`
  return (
    <>
      <div className={styles.partHead}>
        <span>{part.numeral}. {part.name.toUpperCase()}</span>
        <span>PART {part.numeral} OF iv</span>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="onboarding progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
      >
        <div className={styles.progressFill} style={{ width }} />
        <div className={styles.progressDots} style={{ left: width }} />
      </div>
    </>
  )
}
