import { useId, useMemo, useState, useEffect } from 'react'

/* ── shared shape vocabulary — also used by ModeShapesRow ─────────────────
   Four named silhouettes (good orb, fine orb, rounded square, circle) built
   from one polar formula: a squircle base radius (exact circle at n=2, a
   rounded square at n=4.5) plus an optional 3/5/7-harmonic wobble, r(θ) =
   squircleR(θ) + a3·sin(3θ+φ) + a5·sin(5θ−1.3φ) + a7·sin(7θ+1.9φ)·(0.7+0.3·
   sin(2φ+θ)). "Good" uses the vibration ring's own mild single-harmonic
   params (FrequencyCard's VibeRing), "fine" its busier three-harmonic ones.
   These are exported so other components (ModeShapesRow's icon frieze) can
   reuse the exact shapes without duplicating the math. */
const GOOD_RATIOS = { a3: 2.5 / 62, a5: 0, a7: 0 }
const FINE_RATIOS = { a3: 2 / 62, a5: 3 / 62, a7: 0.6 / 62 }

export const SHAPE_KINDS = ['good', 'fine', 'square', 'circle']
export const KIND_SPEC = {
  good:   { params: GOOD_RATIOS,             n: 2   },
  fine:   { params: FINE_RATIOS,             n: 2   },
  square: { params: { a3: 0, a5: 0, a7: 0 }, n: 4.5 },
  circle: { params: { a3: 0, a5: 0, a7: 0 }, n: 2   },
}

// "Shiny black" material other static, non-progress-tracking shapes
// (ModeShapesRow) borrow at full strength.
export const UNLIT_DARK = ['#4A453E', '#191612', '#060505']

export function squircleR(theta, R, n) {
  if (n <= 2) return R
  const c = Math.abs(Math.cos(theta)), s = Math.abs(Math.sin(theta))
  return R / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n)
}

export function orbPathD(cx, cy, R, phi, params, n = 2, steps = 72) {
  const a3 = R * params.a3, a5 = R * params.a5, a7 = R * params.a7
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2
    const baseR = squircleR(theta - phi, R, n)
    const r = baseR
      + a3 * Math.sin(3 * theta + phi)
      + a5 * Math.sin(5 * theta - 1.3 * phi)
      + a7 * Math.sin(7 * theta + 1.9 * phi) * (0.7 + 0.3 * Math.sin(2 * phi + theta))
    const x = cx + r * Math.cos(theta)
    const y = cy + r * Math.sin(theta)
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' '
  }
  return d + 'Z'
}

// ── "Clod" (direction 2a) — the bloom's own layout/render system ─────────
// Replaces the old petal-cluster system below this line. The shipped orb
// cluster, settled under a seeded gravity simulation onto a ground line into
// a compact mound, with a soft contact shadow; a dark, mode-less "loam core"
// sits at the bottom centre and holds the knocked-out overall %. No bleed,
// no stray pebbles, nothing animates — the physics run once per (width,
// height), not per frame. Built to the "Bloom — Clod (direction 2a)" spec;
// mocked up and verified in .mockups/bloom-clod.html before shipping here.

const MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

// Lit-mode gradient stops (2 or 3, spread evenly across the radial gradient).
// Exploration is a crisp, glossy white: bright through most of the sphere,
// with a firmer warm-grey edge so it keeps its shape against the paper.
// (The old forest green was ['#2E8A64', '#0C5038'].)
const MODE_LIT = {
  exploration:  ['#FFFFFF', '#FFFFFF', '#C9C4B5'],
  appreciation: ['#C7D4C1', '#9DB394'],
  nourishment:  ['#FFD166', '#F0A800'],
  survival:     ['#FF7A55', '#F03C10'],
}
// Unlit pieces and the core both borrow the exported UNLIT_DARK material
// above (same rich three-stop near-black ModeShapesRow's icons use at full
// strength) rather than a flatter two-stop local colour — same reasoning:
// it's "shiny black", not just dark.

