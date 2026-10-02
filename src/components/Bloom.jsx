import { useId, useState, useEffect } from 'react'

/* Petals per mode, big to small. The small ones at the edges give each mode
   finer steps, so lighting can track how much of the mode is actually done
   rather than jumping a whole big sphere on the first practice. They stay
   inside the original bloom's box (44..246 across, 44..222 down), which the
   mobile header layout depends on. */
const PETALS_CLASSIC = [
  { mode: 'survival',    cx: 70,  cy: 150, r: 26 },
  { mode: 'survival',    cx: 58,  cy: 176, r: 14 },
  { mode: 'nourishment', cx: 104, cy: 106, r: 46 },
  { mode: 'nourishment', cx: 76,  cy: 126, r: 30 },
  { mode: 'nourishment', cx: 132, cy: 70,  r: 19 },
  { mode: 'appreciation',cx: 176, cy: 96,  r: 52 },
  { mode: 'appreciation',cx: 216, cy: 124, r: 34 },
  { mode: 'appreciation',cx: 204, cy: 58,  r: 14 },
  { mode: 'exploration', cx: 146, cy: 160, r: 62 },
  { mode: 'exploration', cx: 206, cy: 174, r: 40 },
  { mode: 'exploration', cx: 96,  cy: 180, r: 34 },
  { mode: 'exploration', cx: 232, cy: 140, r: 15 },
  { mode: 'exploration', cx: 112, cy: 206, r: 16 },
]

/* Same 13 circles as PETALS_CLASSIC - same mode order, same radii - just
   spread wider and flatter around the classic cluster's own centroid
   (140.6, 135.8, the unweighted average of its 13 centers): cx' = cx0 +
   (cx-cx0)*1.55, cy' = cy0 + (cy-cy0)*0.62. For the desktop header, which
   has width to spare but not much height, so the bloom reads as a wide
   spray instead of a round cluster while every petal keeps its size and
   its mode. */
const PETALS_WIDE = [
  { mode: 'survival',    cx: 31.2,  cy: 144.6, r: 26 },
  { mode: 'survival',    cx: 12.6,  cy: 160.7, r: 14 },
  { mode: 'nourishment', cx: 83.9,  cy: 117.3, r: 46 },
  { mode: 'nourishment', cx: 40.5,  cy: 129.7, r: 30 },
  { mode: 'nourishment', cx: 127.3, cy: 95.0,  r: 19 },
  { mode: 'appreciation',cx: 195.5, cy: 111.1, r: 52 },
  { mode: 'appreciation',cx: 257.5, cy: 128.5, r: 34 },
  { mode: 'appreciation',cx: 238.9, cy: 87.6,  r: 14 },
  { mode: 'exploration', cx: 149.0, cy: 150.8, r: 62 },
  { mode: 'exploration', cx: 242.0, cy: 159.5, r: 40 },
  { mode: 'exploration', cx: 71.5,  cy: 163.2, r: 34 },
  { mode: 'exploration', cx: 282.3, cy: 138.4, r: 15 },
  { mode: 'exploration', cx: 96.3,  cy: 179.3, r: 16 },
]

const MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

const MODE_LIT = {
  exploration:  ['#2E8A64', '#0C5038'],
  appreciation: ['#C7D4C1', '#9DB394'],
  nourishment:  ['#FFD166', '#F0A800'],
  survival:     ['#FF7A55', '#F03C10'],
}

// Unlit 3-stop: stop[0] pinned (same in both arrays), stops[1] and [2] interpolate with pct
const UNLIT_DARK  = ['#4A453E', '#191612', '#060505']
const UNLIT_EASED = ['#4A453E', '#2E2A25', '#231F1A']

