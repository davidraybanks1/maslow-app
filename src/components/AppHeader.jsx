import styles from './AppHeader.module.css'
import BrandMark from './BrandMark'
import ProfileMenu from './ProfileMenu'

export default function AppHeader({ slot, name, email, remindersEnabled, updateRemindersEnabled, moodReminders, updateMoodReminder, notifTypes, updateNotifType, needCount, noteDeckCount, customTagCount, resetTour }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <BrandMark size={20} />
      </div>
      <div className={styles.right}>
        {slot}
        <ProfileMenu
          name={name} email={email}
          remindersEnabled={remindersEnabled} updateRemindersEnabled={updateRemindersEnabled}
          moodReminders={moodReminders} updateMoodReminder={updateMoodReminder}
          notifTypes={notifTypes} updateNotifType={updateNotifType}
          needCount={needCount}
          noteDeckCount={noteDeckCount}
          customTagCount={customTagCount}
          resetTour={resetTour}
        />
      </div>
    </header>
  )
}
