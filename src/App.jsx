import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAppState } from './lib/store'
import Onboarding from './screens/Onboarding'
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

function Protected({ children, onboarded }) {
  if (!onboarded) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  const { state, updateCanvas, checkIn, completeOnboarding } = useAppState()

  return (
    <BrowserRouter>
      <div className={styles.shell}>
        <div className={styles.content}>
          <Routes>
            <Route path="/" element={
              state.onboarded
                ? <Navigate to="/today" replace />
                : <Navigate to="/onboarding" replace />
            } />
            <Route path="/onboarding" element={
              state.onboarded
                ? <Navigate to="/today" replace />
                : <Onboarding completeOnboarding={completeOnboarding} />
            } />
            <Route path="/today" element={
              <Protected onboarded={state.onboarded}>
                <Today state={state} checkIn={checkIn} />
              </Protected>
            } />
            <Route path="/canvas" element={
              <Protected onboarded={state.onboarded}>
                <CanvasScreen state={state} updateCanvas={updateCanvas} />
              </Protected>
            } />
            <Route path="/intentions" element={
              <Protected onboarded={state.onboarded}>
                <ComingSoon name="Weekly Intentions" />
              </Protected>
            } />
            <Route path="/log" element={
              <Protected onboarded={state.onboarded}>
                <ComingSoon name="Feeling Log" />
              </Protected>
            } />
            <Route path="/gallery" element={
              <Protected onboarded={state.onboarded}>
                <ComingSoon name="Gallery" />
              </Protected>
            } />
          </Routes>
        </div>
        {state.onboarded && <BottomNav />}
      </div>
    </BrowserRouter>
  )
}