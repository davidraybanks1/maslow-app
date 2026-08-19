import { NavLink } from 'react-router-dom'
import styles from './TabBar.module.css'

function TodayIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      {active
        ? <circle cx="9" cy="9" r="3" fill="currentColor"/>
        : <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
      }
    </svg>
  )
}


function DataIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill={active ? 'currentColor' : 'none'} aria-hidden="true">
      <rect x="1.5" y="10" width="4" height="7" rx="1" stroke={active ? undefined : 'currentColor'} strokeWidth={active ? undefined : 1.5}/>
      <rect x="7" y="6" width="4" height="11" rx="1" stroke={active ? undefined : 'currentColor'} strokeWidth={active ? undefined : 1.5}/>
      <rect x="12.5" y="2" width="4" height="15" rx="1" stroke={active ? undefined : 'currentColor'} strokeWidth={active ? undefined : 1.5}/>
    </svg>
  )
}

function ReviewIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M15 9A6 6 0 1 1 11.4 3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {active
        ? <polygon points="11,1.5 14.5,4.5 11,6" fill="currentColor"/>
        : <path d="M11 1.5L14.5 4.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  )
}

const TABS = [
  { to: '/today',  label: 'today',  Icon: TodayIcon },
  { to: '/data',   label: 'data',   Icon: DataIcon },
  { to: '/log',    label: 'review', Icon: ReviewIcon },
]

export default function TabBar() {
  return (
    <nav className={styles.bar} aria-label="Primary">
      <div className={styles.capsule}>
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span className={styles.label}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
