import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { hapticTick } from '../lib/native'
import { normalizeBand, BAND_LABEL, FEELINGS, BANDS } from '../lib/frequency'
import FrequencyCard from '../components/FrequencyCard'
import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { NEEDS, MODE_MAX_BUBBLES, JOURNAL_TRUNCATE } from '../lib/constants'
import { weekKey, todayKey, loadWeeklyReviews, loadJournalEntry, loadDebriefs, loadDebriefTypes, addNoteDeckCard, saveWeeklyReview, loadAllJournalMeta, loadJournalArchive, updateJournalEntryTags, toggleJournalFavorite, toggleJournalRevisit, loadDayCheckins, loadCustomTags } from '../lib/store'
import { createDataStats } from '../lib/dataStats'
import { natureTagStyle, peakTagStyle, ENVIRONMENT_TAG_STYLE, parseDebriefEntry } from '../lib/debriefTypes'
import LiveCanvasCard from '../components/LiveCanvasCard'
import JournalQuote from '../components/JournalQuote'
import { supabase } from '../lib/supabase'
import ThreadTiles from '../components/ThreadTiles'
import styles from './Log.module.css'

const MOOD_PILL = {
  good: { bg: '#1B3A2D' },
  mid:  { bg: '#B8C3B1' },
  bad:  { bg: '#D93B1C' },
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

// Returns 7 day keys oldest-first for the review window.
// daily: rolling previous 7 days ending today.
// weekly: fixed calendar week Mon–Sun anchored on the current Monday.
function reviewWindowKeys(cadence) {
  if (cadence === 'daily') {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(dateKeyFor(d))
    }
    return days
  }
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return dateKeyFor(d)
  })
}

function todayWeekdayMonday() {
  return (new Date().getDay() + 6) % 7
}

// The key stored as week_starting when a review is saved for the current period.
// weekly: Monday of the current calendar week (matches weekKey()).
// daily: 6 days ago — the oldest day in the rolling 7-day window (matches reviewWindowKeys('daily')[0]).
function periodKey(cadence) {
  if (cadence === 'daily') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return dateKeyFor(d)
  }
  return weekKey()
}

function formatCardDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}


const WDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const MONTHS_LONG = ['january','february','march','april','may','june','july','august','september','october','november','december']
const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

const MOOD_DOT_COLOR = { good: 'var(--exploration)', mid: '#9DB394', bad: 'var(--survival)' }
/* lit from the same point as the bloom - the calendar's mood spheres and the day's practice marks */
const LIT = (a, b) => `radial-gradient(circle at 34% 26%, ${a}, ${b})`
const MOOD_LIT = { good: LIT('#3FA87A', '#07301F'), mid: LIT('#B4C4AC', '#3E5238'), bad: LIT('#FF8A66', '#A81F06') }
const MODE_LIT = {
  exploration: LIT('#2E8A64', '#0C5038'), appreciation: LIT('#B4C4AC', '#536E4D'),
  nourishment: LIT('#FFD166', '#F0A800'), survival: LIT('#FF7A55', '#F03C10'),
}
const SLOT_ORDER = { morning: 0, midday: 1, evening: 2 }
const MODE_DOT_TOKEN = {
  exploration:  'var(--exploration)',
  appreciation: 'var(--appreciation-deep)',
  nourishment:  'var(--nourishment)',
  survival:     'var(--survival)',
}
const ARCHIVE_SLOTS = ['morning', 'midday', 'evening']
const ARCHIVE_FEELINGS = Object.values(FEELINGS).flat()
const ARCHIVE_DATE_PRESETS = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
]
const ARCHIVE_PAGE_SIZE = 3

function formatArchiveDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return `${WDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function formatEntryTime(createdAt) {
  const d = new Date(createdAt)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatRangeDateStr(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const mo = MONTHS_SHORT[m - 1]
  return y !== new Date().getFullYear() ? `${mo} ${d} ${y}` : `${mo} ${d}`
}

function formatRangeLabel(start, end) {
  if (!start) return null
  if (!end || end === start) return formatRangeDateStr(start)
  return `${formatRangeDateStr(start)} – ${formatRangeDateStr(end)}`
}


function ritualMetaLine(cadence) {
  const days = reviewWindowKeys(cadence)
  const first = new Date(days[0] + 'T12:00:00')
  const last = new Date(days[days.length - 1] + 'T12:00:00')
  return `${WDAYS[first.getDay()]} ${first.getDate()} — ${WDAYS[last.getDay()]} ${last.getDate()} ${MONTHS_LONG[last.getMonth()]} · ~8 min`
}

function matchesPredicate(e, pred, afterKey, beforeKey) {
  if (pred.fav     && !e.favorite) return false
  if (pred.revisit && !e.revisit)  return false
  if (pred.slot   && e.slot    !== pred.slot)   return false
  if (pred.need   && e.need_id !== pred.need)   return false
  if (pred.feeling && e.mood_feeling !== pred.feeling) return false
  if (pred.custom && e.custom  !== pred.custom) return false
  if (afterKey    && e.date_key < afterKey)     return false
  if (beforeKey   && e.date_key > beforeKey)    return false
  return true
}

function isoYearWeek(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function formatThreadDate(dateKey, slot) {
  const d = new Date(dateKey + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${slot ? ` · ${slot}` : ''}`
}

function formatDayDetailDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return `${WDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function computeActiveThreads(archiveEntries, canvas, customTags) {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30)
  const afterKey = dateKeyFor(cutoff)

  const canvasNeeds = NEEDS.filter(n => canvas?.[n.id])

  const candidates = [
    ...ARCHIVE_SLOTS.map(s => ({
      id: `slot:${s}`,
      predicate: { slot: s },
      label: `${s}s`,
      title: `what ${s}s sound like`,
      intro: `everything you've written in the ${s}`,
      dim: 'slot',
    })),
    ...ARCHIVE_FEELINGS.map(f => ({
      id: `feeling:${f}`,
      predicate: { feeling: f },
      label: f,
      band: BANDS.find(b => FEELINGS[b].includes(f)),
      title: `${f} days`,
      intro: `days that felt ${f}`,
      dim: 'feeling',
    })),
    ...canvasNeeds.map(n => ({
      id: `need:${n.id}`,
      predicate: { need: n.id },
      label: n.name,
      modeName: canvas?.[n.id] || null,
      title: n.name,
      intro: `everything you've written about ${n.name}`,
      dim: 'need',
      needId: n.id,
    })),
    ...(customTags || []).map(t => ({
      id: `custom:${t.label}`,
      predicate: { custom: t.label },
      label: t.label,
      title: `the ${t.label} thread`,
      intro: `everything you've written about ${t.label}`,
      dim: 'custom',
    })),
  ]

  const scored = candidates
    .map(c => {
      const inWindow = archiveEntries.filter(e => matchesPredicate(e, c.predicate, afterKey))
      const windowCount = inWindow.length
      const lastDate = archiveEntries.find(e => matchesPredicate(e, c.predicate))?.date_key || '0000-00-00'
      // a daypart takes the colour of how it mostly felt
      let band = c.band
      if (c.dim === 'slot') {
        const tally = {}
        for (const e of inWindow) if (e.mood_band) tally[e.mood_band] = (tally[e.mood_band] || 0) + 1
        band = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null
      }
      return { ...c, windowCount, lastDate, band }
    })
    .filter(c => c.windowCount >= 2)
    .sort((a, b) => b.windowCount - a.windowCount || b.lastDate.localeCompare(a.lastDate))

  return scored.slice(0, 10)
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
  const counts = { good: 0, mid: 0, bad: 0 }
  for (const m of dayMoods) { const band = normalizeBand(m.mood); if (counts[band] !== undefined) counts[band]++ }
  let best = null
  for (const mood of ['good', 'mid', 'bad']) {
    if (counts[mood] > 0 && (best === null || counts[mood] > counts[best])) best = mood
  }
  return best
}

