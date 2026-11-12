import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildLadder, openSecondDoor, walkLadder, oneIn } from '../lib/ladder'
import { MODE_ORDER } from '../lib/constants'
import { useChartCapture } from '../lib/useChartCapture'
import { SectionTitle, WordTabs } from './loam'
import styles from './RootsSection.module.css'

/* ── The ladder, drawn as a root system ──────────────────────────────────
   Depth is evidence: a significant root grows 108 units per level, a quiet
   one 30, a new one is a dotted stub. A root can only grow from where its
   parent stopped - which is the gate, made physical. A shallow mode keeps
   its needs shallow whatever they would score alone. The one root that
   reaches bottom is the finding.

   Depth means evidence rather than level, so position cannot say whether a
   thing is a need or a practice. Orientation does: a need's name sits beside
   its tip, a practice's runs down its root the way a botanical plate labels
   a rootlet. Anything that would land on another label is nudged down and
   given a leader back to its tip. */

const DEPTH  = { significant: 108, close: 76, testing: 52, quiet: 30, new: 14 }
const WEIGHT = { significant: 3.2, close: 2.1, testing: 1.35, quiet: 0.9, new: 0.9 }
/* every root is its mode's colour; how much it shows is how much evidence it has */
const STRENGTH = { significant: 1, close: 0.72, testing: 0.5, quiet: 0.28, new: 0.36 }
const ORDER = ['significant', 'close', 'testing', 'quiet', 'new']
const LEVELS = [
  { v: 'significant', label: 'strong', shows: ['significant'] },
  { v: 'close',       label: '+ emerging',  shows: ['significant', 'close'] },
  { v: 'testing',     label: '+ light',     shows: ['significant', 'close', 'testing'] },
]
const MODE_FILL = {
  exploration: 'var(--loam-exploration)', appreciation: 'var(--loam-appreciation)',
  nourishment: 'var(--loam-nourishment)', survival: 'var(--loam-survival)',
}
const MODE_TEXT = {
  exploration: 'var(--loam-exploration-text)', appreciation: 'var(--loam-appreciation-text)',
  nourishment: 'var(--loam-nourishment-text)', survival: 'var(--loam-survival-text)',
}
/* the pyramid, bottom to top, left to right */
const DRAW_ORDER = [...MODE_ORDER].reverse()

/* The drawing is laid out in real CSS pixels: its width is measured and one
   viewBox unit is one pixel at 1x, so a 12px label is 12px on every phone. PAD
   is the room labels may hang past the ground line, inside the page gutter. */
const PAD = 24, SURF = 48, FALLBACK_W = 349
/* DM Mono at the 12px floor runs about 7.3px a character; every label box
   below is estimated from this, so the collision rule is honest at the size
   the labels actually render. */
const CW = 7.3
const litLeaf = t => ORDER.indexOf(t) <= 2
function leaves(n) { return n.children?.length ? n.children.reduce((s, c) => s + leaves(c), 0) : (litLeaf(n.tier) ? 3 : 1) }
const modeWeight = m => Math.max(leaves(m), 9)   // never narrower than its own name
/* deterministic wobble, so roots look grown rather than plotted, and stay put between renders */
function wob(seed, amt) { const x = Math.sin(seed * 12.9898) * 43758.5453; return ((x - Math.floor(x)) - 0.5) * amt }

function layout(tree, W) {
  const edges = [], nodes = []
  let seed = 0
  const place = (n, x0, x1, y0, depth, parent) => {
    seed++
    const cx = (x0 + x1) / 2 + wob(seed, Math.min(18, (x1 - x0) * 0.35))
    const y1 = y0 + DEPTH[n.tier]
    const node = { ref: n, x: cx, y0, y1, depth, parent, tier: n.tier, name: n.name, kind: n.kind, mode: parent ? parent.mode : n.name }
    nodes.push(node)
    if (parent) edges.push({ from: parent, to: node, tier: n.tier })
    const kids = n.children || []
    if (kids.length) {
      const total = kids.reduce((s, c) => s + leaves(c), 0)
      let acc = x0
      kids.forEach(c => { const w = (x1 - x0) * leaves(c) / total; place(c, acc, acc + w, y1, depth + 1, node); acc += w })
    }
    return node
  }
  const total = tree.reduce((s, m) => s + modeWeight(m), 0)
  let acc = 0
  const modes = tree.map(m => { const w = W * modeWeight(m) / total; const nd = place(m, acc, acc + w, SURF, 0, null); acc += w; return nd })
  return { edges, nodes, modes }
}

