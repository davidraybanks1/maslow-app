import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './UpdateToast.module.css'

export default function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // As soon as a new SW is detected, activate it immediately (skipWaiting)
  // without reloading the page. The toast then prompts the user to reload
  // so they pick up the new bundle at their convenience.
  useEffect(() => {
    if (needRefresh) updateServiceWorker(false)
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh) return null

  return (
    <div className={styles.toast} role="status">
      a new version is ready —{' '}
      <button className={styles.refreshBtn} onClick={() => window.location.reload()}>
        refresh
      </button>
    </div>
  )
}
