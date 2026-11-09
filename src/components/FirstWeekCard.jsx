import styles from './FirstWeekCard.module.css'

// The "still filling in" line at the top of Data and Drafts while a new
// account has under a week of data. Plain text on the page, between rules.
export default function FirstWeekCard({ title }) {
  return (
    <div className={styles.card} role="note">
      <div className={styles.title}>{title}</div>
    </div>
  )
}
