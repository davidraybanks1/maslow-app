import { useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import Typed, { typingMs, REDUCED_MOTION } from '../Typed'

const LEAD = 'But, like, how?'
const P1 = 'Well, you’re going to sort out what matters to you–those things actually deserve your attention.'
const P2 = 'Then Loam will help you track what’s working and what to tweak, with data and stuff.'

const START = 120      // before the lead starts
const GAP = 480        // beat between one block and the next (the caret waits through it)

// Everything types out, one block after another with the caret handed along:
// "But, like, how?", then the two paragraphs, then the arrow.
export default function HowScreen({ onNext }) {
  const [arrow, setArrow] = useState(REDUCED_MOTION)

  const d1 = START + typingMs(LEAD) + GAP
  const d2 = d1 + typingMs(P1) + GAP

  return (
    <ScreenLayout cta={{ arrow: true, hidden: !arrow, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <Typed
          as="div"
          className={`${styles.hookBody} ${styles.hookEmphasis} ${styles.howLead}`}
          text={LEAD}
          delay={START}
          linger={GAP}
        />
        <Typed
          as="div"
          className={styles.hookBody}
          style={{ marginTop: 22 }}
          text={P1}
          delay={d1}
          linger={GAP}
        />
        <Typed
          as="div"
          className={styles.hookBody}
          style={{ marginTop: 18 }}
          text={P2}
          delay={d2}
          hold={600}
          onDone={() => setArrow(true)}
        />
      </div>
    </ScreenLayout>
  )
}
