import { chromium } from 'playwright'

const SCRATCHPAD = '/private/tmp/claude-501/-Users-davidbanks-Desktop-maslow-app/a323f211-06ca-433d-a25e-10ab2987a317/scratchpad'
const BASE = 'http://localhost:4210'

const PRACTICES_DB = [
  { id: 'p-walk',    label: 'Walk',       need_id: 'movement',   archived_at: null, reminder_on: false, reminder_time: null, reminder_offered_at: null },
  { id: 'p-run',     label: 'Run',        need_id: 'movement',   archived_at: null, reminder_on: false, reminder_time: null, reminder_offered_at: null },
  { id: 'p-sleep',   label: '7 hours',   need_id: 'rest',       archived_at: null, reminder_on: false, reminder_time: null, reminder_offered_at: null },
  { id: 'p-journal', label: 'Journal',    need_id: 'reflection', archived_at: null, reminder_on: false, reminder_time: null, reminder_offered_at: null },
]
const CANVAS = { movement: 'exploration', rest: 'nourishment', reflection: 'appreciation' }

function makeDate(daysAgo) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Build checkins: practiceIds mapped to count-many distinct days
function buildCheckins(checkinSpec) {
  // checkinSpec: [{ id, count }]
  const c = {}
  let dayOffset = 0
  for (const { id, count } of checkinSpec) {
    for (let i = 0; i < count; i++) {
      const dk = makeDate(dayOffset + i)
      if (!c[dk]) c[dk] = []
      const p = PRACTICES_DB.find(x => x.id === id)
      c[dk].push({ need_id: p.need_id, practice_id: p.id, practice_text: p.label })
    }
    dayOffset += count
  }
  return c
}

function baseState(checkins, extra = {}) {
  const practicesDB = PRACTICES_DB.map(p => ({ ...p, ...((extra.practiceOverrides || {})[p.id] || {}) }))
  return JSON.stringify({
    _version: 2,
    userId: 'test-user', email: 'test@test.com',
    onboarded: true, onboardedAt: makeDate(60),
    canvas: CANVAS,
    practices: { movement: ['Walk', 'Run'], rest: ['7 hours'], reflection: ['Journal'] },
    practicesDB,
    checkins,
    moods: [], profile: { name: '' },
    remindersEnabled: true,
    reminderOffersDeclined: extra.reminderOffersDeclined ?? 0,
    reviewReminderEnabled: false,
    reviewCadence: 'weekly', reviewDay: 0, reviewTime: '10:00',
    moodReminders: { morning: { on: false }, midday: { on: false }, evening: { on: false } },
    notifPrimedAt: new Date().toISOString(),
    tourSeenAt: new Date().toISOString(),
  })
}

