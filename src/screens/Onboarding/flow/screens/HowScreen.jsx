import { useEffect, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import Typed, { typingMs, REDUCED_MOTION } from '../Typed'
import useTimeline from '../useTimeline'

const LEAD = 'But, like, how?'

// "But, like, how?" types out, then the three lines arrive one at a time.
export default function HowScreen({ onNext }) {
  const at = useTimeline()
  const [shown, setShown] = useState(REDUCED_MOTION ? 3 : 0)

  useEffect(() => {
    if (REDUCED_MOTION) return
    const first = 120 + typingMs(LEAD) + 500
    for (let i = 0; i < 3; i++) at(first + i * 1100, () => setShown(n => Math.max(n, i + 1)))
  }, [at])

  const pill = (cls, word) => <span className={`${styles.inlinePill} ${styles[cls]}`}>{word}</span>
  const line = (i, mt, children) => (
    <div
      className={`${styles.hookBody} ${styles.fadeBlock}${shown > i ? ` ${styles.fadeBlockOn}` : ''}`}
      style={{ marginTop: mt }}
    >{children}</div>
  )

  return (
    <ScreenLayout cta={{ arrow: true, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <Typed
          as="div"
          className={`${styles.hookBody} ${styles.hookEmphasis} ${styles.howLead}`}
          text={LEAD}
          delay={120}
        />
        {line(0, 22, <>First, you{'’'}ll sort your {pill('inlinePillExploration', 'needs')}{'—'}the things that give you energy.</>)}
        {line(1, 18, <>Each one lands in a {pill('inlinePillNourishment', 'mode')}{'—'}this sets how much attention it gets.</>)}
        {line(2, 18, <>Then you{'’'}ll set daily {pill('inlinePillAppreciation', 'practices')} to meet them.</>)}
      </div>
    </ScreenLayout>
  )
}
