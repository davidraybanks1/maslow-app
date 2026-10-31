import styles from './PanelBack.module.css'

// "‹ profile": the way back from a page the desktop profile opened in the side
// panel. Same look as the one on the reminders page.
export default function PanelBack({ label, onClick }) {
  return (
    <button type="button" className={styles.back} onClick={onClick} aria-label={`back to ${label}`}>
      <svg width="7" height="12" viewBox="0 0 8 14" aria-hidden="true"><path d="M7 1L1 7l6 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {label}
    </button>
  )
}
