import { useMemo } from 'react'
import styles from './ThreadTiles.module.css'

/* Your threads as a plot of tiles: one rectangle, edge to edge, divided so
   that each thread gets an area in proportion to how much you have written on
   it lately. The division is squarified, so tiles stay close to square and
   the biggest threads sit top-left. The colours are flat, and all drawn from
   two of the app's own: the plot runs from nourishment's deep yellow at the
   biggest thread to appreciation's deep sage at the smallest, so the whole
   thing reads as one gradient laid over the grid. */

const RAMP = [
  '#F0A800', '#F7BE33', '#FFD166', '#FFE08A', '#EFE0A0',
  '#D5D8A6', '#B4C4AC', '#98AE90', '#7A9070', '#536E4D',
]
// the deep sages want white type
const LIGHT_TYPE = new Set([7, 8, 9])

/* shades by rank, spread across the whole ramp however many threads there
   are, so a short list still runs yellow to sage */
function assignShades(n) {
  if (n === 1) return [0]
  return Array.from({ length: n }, (_, k) => Math.round((k / (n - 1)) * (RAMP.length - 1)))
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

export default function ThreadTiles({ threads, openId, onPick }) {
  const W = 393
  const geo = useMemo(() => {
    if (!threads.length) return null
    const n = threads.length
    const H = n <= 2 ? 110 : n <= 4 ? 160 : n <= 7 ? 210 : 240
    const G = 4
    const shades = assignShades(threads.length)
    const tiles = squarify(threads.map(t => ({ ...t, v: t.windowCount })), 0, 0, W, H)
    const small = []
    const drawn = tiles.map((t, k) => {
      // grout only between tiles: the plot's outer edges are the screen's
      const l = t.x > 0.5 ? G / 2 : 0, r = t.x + t.w < W - 0.5 ? G / 2 : 0
      const tp = t.y > 0.5 ? G / 2 : 0, bt = t.y + t.h < H - 0.5 ? G / 2 : 0
      const w = t.w - l - r, h = t.h - tp - bt
      const words = t.label.split(' ')
      const longest = Math.max(...words.map(s => s.length))
      const full = t.label.length * CH
      let mode
      if (full < w - 16 && h >= 40) mode = 'flat'
      else if (words.length > 1 && longest * CH < w - 16 && h >= 56) mode = 'wrap'
      else if (full < h - 32 && w >= 30) mode = 'tall'
      else mode = 'count'
      if (mode === 'count') small.push(t)
      return { ...t, x: t.x + l, y: t.y + tp, w, h, mode, words, shade: shades[k], light: LIGHT_TYPE.has(shades[k]) }
    })
    return { H, drawn, small }
  }, [threads])
  if (!geo) return null

  const { H, drawn, small } = geo
  return (
    <div className={styles.wrap}>
      <div className={styles.bleed}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="your most active threads">
        {drawn.map(t => {
          const open = openId === t.id
          const x = t.x, y = t.y
          const lab = `${styles.lab}${t.light ? ` ${styles.labLight}` : ''}`
          const num = `${styles.num}${t.light ? ` ${styles.numLight}` : ''}`
          return (
            <g key={t.id} className={styles.bed} onClick={() => onPick(t.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={t.w} height={t.h} fill={RAMP[t.shade]} />
              {open && <rect x={x + 3} y={y + 3} width={t.w - 6} height={t.h - 6} className={`${styles.ring}${t.light ? ` ${styles.ringLight}` : ''}`} />}
              {t.mode === 'flat' && (
                <>
                  <text x={x + 9} y={y + 18} className={lab}>{t.label}</text>
                  <text x={x + 9} y={y + t.h - 8} className={num}>{t.windowCount}</text>
                </>
              )}
              {t.mode === 'wrap' && (
                <>
                  <text x={x + 9} y={y + 18} className={lab}>{t.words.slice(0, Math.ceil(t.words.length / 2)).join(' ')}</text>
                  <text x={x + 9} y={y + 32} className={lab}>{t.words.slice(Math.ceil(t.words.length / 2)).join(' ')}</text>
                  <text x={x + 9} y={y + t.h - 8} className={num}>{t.windowCount}</text>
                </>
              )}
              {t.mode === 'tall' && (
                <>
                  <text transform={`translate(${x + t.w / 2 + 4} ${y + t.h - 8}) rotate(-90)`} className={lab}>{t.label}</text>
                  <text x={x + t.w / 2} y={y + 17} textAnchor="middle" className={`${num} ${styles.numSmall}`}>{t.windowCount}</text>
                </>
              )}
              {t.mode === 'count' && t.w >= 20 && t.h >= 16 && (
                <text x={x + t.w / 2} y={y + t.h / 2 + 5} textAnchor="middle" className={`${num} ${styles.numSmall}`}>{t.windowCount}</text>
              )}
            </g>
          )
        })}
      </svg>
      </div>
      {small.length > 0 && (
        <p className={styles.small}>
          {'smaller: '}
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
