import { NavLink } from 'react-router-dom'
import styles from './DesktopNav.module.css'
import BrandMark from './BrandMark'

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


export default function DesktopNav() {
  const linkClass = ({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`
  return (
    <aside className={styles.nav} aria-label="Primary">
      <div className={styles.brand}>
        <BrandMark size={17} />
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
