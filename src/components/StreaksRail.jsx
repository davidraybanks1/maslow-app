import { useMemo, useRef, useState } from 'react'
import { buildStreaks, STREAK_KINDS } from '../lib/streaks'
import { GlyphShape, GLYPH_BOX, GLYPH_RADIAL } from '../lib/glyphs'
import styles from './StreaksRail.module.css'

/* Four kinds of run, four silhouettes — so you can tell what you are looking
   at before you read it. A mode is its arc of the completion ring, a need is a
   cluster of petals, a practice is the checkbox, and frequency is a signal.
   Quiet runs use the unlit sphere: same object, no light on it. */

const RAMP = {
  exploration: ['#2E8A64', '#0C5038'],
  appreciation: ['#B4C4AC', '#536E4D'],
  nourishment: ['#FFD166', '#F0A800'],
  survival: ['#FF7A55', '#F03C10'],
  good: ['#3FA87A', '#07301F'],
  mid: ['#C7D4C1', '#6E8566'],
  bad: ['#FF8A66', '#A81F06'],
}
const UNLIT = ['#4A453E', '#0A0807']
const rampFor = s => RAMP[s.kind === 'frequency' ? s.name : s.mode] || RAMP.exploration

let uid = 0
function Glyph({ streak }) {
  const id = useMemo(() => `sg${++uid}`, [])
  const [a, b] = streak.quiet ? UNLIT : rampFor(streak)
  const [w, h] = GLYPH_BOX[streak.kind] || GLYPH_BOX.mode
  const defs = GLYPH_RADIAL[streak.kind]
    ? <radialGradient id={id} cx="34%" cy="26%" r="78%">
        <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
      </radialGradient>
    : <linearGradient id={id} x1="10%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
      </linearGradient>

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>{defs}</defs>
      <GlyphShape kind={streak.kind} paint={`url(#${id})`} />
    </svg>
  )
}

/** Twelve days, drawn in the shape of the thing it belongs to. */
function Meter({ streak }) {
  const [a, b] = streak.quiet ? UNLIT : rampFor(streak)
  const on = streak.kind === 'need' || streak.kind === 'mode'
    ? `radial-gradient(circle at 34% 26%, ${a}, ${b})`
    : `linear-gradient(160deg, ${a}, ${b})`
  const cls = streak.kind === 'need' || streak.kind === 'mode' ? styles.mDots : styles.mCells
  return (
    <span className={cls}>
      {streak.strip.map((hit, i) => (
        <i key={i} style={{ background: hit ? on : 'rgba(0,0,0,.10)' }} />
      ))}
    </span>
  )
}

export default function StreaksRail({ canvas, checkins, moods, practicesDB }) {
  const [kind, setKind] = useState('all')
  const [pos, setPos] = useState(1)
  const railRef = useRef(null)

  const all = useMemo(
    () => buildStreaks({ canvas, checkins, moods, practicesDB }),
    [canvas, checkins, moods, practicesDB]
  )
  const rows = kind === 'all' ? all : all.filter(s => s.kind === kind)
  if (!all.length) return null

  const running = all.filter(s => !s.quiet).length

  return (
    <section className={`${styles.section} ${styles.first}`}>
      <div className={styles.pad}>
        <h2 className={styles.title}>Streaks</h2>
        <p className={styles.sub}>
          {all.length} streak{all.length === 1 ? '' : 's'} · {running} running,{' '}
          {all.length - running} quiet
        </p>
      </div>

      <div
        className={styles.rail} ref={railRef}
        onScroll={() => {
          const r = railRef.current
          if (r) setPos(Math.min(Math.max(Math.round(r.scrollLeft / 192) + 1, 1), rows.length))
        }}
      >
        {rows.map(s => (
          <div key={s.key + (s.quiet ? ':q' : '')} className={`${styles.card}${s.quiet ? ` ${styles.quiet}` : ''}`}>
            <div className={styles.head}>
              <Glyph streak={s} />
              <span className={styles.kind}>{s.kind === 'frequency' ? 'frequency' : s.kind}</span>
            </div>
            <span className={styles.num}>{s.days}<i>days</i></span>
            <span className={styles.name}>
              {s.kind === 'frequency' ? (s.name === 'mid' ? 'fine' : s.name) : s.name}
            </span>
            <span className={styles.spacer} />
            <span className={styles.meter}><Meter streak={s} /></span>
            <span className={`${styles.foot}${s.isRecord && !s.quiet ? ` ${styles.rec}` : ''}`}>
              {s.quiet ? 'days quiet' : s.isRecord ? 'your longest yet' : 'still going'}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.pad}>
        <div className={styles.railFoot}>
          <span className={styles.railPos}>{Math.min(pos, rows.length)}/{rows.length}</span>
          <div className={styles.kinds}>
            {STREAK_KINDS.map(k => (
              <button
                key={k.v} type="button" aria-pressed={kind === k.v}
                className={`${styles.kindPill}${kind === k.v ? ` ${styles.kindOn}` : ''}`}
                onClick={() => {
                  setKind(k.v); setPos(1)
                  if (railRef.current) railRef.current.scrollTo({ left: 0 })
                }}
              >{k.label}</button>
            ))}
          </div>
          <span className={styles.railAll} />
        </div>
      </div>
    </section>
  )
}
