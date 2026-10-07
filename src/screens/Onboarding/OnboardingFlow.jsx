import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './flow/Flow.module.css'
import Progress from './flow/Progress'
import { REDUCED_MOTION } from './flow/Typed'
import {
  FLOW_NEEDS, PROGRESS_AT, SORT_FROM, SORT_TO, NOTES_NEEDED, NOTES_MAX,
  applyRank, settleRanks, countRankScreens, recommendationFrom, ZONE_BY_KEY, emptyPlaced,
} from './flow/data'
import WelcomeScreen from './flow/screens/WelcomeScreen'
import IntroScreen from './flow/screens/IntroScreen'
import HypothesesScreen from './flow/screens/HypothesesScreen'
import HowScreen from './flow/screens/HowScreen'
import SortScreen from './flow/screens/SortScreen'
import RankScreen from './flow/screens/RankScreen'
import RecapScreen from './flow/screens/RecapScreen'
import GlimpseScreen from './flow/screens/GlimpseScreen'
import NotesScreen from './flow/screens/NotesScreen'
import OnboardingAccount from './OnboardingAccount'
import { ALMANAC_PREVIEW, warmPreviews } from './flow/previews'

const OLD_SS_KEY = 'maslow_onboarding_v1' // the retired diagnostic flow's saved answers
const EXIT_MS = 160

// The first-run flow: the Loam welcome splash, a short hook, sorting the needs
// into modes, a glimpse of the almanac, then picking notes to self, and
// finally the account step, which saves everything.
//
// Saved: the canvas (needs in modes) with its starter practices, and the notes
// to self.
export default function OnboardingFlow({ updateCanvas, completeOnboarding }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('welcome')
  const [leaving, setLeaving] = useState(false)
  const busy = useRef(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  // The "after a week" render is fetched while the sorting is going on.
  useEffect(() => {
    if (step === 'sort' || step === 'rank' || step === 'recap') warmPreviews(ALMANAC_PREVIEW)
  }, [step])

  const [placed, setPlaced] = useState(emptyPlaced)
  const [sortedCount, setSortedCount] = useState(0)
  const [rank, setRank] = useState({ zoneKey: null, index: 0, total: 0 })
  const [origin, setOrigin] = useState({})
  const [notes, setNotes] = useState({ picked: [], own: [] })

  // Fade out, swap the step (and any state that belongs to it) at the moment
  // the old screen is gone, fade in.
  const go = useCallback((next, apply) => {
    if (busy.current) return
    busy.current = true
    const swap = () => {
      if (apply) apply()
      setStep(next)
      setLeaving(false)
      busy.current = false
    }
    if (REDUCED_MOTION) { swap(); return }
    setLeaving(true)
    timer.current = setTimeout(swap, EXIT_MS)
  }, [])

  const onSortDone = useCallback(finished => {
    const settled = settleRanks(finished)
    const total = countRankScreens(finished)
    const from = {}
    for (const [zoneKey, ids] of Object.entries(finished)) ids.forEach(id => { from[id] = zoneKey })
    go(settled.zone ? 'rank' : 'recap', () => {
      setPlaced(settled.placed)
      setOrigin(from)
      setRank({ zoneKey: settled.zone ? settled.zone.key : null, index: 0, total })
    })
  }, [go])

  function onRankConfirm(selected) {
    const next = applyRank(placed, rank.zoneKey, selected)
    const settled = settleRanks(next)
    go(settled.zone ? 'rank' : 'recap', () => {
      setPlaced(settled.placed)
      if (settled.zone) setRank(r => ({ ...r, zoneKey: settled.zone.key, index: r.index + 1 }))
    })
  }

  const notesTotal = notes.picked.length + notes.own.length

  function finishNotes() {
    // The canvas is saved locally before the account step, as the old flow did.
    const rec = recommendationFrom(placed)
    if (updateCanvas) {
      for (const [needId, mode] of Object.entries(rec.universal)) updateCanvas(needId, mode)
      for (const [needId, mode] of Object.entries(rec.personal)) updateCanvas(needId, mode)
    }
    go('account')
  }

  function handleAccountDone(dest, userId, canvas, seeded) {
    try { sessionStorage.removeItem(OLD_SS_KEY) } catch { /* private mode */ }
    // Pass the canvas and seeded rows so state is fully populated before
    // navigating, without waiting on a reload or the sign-in restore path.
    if (completeOnboarding) completeOnboarding(
      canvas || null,
      seeded?.practices || null,
      userId ? { userId } : undefined,
      seeded?.practicesDB || null,
      seeded?.noteDeck || null,
    )
    navigate(dest)
  }

  let progress
  if (step === 'sort') progress = SORT_FROM + (SORT_TO - SORT_FROM) * (sortedCount / FLOW_NEEDS.length)
  else if (step === 'account') progress = 1
  else if (step === 'notes') progress = notesTotal >= NOTES_NEEDED ? 1 : 0.96
  else progress = PROGRESS_AT[step] ?? 0

  let screen
  let key = step
  switch (step) {
    case 'welcome':
      screen = <WelcomeScreen onNext={() => go('intro')} />
      break
    case 'intro':
      screen = <IntroScreen onNext={() => go('hypotheses')} onSignIn={() => navigate('/signin')} />
      break
    case 'hypotheses':
      screen = <HypothesesScreen onNext={() => go('how')} />
      break
    case 'how':
      screen = <HowScreen onNext={() => go('sort', () => { setPlaced(emptyPlaced()); setSortedCount(0) })} />
      break
    case 'sort':
      screen = <SortScreen onProgress={setSortedCount} onDone={onSortDone} />
      break
    case 'rank': {
      key = `rank-${rank.index}`
      screen = (
        <RankScreen
          zone={ZONE_BY_KEY[rank.zoneKey]}
          origin={origin}
          placed={placed}
          step={rank.index + 1}
          total={rank.total}
          onConfirm={onRankConfirm}
        />
      )
      break
    }
    case 'recap':
      screen = <RecapScreen placed={placed} onNext={() => go('almanac')} />
      break
    case 'almanac':
      screen = (
        <GlimpseScreen
          slices={ALMANAC_PREVIEW}
          alt="The almanac screen after some use: streaks, daily rhythm, moods, roots, vibrations and strata."
          body="You’ll start to see a bunch of insights in the app that help show what’s working and what to tweak."
          onNext={() => go('notes')}
        />
      )
      break
    case 'account':
      screen = (
        <OnboardingAccount
          destination="/today"
          recommendation={recommendationFrom(placed)}
          practicesDraft={{}}
          notes={[...notes.picked, ...notes.own].slice(0, NOTES_MAX)}
          onDone={handleAccountDone}
          onBack={() => go('notes')}
        />
      )
      break
    case 'notes':
      screen = <NotesScreen notes={notes} onChange={setNotes} onDone={finishNotes} />
      break
    default:
      screen = null
  }

  // The welcome splash and the screens holding the big preview windows fade
  // without sliding, so their artwork is never painted inside a moving layer.
  const plain = step === 'welcome' || step === 'almanac'

  return (
    <div className={styles.root}>
      <Progress value={progress} />
      <div key={key} className={`${styles.screen} ${leaving ? styles.screenOut : styles.screenIn}${plain ? ` ${styles.screenPlain}` : ''}`}>
        {screen}
      </div>
    </div>
  )
}
