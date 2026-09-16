import { useState, useEffect, useRef } from 'react'
import { hapticTick } from '../lib/native'
import { BANDS, FEELINGS, BAND_LABEL } from '../lib/frequency'
import styles from './FrequencyCard.module.css'

export const MOOD_PIP_COLOR = {
  good: 'var(--exploration)',
  mid:  'var(--appreciation-deep)',
  bad:  'var(--survival)',
}

/* On the black band the paper pips go invisible — exploration is #1B3A2D, which
   is 1.3:1 against #0A0807. These are the lit heads of the same ramps the
   streak glyphs use, so a good day reads as the same green in both places. */
export const MOOD_PIP_COLOR_DARK = {
  good: '#3FA87A',
  mid:  '#C7D4C1',
  bad:  '#FF8A66',
}

// Props: initialBand, initialFeeling, onSettle(band, feeling), compact, pastTense, dayparts
// dayparts: [{ name, isCurrent, band, hasFeeling, onTap }]
export default function FrequencyCard({ initialBand, initialFeeling, onSettle, compact, pastTense, dayparts, bandAsBack, dark }) {
  const [band, setBand] = useState(initialBand || null)
  const [feeling, setFeeling] = useState(initialFeeling || null)
  const touchedRef = useRef(false)

  useEffect(() => {
    if (touchedRef.current) return
    setBand(initialBand || null)
    setFeeling(initialFeeling || null)
  }, [initialBand, initialFeeling])

  function pickBand(b) {
    if (bandAsBack && b === band) {
      goBack()
      return
    }
    touchedRef.current = true
    hapticTick()
    setBand(b)
    setFeeling(null)
    onSettle(b, null)
  }

  function pickFeeling(f) {
    hapticTick()
    setFeeling(f)
    onSettle(band, f)
  }

  function goBack() {
    touchedRef.current = false
    setBand(null)
    setFeeling(null)
  }

  const displayLabel = feeling || (band ? BAND_LABEL[band] : null)

  return (
    <div className={`${styles.freqCard}${dark ? ` ${styles.dark}` : ''}`}>
      {!compact && (
        <p className={styles.freqSentence}>
          {pastTense ? 'I was feeling' : "I'm feeling"}{' '}
          {displayLabel
            ? <span className={styles.freqFilled}>{displayLabel}</span>
            : <span className={styles.freqBlank}>?</span>
          }{'.'}
        </p>
      )}

      {compact ? (
        <>
          <div className={styles.freqOptionsRow}>
            {BANDS.map(b => (
              <button
                key={b}
                className={`${styles.freqOptionBtn} ${styles.freqOptionCompact} ${b === band ? styles.freqOptionActive : styles.freqOptionDim}`}
                onClick={() => pickBand(b)}
              >{BAND_LABEL[b]}</button>
            ))}
          </div>
          {band && (
            <div className={styles.freqOptionsRow}>
              {FEELINGS[band].map(f => (
                <button
                  key={f}
                  className={`${styles.freqOptionBtn} ${styles.freqOptionCompact} ${f === feeling ? styles.freqOptionActive : styles.freqOptionDim}`}
                  onClick={() => pickFeeling(f)}
                >{f}</button>
              ))}
            </div>
          )}
        </>
      ) : !band ? (
        <div className={styles.freqOptionsRow}>
          {BANDS.map(b => (
            <button key={b} className={styles.freqOptionBtn} onClick={() => pickBand(b)}>
              {BAND_LABEL[b]}
            </button>
          ))}
        </div>
      ) : (
        <>
          {bandAsBack && (
            <div className={styles.freqOptionsRow}>
              {BANDS.map(b => (
                <button
                  key={b}
                  className={`${styles.freqOptionBtn} ${b === band ? styles.freqOptionActive : styles.freqOptionDim}`}
                  onClick={() => pickBand(b)}
                >{BAND_LABEL[b]}</button>
              ))}
            </div>
          )}
          <p className={styles.freqTextureQ}>Is there a specific texture?</p>
          <div className={styles.freqOptionsRow}>
            {FEELINGS[band].map(f => (
              <button
                key={f}
                className={`${styles.freqOptionBtn} ${f === feeling ? styles.freqOptionActive : ''} ${feeling && f !== feeling ? styles.freqOptionDim : ''}`}
                onClick={() => pickFeeling(f)}
              >{f}</button>
            ))}
          </div>
        </>
      )}

      {!compact && (
        <>
          {!bandAsBack && <div className={styles.freqRule} />}
          {band && !bandAsBack && (
            <button className={styles.freqBackBtn} onClick={goBack}>
              ← {feeling ? 'change' : `${BAND_LABEL[band]} is saved — this gives you more detail`}
            </button>
          )}
          {dayparts && (
            <div className={styles.freqDayparts}>
              {dayparts.map(dp => {
                const color = dp.band ? (dark ? MOOD_PIP_COLOR_DARK : MOOD_PIP_COLOR)[dp.band] : null
                const dotStyle = !color ? undefined
                  : dp.hasFeeling
                    ? { background: color, borderColor: color }
                    : { background: `linear-gradient(to right, ${color} 50%, transparent 50%)`, borderColor: color }
                return (
                  <button
                    key={dp.name}
                    className={`${styles.freqDaypart} ${dp.isCurrent ? styles.freqDaypartCurrent : ''}`}
                    onClick={dp.onTap || undefined}
                    style={!dp.onTap ? { cursor: 'default' } : undefined}
                  >
                    <span className={styles.freqDot} style={dotStyle} />
                    <span className={styles.freqDaypartLabel}>{dp.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