const scenarios = [
  {
    label: 'case1_2checkins',
    description: 'Case 1: 2 check-ins — no offer (threshold is 3)',
    state: baseState(buildCheckins([{ id: 'p-walk', count: 2 }])),
  },
  {
    label: 'case2_3checkins',
    description: 'Case 2: 3 check-ins — offer appears on Walk',
    state: baseState(buildCheckins([{ id: 'p-walk', count: 3 }])),
  },
  {
    label: 'case3_two_qualify',
    description: 'Case 3: Walk=5, Run=3 both qualify — only Walk (most-logged) gets offer',
    state: baseState(buildCheckins([{ id: 'p-walk', count: 5 }, { id: 'p-run', count: 3 }])),
  },
  {
    label: 'case4_declined_once',
    description: 'Case 4: declined=1, one practice offered_at stamped — offer gone for Walk, Run gets it',
    state: baseState(
      buildCheckins([{ id: 'p-walk', count: 5 }, { id: 'p-run', count: 3 }]),
      {
        reminderOffersDeclined: 1,
        practiceOverrides: { 'p-walk': { reminder_offered_at: new Date().toISOString() } },
      }
    ),
  },
  {
    label: 'case5_declined_twice',
    description: 'Case 5: declined=2 — brake fires, no offer at all',
    state: baseState(
      buildCheckins([{ id: 'p-walk', count: 5 }, { id: 'p-run', count: 3 }]),
      { reminderOffersDeclined: 2 }
    ),
  },
  {
    label: 'case6_third_qualifying_declined2',
    description: 'Case 6 (crucial): declined=2, fresh practice with 4 check-ins — brake blocks it',
    state: baseState(
      buildCheckins([{ id: 'p-sleep', count: 4 }]),
      {
        reminderOffersDeclined: 2,
        practiceOverrides: {
          'p-walk': { reminder_offered_at: new Date().toISOString() },
          'p-run':  { reminder_offered_at: new Date().toISOString() },
        },
      }
    ),
  },
  {
    label: 'case7_three_reminders_on',
    description: 'Case 7: 3 reminders already on — no offer even with qualified practices',
    state: baseState(
      buildCheckins([{ id: 'p-journal', count: 5 }]),
      {
        practiceOverrides: {
          'p-walk':  { reminder_on: true, reminder_time: '07:00' },
          'p-run':   { reminder_on: true, reminder_time: '08:00' },
          'p-sleep': { reminder_on: true, reminder_time: '22:00' },
        },
      }
    ),
  },
  {
    label: 'case8_accept',
    description: 'Case 8: offer present — verify DOM structure before accepting',
    state: baseState(buildCheckins([{ id: 'p-walk', count: 4 }])),
  },
]

const browser = await chromium.launch()

for (const scenario of scenarios) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.__nativeForTest = true; window.__nativePermForTest = 'granted' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(BASE)
  await page.evaluate(state => {
    localStorage.setItem('maslow_state', state)
    localStorage.setItem('maslow_last_ritual', new Date().toDateString())
  }, scenario.state)
  await page.goto(`${BASE}/practices`)
  await page.waitForTimeout(800)

  const info = await page.evaluate(() => {
    const offerRows   = document.querySelectorAll('[class*="offerRow"]')
    const offerCopies = document.querySelectorAll('[class*="offerCopy"]')
    const setTimeBtns = document.querySelectorAll('[class*="offerSetTime"]')
    const notNowBtns  = document.querySelectorAll('[class*="offerNotNow"]')
    const remindMes   = document.querySelectorAll('[class*="reminderOffBtn"]')
    return {
      offerCount: offerRows.length,
      copyText: offerCopies[0]?.textContent ?? '(none)',
      setTimeBtns: setTimeBtns.length,
      notNowBtns: notNowBtns.length,
      remindMeCount: remindMes.length,
    }
  })

  const shot = `${SCRATCHPAD}/offer_${scenario.label}.png`
  await page.screenshot({ path: shot, fullPage: false })

  const ok = (() => {
    if (scenario.label === 'case1_2checkins')          return info.offerCount === 0
    if (scenario.label === 'case2_3checkins')          return info.offerCount === 1
    if (scenario.label === 'case3_two_qualify')        return info.offerCount === 1
    if (scenario.label === 'case4_declined_once')      return info.offerCount === 1
    if (scenario.label === 'case5_declined_twice')     return info.offerCount === 0
    if (scenario.label === 'case6_third_qualifying_declined2') return info.offerCount === 0
    if (scenario.label === 'case7_three_reminders_on') return info.offerCount === 0
    if (scenario.label === 'case8_accept')             return info.offerCount === 1 && info.setTimeBtns === 1 && info.notNowBtns === 1
    return false
  })()

  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${scenario.label}`)
  console.log(`  ${scenario.description}`)
  console.log(`  offers: ${info.offerCount}  setTime: ${info.setTimeBtns}  notNow: ${info.notNowBtns}  remindMe: ${info.remindMeCount}  copy: "${info.copyText}"`)
  console.log(`  screenshot: ${shot}`)

  await page.close()
  await ctx.close()
}

await browser.close()
console.log('\nDone.')
