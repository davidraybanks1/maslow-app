import styles from './AppHeader.module.css'

function MaslowMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="10" r="3" fill="#E8B81F"/>
      <circle cx="21" cy="20" r="3" fill="var(--ink)"/>
      <circle cx="31" cy="20" r="3" fill="var(--ink)"/>
      <circle cx="16" cy="30" r="3" fill="var(--ink)"/>
      <circle cx="26" cy="30" r="3" fill="var(--ink)"/>
      <circle cx="36" cy="30" r="3" fill="var(--ink)"/>
      <circle cx="11" cy="40" r="3" fill="var(--ink)"/>
      <circle cx="21" cy="40" r="3" fill="var(--ink)"/>
      <circle cx="31" cy="40" r="3" fill="var(--ink)"/>
      <circle cx="41" cy="40" r="3" fill="var(--ink)"/>
    </svg>
  )
}

export default function AppHeader({ onMenuOpen }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <MaslowMark />
        <span className={styles.wordmark}>mymaslow.</span>
      </div>
      <button className={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
        <div /><div /><div />
      </button>
    </header>
  )
}