// Pieces, area-weighted so the area units sum per mode to exactly 4:3:2:1.
const MODE_DEFS = [
  { mode: 'exploration',  areas: [1.36, 1.12, 0.88, 0.64] },
  { mode: 'appreciation', areas: [1.26, 0.99, 0.75] },
  { mode: 'nourishment',  areas: [0.84, 0.66, 0.50] },
  { mode: 'survival',     areas: [0.60, 0.40] },
]
// Total area units across the 12 pieces (≈9.94) plus the core (1.35² · π-ish
// weight of 1.82 in the packing-density formula below) ≈ 11.8.
const TOTAL_AREA_UNITS = 11.8

function buildPieces() {
  const pieces = []
  let n = 0
  MODE_DEFS.forEach(md => {
    md.areas.forEach(a => {
      pieces.push({ mode: md.mode, a, kind: n % 4, rot: (n * 37) % 50 - 25, seed: n * 1.37 + 0.5 })
      n++
    })
  })
  return pieces
}

// Superellipse + wobble, sampled parametrically (independent rx/ry, unlike
// orbPathD's single-radius polar formula above — that's what lets "good orb"
// and "fine orb" read as slightly flattened rather than perfectly round).
function sp(cx, cy, rx, ry, n, rotDeg, wob, seed, steps = 96) {
  const rot = rotDeg * Math.PI / 180
  let d = ''
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t)
    const k = 1 + wob * (0.5 * Math.sin(3 * t + seed) + 0.3 * Math.sin(5 * t + seed * 2.1) + 0.2 * Math.sin(7 * t + seed * 3.3))
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * rx * k
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * ry * k
    d += (i ? 'L' : 'M') + (cx + x * Math.cos(rot) - y * Math.sin(rot)).toFixed(1) + ' ' + (cy + x * Math.sin(rot) + y * Math.cos(rot)).toFixed(1)
  }
  return d + 'Z'
}
function pathForPiece(p) {
  switch (p.kind) {
    case 0: return sp(p.x, p.y, p.r, p.r * 0.96, 2.2, p.rot, 0.05, p.seed) // good orb
    case 1: return sp(p.x, p.y, p.r * 0.9, p.r * 0.9, 4, p.rot, 0.02, p.seed) // rounded square
    case 2: return sp(p.x, p.y, p.r, p.r, 2, 0, 0, 0) // circle
    default: return sp(p.x, p.y, p.r, p.r * 0.94, 2.6, p.rot, 0.03, p.seed) // fine orb
  }
}
function pathForCore(core) {
  return sp(core.x, core.y, core.r, core.r * 0.97, 2.2, 0, 0.03, 4.1)
}

// Seeded so the layout is identical on every render for a given (W, H) —
// never Math.random().
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Deterministic gravity packing: seed random init positions, then 420
// iterations of pairwise collision resolution (18% allowed overlap, tighter
// than the Clod spec's original 14% so neighbours interlock with less gap
// between them) + gravity + a light pull to centre (the last 80 iterations
// only relax, no new forces), clamped to the frame/floor throughout. The
// core participates in collisions but never moves itself — all of the
// push-apart goes to the other body. Memoized on (W, H) alone: only the
// lighting depends on fills.
// Overall scale of the mound — pieces and the whole packed shape shrink or
// grow together since every radius derives from this one factor on `u`.
const SIZE_SCALE = 0.85
// How hard pieces get pulled back toward the horizontal centre each settling
// iteration. The Clod spec's original 0.05 fights the sideways push-apart
// from collisions hard enough that the mound piles up tall and narrow near
// the centre instead of spreading; this weaker pull still keeps the pile
// roughly centred overall (so it doesn't drift to one edge) while letting
// collisions carry pieces much further out, which is what actually widens
// the footprint and lets it settle flatter.
const CENTER_PULL = 0.015

