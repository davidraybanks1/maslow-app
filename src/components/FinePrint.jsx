import styles from './FinePrint.module.css'

/* The fine print under a chart, folded away. Written the way you would
   explain it to a friend, not to a user. */
export default function FinePrint({ children, label = 'Make this make sense' }) {
  return (
    <details className={styles.fp}>
      <summary className={styles.sum}>
        <span>{label}</span>
        <i className={styles.chev} aria-hidden="true" />
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  )
}
