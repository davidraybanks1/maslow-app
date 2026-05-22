import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAppState } from './lib/store'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import CanvasScreen from './screens/CanvasScreen'
import Intentions from './screens/Intentions'
import Log from './screens/Log'
import Summary from './screens/Summary'
import Gallery from './screens/Gallery'
import styles from './App.module.css'

function BottomNav() {
  return (
    <nav className={styles.bottomNav}>
      <NavLink to="/today" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
        <div className={styles.navDot} />
        <span className={styles.navLabel}>today</span>
      </NavLink>
      <NavLink to="/canvas" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
        <div className={styles.navDot} />
        <span className={styles.navLabel}>canvas</span>
      </NavLink>
      <NavLink to="/intentions" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
        <div className={styles.navDot} />
        <span className={styles.navLabel}>intentions</span>
      </NavLink>
      <NavLink to="/log" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
        <div className={styles.navDot} />
        <span className={styles.navLabel}>log</span>
      </NavLink>
      <NavLink to="/summary" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
        <div className={styles.navDot} />
        <span className={styles.navLabel}>summary</span>
      </NavLink>
      <NavLink to="/gallery" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
        <div className={styles.navDot} />
        <span className={styles.navLabel}>gallery</span>
      </NavLink>
    </nav>
  )
}

function Protected({ children, onboarded }) {
  if (!onboarded) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  const { state, authLoading, updateCanvas, checkIn, setIntention, completeOnboarding } = useAppState()

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink3)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        loading...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className={styles.shell}>
        <div className={styles.content}>
          <Routes>
            <Route path="/" element={state.onboarded ? <Navigate to="/today" replace /> : <Navigate to="/onboarding" replace />} />
            <Route path="/onboarding" element={state.onboarded ? <Navigate to="/today" replace /> : <Onboarding completeOnboarding={completeOnboarding} />} />
            <Route path="/today" element={<Protected onboarded={state.onboarded}><Today state={state} checkIn={checkIn} /></Protected>} />
            <Route path="/canvas" element={<Protected onboarded={state.onboarded}><CanvasScreen state={state} updateCanvas={updateCanvas} /></Protected>} />
            <Route path="/intentions" element={<Protected onboarded={state.onboarded}><Intentions state={state} setIntention={setIntention} /></Protected>} />
            <Route path="/log" element={<Protected onboarded={state.onboarded}><Log state={state} /></Protected>} />
            <Route path="/summary" element={<Protected onboarded={state.onboarded}><Summary state={state} /></Protected>} />
            <Route path="/gallery" element={<Protected onboarded={state.onboarded}><Gallery state={state} /></Protected>} />
          </Routes>
        </div>
        {state.onboarded && <BottomNav />}
      </div>
    </BrowserRouter>
  )
}