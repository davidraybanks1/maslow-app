import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import PracticeIcon from '../../../../components/PracticeIcon'
import { fmtTime } from '../../../../lib/practiceTypes'
import { picksFor } from '../data'

// How a pick reads in one short mono line: its type, then the one number or
// phrase that makes it that type.
function detail(p) {
  const c = p.config || {}
  switch (p.kind) {
    case 'timed': return `timed · ${c.minutes || 10} min`
    case 'checklist': return `checklist · ${(c.items || []).length} items`
    case 'ritual': return `ritual · ${(c.steps || []).length} steps`
    case 'stretch': return `stretch · ${c.cadence || 'once a week'}`
    case 'boundary': return `boundary · ${fmtTime(c.window?.from || '21:00')}–${fmtTime(c.window?.until || '07:00')}`
    default: return c.target > 1 ? `check · ${c.target} a day` : 'check · daily'
  }
}

// One short step between the recap and the data preview: six kinds of
// practice, each tailored to a need they kept; tap one and it is waiting in
// the app. The arrow always works - picking is optional.
export default function PracticeScreen({ placed, pick, onPick, onNext }) {
  const picks = picksFor(placed)
  return (
    <ScreenLayout cta={{ arrow: true, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage} ${styles.pickStage}`}>
        <div className={styles.conceptTitle}>Pick a practice to start with.</div>
        <div className={styles.hookBody} style={{ marginTop: 12 }}>
          Practices come in six kinds. Choose one and it{'’'}ll be waiting for you in the app.
        </div>
        <div className={styles.pickList} role="radiogroup" aria-label="first practice">
          {picks.map((p, i) => {
            const on = pick && pick.kind === p.kind
            return (
              <button
                key={p.kind}
                type="button"
                role="radio"
                aria-checked={!!on}
                className={`${styles.pick}${on ? ` ${styles.pickOn}` : ''} ${styles.arrive}`}
                style={{ '--i': i }}
                onClick={() => onPick(on ? null : p)}
              >
                <PracticeIcon kind={p.kind} size={30} lit={false} className={styles.pickIcon} />
                <span className={styles.pickText}>
                  <span className={styles.pickLabel}>{p.label}</span>
                  <span className={styles.pickMeta}>{detail(p)} · {p.needId}</span>
                </span>
                <span className={styles.pickRadio} style={on ? { background: `var(--${p.mode})`, borderColor: `var(--${p.mode})` } : undefined} />
              </button>
            )
          })}
        </div>
      </div>
    </ScreenLayout>
  )
}
