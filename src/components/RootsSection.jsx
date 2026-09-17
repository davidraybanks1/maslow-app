import { useMemo, useState } from 'react'
import { buildLadder, openSecondDoor, walkLadder, tierCounts, oneIn } from '../lib/ladder'
import { MODE_ORDER } from '../lib/constants'
import FinePrint from './FinePrint'
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
const STROKE = {
  significant: 'url(#rootsSig)', close: 'rgba(12,80,56,.55)', testing: 'rgba(12,80,56,.32)',
  quiet: 'rgba(0,0,0,.13)', new: 'rgba(0,0,0,.18)',
}
const ORDER = ['significant', 'close', 'testing', 'quiet', 'new']
const LEVELS = [
  { v: 'significant', label: 'significant', shows: ['significant'] },
  { v: 'close',       label: '+ close',     shows: ['significant', 'close'] },
  { v: 'testing',     label: '+ testing',   shows: ['significant', 'close', 'testing'] },
]
const MODE_FILL = {
  exploration: 'var(--exploration)', appreciation: 'var(--appreciation-deep)',
  nourishment: 'var(--nourishment)', survival: 'var(--survival)',
}
/* the pyramid, bottom to top, left to right */
const DRAW_ORDER = [...MODE_ORDER].reverse()

const W = 349, SURF = 48
/* DM Mono at the 12px floor runs about 7.3px a character; every label box
   below is estimated from this, so the collision rule is honest at the size
   the labels actually render. */
const CW = 7.3
const litLeaf = t => ORDER.indexOf(t) <= 2
function leaves(n) { return n.children?.length ? n.children.reduce((s, c) => s + leaves(c), 0) : (litLeaf(n.tier) ? 3 : 1) }
const modeWeight = m => Math.max(leaves(m), 9)   // never narrower than its own name
/* deterministic wobble, so roots look grown rather than plotted, and stay put between renders */
function wob(seed, amt) { const x = Math.sin(seed * 12.9898) * 43758.5453; return ((x - Math.floor(x)) - 0.5) * amt }

