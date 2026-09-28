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
//        tone: 'dark' | 'amber' | undefined (paper), slotName: 'morning' | 'midday' | 'evening'
// dayparts: [{ name, isCurrent, band, hasFeeling, onTap }]
// slotName drives the opening prompt ("How are you this {slotName}?") before a band is
// picked. Only the non-compact card uses it — compact's tiny picker (the retro tag row,
// the draft composer) never shows the sentence at all.
export default function FrequencyCard({ initialBand, initialFeeling, onSettle, compact, pastTense, dayparts, bandAsBack, tone, slotName }) {
  const [band, setBand] = useState(initialBand || null)
  const [feeling, setFeeling] = useState(initialFeeling || null)
  // Whether the feeling sub-list is open. Starts open once a band is picked
  // (so you can refine it) and rolls up the moment a specific feeling is
  // chosen; retapping the active band toggles it back open to revise.
  const [expanded, setExpanded] = useState(!!(initialBand && !initialFeeling))
  const touchedRef = useRef(false)

  useEffect(() => {
    if (touchedRef.current) return
    setBand(initialBand || null)
    setFeeling(initialFeeling || null)
    setExpanded(!!(initialBand && !initialFeeling))
  }, [initialBand, initialFeeling])

  function pickBand(b) {
    if (!compact) {
      const isActive = b === band
      if (isActive && feeling) {
        // already answered — retap reopens the list to revise it, rather
        // than clearing what was picked
        touchedRef.current = true
        setExpanded(e => !e)
        return
      }
      if (bandAsBack && isActive) {
        goBack()
        return
      }
      touchedRef.current = true
      hapticTick()
      setBand(b)
      setFeeling(null)
      setExpanded(true)
      onSettle(b, null)
      return
    }
    // compact (retro tag row, draft composer) — unchanged
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
    if (!compact) setExpanded(false)
    onSettle(band, f)
  }

  function goBack() {
    touchedRef.current = false
    setBand(null)
    setFeeling(null)
    setExpanded(false)
  }

  return (
    <div className={`${styles.freqCard}${tone && styles[tone] ? ` ${styles[tone]}` : ''}`}>
      {!compact && (
        <p className={styles.freqSentence}>
          {band ? (
            <>
              {pastTense ? 'I was feeling' : "I'm feeling"}{' '}
              <span className={styles.freqFilled}>{feeling || BAND_LABEL[band]}</span>.
            </>
          ) : slotName ? (
            pastTense ? `How was your ${slotName}?` : `How are you this ${slotName}?`
          ) : (
            <>
              {pastTense ? 'I was feeling' : "I'm feeling"}{' '}
              <span className={styles.freqBlank}>?</span>.
            </>
          )}
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
              and one tap away from changing. Bigger targets, solid-ink selected
              state — matches the onboarding mood screen this was restyled to
              follow. The feeling list rolls up once a specific one is chosen;
              retapping the active band reopens it to revise. */}
          <div className={styles.bandRow}>
            {BANDS.map(b => {
              const on = b === band
              return (
                <button
                  key={b}
                  className={`${styles.bandBtn}${on ? ` ${styles.bandBtnOn}` : ''}`}
                  onClick={() => pickBand(b)}
                  aria-pressed={on}
                >{BAND_LABEL[b]}</button>
              )
            })}
          </div>
          {band && (
            <div className={`${styles.feelWrap}${expanded ? '' : ` ${styles.feelWrapCollapsed}`}`}>
              <p className={styles.freqTextureQ}>
                What type of {BAND_LABEL[band]} {pastTense ? 'was' : 'is'} it?
              </p>
              <div className={styles.wordList}>
                {FEELINGS[band].map(f => {
                  const on = f === feeling
                  return (
                    <button
                      key={f}
                      className={`${styles.wordRow}${on ? ` ${styles.wordRowOn}` : ''}`}
                      onClick={() => pickFeeling(f)}
                      aria-pressed={on}
                    >{f}</button>
                  )
                })}
              </div>
            </div>
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
