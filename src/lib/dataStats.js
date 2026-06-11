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

export function createDataStats({ canvas, checkins, moods }) {
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

  return {
    isNeedMet,
    isDayHit,
    getStreak,
    getCompletion,
    getMoodMode,
    getNeedStats,
    getModeStats,
    getPattern,
  }
}