// ── petal silhouettes: the vibration ring's own "good"-rooted wobble ────
// r = R + a3·sin(3θ+φ) + a5·sin(5θ−1.3φ) + a7·sin(7θ+1.9φ)·(0.7+0.3·sin(2φ+θ)),
// the identical formula FrequencyCard's VibeRing uses, so the two check-in
// visuals read as the same family. Every petal mostly sits at "good"'s own
// params (a5 = a7 = 0, the calmest shape the ring ever takes) scaled into
// its own radius; a golden-angle sequence (2.399963 rad ≈ 137.5°, the same
// angle sunflower seeds spiral by) rotates each petal by up to ±0.65 rad so
// they don't read as one shape stamped thirteen times, and a second, offset
// golden-angle sequence lets roughly a third of the petals drift up to 45%
// of the way toward "fine"'s busier a5/a7 wobble, so a few read as
// genuinely different shapes rather than just turned copies. Bloom never
// animates, so each petal's path is fixed by its index and built once
// below (see VARIANTS), not recomputed per render.
const GOOD_RATIOS = { a3: 2.5 / 62, a5: 0, a7: 0 }
const FINE_RATIOS = { a3: 2 / 62, a5: 3 / 62, a7: 0.6 / 62 }

const phiForPetal = i => {
  const frac = (i * 2.399963) % 1
  return 0.6 + (frac - 0.5) * 1.3
}
const veerForPetal = i => {
  const frac = (i * 2.399963 + 0.5) % 1
  return Math.max(0, (frac - 0.62) / 0.38) * 0.45
}
const paramsForPetal = i => {
  const t = veerForPetal(i)
  return {
    a3: GOOD_RATIOS.a3 * (1 - t) + FINE_RATIOS.a3 * t,
    a5: FINE_RATIOS.a5 * t,
    a7: FINE_RATIOS.a7 * t,
  }
}

function orbPathD(cx, cy, R, phi, params, steps = 72) {
  const a3 = R * params.a3, a5 = R * params.a5, a7 = R * params.a7
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2
    const r = R
      + a3 * Math.sin(3 * theta + phi)
      + a5 * Math.sin(5 * theta - 1.3 * phi)
      + a7 * Math.sin(7 * theta + 1.9 * phi) * (0.7 + 0.3 * Math.sin(2 * phi + theta))
    const x = cx + r * Math.cos(theta)
    const y = cy + r * Math.sin(theta)
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' '
  }
  return d + 'Z'
}

const petalPathsFor = petals => petals.map((p, i) => orbPathD(p.cx, p.cy, p.r, phiForPetal(i), paramsForPetal(i)))

function mixHex(h1, h2, t) {
  return '#' + [1, 3, 5].map(o => {
    const a = parseInt(h1.slice(o, o + 2), 16)
    const b = parseInt(h2.slice(o, o + 2), 16)
    return Math.round(a + (b - a) * t).toString(16).padStart(2, '0')
  }).join('')
}

/* Lit petals per mode: light from the smallest up, taking the set whose
   area comes closest to the mode's share done. Anything done lights at
   least the smallest petal; only a finished mode lights them all. Built
   once per layout (not per render) since it only depends on each petal's
   fixed radius. */
function buildByMode(petals) {
  const byMode = {}
  petals.forEach((p, i) => { (byMode[p.mode] ||= []).push({ i, a: p.r * p.r }) })
  Object.values(byMode).forEach(list => list.sort((x, y) => x.a - y.a))
  return byMode
}

// Per-variant layout: petal positions, the SVG's own crop, and the pct-text
// mask sized/centered for that crop. "wide" is the same shape, just spread
// out - see PETALS_WIDE above.
const VARIANTS = {
  classic: {
    petals: PETALS_CLASSIC,
    byMode: buildByMode(PETALS_CLASSIC),
    petalPaths: petalPathsFor(PETALS_CLASSIC),
    viewBox: '-5 30 280 220',
    textX: 143, textY: 160, textSize: 58, pctSize: 25, pctDy: -14,
  },
  wide: {
    petals: PETALS_WIDE,
    byMode: buildByMode(PETALS_WIDE),
    petalPaths: petalPathsFor(PETALS_WIDE),
    viewBox: '-16 44 330 185',
    textX: 149, textY: 136, textSize: 48, pctSize: 21, pctDy: -12,
  },
}

