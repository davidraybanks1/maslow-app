import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'

// The very first screen: the cover. Dateline, the line, the giant wordmark on
// its rule. It all arrives together with a short fade (none with reduced
// motion), and "begin" and "sign in" work from the first moment.
export default function WelcomeScreen({ onNext, onSignIn }) {
  return (
    <ScreenLayout
      bare
      bottomLeft={<button type="button" className={`${styles.signInLink} ${styles.signInBottom}`} onClick={onSignIn}>sign in</button>}
      cta={{ label: 'begin →', onClick: onNext }}
    >
      <div className={styles.welcome}>
        <div className={styles.welcomeHead}><span>VOL. 01</span><span>A DAYBOOK</span></div>
        <h1 className={styles.welcomeLine}>anxiety isn’t who you are.<br />it’s who you aren’t.</h1>
        <div className={styles.welcomeFoot}>
          <div className={styles.welcomeWord}>loam<span className={styles.welcomeDot}>.</span></div>
        </div>
      </div>
    </ScreenLayout>
  )
}
