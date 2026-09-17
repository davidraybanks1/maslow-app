import { useEffect, useMemo, useState } from 'react'
import { FEELINGS, THREADS, BANDS, threadOf } from '../lib/frequency'
import { loadAllJournalMeta } from '../lib/store'
import FinePrint from './FinePrint'
import styles from './ThreadsSection.module.css'

/* The twelve words are four threads at three depths — frequency.js has always
   known this and threadOf() has never been called. Reading the threads instead
   of the words gives four buckets instead of twelve, which is the difference
   between a grid that fills this year and one that does not. */

const RAMP = {
  good: ['#3FA87A', '#07301F'],
  mid: ['#B4C4AC', '#3E5238'],
  bad: ['#FF8A66', '#A81F06'],
}

function shapeOf(counts) {
  const [g, m, b] = counts
  const total = g + m + b
  if (total < 5) return 'barely logged'
  if (m === 0 && g > 0 && b > 0) return 'it splits'
  if (g > m + b) return 'runs warm'
  if (b > g + m) return 'runs hot'
  return 'sits in the middle'
}

export default function ThreadsSection({ userId, moods }) {
  const [journal, setJournal] = useState(null)

  useEffect(() => {
    let alive = true
    // no user, no journal — still render from the mood rows rather than vanishing
    if (!userId) { setJournal([]); return }
    loadAllJournalMeta(userId)
      .then(rows => { if (alive) setJournal(rows || []) })
      .catch(() => { if (alive) setJournal([]) })
    return () => { alive = false }
  }, [userId])

  const { grid, total, wordsUsed, since } = useMemo(() => {
    const tally = {}
    let first = null
    const add = (feeling, day) => {
      const t = threadOf(feeling)
      if (!t) return
      const band = BANDS.find(b => FEELINGS[b].includes(feeling))
      ;(tally[t] ||= { good: 0, mid: 0, bad: 0 })[band]++
      if (day && (!first || day < first)) first = day
    }
    for (const m of moods || []) if (m?.feeling) add(m.feeling, m.date_key)
    for (const j of journal || []) if (j?.mood_feeling) add(j.mood_feeling)

    const grid = THREADS.map((t, i) => {
      const counts = BANDS.map(b => tally[t]?.[b] ?? 0)
      return {
        key: t,
        rungs: BANDS.map((b, k) => ({ band: b, word: FEELINGS[b][i], n: counts[k] })),
        total: counts.reduce((s, n) => s + n, 0),
        shape: shapeOf(counts),
      }
    })
    const total = grid.reduce((s, g) => s + g.total, 0)
    const wordsUsed = grid.reduce((s, g) => s + g.rungs.filter(r => r.n > 0).length, 0)
    return { grid, total, wordsUsed, since: first }
  }, [moods, journal])

  if (journal === null) return null
  if (total < 3) return null

  const loudest = [...grid].sort((a, b) => b.total - a.total)[0]
  const split = grid.find(g => g.shape === 'it splits')

  return (
    <section className={styles.section}>
      <div className={styles.pad}>
        <h2 className={styles.title}>Your vibrations</h2>
        <p className={styles.sub}>
          {total} reading{total === 1 ? '' : 's'}
          {since ? ` since ${since}` : ''} · {wordsUsed} of 12 words used
        </p>
        {split ? (
          <p className={styles.claim}>
            <em>{split.key}</em> is the one that splits. {split.total} readings and not one landed
            on {split.rungs[1].word} — you are {split.rungs[0].word}, or you are {split.rungs[2].word}.
          </p>
        ) : (
          <p className={styles.claim}>
            <em>{loudest.key}</em> is the thread you name most — {loudest.total} of your{' '}
            {total} readings.
          </p>
        )}

        <div className={styles.grid}>
          {grid.map(g => (
            <div key={g.key} className={styles.cell}>
              <div className={styles.cellHead}>
                <span className={styles.cellName}>{g.key}</span>
                <span className={styles.cellN}>{g.total}</span>
              </div>
              <div className={styles.shape}>{g.shape}</div>
              <div className={styles.rungs}>
                {g.rungs.map(r => {
                  const size = r.n ? 11 + Math.sqrt(r.n) * 6.8 : 10
                  return (
                    <div key={r.word} className={`${styles.rung}${r.n ? '' : ` ${styles.rungOff}`}`}>
                      <span className={styles.orbWrap}>
                        {/* an unused word is drawn as an empty ring — the hole is the information */}
                        <i style={r.n ? {
                          width: size, height: size,
                          background: `radial-gradient(circle at 34% 26%,${RAMP[r.band][0]},${RAMP[r.band][1]})`,
                        } : { width: 10, height: 10, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.20)' }} />
                      </span>
                      <span className={styles.word}>{r.word}</span>
                      <span className={styles.count}>{r.n || '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.key}>
          {BANDS.map(b => (
            <span key={b}>
              <i style={{ background: `radial-gradient(circle at 34% 26%,${RAMP[b][0]},${RAMP[b][1]})` }} />
              {b === 'mid' ? 'fine' : b}
            </span>
          ))}
          <span className={styles.keyRight}>area = readings</span>
        </div>

        <FinePrint>
          <p>The twelve feeling words you pick from are really four threads, each at three depths. <b>Capacity</b> runs calm, steady, overwhelmed. <b>Engagement</b> runs curious, flat, apathetic. <b>Drive</b> runs creative, restless, frenetic. <b>Posture</b> runs confident, braced, small.</p>
          <p>Counting by thread instead of by word gives four buckets instead of twelve, so this grid fills in about three times faster. A bigger circle is a word you reach for more. An empty ring is a word you have never picked, which is its own kind of information.</p>
        </FinePrint>
      </div>
    </section>
  )
}