function layout(W, H) {
  const u = SIZE_SCALE * Math.min(Math.sqrt(W * H * 0.85 / (Math.PI * TOTAL_AREA_UNITS)), H / 4.6)
  const floor = H - 10
  const core = { x: W / 2, y: floor - 1.35 * u, r: 1.35 * u, pinned: true }

  const pieces = buildPieces()
  pieces.forEach(p => { p.r = Math.sqrt(p.a) * u })

  const rand = mulberry32(11)
  pieces.forEach(p => {
    p.x = W / 2 + (rand() - 0.5) * W * 0.8
    p.y = H / 2 + (rand() - 0.5) * H * 0.6
  })

  const bodies = pieces.concat([core])
  for (let iter = 0; iter < 420; iter++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bi = bodies[i], bj = bodies[j]
        let dx = bj.x - bi.x, dy = bj.y - bi.y
        let d = Math.sqrt(dx * dx + dy * dy)
        const minD = (bi.r + bj.r) * 0.76
        if (d < minD) {
          if (d < 1e-6) { d = 1e-6; dx = 0.001; dy = 0.001 }
          const nx = dx / d, ny = dy / d
          const overlap = minD - d
          if (bi.pinned || bj.pinned) {
            if (bi.pinned) { bj.x += nx * overlap; bj.y += ny * overlap }
            else { bi.x -= nx * overlap; bi.y -= ny * overlap }
          } else {
            bi.x -= nx * overlap * 0.5; bi.y -= ny * overlap * 0.5
            bj.x += nx * overlap * 0.5; bj.y += ny * overlap * 0.5
          }
        }
      }
    }
    if (iter <= 340) {
      pieces.forEach(p => {
        p.y += 1.4
        p.x += (W / 2 - p.x) * CENTER_PULL
      })
    }
    pieces.forEach(p => {
      p.x = Math.min(W - p.r, Math.max(p.r, p.x))
      p.y = Math.min(floor - p.r, Math.max(p.r, p.y))
    })
  }

  return { pieces, core, floor, u }
}

// Rounds out the mound's right side: a few small-to-medium, mode-less accent
// pieces — sized the same way as the real mode pieces (area units through
// the same `u` scale), not shrunk-down marbles — dropped in between the
// current right-side dome peak and the lower-right anchor piece, then
// settled by gravity/collision against the already-fixed mound so the whole
// right profile reads as one continuous curve instead of stepping down to a
// single low piece with a gap above it. These never light (no mode, no
// progress of their own) and are purely compositional, the same reasoning
// as the old petal cluster's PLOT_FILLER clumps. The real pieces and core
// are treated as fixed obstacles here — only the filler itself moves — so
// this never disturbs the already-settled main layout; it's still fully
// deterministic, just a second, smaller settle pass run against the first
// one's result.
function buildFiller(pieces, core, W, floor, u) {
  const rightHalf = pieces.filter(p => p.x > W / 2)
  const domePeak = rightHalf.reduce((a, p) => (p.y < a.y ? p : a))
  const rightmost = pieces.reduce((a, p) => (p.x + p.r > a.x + a.r ? p : a))
  const obstacles = pieces.concat([core])

  const targetX = (domePeak.x + rightmost.x) / 2 + rightmost.r * 0.25
  const areas = [0.72, 0.56, 0.44]
  const filler = areas.map((a, i) => ({
    r: Math.sqrt(a) * u,
    x: targetX + (i - 1) * u * 0.25,
    y: domePeak.y - u * (1.2 + i * 0.35),
    kind: (i + 1) % 4, rot: (i * 41) % 50 - 25, seed: i * 1.91 + 0.9,
  }))

  const bodies = obstacles.concat(filler)
  for (let iter = 0; iter < 240; iter++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = 0; j < filler.length; j++) {
        const bj = filler[j]
        if (bodies[i] === bj) continue
        const bi = bodies[i]
        let dx = bj.x - bi.x, dy = bj.y - bi.y
        let d = Math.sqrt(dx * dx + dy * dy)
        const minD = (bi.r + bj.r) * 0.74
        if (d < minD) {
          if (d < 1e-6) { d = 1e-6; dx = 0.001; dy = 0.001 }
          const nx = dx / d, ny = dy / d
          const overlap = minD - d
          if (obstacles.includes(bi)) { bj.x += nx * overlap; bj.y += ny * overlap }
          else { bi.x -= nx * overlap * 0.5; bi.y -= ny * overlap * 0.5; bj.x += nx * overlap * 0.5; bj.y += ny * overlap * 0.5 }
        }
      }
    }
    filler.forEach(p => {
      p.y += 1.3
      p.x += (targetX - p.x) * 0.02
    })
    filler.forEach(p => {
      p.x = Math.min(W - p.r, Math.max(p.r, p.x))
      p.y = Math.max(p.r, Math.min(floor - p.r, p.y))
    })
  }

  return filler
}

