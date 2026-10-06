import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './flow/Flow.module.css'
import Progress from './flow/Progress'
import { REDUCED_MOTION } from './flow/Typed'
import {
  FLOW_NEEDS, PROGRESS_AT, SORT_FROM, SORT_TO, NOTES_NEEDED, NOTES_MAX,
  applyRank, rankQueueFor, recommendationFrom, ZONE_BY_KEY, emptyPlaced,
} from './flow/data'
import IntroScreen from './flow/screens/IntroScreen'
import HypothesesScreen from './flow/screens/HypothesesScreen'
import HowScreen from './flow/screens/HowScreen'
import SortScreen from './flow/screens/SortScreen'
import RankScreen from './flow/screens/RankScreen'
import RecapScreen from './flow/screens/RecapScreen'
import CheckinScreen from './flow/screens/CheckinScreen'
import GlimpseScreen from './flow/screens/GlimpseScreen'
import DraftEntryScreen from './flow/screens/DraftEntryScreen'
import NotesScreen from './flow/screens/NotesScreen'
import OnboardingAccount from './OnboardingAccount'
import { ALMANAC_PREVIEW, DRAFTS_PREVIEW, warmPreviews } from './flow/previews'

const OLD_SS_KEY = 'maslow_onboarding_v1' // the retired diagnostic flow's saved answers
const EXIT_MS = 160

// The first-run flow: a short hook, sorting the 13 needs into modes, a taste of
// check-ins, the almanac and drafts, then picking notes to self, and finally
// the account step, which saves everything.
//
// Saved: the canvas (needs in modes) with its starter practices, and the notes
// to self. The vibration check-in and the sample draft are demos only.
export default function OnboardingFlow({ updateCanvas, completeOnboarding }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('intro')
  const [leaving, setLeaving] = useState(false)
  const busy = useRef(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  // The two "after a week" renders are fetched while the sorting is going on.
  useEffect(() => {
    if (step === 'sort' || step === 'rank' || step === 'recap' || step === 'checkin') {
      warmPreviews(ALMANAC_PREVIEW)
      warmPreviews(DRAFTS_PREVIEW)
    }
  }, [step])

  const [placed, setPlaced] = useState(emptyPlaced)
  const [sortedCount, setSortedCount] = useState(0)
  const [rank, setRank] = useState({ queue: [], index: 0 })
  const [vibe, setVibe] = useState({ band: null, feeling: null })
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
    const queue = rankQueueFor(finished).map(z => z.key)
    go(queue.length ? 'rank' : 'recap', () => {
      setPlaced(finished)
      setRank({ queue, index: 0 })
    })
  }, [go])

  function onRankConfirm(selected) {
    const zoneKey = rank.queue[rank.index]
    const next = applyRank(placed, zoneKey, selected)
    const more = rank.index + 1 < rank.queue.length
    go(more ? 'rank' : 'recap', () => {
      setPlaced(next)
      if (more) setRank(r => ({ ...r, index: r.index + 1 }))
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

  if (step === 'account') {
    return (
      <OnboardingAccount
        destination="/today"
        recommendation={recommendationFrom(placed)}
        practicesDraft={{}}
        notes={[...notes.picked, ...notes.own].slice(0, NOTES_MAX)}
        onDone={handleAccountDone}
        onBack={() => go('notes')}
      />
    )
  }

  let progress
  if (step === 'sort') progress = SORT_FROM + (SORT_TO - SORT_FROM) * (sortedCount / FLOW_NEEDS.length)
  else if (step === 'notes') progress = notesTotal >= NOTES_NEEDED ? 1 : 0.96
  else progress = PROGRESS_AT[step] ?? 0

  let screen
  let key = step
  switch (step) {
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
          zone={ZONE_BY_KEY[rank.queue[rank.index]]}
          placed={placed}
          step={rank.index + 1}
          total={rank.queue.length}
          onConfirm={onRankConfirm}
        />
      )
      break
    }
    case 'recap':
      screen = <RecapScreen placed={placed} onNext={() => go('checkin')} />
      break
    case 'checkin':
      screen = <CheckinScreen vibe={vibe} onVibe={setVibe} onNext={() => go('almanac')} />
      break
    case 'almanac':
      screen = (
        <GlimpseScreen
          slices={ALMANAC_PREVIEW}
          alt="The almanac screen after some use: streaks, daily rhythm, moods, roots, vibrations and strata."
          body={'Your tracked practices and vibration check-ins turn into data visualizations that help you see what’s working and what to tweak.'}
          onNext={() => go('draftEntry')}
        />
      )
      break
    case 'draftEntry':
      screen = <DraftEntryScreen vibe={vibe} onNext={() => go('drafts')} />
      break
    case 'drafts':
      screen = (
        <GlimpseScreen
          slices={DRAFTS_PREVIEW}
          alt="The drafts screen after a week of use: a weekly review, most active threads, a wild card and the archive."
          body="Every draft is stored, tagged, and organized so you can identify patterns, challenge the negative ones, and connect the positives."
          onNext={() => go('notes')}
        />
      )
      break
    case 'notes':
      screen = <NotesScreen notes={notes} onChange={setNotes} onDone={finishNotes} />
      break
    default:
      screen = null
  }

  // The screens holding the big preview windows fade without sliding, so the
  // images are never painted inside a moving layer.
  const plain = step === 'almanac' || step === 'drafts'

  return (
    <div className={styles.root}>
      <Progress value={progress} />
      <div key={key} className={`${styles.screen} ${leaving ? styles.screenOut : styles.screenIn}${plain ? ` ${styles.screenPlain}` : ''}`}>
        {screen}
      </div>
    </div>
  )
}
