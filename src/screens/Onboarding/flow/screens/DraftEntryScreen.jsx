import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import Typed from '../Typed'
import { splitSentences } from '../useTimeline'
import { MOOD_PIP_COLOR } from '../../../../components/FrequencyCard'
import { BAND_LABEL } from '../../../../lib/frequency'
import { DRAFT_SAMPLES } from '../data'
import { slotName } from './CheckinScreen'

const BODY = 'This is a draft. It’s like a journal entry, but you’ll review them, write about them, and uncover patterns.'

// What a first draft looks like: the tags from the check-in above a sample
// entry that types itself out. Demo only: nothing here is saved.
export default function DraftEntryScreen({ vibe, onNext }) {
  const band = vibe.band || 'mid'
  return (
    <ScreenLayout cta={{ label: 'continue', onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <div className={styles.conceptTitle} style={{ fontSize: 30 }}>What{'’'}s on your mind?</div>
        <div className={styles.hookBody}>
          {splitSentences(BODY).map(s => <span key={s} className={styles.sent}>{s}</span>)}
        </div>

        <div className={styles.draftChips}>
          <span className={styles.draftChip}>{slotName()}</span>
          <span className={styles.draftChip}>
            <span className={styles.draftChipPip} style={{ background: MOOD_PIP_COLOR[band] }} />
            {vibe.feeling || BAND_LABEL[band]}
          </span>
        </div>

        <div className={styles.draftField}>
          <Typed as="div" className={styles.draftSample} text={DRAFT_SAMPLES[band]} delay={600} />
        </div>
      </div>
    </ScreenLayout>
  )
}
