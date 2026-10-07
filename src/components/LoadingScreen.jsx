import styles from './LoadingScreen.module.css'
import LoamSplash from './LoamSplash'

/* The daily open: the Loam splash over the paper, shown once a day. (First-time
   users get the same animation as the first onboarding screen instead.)
   App.jsx holds it for RITUAL_MS. */
export default function LoadingScreen({ greeting = 'Hey, you', fading = false }) {
  return (
    <div
      className={`${styles.overlay} ${fading ? styles.overlayFading : ''}`}
      role="status"
      aria-live="polite"
    >
      <LoamSplash />
      <span className={styles.srOnly}>{greeting} — welcome to Loam</span>
    </div>
  )
}
