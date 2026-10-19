import { useState } from 'react'
import Sheet from '../Sheet'
import { clip } from '../../lib/shapeFacts'
import styles from './Shapes.module.css'

const STARTERS = ['is this still true?', 'what changed?', 'did I do it?']

/* Shown when you mark a draft "revisit". The question is optional: it is a
   note from you to later-you, stored with the draft and shown back when the
   draft resurfaces. Skipping it still saves the revisit. */
export default function RevisitSheet({ entry, onSave, onClose }) {
  const [q, setQ] = useState('')
  return (
    <Sheet label="Save to revisit" onClose={onClose}>
      <div className={styles.rvEyebrow}>saved to revisit</div>
      <h2 className={styles.rvTitle}>Come back to this?</h2>
      <p className={styles.rvQuote}>{clip(entry, 220)}</p>
      <div className={styles.rvLabel}>ask future you something · optional</div>
      <input
        id="revisit-question"
        className={styles.rvInput}
        value={q}
        onChange={e => setQ(e.target.value)}
        maxLength={300}
        placeholder="a question for later"
        aria-label="a question for future you"
      />
      <div className={styles.rvChips}>
        {STARTERS.map(s => (
          <button key={s} className={`${styles.chip} ${styles.chipBtn}`} onClick={() => setQ(s)}>{s}</button>
        ))}
      </div>
      <div className={styles.rvActions}>
        <button className={styles.link} onClick={() => onSave('')}>skip the question</button>
        <button className={styles.add} onClick={() => onSave(q)}>save for later</button>
      </div>
    </Sheet>
  )
}
