import { useMemo, useState } from 'react'
import { buildStreaks, STREAK_KINDS } from '../lib/streaks'
import { GlyphShape, GLYPH_BOX, GLYPH_RADIAL } from '../lib/glyphs'
import { BAND_LABEL } from '../lib/frequency'
import { needName } from '../lib/constants'
import { LabelRow, WordTabs } from './loam'
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
export function Glyph({ streak }) {
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
export function Meter({ streak }) {
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

function phrase(s) {
  if (s.quiet) return <>days without {s.name}</>
  const word = s.kind === 'frequency' ? BAND_LABEL[s.name] ?? s.name : s.kind === 'need' ? needName(s.name) : s.name
  return <>days of <em>{word}</em></>
}

const PREVIEW = 2

/* Two rows on the page; `all →` opens the rest in place, where each row also
   carries its glyph and twelve-day strip. */
export default function StreaksRail({ canvas, checkins, moods, practicesDB }) {
  const [kind, setKind] = useState('all')
  const [open, setOpen] = useState(false)

  const all = useMemo(
    () => buildStreaks({ canvas, checkins, moods, practicesDB }),
    [canvas, checkins, moods, practicesDB]
  )
  const rows = kind === 'all' ? all : all.filter(s => s.kind === kind)
  // only offer a filter that has something behind it
  const kinds = STREAK_KINDS.filter(k => k.v === 'all' || all.some(s => s.kind === k.v))
  if (!all.length) return null

  const running = all.filter(s => !s.quiet).length
  const lulled = all.length - running
  const shown = open ? rows : rows.slice(0, PREVIEW)
  const more = rows.length > PREVIEW

  return (
    <section className={styles.section}>
      <LabelRow
        left="STREAKS & LULLS"
        right={`${running} RUNNING · ${lulled} ${lulled === 1 ? 'LULL' : 'LULLS'}`}
      />
      {shown.map(s => (
        <div key={s.key + (s.quiet ? ':q' : '')} className={styles.row}>
          <span className={styles.num}>{s.days}</span>
          <span className={styles.body}>
            <span className={styles.phrase}>{phrase(s)}</span>
            {open && (
              <span className={styles.detail}>
                <Glyph streak={s} />
                <span className={styles.meter}><Meter streak={s} /></span>
              </span>
            )}
          </span>
          <span className={styles.state}>
            {s.quiet ? 'IN A LULL' : s.isRecord ? 'YOUR LONGEST YET' : 'STILL GOING'}
          </span>
        </div>
      ))}
      <div className={styles.foot}>
        {kinds.length > 2 && <WordTabs label="filter streaks" options={kinds} value={kind} onChange={setKind} />}
        <span className={styles.pos}>
          {shown.length} of {rows.length}
          {more && (
            <>
              {' · '}
              <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen(o => !o)}>
                {open ? 'fewer ↑' : 'all →'}
              </button>
            </>
          )}
        </span>
      </div>
    </section>
  )
}
