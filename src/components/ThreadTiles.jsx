import { useMemo } from 'react'
import styles from './ThreadTiles.module.css'

/* Your threads as a plot of beds: one rectangle, divided so that each thread
   gets an area in proportion to how much you have written on it lately. The
   division is squarified, so beds stay close to square and the biggest
   threads sit top-left. Each bed is lit from the same point as the bloom, in
   greens, oranges and yellows that sit beside the mode colours without
   borrowing them. A thread prefers a colour chosen from its name, so it keeps
   it between visits; when two threads want the same colour, the smaller one
   takes the next free shade. */

const RAMPS = [
  ['#FFB27A', '#C2561C'],   // apricot
  ['#A6D36F', '#3F6E1E'],   // grass
  ['#F0B23C', '#8A5A08'],   // amber
  ['#B8C05A', '#5C6414'],   // olive
  ['#FF9A48', '#B44A06'],   // tangerine
  ['#8FAE6A', '#3B5522'],   // moss
  ['#D9BD2E', '#7A6606'],   // mustard
  ['#D6DB70', '#6E7A14'],   // chartreuse
  ['#E3895A', '#8C3418'],   // terracotta
  ['#F7E38F', '#A88A1C'],   // butter
]
// the lightest ramps read better with ink type
const DARK_TYPE = new Set([7, 9])

function hash(str) { let h = 5381; for (const ch of str) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return Math.abs(h) }

/* colours by rank: each thread asks for the shade its name hashes to and
   takes the next free one if a bigger thread already has it */
function assignRamps(threads) {
  const used = new Set(), out = {}
  for (const t of threads) {
    let i = hash(t.id) % RAMPS.length
    for (let k = 0; k < RAMPS.length && used.has(i); k++) i = (i + 1) % RAMPS.length
    used.add(i); out[t.id] = i
  }
  return out
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
  const W = 349
  const geo = useMemo(() => {
    if (!threads.length) return null
    const n = threads.length
    const H = n <= 2 ? 110 : n <= 4 ? 160 : n <= 7 ? 210 : 240
    const G = 3
    const ramps = assignRamps(threads)
    const tiles = squarify(threads.map(t => ({ ...t, v: t.windowCount })), 0, 0, W, H)
    const small = []
    const drawn = tiles.map(t => {
      const w = t.w - G, h = t.h - G
      const words = t.label.split(' ')
      const longest = Math.max(...words.map(s => s.length))
      const full = t.label.length * CH
      let mode
      if (full < w - 16 && h >= 40) mode = 'flat'
      else if (words.length > 1 && longest * CH < w - 16 && h >= 56) mode = 'wrap'
      else if (full < h - 32 && w >= 30) mode = 'tall'
      else mode = 'count'
      if (mode === 'count') small.push(t)
      return { ...t, w, h, mode, words, ramp: ramps[t.id], dark: DARK_TYPE.has(ramps[t.id]) }
    })
    return { H, G, drawn, small }
  }, [threads])
  if (!geo) return null

  const { H, G, drawn, small } = geo
  return (
    <div className={styles.wrap}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="your most active threads">
        <defs>
          {drawn.map(t => {
            const [a, b] = RAMPS[t.ramp]
            return (
              <radialGradient key={t.id} id={`tt-${t.id.replace(/\W/g, '')}`} cx="34%" cy="26%" r="78%">
                <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
              </radialGradient>
            )
          })}
        </defs>
        {drawn.map(t => {
          const open = openId === t.id
          const x = t.x + G / 2, y = t.y + G / 2
          const lab = `${styles.lab}${t.dark ? ` ${styles.labDark}` : ''}`
          const num = `${styles.num}${t.dark ? ` ${styles.numDark}` : ''}`
          return (
            <g key={t.id} className={styles.bed} onClick={() => onPick(t.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={t.w} height={t.h} rx={Math.min(10, t.w / 3, t.h / 3)} fill={`url(#tt-${t.id.replace(/\W/g, '')})`} />
              {open && <rect x={x + 3} y={y + 3} width={t.w - 6} height={t.h - 6} rx={Math.max(2, Math.min(7, t.w / 4, t.h / 4))} className={styles.ring} />}
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
      {small.length > 0 && (
        <p className={styles.small}>
          {'smaller: '}
          {small.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ' · '}
              <button type="button" className={styles.smallBtn} onClick={() => onPick(t.id)}>
                <b style={{ color: RAMPS[geo.drawn.find(d => d.id === t.id).ramp][1] }}>{t.windowCount}</b> {t.label}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
