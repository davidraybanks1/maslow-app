import { useId, useState, useEffect } from 'react'

/* Petals per mode, big to small. The small ones at the edges give each mode
   finer steps, so lighting can track how much of the mode is actually done
   rather than jumping a whole big sphere on the first practice. They stay
   inside the original bloom's box (44..246 across, 44..222 down), which the
   Today layout depends on. */
const PETALS = [
  { mode: 'survival',    cx: 70,  cy: 150, r: 26 },
  { mode: 'survival',    cx: 58,  cy: 176, r: 14 },
  { mode: 'nourishment', cx: 104, cy: 106, r: 46 },
  { mode: 'nourishment', cx: 76,  cy: 126, r: 30 },
  { mode: 'nourishment', cx: 132, cy: 70,  r: 19 },
  { mode: 'appreciation',cx: 176, cy: 96,  r: 52 },
  { mode: 'appreciation',cx: 216, cy: 124, r: 34 },
  { mode: 'appreciation',cx: 232, cy: 158, r: 16 },
  { mode: 'exploration', cx: 146, cy: 160, r: 62 },
  { mode: 'exploration', cx: 206, cy: 174, r: 40 },
  { mode: 'exploration', cx: 96,  cy: 180, r: 34 },
  { mode: 'exploration', cx: 224, cy: 204, r: 18 },
  { mode: 'exploration', cx: 112, cy: 206, r: 16 },
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

function mixHex(h1, h2, t) {
  return '#' + [1, 3, 5].map(o => {
    const a = parseInt(h1.slice(o, o + 2), 16)
    const b = parseInt(h2.slice(o, o + 2), 16)
    return Math.round(a + (b - a) * t).toString(16).padStart(2, '0')
  }).join('')
}

/* Lit petals per mode: light from the smallest up, taking the set whose
   area comes closest to the mode's share done. Anything done lights at
   least the smallest petal; only a finished mode lights them all. */
const BY_MODE = {}
PETALS.forEach((p, i) => { (BY_MODE[p.mode] ||= []).push({ i, a: p.r * p.r }) })
Object.values(BY_MODE).forEach(list => list.sort((x, y) => x.a - y.a))

function litSet(fillByMode) {
  const lit = new Set()
  for (const mode in BY_MODE) {
    const list = BY_MODE[mode]
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

// Props: arcs [{color, fill}] in MODE_ORDER, pct (0–100)
export default function Bloom({ arcs, pct }) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-z0-9]/gi, '') || 'b0'
  const [, bump] = useState(0)

  useEffect(() => {
    document.fonts?.ready?.then(() => bump(n => n + 1))
  }, [])

  // Map arc fill to each mode
  const fillByMode = {}
  arcs.forEach((a, i) => { fillByMode[MODE_ORDER[i]] = a.fill })

  // Unlit gradient stops interpolated from pct
  const t = Math.max(0, Math.min(1, pct / 100))
  const u0 = UNLIT_DARK[0]
  const u1 = mixHex(UNLIT_DARK[1], UNLIT_EASED[1], t)
  const u2 = mixHex(UNLIT_DARK[2], UNLIT_EASED[2], t)

  const lit = litSet(fillByMode)
  const litMap = PETALS.map((_, i) => lit.has(i))

  const fid = `bs-${uid}`  // shadow filter
  const mid = `bm-${uid}`  // knockout mask

  return (
    <svg
      viewBox="-5 30 280 220"
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
            x="143" y="160"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 300,
              fontSize: '58px',
              letterSpacing: '-1px',
              fontFeatureSettings: "'tnum' 1",
            }}
            fill="black"
          >{pct}<tspan fontSize="25px" dy="-14">%</tspan></text>
        </mask>
      </defs>

      {/* Shadow layer — alpha-only blur; fill colour is irrelevant */}
      <g filter={`url(#${fid})`} aria-hidden="true">
        {PETALS.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#000" />
        ))}
      </g>

      {/* Main bloom — knockout mask cuts pct% text through the petals */}
      <g mask={`url(#${mid})`}>
        {PETALS.map((p, i) => (
          <circle
            key={i}
            cx={p.cx} cy={p.cy} r={p.r}
            fill={litMap[i] ? `url(#lg-${p.mode}-${uid})` : `url(#ug-${uid})`}
          />
        ))}
      </g>
    </svg>
  )
}
