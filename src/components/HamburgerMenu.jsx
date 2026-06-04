import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  IconHome,
  IconLayoutGrid,
  IconList,
  IconChartBar,
  IconLock,
  IconBell,
  IconExternalLink,
  IconLogout,
} from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import styles from './HamburgerMenu.module.css'

const NAV_LINKS = [
  { to: '/today',     label: 'Today',     Icon: IconHome },
  { to: '/canvas',    label: 'Canvas',    Icon: IconLayoutGrid },
  { to: '/practices', label: 'Practices', Icon: IconList },
  { to: '/data',      label: 'Data',      Icon: IconChartBar },
]

export default function HamburgerMenu({ onClose }) {
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    onClose()
    navigate('/onboarding')
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>

        <nav className={styles.nav}>
          {NAV_LINKS.map(({ to, label, Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              >
                <span>{label}</span>
                <Icon size={16} strokeWidth={1.5} />
              </Link>
            )
          })}
        </nav>

        <div className={styles.secondary}>
          <Link to="/password" onClick={onClose} className={styles.secondaryItem}>
            <span>Update password</span>
            <IconLock size={15} strokeWidth={1.5} />
          </Link>
          <Link to="/notifications" onClick={onClose} className={styles.secondaryItem}>
            <span>Notifications</span>
            <IconBell size={15} strokeWidth={1.5} />
          </Link>
          <a
            href="https://mymaslow.com/privacy"
            target="_blank"
            rel="noreferrer"
            className={styles.secondaryItem}
          >
            <span>Privacy policy</span>
            <IconExternalLink size={15} strokeWidth={1.5} />
          </a>
          <a
            href="https://mymaslow.com/terms"
            target="_blank"
            rel="noreferrer"
            className={styles.secondaryItem}
          >
            <span>Terms of service</span>
            <IconExternalLink size={15} strokeWidth={1.5} />
          </a>
          <button onClick={handleSignOut} className={styles.signOut}>
            <span>Sign out</span>
            <IconLogout size={15} strokeWidth={1.5} />
          </button>
        </div>

        <div className={styles.version}>v1.0</div>
      </div>
    </div>
  )
}
