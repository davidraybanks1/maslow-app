import styles from './NeedPills.module.css'

// One filled chip per need, coloured by the mode it was sorted into — the same
// chips the onboarding sort uses. Shown under a mode's progress bar on Today.
export default function NeedPills({ mode, needs }) {
  return (
    <div className={styles.row}>
      {needs.map(n => (
        <span key={n.id} className={`${styles.pill} ${styles[mode] || ''}`}>{n.name}</span>
      ))}
    </div>
  )
}
