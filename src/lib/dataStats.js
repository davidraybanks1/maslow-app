import { NEEDS, LAYERS } from './constants'

const MOOD_RANK = { bad: 1, fine: 2, good: 3 }

function dateKeyFor(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// n date keys ending `offset` days before today (offset 0 = today is the last day)
function dayRange(n, offset = 0) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - offset - i)
    days.push(dateKeyFor(d))
  }
  return days
}

function addDays(dateKey, n) {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return dateKeyFor(d)
}

// Monday-first weekday index (0 = Monday … 6 = Sunday), matching LogCalendar
function weekdayIndex(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return (d.getDay() + 6) % 7
}

const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export function formatLastDone(days) {
  if (days === null) return 'never'
  if (days === 0) return 'today'
  return `${days}d ago`
}

export const GOING_WELL_MIN = 40

function requiredFor(canvas, needId) {
  return LAYERS[canvas[needId]]?.bubbles || 0
}

function completedFor(checkins, needId, dateKey) {
  const prefix = `${needId}_`
  return (checkins[dateKey] || []).filter(k => k.startsWith(prefix)).length
}

function dayCompletionPct(canvas, checkins, dateKey) {
  let totalRequired = 0
  let totalCompleted = 0
  for (const need of NEEDS) {
    if (canvas[need.id] === 'survival') continue
    const required = requiredFor(canvas, need.id)
    totalRequired += required
    totalCompleted += completedFor(checkins, need.id, dateKey)
  }
  return totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0
}