function bez(e) {
  const p = e.from, c = e.to
  const sy = p.y1 - Math.min(10, (p.y1 - p.y0) * 0.35), sx = p.x
  const bend = wob(c.x + c.y1, 10)
  const my = sy + (c.y1 - sy) * 0.55
  return [[sx, sy], [sx + bend, sy + (c.y1 - sy) * 0.35], [c.x - bend, my], [c.x, c.y1]]
}
function path(e) {
  const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = bez(e)
  return `M${ax.toFixed(1)} ${ay.toFixed(1)} C${bx.toFixed(1)} ${by.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}, ${dx.toFixed(1)} ${dy.toFixed(1)}`
}
/* points along each root about 2px apart, so a label can tell whether it would sit on one */
function samples(e) {
  const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = bez(e)
  const out = []
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, u = 1 - t
    out.push([u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * dx,
              u * u * u * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t * t * t * dy])
  }
  return out
}

/* mode names run along the surface, staggered low / high so neighbours never
   touch; a name near an edge is pulled in so it stays on the page */
const modeLabX = (m, W) => {
  const half = m.name.length * CW * 1.1 / 2 + 2
  return Math.max(-PAD + half, Math.min(W + PAD - half, m.x)).toFixed(1)
}

/* the signed, whole-point gap a label prints; nothing when there isn't one */
const gapLabel = gap => {
  if (!Number.isFinite(gap)) return null
  const g = Math.round(gap)
  return g === 0 ? null : `${g > 0 ? '+' : '−'}${Math.abs(g)}`
}

/* Labels, with the collision rule: a label keeps CLEAR px off every other
   label and off every line in the drawing (the roots, its own included, the
   mode stems and the ground line, measured from the stroke's edge).
   A need's label tries the places beside its tip nearest first: either side,
   above or below, stepped outward and up or down, and finally with its number
   on the same line as its name. The nearest clean place wins; only if none is
   clean does it take the one touching the least root. A leader runs back to
   the tip whenever the label has moved. */
const CLEAR = 4, LH = 14
const LW = 7.44   // a label character as it renders: DM Mono's 0.6em at 12px plus 0.02em of letter-spacing
/* where a need's label may move from its first place: up to 120px outward and
   from a line above to ten lines below, as [dx, dy, cost], nearest first */
