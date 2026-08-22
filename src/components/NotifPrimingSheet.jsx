import { requestNotifPermission } from '../lib/native'
import styles from './NotifPrimingSheet.module.css'

export default function NotifPrimingSheet({ updateRemindersEnabled, markNotifPrimed }) {
  async function handleTurnOn() {
    const result = await requestNotifPermission()
    if (result === 'granted') {
      updateRemindersEnabled(true)
    } else {
      updateRemindersEnabled(false)
    }
    markNotifPrimed()
  }

  function handleNotNow() {
    updateRemindersEnabled(false)
    markNotifPrimed()
  }

  return (
    <>
      <div className={styles.scrim} />
      <div className={styles.sheet}>
        <div className={styles.heading}>reminders</div>
        <div className={styles.body}>three nudges a day to check in with how you're feeling, plus a reminder when your review is ready. you choose the times, and you can turn them off whenever.</div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleTurnOn}>turn them on</button>
          <button className={styles.btnSecondary} onClick={handleNotNow}>not now</button>
        </div>
      </div>
    </>
  )
}
