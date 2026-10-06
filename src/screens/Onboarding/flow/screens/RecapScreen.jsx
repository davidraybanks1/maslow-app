import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import { MODE_KEYS, NEED_BY_ID } from '../data'

// "Nice." — where everything landed, grouped by mode. The copy is simply
// there; the cards arrive one after another.
export default function RecapScreen({ placed, onNext }) {
  return (
    <ScreenLayout cta={{ arrow: true, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <div className={styles.conceptTitle}>Nice.</div>
        <div className={styles.hookBody} style={{ marginTop: 16 }}>
          Each need now lives in a mode, which sets how many daily practices it gets.
        </div>
        <div className={styles.hookBody} style={{ marginTop: 12 }}>
          When you open the app, you{'’'}ll find starter practices for each. You can edit your needs, modes, and practices at any time.
        </div>

        <div className={styles.doneRecap}>
          {MODE_KEYS.map((key, i) => {
            const items = placed[key]
            return (
              <div key={key} className={`${styles.doneGroup} ${styles.arrive}`} style={{ '--i': i }}>
                <div className={styles.doneGroupHead}>
                  <span className={styles.doneGroupDot} style={{ background: `var(--${key})` }} />
                  <span className={styles.doneGroupLabel}>{key}</span>
                  <span className={styles.doneGroupCount}>{items.length}</span>
                </div>
                <div className={`${styles.chips} ${styles.doneChips}`}>
                  {items.length === 0
                    ? <span className={styles.doneEmpty}>none yet</span>
                    : items.map(id => <span key={id} className={`${styles.chip} ${styles[key]}`}>{NEED_BY_ID[id].name}</span>)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ScreenLayout>
  )
}
