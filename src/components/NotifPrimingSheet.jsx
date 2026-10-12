import { requestNotifPermission } from '../lib/native'
import styles from './NotifPrimingSheet.module.css'

const DEVICE_FLAG_KEY = 'notifPrimedOnDevice'

export { DEVICE_FLAG_KEY }

export default function NotifPrimingSheet({ updateRemindersEnabled, markNotifPrimed, onAnswer }) {
  async function handleTurnOn() {
    try {
      const result = await requestNotifPermission()
      updateRemindersEnabled(result === 'granted')
      onAnswer?.(result)
    } catch {
      updateRemindersEnabled(false)
      onAnswer?.('denied')
    } finally {
      markNotifPrimed()
      try { localStorage.setItem(DEVICE_FLAG_KEY, '1') } catch {}
    }
  }

  function handleNotNow() {
    updateRemindersEnabled(false)
    markNotifPrimed()
    onAnswer?.('dismissed')
    try { localStorage.setItem(DEVICE_FLAG_KEY, '1') } catch {}
  }

  return (
    <>
      <div className={styles.scrim} />
      <div className={styles.sheet}>
        <div className={styles.heading}>reminders</div>
        <div className={styles.body}>three nudges a day to check in with how you're feeling. you choose the times, and you can turn them off whenever.</div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleTurnOn}>turn them on</button>
          <button className={styles.btnSecondary} onClick={handleNotNow}>not now</button>
        </div>
      </div>
    </>
  )
}