// Checkins are v2 object rows: { id, need_id, practice_text, mode, completed_at }.
// A string fallback is kept for any stale v1 entries ('needId_practice text').
function checkinNeedId(c) {
  if (typeof c === 'string') {
    const sep = c.indexOf('_')
    return sep > 0 ? c.slice(0, sep) : c
  }
  return c?.need_id || null
}

function checkinPracticeText(c) {
  if (typeof c === 'string') {
    const sep = c.indexOf('_')
    return sep > 0 ? c.slice(sep + 1) : ''
  }
  return c?.practice_text || ''
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
    total += Math.min(checked.filter(c => checkinNeedId(c) === n.id).length, maxBubbles)
  }
  return { total, max }
}

function practicesByNeedForDay(checkins, dateKey) {
  const dayCheckins = checkins[dateKey] || []
  const byNeed = {}
  for (const c of dayCheckins) {
    const needId = checkinNeedId(c)
    if (!needId) continue
    if (!byNeed[needId]) byNeed[needId] = []
    byNeed[needId].push(checkinPracticeText(c))
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
                <div className={styles.practiceNamesText}>{byNeed[n.id].filter(Boolean).join(' · ') || '—'}</div>
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
                  <span className={styles.moodPeriodPill} style={{ background: MOOD_PILL[normalizeBand(m.mood)].bg }}>{BAND_LABEL[normalizeBand(m.mood)]}</span>
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
        <span className={styles.dayCardMoodPill} style={{ background: MOOD_PILL[mood].bg }}>{BAND_LABEL[mood]}</span>
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
    if (!state.userId) { console.error('[FullLogAccordion] called without userId — session may be invalid'); return }
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
    if (journalCache[dateKey] === undefined) {
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

export default function Log({ state, syncCheckinDay }) {
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
  const [skipDecisionSteps, setSkipDecisionSteps] = useState(false)
  const [reviewWindowDays, setReviewWindowDays] = useState([])

  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [selectedDayKey, setSelectedDayKey] = useState(null)
  const [detailCheckins, setDetailCheckins] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const calCheckinCache = useRef({})
  useEffect(() => { setEditMode(false) }, [selectedDayKey])

  const [journalMeta, setJournalMeta] = useState([])
  const [ritualDismissed, setRitualDismissed] = useState(() => {
    try { return localStorage.getItem('maslow_ritual_dismissed') === new Date().toDateString() } catch { return false }
  })
  const [weeklyReviews, setWeeklyReviews] = useState([])

  const [archiveEntries, setArchiveEntries] = useState([])
  const [archiveLoaded, setArchiveLoaded] = useState(false)
  const [customTags, setCustomTags] = useState([])
  const [filterSlot, setFilterSlot] = useState(null)
  const [filterNeed, setFilterNeed] = useState(null)
  const [filterFeeling, setFilterFeeling] = useState(null)
  const [filterCustom, setFilterCustom] = useState(null)
  const [filterFav, setFilterFav] = useState(false)
  const [filterRevisit, setFilterRevisit] = useState(false)
  const [filterDate, setFilterDate] = useState(null)
  const [rangeStart, setRangeStart] = useState(null)
  const [rangeEnd, setRangeEnd] = useState(null)
  const [pickAnchor, setPickAnchor] = useState(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth())
  const [openThreadId, setOpenThreadId] = useState(null)
  const [openFacet, setOpenFacet] = useState(null)
  const [threadVisible, setThreadVisible] = useState(8)
  useEffect(() => { setThreadVisible(8) }, [openThreadId])
  const [archiveVisible, setArchiveVisible] = useState(ARCHIVE_PAGE_SIZE)
  const [expandedEntries, setExpandedEntries] = useState(new Set())
  const [taggingEntryId, setTaggingEntryId] = useState(null)

  const [resurfacePool, setResurfacePool] = useState([])
  const [resurfaceIdx, setResurfaceIdx] = useState(0)

  const stats = createDataStats({ canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [], practices: state.practices || {} })

  // ── Memoised archive computations ──────────────────────────────────────────
  const activeThreads = useMemo(
    () => computeActiveThreads(archiveEntries, state.canvas, customTags),
    [archiveEntries, state.canvas, customTags]
  )

  const archiveAllJournalDays = useMemo(
    () => new Set(archiveEntries.map(e => e.date_key)),
    [archiveEntries]
  )

  // Stable key that changes only when entries are added/removed, not when
  // fields (favorite, revisit) change — used to gate the resurface pool effect
  // so toggling a mark doesn't reshuffle the card.
  const archiveIdsKey = useMemo(
    () => archiveEntries.map(e => e.id).join('|'),
    [archiveEntries]
  )

  const archiveDateRange = useMemo(() => {
    const today = new Date(); today.setHours(12, 0, 0, 0)
    let filterAfterKey = null
    let filterBeforeKey = null
    if (rangeStart) {
      filterAfterKey = rangeStart
      filterBeforeKey = rangeEnd || rangeStart
    } else if (filterDate === '30d') {
      const d = new Date(today); d.setDate(d.getDate() - 30)
      filterAfterKey = dateKeyFor(d)
    } else if (filterDate === '90d') {
      const d = new Date(today); d.setDate(d.getDate() - 90)
      filterAfterKey = dateKeyFor(d)
    }
    return { filterAfterKey, filterBeforeKey }
  }, [rangeStart, rangeEnd, filterDate])

  const archiveFiltered = useMemo(
    () => archiveEntries.filter(e => matchesPredicate(e,
      { fav: filterFav, revisit: filterRevisit, slot: filterSlot, need: filterNeed, feeling: filterFeeling, custom: filterCustom },
      archiveDateRange.filterAfterKey, archiveDateRange.filterBeforeKey
    )),
    [archiveEntries, filterFav, filterRevisit, filterSlot, filterNeed, filterFeeling, filterCustom, archiveDateRange]
  )

  const archiveCounts = useMemo(() => {
    const { filterAfterKey, filterBeforeKey } = archiveDateRange
    const canvasNeeds = NEEDS.filter(n => state.canvas?.[n.id])
    const slotCounts = Object.fromEntries(ARCHIVE_SLOTS.map(s => [s,
      archiveEntries.filter(e => matchesPredicate(e, { fav: filterFav, revisit: filterRevisit, slot: s, need: filterNeed, feeling: filterFeeling, custom: filterCustom }, filterAfterKey, filterBeforeKey)).length
    ]))
    const needCounts = Object.fromEntries(canvasNeeds.map(n => [n.id,
      archiveEntries.filter(e => matchesPredicate(e, { fav: filterFav, revisit: filterRevisit, slot: filterSlot, need: n.id, feeling: filterFeeling, custom: filterCustom }, filterAfterKey, filterBeforeKey)).length
    ]))
    const feelingCounts = Object.fromEntries(ARCHIVE_FEELINGS.map(f => [f,
      archiveEntries.filter(e => matchesPredicate(e, { fav: filterFav, revisit: filterRevisit, slot: filterSlot, need: filterNeed, feeling: f, custom: filterCustom }, filterAfterKey, filterBeforeKey)).length
    ]))
    const archiveCustomValues = [...new Set(archiveEntries.map(e => e.custom).filter(Boolean))]
    const vocabLabels = customTags.map(t => t.label)
    const allCustomLabels = [...new Set([...vocabLabels, ...archiveCustomValues])]
    const customCounts = Object.fromEntries(allCustomLabels.map(label => [label,
      archiveEntries.filter(e => matchesPredicate(e, { fav: filterFav, revisit: filterRevisit, slot: filterSlot, need: filterNeed, feeling: filterFeeling, custom: label }, filterAfterKey, filterBeforeKey)).length
    ]))
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const presetCounts = Object.fromEntries(ARCHIVE_DATE_PRESETS.map(r => {
      const d = new Date(today); d.setDate(d.getDate() - (r.key === '30d' ? 30 : 90))
      return [r.key, archiveEntries.filter(e => matchesPredicate(e, { fav: filterFav, revisit: filterRevisit, slot: filterSlot, need: filterNeed, feeling: filterFeeling, custom: filterCustom }, dateKeyFor(d), null)).length]
    }))
    const favCount = archiveEntries.filter(e => matchesPredicate(e, { fav: true, revisit: filterRevisit, slot: filterSlot, need: filterNeed, feeling: filterFeeling, custom: filterCustom }, filterAfterKey, filterBeforeKey)).length
    const revisitCount = archiveEntries.filter(e => matchesPredicate(e, { fav: filterFav, revisit: true, slot: filterSlot, need: filterNeed, feeling: filterFeeling, custom: filterCustom }, filterAfterKey, filterBeforeKey)).length
    return { canvasNeeds, slotCounts, needCounts, feelingCounts, allCustomLabels, customCounts, presetCounts, favCount, revisitCount }
  }, [archiveEntries, filterFav, filterRevisit, filterSlot, filterNeed, filterFeeling, filterCustom, archiveDateRange, state.canvas, customTags])
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!state.userId) return
    loadAllJournalMeta(state.userId).then(setJournalMeta)
    loadWeeklyReviews(state.userId, 5).then(setWeeklyReviews)
  }, [state.userId])

  useEffect(() => {
    if (!state.userId) return
    loadJournalArchive(state.userId).then(data => {
      setArchiveEntries(data)
      setArchiveLoaded(true)
    })
    loadCustomTags(state.userId).then(setCustomTags)
  }, [state.userId])

  useEffect(() => {
    if (!archiveLoaded || archiveEntries.length < 10) { setResurfacePool([]); return }
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const oldest = archiveEntries[archiveEntries.length - 1]
    const journalAge = Math.round((today - new Date(oldest.date_key + 'T12:00:00')) / 86400000)
    const exclusionDays = Math.min(25, Math.floor(journalAge / 2))
    const todayBands = new Set(
      archiveEntries.filter(e => e.date_key === todayKey && e.mood_band).map(e => e.mood_band)
    )
    const eligible = archiveEntries.filter(e => {
      if (e.date_key === todayKey) return false
      const age = Math.round((today - new Date(e.date_key + 'T12:00:00')) / 86400000)
      return age >= exclusionDays && (e.entry || '').trim().length >= 20
    })
    const shuffle = arr => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }
    const matches = eligible.filter(e => e.mood_band && todayBands.has(e.mood_band))
    const others = eligible.filter(e => !e.mood_band || !todayBands.has(e.mood_band))
    setResurfacePool([
      ...shuffle(matches).map(e => ({ id: e.id, isMatch: true })),
      ...shuffle(others).map(e => ({ id: e.id, isMatch: false })),
    ])
    setResurfaceIdx(0)
  }, [archiveIdsKey, archiveLoaded])

  async function handleRetroTag(entryId, { needId, customLabel, moodBand, moodFeeling }) {
    const { error } = await updateJournalEntryTags(entryId, { needId, customLabel, moodBand, moodFeeling })
    if (!error) {
      const patch = e => e.id !== entryId ? e : {
        ...e,
        need_id:      needId      !== undefined ? needId      : e.need_id,
        custom:       customLabel !== undefined ? customLabel : e.custom,
        mood_band:    moodBand    !== undefined ? moodBand    : e.mood_band,
        mood_feeling: moodFeeling !== undefined ? moodFeeling : e.mood_feeling,
      }
      setArchiveEntries(prev => prev.map(patch))
      setJournalMeta(prev => prev.map(patch))
      // Close the panel only when feeling chosen, or for non-frequency tags
      if (moodBand === undefined || moodFeeling !== undefined) setTaggingEntryId(null)
    }
  }

  async function handleToggleFav(id, currentFav) {
    const newFav = !currentFav
    setArchiveEntries(prev => prev.map(e => e.id === id ? { ...e, favorite: newFav } : e))
    const { error } = await toggleJournalFavorite(id, newFav)
    if (error) setArchiveEntries(prev => prev.map(e => e.id === id ? { ...e, favorite: currentFav } : e))
  }

  async function handleToggleRevisit(id, currentRevisit) {
    const newRevisit = !currentRevisit
    setArchiveEntries(prev => prev.map(e => e.id === id ? { ...e, revisit: newRevisit } : e))
    const { error } = await toggleJournalRevisit(id, newRevisit)
    if (error) setArchiveEntries(prev => prev.map(e => e.id === id ? { ...e, revisit: currentRevisit } : e))
  }

  async function startReview() {
    setWeeklyMood(null)
    setNoteDraft('')
    setStepsCompletedCount(0)
    setExpandedReviewDay(null)
    setInsightText(null)
    setReviewStep(1)

    if (!state.userId) { console.error('[startReview] called without userId — session may be invalid'); setReviewStep(null); return }
    const cadence = state.reviewCadence || 'weekly'
    const days = reviewWindowKeys(cadence)
    setReviewWindowDays(days)

    setSkipDecisionSteps(false)

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
    const cadence = state.reviewCadence || 'weekly'
    const skip = cadence === 'daily' && skipDecisionSteps
    if (fromStep === 1 && skip) {
      if (insightText) { setReviewStep(4) } else { handleFinishReview() }
      return
    }
    if (fromStep === 3 && !insightText) {
      if (skip) { handleFinishReview(); return }
      setReviewStep(5); return
    }
    if (fromStep === 4) {
      if (skip) { handleFinishReview(); return }
      setReviewStep(5); return
    }
    setReviewStep(fromStep + 1)
  }

  function handleBack(fromStep) {
    const cadence = state.reviewCadence || 'weekly'
    if (fromStep === 1) { setReviewStep(null); return }
    if (fromStep === 4 && cadence === 'daily' && skipDecisionSteps) { setReviewStep(1); return }
    if (fromStep === 5 && !insightText) { setReviewStep(3); return }
    setReviewStep(fromStep - 1)
  }

  async function handleFinishReview() {
    setFinishing(true)
    if (!state.userId) { console.error('[handleFinishReview] called without userId — session may be invalid'); setFinishing(false); return }
    const trimmed = noteDraft.trim()
    if (trimmed) {
      await addNoteDeckCard(state.userId, { text: trimmed })
    }
    const cadence = state.reviewCadence || 'weekly'
    const windowStart = reviewWindowDays[0] || weekKey()
    await saveWeeklyReview(state.userId, {
      weekStarting: windowStart,
      weeklyMood,
      stepsCompleted: stepsCompletedCount + 1,
      reviewDate: new Date().toLocaleDateString('en-CA'),
      cadence,
    })
    setWeeklyReviews(prev => [...prev.filter(r => r.week_starting !== windowStart), { week_starting: windowStart, cadence }])
    setFinishing(false)
    setReviewStep(null)
    setJustFinished(true)
    setTimeout(() => setJustFinished(false), 3000)
  }

  async function selectDay(dateKey) {
    if (selectedDayKey === dateKey) { setSelectedDayKey(null); return }
    setSelectedDayKey(dateKey)
    setDetailCheckins([])
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)
    const cutoffKey = dateKeyFor(thirtyAgo)
    if (dateKey >= cutoffKey) { setDetailCheckins(state.checkins[dateKey] || []); return }
    if (calCheckinCache.current[dateKey] !== undefined) { setDetailCheckins(calCheckinCache.current[dateKey]); return }
    setDetailLoading(true)
    const data = await loadDayCheckins(state.userId, dateKey)
    calCheckinCache.current[dateKey] = data
    setDetailCheckins(data)
    setDetailLoading(false)
  }

  async function handlePracticeTap(p) {
    if (!editMode || !selectedDayKey) return
    const currentCheckins = detailCheckins
    const checkin = currentCheckins.find(c =>
      (c.practice_id && c.practice_id === p.id) ||
      (!c.practice_id && c.practice_text === p.label && c.need_id === p.need_id)
    )
    if (!checkin) {
      const modeName = state.canvas?.[p.need_id] || null
      const tempId = `pending_${Date.now()}_${Math.random()}`
      const completedAt = new Date().toISOString()
      const newEntry = { id: tempId, need_id: p.need_id, practice_text: p.label, practice_id: p.id || null, mode: modeName, completed_at: completedAt, count: 1 }
      const nextCheckins = [...currentCheckins, newEntry]
      setDetailCheckins(nextCheckins)
      calCheckinCache.current[selectedDayKey] = nextCheckins
      const { data, error } = await supabase.from('checkins')
        .insert({ user_id: state.userId, date_key: selectedDayKey, need_id: p.need_id, practice_text: p.label, practice_id: p.id || null, mode: modeName, completed_at: completedAt, count: 1 })
        .select('id').single()
      if (error) {
        setDetailCheckins(currentCheckins)
        calCheckinCache.current[selectedDayKey] = currentCheckins
      } else if (data) {
        const finalCheckins = nextCheckins.map(c => c.id === tempId ? { ...c, id: data.id } : c)
        setDetailCheckins(finalCheckins)
        calCheckinCache.current[selectedDayKey] = finalCheckins
        syncCheckinDay?.(selectedDayKey, finalCheckins)
      }
    } else if (checkin.count === 1) {
      const nextCheckins = currentCheckins.map(c => c.id === checkin.id ? { ...c, count: 2 } : c)
      setDetailCheckins(nextCheckins)
      calCheckinCache.current[selectedDayKey] = nextCheckins
      const { error } = await supabase.from('checkins').update({ count: 2 }).eq('id', checkin.id)
      if (error) {
        setDetailCheckins(currentCheckins)
        calCheckinCache.current[selectedDayKey] = currentCheckins
      } else {
        syncCheckinDay?.(selectedDayKey, nextCheckins)
      }
    } else {
      const nextCheckins = currentCheckins.filter(c => c.id !== checkin.id)
      setDetailCheckins(nextCheckins)
      calCheckinCache.current[selectedDayKey] = nextCheckins
      const { error } = await supabase.from('checkins').delete().eq('id', checkin.id)
      if (error) {
        setDetailCheckins(currentCheckins)
        calCheckinCache.current[selectedDayKey] = currentCheckins
      } else {
        syncCheckinDay?.(selectedDayKey, nextCheckins)
      }
    }
  }

  // ── Step 1: Last week's log ───────────────────────────────────────────────
  if (reviewStep === 1) {
    const days = [...reviewWindowDays].reverse()
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
              onClick={() => { hapticTick(); setWeeklyMood(opt.id) }}
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
    const isLastStep = (state.reviewCadence || 'weekly') === 'daily' && skipDecisionSteps
    return (
      <ReviewStepShell
        pct={REVIEW_PROGRESS[4]}
        eyebrow="STEP 4 OF 5 — INSIGHT"
        headline="one thing the data noticed."
        sub="from your practices, mood, and debriefs this week."
        onBack={() => handleBack(4)}
        onContinue={() => handleContinue(4)}
        continueLabel={isLastStep ? (finishing ? 'saving…' : 'finish review →') : undefined}
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
  const cadence = state.reviewCadence || 'weekly'
  const isScheduledDay = cadence === 'daily' || todayWeekdayMonday() === (state.reviewDay ?? 0)
  const periodAlreadyReviewed = weeklyReviews.some(r => r.week_starting === periodKey(cadence))
  const ritualDue = isScheduledDay && !ritualDismissed && !periodAlreadyReviewed && state.onboardedAt !== todayKey()

  const entryCount = journalMeta.length
  const needCount = journalMeta.filter(e => e.need_id).length
  const stateCount = journalMeta.filter(e => e.mood_feeling).length

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.headerBlock}>
        {justFinished && (
          <div className={styles.completeBanner}>
            {cadence === 'daily'
              ? 'review complete. see you tomorrow.'
              : `review complete. see you ${REVIEW_DAY_LABELS[state.reviewDay ?? 0]}.`}
          </div>
        )}

        <div className={styles.pageTitle}>drafts.</div>

        {ritualDue ? (
          <div className={styles.ritualDueCard}>
            <div className={styles.ritualEyebrow}>ready for you</div>
            <div className={styles.ritualHeadline}>
              {cadence === 'daily' ? "today's review is ready." : 'your week is ready to review.'}
            </div>
            <div className={styles.ritualMeta}>{ritualMetaLine(cadence)}</div>
            <div className={styles.ritualBtns}>
              <button className={styles.ritualStartBtn} onClick={startReview}>start the review</button>
              <button
                className={styles.ritualLaterBtn}
                onClick={() => {
                  try { localStorage.setItem('maslow_ritual_dismissed', new Date().toDateString()) } catch {}
                  setRitualDismissed(true)
                }}
              >later</button>
            </div>
          </div>
        ) : null}
        </div>
        <div className={styles.colLeft}>
        {/* ── Threads ── */}
        {archiveLoaded && (() => {
          const openThread = activeThreads.find(t => t.id === openThreadId) || null
          return (
            <div className={styles.threadSection}>
              <div className={styles.threadSectionHeader}>
                <span className={styles.threadSectionMeta}>most active threads · last 30 days</span>
              </div>
              {activeThreads.length === 0 ? (
                <p className={styles.threadInterpretive} style={{ fontStyle: 'italic' }}>threads appear as you write — entries from the last 30 days shape this list.</p>
              ) : (
                <ThreadTiles
                  threads={activeThreads}
                  openId={openThreadId}
                  onPick={id => setOpenThreadId(cur => cur === id ? null : id)}
                />
              )}
              {openThread && (() => {
                const openMatches = archiveEntries.filter(e => matchesPredicate(e, openThread.predicate))
                return (
                  <div key={openThread.id} className={styles.threadRead}>
                    <div className={styles.threadReadHeader}>
                      <span className={styles.threadReadTitle}>{openThread.title}</span>
                      <button className={styles.threadReadCloseBtn} onClick={() => setOpenThreadId(null)}>close</button>
                    </div>
                    <p className={styles.threadReadIntro}>{openThread.intro}</p>
                    {openMatches.length === 0 ? (
                      <p className={styles.threadReadEmpty}>nothing here yet.</p>
                    ) : (
                      openMatches.slice(0, threadVisible).map(e => {
                        const slotMood = e.slot && !e.state
                          ? normalizeBand((state.moods || []).find(m => m.date_key === e.date_key && m.prompt_time === e.slot)?.mood || null)
                          : null
                        const moodDotColor = slotMood ? MOOD_DOT_COLOR[slotMood] : null
                        return (
                          <div key={e.id} className={styles.threadReadEntry}>
                            <div className={styles.threadReadEntryDate}>
                              {moodDotColor && <span className={styles.threadReadEntryDot} style={{ background: moodDotColor }} />}
                              {formatThreadDate(e.date_key, e.slot)}
                            </div>
                            <div className={styles.threadReadEntryTags}>
                              {e.state && <span className={styles.threadReadTag}>{e.state}</span>}
                              {e.need_id && <span className={styles.threadReadTag}>{NEEDS.find(n => n.id === e.need_id)?.name || e.need_id}</span>}
                              {e.custom && <span className={styles.threadReadTag}>{e.custom}</span>}
                              <span className={styles.archiveCardMarks}>
                                <button
                                  className={`${styles.archiveRevisitBtn}${e.revisit ? ` ${styles.archiveRevisitBtnActive}` : ''}`}
                                  onClick={() => handleToggleRevisit(e.id, e.revisit)}
                                  aria-pressed={e.revisit}
                                >↩ revisit</button>
                                <button
                                  className={`${styles.archiveFavBtn}${e.favorite ? ` ${styles.archiveFavBtnActive}` : ''}`}
                                  onClick={() => handleToggleFav(e.id, e.favorite)}
                                  aria-pressed={e.favorite}
                                  aria-label={e.favorite ? 'remove from favorites' : 'add to favorites'}
                                >{e.favorite ? <IconHeartFilled size={15} stroke={1.5} /> : <IconHeart size={15} stroke={1.5} />}</button>
                              </span>
                            </div>
                            <p className={styles.threadReadEntryBody}>{e.entry}</p>
                          </div>
                        )
                      })
                    )}
                    {openMatches.length > threadVisible && (
                      <button className={styles.threadReadMore} onClick={() => setThreadVisible(v => v + 8)}>
                        show {Math.min(8, openMatches.length - threadVisible)} more · {openMatches.length - threadVisible} left
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })()}

        {/* ── Resurfacing ── */}
        {archiveLoaded && archiveEntries.length > 0 && archiveEntries.length < 10 && (
          <div className={styles.resurfaceSection}>
            <div className={styles.resurfaceSectionLabel}>Wild card</div>
              <div className={styles.resurfaceSectionSub}>a random day from the past</div>
            <div className={styles.resurfaceGrowth}>keep writing — your past will start speaking back soon.</div>
          </div>
        )}
        {archiveLoaded && resurfacePool.length > 0 && (() => {
          const poolItem = resurfacePool[resurfaceIdx % resurfacePool.length]
          const entry = archiveEntries.find(e => e.id === poolItem.id)
          if (!entry) return null
          const today = new Date(); today.setHours(12, 0, 0, 0)
          const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
          const [ey, em, ed] = entry.date_key.split('-').map(Number)
          const entryDateStr = new Date(ey, em - 1, ed).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
          const entryTags = [
            entry.slot ? { label: entry.slot, isState: false } : null,
            (entry.mood_feeling || entry.mood_band) ? { label: entry.mood_feeling || entry.mood_band, isState: false } : null,
            entry.need_id ? { label: NEEDS.find(n => n.id === entry.need_id)?.name || null, isState: false } : null,
            entry.custom ? { label: entry.custom, isState: false } : null,
          ].filter(t => t && t.label)
          return (
            <div className={styles.resurfaceSection}>
              <div className={styles.resurfaceSectionLabel}>Wild card</div>
              <div className={styles.resurfaceSectionSub}>a random day from the past</div>
              <div className={styles.resurfaceCard}>
                <div className={styles.resurfaceHeader}>
                  <span className={styles.resurfaceDate}>{entryDateStr}</span>
                  {entryTags.length > 0 && (
                    <span className={styles.resurfaceTagRow}>
                      {entryTags.map(t => (
                        <span key={t.label} className={styles.resurfaceTag}>{t.label}</span>
                      ))}
                    </span>
                  )}
                </div>
                <p className={styles.resurfaceBody}>{entry.entry}</p>
                <div className={styles.resurfaceMarks}>
                  <button
                    className={`${styles.archiveRevisitBtn}${entry.revisit ? ` ${styles.archiveRevisitBtnActive}` : ''}`}
                    onClick={() => handleToggleRevisit(entry.id, entry.revisit)}
                    aria-pressed={entry.revisit}
                  >↩ revisit</button>
                  <button
                    className={`${styles.archiveFavBtn}${entry.favorite ? ` ${styles.archiveFavBtnActive}` : ''}`}
                    onClick={() => handleToggleFav(entry.id, entry.favorite)}
                    aria-pressed={entry.favorite}
                    aria-label={entry.favorite ? 'remove from favorites' : 'add to favorites'}
                  >{entry.favorite ? <IconHeartFilled size={15} stroke={1.5} /> : <IconHeart size={15} stroke={1.5} />}</button>
                </div>
                <div className={styles.resurfaceFooter}>
                  <button
                    className={styles.resurfaceAnotherBtn}
                    onClick={() => setResurfaceIdx(i => (i + 1) % resurfacePool.length)}
                  >see another</button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Calendar ── */}
        {archiveLoaded && (() => {
          const today = new Date(); today.setHours(12, 0, 0, 0)
          const todayKey = dateKeyFor(today)
          const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth()
          const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
          const firstDayOfWeek = (new Date(calYear, calMonth, 1).getDay() + 6) % 7
          const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-`

          // every mood of the month, one per slot per day (state.moods is newest first, so the first wins)
          const monthMoodIndex = {}
          for (const m of (state.moods || [])) {
            if (!m.date_key.startsWith(monthPrefix)) continue
            const d = (monthMoodIndex[m.date_key] ||= {})
            if (!d[m.prompt_time]) d[m.prompt_time] = normalizeBand(m.mood)
          }
          const monthHasJournal = new Set(
            archiveEntries.filter(e => e.date_key.startsWith(monthPrefix)).map(e => e.date_key)
          )

          // Day detail derived data
          const detailMoods = selectedDayKey
            ? (state.moods || []).filter(m => m.date_key === selectedDayKey)
                .sort((a, b) => (SLOT_ORDER[a.prompt_time] || 0) - (SLOT_ORDER[b.prompt_time] || 0))
            : []
          const detailJournals = selectedDayKey
            ? archiveEntries.filter(e => e.date_key === selectedDayKey).slice().reverse()
            : []
          const canvasNeedIds = new Set(Object.keys(state.canvas || {}).filter(id => state.canvas[id]))
          const activePractices = (state.practicesDB || []).filter(p => !p.archived_at && canvasNeedIds.has(p.need_id))
          const findCheckin = p => detailCheckins.find(c =>
            (c.practice_id && c.practice_id === p.id) ||
            (!c.practice_id && c.practice_text === p.label && c.need_id === p.need_id)
          )
          const metCount = activePractices.filter(p => findCheckin(p)).length

          return (
            <div className={styles.calSection}>
              <span className={styles.calSectionLabel}>Your calendar</span>
              <div className={styles.calCard}>
                <div className={styles.calNavRow}>
                  <button
                    className={styles.calNavBtn}
                    onClick={() => {
                      if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
                      else setCalMonth(m => m - 1)
                      setSelectedDayKey(null)
                    }}
                    aria-label="previous month"
                  >‹</button>
                  <span className={styles.calNavMonthLabel}>{MONTHS_LONG[calMonth]} {calYear}</span>
                  <button
                    className={`${styles.calNavBtn}${isCurrentMonth ? ` ${styles.calNavBtnDisabled}` : ''}`}
                    disabled={isCurrentMonth}
                    onClick={() => {
                      if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
                      else setCalMonth(m => m + 1)
                      setSelectedDayKey(null)
                    }}
                    aria-label="next month"
                  >›</button>
                </div>

                <div className={styles.calDayLabels}>
                  {['m','t','w','t','f','s','s'].map((d, i) => (
                    <span key={i} className={styles.calDayLabel}>{d}</span>
                  ))}
                </div>

                <div className={styles.calGrid}>
                  {Array.from({ length: firstDayOfWeek }, (_, i) => (
                    <div key={`blank-${i}`} className={styles.calDayBlank} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const dateKey = `${monthPrefix}${String(day).padStart(2, '0')}`
                    const isFuture = dateKey > todayKey
                    const dayMoods = monthMoodIndex[dateKey]
                    const hasJournal = monthHasJournal.has(dateKey)
                    const hasData = !!(dayMoods || hasJournal)
                    const isSelected = selectedDayKey === dateKey
                    const isToday = dateKey === todayKey

                    if (isFuture) {
                      return (
                        <div key={dateKey} className={`${styles.calDay} ${styles.calDayFuture}`}>
                          <span className={styles.calDayNum}>{day}</span>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={dateKey}
                        className={`${styles.calDay}${isSelected ? ` ${styles.calDaySelected}` : ''}${isToday ? ` ${styles.calDayToday}` : ''}`}
                        onClick={() => selectDay(dateKey)}
                      >
                        <span className={`${styles.calDayNum}${!hasData ? ` ${styles.calDayNumMuted}` : ''}${hasJournal ? ` ${styles.calDayNumWritten}` : ''}`}>{day}</span>
                        <div className={styles.calDayDots}>
                          {MOOD_PERIODS.map(slot => dayMoods?.[slot]
                            ? <span key={slot} className={styles.calDayDot} style={{ background: MOOD_LIT[dayMoods[slot]] }} />
                            : <span key={slot} className={`${styles.calDayDot} ${styles.calDayDotOff}`} />)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedDayKey && (
                <div key={selectedDayKey} className={styles.calDetail}>
                  <div className={styles.calDetailHeader}>
                    <span className={styles.calDetailDate}>{formatDayDetailDate(selectedDayKey)}</span>
                    <div className={styles.calDetailHeaderBtns}>
                      {selectedDayKey <= todayKey && activePractices.length > 0 && (
                        <button
                          className={`${styles.calDetailEditBtn}${editMode ? ` ${styles.calDetailEditBtnActive}` : ''}`}
                          onClick={() => setEditMode(e => !e)}
                        >{editMode ? 'done' : 'edit this day'}</button>
                      )}
                      <button className={styles.calDetailCloseBtn} onClick={() => setSelectedDayKey(null)} aria-label="close">×</button>
                    </div>
                  </div>

                  {detailMoods.length > 0 && (
                    <div className={styles.calDetailMoodRow}>
                      {MOOD_PERIODS.map(slot => {
                        const m = detailMoods.find(x => x.prompt_time === slot)
                        const band = m ? normalizeBand(m.mood) : null
                        return (
                          <span key={slot} className={`${styles.calDetailMoodPair}${band ? '' : ` ${styles.calDetailMoodPairOff}`}`}>
                            <span className={styles.calDetailMoodDot} style={band ? { background: MOOD_LIT[band] } : undefined} />
                            <span className={styles.calDetailMoodLabel}>{slot}{band ? ` · ${BAND_LABEL[band]}${m.feeling ? `, ${m.feeling}` : ''}` : ''}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {activePractices.length > 0 && (
                    <div>
                      <div className={styles.calDetailSectionLabel}>
                        practices · {detailLoading ? '…' : `${metCount} of ${activePractices.length} met`}
                      </div>
                      {editMode && <div className={styles.calDetailEditHint}>tap a practice to log it, tap again for twice, once more to clear it.</div>}
                      {!detailLoading && metCount === 0 && !editMode && (
                        <p className={styles.calDetailEmpty}>no practices logged this day.</p>
                      )}
                      {!detailLoading && NEEDS.filter(n => activePractices.some(p => p.need_id === n.id)).map(n => {
                        const modeName = state.canvas?.[n.id] || null
                        const all = activePractices.filter(p => p.need_id === n.id)
                        const met = all.filter(p => findCheckin(p)).length
                        // read a day by what you did; edit it against everything you could have
                        const ps = editMode ? all : all.filter(p => findCheckin(p))
                        if (!ps.length) return null
                        return (
                          <div key={n.id} className={styles.calDetailNeed}>
                            <div className={styles.calDetailNeedHead}>
                              <span className={styles.calDetailNeedDot} style={{ background: modeName ? MODE_LIT[modeName] : 'var(--ink3)' }} />
                              <span className={styles.calDetailNeedName}>{n.name}</span>
                              <span className={styles.calDetailNeedCount}>{met} of {all.length}</span>
                            </div>
                            {ps.map(p => {
                              const checkin = findCheckin(p)
                              const isMet = !!checkin
                              const count = checkin?.count || 0
                              const Tag = editMode ? 'button' : 'div'
                              return (
                                <Tag
                                  key={p.id}
                                  className={`${styles.calDetailPracticeRow}${editMode ? ` ${styles.calDetailPracticeRowEditable}` : ''}${!isMet && !editMode ? ` ${styles.calDetailPracticeRowOff}` : ''}`}
                                  onClick={editMode ? () => handlePracticeTap(p) : undefined}
                                >
                                  <span
                                    className={styles.calDetailPracticeRing}
                                    style={isMet
                                      ? { background: modeName ? MODE_LIT[modeName] : 'var(--ink3)' }
                                      : { border: '1px solid rgba(0,0,0,.25)', background: 'transparent' }
                                    }
                                  />
                                  <span className={styles.calDetailPracticeName}>{p.label}</span>
                                  {count > 1 && <span className={styles.calDetailPracticeTimes}>×{count}</span>}
                                </Tag>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className={styles.calDetailSectionLabel}>journal</div>
                  {detailJournals.length > 0 ? detailJournals.map(e => {
                    const timeStr = `${e.slot ? `${e.slot} · ` : ''}${formatEntryTime(e.created_at)}`
                    const slotMood = e.slot && !e.state
                      ? normalizeBand(detailMoods.find(m => m.prompt_time === e.slot)?.mood || null)
                      : null
                    const entryMoodDotColor = slotMood ? MOOD_DOT_COLOR[slotMood] : null
                    const needName = e.need_id ? (NEEDS.find(n => n.id === e.need_id)?.name || e.need_id) : null
                    return (
                      <div key={e.id} className={styles.calDetailJournalEntry}>
                        <div className={styles.calDetailJournalMeta}>
                          {entryMoodDotColor && <span className={styles.calDetailJournalDot} style={{ background: entryMoodDotColor }} />}
                          <span>{timeStr}</span>
                        </div>
                        <p className={styles.calDetailJournalBody}>{e.entry}</p>
                        {(needName || e.state || e.custom) && (
                          <div className={styles.calDetailJournalTags}>
                            {e.state && <span className={styles.calDetailJournalTag}>{e.state}</span>}
                            {needName && <span className={styles.calDetailJournalTag}>{needName}</span>}
                            {e.custom && <span className={styles.calDetailJournalTag}>{e.custom}</span>}
                          </div>
                        )}
                      </div>
                    )
                  }) : (
                    <p className={styles.calDetailEmpty}>nothing written this day.</p>
                  )}
                </div>
              )}
            </div>
          )
        })()}
        </div>

        {/* ── Archive ── */}
        {(() => {
          const { canvasNeeds, slotCounts, needCounts, feelingCounts, allCustomLabels, customCounts, presetCounts, favCount, revisitCount } = archiveCounts
          const allJournalDays = archiveAllJournalDays
          const rangeLabel = rangeStart ? formatRangeLabel(rangeStart, rangeEnd) : null
          const filtered = archiveFiltered
          const anyFilter = filterFav || filterRevisit || filterSlot || filterNeed || filterFeeling || filterCustom || filterDate || rangeStart
          const visible = filtered.slice(0, archiveVisible)

          return (
            <div className={styles.archiveSection}>
              <div className={styles.archiveSectionHeader}>
                <span className={styles.archiveSectionLabel}>The archive</span>
              </div>

              {/* one row of facets; tap one to open its choices beneath */}
              {(() => {
                const feelingLabel = filterFeeling || null
                const needLabel = filterNeed ? (NEEDS.find(n => n.id === filterNeed)?.name || filterNeed) : null
                const facets = [
                  { key: 'slot', name: 'daypart', value: filterSlot, show: true },
                  { key: 'need', name: 'need', value: needLabel, show: canvasNeeds.length > 0 },
                  { key: 'feeling', name: 'vibrations', value: feelingLabel, show: true },
                  { key: 'custom', name: 'tags', value: filterCustom, show: allCustomLabels.length > 0 },
                ].filter(f => f.show)
                const chip = (active, onClick, text, cnt, key) => (
                  <button
                    key={key}
                    className={`${styles.facetChip} ${active ? styles.facetChipActive : ''}`}
                    disabled={cnt === 0 && !active}
                    onClick={onClick}
                  >{text}{cnt != null && <span className={styles.facetCount}>{cnt}</span>}</button>
                )
                return (
                  <div className={styles.facetBar}>
                    <div className={styles.facetRow}>
                      {ARCHIVE_DATE_PRESETS.map(r => chip(filterDate === r.key, () => {
                        setFilterDate(v => v === r.key ? null : r.key)
                        setRangeStart(null); setRangeEnd(null); setPickAnchor(null); setDatePickerOpen(false)
                        setArchiveVisible(ARCHIVE_PAGE_SIZE)
                      }, r.label, presetCounts[r.key], r.key))}
                      {chip(!!(rangeStart || datePickerOpen), () => {
                        setFilterDate(null)
                        if (datePickerOpen) { setDatePickerOpen(false); setPickAnchor(null) }
                        else setDatePickerOpen(true)
                        setArchiveVisible(ARCHIVE_PAGE_SIZE)
                      }, rangeStart ? rangeLabel : 'pick dates', null, 'range')}
                    </div>
                    {datePickerOpen && (
                      <div className={styles.facetPanel}>
                  {datePickerOpen && (() => {
                    const today = new Date(); today.setHours(12, 0, 0, 0)
                    const pickerPrefix = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-`
                    const daysInPicker = new Date(pickerYear, pickerMonth + 1, 0).getDate()
                    const firstDow = (new Date(pickerYear, pickerMonth, 1).getDay() + 6) % 7
                    const todayKey = dateKeyFor(today)
                    const earliestKey = archiveEntries.length > 0 ? archiveEntries[archiveEntries.length - 1].date_key : null
                    const minY = earliestKey ? parseInt(earliestKey.slice(0, 4)) : pickerYear
                    const minM = earliestKey ? parseInt(earliestKey.slice(5, 7)) - 1 : pickerMonth
                    const isPickerCurMonth = pickerYear === today.getFullYear() && pickerMonth === today.getMonth()
                    const isPickerMinMonth = pickerYear === minY && pickerMonth === minM
                    const appliedEnd = rangeEnd || rangeStart
                    return (
                      <div className={styles.datePicker}>
                        <div className={styles.datePickerNav}>
                          <button
                            className={styles.calNavBtn}
                            disabled={isPickerMinMonth}
                            onClick={() => {
                              if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11) }
                              else setPickerMonth(m => m - 1)
                            }}
                            aria-label="previous month"
                          >‹</button>
                          <span className={styles.calNavMonthLabel}>{MONTHS_LONG[pickerMonth]} {pickerYear}</span>
                          <button
                            className={styles.calNavBtn}
                            disabled={isPickerCurMonth}
                            onClick={() => {
                              if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0) }
                              else setPickerMonth(m => m + 1)
                            }}
                            aria-label="next month"
                          >›</button>
                        </div>
                        <div className={styles.calDayLabels}>
                          {['M','T','W','T','F','S','S'].map((dl, i) => <span key={i} className={styles.calDayLabel}>{dl}</span>)}
                        </div>
                        <div className={styles.calGrid}>
                          {Array.from({ length: firstDow }, (_, i) => <div key={`pb-${i}`} className={styles.calDayBlank} />)}
                          {Array.from({ length: daysInPicker }, (_, i) => {
                            const day = i + 1
                            const dk = `${pickerPrefix}${String(day).padStart(2, '0')}`
                            const isFuture = dk > todayKey
                            const hasJ = allJournalDays.has(dk)
                            const isSelected = dk === pickAnchor || (!pickAnchor && rangeStart && (dk === rangeStart || dk === appliedEnd))
                            const isInRange = !pickAnchor && rangeStart && appliedEnd && rangeStart !== appliedEnd && dk > rangeStart && dk < appliedEnd
                            if (isFuture) return (
                              <div key={dk} className={`${styles.calDay} ${styles.calDayFuture}`}>
                                <span className={styles.calDayNum}>{day}</span>
                              </div>
                            )
                            return (
                              <button
                                key={dk}
                                className={`${styles.calDay}${isSelected ? ` ${styles.pickerDaySelected}` : ''}${isInRange ? ` ${styles.pickerDayInRange}` : ''}`}
                                onClick={() => {
                                  if (!pickAnchor) {
                                    setPickAnchor(dk)
                                    setRangeStart(null); setRangeEnd(null)
                                    setFilterDate(null)
                                  } else {
                                    const [a, b] = pickAnchor <= dk ? [pickAnchor, dk] : [dk, pickAnchor]
                                    setRangeStart(a); setRangeEnd(b)
                                    setPickAnchor(null)
                                    setFilterDate(null)
                                    setArchiveVisible(ARCHIVE_PAGE_SIZE)
                                  }
                                }}
                              >
                                <span className={`${styles.calDayNum}${isSelected ? ` ${styles.pickerDayNum}` : ''}`}>{day}</span>
                                {hasJ && (
                                  <div className={styles.calDayDots}>
                                    <span className={styles.calDayDot} style={{ background: isSelected ? 'rgba(255,255,255,.55)' : 'var(--exploration)' }} />
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        <button className={styles.datePickerCloseBtn} onClick={() => { setDatePickerOpen(false); setPickAnchor(null) }}>close</button>
                      </div>
                    )
                  })()}
                      </div>
                    )}
                    {(favCount + revisitCount > 0 || filterFav || filterRevisit) && (
                      <div className={styles.facetRow}>
                        {chip(filterFav, () => { setFilterFav(v => !v); setArchiveVisible(ARCHIVE_PAGE_SIZE) }, <><IconHeartFilled size={12} stroke={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} />favorite</>, favCount, 'fav')}
                        {chip(filterRevisit, () => { setFilterRevisit(v => !v); setArchiveVisible(ARCHIVE_PAGE_SIZE) }, '↩ revisit', revisitCount, 'rev')}
                      </div>
                    )}
                    <div className={styles.facetRail}>
                      {facets.map(f => (
                        <button
                          key={f.key}
                          className={`${styles.facet}${f.value ? ` ${styles.facetSet}` : ''}${openFacet === f.key ? ` ${styles.facetOpen}` : ''}`}
                          onClick={() => setOpenFacet(o => o === f.key ? null : f.key)}
                        >
                          <span className={styles.facetName}>{f.name}</span>
                          {f.value && <span className={styles.facetValue}>{f.value}</span>}
                          <i className={styles.facetChev} aria-hidden="true" />
                        </button>
                      ))}
                      {anyFilter && (
                        <button className={styles.facetClear} onClick={() => { setFilterFav(false); setFilterRevisit(false); setFilterSlot(null); setFilterNeed(null); setFilterFeeling(null); setFilterCustom(null); setFilterDate(null); setRangeStart(null); setRangeEnd(null); setPickAnchor(null); setDatePickerOpen(false); setOpenFacet(null); setArchiveVisible(ARCHIVE_PAGE_SIZE) }}>clear</button>
                      )}
                    </div>

                    {openFacet === 'slot' && (
                      <div className={styles.facetPanel}>
                        {ARCHIVE_SLOTS.map(sl => chip(filterSlot === sl, () => { setFilterSlot(v => v === sl ? null : sl); setArchiveVisible(ARCHIVE_PAGE_SIZE) }, sl, slotCounts[sl], sl))}
                      </div>
                    )}
                    {openFacet === 'need' && (
                      <div className={styles.facetPanel}>
                        {canvasNeeds.map(n => chip(filterNeed === n.id, () => { setFilterNeed(v => v === n.id ? null : n.id); setArchiveVisible(ARCHIVE_PAGE_SIZE) },
                          <><span className={styles.facetDot} style={{ background: MODE_DOT_TOKEN[state.canvas?.[n.id]] || 'var(--ink)' }} />{n.name}</>, needCounts[n.id], n.id))}
                      </div>
                    )}
                    {openFacet === 'feeling' && (
                      <div className={styles.facetPanel}>
                        {BANDS.map(b => (
                          <div key={b} className={styles.facetBandRow}>
                            <span className={styles.facetBandName}>{BAND_LABEL[b]}</span>
                            {FEELINGS[b].map(f => chip(filterFeeling === f, () => { setFilterFeeling(v => v === f ? null : f); setArchiveVisible(ARCHIVE_PAGE_SIZE) }, f, feelingCounts[f], f))}
                          </div>
                        ))}
                      </div>
                    )}
                    {openFacet === 'custom' && (
                      <div className={styles.facetPanel}>
                        {allCustomLabels.map(label => chip(filterCustom === label, () => { setFilterCustom(v => v === label ? null : label); setArchiveVisible(ARCHIVE_PAGE_SIZE) }, label, customCounts[label], label))}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className={styles.archiveCards}>
                {visible.map(e => {
                    const slotMood = (e.slot && !e.mood_band)
                      ? normalizeBand((state.moods || []).find(m => m.date_key === e.date_key && m.prompt_time === e.slot)?.mood || null)
                      : null
                    const dotColor = slotMood ? MOOD_DOT_COLOR[slotMood] : null
                    const body = e.entry || ''
                    const isExpanded = expandedEntries.has(e.id)
                    const isTruncatable = body.length > JOURNAL_TRUNCATE
                    const displayBody = !isExpanded && isTruncatable ? body.slice(0, JOURNAL_TRUNCATE).trimEnd() + '…' : body
                    const needName = e.need_id ? (NEEDS.find(n => n.id === e.need_id)?.name || e.need_id) : null
                    const canAddNeed = !e.need_id && canvasNeeds.length > 0
                    const canAddFrequency = !e.mood_band
                    const canAddCustom = !e.custom && customTags.length > 0
                    const isTagging = taggingEntryId === e.id
                    const toggleExpand = () => setExpandedEntries(prev => {
                      const next = new Set(prev)
                      next.has(e.id) ? next.delete(e.id) : next.add(e.id)
                      return next
                    })
                    const missingCount = (canAddNeed ? 1 : 0) + (canAddFrequency ? 1 : 0) + (canAddCustom ? 1 : 0)
                    const panelLabel = missingCount > 1
                      ? 'add a tag to this entry'
                      : canAddNeed ? 'add a need to this entry'
                      : canAddFrequency ? 'add a vibration to this entry'
                      : 'add a custom tag to this entry'

                    return (
                      <div key={e.id} className={`${styles.archiveRow}${isTagging ? ` ${styles.archiveRowOpen}` : ''}`}>
                        <button className={styles.archiveCardInner} onClick={toggleExpand}>
                          <span className={styles.archiveCardMeta}>
                            {dotColor && <span className={styles.archiveCardDot} style={{ background: dotColor }} />}
                            <span className={styles.archiveCardDateSlot}>{formatArchiveDate(e.date_key)}{e.slot ? ` · ${e.slot}` : ''}</span>
                            <span className={styles.archiveCardTime}>{formatEntryTime(e.created_at)}</span>
                          </span>
                          {e.quoted_text && (
                            <JournalQuote
                              text={e.quoted_text}
                              dateLabel={formatArchiveDate(e.quoted_date)}
                              blockClass={styles.archiveQuoteBlock}
                              dateClass={styles.archiveQuoteLabel}
                              textClass={styles.archiveQuoteText}
                              readMoreClass={styles.archiveQuoteReadMore}
                            />
                          )}
                          <span className={styles.archiveCardBody}>{displayBody}</span>
                          {!isExpanded && isTruncatable && (
                            <span className={styles.archiveCardReadMore}>read more</span>
                          )}
                          {e.image_url && <img src={e.image_url} className={styles.archiveEntryImage} alt="" />}
                        </button>
                        <span className={styles.archiveCardTags}>
                          {(e.mood_feeling || e.mood_band) && <span className={styles.archiveTag}>{e.mood_feeling || BAND_LABEL[normalizeBand(e.mood_band)] || e.mood_band}</span>}
                          {needName && <span className={styles.archiveTag}>{needName}</span>}
                          {e.custom && <span className={styles.archiveTag}>{e.custom}</span>}
                          {(canAddNeed || canAddFrequency || canAddCustom) && (
                            <button
                              className={`${styles.archiveTagBtn} ${isTagging ? styles.archiveTagBtnOpen : ''}`}
                              onClick={() => setTaggingEntryId(id => id === e.id ? null : e.id)}
                            >+ tag</button>
                          )}
                          <span className={styles.archiveCardMarks}>
                            <button
                              className={`${styles.archiveRevisitBtn}${e.revisit ? ` ${styles.archiveRevisitBtnActive}` : ''}`}
                              onClick={() => handleToggleRevisit(e.id, e.revisit)}
                              aria-pressed={e.revisit}
                            >↩ revisit</button>
                            <button
                              className={`${styles.archiveFavBtn}${e.favorite ? ` ${styles.archiveFavBtnActive}` : ''}`}
                              onClick={() => handleToggleFav(e.id, e.favorite)}
                              aria-pressed={e.favorite}
                              aria-label={e.favorite ? 'remove from favorites' : 'add to favorites'}
                            >{e.favorite ? <IconHeartFilled size={15} stroke={1.5} /> : <IconHeart size={15} stroke={1.5} />}</button>
                          </span>
                        </span>
                        {isTagging && (
                          <div className={styles.retroTagPanel}>
                            <div className={styles.retroTagLabel}>{panelLabel}</div>
                            <div className={styles.retroTagOptions}>
                              {canAddNeed && canvasNeeds.map(n => (
                                <button key={n.id} className={styles.retroTagOption} onClick={() => handleRetroTag(e.id, { needId: n.id })}>
                                  {n.name}
                                </button>
                              ))}
                              {canAddFrequency && (
                                <FrequencyCard
                                  compact
                                  initialBand={e.mood_band || null}
                                  initialFeeling={e.mood_feeling || null}
                                  onSettle={(band, feeling) => handleRetroTag(e.id, { moodBand: band, moodFeeling: feeling || undefined })}
                                />
                              )}
                              {canAddCustom && customTags.map(t => (
                                <button key={t.id} className={styles.retroTagOption} onClick={() => handleRetroTag(e.id, { customLabel: t.label })}>
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                {filtered.length > archiveVisible && (
                  <div className={styles.archiveMoreRow}>
                    <button className={styles.archiveMoreBtn} onClick={() => setArchiveVisible(v => v + ARCHIVE_PAGE_SIZE)}>
                      {Math.min(ARCHIVE_PAGE_SIZE, filtered.length - archiveVisible) === 3 ? 'three more' : `${filtered.length - archiveVisible} more`}
                    </button>
                    <button className={styles.archiveMoreBtn} onClick={() => setArchiveVisible(filtered.length)}>
                      show all · {filtered.length}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
