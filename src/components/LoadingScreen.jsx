import styles from './LoadingScreen.module.css'
import Wordmark from './Wordmark'

/* The daily open: the Loam wordmark on the paper, shown once a day. It fades
   in gently (no motion with reduced motion). App.jsx holds it for RITUAL_MS. */
export default function LoadingScreen({ greeting = 'Hey, you', fading = false }) {
  return (
    <div
      className={`${styles.overlay} ${fading ? styles.overlayFading : ''}`}
      role="status"
      aria-live="polite"
    >
      <Wordmark fit="large" className={styles.word} />
      <span className={styles.srOnly}>{greeting} — welcome to Loam</span>
    </div>
  )
}
