import { useState } from 'react'
import { hapticTick } from '../lib/native'
import { BANDS, FEELINGS, BAND_LABEL } from '../lib/frequency'
import styles from './RetroMoodEdit.module.css'

/* A stripped-down editor for an earlier part of the day. It doesn't try to
   match the live check-in (sentence + orb + rolling list): just the three
   bands, then the four words for whichever band is picked. Picking a word
   is the save - nothing is written until then, so backing out ("cancel")
   leaves the original answer exactly as it was. */
export default function RetroMoodEdit({ slotName, initialBand, initialFeeling, onSave, onCancel }) {
  const [band, setBand] = useState(initialBand || null)

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <p className={styles.q}>How was your {slotName}?</p>
        <button type="button" className={styles.cancel} onClick={onCancel}>cancel</button>
      </div>
      <div className={styles.bands} role="group" aria-label="how it felt">
        {BANDS.map(b => (
          <button
            key={b}
            type="button"
            className={`${styles.band}${b === band ? ` ${styles.bandOn}` : ''}`}
            aria-pressed={b === band}
            onClick={() => { hapticTick(); setBand(b) }}
          >{BAND_LABEL[b]}</button>
        ))}
      </div>
      {band && (
        <div className={styles.words} role="group" aria-label={`what kind of ${BAND_LABEL[band]}`}>
          {FEELINGS[band].map(f => {
            const on = band === initialBand && f === initialFeeling
            return (
              <button
                key={f}
                type="button"
                className={`${styles.word}${on ? ` ${styles.wordOn}` : ''}`}
                aria-pressed={on}
                onClick={() => { hapticTick(); onSave(band, f) }}
              >{f}</button>
            )
          })}
        </div>
      )}
      {!band && <p className={styles.hint}>pick one, then the word that fits</p>}
    </div>
  )
}
