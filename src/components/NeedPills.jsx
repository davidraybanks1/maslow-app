import styles from './NeedPills.module.css'

// One filled chip, coloured by the mode its need was sorted into — the same
// chips the onboarding sort uses.
export function NeedPill({ mode, name }) {
  return <span className={`${styles.pill} ${styles[mode] || ''}`}>{name}</span>
}

// A wrapped row of chips, one per need. Shown under a mode's progress bar on Today.
export default function NeedPills({ mode, needs }) {
  return (
    <div className={styles.row}>
      {needs.map(n => <NeedPill key={n.id} mode={mode} name={n.name} />)}
    </div>
  )
}
