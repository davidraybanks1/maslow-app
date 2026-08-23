import { useState, useEffect, useLayoutEffect, useRef, Component } from 'react'
import { HeaderSlotContext } from './lib/headerSlot'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useNavigationType } from 'react-router-dom'
import { useAppState, loadCustomTags } from './lib/store'
import { useIsDesktop } from './lib/useIsDesktop'
import { hideSplash, scheduleReminders, isNative } from './lib/native'
import NotifPrimingSheet from './components/NotifPrimingSheet'
import OnboardingTour from './components/OnboardingTour'
import LoadingScreen from './components/LoadingScreen'
import DiagnosticFlow from './screens/Onboarding/DiagnosticFlow'
import Today from './screens/Today'
import CanvasScreen from './screens/CanvasScreen'
import Data from './screens/Data'
import Log from './screens/Log'
import SignIn from './screens/SignIn'
import UpdatePassword from './screens/UpdatePassword'
import AppHeader from './components/AppHeader'
import DesktopNav from './components/DesktopNav'
import TabBar from './components/TabBar'
import UpdateToast from './components/UpdateToast'
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
  const location = useLocation()
  const navType = useNavigationType()
  const contentRef = useRef(null)
  const [headerSlot, setHeaderSlot] = useState(null)

  // Reset scroll on every PUSH navigation (tab taps, in-app links).
  // useLayoutEffect fires synchronously after DOM mutations and before paint,
  // eliminating the one-frame flash of the incoming screen at the old position.
  // POP (browser back/forward) is left alone so position can restore naturally.
  useLayoutEffect(() => {
    if (navType !== 'POP' && contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const isDesktop = useIsDesktop()

  const { state, authLoading, updateCanvas, replaceCanvas, addPractice, renamePractice, archivePractice, removePractice, checkIn, removeCheckin, clearPracticeCheckins, incrementCheckinCount, logMood, completeOnboarding, updateShowNoteToSelf, updateReviewSchedule, updateReviewCadence, updateRemindersEnabled, updateReviewReminderEnabled, updateMoodReminder, markNotifPrimed, markTourSeen, resetTour, updateNoteDeck, syncCheckinDay } = useAppState(
    () => navigate('/today')
  )

  const [customTagCount, setCustomTagCount] = useState(0)
  useEffect(() => {
    if (!state.userId) return
    loadCustomTags(state.userId).then(tags => setCustomTagCount(tags.length))
  }, [state.userId])

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
  const scheduleTimerRef = useRef(null)
  useEffect(() => {
    if (state.onboarded && state.userId) {
      clearTimeout(scheduleTimerRef.current)
      scheduleTimerRef.current = setTimeout(() => {
        scheduleReminders({
          remindersEnabled: state.remindersEnabled,
          moodReminders: state.moodReminders,
          reviewReminderEnabled: state.reviewReminderEnabled,
          reviewCadence: state.reviewCadence,
          reviewDay: state.reviewDay ?? 0,
          reviewTime: state.reviewTime || '10:00',
        })
      }, 600)
    }
    return () => clearTimeout(scheduleTimerRef.current)
  }, [state.onboarded, state.userId, state.remindersEnabled, state.moodReminders, state.reviewReminderEnabled, state.reviewCadence, state.reviewDay, state.reviewTime])

  if (showLoader) {
    const firstName = (state.profile?.name || '').trim().split(' ')[0]
    return <LoadingScreen greeting={firstName ? `hey, ${firstName.toLowerCase()}` : 'hey, you'} fading={loaderFading} />
  }

  return (
    <HeaderSlotContext.Provider value={setHeaderSlot}>
    <div className={styles.shell}>
      {state.onboarded && <DesktopNav name={state.profile.name} email={state.email} showNoteToSelf={state.showNoteToSelf} updateShowNoteToSelf={updateShowNoteToSelf} reviewCadence={state.reviewCadence} updateReviewCadence={updateReviewCadence} reviewDay={state.reviewDay} reviewTime={state.reviewTime} updateReviewSchedule={updateReviewSchedule} remindersEnabled={state.remindersEnabled} updateRemindersEnabled={updateRemindersEnabled} reviewReminderEnabled={state.reviewReminderEnabled} updateReviewReminderEnabled={updateReviewReminderEnabled} moodReminders={state.moodReminders} updateMoodReminder={updateMoodReminder} noteDeckCount={(state.noteDeck || []).length} customTagCount={customTagCount} resetTour={resetTour} />}
      <div className={styles.column}>
      {state.onboarded && (
        <div className={styles.appHeader}>
          <AppHeader slot={headerSlot} name={state.profile.name} email={state.email} showNoteToSelf={state.showNoteToSelf} updateShowNoteToSelf={updateShowNoteToSelf} reviewCadence={state.reviewCadence} updateReviewCadence={updateReviewCadence} reviewDay={state.reviewDay} reviewTime={state.reviewTime} updateReviewSchedule={updateReviewSchedule} remindersEnabled={state.remindersEnabled} updateRemindersEnabled={updateRemindersEnabled} reviewReminderEnabled={state.reviewReminderEnabled} updateReviewReminderEnabled={updateReviewReminderEnabled} moodReminders={state.moodReminders} updateMoodReminder={updateMoodReminder} noteDeckCount={(state.noteDeck || []).length} customTagCount={customTagCount} resetTour={resetTour} />
        </div>
      )}
      <div className={styles.content} ref={contentRef}>
        <Routes>
          <Route path="/" element={state.onboarded ? <Navigate to="/today" replace /> : <Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={state.onboarded ? <Navigate to="/today" replace /> : <DiagnosticFlow updateCanvas={updateCanvas} completeOnboarding={completeOnboarding} />} />
          <Route path="/today" element={<Protected onboarded={state.onboarded} userId={state.userId}><Today state={state} checkIn={checkIn} removeCheckin={removeCheckin} clearPracticeCheckins={clearPracticeCheckins} incrementCheckinCount={incrementCheckinCount} logMood={logMood} onActiveDeckChanged={updateNoteDeck} onCustomTagsChanged={setCustomTagCount} /></Protected>} />
          <Route path="/practices" element={<Navigate to="/canvas" replace />} />
          <Route path="/data" element={<Protected onboarded={state.onboarded} userId={state.userId}><Data state={state} archivePractice={archivePractice} /></Protected>} />
          <Route path="/log" element={<Protected onboarded={state.onboarded} userId={state.userId}><Log state={state} syncCheckinDay={syncCheckinDay} /></Protected>} />
          <Route path="/canvas" element={<Protected onboarded={state.onboarded} userId={state.userId}><CanvasScreen state={state} updateCanvas={updateCanvas} addPractice={addPractice} renamePractice={renamePractice} archivePractice={archivePractice} /></Protected>} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/password" element={<Protected onboarded={state.onboarded} userId={state.userId}><UpdatePassword /></Protected>} />
          <Route path="/settings" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>
      </div>
      {state.onboarded && <TabBar />}
      {isNative() && state.onboarded && state.userId && state.notifPrimedAt == null && state.tourSeenAt != null && (
        <NotifPrimingSheet updateRemindersEnabled={updateRemindersEnabled} markNotifPrimed={markNotifPrimed} />
      )}
      {location.pathname === '/today' && state.onboarded && state.userId && state.tourSeenAt == null && (
        <OnboardingTour markTourSeen={markTourSeen} />
      )}
    </div>
    </HeaderSlotContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <AppInner />
      </AppErrorBoundary>
      <UpdateToast />
    </BrowserRouter>
  )
}
