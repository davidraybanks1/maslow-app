import { useId } from 'react'
import styles from './LoamSplash.module.css'
import { SYMBOL } from './loamMarkGeometry'

/* The Loam splash: the symbol builds itself, then the name. Shared by the
   daily loading screen and the first screen of onboarding.
   The black lumps drop into a pile from the bottom up (the way the Bloom
   settles); the gold orb rolls in and comes to rest; the green orb pops out
   from behind the pile's upper-left corner; then the name, Loam.
   Shown once a day, and first of all for someone opening the app for the
   first time (it leads straight into onboarding). The choreography is
   ~2.7s; App.jsx holds it for RITUAL_MS. Reduced motion shows it at rest. */

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

        {/* drawn first so it can start hidden behind the pile and pop out of it;
            it never overlaps a lump once it has landed */}
        <path d={SYMBOL.green.d} fill={`url(#${uid}-sage)`} className={styles.sprout} />
        <path d={SYMBOL.gold.d} fill={`url(#${uid}-gold)`} className={styles.roll} />
        {SYMBOL.pieces.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={`url(#${uid}-dark)`}
            className={styles.lump}
            style={{ '--d': `${100 + (n - 1 - i) * 55}ms` }}
          />
        ))}
      </svg>

      <p className={styles.welcome}>Loam</p>
    </div>
  )
}

// When the choreography is done (ms): the onboarding arrow waits for this.
export const SPLASH_MS = 2900
