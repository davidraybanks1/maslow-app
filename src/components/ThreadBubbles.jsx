import { useMemo } from 'react'
import styles from './ThreadBubbles.module.css'

/* Your threads, as a handful of lit spheres: the more you have written on
   a thread lately, the bigger its bubble. Each is lit from the same point as
   the bloom. Needs take their mode's ramp, feelings their band's, dayparts
   the unlit sphere, and your own tags a warm paper ramp. */

const RAMP = {
  exploration: ['#2E8A64', '#0C5038'],
  appreciation: ['#B4C4AC', '#536E4D'],
  nourishment: ['#FFD166', '#F0A800'],
  survival: ['#FF7A55', '#F03C10'],
  good: ['#3FA87A', '#07301F'],
  mid: ['#B4C4AC', '#3E5238'],
  bad: ['#FF8A66', '#A81F06'],
  ink: ['#4A453E', '#0A0807'],
  paper: ['#E6DCC4', '#9C8C6B'],
}
// which ramps carry ink comfortably, and which want light type
const DARK_TYPE = new Set(['nourishment', 'appreciation', 'mid', 'paper'])

export function rampFor(thread) {
  if (thread.dim === 'need') return thread.modeName || 'exploration'
  if (thread.dim === 'feeling') return thread.band || 'mid'
  if (thread.dim === 'slot') return thread.band || 'ink'
  return 'paper'
}

/* greedy packing: the biggest bubble sits in the middle, each next one
   settles into the tightest spot that touches what is already there */
function pack(items, W) {
  const placed = []
  const hits = (x, y, r) => placed.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r - 0.5)
  for (const it of items) {
    const r = it.r
    if (!placed.length) { placed.push({ ...it, x: 0, y: 0 }); continue }
    const cands = []
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * Math.PI * 2
        cands.push([a.x + Math.cos(t) * (a.r + r + 1), a.y + Math.sin(t) * (a.r + r + 1)])
      }
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j]
        const d = Math.hypot(b.x - a.x, b.y - a.y)
        const ra = a.r + r + 1, rb = b.r + r + 1
        if (d > ra + rb || d < Math.abs(ra - rb) || d === 0) continue
        const m = (ra * ra - rb * rb + d * d) / (2 * d)
        const h = Math.sqrt(Math.max(0, ra * ra - m * m))
        const px = a.x + (m * (b.x - a.x)) / d, py = a.y + (m * (b.y - a.y)) / d
        cands.push([px + (h * (b.y - a.y)) / d, py - (h * (b.x - a.x)) / d])
        cands.push([px - (h * (b.y - a.y)) / d, py + (h * (b.x - a.x)) / d])
      }
    }
    let best = null
    for (const [x, y] of cands) {
      if (hits(x, y, r)) continue
      // prefer wide over tall: the section is a landscape
      const cost = Math.hypot(x / (W / 2), y / 110)
      if (!best || cost < best.cost) best = { x, y, cost }
    }
    placed.push({ ...it, x: best ? best.x : 0, y: best ? best.y : placed.length * r })
  }
  return placed
}

export default function ThreadBubbles({ threads, openId, onPick }) {
  const W = 349
  const geo = useMemo(() => {
    if (!threads.length) return null
    const max = Math.max(...threads.map(t => t.windowCount))
    const items = threads.map(t => ({ ...t, r: 22 + Math.sqrt(t.windowCount / max) * 48 }))
    const placed = pack(items, W)
    const minX = Math.min(...placed.map(p => p.x - p.r)), maxX = Math.max(...placed.map(p => p.x + p.r))
    const minY = Math.min(...placed.map(p => p.y - p.r)), maxY = Math.max(...placed.map(p => p.y + p.r))
    const pad = 6
    return { placed, vb: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`, h: (maxY - minY + pad * 2) / (maxX - minX + pad * 2) * W }
  }, [threads])
  if (!geo) return null

  return (
    <svg className={styles.svg} viewBox={geo.vb} style={{ height: geo.h }} role="img" aria-label="your most active threads">
      <defs>
        {geo.placed.map(p => {
          const [a, b] = RAMP[rampFor(p)]
          return (
            <radialGradient key={p.id} id={`tb-${p.id.replace(/\W/g, '')}`} cx="34%" cy="26%" r="78%">
              <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
            </radialGradient>
          )
        })}
      </defs>
      {geo.placed.map(p => {
        const ramp = rampFor(p)
        const dark = DARK_TYPE.has(ramp)
        const inside = p.r >= 30
        const open = openId === p.id
        const words = p.label.split(' ')
        // two lines at most inside a bubble; a long single word just runs
        const lines = inside && words.length > 1 && p.label.length > Math.floor(p.r / 4)
          ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
          : [p.label]
        return (
          <g key={p.id} className={styles.bubble} onClick={() => onPick(p.id)} style={{ cursor: 'pointer' }}>
            {open && <circle cx={p.x} cy={p.y} r={p.r + 4} className={styles.ring} />}
            <circle cx={p.x} cy={p.y} r={p.r} fill={`url(#tb-${p.id.replace(/\W/g, '')})`} />
            {inside ? (
              <>
                {lines.map((ln, i) => (
                  <text key={i} x={p.x} y={p.y - (lines.length - 1) * 7 + i * 14 - 1} textAnchor="middle"
                    className={`${styles.lab}${dark ? ` ${styles.labDark}` : ''}`}>{ln}</text>
                ))}
                <text x={p.x} y={p.y + (lines.length - 1) * 7 + 15} textAnchor="middle"
                  className={`${styles.num}${dark ? ` ${styles.numDark}` : ''}`}>{p.windowCount}</text>
              </>
            ) : (
              <>
                <text x={p.x} y={p.y + 4} textAnchor="middle" className={`${styles.num}${dark ? ` ${styles.numDark}` : ''}`}>{p.windowCount}</text>
                <text x={p.x} y={p.y + p.r + 13} textAnchor="middle" className={styles.labOut}>{p.label}</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
