import { useMemo } from 'react'
import styles from './ThreadBubbles.module.css'

/* Your threads, as a handful of lit spheres: the more you have written on
   a thread lately, the bigger its bubble. Each is lit from the same point as
   the bloom, in a palette of its own - vivid, and deliberately clear of the
   four mode colours, so a thread never looks like a mode. A thread keeps its
   colour between visits: it is chosen from its name, not its rank. */

const RAMPS = [
  ['#B9A6E8', '#4A2C8C'],   // violet
  ['#8FB4FF', '#1E3F9E'],   // cobalt
  ['#7FD3D9', '#0F5F6B'],   // teal
  ['#E39AC9', '#7A1F5C'],   // plum
  ['#FFB3C0', '#B8324F'],   // rose
  ['#A9B8D6', '#3A4A6E'],   // slate
  ['#E8B48A', '#8A4A1C'],   // copper
  ['#D6C2F5', '#6E4FB3'],   // lilac
  ['#8CD4B0', '#1F6B4F'],   // mint
  ['#F0A6A6', '#9C2F2F'],   // brick
]
// the two lightest ramps read better with ink type
const DARK_TYPE = new Set([7])

function hash(str) { let h = 5381; for (const ch of str) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return Math.abs(h) }
export function rampIndex(thread) { return hash(thread.id) % RAMPS.length }

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
    // a bubble is sized by its count, but never smaller than its own name needs
    const items = threads.map(t => {
      const words = t.label.split(' ')
      const longest = words.length > 1 ? Math.max(...words.map(w => w.length)) : t.label.length
      return { ...t, r: Math.max(18 + Math.sqrt(t.windowCount / max) * 46, (longest * 7.3) / 1.7 + 3) }
    })
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
          const [a, b] = RAMPS[rampIndex(p)]
          return (
            <radialGradient key={p.id} id={`tb-${p.id.replace(/\W/g, '')}`} cx="34%" cy="26%" r="78%">
              <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
            </radialGradient>
          )
        })}
      </defs>
      {geo.placed.map(p => {
        const dark = DARK_TYPE.has(rampIndex(p))
        const open = openId === p.id
        const words = p.label.split(' ')
        // two lines at most inside a bubble; the name goes beneath if it will not fit
        const lines = words.length > 1 && p.label.length * 7.3 > p.r * 1.7
          ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
          : [p.label]
        const inside = Math.max(...lines.map(l => l.length)) * 7.3 <= p.r * 1.75
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
