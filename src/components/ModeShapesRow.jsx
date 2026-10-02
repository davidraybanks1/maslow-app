import { useId } from 'react'
import { orbPathD, KIND_SPEC, SHAPE_KINDS, UNLIT_DARK } from './Bloom'
import styles from './ModeShapesRow.module.css'

/* Small, static icon frieze for the mobile Modes header, reusing Bloom's own
   four shapes (good orb, fine orb, rounded square, circle) and its shiny-
   black UNLIT_DARK gradient at full strength — these icons don't track any
   progress, so there's no pct-easing or lighting logic to carry over.

   The row is deliberately built with more icons than any phone screen can
   show. It isn't meant to fit — the shapes run off the right edge, cropped
   by .screen's own overflow-x: hidden, the same way the reference sketch
   showed it. Kinds simply cycle in order (good, fine, square, circle, ...)
   rather than Bloom's own evenly-balanced golden-angle assignment, since
   that balancing was there to split a fixed 13 petals evenly — a repeating
   strip has no such fixed count to balance. */
const SIZE = 22
const PAD = SIZE * 0.22
const BOX = SIZE + PAD * 2
const GAP = 8
const COUNT = 12

const phiForIcon = i => {
  const frac = (i * 2.399963) % 1
  return 0.6 + (frac - 0.5) * 1.3 // same golden-angle rotation jitter as Bloom's own petals
}

const ICON_PATHS = Array.from({ length: COUNT }, (_, i) => {
  const spec = KIND_SPEC[SHAPE_KINDS[i % SHAPE_KINDS.length]]
  return orbPathD(BOX / 2, BOX / 2, SIZE / 2, phiForIcon(i), spec.params, spec.n)
})

export default function ModeShapesRow() {
  const rawId = useId()
  const gid = `msg-${rawId.replace(/[^a-z0-9]/gi, '') || 'g0'}`

  return (
    <div className={styles.row} aria-hidden="true">
      {/* Zero-size host for the one shared gradient every icon below points at
          by id — avoids a duplicate <radialGradient> per icon. */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id={gid} cx="34%" cy="26%">
            <stop offset="0%" stopColor={UNLIT_DARK[0]} />
            <stop offset="45%" stopColor={UNLIT_DARK[1]} />
            <stop offset="100%" stopColor={UNLIT_DARK[2]} />
          </radialGradient>
        </defs>
      </svg>
      {ICON_PATHS.map((d, i) => (
        <svg key={i} width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} className={styles.icon}>
          <path d={d} fill={`url(#${gid})`} />
        </svg>
      ))}
    </div>
  )
}
