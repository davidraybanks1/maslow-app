import { Fragment, useEffect, useRef } from 'react'
import { Glyph, Meter } from './StreaksRail'
import styles from './ThreadTiles.module.css'

/* Your most active threads, as index rows: the name, what kind of thread it
   is, a dotted leader and the count of drafts. Most active first. When a row is
   open, its twelve-day strip and its drafts (renderOpen) sit directly beneath. */

const KIND = { slot: 'daypart', feeling: 'feeling', need: 'need', custom: 'tag' }

/* a thread drawn as the streak it most resembles: needs are petals, feelings
   the signal, dayparts and tags the checkbox; the colour is the mode, the
   mood band, or (for a tag) sage */
function asStreak(t) {
  const strip = t.strip || Array(12).fill(false)
  if (t.dim === 'need') return { kind: 'need', mode: t.modeName || 'exploration', strip }
  if (t.dim === 'feeling') return { kind: 'frequency', name: t.band || 'mid', strip }
  return { kind: 'practice', mode: t.band || 'mid', strip }
}

export default function ThreadTiles({ threads, openId, onPick, renderOpen }) {
  const rowRefs = useRef({})
  /* the opened thread's drafts sit directly under its own row; when a row
     below a previously opened thread is picked, the list above it collapses
     and the row can slide off-screen, so bring it back into view */
  useEffect(() => {
    if (!openId) return
    const el = rowRefs.current[openId]
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [openId])
  if (!threads.length) return null
  return (
    <div className={styles.wrap} role="group" aria-label="your most active threads">
      {threads.map(t => {
        const streak = asStreak(t)
        return (
          <Fragment key={t.id}>
          <button
            ref={el => { rowRefs.current[t.id] = el }}
            type="button"
            aria-expanded={openId === t.id}
            className={`${styles.row}${openId === t.id ? ` ${styles.open}` : ''}`}
            onClick={() => onPick(t.id)}
          >
            <span className={styles.name}>{t.label}</span>
            <span className={styles.kind}>{KIND[t.dim]}</span>
            <span className={styles.leader} aria-hidden="true" />
            <span className={styles.num}>{t.windowCount}</span>
          </button>
          {openId === t.id && renderOpen ? (
            <>
              <div className={styles.strip}>
                <Glyph streak={streak} />
                <span className={styles.meter}><Meter streak={streak} /></span>
              </div>
              {renderOpen(t)}
            </>
          ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