export function createDataStats({ canvas, checkins, moods, practices }) {
  function isNeedMet(need, dateKey) {
    const required = requiredFor(canvas, need.id)
    if (required < 1) return null
    return completedFor(checkins, need.id, dateKey) / required >= 0.5
  }

  function isDayHit(dateKey) {
    const eligible = NEEDS.filter(n => canvas[n.id] !== 'survival' && requiredFor(canvas, n.id) >= 1)
    if (eligible.length === 0) return false
    const met = eligible.filter(n => isNeedMet(n, dateKey)).length
    return met / eligible.length >= 0.5
  }

  function getStreak() {
    const cursor = new Date()
    if (!isDayHit(dateKeyFor(cursor))) cursor.setDate(cursor.getDate() - 1)
    let streak = 0
    while (isDayHit(dateKeyFor(cursor))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  }

  function getCompletion(rangeDays) {
    function totalsFor(days) {
      let totalRequired = 0
      let totalCompleted = 0
      for (const day of days) {
        for (const need of NEEDS) {
          if (canvas[need.id] === 'survival') continue
          const required = requiredFor(canvas, need.id)
          totalRequired += required
          totalCompleted += completedFor(checkins, need.id, day)
        }
      }
      return { totalRequired, totalCompleted }
    }

    const current = totalsFor(dayRange(rangeDays, 0))
    const prior = totalsFor(dayRange(rangeDays, rangeDays))
    const currentPct = current.totalRequired > 0 ? Math.round((current.totalCompleted / current.totalRequired) * 100) : 0
    const priorPct = prior.totalRequired > 0 ? Math.round((prior.totalCompleted / prior.totalRequired) * 100) : 0

    return { pct: currentPct, delta: currentPct - priorPct, done: current.totalCompleted, total: current.totalRequired }
  }

  function modeOfMoods(days) {
    const counts = { good: 0, fine: 0, bad: 0 }
    for (const m of moods) {
      if (days.includes(m.date_key) && counts[m.mood] !== undefined) counts[m.mood]++
    }
    let best = null
    for (const mood of ['good', 'fine', 'bad']) {
      if (counts[mood] > 0 && (best === null || counts[mood] > counts[best])) best = mood
    }
    return best
  }

  function getMoodMode(rangeDays) {
    const current = modeOfMoods(dayRange(rangeDays, 0))
    const prior = modeOfMoods(dayRange(rangeDays, rangeDays))
    let direction = null
    if (current && prior && current !== prior) {
      direction = MOOD_RANK[current] > MOOD_RANK[prior] ? 'up' : 'down'
    }
    return { mode: current, prior, direction }
  }

  function getNeedStats(rangeDays) {
    const periodDays = dayRange(rangeDays, 0)
    const referenceDays = dayRange(30, 0)

    function pctFor(needId, days) {
      const required = requiredFor(canvas, needId)
      if (required === 0) return 0
      let completed = 0
      for (const day of days) completed += completedFor(checkins, needId, day)
      return Math.min(100, Math.round((completed / (required * days.length)) * 100))
    }

    return NEEDS.filter(n => canvas[n.id] !== 'survival').map(need => {
      const required = requiredFor(canvas, need.id)
      const sparkline = periodDays.map(day => {
        if (required === 0) return 0
        return Math.min(100, (completedFor(checkins, need.id, day) / required) * 100)
      })
      return {
        need,
        mode: canvas[need.id],
        pct: pctFor(need.id, periodDays),
        referencePct: pctFor(need.id, referenceDays),
        sparkline,
      }
    })
  }

  function getModeStats(rangeDays) {
    const days = dayRange(rangeDays, 0)
    return ['purpose', 'appreciation', 'nourishment', 'survival'].map(mode => {
      if (mode === 'survival') return { mode, pct: null }
      const needsInMode = NEEDS.filter(n => canvas[n.id] === mode)
      const required = LAYERS[mode].bubbles
      if (needsInMode.length === 0 || required === 0) return { mode, pct: 0 }
      let completed = 0
      for (const day of days) {
        for (const need of needsInMode) completed += completedFor(checkins, need.id, day)
      }
      const total = required * needsInMode.length * days.length
      return { mode, pct: Math.min(100, Math.round((completed / total) * 100)) }
    })
  }

  function getPattern() {
    const days = dayRange(30, 0)
    const dayInfo = days.map(day => ({
      day,
      pct: dayCompletionPct(canvas, checkins, day),
      hasMood: moods.some(m => m.date_key === day),
      hasPractice: (checkins[day] || []).length > 0,
    }))

    const validDays = dayInfo.filter(d => d.hasMood && d.hasPractice)
    if (validDays.length < 14) return null

    const highBucket = validDays.filter(d => d.pct >= 80)
    const lowBucket = validDays.filter(d => d.pct < 50)
    if (highBucket.length < 3 || lowBucket.length < 3) return null

    function goodShare(bucket) {
      const bucketDays = bucket.map(d => d.day)
      const bucketMoods = moods.filter(m => bucketDays.includes(m.date_key))
      if (bucketMoods.length === 0) return 0
      return bucketMoods.filter(m => m.mood === 'good').length / bucketMoods.length
    }

    const highShare = goodShare(highBucket)
    const lowShare = goodShare(lowBucket)
    if (lowShare === 0) return null // avoid an Infinity/NaN ratio

    return highShare / lowShare
  }

  function getMoodByPeriod(rangeDays) {
    const days = dayRange(rangeDays, 0)
    const daysWithMood = days.filter(d => moods.some(m => m.date_key === d)).length
    if (daysWithMood < 7) return null

    function statsFor(period) {
      const ms = moods.filter(m => days.includes(m.date_key) && m.prompt_time === period)
      const total = ms.length
      const good = ms.filter(m => m.mood === 'good').length
      const fine = ms.filter(m => m.mood === 'fine').length
      const bad = ms.filter(m => m.mood === 'bad').length
      return {
        total, good, fine, bad,
        goodShare: total > 0 ? good / total : 0,
        fineShare: total > 0 ? fine / total : 0,
        badShare: total > 0 ? bad / total : 0,
      }
    }

    return {
      morning: statsFor('morning'),
      midday: statsFor('midday'),
      evening: statsFor('evening'),
    }
  }

  function getMoodByWeekday() {
    const days = dayRange(30, 0)
    const buckets = Array.from({ length: 7 }, () => [])
    for (const day of days) buckets[weekdayIndex(day)].push(day)

    const result = buckets.map((bucketDays, weekday) => {
      const sampleCount = bucketDays.filter(d => moods.some(m => m.date_key === d)).length
      const bucketMoods = moods.filter(m => bucketDays.includes(m.date_key))
      const total = bucketMoods.length
      const good = bucketMoods.filter(m => m.mood === 'good').length
      const fine = bucketMoods.filter(m => m.mood === 'fine').length
      const bad = bucketMoods.filter(m => m.mood === 'bad').length
      return {
        weekday,
        sampleCount,
        goodShare: total > 0 ? good / total : 0,
        fineShare: total > 0 ? fine / total : 0,
        badShare: total > 0 ? bad / total : 0,
      }
    })

    if (result.some(r => r.sampleCount < 3)) return null
    return result
  }

  function getNeedMoodLinks() {
    const days = dayRange(30, 0)
    const dayInfo = days.map(day => ({
      day,
      hasMood: moods.some(m => m.date_key === day),
      hasPractice: (checkins[day] || []).length > 0,
    }))
    const validDays = dayInfo.filter(d => d.hasMood && d.hasPractice).map(d => d.day)
    if (validDays.length < 14) return []

    function moodShare(dateKeys, promptTime, target) {
      const relevant = moods.filter(m => dateKeys.includes(m.date_key) && m.prompt_time === promptTime)
      if (relevant.length === 0) return 0
      return relevant.filter(m => m.mood === target).length / relevant.length
    }

    const candidates = []

    for (const need of NEEDS) {
      if (canvas[need.id] === 'survival') continue

      const metDays = validDays.filter(day => isNeedMet(need, day))
      const unmetDays = validDays.filter(day => !isNeedMet(need, day))
      if (metDays.length < 3 || unmetDays.length < 3) continue

      const flavors = [
        { daypart: 'evening', metKeys: metDays, unmetKeys: unmetDays },
        { daypart: 'morning', metKeys: metDays.map(d => addDays(d, 1)), unmetKeys: unmetDays.map(d => addDays(d, 1)) },
      ]

      for (const { daypart, metKeys, unmetKeys } of flavors) {
        const metGood = moodShare(metKeys, daypart, 'good')
        const unmetGood = moodShare(unmetKeys, daypart, 'good')
        const metBad = moodShare(metKeys, daypart, 'bad')
        const unmetBad = moodShare(unmetKeys, daypart, 'bad')

        if (unmetGood > 0) {
          const ratio = metGood / unmetGood
          if (ratio >= 1.5) candidates.push({ need, daypart, direction: 'met', ratio })
        }
        if (metBad > 0) {
          const ratio = unmetBad / metBad
          if (ratio >= 1.5) candidates.push({ need, daypart, direction: 'unmet', ratio })
        }
      }
    }

    candidates.sort((a, b) => b.ratio - a.ratio)
    return candidates.slice(0, 3)
  }

  function getTimeOfDaySummary(moodByPeriod) {
    if (!moodByPeriod) return null
    const { morning, midday, evening } = moodByPeriod
    const totalChange = (evening.goodShare - morning.goodShare) * 100

    if (morning.goodShare <= midday.goodShare && midday.goodShare <= evening.goodShare && totalChange >= 10) {
      return 'your days tend to get better as they go.'
    }
    if (morning.goodShare >= midday.goodShare && midday.goodShare >= evening.goodShare && -totalChange >= 10) {
      return 'your days start strong and fade.'
    }
    return null
  }

  function getWeekdaySummary(moodByWeekday) {
    if (!moodByWeekday) return null
    const avg = moodByWeekday.reduce((s, d) => s + d.goodShare, 0) / moodByWeekday.length
    const qualifying = moodByWeekday.filter(d => (avg - d.goodShare) * 100 >= 15)
    if (qualifying.length === 0 || qualifying.length >= 3) return null

    const names = qualifying.map(d => `${WEEKDAY_NAMES[d.weekday]}s`)
    return `${names.join(' and ')} run harder than the rest of your week.`
  }

  function getPracticeStats() {
    const days = dayRange(30, 0)
    const result = []

    for (const need of NEEDS) {
      if (canvas[need.id] === 'survival') continue
      const pool = (practices && practices[need.id]) || []

      for (const text of pool) {
        const key = `${need.id}_${text}`
        let completedDays = 0
        let daysSinceLast = null

        for (let i = days.length - 1; i >= 0; i--) {
          if ((checkins[days[i]] || []).includes(key)) {
            completedDays++
            if (daysSinceLast === null) daysSinceLast = days.length - 1 - i
          }
        }

        result.push({
          need,
          text,
          mode: canvas[need.id],
          completionPct: Math.round((completedDays / days.length) * 100),
          daysSinceLast,
        })
      }
    }

    return result
  }

  function getGoingWell() {
    const candidates = getPracticeStats().filter(p =>
      p.completionPct >= GOING_WELL_MIN && p.daysSinceLast !== null && p.daysSinceLast <= 7
    )
    if (candidates.length === 0) return null
    return [...candidates].sort((a, b) => b.completionPct - a.completionPct).slice(0, 3)
  }

  function getCompletionByWeekday() {
    const days = dayRange(30, 0)
    const buckets = Array.from({ length: 7 }, () => [])
    for (const day of days) buckets[weekdayIndex(day)].push(day)

    const result = buckets.map((bucketDays, weekday) => {
      const sampleCount = bucketDays.filter(d => (checkins[d] || []).length > 0).length
      const pct = bucketDays.length > 0
        ? Math.round(bucketDays.reduce((s, d) => s + dayCompletionPct(canvas, checkins, d), 0) / bucketDays.length)
        : 0
      return { weekday, pct, sampleCount }
    })

    if (result.some(r => r.sampleCount < 3)) return null
    return result
  }

  return {
    isNeedMet,
    isDayHit,
    getStreak,
    getCompletion,
    getMoodMode,
    getNeedStats,
    getModeStats,
    getPattern,
    getMoodByPeriod,
    getMoodByWeekday,
    getNeedMoodLinks,
    getTimeOfDaySummary,
    getWeekdaySummary,
    getPracticeStats,
    getGoingWell,
    getCompletionByWeekday,
  }
}
