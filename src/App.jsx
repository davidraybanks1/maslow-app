import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from './lib/store'
import DiagnosticFlow from './screens/Onboarding/DiagnosticFlow'
import Today from './screens/Today'
import CanvasScreen from './screens/CanvasScreen'
import Practices from './screens/Practices'
import Data from './screens/Data'
import Log from './screens/Log'
import Debriefs from './screens/Debriefs'
import SignIn from './screens/SignIn'
import ComingSoon from './screens/ComingSoon'
import UpdatePassword from './screens/UpdatePassword'
import HamburgerMenu from './components/HamburgerMenu'
import AppHeader from './components/AppHeader'
import styles from './App.module.css'

function Protected({ children, onboarded }) {
  if (!onboarded) return <Navigate to="/onboarding" replace />
  return children
}

function AppInner() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { state, authLoading, updateCanvas, addPractice, removePractice, checkIn, logMood, completeOnboarding } = useAppState(
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
      {state.onboarded && (
        <div className={styles.appHeader}>
          <AppHeader onMenuOpen={() => setMenuOpen(true)} />
        </div>
      )}
      <div className={styles.content}>
        <Routes>
          <Route path="/" element={state.onboarded ? <Navigate to="/today" replace /> : <Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={state.onboarded ? <Navigate to="/today" replace /> : <DiagnosticFlow updateCanvas={updateCanvas} onComplete={() => { completeOnboarding(); navigate('/practices') }} />} />
          <Route path="/today" element={<Protected onboarded={state.onboarded}><Today state={state} checkIn={checkIn} logMood={logMood} /></Protected>} />
          <Route path="/canvas" element={<Protected onboarded={state.onboarded}><CanvasScreen state={state} updateCanvas={updateCanvas} /></Protected>} />
          <Route path="/practices" element={<Protected onboarded={state.onboarded}><Practices state={state} addPractice={addPractice} removePractice={removePractice} /></Protected>} />
          <Route path="/data" element={<Protected onboarded={state.onboarded}><Data state={state} /></Protected>} />
          <Route path="/log" element={<Protected onboarded={state.onboarded}><Log state={state} /></Protected>} />
          <Route path="/debriefs" element={<Protected onboarded={state.onboarded}><Debriefs state={state} /></Protected>} />
          <Route path="/diagnostic" element={<Protected onboarded={state.onboarded}><DiagnosticFlow updateCanvas={updateCanvas} /></Protected>} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/password" element={<Protected onboarded={state.onboarded}><UpdatePassword /></Protected>} />
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
