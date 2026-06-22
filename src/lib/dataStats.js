import { NEEDS, MODES, MODE_ORDER } from './constants'
import { parseDebriefEntry } from './debriefTypes'

const MOOD_RANK = { bad: 1, fine: 2, good: 3 }

export const DEBRIEF_NATURE_COLORS = { frenetic: '#D93B1C', overwhelm: '#E8B81F', apathy: '#B8C3B1' }
export const DEBRIEF_PEAK_COLORS = { confident: '#1B3A2D', creative: '#E8B81F', curious: '#B8C3B1' }
export const DEBRIEF_ENVIRONMENT_COLORS = { work: '#1A1A1A', home: '#B8C3B1', social: '#7A8FA6', personal: '#E8B81F' }
const DEBRIEF_DEFAULT_COLOR = '#999999'

function countByField(items, field, colorMap) {
  const counts = new Map()
  for (const item of items) {
    counts.set(item[field], (counts.get(item[field]) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, color: colorMap[name] || DEBRIEF_DEFAULT_COLOR }))
    .sort((a, b) => b.count - a.count)
}

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

// Monday-first weekday index (0 = Monday … 6 = Sunday)
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

// A need is required on a given day when it has any mode assigned (not null)
function requiredFor(canvas, needId) {
  return canvas[needId] ? 1 : 0
}

function completedFor(checkins, needId, dateKey) {
  const prefix = `${needId}_`
  return (checkins[dateKey] || []).filter(k => k.startsWith(prefix)).length
}

function dayCompletionPct(canvas, checkins, dateKey) {
  let totalRequired = 0
  let totalCompleted = 0
  for (const need of NEEDS) {
    if (!canvas[need.id]) continue
    totalRequired++
    totalCompleted += Math.min(completedFor(checkins, need.id, dateKey), 1)
  }
  return totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0
}

function hasCheckinData(checkins, dateKey) {
  return Array.isArray(checkins[dateKey]) && checkins[dateKey].length > 0
}

function isStreakDay(canvas, checkins, dateKey) {
  const eligible = NEEDS.filter(n => canvas[n.id] && canvas[n.id] !== 'survival')
  if (eligible.length === 0) return false
  const met = eligible.filter(n => completedFor(checkins, n.id, dateKey) > 0).length
  return met / eligible.length >= 0.5
}

// 'grow' — 14/14 days hit the streak threshold; 'simplify' — fewer than 2 consecutive
// streak days in the last week; null — neither, or under 14 days of check-in history.
export function getCanvasGuidance(checkins, canvas) {
  const last14 = dayRange(14, 0)
  const daysWithData = last14.filter(d => hasCheckinData(checkins, d)).length
  if (daysWithData < 14) return null

  if (last14.every(d => isStreakDay(canvas, checkins, d))) return 'grow'

  const last7 = dayRange(7, 0)
  let consecutive = 0
  let maxConsecutive = 0
  for (const d of last7) {
    consecutive = isStreakDay(canvas, checkins, d) ? consecutive + 1 : 0
    maxConsecutive = Math.max(maxConsecutive, consecutive)
  }
  if (maxConsecutive < 2) return 'simplify'

  return null
}

