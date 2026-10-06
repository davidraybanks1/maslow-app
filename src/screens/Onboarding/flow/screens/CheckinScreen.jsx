import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import FrequencyCard from '../../../../components/FrequencyCard'

export function slotName() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'today' : 'evening'
}

// A first vibration check-in using the app's own card. Demo only: what gets
// picked colors the sample draft on a later screen and is never saved.
export default function CheckinScreen({ vibe, onVibe, onNext }) {
  const ready = !!(vibe.band && vibe.feeling)
  return (
    <ScreenLayout cta={{ label: 'continue', disabled: !ready, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage} ${styles.vibeStage}`}>
        <FrequencyCard
          slotName={slotName()}
          initialBand={vibe.band}
          initialFeeling={vibe.feeling}
          onSettle={(band, feeling) => onVibe({ band, feeling })}
          introNote={<>This is a vibration check. You track it three times a day.<br /><br />It{'’'}s the data that helps you understand how your needs and practices are working.</>}
          hideRule
        />
      </div>
    </ScreenLayout>
  )
}
