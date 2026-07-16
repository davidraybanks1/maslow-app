import { useState, useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAppState } from './lib/store'
import { hideSplash, scheduleReminders } from './lib/native'
import LoadingScreen from './components/LoadingScreen'
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
import Settings from './screens/Settings'
import HamburgerMenu from './components/HamburgerMenu'
import AppHeader from './components/AppHeader'
import DesktopNav from './components/DesktopNav'
import styles from './App.module.css'

class AppErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24, fontFamily: 'var(--font-mono)', color: 'var(--ink3)', textAlign: 'center' }}>
          <div style={{ fontSize: 13 }}>something went wrong</div>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ fontSize: 12, padding: '8px 20px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--ink)' }}>
            reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Protected({ children, onboarded, userId }) {
  if (!onboarded) return <Navigate to="/onboarding" replace />
  if (!userId) return <Navigate to="/signin" replace />
  return children
}

const PREFERS_REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const RITUAL_MS    = PREFERS_REDUCED_MOTION ? 1200 : 4800 // full choreography: pushes 0.45–2.95s, center+burst 3.05–4.8s
const LOADER_FADE_MS = 350 // matches --motion-page

function AppInner() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuClosing, setMenuClosing] = useState(false)
  function closeMenu() {
    setMenuClosing(true)
    setTimeout(() => { setMenuOpen(false); setMenuClosing(false) }, 200)
  }

  // Ritual timer: loader never dismisses before RITUAL_MS, even on instant init
  const [ritualElapsed, setRitualElapsed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setRitualElapsed(true), RITUAL_MS)
    return () => clearTimeout(t)
  }, [])

  // Loader fade-out state — keep component mounted through the 350ms opacity transition
  const [loaderFading, setLoaderFading] = useState(false)
  // The ritual greeting plays once per day. Every other open renders the app
  // instantly from cached local state while auth resolves in the background.
  const [showLoader, setShowLoader] = useState(() => {
    try { return localStorage.getItem('maslow_last_ritual') !== new Date().toDateString() } catch { return true }
  })

  const { state, authLoading, updateCanvas, replaceCanvas, addPractice, removePractice, checkIn, removeCheckin, clearPracticeCheckins, logMood, completeOnboarding, updateShowNoteToSelf, updateReviewSchedule } = useAppState(
    () => navigate('/today')
  )

  // Dismiss once the ritual timer elapses. A cached session is enough to enter
  // the app — we never make a returning user wait on the auth round-trip.
  const hasCachedSession = state.onboarded && !!state.userId
  useEffect(() => {
    if ((hasCachedSession || !authLoading) && ritualElapsed && showLoader && !loaderFading) {
      setLoaderFading(true)
      try { localStorage.setItem('maslow_last_ritual', new Date().toDateString()) } catch {}
      setTimeout(() => setShowLoader(false), LOADER_FADE_MS)
    }
  }, [authLoading, hasCachedSession, ritualElapsed])

  // Native shell: dismiss the iOS splash once we're rendering (loader or app),
  // and keep the local reminder schedule in sync with the review settings.
  useEffect(() => { hideSplash() }, [])
  useEffect(() => {
    if (state.onboarded && state.userId) {
      scheduleReminders({ reviewDay: state.reviewDay ?? 0, reviewTime: state.reviewTime || '10:00' })
    }
  }, [state.onboarded, state.userId, state.reviewDay, state.reviewTime])

  if (showLoader) {
    const firstName = (state.profile?.name || '').trim().split(' ')[0]
    return <LoadingScreen greeting={firstName ? `hey, ${firstName.toLowerCase()}` : 'hey, you'} fading={loaderFading} />
  }

  return (
    <div className={styles.shell}>
      {state.onboarded && <DesktopNav />}
      <div className={styles.column}>
      {state.onboarded && (
        <div className={styles.appHeader}>
          <AppHeader onMenuOpen={() => setMenuOpen(true)} />
        </div>
      )}
      <div className={styles.content}>
        <Routes>
          <Route path="/" element={state.onboarded ? <Navigate to="/today" replace /> : <Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={state.onboarded ? <Navigate to="/today" replace /> : <DiagnosticFlow updateCanvas={updateCanvas} completeOnboarding={completeOnboarding} />} />
          <Route path="/today" element={<Protected onboarded={state.onboarded} userId={state.userId}><Today state={state} checkIn={checkIn} removeCheckin={removeCheckin} clearPracticeCheckins={clearPracticeCheckins} logMood={logMood} /></Protected>} />
          <Route path="/practices" element={<Protected onboarded={state.onboarded} userId={state.userId}><Practices state={state} addPractice={addPractice} removePractice={removePractice} completeOnboarding={completeOnboarding} /></Protected>} />
          <Route path="/debriefs" element={<Protected onboarded={state.onboarded} userId={state.userId}><Debriefs state={state} /></Protected>} />
          <Route path="/data" element={<Protected onboarded={state.onboarded} userId={state.userId}><Data state={state} /></Protected>} />
          <Route path="/log" element={<Protected onboarded={state.onboarded} userId={state.userId}><Log state={state} /></Protected>} />
          <Route path="/canvas" element={<Protected onboarded={state.onboarded} userId={state.userId}><CanvasScreen state={state} updateCanvas={updateCanvas} replaceCanvas={replaceCanvas} /></Protected>} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/password" element={<Protected onboarded={state.onboarded} userId={state.userId}><UpdatePassword /></Protected>} />
          <Route path="/notifications" element={<Protected onboarded={state.onboarded} userId={state.userId}><ComingSoon title="Notifications" /></Protected>} />
          <Route path="/settings" element={<Protected onboarded={state.onboarded} userId={state.userId}><Settings state={state} updateShowNoteToSelf={updateShowNoteToSelf} updateReviewSchedule={updateReviewSchedule} /></Protected>} />
        </Routes>
      </div>
      </div>
      {menuOpen && <HamburgerMenu onClose={closeMenu} isClosing={menuClosing} />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <AppInner />
      </AppErrorBoundary>
    </BrowserRouter>
  )
}