const OFFSETS = []
for (let sx = 0; sx <= 120; sx += 4) for (let sy = -14; sy <= 140; sy += 7) OFFSETS.push([sx, sy, (sx + Math.abs(sy)) * 0.03])
OFFSETS.sort((a, b) => a[2] - b[2])
function placeLabels(geo, W, shows) {
  const lit = n => shows.includes(n.tier)
  const placed = []
  const onLabel = bx => placed.some(p => bx.x0 < p.x1 + CLEAR && bx.x1 > p.x0 - CLEAR && bx.y0 < p.y1 + CLEAR && bx.y1 > p.y0 - CLEAR)

  /* Every line is drawn into a 1px map already widened by its half-stroke and
     CLEAR, with a summed-area table over it, so asking whether a box touches
     any line costs four lookups however many roots there are. */
  const GW = Math.ceil(W + PAD * 2) + 1
  const GH = Math.ceil(Math.max(...geo.nodes.map(n => n.y1))) + 260
  const ink = new Uint8Array(GW * GH)
  const mark = (pts, half) => {
    const c = CLEAR + half, r = Math.ceil(c)
    for (const [x, y] of pts) {
      const gx = x + PAD
      for (let dy = -r; dy <= r; dy++) {
        const py = Math.floor(y + dy)
        if (py < 0 || py >= GH) continue
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > c * c) continue
          const px = Math.floor(gx + dx)
          if (px >= 0 && px < GW) ink[py * GW + px] = 1
        }
      }
    }
  }
  geo.edges.forEach(e => mark(samples(e), (e.to.ref.wild ? WEIGHT.significant : WEIGHT[e.tier]) / 2))
  geo.modes.forEach(m => mark(Array.from({ length: Math.ceil((m.y1 - SURF) / 2) + 1 }, (_, i) => [m.x, Math.min(m.y1, SURF + i * 2)]), WEIGHT[m.tier] / 2))
  mark(Array.from({ length: Math.ceil(W / 2) + 1 }, (_, i) => [Math.min(W, i * 2), SURF]), 0.5)
  const sat = new Int32Array((GW + 1) * (GH + 1))
  for (let y = 0; y < GH; y++) {
    let row = 0
    for (let x = 0; x < GW; x++) {
      row += ink[y * GW + x]
      sat[(y + 1) * (GW + 1) + x + 1] = sat[y * (GW + 1) + x + 1] + row
    }
  }
  const onRoot = bx => {
    const x0 = Math.max(0, Math.floor(bx.x0 + PAD)), x1 = Math.min(GW, Math.ceil(bx.x1 + PAD))
    const y0 = Math.max(0, Math.floor(bx.y0)), y1 = Math.min(GH, Math.ceil(bx.y1))
    if (x1 <= x0 || y1 <= y0) return 0
    const S = (x, y) => sat[y * (GW + 1) + x]
    return S(x1, y1) - S(x0, y1) - S(x1, y0) + S(x0, y0)
  }

  // the mode names count as labels already placed
  geo.modes.forEach((m, i) => {
    const cx = Number(modeLabX(m, W)), half = m.name.length * CW * 1.1 / 2, base = SURF - (i % 2 ? 27 : 11)
    placed.push({ x0: cx - half, x1: cx + half, y0: base - 12, y1: base + 4 })
  })
  const inPage = bx => bx.x0 >= -PAD + 2 && bx.x1 <= W + PAD - 2 && bx.y0 >= 0
  // the nearest clean candidate, else the one on the least root
  const settle = cands => {   // cands come cheapest first
    let best = null
    for (const c of cands) {
      if (!inPage(c.bx) || onLabel(c.bx)) continue
      const hits = onRoot(c.bx)
      if (!hits) return c
      if (!best || hits < best.hits) best = { ...c, hits }
    }
    return best
  }
  // a label's box, from its first baseline: 12px of ascent, 4px of descent, LH a line
  const boxAt = (x0, w, base, lines) => ({ x0, x1: x0 + w, y0: base - 12, y1: base + (lines - 1) * LH + 4 })
  const labels = []
  // significant labels claim their place first; everything else moves around them
  const rank = n => ORDER.indexOf(n.tier)
  const litKid = n => (n.ref.children || []).some(c => lit(c))
  geo.nodes
    .filter(n => n.depth > 0 && (lit(n) || (n.depth === 1 && litKid(n))))
    .sort((a, b) => rank(a) - rank(b) || a.y1 - b.y1 || a.x - b.x)
    .forEach(n => {
      const num = gapLabel(n.ref.gap)
      if (n.depth === 1) {
        // a need's name sits beside its tip - above it if it can, where only the
        // one root comes in, else below, where its children fan out
        const outside = n.x >= n.parent.x
        const forms = [{ inline: false, lines: num ? 2 : 1, w: Math.max(n.name.length, num ? num.length : 0) * LW, pref: 0 }]
        if (num) forms.push({ inline: true, lines: 1, w: (n.name.length + 1 + num.length) * LW, pref: 1.5 })
        // the eight starting places (form × side × above/below), each walked
        // outward along OFFSETS; merged so candidates come nearest first overall
        const starts = []
        for (const f of forms) for (const right of [outside, !outside]) for (const above of [true, false])
          starts.push({ ...f, right, above, base0: above ? n.y1 - 6 - (f.lines - 1) * LH : n.y1 + 6,
            pref: f.pref + (above ? 0 : 0.25) + (right === outside ? 0 : 0.1), k: 0 })
        const cands = {
          * [Symbol.iterator]() {
            for (;;) {
              let s = null
              for (const t of starts) if (t.k < OFFSETS.length && (!s || t.pref + OFFSETS[t.k][2] < s.pref + OFFSETS[s.k][2])) s = t
              if (!s) return
              const [sx, sy] = OFFSETS[s.k++]
              const x0 = s.right ? n.x + 8 + sx : n.x - 8 - s.w - sx
              yield { right: s.right, above: s.above, inline: s.inline, sx, sy, base: s.base0 + sy, bx: boxAt(x0, s.w, s.base0 + sy, s.lines) }
            }
          },
        }
        const b = settle(cands)
        if (!b) return
        placed.push(b.bx)
        const x = b.right ? b.bx.x0 : b.bx.x1   // the text starts (or ends) on its box's edge
        labels.push({ n, kind: 'need', right: b.right, x, y: b.base, num, inline: b.inline, leader: b.sx !== 0 || b.sy !== 0, bottom: b.bx.y1 })
      } else {
        // a practice runs down its root, its number after its name; the turned
        // text sits from just left of the root to its ascent on the right
        const th = (n.name.length + (num ? num.length + 1 : 0)) * LW
        const cands = []
        for (let sy = 0; sy <= 98; sy += 7) cands.push({ sy, bx: { x0: n.x, x1: n.x + 17, y0: n.y1 + 6 + sy, y1: n.y1 + 8 + th + sy } })
        const b = settle(cands)
        if (!b) return
        placed.push(b.bx)
        labels.push({ n, kind: 'practice', y: n.y1 + 8 + b.sy, num, leader: b.sy > 0, bottom: b.bx.y1 })
      }
    })
  const H = Math.max(...geo.nodes.map(n => n.y1 + 20), ...labels.map(l => l.bottom || 0)) + 12
  return { labels, H }
}

