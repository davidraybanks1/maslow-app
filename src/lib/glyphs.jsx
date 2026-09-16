/* ── The five marks, in one place ──────────────────────────────────────────
   Each mark appears twice: lit, on a streak card, where the gradient is
   carrying a status — a run is going, or it has gone quiet; and as a flat
   tint beside a Today section header, where it is only naming a kind of
   thing. That is why a section mark must not borrow either lit or unlit:
   both are already spoken for, so the headers get a third register.

   A mode is a pyramid, one on two — the modes are a hierarchy and an arc
   never said so. A need is a cluster of petals. A practice is the checkbox.
   A frequency is a signal. A note is three strokes, ragged right: the only
   mark in the family that is a gesture rather than an object, which is
   right, because writing is the only one of the five that isn't a thing you
   can finish.

   The pyramid and the checkbox share a corner-radius ratio of 0.32 so the
   family still reads as one hand. */

export const GLYPH_BOX = {
  mode:      [15.2, 15.4],
  need:      [21, 17],
  practice:  [14, 14],
  frequency: [28, 12],
  note:      [20, 14],
}

/** Which marks take a radial light at 34% / 26% rather than a linear one. */
export const GLYPH_RADIAL = { mode: true, need: true }

export function GlyphShape({ kind, paint }) {
  if (kind === 'mode') return (
    <g fill={paint}>
      <rect x="4.4" y="0.6" width="6.4" height="6.4" rx="2" />
      <rect x="0.6" y="8.4" width="6.4" height="6.4" rx="2" />
      <rect x="8.2" y="8.4" width="6.4" height="6.4" rx="2" />
    </g>
  )
  if (kind === 'need') return (
    <g fill={paint}>
      <circle cx="7.5" cy="9.5" r="6" />
      <circle cx="15" cy="6" r="4.4" />
      <circle cx="16.5" cy="13" r="3.4" />
    </g>
  )
  if (kind === 'practice') return (
    <rect x="0.6" y="0.6" width="12.8" height="12.8" rx="4.1" fill={paint} />
  )
  if (kind === 'note') return (
    <g fill="none" stroke={paint} strokeWidth="2.1" strokeLinecap="round">
      <path d="M1.5 3.2 H17" />
      <path d="M1.5 7 H12.4" />
      <path d="M1.5 10.8 H14.6" />
    </g>
  )
  return (
    <path
      d="M1.2 6 Q2.6 1.2 4 6 Q5.4 10.8 6.8 6 Q8.2 1.6 9.6 6 Q11 10.4 12.4 6
         Q13.8 1.6 15.2 6 Q16.6 10.4 18 6 Q19.4 2 20.8 6 Q22.2 10 23.6 6 Q25 2.7 26.8 6"
      fill="none" stroke={paint} strokeWidth="2.1" strokeLinecap="round"
    />
  )
}

/**
 * A section mark: the same geometry in the flat-tint register, taking its
 * colour from the label it sits beside. Never lit, never unlit — it has no
 * status to report.
 */
export default function Glyph({ kind, height = 11 }) {
  const [w, h] = GLYPH_BOX[kind] || GLYPH_BOX.mode
  return (
    <svg
      width={(w / h) * height} height={height} viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true" focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      <GlyphShape kind={kind} paint="currentColor" />
    </svg>
  )
}