export function createDataStats({ canvas, checkins, moods, practices }) {
  function isNeedMet(need, dateKey) {
    const required = requiredFor(canvas, need.id)
    if (required < 1) return null
    return completedFor(checkins, need.id, dateKey) >= 1
  }

  function isDayHit(dateKey) {
    const eligible = NEEDS.filter(n => canvas[n.id])
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
          if (!canvas[need.id]) continue
          totalRequired++
          totalCompleted += Math.min(completedFor(checkins, need.id, day), 1)
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
      if (!canvas[needId]) return 0
      let completed = 0
      for (const day of days) {
        if (completedFor(checkins, needId, day) > 0) completed++
      }
      return Math.round((completed / days.length) * 100)
    }

    return NEEDS.filter(n => canvas[n.id]).map(need => {
      const sparkline = periodDays.map(day =>
        completedFor(checkins, need.id, day) > 0 ? 100 : 0
      )
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
    return MODE_ORDER.map(mode => {
      const needsInMode = NEEDS.filter(n => canvas[n.id] === mode)
      if (needsInMode.length === 0) return { mode, pct: 0 }
      let completed = 0
      for (const day of days) {
        for (const need of needsInMode) {
          if (completedFor(checkins, need.id, day) > 0) completed++
        }
      }
      const total = needsInMode.length * days.length
      return { mode, pct: Math.round((completed / total) * 100) }
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
    if (lowShare === 0) return null

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
      if (!canvas[need.id]) continue

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
      if (!canvas[need.id]) continue
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

  function getDebriefStats(debriefs) {
    const list = debriefs || []
    const anxietyDebriefs = list.filter(d => d.type === 'anxiety' || !d.type)
    const peakDebriefs = list.filter(d => d.type === 'peak')

    const byNatureAnxiety = countByField(anxietyDebriefs, 'nature', DEBRIEF_NATURE_COLORS)
    const byTypePeak = countByField(peakDebriefs, 'nature', DEBRIEF_PEAK_COLORS)
    const byEnvironment = countByField(list, 'environment', DEBRIEF_ENVIRONMENT_COLORS)

    function findPattern(episodes, metValue, sentence) {
      if (episodes.length < 3) return null
      const byType = countByField(episodes, 'nature', {})
      if (byType.length === 0) return null
      const domType = byType[0].name
      const typeEpisodes = episodes.filter(d => d.nature === domType)
      if (typeEpisodes.length < 3) return null
      const domEnvironment = countByField(typeEpisodes, 'environment', {})[0].name
      const subset = typeEpisodes.filter(d => d.environment === domEnvironment)

      let domNeed = null
      let domNeedCount = 0
      for (const need of NEEDS) {
        if (!canvas[need.id]) continue
        const count = subset.filter(d => isNeedMet(need, d.date_key) === metValue).length
        if (count > domNeedCount) { domNeedCount = count; domNeed = need }
      }
      if (!domNeed) return null
      return sentence({ domType, domEnvironment, domNeed, count: typeEpisodes.length, matchCount: domNeedCount })
    }

    const patternAnxiety = findPattern(anxietyDebriefs, false, ({ domType, domEnvironment, domNeed, count, matchCount }) =>
      `${matchCount} of your ${count} ${domType} episodes happened at ${domEnvironment} on days when ${domNeed.name.toLowerCase()} went unmet.`
    )

    const patternPeak = findPattern(peakDebriefs, true, ({ domEnvironment, domNeed }) =>
      `most peak moments happen when ${domEnvironment} on days when ${domNeed.name.toLowerCase()} was completed.`
    )

    const recentEpisodes = list.slice(0, 10).map(d => {
      const isPeak = d.type === 'peak'
      const { sections, isLegacy } = parseDebriefEntry(d.entry, isPeak)
      const excerptSource = isLegacy ? (d.entry || '') : sections[0]
      return {
        date: d.date_key,
        type: d.type || 'anxiety',
        nature: d.nature,
        environment: d.environment,
        excerpt: excerptSource.slice(0, 80),
      }
    })

    return { byNatureAnxiety, byTypePeak, byEnvironment, patternAnxiety, patternPeak, recentEpisodes }
  }

  function getLiveCanvas(rangeDays) {
    const days = dayRange(rangeDays, 0)
    const MODE_THRESHOLDS = { exploration: 80, appreciation: 60, nourishment: 50, survival: 20 }
    const MODE_COLORS = { exploration: '#1B3A2D', appreciation: '#B8C3B1', nourishment: '#E8B81F', survival: '#D93B1C' }

    const activeNeeds = NEEDS.filter(n => canvas[n.id])
    const totalDays = activeNeeds.length * days.length
    let totalCompleted = 0

    const needRows = activeNeeds.map(need => {
      let completed = 0
      for (const day of days) {
        if (completedFor(checkins, need.id, day) > 0) completed++
      }
      totalCompleted += completed
      const mode = canvas[need.id]
      return {
        needId: need.id,
        name: need.name,
        mode,
        modeColor: MODE_COLORS[mode] || '#999',
        pace: days.length > 0 ? Math.round((completed / days.length) * 100) : 0,
        target: MODE_THRESHOLDS[mode] || 50,
      }
    }).sort((a, b) => b.pace - a.pace)

    const overallPace = totalDays > 0 ? Math.round((totalCompleted / totalDays) * 100) : 0
    const canvasTarget = activeNeeds.length > 0
      ? Math.round(activeNeeds.reduce((s, n) => s + (MODE_THRESHOLDS[canvas[n.id]] || 50), 0) / activeNeeds.length)
      : 50

    return { overallPace, canvasTarget, needRows, survivalNeeds: [] }
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
    getDebriefStats,
    getLiveCanvas,
  }
}