function litSet(fillByMode, byMode) {
  const lit = new Set()
  for (const mode in byMode) {
    const list = byMode[mode]
    const fill = Math.max(0, Math.min(1, fillByMode[mode] || 0))
    if (fill <= 0) continue
    if (fill >= 1) { list.forEach(p => lit.add(p.i)); continue }
    const total = list.reduce((s, p) => s + p.a, 0)
    const target = fill * total
    let best = 1, bestDiff = Infinity, cum = 0
    for (let k = 1; k < list.length; k++) {   // never all of them short of done
      cum += list[k - 1].a
      const diff = Math.abs(cum - target)
      if (diff < bestDiff) { bestDiff = diff; best = k }
    }
    for (let k = 0; k < best; k++) lit.add(list[k].i)
  }
  return lit
}

// Props: arcs [{color, fill}] in MODE_ORDER, pct (0–100), variant
// ('classic' | 'wide' — same petal count/sizes either way, just laid out
// wider/flatter for the desktop header)
export default function Bloom({ arcs, pct, variant = 'classic' }) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-z0-9]/gi, '') || 'b0'
  const [, bump] = useState(0)

  useEffect(() => {
    document.fonts?.ready?.then(() => bump(n => n + 1))
  }, [])

  const { petals: PETALS, byMode, petalPaths, viewBox, textX, textY, textSize, pctSize, pctDy } =
    VARIANTS[variant] || VARIANTS.classic

  // Map arc fill to each mode
  const fillByMode = {}
  arcs.forEach((a, i) => { fillByMode[MODE_ORDER[i]] = a.fill })

  // Unlit gradient stops interpolated from pct
  const t = Math.max(0, Math.min(1, pct / 100))
  const u0 = UNLIT_DARK[0]
  const u1 = mixHex(UNLIT_DARK[1], UNLIT_EASED[1], t)
  const u2 = mixHex(UNLIT_DARK[2], UNLIT_EASED[2], t)

  const lit = litSet(fillByMode, byMode)
  const litMap = PETALS.map((_, i) => lit.has(i))

  const fid = `bs-${uid}`  // shadow filter
  const mid = `bm-${uid}`  // knockout mask

  return (
    <svg
      viewBox={viewBox}
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      aria-label={`${pct}% complete today`}
      role="img"
    >
      <defs>
        {MODE_ORDER.map(mode => (
          <radialGradient key={mode} id={`lg-${mode}-${uid}`} cx="34%" cy="26%">
            <stop offset="0%"   stopColor={MODE_LIT[mode][0]} />
            <stop offset="100%" stopColor={MODE_LIT[mode][1]} />
          </radialGradient>
        ))}

        <radialGradient id={`ug-${uid}`} cx="34%" cy="26%">
          <stop offset="0%"   stopColor={u0} />
          <stop offset="45%"  stopColor={u1} />
          <stop offset="100%" stopColor={u2} />
        </radialGradient>

        <filter id={fid} x="-30%" y="-30%" width="160%" height="160%"
                colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="9" />
          <feOffset dy="6" />
          <feComponentTransfer><feFuncA type="linear" slope="0.13" /></feComponentTransfer>
        </filter>

        <mask id={mid}>
          <rect x="-200" y="-200" width="700" height="700" fill="white" />
          <text
            x={textX} y={textY}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 300,
              fontSize: `${textSize}px`,
              letterSpacing: '-1px',
              fontFeatureSettings: "'tnum' 1",
            }}
            fill="black"
          >{pct}<tspan fontSize={`${pctSize}px`} dy={pctDy}>%</tspan></text>
        </mask>
      </defs>

      {/* Shadow layer — alpha-only blur; fill colour is irrelevant */}
      <g filter={`url(#${fid})`} aria-hidden="true">
        {PETALS.map((p, i) => (
          <path key={i} d={petalPaths[i]} fill="#000" />
        ))}
      </g>

      {/* Main bloom — knockout mask cuts pct% text through the petals */}
      <g mask={`url(#${mid})`}>
        {PETALS.map((p, i) => (
          <path
            key={i}
            d={petalPaths[i]}
            fill={litMap[i] ? `url(#lg-${p.mode}-${uid})` : `url(#ug-${uid})`}
          />
        ))}
      </g>
    </svg>
  )
}
