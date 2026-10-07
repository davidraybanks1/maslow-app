import styles from './FirstWeekCard.module.css'

// The white "still filling in" card shown at the top of almanac and drafts
// while a new account has under a week of data. Same surface as the calendar
// and insight cards so it reads as part of the app, not a banner.
export default function FirstWeekCard({ title }) {
  return (
    <div className={styles.card} role="note">
      <div className={styles.title}>{title}</div>
    </div>
  )
}
