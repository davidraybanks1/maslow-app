import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAppState } from './lib/store'
import Today from './screens/Today'
import CanvasScreen from './screens/CanvasScreen'
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
      <NavLink to="/gallery" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
        <div className={styles.navDot} />
        <span className={styles.navLabel}>gallery</span>
      </NavLink>
    </nav>
  )
}

function ComingSoon({ name }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 10 }}>
        {name}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink3)', letterSpacing: '0.1em' }}>
        COMING SOON
      </div>
    </div>
  )
}

export default function App() {
  const { state, updateCanvas, checkIn, logFeeling, setIntention } = useAppState()

  return (
    <BrowserRouter>
      <div className={styles.shell}>
        <div className={styles.content}>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={
              <Today state={state} checkIn={checkIn} />
            } />
            <Route path="/canvas" element={
              <CanvasScreen state={state} updateCanvas={updateCanvas} />
            } />
            <Route path="/intentions" element={<ComingSoon name="Weekly Intentions" />} />
            <Route path="/log" element={<ComingSoon name="Feeling Log" />} />
            <Route path="/gallery" element={<ComingSoon name="Gallery" />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
