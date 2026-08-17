import styles from './AppHeader.module.css'
import BrandMark from './BrandMark'


export default function AppHeader({ onMenuOpen }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <BrandMark size={20} />
      </div>
      <button className={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
        <div /><div /><div />
      </button>
    </header>
  )
}
