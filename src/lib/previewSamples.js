/* Sample data for the greyed-out "to come" drawings new accounts see on the
   almanac and drafts screens. Made up, seeded (the same every time), and only
   ever drawn washed out behind a "to come" label — never mixed with real data
   and never saved. Shapes match what the real screens pass their charts. */

function rng(seed) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

const pad = n => String(n).padStart(2, '0')
const keyFor = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const SAMPLE_CANVAS = {
  play: 'exploration', thrill: 'exploration',
  beauty: 'appreciation', community: 'appreciation',
  movement: 'nourishment', reflection: 'nourishment',
  rest: 'survival', nutrition: 'survival',
}
const SAMPLE_PRACTICES = [
  ['play', 'make something with no point'], ['play', 'an hour of a game'],
  ['thrill', 'try a new route'], ['thrill', 'say yes to one odd thing'],
  ['beauty', 'sit with a view'], ['beauty', 'tidy one surface'],
  ['community', 'text a friend'], ['community', 'a real meal together'],
  ['movement', 'a long walk'], ['movement', 'stretch before bed'],
  ['reflection', 'ten minutes of writing'], ['reflection', 'review the day'],
  ['rest', 'lights out on time'], ['rest', 'a quiet half hour'],
  ['nutrition', 'a proper breakfast'], ['nutrition', 'water by noon'],
].map(([need_id, label], i) => ({ id: `sample-p${i}`, need_id, label }))

// how much each need lifts the day (the rest are noise)
const LIFT = { community: 0.3, movement: 0.24, play: 0.12, rest: 0.1 }
// and one practice that does most of the work for its need
const PRACTICE_LIFT = { 'sample-p6': 0.22, 'sample-p8': 0.12 }
const FEEL = {
  good: ['calm', 'curious', 'creative', 'confident'],
  mid: ['steady', 'flat', 'restless', 'braced'],
  bad: ['overwhelmed', 'apathetic', 'frenetic', 'small'],
}
const SLOTS = ['morning', 'afternoon', 'evening']

export function sampleAlmanacData(days = 56) {
  const rand = rng(20261007)
  const moods = [], checkins = {}
  const today = new Date(); today.setHours(12, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const dk = keyFor(d)
    const done = Object.keys(SAMPLE_CANVAS).filter(() => rand() < 0.5)
    checkins[dk] = done.map(need_id => {
      const ps = SAMPLE_PRACTICES.filter(p => p.need_id === need_id)
      const p = ps[Math.floor(rand() * ps.length)]
      return { id: `${dk}-${p.id}`, need_id, practice_id: p.id, practice_text: p.label, mode: SAMPLE_CANVAS[need_id], completed_at: `${dk}T10:00:00` }
    })
    const lift = done.reduce((s, n) => s + (LIFT[n] || 0), 0)
      + checkins[dk].reduce((s, c) => s + (PRACTICE_LIFT[c.practice_id] || 0), 0)
    const pGood = Math.min(0.85, 0.22 + lift), pBad = Math.max(0.05, 0.3 - lift * 0.7)
    SLOTS.forEach(slot => {
      const r = rand()
      const mood = r < pGood ? 'good' : r < pGood + (1 - pGood - pBad) ? 'mid' : 'bad'
      // lean on a couple of words per band so the rings come out uneven, like a real person's
      const words = FEEL[mood], pick = rand() < 0.55 ? 0 : Math.floor(rand() * 4)
      moods.push({ id: `${dk}-${slot}`, date_key: dk, prompt_time: slot, mood, feeling: words[pick] })
    })
  }
  return { moods, checkins, canvas: SAMPLE_CANVAS, practicesDB: SAMPLE_PRACTICES }
}

// stand-ins for the drafts screen's "most active threads" grid
export const SAMPLE_THREADS = [
  { id: 'sample:evening', label: 'evenings', windowCount: 12, band: 'mid', dim: 'slot' },
  { id: 'sample:calm', label: 'calm', windowCount: 10, band: 'good', dim: 'feeling' },
  { id: 'sample:reflection', label: 'reflection', windowCount: 9, band: null, dim: 'need', needId: 'reflection' },
  { id: 'sample:morning', label: 'mornings', windowCount: 8, band: 'good', dim: 'slot' },
  { id: 'sample:community', label: 'community', windowCount: 7, band: null, dim: 'need', needId: 'community' },
  { id: 'sample:small', label: 'small', windowCount: 6, band: 'bad', dim: 'feeling' },
]