function layout(tree) {
  const edges = [], nodes = []
  let seed = 0
  const place = (n, x0, x1, y0, depth, parent) => {
    seed++
    const cx = (x0 + x1) / 2 + wob(seed, Math.min(18, (x1 - x0) * 0.35))
    const y1 = y0 + DEPTH[n.tier]
    const node = { ref: n, x: cx, y0, y1, depth, parent, tier: n.tier, name: n.name, kind: n.kind }
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
/* a dozen points along each root, so a label can tell whether it would sit on one */
function samples(e) {
  const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = bez(e)
  const out = []
  for (let i = 1; i < 12; i++) {
    const t = i / 12, u = 1 - t
    out.push([u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * dx,
              u * u * u * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t * t * t * dy])
  }
  return out
}

/* mode names run along the surface, staggered low / high so neighbours never
   touch; a name near an edge is pulled in so it stays on the page */
const modeLabX = m => {
  const half = m.name.length * CW * 1.1 / 2 + 2
  return Math.max(-34 + half, Math.min(W + 34 - half, m.x)).toFixed(1)
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

/** The sentence at the top: the deepest thing that held, said plainly. */
function verdict(tree, wild) {
  if (wild.length) {
    const w = wild[0]
    return { head: <><em>{cap(w.name)}</em> is a wild root — it carries a need that hasn&rsquo;t held on its own.</>, sub: `luck would do that ${oneIn(w.p)} · cleared the flat bar without its parents` }
  }
  const sigModes = tree.filter(m => m.tier === 'significant')
  if (!sigModes.length) {
    let best = null
    walkLadder(tree, n => { if (n.p != null && (!best || n.p < best.p)) best = n })
    return { head: <>No root has reached bottom yet.</>, sub: best ? `${best.name} is closest, at ${best.gap > 0 ? '+' : ''}${Math.round(best.gap)} · luck would do that ${oneIn(best.p)}` : 'keep logging' }
  }
  const m = sigModes[0]
  const need = (m.children || []).find(n => n.tier === 'significant')
  if (!need) return { head: <><em>{cap(m.name)}</em> holds, but no single need carries it yet.</>, sub: `+${Math.round(m.gap)} · luck would do that ${oneIn(m.p)}` }
  const prac = (need.children || []).find(p => p.tier === 'significant')
  if (!prac) return { head: <><em>{cap(need.name)}</em> is the root. It comes down through {m.name}.</>, sub: `+${Math.round(need.gap)} · luck would do that ${oneIn(need.p)}` }
  return {
    head: <><em>{cap(need.name)}</em> is the root. It comes down through {m.name} and reaches bottom at <em>{prac.name}</em>.</>,
    sub: `${prac.name} +${Math.round(prac.gap)} · luck would do that ${oneIn(prac.p)}`,
  }
}

export default function RootsSection({ canvas, checkins, moods, practicesDB }) {
  const [level, setLevel] = useState('testing')
  const [picked, setPicked] = useState(null)

  const { tree, wild } = useMemo(() => {
    const t = buildLadder({ canvas, checkins, moods, practicesDB, modeOrder: DRAW_ORDER })
    const w = openSecondDoor(t, practicesDB)
    // buildLadder sorts by tier; the drawing wants the pyramid order
    t.sort((a, b) => DRAW_ORDER.indexOf(a.name) - DRAW_ORDER.indexOf(b.name))
    return { tree: t, wild: w }
  }, [canvas, checkins, moods, practicesDB])

  const geo = useMemo(() => layout(tree), [tree])
  if (!tree.length) return null

  const shows = LEVELS.find(l => l.v === level).shows
  const lit = n => shows.includes(n.tier)
  const counts = tierCounts(tree)
  const { head, sub } = verdict(tree, wild)
  const days = tree[0].days + tree[0].off


  /* labels, with the collision rule: a label may not sit on another label,
     and tries not to sit on any root. Each label has a few places it could
     go; the first clean one wins, else the one that touches the fewest roots,
     with a leader back to its tip when it has had to move. */
  const placed = []
  const onLabel = bx => placed.some(p => bx.x0 < p.x1 && bx.x1 > p.x0 && bx.y0 < p.y1 && bx.y1 > p.y0)
  const rootPts = geo.edges.map(e => ({ to: e.to, pts: samples(e) }))
    .concat(geo.modes.map(m => ({ to: m, pts: [0.2, 0.4, 0.6, 0.8].map(t => [m.x, SURF + (m.y1 - SURF) * t]) })))
  const onRoot = (bx, self) => rootPts.reduce((k, r) => r.to === self ? k :
    k + r.pts.filter(([x, y]) => x > bx.x0 - 2 && x < bx.x1 + 2 && y > bx.y0 && y < bx.y1).length, 0)
  const settle = (cands, self) => {
    let best = null
    for (const c of cands) {
      for (let step = 0; step < 6; step++) {
        const bx = { x0: c.x0, x1: c.x1, y0: c.y0 + step * LH, y1: c.y1 + step * LH }
        if (onLabel(bx)) continue
        const cost = onRoot(bx, self) + step * 0.5 + c.pref
        if (!best || cost < best.cost) best = { ...c, bx, dy: step * LH, cost }
        if (cost === c.pref) break
      }
      if (best && best.cost === 0) break
    }
    return best
  }
  const labels = []
  const LH = 14
  // significant labels claim their place first; everything else moves around them
  const rank = n => ORDER.indexOf(n.tier)
  const litKid = n => (n.ref.children || []).some(c => lit(c))
  geo.nodes
    .filter(n => n.depth > 0 && (lit(n) || (n.depth === 1 && litKid(n))))
    .sort((a, b) => rank(a) - rank(b) || a.y1 - b.y1 || a.x - b.x)
    .forEach(n => {
      const sig = n.tier === 'significant'
      const num = sig && n.ref.gap != null ? `+${Math.round(n.ref.gap)}` : null
      if (n.depth === 1) {
        // a need's name sits beside its tip - above it if it can, where only the
        // one root comes in, else below, where its children fan out
        const tw = Math.max(n.name.length, num ? num.length : 0) * CW
        const lines = num ? 2 : 1
        const outside = n.x >= n.parent.x
        const sides = [outside, !outside].filter(r => r ? n.x + 8 + tw <= W + 30 : n.x - 8 - tw >= -30)
        const cands = []
        for (const above of [true, false]) for (const right of sides) {
          const x0 = right ? n.x + 8 : n.x - 8 - tw
          const y0 = above ? n.y1 - 6 - lines * LH : n.y1 - 5
          cands.push({ x0, x1: x0 + tw, y0, y1: y0 + lines * LH + (above ? 4 : 0), right, above, pref: (above ? 0 : 0.25) + (right === outside ? 0 : 0.1) })
        }
        const b = settle(cands, n)
        if (!b) return
        placed.push(b.bx)
        const y = (b.above ? n.y1 - 6 - (lines - 1) * LH : n.y1 + 6) + b.dy
        labels.push({ n, kind: 'need', right: b.right, y, num, leader: b.dy > 0 })
      } else {
        // a practice runs down its root; with a number it takes a second column
        const th = Math.max(n.name.length, num ? num.length : 0) * CW
        const c = { x0: n.x - (num ? 14 : 4), x1: n.x + 12, y0: n.y1, y1: n.y1 + 8 + th, pref: 0 }
        const b = settle([c], n)
        if (!b) return
        placed.push(b.bx)
        labels.push({ n, kind: 'practice', y: n.y1 + 8 + b.dy, num, leader: b.dy > 0, bottom: b.bx.y1 })
      }
    })
  const H = Math.max(...geo.nodes.map(n => n.y1 + 20), ...labels.map(l => l.bottom || 0)) + 12

  return (
    <section className={styles.section}>
      <div className={styles.pad}>
        <h2 className={styles.title}>Your roots</h2>
        <p className={styles.sub}>{days} days · {counts.total - tree.length - geo.nodes.filter(n => n.depth === 2).length} needs · {geo.nodes.filter(n => n.depth === 2).length} practices</p>
        <p className={styles.head}>{head}</p>
        <p className={styles.headSub}>{sub}</p>

        <svg className={styles.roots} viewBox={`-34 0 ${W + 68} ${H}`} role="img" aria-label="root system of modes, needs and practices">
          <defs>
            <linearGradient id="rootsSig" gradientUnits="userSpaceOnUse" x1="0" y1={SURF} x2="0" y2={H}>
              <stop offset="0" stopColor="#3FA87A" /><stop offset="1" stopColor="#0C5038" />
            </linearGradient>
          </defs>
          <line x1="-34" y1={SURF} x2={W + 34} y2={SURF} className={styles.surface} />

          {[...ORDER].reverse().map(tier =>
            geo.edges.filter(e => e.tier === tier).map((e, i) => (
              <path key={`${tier}-${i}`} d={path(e)} fill="none" stroke={STROKE[tier]} strokeWidth={WEIGHT[tier]}
                strokeLinecap="round" strokeDasharray={tier === 'new' ? '1.5 2.5' : undefined}
                className={e.to.ref.wild ? styles.wild : undefined}
                onClick={() => setPicked(e.to.ref)} style={{ cursor: 'pointer' }} />
            ))
          )}

          {geo.modes.map((m, i) => (
            <g key={m.name} onClick={() => setPicked(m.ref)} style={{ cursor: 'pointer' }}>
              <path d={`M${m.x} ${SURF} L${m.x} ${m.y1}`} fill="none" stroke={STROKE[m.tier]} strokeWidth={WEIGHT[m.tier]} strokeLinecap="round" />
              <circle cx={m.x} cy={SURF} r="5.2" fill={MODE_FILL[m.name] || 'var(--ink)'} />
              <text className={styles.modeLab} x={modeLabX(m)} y={SURF - (i % 2 ? 27 : 11)} textAnchor="middle">{m.name}</text>
            </g>
          ))}

          {labels.map(({ n, kind, right, y, num, leader }) => {
            const sig = n.tier === 'significant'
            const cls = `${styles.lab}${sig ? ` ${styles.labSig}` : n.tier === 'testing' ? ` ${styles.labDim}` : ''}`
            if (kind === 'need') {
              const x = right ? n.x + 7 : n.x - 7, anchor = right ? 'start' : 'end'
              return (
                <g key={n.name + n.y1} onClick={() => setPicked(n.ref)} style={{ cursor: 'pointer' }}>
                  {leader && <path className={styles.leader} d={`M${n.x} ${n.y1} L${n.x} ${y - 3} L${right ? n.x + 5 : n.x - 5} ${y - 3}`} />}
                  <text className={cls} x={x} y={y} textAnchor={anchor}>{n.name}</text>
                  {num && <text className={styles.labNum} x={x} y={y + 14} textAnchor={anchor}>{num}</text>}
                </g>
              )
            }
            return (
              <g key={n.name + n.y1} onClick={() => setPicked(n.ref)} style={{ cursor: 'pointer' }}>
                {leader && <path className={styles.leader} d={`M${n.x} ${n.y1} L${n.x} ${y - 4}`} />}
                <text className={cls} transform={`translate(${(n.x + 4.5).toFixed(1)} ${y.toFixed(1)}) rotate(90)`}>{n.name}</text>
                {num && <text className={styles.labNum} transform={`translate(${(n.x - 9.5).toFixed(1)} ${y.toFixed(1)}) rotate(90)`}>{num}</text>}
              </g>
            )
          })}
        </svg>

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
          {LEVELS.map(l => (
            <button key={l.v} type="button" aria-pressed={level === l.v}
              className={`${styles.level}${level === l.v ? ` ${styles.levelOn}` : ''}`}
              onClick={() => setLevel(l.v)}>{l.label}</button>
          ))}
        </div>
        <div className={styles.key}>
          <span><i style={{ borderTopWidth: 3, borderTopColor: '#2E8A64' }} />significant</span>
          <span><i style={{ borderTopWidth: 2, borderTopColor: 'rgba(12,80,56,.55)' }} />close</span>
          <span><i style={{ borderTopWidth: 1.3, borderTopColor: 'rgba(12,80,56,.32)' }} />worth testing</span>
          <span><i style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,.2)' }} />quiet</span>
          <span><i style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,.28)', borderTopStyle: 'dotted' }} />too new</span>
        </div>
        <FinePrint>
          <p>Every mode, need and practice here is a root, and the deeper it goes the surer I am that it actually moves your mood. Depth is evidence, nothing else.</p>
          <p>A root can only grow from where the one above it stopped. So a practice can't get credit until its need and its mode have earned some first. That's deliberate: it stops one lucky week from looking like a discovery.</p>
          <p>The exception is a <b>wild root</b>: a practice so strong it clears a much higher bar all on its own, even though its need didn't. Those are drawn in green hanging off grey.{wild.length ? ` You have ${wild.length}.` : ' You have none yet.'} Tap anything to see its numbers.</p>
        </FinePrint>
      </div>
    </section>
  )
}
