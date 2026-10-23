import { useEffect, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import { REDUCED_MOTION } from '../Typed'
import useTimeline from '../useTimeline'
import LoamSplash, { SPLASH_MS } from '../../../../components/LoamSplash'

// The very first screen: the Loam mark builds itself, "Welcome to Loam." lands,
// and then the arrow arrives. Someone who already has an account can sign in
// from the first moment, without waiting for the arrow.
export default function WelcomeScreen({ onNext, onSignIn }) {
  const at = useTimeline()
  const [arrow, setArrow] = useState(REDUCED_MOTION)

  useEffect(() => {
    if (REDUCED_MOTION) return
    // a beat after the last line settles
    at(SPLASH_MS + 250, () => setArrow(true))
  }, [at])

  return (
    <ScreenLayout
      topRight={<button type="button" className={styles.signInLink} onClick={onSignIn}>sign in</button>}
      cta={{ arrow: true, hidden: !arrow, onClick: onNext }}
    >
      <div className={`${styles.cardStage} ${styles.introStage} ${styles.welcomeStage}`}>
        <LoamSplash />
      </div>
    </ScreenLayout>
  )
}
