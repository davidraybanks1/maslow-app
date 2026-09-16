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

/* The amber ground is light, so the pips take the deep end of each ramp
   instead of the lit head — the same colours, read from the other side. */
export const MOOD_PIP_COLOR_AMBER = {
  good: '#07301F',
  mid:  '#4F6449',
  bad:  '#A81F06',
}

export const PIPS_FOR = tone =>
  tone === 'amber' ? MOOD_PIP_COLOR_AMBER : tone === 'dark' ? MOOD_PIP_COLOR_DARK : MOOD_PIP_COLOR

// Props: initialBand, initialFeeling, onSettle(band, feeling), compact, pastTense, dayparts,
//        tone: 'dark' | 'amber' | undefined (paper)
// dayparts: [{ name, isCurrent, band, hasFeeling, onTap }]
export default function FrequencyCard({ initialBand, initialFeeling, onSettle, compact, pastTense, dayparts, bandAsBack, tone }) {
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
    <div className={`${styles.freqCard}${tone && styles[tone] ? ` ${styles[tone]}` : ''}`}>
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
      ) : (
        <>
          {/* The sentence above is the receipt; these are the control. The band
              row stays visible after a pick so what you chose is always in view
              and one tap away from changing - the chips carry the same colour
              dot the draft will show an hour later, so input and output are the
              same object. */}
          <div className={styles.chipRow}>
            {BANDS.map(b => {
              const on = b === band
              return (
                <button
                  key={b}
                  className={`${styles.chip}${on ? ` ${styles.chipOn}` : ''}`}
                  onClick={() => pickBand(b)}
                  aria-pressed={on}
                >
                  <span className={styles.chipDot} style={{ background: (on ? MOOD_PIP_COLOR_DARK : MOOD_PIP_COLOR)[b] }} />
                  {BAND_LABEL[b]}
                </button>
              )
            })}
          </div>
          {band && (
            <>
              <p className={styles.freqTextureQ}>
                What type of {BAND_LABEL[band]} {pastTense ? 'was' : 'is'} it?
              </p>
              <div className={styles.chipRow}>
                {FEELINGS[band].map(f => {
                  const on = f === feeling
                  return (
                    <button
                      key={f}
                      className={`${styles.chip}${on ? ` ${styles.chipOn}` : ''}`}
                      onClick={() => pickFeeling(f)}
                      aria-pressed={on}
                    >{f}</button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {!compact && (
        <>
          {!bandAsBack && <div className={styles.freqRule} />}
          {dayparts && (
            <div className={styles.freqDayparts}>
              {dayparts.map(dp => {
                const color = dp.band ? PIPS_FOR(tone)[dp.band] : null
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
