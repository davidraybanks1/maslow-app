import { NavLink } from 'react-router-dom'
import styles from './DesktopNav.module.css'
import BrandMark from './BrandMark'
import ProfileMenu from './ProfileMenu'
import Glyph from '../lib/glyphs'

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
            it opens. Same glyph as the mobile fab and the "drafts" tab. */}
        <button className={styles.composerFab} onClick={onOpenComposer} aria-label="Add a draft">
          <Glyph kind="note" height={14} />
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
