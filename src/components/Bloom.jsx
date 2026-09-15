import { useId, useState, useEffect } from 'react'

const PETALS = [
  { mode: 'survival',    cx: 70,  cy: 150, r: 26 },
  { mode: 'nourishment', cx: 104, cy: 106, r: 46 },
  { mode: 'nourishment', cx: 76,  cy: 126, r: 30 },
  { mode: 'appreciation',cx: 176, cy: 96,  r: 52 },
  { mode: 'appreciation',cx: 216, cy: 124, r: 34 },
  { mode: 'exploration', cx: 146, cy: 160, r: 62 },
  { mode: 'exploration', cx: 206, cy: 174, r: 40 },
  { mode: 'exploration', cx: 96,  cy: 180, r: 34 },
]

const MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

// Light (highlight) and deep (shadow) stops for each lit mode
const MODE_LIT = {
  exploration:  ['#3D7052', '#081910'],
  appreciation: ['#CDD9C6', '#546150'],
  nourishment:  ['#F2CC4A', '#9A6E00'],
  survival:     ['#E86750', '#871404'],
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

// Count petals per mode to determine lit threshold
const MODE_COUNTS = {}
PETALS.forEach(p => { MODE_COUNTS[p.mode] = (MODE_COUNTS[p.mode] || 0) + 1 })

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

  // Determine lit state: petal idx of n is lit when fill >= (idx + 0.5) / n
  const modeIdx = {}
  const litMap = PETALS.map(p => {
    modeIdx[p.mode] = (modeIdx[p.mode] || 0)
    const idx = modeIdx[p.mode]++
    const n = MODE_COUNTS[p.mode]
    const fill = fillByMode[p.mode] || 0
    return fill >= (idx + 0.5) / n
  })

  // Single light source in user coordinates (viewBox "-5 30 280 220")
  const LX = 90
  const LY = 87
  const GR = 200

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
          <radialGradient
            key={mode}
            id={`lg-${mode}-${uid}`}
            cx={LX} cy={LY} r={GR}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor={MODE_LIT[mode][0]} />
            <stop offset="100%" stopColor={MODE_LIT[mode][1]} />
          </radialGradient>
        ))}

        <radialGradient
          id={`ug-${uid}`}
          cx={LX} cy={LY} r={GR}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor={u0} />
          <stop offset="45%"  stopColor={u1} />
          <stop offset="100%" stopColor={u2} />
        </radialGradient>

        <filter id={fid} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodOpacity="0.18" />
        </filter>

        <mask id={mid}>
          <rect x="-200" y="-200" width="700" height="700" fill="white" />
          <text
            x="143" y="167"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '58px', letterSpacing: '-1px' }}
            fill="black"
          >{pct}</text>
          <text
            x="175" y="152"
            textAnchor="start"
            dominantBaseline="middle"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '25px' }}
            fill="black"
          >%</text>
        </mask>
      </defs>

      {/* Shadow layer — unmasked copy behind the main bloom */}
      <g filter={`url(#${fid})`} opacity="0.4">
        {PETALS.map((p, i) => (
          <circle
            key={i}
            cx={p.cx} cy={p.cy} r={p.r}
            fill={litMap[i] ? `url(#lg-${p.mode}-${uid})` : `url(#ug-${uid})`}
          />
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
