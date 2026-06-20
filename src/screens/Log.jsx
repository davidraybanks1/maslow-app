import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODE_MAX_BUBBLES } from '../lib/constants'
import { weekKey, loadJournalEntry, loadDebriefs, loadDebriefTypes, saveNoteToSelf, saveWeeklyReview } from '../lib/store'
import { createDataStats } from '../lib/dataStats'
import LiveCanvasCard from '../components/LiveCanvasCard'
import styles from './Log.module.css'

const MOOD_COLOR = { good: '#1B3A2D', fine: '#E8B81F', bad: '#D93B1C' }
const MOOD_PERIODS = ['morning', 'midday', 'evening']
const MOOD_PILL = {
  good: { bg: '#1B3A2D', label: 'good' },
  fine: { bg: '#B8C3B1', label: 'fine' },
  bad: { bg: '#D93B1C', label: 'hard' },
}

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

function formatDateLabel(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const month = d.toLocaleDateString('en-US', { month: 'long' }).toLowerCase()
  return `${day}, ${month} ${d.getDate()}`
}

function formatCardDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()
}

function formatReviewTime(time) {
  const [hStr, m] = (time || '10:00').split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${m}${ampm}`
}

function splitEntry(entry) {
  const parts = (entry || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const sections = ['', '', '', '']
  for (let i = 0; i < Math.min(parts.length, 3); i++) sections[i] = parts[i]
  if (parts.length > 3) sections[3] = parts.slice(3).join('\n\n')
  return sections
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

function FullLogAccordion({ state }) {
  const [expandedDay, setExpandedDay] = useState(null)
  const [journalEntries, setJournalEntries] = useState({})
  const moods = state.moods || []
  const canvas = state.canvas || {}
  const checkins = state.checkins || {}

  const allDayKeys = [...new Set([
    ...Object.keys(checkins),
    ...moods.map(m => m.date_key),
  ])].sort((a, b) => b.localeCompare(a))

  const assignedNeeds = NEEDS.filter(n => canvas[n.id])
  const totalNeeds = assignedNeeds.length

  function handleRowClick(dateKey) {
    if (expandedDay === dateKey) { setExpandedDay(null); return }
    setExpandedDay(dateKey)
    if (state.userId && journalEntries[dateKey] === undefined) {
      loadJournalEntry(state.userId, dateKey).then(entry => {
        setJournalEntries(prev => ({ ...prev, [dateKey]: entry || '' }))
      })
    }
  }

  if (allDayKeys.length === 0) {
    return <div className={styles.emptyState}>no data yet — start checking in on the today screen.</div>
  }

  return (
    <div className={styles.card}>
      {allDayKeys.map((dateKey, idx) => {
        const dayCheckins = checkins[dateKey] || []
        const dayMoods = moods.filter(m => m.date_key === dateKey)
        const needsMet = assignedNeeds.filter(n => dayCheckins.some(c => c.startsWith(`${n.id}_`))).length
        const isExpanded = expandedDay === dateKey
        const journal = journalEntries[dateKey]

        const practicesByNeed = {}
        for (const c of dayCheckins) {
          const underscore = c.indexOf('_')
          if (underscore === -1) continue
          const needId = c.slice(0, underscore)
          const text = c.slice(underscore + 1)
          if (!practicesByNeed[needId]) practicesByNeed[needId] = []
          practicesByNeed[needId].push(text)
        }

        return (
          <div key={dateKey}>
            {idx > 0 && <div className={styles.rowDivider} />}
            <div className={styles.dayRow} onClick={() => handleRowClick(dateKey)}>
              <span className={styles.dayLabel}>{formatDateLabel(dateKey)}</span>
              {totalNeeds > 0 && (dayCheckins.length > 0 || dayMoods.length > 0) && (
                <span className={styles.dayCount}>{needsMet} of {totalNeeds} needs</span>
              )}
            </div>

            {isExpanded && (
              <div className={styles.dayDetail}>
                <div className={styles.detailLabel}>mood</div>
                {dayMoods.length === 0 ? (
                  <div className={styles.detailEmpty}>no mood data</div>
                ) : (
                  <div className={styles.moodList}>
                    {MOOD_PERIODS.map(period => {
                      const m = dayMoods.find(x => x.prompt_time === period)
                      if (!m) return null
                      return (
                        <div key={period}>
                          <div className={styles.moodRow}>
                            <span className={styles.moodPeriod}>{period}</span>
                            <span className={styles.moodBadge} style={{ background: MOOD_COLOR[m.mood] }}>{m.mood}</span>
                          </div>
                          {m.note && <div className={styles.moodNote}>{m.note}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className={styles.detailLabel} style={{ marginTop: 14 }}>practices</div>
                {Object.keys(practicesByNeed).length === 0 ? (
                  <div className={styles.detailEmpty}>no practices logged</div>
                ) : (
                  <div className={styles.practiceList}>
                    {NEEDS.filter(n => practicesByNeed[n.id]).map(n => (
                      <div key={n.id} className={styles.practiceGroup}>
                        <span className={styles.practiceNeed}>{n.name}</span>
                        <span className={styles.practiceTexts}>{practicesByNeed[n.id].join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {journal !== undefined && (
                  <>
                    <div className={styles.detailLabel} style={{ marginTop: 14 }}>thoughts</div>
                    {journal ? (
                      <div className={styles.journalText}>{journal}</div>
                    ) : (
                      <div className={styles.detailEmpty}>no journal entry</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
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
  const [insightText, setInsightText] = useState(null)

  const [weeklyMood, setWeeklyMood] = useState(null)
  const [stepsCompletedCount, setStepsCompletedCount] = useState(0)
  const [noteDraft, setNoteDraft] = useState('')
  const [finishing, setFinishing] = useState(false)

  const stats = createDataStats({ canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [], practices: state.practices || {} })

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
          {days.map(dateKey => {
            const { total, max } = dayPracticeCount(canvas, checkins, dateKey)
            const mood = dominantMoodForDay(moods, dateKey)
            const journal = weekJournals[dateKey]
            const dayDebriefs = weekDebriefs.filter(d => d.date_key === dateKey)
            const hasAnxiety = dayDebriefs.some(d => d.type !== 'peak')
            const hasPeak = dayDebriefs.some(d => d.type === 'peak')
            const isExpanded = expandedReviewDay === dateKey
            const pct = max > 0 ? Math.round((total / max) * 100) : 0

            return (
              <div key={dateKey} className={styles.dayCard} onClick={() => setExpandedReviewDay(isExpanded ? null : dateKey)}>
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
                {journal && <div className={styles.dayCardExcerpt}>{journal.slice(0, 80)}</div>}
                {(hasAnxiety || hasPeak) && (
                  <div className={styles.dayCardTags}>
                    {hasAnxiety && <span className={styles.dayCardTagAnxiety}>anxiety debrief</span>}
                    {hasPeak && <span className={styles.dayCardTagPeak}>peak debrief</span>}
                  </div>
                )}

                {isExpanded && (
                  <div className={styles.dayCardExpand} onClick={e => e.stopPropagation()}>
                    <div className={styles.detailLabel}>journal</div>
                    {journal ? (
                      <div className={styles.journalText}>{journal}</div>
                    ) : (
                      <div className={styles.detailEmpty}>no journal entry</div>
                    )}
                    {dayDebriefs.map(d => {
                      const isPeak = d.type === 'peak'
                      const sections = splitEntry(d.entry)
                      const labels = isPeak ? PEAK_SECTION_LABELS : ANXIETY_SECTION_LABELS
                      return (
                        <div key={d.id}>
                          <div className={styles.detailLabel} style={{ marginTop: 14 }}>{isPeak ? 'peak debrief' : 'anxiety debrief'}</div>
                          {labels.map((label, li) => (
                            <div key={label} className={styles.debriefStepRow}>
                              <div className={styles.debriefStepLabel}>{label}</div>
                              <div className={styles.debriefStepBody}>{sections[li] || '—'}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
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
        <div className={styles.title}>log.</div>
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
      </div>
    </div>
  )
}
