import { NavLink } from 'react-router-dom'
import styles from './DesktopNav.module.css'

/* Persistent sidebar for ≥1024px viewports. Hidden entirely on mobile —
   the phone experience (black header + hamburger) is untouched. */

const ITEMS = [
  ['/today', 'Today'],
  ['/canvas', 'Canvas'],
  ['/practices', 'Practices'],
  ['/data', 'Data'],
  ['/log', 'Weekly Review'],
  ['/debriefs', 'Debriefs'],
]

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="10" r="3" fill="#E8B81F" />
      <circle cx="21" cy="20" r="3" fill="var(--ink)" />
      <circle cx="31" cy="20" r="3" fill="var(--ink)" />
      <circle cx="16" cy="30" r="3" fill="var(--ink)" />
      <circle cx="26" cy="30" r="3" fill="var(--ink)" />
      <circle cx="36" cy="30" r="3" fill="var(--ink)" />
      <circle cx="11" cy="40" r="3" fill="var(--ink)" />
      <circle cx="21" cy="40" r="3" fill="var(--ink)" />
      <circle cx="31" cy="40" r="3" fill="var(--ink)" />
      <circle cx="41" cy="40" r="3" fill="var(--ink)" />
    </svg>
  )
}

export default function DesktopNav() {
  const linkClass = ({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`
  return (
    <aside className={styles.nav} aria-label="Primary">
      <div className={styles.brand}>
        <Mark />
        <span>mymaslow.</span>
      </div>
      <nav className={styles.items}>
        {ITEMS.map(([to, label]) => (
          <NavLink key={to} to={to} className={linkClass}>{label.toLowerCase()}</NavLink>
        ))}
      </nav>
      <div className={styles.footer}>
        <NavLink to="/settings" className={linkClass}>settings</NavLink>
        <div className={styles.version}>v1.0</div>
      </div>
    </aside>
  )
}
