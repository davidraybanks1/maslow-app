import { chromium } from 'playwright'

const SCRATCHPAD = '/private/tmp/claude-501/-Users-davidbanks-Desktop-maslow-app/a323f211-06ca-433d-a25e-10ab2987a317/scratchpad'
const BASE = 'http://localhost:4210'

const PRACTICES_DB = [
  { id: 'p-walk',    label: 'Walk',       need_id: 'movement',   archived_at: null, reminder_on: false, reminder_time: null,    reminder_offered_at: null },
  { id: 'p-run',     label: 'Run',        need_id: 'movement',   archived_at: null, reminder_on: false, reminder_time: null,    reminder_offered_at: null },
  { id: 'p-sleep',   label: '7 hours',    need_id: 'rest',       archived_at: null, reminder_on: false, reminder_time: null,    reminder_offered_at: null },
  { id: 'p-journal', label: 'Journal',    need_id: 'reflection', archived_at: null, reminder_on: false, reminder_time: null,    reminder_offered_at: null },
  { id: 'p-text',    label: 'Text friend',need_id: 'community',  archived_at: null, reminder_on: false, reminder_time: null,    reminder_offered_at: null },
]
const CANVAS = { movement: 'exploration', rest: 'nourishment', reflection: 'appreciation', community: 'nourishment' }

function makeDate(daysAgo) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function checkins() {
  const c = {}
  for (let ago = 0; ago < 14; ago++) {
    const dk = makeDate(ago)
    c[dk] = PRACTICES_DB.map(p => ({ need_id: p.need_id, practice_id: p.id, practice_text: p.label }))
  }
  return c
}

function baseState(extra = {}) {
  return JSON.stringify({
    _version: 2,
    userId: 'test-user', email: 'test@test.com',
    onboarded: true, onboardedAt: makeDate(30),
    canvas: CANVAS,
    practices: { movement: ['Walk','Run'], rest: ['7 hours'], reflection: ['Journal'], community: ['Text friend'] },
    practicesDB: PRACTICES_DB.map(p => ({ ...p, ...extra.practiceOverrides?.[p.id] })),
    checkins: checkins(),
    moods: [], profile: { name: '' },
    remindersEnabled: true,
    reviewReminderEnabled: true,
    reviewCadence: 'weekly',
    reviewDay: 0,
    reviewTime: '10:00',
    moodReminders: { morning: { on: true, time: '09:00' }, midday: { on: true, time: '13:00' }, evening: { on: false, time: '19:00' } },
    notifPrimedAt: new Date().toISOString(),
    tourSeenAt: new Date().toISOString(),
    ...extra,
  })
}

const scenarios = [
  {
    label: 'none',
    description: 'No reminders set — all practices show "remind me"',
    state: baseState(),
  },
  {
    label: 'one',
    description: 'One reminder on (Walk @ 08:30)',
    state: baseState({ practiceOverrides: { 'p-walk': { reminder_on: true, reminder_time: '08:30' } } }),
  },
  {
    label: 'three',
    description: 'Three reminders on — fourth practice should be disabled',
    state: baseState({
      practiceOverrides: {
        'p-walk':    { reminder_on: true, reminder_time: '07:00' },
        'p-run':     { reminder_on: true, reminder_time: '08:00' },
        'p-sleep':   { reminder_on: true, reminder_time: '22:00' },
      }
    }),
  },
]

const browser = await chromium.launch()

for (const scenario of scenarios) {
  const page = await browser.newPage()
  await page.addInitScript(() => { window.__nativeForTest = true; window.__nativePermForTest = 'granted' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(BASE)
  await page.evaluate(state => {
    localStorage.setItem('maslow_state', state)
    localStorage.setItem('maslow_last_ritual', new Date().toDateString())
  }, scenario.state)
  await page.goto(`${BASE}/practices`)
  await page.waitForTimeout(1000)

  const shot = `${SCRATCHPAD}/prac_${scenario.label}.png`
  await page.screenshot({ path: shot, fullPage: false })

  const info = await page.evaluate(() => {
    const remindMeBtns = document.querySelectorAll('[class*="reminderOffBtn"]')
    const cappedMsgs   = document.querySelectorAll('[class*="reminderCapped"]')
    const onToggles    = document.querySelectorAll('[class*="rTrackOn"]')
    return {
      remindMeCount: remindMeBtns.length,
      cappedCount: cappedMsgs.length,
      onToggleCount: onToggles.length,
    }
  })

  console.log(`\n[${scenario.label}] ${scenario.description}`)
  console.log(`  remindMe: ${info.remindMeCount}  capped: ${info.cappedCount}  onToggle: ${info.onToggleCount}`)
  console.log(`  screenshot: ${shot}`)
  await page.close()
}

// Picker open: take a shot of the "one" state with the time input focused
const pickerPage = await browser.newPage()
await pickerPage.addInitScript(() => { window.__nativeForTest = true; window.__nativePermForTest = 'granted' })
await pickerPage.setViewportSize({ width: 390, height: 844 })
await pickerPage.goto(BASE)
const oneState = baseState({ practiceOverrides: { 'p-walk': { reminder_on: true, reminder_time: '08:30' } } })
await pickerPage.evaluate(state => {
  localStorage.setItem('maslow_state', state)
  localStorage.setItem('maslow_last_ritual', new Date().toDateString())
}, oneState)
await pickerPage.goto(`${BASE}/practices`)
await pickerPage.waitForTimeout(1000)
// Focus the time input
await pickerPage.evaluate(() => {
  const input = document.querySelector('input[type="time"]')
  if (input) input.focus()
})
await pickerPage.waitForTimeout(300)
const pickerShot = `${SCRATCHPAD}/prac_picker.png`
await pickerPage.screenshot({ path: pickerShot, fullPage: false })
const pickerInfo = await pickerPage.evaluate(() => {
  const takenEl = document.querySelector('[class*="reminderTaken"]')
  return { takenText: takenEl?.textContent ?? '(none)' }
})
console.log(`\n[picker] Picker open — taken times row`)
console.log(`  taken text: "${pickerInfo.takenText}"`)
console.log(`  screenshot: ${pickerShot}`)
await pickerPage.close()

await browser.close()
