import { useEffect, useMemo, useState } from 'react'
import { FEELINGS, THREADS, BANDS, THREAD_COPY, threadOf, splitFrequencyWords } from '../lib/frequency'
import { loadAllJournalMeta } from '../lib/store'
import { useChartCapture } from '../lib/useChartCapture'
import FinePrint from './FinePrint'
import { LabelRow, ProgressRule, SectionTitle } from './loam'
import styles from './ThreadsSection.module.css'

/* The twelve words are four threads at three depths — frequency.js has always
   known this. Reading the threads instead of the words gives four buckets
   instead of twelve, which is the difference between a list that fills this
   year and one that does not. Each row is one thread: the feeling you lead
   with, and a gold rule for how often it came up. Tap a row for all three. */

const BAND_COLOR = { good: 'var(--loam-mood-good)', mid: 'var(--loam-mood-fine)', bad: 'var(--loam-mood-bad)' }

function shapeOf(counts) {
  const [g, m, b] = counts
  const total = g + m + b
  if (total < 5) return 'barely logged'
  if (m === 0 && g > 0 && b > 0) return 'it splits'
  if (g > m + b) return 'runs warm'
  if (b > g + m) return 'runs hot'
  return 'sits in the middle'
}

// area-scaled so the biggest of a thread's three rung dots reads as clearly
// bigger, not just barely — sqrt because it's a circle's AREA that should
// track the count, not its diameter. Zero readings keep the smallest size;
// rungOff's hollow-ring treatment already marks those as quiet.
const RUNG_DOT_MIN = 8, RUNG_DOT_MAX = 18
function rungDotSize(n, maxN) {
  if (!n || !maxN) return RUNG_DOT_MIN
  return Math.round(RUNG_DOT_MIN + (RUNG_DOT_MAX - RUNG_DOT_MIN) * Math.sqrt(n / maxN))
}

export default function ThreadsSection({ userId, moods, ghost }) {
  const [journal, setJournal] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let alive = true
    // no user, no journal — still render from the mood rows rather than vanishing
    if (!userId) { setJournal([]); return }
    loadAllJournalMeta(userId)
      .then(rows => { if (alive) setJournal(rows || []) })
      .catch(() => { if (alive) setJournal([]) })
    return () => { alive = false }
  }, [userId])

  const { grid, total } = useMemo(() => {
    const tally = {}
    const add = feeling => {
      const t = threadOf(feeling)
      if (!t) return
      const band = BANDS.find(b => FEELINGS[b].includes(feeling))
      ;(tally[t] ||= { good: 0, mid: 0, bad: 0 })[band]++
    }
    for (const m of moods || []) if (m?.feeling) add(m.feeling)
    for (const j of journal || []) if (j?.mood_feeling) add(j.mood_feeling)

    const grid = THREADS.map((t, i) => {
      const counts = BANDS.map(b => tally[t]?.[b] ?? 0)
      const rungs = BANDS.map((b, k) => ({ band: b, word: FEELINGS[b][i], n: counts[k] }))
      const lead = rungs.reduce((a, b) => (b.n > a.n ? b : a))
      const total = counts.reduce((s, n) => s + n, 0)
      return { key: t, rungs, total, shape: shapeOf(counts), topWord: lead.word, leadN: lead.n }
    })
    return { grid, total: grid.reduce((s, g) => s + g.total, 0) }
  }, [moods, journal])

  const chartRef = useChartCapture('data-vibrations', "how you've felt", !ghost)

  if (journal === null) return null
  if (total < 3) return null

  return (
    <section ref={chartRef} className={styles.section} data-dock="DATA · ALL HISTORY">
      <SectionTitle
        lead="how you've"
        turn="felt."
        sub="your check-ins, read four ways. the gold is how often the leading feeling came up."
      />
      <div className={styles.head}><LabelRow left="DIMENSION" right="LEADING · COUNT" /></div>

      {grid.map(g => {
        const on = selected === g.key
        const maxRungN = Math.max(...g.rungs.map(r => r.n))
        return (
          <div key={g.key} className={`${styles.row}${on ? ` ${styles.rowOn}` : ''}`}>
            <button type="button" className={styles.rowHead} onClick={() => setSelected(g.key)} aria-expanded={on}>
              <span className={styles.nameLine}>
                <span className={styles.name}>{g.key}</span>
                <span className={styles.word}>{g.total ? g.topWord : '—'}</span>
                <span className={styles.count}>{g.total ? `${g.leadN}/${g.total}` : 0}</span>
              </span>
              <ProgressRule
                bare tour={null} muted={!g.total}
                pct={g.total ? (g.leadN / g.total) * 100 : 0}
                label={g.total ? `${g.topWord}: ${g.leadN} of ${g.total}` : `${g.key}: nothing logged`}
              />
              <span className={styles.shape}>{g.shape}</span>
            </button>
            <div className={styles.rungsPanel}>
              <div className={styles.rungsPanelInner}>
                <div className={styles.rungs}>
                  {g.rungs.map(r => {
                    const size = rungDotSize(r.n, maxRungN)
                    return (
                      <div key={r.word} className={`${styles.rung}${r.n ? '' : ` ${styles.rungOff}`}`}>
                        <span className={styles.rungDotBox}>
                          <span
                            className={styles.rungDot}
                            style={{ width: size, height: size, ...(r.n ? { background: BAND_COLOR[r.band] } : null) }}
                          />
                        </span>
                        <span className={styles.rungWord}>{r.word}</span>
                        <span className={styles.rungCount}>{r.n || '—'}</span>
                      </div>
                    )
                  })}
                </div>
                {/* what this thread means, and what to do about its bad-band word */}
                <div className={styles.threadCopy}>
                  <p>{splitFrequencyWords(THREAD_COPY[g.key].definition).map((seg, i) =>
                    seg.bold ? <b key={i}>{seg.text}</b> : seg.text
                  )}</p>
                  <p>{splitFrequencyWords(THREAD_COPY[g.key].guidance).map((seg, i) =>
                    seg.bold ? <b key={i}>{seg.text}</b> : seg.text
                  )}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <FinePrint>
        <p>The twelve feeling words you pick from are really four dimensions, each at three depths. <b>Capacity</b> runs calm, steady, overwhelmed. <b>Engagement</b> runs curious, flat, apathetic. <b>Drive</b> runs creative, restless, frenetic. <b>Posture</b> runs confident, braced, small.</p>
        <p>The word beside each dimension is whichever of its three feelings you have picked most. The gold rule is how often that one came up, out of every check-in in that dimension. Tap a row to see all three.</p>
      </FinePrint>
    </section>
  )
}