export default function RootsSection({ canvas, checkins, moods, practicesDB, ghost }) {
  const [level, setLevel] = useState('testing')
  const [picked, setPicked] = useState(null)

  /* zoom: pinch on the drawing, or the +/- pair. The drawing grows inside a
     box that keeps its 1x height, so you pan around it rather than the page
     stretching; a zoom keeps whatever was under the middle of the box there. */
  const [zoom, setZoom] = useState(1)
  const boxRef = useRef(null)
  const [baseH, setBaseH] = useState(0)   // the box's height at 1x, kept while zoomed
  const pinch = useRef(null)
  const zoomTo = useCallback(z => setZoom(Math.min(3, Math.max(1, Math.round(z * 20) / 20))), [])
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const start = e => { if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: zoom } }
    const move = e => {
      if (!pinch.current || e.touches.length !== 2) return
      e.preventDefault()
      zoomTo(pinch.current.z * dist(e.touches) / pinch.current.d)
    }
    const end = () => { pinch.current = null }
    box.addEventListener('touchstart', start, { passive: true })
    box.addEventListener('touchmove', move, { passive: false })
    box.addEventListener('touchend', end)
    box.addEventListener('touchcancel', end)
    return () => {
      box.removeEventListener('touchstart', start); box.removeEventListener('touchmove', move)
      box.removeEventListener('touchend', end); box.removeEventListener('touchcancel', end)
    }
  }, [zoom, zoomTo])
  const prevZoom = useRef(1)
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    if (zoom === 1) setBaseH(box.clientHeight)
    const k = zoom / prevZoom.current
    box.scrollLeft = (box.scrollLeft + box.clientWidth / 2) * k - box.clientWidth / 2
    box.scrollTop = (box.scrollTop + box.clientHeight / 2) * k - box.clientHeight / 2
    prevZoom.current = zoom
  }, [zoom, level])

  const { tree } = useMemo(() => {
    const t = buildLadder({ canvas, checkins, moods, practicesDB, modeOrder: DRAW_ORDER })
    openSecondDoor(t, practicesDB)   // marks the wild roots on the tree
    // buildLadder sorts by tier; the drawing wants the pyramid order
    t.sort((a, b) => DRAW_ORDER.indexOf(a.name) - DRAW_ORDER.indexOf(b.name))
    return { tree: t }
  }, [canvas, checkins, moods, practicesDB])

  const hasTree = tree.length > 0
  const [boxW, setBoxW] = useState(0)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const read = () => setBoxW(box.clientWidth)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(box)
    return () => ro.disconnect()
  }, [hasTree])
  const W = boxW ? Math.max(240, boxW - PAD * 2) : FALLBACK_W

  const geo = useMemo(() => layout(tree, W), [tree, W])
  const chartRef = useChartCapture('data-roots', 'your roots', !ghost)
  // where the labels go depends only on the drawing and how much it shows, so a
  // zoom or a tap on a root never has to work it out again
  const { labels, H } = useMemo(() => (hasTree ? placeLabels(geo, W, LEVELS.find(l => l.v === level).shows) : { labels: [], H: 0 }), [hasTree, geo, W, level])
  if (!hasTree) return null

  return (
    <section ref={chartRef} className={styles.section} data-dock="DATA · ALL HISTORY">
      <div className={styles.pad}>
        <SectionTitle lead="your" turn="roots." sub="the deeper the root, the more it lines up with good check-ins." />

        <div ref={boxRef} className={`${styles.box}${zoom > 1 ? ` ${styles.boxZoomed}` : ''}`}
          style={zoom > 1 && baseH ? { maxHeight: baseH } : undefined}>
        <svg className={styles.roots} style={{ width: `${zoom * 100}%` }} viewBox={`${-PAD} 0 ${W + PAD * 2} ${H}`} role="img" aria-label="root system of modes, needs and practices">
          <line x1="0" y1={SURF} x2={W} y2={SURF} className={styles.surface} />

          {[...ORDER].reverse().map(tier =>
            geo.edges.filter(e => e.tier === tier).map((e, i) => (
              <path key={`${tier}-${i}`} d={path(e)} fill="none" stroke={MODE_TEXT[e.to.mode] || 'var(--loam-ink)'}
                // a wild root is drawn full strength and hangs off a faint parent; the contrast is the point
                strokeOpacity={e.to.ref.wild ? 1 : STRENGTH[tier]} strokeWidth={e.to.ref.wild ? WEIGHT.significant : WEIGHT[tier]}
                strokeLinecap="round" strokeDasharray={tier === 'new' ? '1.5 2.5' : undefined}
                onClick={() => setPicked(e.to.ref)} style={{ cursor: 'pointer' }} />
            ))
          )}

          {geo.modes.map((m, i) => (
            <g key={m.name} onClick={() => setPicked(m.ref)} style={{ cursor: 'pointer' }}>
              <path d={`M${m.x} ${SURF} L${m.x} ${m.y1}`} fill="none" stroke={MODE_TEXT[m.name] || 'var(--loam-ink)'} strokeOpacity={STRENGTH[m.tier]} strokeWidth={WEIGHT[m.tier]} strokeLinecap="round" />
              <circle cx={m.x} cy={SURF} r="5.2" fill={MODE_FILL[m.name] || 'var(--loam-ink)'} />
              <text className={styles.modeLab} x={modeLabX(m, W)} y={SURF - (i % 2 ? 27 : 11)} textAnchor="middle">{m.name}</text>
            </g>
          ))}

          {labels.map(({ n, kind, right, x, y, num, inline, leader }) => {
            const cls = `${styles.lab}${n.tier === 'significant' ? ` ${styles.labSig}` : ''}`
            const numFill = MODE_TEXT[n.mode] || 'var(--loam-ink)'
            if (kind === 'need') {
              const anchor = right ? 'start' : 'end'
              return (
                <g key={n.name + n.y1} onClick={() => setPicked(n.ref)} style={{ cursor: 'pointer' }}>
                  {leader && <path className={styles.leader} d={`M${n.x} ${n.y1} L${n.x} ${y - 3} L${right ? x - 2 : x + 2} ${y - 3}`} />}
                  {inline
                    ? <text className={cls} x={x} y={y} textAnchor={anchor}>{n.name} <tspan className={styles.labNum} style={{ fill: numFill }}>{num}</tspan></text>
                    : <text className={cls} x={x} y={y} textAnchor={anchor}>{n.name}</text>}
                  {num && !inline && <text className={styles.labNum} style={{ fill: numFill }} x={x} y={y + LH} textAnchor={anchor}>{num}</text>}
                </g>
              )
            }
            return (
              <g key={n.name + n.y1} onClick={() => setPicked(n.ref)} style={{ cursor: 'pointer' }}>
                {leader && <path className={styles.leader} d={`M${n.x} ${n.y1} L${n.x} ${y - 4}`} />}
                <text className={cls} transform={`translate(${(n.x + 4.5).toFixed(1)} ${y.toFixed(1)}) rotate(90)`}>
                  {n.name}{num && <tspan className={styles.labNum} style={{ fill: numFill }} dx="7">{num}</tspan>}
                </text>
              </g>
            )
          })}
        </svg>
        </div>
        <div className={styles.zoomRow}>
          <span className={styles.zoomHint}>{zoom > 1 ? `${zoom.toFixed(zoom % 1 ? 2 : 0)}× · drag to look around` : 'pinch or tap + to look closer'}</span>
          <span className={styles.zoomBtns}>
            <button type="button" className={styles.zoomBtn} onClick={() => zoomTo(zoom - 0.5)} disabled={zoom <= 1} aria-label="zoom out">−</button>
            <button type="button" className={styles.zoomBtn} onClick={() => zoomTo(zoom + 0.5)} disabled={zoom >= 3} aria-label="zoom in">+</button>
            {zoom > 1 && <button type="button" className={`${styles.zoomBtn} ${styles.zoomReset}`} onClick={() => zoomTo(1)}>reset</button>}
          </span>
        </div>

        {picked && (
          <p className={styles.pick}>
            <b>{picked.name}</b>
            {picked.tier === 'new'
              ? <> · too new — {picked.days} days on one side</>
              : <> · {picked.gap > 0 ? '+' : ''}{Math.round(picked.gap)} pts on {picked.days} days met vs {picked.off} not · luck would do that {oneIn(picked.p)}
                  {picked.wild ? ' · a wild root: cleared the flat bar without its parents' : picked.tier === 'significant' ? '' : ` · ${picked.tier === 'close' ? 'would count on its own' : picked.tier === 'testing' ? 'worth an experiment' : 'quiet so far'}`}</>}
            <button type="button" className={styles.pickClose} onClick={() => setPicked(null)} aria-label="close">×</button>
          </p>
        )}

        <div className={styles.levels}>
          <WordTabs label="how much to show" options={LEVELS} value={level} onChange={setLevel} />
        </div>
      </div>
    </section>
  )
}
