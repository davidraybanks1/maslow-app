import { Glyph, Meter } from './StreaksRail'
import styles from './ThreadTiles.module.css'

/* Your most active threads, one white row each, set like a card in "Your
   streaks and lulls": the mark, the thread's name, twelve days of writing in
   the thread's colour, and the count of drafts. Most active first. The mark
   says what kind of thread it is, so there is no label for it: a need's
   petals, a feeling's signal, a checkbox for a time of day or a tag. */

/* a thread drawn as the streak it most resembles: needs are petals, feelings
   the signal, dayparts and tags the checkbox; the colour is the mode, the
   mood band, or (for a tag) sage */
function asStreak(t) {
  const strip = t.strip || Array(12).fill(false)
  if (t.dim === 'need') return { kind: 'need', mode: t.modeName || 'exploration', strip }
  if (t.dim === 'feeling') return { kind: 'frequency', name: t.band || 'mid', strip }
  return { kind: 'practice', mode: t.band || 'mid', strip }
}

export default function ThreadTiles({ threads, openId, onPick }) {
  if (!threads.length) return null
  return (
    <div className={styles.wrap} role="group" aria-label="your most active threads">
      {threads.map(t => {
        const streak = asStreak(t)
        return (
          <button
            key={t.id}
            type="button"
            className={`${styles.row}${openId === t.id ? ` ${styles.open}` : ''}`}
            onClick={() => onPick(t.id)}
          >
            <span className={styles.main}>
              <span className={styles.top}>
                <span className={styles.mark}><Glyph streak={streak} /></span>
                <span className={styles.name}>{t.label}</span>
              </span>
              <span className={styles.meter}><Meter streak={streak} /></span>
            </span>
            <span className={styles.num}>{t.windowCount}<i>drafts</i></span>
          </button>
        )
      })}
    </div>
  )
}
