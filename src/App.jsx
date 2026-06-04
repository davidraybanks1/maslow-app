import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from './lib/store'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import CanvasScreen from './screens/CanvasScreen'
import Practices from './screens/Practices'
import Data from './screens/Data'
import SignIn from './screens/SignIn'
import ComingSoon from './screens/ComingSoon'
import HamburgerMenu from './components/HamburgerMenu'
import styles from './App.module.css'

function Protected({ children, onboarded }) {
  if (!onboarded) return <Navigate to="/onboarding" replace />
  return children
}

function AppInner() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { state, authLoading, updateCanvas, addPractice, removePractice, checkIn, completeOnboarding } = useAppState(
    () => navigate('/today')
  )

  if (authLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
        loading...
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <Routes>
          <Route path="/" element={state.onboarded ? <Navigate to="/today" replace /> : <Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={state.onboarded ? <Navigate to="/today" replace /> : <Onboarding completeOnboarding={completeOnboarding} />} />
          <Route path="/today" element={<Protected onboarded={state.onboarded}><Today state={state} checkIn={checkIn} onMenuOpen={() => setMenuOpen(true)} /></Protected>} />
          <Route path="/canvas" element={<Protected onboarded={state.onboarded}><CanvasScreen state={state} updateCanvas={updateCanvas} /></Protected>} />
          <Route path="/practices" element={<Protected onboarded={state.onboarded}><Practices state={state} addPractice={addPractice} removePractice={removePractice} /></Protected>} />
          <Route path="/data" element={<Protected onboarded={state.onboarded}><Data state={state} /></Protected>} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/password" element={<Protected onboarded={state.onboarded}><ComingSoon title="Update password" /></Protected>} />
          <Route path="/notifications" element={<Protected onboarded={state.onboarded}><ComingSoon title="Notifications" /></Protected>} />
        </Routes>
      </div>
      {menuOpen && <HamburgerMenu onClose={() => setMenuOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
