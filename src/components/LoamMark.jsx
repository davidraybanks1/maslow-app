import { useId } from 'react'
import { SYMBOL } from './loamMarkGeometry'

// The Loam symbol at rest (the still frame of LoamSplash): the dark orb pile
// with the gold orb and the green sprout. `width` is in px; height follows.
const [sx, sy, sw, sh] = SYMBOL.viewBox

export default function LoamMark({ width = 120 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '') || 'lm'
  return (
    <svg
      viewBox={`${sx} ${sy} ${sw} ${sh}`}
      width={width}
      height={Math.round(width * sh / sw)}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
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
      <path d={SYMBOL.gold.d} fill={`url(#${uid}-gold)`} />
      {SYMBOL.pieces.map((p, i) => <path key={i} d={p.d} fill={`url(#${uid}-dark)`} />)}
      <path d={SYMBOL.green.d} fill={`url(#${uid}-sage)`} />
    </svg>
  )
}
