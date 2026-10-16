import styles from './PracticeToast.module.css'

// A short, quiet confirmation. Sits above the tab bar; the owner clears it.
export default function PracticeToast({ message }) {
  if (!message) return null
  return <div className={styles.toast} role="status">{message}</div>
}
