import { useMemo, useState } from 'react'
import { buildLadder, openSecondDoor, walkLadder, tierCounts, oneIn } from '../lib/ladder'
import { MODE_ORDER } from '../lib/constants'
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
  { v: 'significant', label: 'significant only', shows: ['significant'] },
  { v: 'close',       label: 'and close',        shows: ['significant', 'close'] },
  { v: 'testing',     label: 'and worth testing', shows: ['significant', 'close', 'testing'] },
]
const MODE_FILL = {
  exploration: 'var(--exploration)', appreciation: 'var(--appreciation-deep)',
  nourishment: 'var(--nourishment)', survival: 'var(--survival)',
}
/* the pyramid, bottom to top, left to right */
const DRAW_ORDER = [...MODE_ORDER].reverse()

const W = 349, SURF = 30
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

function path(e) {
  const p = e.from, c = e.to
  const sy = p.y1 - Math.min(10, (p.y1 - p.y0) * 0.35), sx = p.x
  const bend = wob(c.x + c.y1, 10)
  const my = sy + (c.y1 - sy) * 0.55
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + bend).toFixed(1)} ${(sy + (c.y1 - sy) * 0.35).toFixed(1)}, ${(c.x - bend).toFixed(1)} ${my.toFixed(1)}, ${c.x.toFixed(1)} ${c.y1.toFixed(1)}`
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
    sub: `the only root that goes all the way · ${prac.name} +${Math.round(prac.gap)}, luck would do that ${oneIn(prac.p)}`,
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

  const H = Math.max(...geo.nodes.map(n => n.y1)) + 112

  /* labels, with the collision rule */
  const placed = []
  const hits = bx => placed.some(p => bx.x0 < p.x1 && bx.x1 > p.x0 && bx.y0 < p.y1 && bx.y1 > p.y0)
  const labels = []
  geo.nodes
    .filter(n => n.depth > 0 && lit(n))
    .sort((a, b) => a.y1 - b.y1 || a.x - b.x)
    .forEach(n => {
      const sig = n.tier === 'significant'
      const num = sig && n.ref.gap != null ? `+${Math.round(n.ref.gap)} · ${oneIn(n.ref.p)}` : null
      if (n.depth === 1) {
        const right = sig ? true : n.x < W / 2
        const tw = Math.max(n.name.length * 5.2, num ? num.length * 4.9 : 0)
        const bx = { x0: right ? n.x + 7 : n.x - 7 - tw, y0: n.y1 - 4 }
        bx.x1 = bx.x0 + tw; bx.y1 = bx.y0 + 11 + (num ? 10 : 0)
        let y = n.y1 + 3
        while (hits(bx)) { bx.y0 += 11; bx.y1 += 11; y += 11 }
        placed.push(bx)
        labels.push({ n, kind: 'need', right, y, num, leader: y - (n.y1 + 3) > 4 })
      } else {
        const bx = { x0: n.x - 6, x1: n.x + 6, y0: n.y1, y1: n.y1 + 6 + n.name.length * 5.2 + (num ? 0 : 0) }
        let dy = 0
        while (hits(bx)) { bx.y0 += 11; bx.y1 += 11; dy += 11 }
        placed.push(bx)
        labels.push({ n, kind: 'practice', y: n.y1 + 6 + dy, num, leader: dy > 4 })
      }
    })

  return (
    <section className={styles.section}>
      <div className={styles.pad}>
        <h2 className={styles.title}>Roots</h2>
        <p className={styles.sub}>{days} days · {tree.length} modes · {counts.total - tree.length - geo.nodes.filter(n => n.depth === 2).length} needs · {geo.nodes.filter(n => n.depth === 2).length} practices</p>
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
              <text className={styles.modeLab} x={m.x} y={SURF - (i % 2 ? 19 : 9)} textAnchor="middle">{m.name}</text>
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
                  {num && <text className={styles.labNum} x={x} y={y + 10} textAnchor={anchor}>{num}</text>}
                </g>
              )
            }
            return (
              <g key={n.name + n.y1} onClick={() => setPicked(n.ref)} style={{ cursor: 'pointer' }}>
                {leader && <path className={styles.leader} d={`M${n.x} ${n.y1} L${n.x} ${y - 4}`} />}
                <text className={cls} transform={`translate(${(n.x + 3.5).toFixed(1)} ${y.toFixed(1)}) rotate(90)`}>{n.name}</text>
                {num && <text className={styles.labNum} transform={`translate(${(n.x - 6.5).toFixed(1)} ${y.toFixed(1)}) rotate(90)`}>{num}</text>}
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
        <p className={styles.note}>
          Depth is evidence. A root can only grow from where the one above it stopped — that is the gate, drawn.
          A practice under a need that failed can still break through on its own if it clears the flat bar,
          corrected against every practice at once; that is a <b>wild root</b>, and you have {wild.length === 0 ? 'none' : wild.length}.
        </p>
      </div>
    </section>
  )
}
