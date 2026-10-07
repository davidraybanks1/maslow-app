import { useEffect, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import { REDUCED_MOTION } from '../Typed'
import useTimeline from '../useTimeline'
import LoamSplash, { SPLASH_MS } from '../../../../components/LoamSplash'

// The very first screen: the Loam mark builds itself, "Welcome to Loam." lands,
// and then the arrow arrives.
export default function WelcomeScreen({ onNext }) {
  const at = useTimeline()
  const [arrow, setArrow] = useState(REDUCED_MOTION)

  useEffect(() => {
    if (REDUCED_MOTION) return
    // a beat after the last line settles
    at(SPLASH_MS + 250, () => setArrow(true))
  }, [at])

  return (
    <ScreenLayout cta={{ arrow: true, hidden: !arrow, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage} ${styles.welcomeStage}`}>
        <LoamSplash />
      </div>
    </ScreenLayout>
  )
}
