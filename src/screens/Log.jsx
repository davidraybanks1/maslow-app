import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODE_MAX_BUBBLES } from '../lib/constants'
import { weekKey, loadJournalEntry, loadDebriefs, loadDebriefTypes, saveNoteToSelf, saveWeeklyReview, loadWeeklyReviews, loadUserCreatedAt } from '../lib/store'
import { createDataStats } from '../lib/dataStats'
import { natureTagStyle, peakTagStyle, ENVIRONMENT_TAG_STYLE, parseDebriefEntry } from '../lib/debriefTypes'
import LiveCanvasCard from '../components/LiveCanvasCard'
import styles from './Log.module.css'

const MOOD_PILL = {
  good: { bg: '#1B3A2D', label: 'good' },
  fine: { bg: '#B8C3B1', label: 'fine' },
  bad: { bg: '#D93B1C', label: 'hard' },
}
const MOOD_PERIODS = ['morning', 'midday', 'evening']

const ANXIETY_SECTION_LABELS = ['1. NAME IT', '2. FEEL IT', '3. EXAMINE IT', '4. RECLAIM IT']
const PEAK_SECTION_LABELS = ['1. NAME IT', '2. FEEL IT', '3. EXAMINE IT', '4. ANCHOR IT']

const REVIEW_DAY_LABELS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const REVIEW_PROGRESS = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 }

const WEEKLY_MOOD_OPTIONS = [
  { id: 'strong', name: 'strong', desc: 'real momentum — most days felt like progress.' },
  { id: 'steady', name: 'steady', desc: 'consistent. nothing dramatic either way.' },
  { id: 'mixed', name: 'mixed', desc: 'some real highs, some real lows.' },
  { id: 'hard', name: 'hard', desc: 'this week took more than it gave.' },
]

const NOTE_MAX_LENGTH = 120
const NOTE_LIBRARY = [
  'everything can be appreciated. most things can be enjoyed. everything else can be learned from.',
  'take up space.',
  'anxiety is just a misfired neurotransmission that was given room to grow.',
  'everything you want is on the other side of discomfort.',
  "don't play it safe.",
]

const EMPTY_DEBRIEF_TYPES = { nature: [], environment: [], peak: [] }

function dateKeyFor(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lastWeekDayKeys() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(dateKeyFor(d))
  }
  return days
}

function todayWeekdayMonday() {
  return (new Date().getDay() + 6) % 7
}

function formatCardDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()
}

function formatHistoryDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase()
}

// Monday-indexed (0=Mon..6=Sun) review day -> the matching JS Date.getDay() value (0=Sun..6=Sat)
function reviewDayToJsDay(reviewDay) {
  return (reviewDay + 1) % 7
}

function firstScheduledDateOnOrAfter(startDate, reviewDay) {
  const targetJsDay = reviewDayToJsDay(reviewDay)
  const d = new Date(startDate)
  d.setHours(12, 0, 0, 0)
  while (d.getDay() !== targetJsDay) d.setDate(d.getDate() + 1)
  return d
}

// Builds one row per scheduled review week from account creation through today, filling in
// any week with no saved weekly_reviews row as a missed (×) entry.
function buildReviewHistory(createdAt, reviewDay, realReviews) {
  if (!createdAt) return realReviews
  const realByWeek = new Map(realReviews.map(r => [r.week_starting, r]))

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  let cursor = firstScheduledDateOnOrAfter(createdAt, reviewDay)

  const rows = []
  while (cursor <= today) {
    const ws = weekKey(cursor)
    rows.push(realByWeek.get(ws) || { week_starting: ws, weekly_mood: null, steps_completed: 0 })
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }
  return rows.sort((a, b) => b.week_starting.localeCompare(a.week_starting))
}

