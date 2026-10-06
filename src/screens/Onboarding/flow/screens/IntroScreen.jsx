import { useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import Typed from '../Typed'

// The very first thing anyone sees: one line types out, the cursor blinks for
// a beat, "Same." lands, then the arrow arrives.
export default function IntroScreen({ onNext, onSignIn }) {
  const [stage, setStage] = useState(0) // 0: line one, 1: "Same.", 2: arrow

  return (
    <ScreenLayout
      topRight={<button type="button" className={styles.signInLink} onClick={onSignIn}>sign in</button>}
      cta={{ arrow: true, hidden: stage < 2, onClick: onNext }}
    >
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <div className={styles.doneCard}>
          <Typed
            as="div"
            className={styles.needName}
            text="So you got a complicated relationship with anxiety, huh?"
            delay={150}
            hold={1500}
            onDone={() => setStage(s => Math.max(s, 1))}
          />
          <Typed
            as="div"
            className={`${styles.needName} ${styles.introSame}`}
            text="Same."
            run={stage >= 1}
            hold={600}
            onDone={() => setStage(s => Math.max(s, 2))}
          />
        </div>
      </div>
    </ScreenLayout>
  )
}
