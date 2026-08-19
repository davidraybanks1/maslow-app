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

function ReflectIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      {active
        ? <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
        : <circle cx="9" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      }
      <path d="M5.5 11.5 A5 5 0 0 1 12.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M2.5 14 A9 9 0 0 1 15.5 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

const TABS = [
  { to: '/today',  label: 'today',   Icon: TodayIcon },
  { to: '/data',   label: 'data',    Icon: DataIcon },
  { to: '/log',    label: 'reflect', Icon: ReflectIcon },
]

export default function TabBar() {
  return (
    <nav className={styles.bar} aria-label="Primary">
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
    </nav>
  )
}
