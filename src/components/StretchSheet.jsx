import { useState } from 'react'
import { STRETCH_WORDS } from '../lib/practiceTypes'
import PracticeIcon from './PracticeIcon'
import Sheet from './Sheet'
import styles from './StretchSheet.module.css'

// "How far did you stretch?" A 0–10 slider that starts unset, so saving always
// means the person chose a number rather than accepted a default.
export default function StretchSheet({ practice, initialLevel = null, onSave, onClose }) {
  const [level, setLevel] = useState(initialLevel)
  const pct = level === null ? 0 : level * 10
  return (
    <Sheet label="How far did you stretch" onClose={onClose}>
      <div className={styles.top}>
        <PracticeIcon kind="stretch" size={44} />
        <div className={styles.head}>how far did you stretch?</div>
      </div>
      <div className={styles.sub}>{practice.label}. how uncomfortable did you let yourself get?</div>
      <div className={styles.readout} aria-live="polite">
        <span className={styles.big}>{level === null ? '—' : level}</span>
        <span className={styles.word}>{level === null ? 'slide to choose' : STRETCH_WORDS[level]}</span>
      </div>
      <input
        type="range"
        id="stretch-level"
        className={`${styles.range} ${level === null ? styles.untouched : ''}`}
        min={0}
        max={10}
        step={1}
        value={level === null ? 5 : level}
        aria-label="how far you stretched, 0 to 10"
        style={{ '--pct': `${pct}%` }}
        onChange={e => setLevel(Number(e.target.value))}
        // a tap exactly on the middle never fires change, so catch the touch too
        onPointerUp={e => setLevel(Number(e.currentTarget.value))}
      />
      <div className={styles.ends}><span>barely</span><span>as far as I could go</span></div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={level === null} onClick={() => onSave(level)}>save</button>
        <button type="button" className={styles.secondary} onClick={onClose}>not now</button>
      </div>
    </Sheet>
  )
}
