import { useEffect, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import { REDUCED_MOTION } from '../Typed'
import useTimeline from '../useTimeline'
import LoamSplash, { SPLASH_MS } from '../../../../components/LoamSplash'

// The very first screen: the stones build themselves over the wordmark, then
// "begin" arrives. A tap anywhere (or any key) finishes the animation and shows
// it at once; with reduced motion it is all there from the start. Someone who
// already has an account can sign in from the first moment.
export default function WelcomeScreen({ onNext, onSignIn }) {
  const at = useTimeline()
  const [ready, setReady] = useState(REDUCED_MOTION)

  useEffect(() => {
    if (REDUCED_MOTION) return
    at(SPLASH_MS + 250, () => setReady(true))
  }, [at])

  useEffect(() => {
    if (ready) return undefined
    const onKey = () => setReady(true)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready])

  return (
    <ScreenLayout
      bare
      bottomLeft={<button type="button" className={`${styles.signInLink} ${styles.signInBottom}`} onClick={onSignIn}>sign in</button>}
      cta={{ label: 'begin →', hidden: !ready, onClick: onNext }}
    >
      <div className={styles.welcome} onClick={() => setReady(true)}>
        <div className={styles.welcomeHead}><span>VOL. 01</span><span>A DAYBOOK</span></div>
        <h1 className={styles.welcomeLine}>anxiety isn&apos;t who you are.<br />it&apos;s who you aren&apos;t.</h1>
        <p className={styles.welcomeSub}>AN APP FOR LIVING<br />BEYOND SURVIVAL-MODE</p>
        <div className={styles.welcomeFoot}>
          <div className={styles.welcomeStones}><LoamSplash bare skip={ready} /></div>
          <div className={styles.welcomeWord}>loam.</div>
        </div>
      </div>
    </ScreenLayout>
  )
}
