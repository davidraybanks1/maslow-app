import { NavLink } from 'react-router-dom'
import styles from './DesktopNav.module.css'
import BrandMark from './BrandMark'
import ProfileMenu from './ProfileMenu'

/* Persistent sidebar for ≥900px viewports. */

const ITEMS = [
  ['/today', 'today'],
  ['/data', 'almanac'],
  ['/log', 'drafts'],
]

export default function DesktopNav({ name, email, reviewCadence, updateReviewCadence, reviewDay, reviewTime, updateReviewSchedule, remindersEnabled, updateRemindersEnabled, reviewReminderEnabled, updateReviewReminderEnabled, moodReminders, updateMoodReminder, notifTypes, updateNotifType, noteDeckCount, customTagCount, resetTour, onOpenComposer }) {
  const linkClass = ({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`
  return (
    <aside className={styles.nav} aria-label="Primary" data-tour="nav">
      <div className={styles.brand}>
        <BrandMark size={17} />
      </div>
      <nav className={styles.items}>
        {ITEMS.map(([to, label]) => (
          <NavLink key={to} to={to} className={linkClass}>{label}</NavLink>
        ))}
      </nav>
      <div className={styles.footer}>
        {/* Sticky "add a draft" — same button, same spot, on every screen;
            see GlobalComposer.jsx for the mobile equivalent and the sheet
            it opens. */}
        <button className={styles.composerFab} onClick={onOpenComposer} aria-label="Add a draft">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <ProfileMenu
          name={name} email={email}
          reviewCadence={reviewCadence} updateReviewCadence={updateReviewCadence}
          reviewDay={reviewDay} reviewTime={reviewTime} updateReviewSchedule={updateReviewSchedule}
          remindersEnabled={remindersEnabled} updateRemindersEnabled={updateRemindersEnabled}
          reviewReminderEnabled={reviewReminderEnabled} updateReviewReminderEnabled={updateReviewReminderEnabled}
          moodReminders={moodReminders} updateMoodReminder={updateMoodReminder}
          notifTypes={notifTypes} updateNotifType={updateNotifType}
          noteDeckCount={noteDeckCount}
          customTagCount={customTagCount}
          resetTour={resetTour}
          dropUp
        />
      </div>
    </aside>
  )
}
