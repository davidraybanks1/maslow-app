import { useEffect, useRef } from 'react'
import styles from './GhostPreview.module.css'

// A real drawing, shown washed out with sample data and a small "to come"
// label over it, for accounts that don't have enough of their own yet. It's
// decoration: hidden from assistive tech, not tappable, never focusable.
export default function GhostPreview({ children, label = 'to come' }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.setAttribute('inert', '') }, [])
  return (
    <div className={styles.ghost}>
      <div ref={ref} className={styles.art} aria-hidden="true">{children}</div>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
