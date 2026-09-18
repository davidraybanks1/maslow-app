import { useMemo } from 'react'
import styles from './ThreadTiles.module.css'

/* Your threads as a plot of tiles: one rectangle, edge to edge, divided so
   that each thread gets an area in proportion to how much you have written on
   it lately. The division is squarified, so tiles stay close to square and
   the biggest threads sit top-left. Every tile carries its own name: if the
   smallest cannot, the big ones give up a little area first (the scale is
   compressed) and, when that is not enough, the smallest threads step off
   the plot into a line beneath it. The colour is nourishment's yellow, deep
   at the biggest thread and pale at the smallest, each tile lit from the
   same point as the bloom. */

const RAMP = ['#F0A800', '#F6B10E', '#FBBA22', '#FFC338', '#FFCB4E', '#FFD166', '#FFD77A', '#FFDD8E', '#FFE4A0', '#FFEAB0']

function mix(hex, to, t) {
  const c = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const a = c(hex), b = c(to)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
// the lit look: a warm highlight toward the bloom's light, the shade itself at the edge
const HI = shade => mix(shade, '#FFF8DC', 0.55)

/* shades by rank, spread across the whole ramp however many tiles there
   are, so a short list still runs deep to pale */
function assignShades(n, steps) {
  if (n === 1) return [0]
  return Array.from({ length: n }, (_, k) => Math.round((k / (n - 1)) * (steps - 1)))
}

/* squarified treemap (Bruls, Huizing, van Wijk): lay rows of beds along the
   shorter side, adding to a row while it keeps the beds nearest to square */
function squarify(items, x, y, w, h) {
  const out = []
  const total = items.reduce((s, it) => s + it.v, 0)
  const scale = (w * h) / total
  let rest = items.map(it => ({ ...it, a: it.v * scale }))
  let row = []
  const worst = (r, side) => {
    const s = r.reduce((q, it) => q + it.a, 0)
    return Math.max(...r.map(it => Math.max((side * side * it.a) / (s * s), (s * s) / (side * side * it.a))))
  }
  const flush = () => {
    const s = row.reduce((q, it) => q + it.a, 0)
    if (w >= h) {
      const rw = s / h
      let yy = y
      for (const it of row) { const ih = it.a / rw; out.push({ ...it, x, y: yy, w: rw, h: ih }); yy += ih }
      x += rw; w -= rw
    } else {
      const rh = s / w
      let xx = x
      for (const it of row) { const iw = it.a / rh; out.push({ ...it, x: xx, y, w: iw, h: rh }); xx += iw }
      y += rh; h -= rh
    }
    row = []
  }
  while (rest.length) {
    const side = Math.min(w, h)
    const cand = [...row, rest[0]]
    if (!row.length || worst(cand, side) <= worst(row, side)) { row = cand; rest = rest.slice(1) }
    else flush()
  }
  if (row.length) flush()
  return out
}

const CH = 7.3   // mono glyph width at the type floor

const PAD = 8    // inset of the name from the tile's edge

/* how a name sits in a tile of this size, or null if it cannot */
function fitLabel(label, w, h) {
  const words = label.split(' ')
  if (label.length * CH <= w - PAD * 2 && h >= 40) return { mode: 'flat', lines: [label] }
  if (words.length > 1 && h >= 54) {
    const cut = Math.ceil(words.length / 2)
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')]
    if (Math.max(...lines.map(l => l.length)) * CH <= w - PAD * 2) return { mode: 'wrap', lines }
  }
  return null
}

export default function ThreadTiles({ threads, openId, onPick }) {
  const W = 393
  const geo = useMemo(() => {
    if (!threads.length) return null
    const G = 2
    // every name must fit. Prefer showing every thread: first compress the
    // scale so the big tiles yield some area, then let the plot grow a
    // little taller, and only then drop the smallest threads
    const POWERS = [1, 0.85, 0.7, 0.55]
    const baseH = n => (n <= 2 ? 110 : n <= 4 ? 160 : n <= 7 ? 210 : 240)
    const layout = (list, p, H) => {
      const tiles = squarify(list.map(t => ({ ...t, v: Math.pow(t.windowCount, p) })), 0, 0, W, H)
      const shades = assignShades(list.length, RAMP.length)
      return tiles.map((t, k) => {
        // grout only between tiles: the plot's outer edges are the screen's
        const l = t.x > 0.5 ? G / 2 : 0, r = t.x + t.w < W - 0.5 ? G / 2 : 0
        const tp = t.y > 0.5 ? G / 2 : 0, bt = t.y + t.h < H - 0.5 ? G / 2 : 0
        const w = t.w - l - r, h = t.h - tp - bt
        return { ...t, x: t.x + l, y: t.y + tp, w, h, fit: fitLabel(t.label, w, h), shade: shades[k] }
      })
    }
    let drawn = null
    for (let n = threads.length; n >= 1 && !drawn; n--) {
      const list = threads.slice(0, n)
      for (const p of POWERS) {
        for (const H of [baseH(n), baseH(n) + 30, baseH(n) + 60]) {
          const tiles = layout(list, p, H)
          if (tiles.every(t => t.fit)) { drawn = { H, tiles }; break }
        }
        if (drawn) break
      }
      if (!drawn && n === 1) drawn = { H: baseH(1), tiles: layout(list, 1, baseH(1)) }   // one thread always shows
    }
    const shown = new Set(drawn.tiles.map(t => t.id))
    return { H: drawn.H, drawn: drawn.tiles, small: threads.filter(t => !shown.has(t.id)) }
  }, [threads])
  if (!geo) return null

  const { H, drawn, small } = geo
  return (
    <div className={styles.wrap}>
      <div className={styles.bleed}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="your most active threads">
        <defs>
          {RAMP.map((shade, k) => (
            <radialGradient key={k} id={`tt-s${k}`} cx="34%" cy="26%" r="78%">
              <stop offset="0%" stopColor={HI(shade)} /><stop offset="100%" stopColor={shade} />
            </radialGradient>
          ))}
        </defs>
        {drawn.map(t => {
          const open = openId === t.id
          const x = t.x, y = t.y
          return (
            <g key={t.id} className={styles.bed} onClick={() => onPick(t.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={t.w} height={t.h} fill={`url(#tt-s${t.shade})`} />
              {open && <rect x={x + 3} y={y + 3} width={t.w - 6} height={t.h - 6} className={styles.ring} />}
              {t.fit ? (
                <>
                  {t.fit.lines.map((ln, i) => <text key={i} x={x + PAD} y={y + 17 + i * 14} className={styles.lab}>{ln}</text>)}
                  <text x={x + PAD} y={y + t.h - 8} className={styles.num}>{t.windowCount}</text>
                </>
              ) : (
                <text x={x + PAD} y={y + t.h - 8} className={styles.num}>{t.windowCount}</text>
              )}
            </g>
          )
        })}
      </svg>
      </div>
      {small.length > 0 && (
        <p className={styles.small}>
          {'also: '}
          {small.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ' · '}
              <button type="button" className={styles.smallBtn} onClick={() => onPick(t.id)}>
                <b>{t.windowCount}</b> {t.label}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
