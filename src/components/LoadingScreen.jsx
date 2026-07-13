import { useMemo } from 'react'
import styles from './LoadingScreen.module.css'

// Palette weighted for calm — soft colors appear often, survival rarely.
// All vars map to tokens declared in :root.
const PALETTE = [
  ['var(--appreciation)',  6],
  ['var(--nourishment)',   4],
  ['var(--exploration)',   3],
  ['var(--survival)',      1],
]
const POOL = PALETTE.flatMap(([c, w]) => Array(w).fill(c))
const rand = (min, max) => Math.random() * (max - min) + min
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const COUNT = 34

function buildCircles(reduce) {
  return Array.from({ length: COUNT }, () => {
    const size  = rand(8, 44)
    const depth = (size - 8) / 36              // 0 = near, 1 = far
    const op    = (0.62 - depth * 0.34).toFixed(2)
    const blur  = (depth * 2.4).toFixed(1)
    const dur   = (7 + depth * 4 + rand(-1, 1)).toFixed(1)
    const drift = rand(8, 26).toFixed(0)
    const sdur  = rand(3.5, 6).toFixed(1)
    return {
      drop: {
        '--x':     rand(2, 96).toFixed(1) + '%',
        '--dur':   dur + 's',
        '--delay': (-rand(0, parseFloat(dur))).toFixed(1) + 's', // negative = full screen on first paint
        '--op':    op,
        ...(reduce ? { bottom: 'auto', top: rand(6, 90).toFixed(1) + 'vh', opacity: op } : {}),
      },
      bubble: {
        '--size':   size.toFixed(0) + 'px',
        '--color':  pick(POOL),
        '--blur':   blur + 'px',
        '--drift':  drift + 'px',
        '--sdur':   sdur + 's',
        '--sdelay': (-rand(0, parseFloat(sdur))).toFixed(1) + 's',
      },
    }
  })
}

export default function LoadingScreen({ greeting = 'hey, you', fading = false }) {
  const reduce = useMemo(
    () => typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  // Stable circles — generated once per mount, not on every render
  const circles = useMemo(() => buildCircles(reduce), [reduce])

  return (
    <div
      className={`${styles.overlay} ${fading ? styles.overlayFading : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className={styles.fountain}>
        {circles.map((c, i) => (
          <div key={i} className={styles.drop} style={c.drop}>
            <div className={styles.bubble} style={c.bubble} />
          </div>
        ))}
      </div>
      <div className={styles.veil} />
      <div className={styles.brand}>
        <div className={styles.greeting}>{greeting}</div>
        <div className={styles.wordmark}>
          maslow<span className={styles.dot}>.</span>
        </div>
      </div>
    </div>
  )
}
