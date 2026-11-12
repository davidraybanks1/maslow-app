import { useEffect, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import Typed, { typingMs, REDUCED_MOTION } from '../Typed'
import useTimeline from '../useTimeline'

const HEAD = 'Loam is built on two hypotheses:'
const NUM1 = '1.'
const A1 = 'Anxiety fills the space we give it.'
const B1 = 'And we can give it less.'
const NUM2 = '2.'
const A2 = 'Our realities are defined by the stories we tell ourselves.'
const B2 = 'And we can edit them.'

const PAUSE = 1000 // the cursor blinks alone after "1." before the sentence
const NUM2_GAP = 80 // "2." hands its caret straight to the sentence

// Beat by beat, each gap measured from the last character of the line before it:
//   the lead-in writes on (once the screen transition has settled)
//   "1.", the cursor blinks, hypothesis 1 first half
//   700ms, "And we can give it less."
//   800ms, "2." and hypothesis 2 first half
//   700ms, "And we can edit them."
//   600ms, the arrow
// typingMs already counts the beat after a line's closing full stop, so that
// beat comes off each gap.
const STOP = 198 // the full-stop beat at the end of each of these lines (28 + 170)
const after = (text, gap) => typingMs(text) + gap - (REDUCED_MOTION ? 0 : STOP)
const HEAD_AT = 620
const ONE_AT = 2000
const PART_B_AT = ONE_AT + typingMs(NUM1) + PAUSE + after(A1, 700)
const TWO_AT = PART_B_AT + after(B1, 800)
const PART_B2_AT = TWO_AT + typingMs(NUM2) + NUM2_GAP + after(A2, 700)
const ARROW_AT = PART_B2_AT + after(B2, 600)

export default function HypothesesScreen({ onNext }) {
  const at = useTimeline()
  const [b, setB] = useState(REDUCED_MOTION
    ? { head: true, one: true, partB: true, two: true, partB2: true, arrow: true }
    : {})
  const set = patch => setB(prev => ({ ...prev, ...patch }))

  useEffect(() => {
    if (REDUCED_MOTION) return
    at(HEAD_AT, () => set({ head: true }))
    at(ONE_AT, () => set({ one: true }))
    at(PART_B_AT, () => set({ partB: true }))
    at(TWO_AT, () => set({ two: true }))
    at(PART_B2_AT, () => set({ partB2: true }))
    at(ARROW_AT, () => set({ arrow: true }))
  }, [at])

  return (
    <ScreenLayout cta={{ arrow: true, hidden: !b.arrow, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <div>
          <Typed as="div" className={styles.hypHead} text={HEAD} run={!!b.head} />
          <div className={styles.hypItem}>
            <Typed className={styles.hookListNum} text={NUM1} run={!!b.one} hold={PAUSE} />
            <span>
              <Typed text={A1} run={!!b.one} delay={typingMs(NUM1) + PAUSE} />
              <Typed className={styles.hypPartB} text={B1} run={!!b.partB} />
            </span>
          </div>
          <div className={styles.hypItem}>
            <Typed className={styles.hookListNum} text={NUM2} run={!!b.two} linger={0} />
            <span>
              <Typed text={A2} run={!!b.two} delay={typingMs(NUM2) + NUM2_GAP} />
              <Typed className={styles.hypPartB} text={B2} run={!!b.partB2} />
            </span>
          </div>
        </div>
      </div>
    </ScreenLayout>
  )
}
