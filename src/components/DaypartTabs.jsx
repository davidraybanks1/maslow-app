import { MOOD_PIP_COLOR } from './FrequencyCard'
import styles from './DaypartTabs.module.css'

// The three parts of the day as a control you can see is a control.
// items: [{ name, isSelected, isCurrent, band, hasFeeling, feeling, onTap }]
//   onTap null  → a part of the day that hasn't happened yet.
// Three small cards that show the word for each part of the day.
function Pip({ band, hasFeeling }) {
  const color = band ? MOOD_PIP_COLOR[band] : null
  const style = !color ? undefined
    : hasFeeling
      ? { background: color, borderColor: color }
      : { background: `linear-gradient(to right, ${color} 50%, transparent 50%)`, borderColor: color }
  return <span className={styles.pip} style={style} aria-hidden="true" />
}

function statusOf(dp) {
  if (!dp.onTap && !dp.isCurrent) return 'later'
  if (dp.band) return 'logged'
  return 'open'
}

export default function DaypartTabs({ items }) {
  return (
    <div className={styles.chips} role="group" aria-label="parts of the day">
      {items.map(dp => {
        const st = statusOf(dp)
        const word = st === 'later' ? 'later' : dp.feeling || (dp.band ? (dp.band === 'mid' ? 'fine' : dp.band) : (dp.isCurrent ? 'now' : '+ add'))
        return (
          <button
            key={dp.name}
            type="button"
            className={`${styles.chip} ${dp.isSelected ? styles.chipOn : ''} ${st === 'later' ? styles.chipLater : ''}`}
            onClick={dp.onTap || undefined}
            disabled={!dp.onTap}
            aria-pressed={dp.isSelected}
            aria-label={`${dp.name}, ${st === 'later' ? 'not yet' : dp.feeling || dp.band || 'not logged'}`}
          >
            <span className={styles.chipTop}><Pip band={dp.band} hasFeeling={dp.hasFeeling} />{dp.name}</span>
            <span className={`${styles.chipWord} ${!dp.band && st !== 'later' && !dp.isCurrent ? styles.chipAdd : ''}`}>{word}</span>
          </button>
        )
      })}
    </div>
  )
}

// The header label, turned into a dropdown once there is a day to look at.
export function DayToggle({ open, onToggle, controls }) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      <span>VIBRATIONS</span>
      <i className={`${styles.toggleChev} ${open ? styles.toggleChevOpen : ''}`} aria-hidden="true" />
    </button>
  )
}
