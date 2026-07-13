import { useMemo } from 'react'
import styles from './LoadingScreen.module.css'

/* Daily ritual: the screen starts fully black — anxiety owns all of it.
   TAKE BACK SPACE rises from the bottom with the mark beneath it, and the
   black is pushed completely off the top. Plays once per day. */

function Mark() {
  // Dots inherit the group's color (white on black → ink on white); the crown dot stays gold.
  return (
    <svg width="34" height="34" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="10" r="3" fill="#E8B81F" />
      <circle cx="21" cy="20" r="3" fill="currentColor" />
      <circle cx="31" cy="20" r="3" fill="currentColor" />
      <circle cx="16" cy="30" r="3" fill="currentColor" />
      <circle cx="26" cy="30" r="3" fill="currentColor" />
      <circle cx="36" cy="30" r="3" fill="currentColor" />
      <circle cx="11" cy="40" r="3" fill="currentColor" />
      <circle cx="21" cy="40" r="3" fill="currentColor" />
      <circle cx="31" cy="40" r="3" fill="currentColor" />
      <circle cx="41" cy="40" r="3" fill="currentColor" />
    </svg>
  )
}

export default function LoadingScreen({ greeting = 'hey, you', fading = false }) {
  const reduce = useMemo(
    () => typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  return (
    <div
      className={`${styles.overlay} ${fading ? styles.overlayFading : ''}`}
      role="status"
      aria-live="polite"
    >
      {!reduce && <div className={styles.blackPanel} />}
      <div className={`${styles.riseGroup} ${reduce ? styles.riseStatic : ''}`}>
        <div className={styles.takeBack}>TAKE BACK SPACE</div>
        <Mark />
      </div>
      <span className={styles.srOnly}>{greeting} — loading</span>
    </div>
  )
}
