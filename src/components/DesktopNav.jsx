import { NavLink } from 'react-router-dom'
import styles from './DesktopNav.module.css'
import BrandMark from './BrandMark'
import ProfileMenu from './ProfileMenu'

/* Persistent sidebar for ≥1024px viewports. */

const ITEMS = [
  ['/today', 'today'],
  ['/data', 'data'],
  ['/log', 'reflect'],
]

export default function DesktopNav({ name, email, showNoteToSelf, updateShowNoteToSelf, reviewCadence, updateReviewCadence, reviewDay, reviewTime, updateReviewSchedule, remindersEnabled, updateRemindersEnabled, reviewReminderEnabled, updateReviewReminderEnabled, moodReminders, updateMoodReminder, noteDeckCount, customTagCount }) {
  const linkClass = ({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`
  return (
    <aside className={styles.nav} aria-label="Primary">
      <div className={styles.brand}>
        <BrandMark size={17} />
      </div>
      <nav className={styles.items}>
        {ITEMS.map(([to, label]) => (
          <NavLink key={to} to={to} className={linkClass}>{label}</NavLink>
        ))}
      </nav>
      <div className={styles.footer}>
        <ProfileMenu
          name={name} email={email}
          showNoteToSelf={showNoteToSelf} updateShowNoteToSelf={updateShowNoteToSelf}
          reviewCadence={reviewCadence} updateReviewCadence={updateReviewCadence}
          reviewDay={reviewDay} reviewTime={reviewTime} updateReviewSchedule={updateReviewSchedule}
          remindersEnabled={remindersEnabled} updateRemindersEnabled={updateRemindersEnabled}
          reviewReminderEnabled={reviewReminderEnabled} updateReviewReminderEnabled={updateReviewReminderEnabled}
          moodReminders={moodReminders} updateMoodReminder={updateMoodReminder}
          noteDeckCount={noteDeckCount}
          customTagCount={customTagCount}
          dropUp
        />
      </div>
    </aside>
  )
}