function formatReviewTime(time) {
  const [hStr, m] = (time || '10:00').split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${m}${ampm}`
}

function dominantMoodForDay(moods, dateKey) {
  const dayMoods = moods.filter(m => m.date_key === dateKey)
  if (dayMoods.length === 0) return null
  const counts = { good: 0, fine: 0, bad: 0 }
  for (const m of dayMoods) if (counts[m.mood] !== undefined) counts[m.mood]++
  let best = null
  for (const mood of ['good', 'fine', 'bad']) {
    if (counts[mood] > 0 && (best === null || counts[mood] > counts[best])) best = mood
  }
  return best
}

function dayPracticeCount(canvas, checkins, dateKey) {
  const checked = checkins[dateKey] || []
  let total = 0
  let max = 0
  for (const n of NEEDS) {
    const mode = canvas[n.id]
    if (!mode) continue
    const maxBubbles = MODE_MAX_BUBBLES[mode] || 0
    max += maxBubbles
    const prefix = `${n.id}_`
    total += Math.min(checked.filter(k => k.startsWith(prefix)).length, maxBubbles)
  }
  return { total, max }
}

function practicesByNeedForDay(checkins, dateKey) {
  const dayCheckins = checkins[dateKey] || []
  const byNeed = {}
  for (const c of dayCheckins) {
    const underscore = c.indexOf('_')
    if (underscore === -1) continue
    const needId = c.slice(0, underscore)
    const text = c.slice(underscore + 1)
    if (!byNeed[needId]) byNeed[needId] = []
    byNeed[needId].push(text)
  }
  return byNeed
}

function computeInsight(stats, allDebriefs) {
  const { patternAnxiety, patternPeak } = stats.getDebriefStats(allDebriefs)
  if (patternAnxiety) return patternAnxiety
  if (patternPeak) return patternPeak
  const ratio = stats.getPattern()
  if (ratio !== null) {
    return `on days you complete 80%+ of your practices, you log good ${ratio.toFixed(1)}× more often than on days below 50%.`
  }
  return null
}

function ReviewStepShell({ pct, eyebrow, headline, sub, onBack, onContinue, onSkip, continueLabel, hideSkip, children }) {
  return (
    <div className={styles.screen}>
      <div className={styles.reviewProgressBar}>
        <div className={styles.reviewProgressFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.reviewContent}>
        <button className={styles.reviewBackBtn} onClick={onBack}>← back</button>
        <div className={styles.reviewEyebrow}>{eyebrow}</div>
        <div className={styles.reviewHeadline}>{headline}</div>
        <div className={styles.reviewSub}>{sub}</div>
        {children}
      </div>
      <div className={styles.reviewFooter}>
        <button className={styles.reviewContinueBtn} onClick={onContinue}>{continueLabel || 'continue →'}</button>
        {!hideSkip && <button className={styles.reviewSkipBtn} onClick={onSkip}>skip this step</button>}
      </div>
    </div>
  )
}

function DayCardExpandedContent({ canvas, checkins, dateKey, moods, journal, debriefs, debriefTypes }) {
  const byNeed = practicesByNeedForDay(checkins, dateKey)
  const needsWithPractices = NEEDS.filter(n => byNeed[n.id])
  const hasPractices = needsWithPractices.length > 0
  const hasJournal = !!journal
  const dayMoods = moods.filter(m => m.date_key === dateKey)

  return (
    <>
      {hasPractices && (
        <>
          <div className={styles.detailLabel}>practices</div>
          <div className={styles.practicesList}>
            {needsWithPractices.map((n, i) => (
              <div key={n.id}>
                {i > 0 && <div className={styles.practiceDivider} />}
                <div className={styles.practiceNeedName}>{n.name}</div>
                <div className={styles.practiceNamesText}>{byNeed[n.id].join(' · ')}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {hasPractices && <div className={styles.expandHairline} />}
      <div className={styles.detailLabel}>mood</div>
      <div className={styles.moodPeriodList}>
        {MOOD_PERIODS.map((period, i) => {
          const m = dayMoods.find(x => x.prompt_time === period)
          return (
            <div key={period}>
              {i > 0 && <div className={styles.moodPeriodDivider} />}
              <div className={styles.moodPeriodRow}>
                <span className={styles.moodPeriodLabel}>{period}</span>
                {m ? (
                  <span className={styles.moodPeriodPill} style={{ background: MOOD_PILL[m.mood].bg }}>{m.mood}</span>
                ) : (
                  <span className={styles.moodPeriodEmpty}>—</span>
                )}
              </div>
              {m?.note && <div className={styles.moodPeriodNote}>{m.note}</div>}
            </div>
          )
        })}
      </div>

      {hasJournal && (
        <>
          <div className={styles.expandHairline} />
          <div className={styles.detailLabel}>journal</div>
          <div className={styles.journalEntryText}>{journal}</div>
        </>
      )}

      {debriefs.length > 0 && (
        <>
          <div className={styles.expandHairline} />
          <div className={styles.detailLabel}>debriefs</div>
          <div className={styles.debriefStack}>
            {debriefs.map((d, i) => {
              const isPeak = d.type === 'peak'
              const { sections, isLegacy } = parseDebriefEntry(d.entry, isPeak)
              const labels = isPeak ? PEAK_SECTION_LABELS : ANXIETY_SECTION_LABELS
              return (
                <div key={d.id} className={i > 0 ? styles.debriefBlock : ''}>
                  <div className={styles.debriefTagsRow}>
                    <span className={styles.debriefSmallTag} style={isPeak ? peakTagStyle(d.nature, debriefTypes.peak) : natureTagStyle(d.nature, debriefTypes.nature)}>{d.nature}</span>
                    <span className={styles.debriefSmallTag} style={ENVIRONMENT_TAG_STYLE}>{d.environment}</span>
                  </div>
                  {labels.map((label, li) => (
                    <div key={label} className={styles.debriefStepRow}>
                      <div className={styles.debriefStepLabel}>{label}</div>
                      <div className={styles.debriefStepBody}>{sections[li] || '—'}</div>
                      {isLegacy && li === 0 && <div className={styles.legacyNote}>— recorded before structured fields</div>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function DayCard({ dateKey, canvas, checkins, moods, journal, debriefs, debriefTypes, isExpanded, onToggle, loading }) {
  const { total, max } = dayPracticeCount(canvas, checkins, dateKey)
  const mood = dominantMoodForDay(moods, dateKey)
  const anxietyCount = debriefs.filter(d => d.type !== 'peak').length
  const peakCount = debriefs.filter(d => d.type === 'peak').length
  const isEmpty = total === 0 && !journal && debriefs.length === 0

  if (isEmpty) {
    return (
      <div className={styles.dayCard} onClick={onToggle}>
        <div className={styles.dayCardTop}>
          <span className={styles.dayCardDate}>{formatCardDate(dateKey)}</span>
        </div>
        <div className={styles.dayCardEmptyNote}>nothing logged</div>
      </div>
    )
  }

  const pct = max > 0 ? Math.round((total / max) * 100) : 0
  const excerpt = journal ? (journal.length > 80 ? `${journal.slice(0, 80)}…` : journal) : null

  return (
    <div className={styles.dayCard} onClick={onToggle}>
      <div className={styles.dayCardTop}>
        <span className={styles.dayCardDate}>{formatCardDate(dateKey)}</span>
        <span className={styles.dayCardCount}>{total} of {max} practices</span>
      </div>
      <div className={styles.dayCardBarTrack}>
        <div className={styles.dayCardBarFill} style={{ width: `${pct}%` }} />
      </div>
      {mood && (
        <span className={styles.dayCardMoodPill} style={{ background: MOOD_PILL[mood].bg }}>{MOOD_PILL[mood].label}</span>
      )}
      {excerpt && <div className={styles.dayCardExcerpt}>{excerpt}</div>}
      {(anxietyCount > 0 || peakCount > 0) && (
        <div className={styles.dayCardTags}>
          {anxietyCount > 0 && (
            <span className={styles.dayCardTagAnxiety}>{anxietyCount > 1 ? `${anxietyCount} anxiety debriefs` : 'anxiety debrief'}</span>
          )}
          {peakCount > 0 && (
            <span className={styles.dayCardTagPeak}>{peakCount > 1 ? `${peakCount} peak moments` : 'peak moment'}</span>
          )}
        </div>
      )}

      {isExpanded && (
        <div className={styles.dayCardExpand} onClick={e => e.stopPropagation()}>
          {loading ? (
            <div className={styles.detailEmpty}>loading…</div>
          ) : (
            <DayCardExpandedContent
              canvas={canvas}
              checkins={checkins}
              dateKey={dateKey}
              moods={moods}
              journal={journal}
              debriefs={debriefs}
              debriefTypes={debriefTypes}
            />
          )}
        </div>
      )}
    </div>
  )
}

function FullLogAccordion({ state }) {
  const [expandedDay, setExpandedDay] = useState(null)
  const [journalCache, setJournalCache] = useState({})
  const [loadingDay, setLoadingDay] = useState(null)
  const [allDebriefs, setAllDebriefs] = useState([])
  const [debriefTypes, setDebriefTypes] = useState(EMPTY_DEBRIEF_TYPES)

  const moods = state.moods || []
  const canvas = state.canvas || {}
  const checkins = state.checkins || {}

  useEffect(() => {
    if (!state.userId) return
    Promise.all([loadDebriefs(state.userId), loadDebriefTypes(state.userId)]).then(([debriefs, types]) => {
      setAllDebriefs(debriefs)
      setDebriefTypes(types)
    })
  }, [state.userId])

  const allDayKeys = [...new Set([
    ...Object.keys(checkins),
    ...moods.map(m => m.date_key),
  ])].sort((a, b) => b.localeCompare(a))

  async function handleToggle(dateKey) {
    if (expandedDay === dateKey) { setExpandedDay(null); return }
    setExpandedDay(dateKey)
    if (state.userId && journalCache[dateKey] === undefined) {
      setLoadingDay(dateKey)
      const entry = await loadJournalEntry(state.userId, dateKey)
      setJournalCache(prev => ({ ...prev, [dateKey]: entry || '' }))
      setLoadingDay(null)
    }
  }

  if (allDayKeys.length === 0) {
    return <div className={styles.emptyState}>no data yet — start checking in on the today screen.</div>
  }

  return (
    <div className={styles.dayCardList}>
      {allDayKeys.map(dateKey => (
        <DayCard
          key={dateKey}
          dateKey={dateKey}
          canvas={canvas}
          checkins={checkins}
          moods={moods}
          journal={journalCache[dateKey]}
          debriefs={allDebriefs.filter(d => d.date_key === dateKey)}
          debriefTypes={debriefTypes}
          isExpanded={expandedDay === dateKey}
          onToggle={() => handleToggle(dateKey)}
          loading={loadingDay === dateKey}
        />
      ))}
    </div>
  )
}

export default function Log({ state, setNoteToSelf }) {
  const navigate = useNavigate()

  const [showFullLog, setShowFullLog] = useState(false)
  const [reviewStep, setReviewStep] = useState(null) // null | 1-5
  const [justFinished, setJustFinished] = useState(false)
  const [expandedReviewDay, setExpandedReviewDay] = useState(null)

  const [weekJournals, setWeekJournals] = useState({})
  const [weekDebriefs, setWeekDebriefs] = useState([])
  const [reviewDebriefTypes, setReviewDebriefTypes] = useState(EMPTY_DEBRIEF_TYPES)
  const [insightText, setInsightText] = useState(null)

  const [weeklyMood, setWeeklyMood] = useState(null)
  const [stepsCompletedCount, setStepsCompletedCount] = useState(0)
  const [noteDraft, setNoteDraft] = useState('')
  const [finishing, setFinishing] = useState(false)

  const [reviewHistory, setReviewHistory] = useState([])

  const stats = createDataStats({ canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [], practices: state.practices || {} })

  useEffect(() => {
    if (!state.userId) return
    Promise.all([loadWeeklyReviews(state.userId), loadUserCreatedAt(state.userId)]).then(([realReviews, createdAt]) => {
      setReviewHistory(buildReviewHistory(createdAt, state.reviewDay ?? 0, realReviews))
    })
  }, [state.userId, state.reviewDay])

  async function startReview() {
    setWeeklyMood(null)
    setNoteDraft(state.noteToSelf || '')
    setStepsCompletedCount(0)
    setExpandedReviewDay(null)
    setInsightText(null)
    setReviewStep(1)

    if (!state.userId) return
    const days = lastWeekDayKeys()
    const [entries, allDebriefs, types] = await Promise.all([
      Promise.all(days.map(d => loadJournalEntry(state.userId, d))),
      loadDebriefs(state.userId),
      loadDebriefTypes(state.userId),
    ])
    const journalMap = {}
    days.forEach((d, i) => { journalMap[d] = entries[i] })
    setWeekJournals(journalMap)
    setWeekDebriefs(allDebriefs.filter(d => days.includes(d.date_key)))
    setReviewDebriefTypes(types)
    setInsightText(computeInsight(stats, allDebriefs))
  }

  function handleContinue(fromStep) {
    setStepsCompletedCount(c => c + 1)
    advance(fromStep)
  }

  function handleSkip(fromStep) {
    advance(fromStep)
  }

  function advance(fromStep) {
    if (fromStep === 3 && !insightText) { setReviewStep(5); return }
    if (fromStep === 4) { setReviewStep(5); return }
    setReviewStep(fromStep + 1)
  }

  function handleBack(fromStep) {
    if (fromStep === 1) { setReviewStep(null); return }
    if (fromStep === 5 && !insightText) { setReviewStep(3); return }
    setReviewStep(fromStep - 1)
  }

  async function handleFinishReview() {
    setFinishing(true)
    const trimmed = noteDraft.trim()
    if (state.userId) {
      if (trimmed && trimmed !== (state.noteToSelf || '')) {
        await saveNoteToSelf(state.userId, trimmed)
        setNoteToSelf?.(trimmed)
      }
      await saveWeeklyReview(state.userId, {
        weekStarting: weekKey(),
        weeklyMood,
        stepsCompleted: stepsCompletedCount + 1,
      })
      const [realReviews, createdAt] = await Promise.all([loadWeeklyReviews(state.userId), loadUserCreatedAt(state.userId)])
      setReviewHistory(buildReviewHistory(createdAt, state.reviewDay ?? 0, realReviews))
    }
    setFinishing(false)
    setReviewStep(null)
    setJustFinished(true)
    setTimeout(() => setJustFinished(false), 3000)
  }

  // ── Step 1: Last week's log ───────────────────────────────────────────────
  if (reviewStep === 1) {
    const days = [...lastWeekDayKeys()].reverse()
    const canvas = state.canvas || {}
    const checkins = state.checkins || {}
    const moods = state.moods || []

    return (
      <ReviewStepShell
        pct={REVIEW_PROGRESS[1]}
        eyebrow="STEP 1 OF 5 — LAST WEEK"
        headline="how did last week go?"
        sub="here's what the data shows. tap any day to see the full entry."
        onBack={() => handleBack(1)}
        onContinue={() => handleContinue(1)}
        onSkip={() => handleSkip(1)}
      >
        <div className={styles.dayCardList}>
          {days.map(dateKey => (
            <DayCard
              key={dateKey}
              dateKey={dateKey}
              canvas={canvas}
              checkins={checkins}
              moods={moods}
              journal={weekJournals[dateKey]}
              debriefs={weekDebriefs.filter(d => d.date_key === dateKey)}
              debriefTypes={reviewDebriefTypes}
              isExpanded={expandedReviewDay === dateKey}
              onToggle={() => setExpandedReviewDay(expandedReviewDay === dateKey ? null : dateKey)}
              loading={false}
            />
          ))}
        </div>
      </ReviewStepShell>
    )
  }

  // ── Step 2: How the week felt ─────────────────────────────────────────────
  if (reviewStep === 2) {
    return (
      <ReviewStepShell
        pct={REVIEW_PROGRESS[2]}
        eyebrow="STEP 2 OF 5 — THE WEEK"
        headline="overall, how was last week?"
        sub="one answer. your gut reaction."
        onBack={() => handleBack(2)}
        onContinue={() => handleContinue(2)}
        onSkip={() => handleSkip(2)}
      >
        <div className={styles.weeklyMoodGrid}>
          {WEEKLY_MOOD_OPTIONS.map(opt => (
            <div
              key={opt.id}
              className={`${styles.weeklyMoodCard} ${weeklyMood === opt.id ? styles.weeklyMoodCardSelected : ''}`}
              onClick={() => setWeeklyMood(opt.id)}
            >
              <div className={styles.weeklyMoodName}>{opt.name}</div>
              <div className={styles.weeklyMoodDesc}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </ReviewStepShell>
    )
  }

  // ── Step 3: Canvas check ──────────────────────────────────────────────────
  if (reviewStep === 3) {
    return (
      <ReviewStepShell
        pct={REVIEW_PROGRESS[3]}
        eyebrow="STEP 3 OF 5 — CANVAS CHECK"
        headline="does your canvas still fit?"
        sub="here's how each need paced last week against its mode target."
        onBack={() => handleBack(3)}
        onContinue={() => handleContinue(3)}
        onSkip={() => handleSkip(3)}
      >
        <LiveCanvasCard stats={stats} range={7} />
        <button className={styles.canvasLinkBtn} onClick={() => navigate('/canvas')}>go to my canvas →</button>
      </ReviewStepShell>
    )
  }

  // ── Step 4: Insight (auto-skipped if no qualifying pattern) ──────────────
  if (reviewStep === 4 && insightText) {
    return (
      <ReviewStepShell
        pct={REVIEW_PROGRESS[4]}
        eyebrow="STEP 4 OF 5 — INSIGHT"
        headline="one thing the data noticed."
        sub="from your practices, mood, and debriefs this week."
        onBack={() => handleBack(4)}
        onContinue={() => handleContinue(4)}
        onSkip={() => handleSkip(4)}
      >
        <div className={styles.insightCard}>
          <div className={styles.insightLabel}>pattern</div>
          <div className={styles.insightBody}>{insightText}</div>
        </div>
      </ReviewStepShell>
    )
  }

  // ── Step 5: Note to self ─────────────────────────────────────────────────
  if (reviewStep === 5) {
    return (
      <ReviewStepShell
        pct={REVIEW_PROGRESS[5]}
        eyebrow="STEP 5 OF 5 — NOTE TO SELF"
        headline="what does your future self need to remember this week?"
        sub="this will appear at the top of your today screen every morning."
        onBack={() => handleBack(5)}
        onContinue={handleFinishReview}
        continueLabel={finishing ? 'saving…' : 'finish review →'}
        hideSkip
      >
        <textarea
          className={styles.noteTextarea}
          value={noteDraft}
          onChange={e => setNoteDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="what does your future self need to remember this week?"
          rows={3}
        />
        <div className={styles.noteCharCount}>{NOTE_MAX_LENGTH - noteDraft.length} characters remaining</div>

        <div className={styles.noteSectionLabel}>OR CHOOSE FROM THE LIBRARY</div>
        <div className={styles.noteLibraryList}>
          {NOTE_LIBRARY.map((text, i) => (
            <div key={i} className={styles.noteCard} onClick={() => setNoteDraft(text)}>{text}</div>
          ))}
        </div>
      </ReviewStepShell>
    )
  }

  // ── Default state ─────────────────────────────────────────────────────────
  const isScheduledDay = todayWeekdayMonday() === (state.reviewDay ?? 0)

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>weekly review.</div>
        <div className={styles.sub}>your weekly review and daily log.</div>
      </div>
      <div className={styles.content}>
        {justFinished && (
          <div className={styles.completeBanner}>
            review complete. see you {REVIEW_DAY_LABELS[state.reviewDay ?? 0]}.
          </div>
        )}

        <div className={styles.scheduleCard}>
          <div className={styles.scheduleLabel}>next review</div>
          <div className={styles.scheduleValue}>
            {REVIEW_DAY_LABELS[state.reviewDay ?? 0]} at {formatReviewTime(state.reviewTime)}
          </div>
          <button
            className={isScheduledDay ? styles.startReviewBtnPrimary : styles.startReviewBtnSecondary}
            onClick={startReview}
          >
            start review →
          </button>
        </div>

        <div className={styles.viewFullLogToggle} onClick={() => setShowFullLog(o => !o)}>
          {showFullLog ? '− hide full log' : '+ view full log'}
        </div>

        {showFullLog && <FullLogAccordion state={state} />}

        <div className={styles.reviewHistoryLabel}>REVIEW HISTORY</div>
        {reviewHistory.length === 0 ? (
          <div className={styles.reviewHistoryEmpty}>no reviews yet — complete your first weekly review above.</div>
        ) : (
          <div className={styles.reviewHistoryList}>
            {reviewHistory.map((r, i) => (
              <div key={r.week_starting}>
                {i > 0 && <div className={styles.reviewHistoryDivider} />}
                <div className={styles.reviewHistoryRow}>
                  <span className={styles.reviewHistoryLeft}>
                    <span className={styles.reviewHistoryPrefix}>review:</span>
                    <span className={styles.reviewHistoryDate}>{formatHistoryDate(r.week_starting)}</span>
                  </span>
                  {r.steps_completed > 0 ? (
                    <span className={styles.reviewHistoryDone}>✓</span>
                  ) : (
                    <span className={styles.reviewHistoryMissed}>×</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
