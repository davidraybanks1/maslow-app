import { useState, useEffect, useRef, useId } from 'react'
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

// ── Vibration ring ───────────────────────────────────────────────────────
// Carried over from the onboarding check-in mock: a closed curve wobbling
// around a circle, r = R + a3·sin(3θ+φ) + a5·sin(5θ−1.3φ) + a7·sin(7θ+1.9φ)·
// (0.7+0.3·sin(2φ+θ)), with the wobble amplitude/speed easing toward
// whichever band is picked — calm and nearly still for "good", a rougher,
// faster shimmer for "bad". Rests on the "fine" shape before an answer.
// Rendered as a single filled shape (Bloom's own radial-gradient + soft-
// shadow materials — see Bloom.jsx) rather than a stroked outline: mood is
// still read entirely off the shape and speed, same as before, never off a
// color change, so the fill stays one ink tone (tone-adjusted via CSS vars
// below) across all three bands.
const RING_PARAMS = {
  good: { a3: 2.5, a5: 0, a7: 0, speed: .6 },
  mid:  { a3: 2,   a5: 3, a7: .6, speed: 1.2 },
  bad:  { a3: 2.5, a5: 4, a7: 6,  speed: 2.6 },
}
const RING_REST = RING_PARAMS.mid

// Mirrors App.jsx's own PREFERS_REDUCED_MOTION — read once at module load
// rather than re-queried per render.
const PREFERS_REDUCED_MOTION = typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function ringRadiusAt(theta, R, p, phi) {
  return R
    + p.a3 * Math.sin(3 * theta + phi)
    + p.a5 * Math.sin(5 * theta - 1.3 * phi)
    + p.a7 * Math.sin(7 * theta + 1.9 * phi) * (0.7 + 0.3 * Math.sin(2 * phi + theta))
}

function ringPathD(R, p, phi) {
  const steps = 96
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2
    const r = ringRadiusAt(theta, R, p, phi)
    const x = 90 + r * Math.cos(theta)
    const y = 90 + r * Math.sin(theta)
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2)
  }
  return d + 'Z'
}

// Writes straight to the <path> DOM nodes via refs instead of through React
// state — this animates indefinitely for as long as the card is on screen,
// and a 60fps setState here would re-render the whole card forever for no
// visual gain (nothing else in the tree depends on the ring's frame).
function VibeRing({ band }) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-z0-9]/gi, '') || 'vr0'
  const shadowRef = useRef(null)
  const blobRef = useRef(null)
  const bandRef = useRef(band)
  useEffect(() => { bandRef.current = band }, [band])

  // Animated case: one rAF loop for the life of the card, always easing
  // toward whatever pickBand() most recently set (read via bandRef so this
  // effect never needs to restart when the band changes).
  useEffect(() => {
    if (PREFERS_REDUCED_MOTION) return
    const shadow = shadowRef.current, blob = blobRef.current
    if (!shadow || !blob) return

    const current = { ...RING_REST }
    let phi = 0
    let lastT = null
    let rafId = requestAnimationFrame(frame)
    function frame(t) {
      if (lastT === null) lastT = t
      const dt = Math.min((t - lastT) / 1000, .05)
      lastT = t
      const target = bandRef.current ? RING_PARAMS[bandRef.current] : RING_REST
      const ease = 1 - Math.exp(-dt / 0.5)
      current.a3 += (target.a3 - current.a3) * ease
      current.a5 += (target.a5 - current.a5) * ease
      current.a7 += (target.a7 - current.a7) * ease
      current.speed += (target.speed - current.speed) * ease
      phi += current.speed * dt
      const d = ringPathD(60, current, phi)
      shadow.setAttribute('d', d)
      blob.setAttribute('d', d)
      rafId = requestAnimationFrame(frame)
    }
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Reduced-motion case: no loop, but it should still reflect a changed
  // band — snap straight to the new target shape, per the onboarding
  // check-in's own "vibration ring static" accessibility note.
  useEffect(() => {
    if (!PREFERS_REDUCED_MOTION) return
    const shadow = shadowRef.current, blob = blobRef.current
    if (!shadow || !blob) return
    const target = band ? RING_PARAMS[band] : RING_REST
    const d = ringPathD(60, target, 0.6)
    shadow.setAttribute('d', d)
    blob.setAttribute('d', d)
  }, [band])

  const gradId = `vr-grad-${uid}`
  const filterId = `vr-shadow-${uid}`

  return (
    <svg className={styles.vibeRing} viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="34%" cy="26%">
          <stop offset="0%" style={{ stopColor: 'var(--orb-hi)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--orb-lo)' }} />
        </radialGradient>
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" />
          <feOffset dy="5" />
          <feComponentTransfer><feFuncA type="linear" slope="0.22" /></feComponentTransfer>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} aria-hidden="true">
        <path ref={shadowRef} fill="#000" />
      </g>
      <path
        ref={blobRef}
        fill={`url(#${gradId})`}
      />
    </svg>
  )
}

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
        <>
          <VibeRing band={band} />
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
        </>
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
          {/* The sentence above is the receipt; these are the control. Bigger
              targets, solid-ink selected state — matches the onboarding mood
              screen this was restyled to follow. The feeling list rolls up
              once a specific one is chosen, and once it has (band + feeling
              both set — the selection is complete), the band row itself hides
              too, rather than staying up as a lingering set of controls for
              something already answered. It comes back on its own next
              period, since a new slot remounts this card with a clean
              initialBand/initialFeeling. */}
          {!(band && feeling) && (
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
          )}
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