// Lighting rule — smallest to largest, area-honest: a piece lights once the
// mode's fill covers at least half of that piece's own area, so lit area
// tracks fill, quantized to the nearest piece. Returns a boolean array
// aligned to `pieces` rather than mutating them, so the memoized layout
// stays a pure function of (W, H).
function computeLit(pieces, fillByMode) {
  const byMode = {}
  pieces.forEach((p, i) => { (byMode[p.mode] ||= []).push({ i, a: p.a }) })
  const lit = new Array(pieces.length).fill(false)
  Object.keys(byMode).forEach(mode => {
    const list = byMode[mode].slice().sort((x, y) => x.a - y.a)
    const modeTotal = list.reduce((s, p) => s + p.a, 0)
    const fill = Math.max(0, Math.min(1, fillByMode[mode] || 0))
    let cum = 0
    list.forEach(({ i, a }) => {
      lit[i] = (cum + a / 2) <= fill * modeTotal
      cum += a
    })
  })
  return lit
}

const SIZE_BY_VARIANT = {
  wide: { w: 520, h: 150 },   // desktop
  plot: { w: 280, h: 220 },   // mobile
  classic: { w: 280, h: 220 },
}

// Props: arcs [{color, fill}] in MODE_ORDER, pct (0–100, already rounded by
// the caller), variant ('wide' selects the desktop 520×150 canvas; anything
// else uses the mobile 280×220 one — same two sizes the header's own CSS is
// tuned for).
export default function Bloom({ arcs, pct, variant = 'classic' }) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-z0-9]/gi, '') || 'b0'
  const [, bump] = useState(0)

  useEffect(() => {
    document.fonts?.ready?.then(() => bump(n => n + 1))
  }, [])

  const { w: W, h: H } = SIZE_BY_VARIANT[variant] || SIZE_BY_VARIANT.classic

  const fillByMode = {}
  arcs.forEach((a, i) => { fillByMode[MODE_ORDER[i]] = a.fill })

  const { pieces, core, floor, u } = useMemo(() => layout(W, H), [W, H])
  const filler = useMemo(() => buildFiller(pieces, core, W, floor, u), [pieces, core, W, floor, u])
  const lit = computeLit(pieces, fillByMode)

  const minX = Math.min(...pieces.map(b => b.x - b.r), ...filler.map(b => b.x - b.r), core.x - core.r)
  const maxX = Math.max(...pieces.map(b => b.x + b.r), ...filler.map(b => b.x + b.r), core.x + core.r)
  const minY = Math.min(...pieces.map(b => b.y - b.r), ...filler.map(b => b.y - b.r), core.y - core.r)
  const maxY = Math.max(...pieces.map(b => b.y + b.r), ...filler.map(b => b.y + b.r), core.y + core.r)

  // The number knocks out of whatever's actually sitting at the bloom's
  // true visual centre (bounding box of pieces + filler + core) — no
  // dedicated host shape. It'll cross several pieces' boundaries, same as
  // any other knockout here; that's the point, it reads as centred in the
  // whole mound rather than confined to one shape. The grounded "core"
  // itself stays exactly where the physics settled it (bottom-centre,
  // load-bearing for the rest of the mound's packing) — only the text
  // position moves.
  const textX = (minX + maxX) / 2
  const textY = (minY + maxY) / 2

  // Real pieces and the filler draw together, sorted by y so the mound
  // layers correctly regardless of which group a piece belongs to; filler
  // is tagged so it always renders unlit, never checked against `lit`.
  const drawable = useMemo(
    () => pieces.map((p, i) => ({ p, filler: false, litIndex: i }))
      .concat(filler.map(p => ({ p, filler: true })))
      .sort((a, b) => a.p.y - b.p.y),
    [pieces, filler]
  )

  const size = core.r * 0.82

  const mid = `ck-${uid}`   // knockout mask

  const ariaLabel = `Today ${pct}% complete. Exploration ${Math.round((fillByMode.exploration || 0) * 100)}%, ` +
    `appreciation ${Math.round((fillByMode.appreciation || 0) * 100)}%, nourishment ${Math.round((fillByMode.nourishment || 0) * 100)}%, ` +
    `survival ${Math.round((fillByMode.survival || 0) * 100)}%.`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      aria-label={ariaLabel}
      role="img"
    >
      <defs>
        {/* cx/cy/r match the old petal cluster's own highlight — a tighter
            radius than the Clod spec's original 0.80 concentrates the
            highlight instead of spreading it thin, which is what reads as
            "shiny" rather than flat. */}
        {MODE_ORDER.map(mode => (
          <radialGradient key={mode} id={`lg-${mode}-${uid}`} cx="0.34" cy="0.26" r="0.55">
            {MODE_LIT[mode].map((c, i, a) => (
              <stop key={i} offset={`${(i / (a.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </radialGradient>
        ))}
        {/* Unlit pieces and the core share the same rich, three-stop near-
            black UNLIT_DARK material ModeShapesRow's icons use — the Clod
            spec's own flatter two-stop grey read dull and muddy by
            comparison. */}
        <radialGradient id={`ug-${uid}`} cx="0.34" cy="0.26" r="0.55">
          <stop offset="0%"   stopColor={UNLIT_DARK[0]} />
          <stop offset="45%"  stopColor={UNLIT_DARK[1]} />
          <stop offset="100%" stopColor={UNLIT_DARK[2]} />
        </radialGradient>
        <radialGradient id={`cg-${uid}`} cx="0.34" cy="0.26" r="0.55">
          <stop offset="0%"   stopColor={UNLIT_DARK[0]} />
          <stop offset="45%"  stopColor={UNLIT_DARK[1]} />
          <stop offset="100%" stopColor={UNLIT_DARK[2]} />
        </radialGradient>

        <mask id={mid}>
          <rect x={-100} y={-100} width={W + 200} height={H + 200} fill="white" />
          <text
            x={textX} y={textY + size * 0.36}
            textAnchor="middle"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: `${size}px`, letterSpacing: '-0.02em' }}
            fill="black"
          >{pct}<tspan fontSize={size * 0.48} dx={1} dy={-size * 0.38}>%</tspan></text>
        </mask>
      </defs>

      <g mask={`url(#${mid})`}>
        {drawable.map(({ p, filler: isFiller, litIndex }, i) => (
          <path
            key={i}
            d={pathForPiece(p)}
            fill={!isFiller && lit[litIndex] ? `url(#lg-${p.mode}-${uid})` : `url(#ug-${uid})`}
          />
        ))}
        <path d={pathForCore(core)} fill={`url(#cg-${uid})`} />
      </g>
    </svg>
  )
}
