import { useCallback, useEffect, useState } from 'react'
import { loadRevisitQueue, todayKey } from '../../lib/store'
import { daysAgoLabel, clip, latestMoodToday } from '../../lib/shapeFacts'
import styles from './Shapes.module.css'

const SNOOZE_KEY = 'loam_revisit_snooze'
const MIN_DAYS = 3        // a draft has to sit a few days first
const MAX_SHOWN = 3       // never a pile

function readSnooze() {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}') } catch { return {} }
}
function writeSnooze(map) {
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(map)) } catch { /* private mode */ }
}

/* Today's "come back to this" card: one draft you marked revisit, at least a
   few days old, with the question you left for yourself. Not shown on a day
   you checked in as "bad", and "not today" hides it until tomorrow. Chosen on
   the device from dates only; nothing about the draft's text is used. */
export default function RevisitCard({ state }) {
  const [queue, setQueue] = useState([])
  const [ix, setIx] = useState(0)
  const [snooze, setSnooze] = useState(readSnooze)
  const today = todayKey()

  const load = useCallback(() => {
    if (!state.userId) return
    loadRevisitQueue(state.userId).then(rows => setQueue(rows || []))
  }, [state.userId])

  useEffect(() => {
    load()
    window.addEventListener('maslow:revisit-changed', load)
    return () => window.removeEventListener('maslow:revisit-changed', load)
  }, [load])

  const mood = latestMoodToday(state, today)
  if (mood?.band === 'bad') return null

  const ready = queue
    .filter(r => r.revisit_marked_at && daysSince(r.revisit_marked_at, today) >= MIN_DAYS)
    .filter(r => snooze[r.id] !== today)
    .slice(0, MAX_SHOWN)
  if (!ready.length) return null

  const cur = ready[ix % ready.length]
  const markedKey = cur.revisit_marked_at.slice(0, 10)

  function notToday() {
    const next = { ...snooze, [cur.id]: today }
    setSnooze(next)
    writeSnooze(next)
    setIx(0)
  }

  function go() {
    window.dispatchEvent(new CustomEvent('maslow:open-shapes', { detail: { shape: 'continue', source: cur } }))
  }

  return (
    <div className={styles.rcCard}>
      <div className={styles.rcEyebrow}>
        <span>↩ one you wanted to come back to · {daysAgoLabel(markedKey, today)}</span>
        {ready.length > 1 && (
          <button className={styles.rcSkip} style={{ padding: 0 }} onClick={() => setIx(i => i + 1)} aria-label="next one">{(ix % ready.length) + 1} of {ready.length}</button>
        )}
      </div>
      {cur.revisit_question && (
        <>
          <p className={styles.rcAskLabel}>past you asked</p>
          <p className={styles.rcAsk}>{cur.revisit_question}</p>
        </>
      )}
      <p className={styles.rcQuote}>{clip(cur.entry, 200)}</p>
      <div className={styles.rcActions}>
        <button className={styles.rcGo} onClick={go}>continue</button>
        <button className={styles.rcSkip} onClick={notToday}>not today</button>
      </div>
    </div>
  )
}

function daysSince(iso, todayKeyStr) {
  const a = new Date(iso.slice(0, 10) + 'T12:00:00')
  const b = new Date(todayKeyStr + 'T12:00:00')
  return Math.round((b - a) / 86400000)
}
