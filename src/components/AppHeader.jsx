import styles from './AppHeader.module.css'
import BrandMark from './BrandMark'
import ProfileMenu from './ProfileMenu'

export default function AppHeader({ slot, name, email, showNoteToSelf, updateShowNoteToSelf, reviewCadence, updateReviewCadence, reviewDay, reviewTime, updateReviewSchedule, remindersEnabled, updateRemindersEnabled, reviewReminderEnabled, updateReviewReminderEnabled, moodReminders, updateMoodReminder, noteDeckCount, customTagCount, resetTour }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <BrandMark size={20} />
      </div>
      <div className={styles.right}>
        {slot}
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
          resetTour={resetTour}
        />
      </div>
    </header>
  )
}
