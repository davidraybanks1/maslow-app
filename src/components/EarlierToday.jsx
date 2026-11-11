import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MODES, needName } from '../lib/constants'
import { BAND_LABEL, normalizeBand } from '../lib/frequency'
import { shapeLabel } from '../lib/shapeFacts'
import { loadJournalEntries } from '../lib/store'
import { formatClock } from '../lib/formatTime'
import { MOOD_PIP_COLOR } from './FrequencyCard'
import EntryText from './EntryText'
// the tags are the ones the Drafts page draws, not a copy of them
import draft from '../screens/DeskDrafts.module.css'
import styles from './EarlierToday.module.css'

/* Under the desktop writing page: what you have already written today, from any
   room and any device, newest first. Read-only; editing lives on Drafts.

   It loads today the way Today does (loadJournalEntries, todayKey's local day)
   and then listens for maslow:entry-added, which every save path fires (this
   page, the rooms, the global composer), so a new draft lands on top at once.
   Drafts written on another device arrive the next time the page opens. */

export default function EarlierToday({ state, today }) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!state.userId) return
    let live = true
    loadJournalEntries(state.userId, today).then(rows => { if (live) setEntries(rows) })
    return () => { live = false }
  }, [state.userId, today])

  useEffect(() => {
    function onAdded(e) {
      const row = e.detail?.entry
      if (!row || e.detail?.dateKey !== today) return
      setEntries(prev => (prev.some(x => x.id === row.id) ? prev : [...prev, row]))
    }
    window.addEventListener('maslow:entry-added', onAdded)
    return () => window.removeEventListener('maslow:entry-added', onAdded)
  }, [today])

  if (!entries.length) return null

  const rows = [...entries].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const needDot = id => (id && state.canvas?.[id] ? MODES[state.canvas[id]]?.pip : null) || 'var(--ink4)'

  return (
    <section className={styles.block} aria-label="earlier today" data-furniture>
      <div className={styles.head}>
        <h2 className={styles.label}>earlier today</h2>
        <Link to="/drafts" className={styles.link}>see drafts</Link>
      </div>
      <ol className={styles.list}>
        {rows.map(e => {
          const band = normalizeBand(e.mood_band)
          const hasTags = band || e.need_id || e.custom
          return (
            <li key={e.id} className={styles.row}>
              <p className={styles.meta}>
                <span>{formatClock(e.created_at)}</span>
                <span aria-hidden="true">·</span>
                <span>{shapeLabel(e.shape) || 'blank page'}</span>
              </p>
              <div className={styles.text}><EntryText text={e.entry} shape={e.shape} /></div>
              {hasTags && (
                <div className={`${draft.chips} ${styles.tags}`}>
                  {band && (
                    <span className={draft.chip}><i className={draft.pip} style={{ background: MOOD_PIP_COLOR[band] }} />{e.mood_feeling || BAND_LABEL[band]}</span>
                  )}
                  {e.need_id && <span className={draft.chip}><i className={draft.dot} style={{ background: needDot(e.need_id) }} />{needName(e.need_id)}</span>}
                  {e.custom && <span className={draft.chip}>{e.custom}</span>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
