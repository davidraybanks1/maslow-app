import { useId } from 'react'
import styles from './LoamSplash.module.css'
import { SYMBOL } from './loamMarkGeometry'

/* The Loam splash: the symbol builds itself, then a line of welcome. Shared by
   the daily loading screen and the first screen of onboarding.
   The gold orb rolls in first and comes to rest; the lumps drop into the pile
   around it from the bottom up (the way the Bloom settles); the green orb
   sprouts last, in the notch at the top left; then "Welcome to Loam."
   Shown once a day, and first of all for someone opening the app for the
   first time (it leads straight into onboarding). The choreography is
   ~2.8s; App.jsx holds it for RITUAL_MS. Reduced motion shows it at rest. */

const [sx, sy, sw, sh] = SYMBOL.viewBox

export default function LoamSplash() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '') || 'ls'
  const n = SYMBOL.pieces.length

  return (
    <div className={styles.stage}>
      <svg
        className={styles.symbol}
        viewBox={`${sx} ${sy} ${sw} ${sh}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id={`${uid}-dark`} cx="0.34" cy="0.26" r="0.55">
            <stop offset="0%" stopColor="#4A453E" />
            <stop offset="45%" stopColor="#191612" />
            <stop offset="100%" stopColor="#060505" />
          </radialGradient>
          <radialGradient id={`${uid}-gold`} cx="0.34" cy="0.26" r="0.55">
            <stop offset="0%" stopColor="#FFD166" />
            <stop offset="100%" stopColor="#F0A800" />
          </radialGradient>
          <radialGradient id={`${uid}-sage`} cx="0.34" cy="0.26" r="0.55">
            <stop offset="0%" stopColor="#C7D4C1" />
            <stop offset="100%" stopColor="#9DB394" />
          </radialGradient>
        </defs>

        <path d={SYMBOL.gold.d} fill={`url(#${uid}-gold)`} className={styles.roll} />
        {SYMBOL.pieces.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={`url(#${uid}-dark)`}
            className={styles.lump}
            style={{ '--d': `${650 + (n - 1 - i) * 75}ms` }}
          />
        ))}
        <path d={SYMBOL.green.d} fill={`url(#${uid}-sage)`} className={styles.sprout} />
      </svg>

      <p className={styles.welcome}>Welcome to Loam.</p>
    </div>
  )
}

// When the choreography is done (ms): the onboarding arrow waits for this.
export const SPLASH_MS = 2900
