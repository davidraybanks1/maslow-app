import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { signInNavRef } from '../../lib/store'
import { hapticTick } from '../../lib/native'
import styles from './DiagnosticFlow.module.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = {
  survival:     { name: 'survival',     bg: '#FFF0EC', text: '#D93B1C' },
  nourishment:  { name: 'nourishment',  bg: 'rgba(232,184,31,0.12)', text: '#854F0B' },
  appreciation: { name: 'appreciation', bg: '#F2F5F3', text: '#4A6860' },
  exploration:  { name: 'exploration',  bg: '#E8EFE9', text: '#1B3A2D' },
}
const MODE_ORDER      = ['survival', 'nourishment', 'appreciation', 'exploration']
const CARD_MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

const MODE_COLORS = {
  exploration:  '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment:  '#E8B81F',
  survival:     '#D93B1C',
}

const MODE_DESCRIPTIONS = {
  exploration:  'deepest commitment · 3 practices a day',
  appreciation: 'present and intentional · 2 practices a day',
  nourishment:  'steady and reliable · 1 practice a day',
  survival:     'the floor that frees everything else · ½ weight',
}

const UNIVERSAL_NEEDS = [
  { id: 'movement',  name: 'Movement' },
  { id: 'nutrition', name: 'Nutrition' },
  { id: 'rest',      name: 'Rest' },
]

const PERSONAL_NEEDS = [
  { id: 'community',   name: 'Community' },
  { id: 'reflection',  name: 'Reflection' },
  { id: 'beauty',      name: 'Beauty' },
  { id: 'play',        name: 'Play' },
  { id: 'information', name: 'Information' },
  { id: 'intimacy',    name: 'Intimacy' },
  { id: 'touch',       name: 'Touch' },
  { id: 'thrill',      name: 'Thrill' },
  { id: 'money',       name: 'Money' },
  { id: 'dwelling',    name: 'Dwelling' },
]

const FILL_ORDER = ['community', 'reflection', 'beauty', 'play', 'information', 'intimacy', 'touch', 'thrill']

const ANXIETY_LEVEL_OPTIONS = [
  {
    id: 'major',
    name: 'a major part of my life',
    desc: 'shaping how I think, work, and relate to people. it runs in the background constantly.',
  },
  {
    id: 'comes-and-goes',
    name: 'comes and goes',
    desc: 'there are manageable periods and periods where it spikes. not constant, but a recurring presence.',
  },
  {
    id: 'specific',
    name: 'shows up in specific situations',
    desc: "mostly contained — certain contexts, pressures, or relationships trigger it. most of the time there's a feeling of being reasonably grounded.",
  },
]

const ANXIETY_TYPE_OPTIONS = [
  {
    id: 'frenetic',
    name: 'frenetic',
    desc: "too much going on to focus on anything in particular. busy but not sure what's actually worth working on. clarity is needed more than more to-dos.",
  },
  {
    id: 'overwhelm',
    name: 'overwhelm',
    desc: "there are big things that don't feel manageable. regular proof of competence is what's needed — small wins, every day.",
  },
  {
    id: 'apathy',
    name: 'apathy',
    desc: "bored, disconnected, can't see the point. more discipline isn't the answer — feeling something again is.",
  },
]

const ENERGY_SITUATIONS = [
  'deep 1:1 conversations',
  'large social gatherings',
  'focused solo work',
  'collaborative projects',
  'physical exertion',
  'quiet mornings',
  'high-stakes pressure',
  'caregiving',
  'creative output',
  'routine and structure',
  'unstructured free time',
  'learning something new',
  'physical risk or intensity',
  'being responsible for others',
]

const SEASON_OPTIONS = [
  'career building',
  'family first',
  'health focus',
  'caregiving',
  'in transition',
  'creative pursuit',
  'rebuilding',
  'finding direction',
]

const ALWAYS_MATTERS_OPTIONS = [
  { id: 'community',  name: 'community',  desc: 'people who truly know you' },
  { id: 'reflection', name: 'reflection', desc: 'time to process yourself' },
  { id: 'creativity', name: 'creativity', desc: 'making things that are yours' },
  { id: 'movement',   name: 'movement',   desc: 'pushing your body to its potential' },
  { id: 'intimacy',   name: 'intimacy',   desc: 'to be truly known by another' },
  { id: 'learning',   name: 'learning',   desc: 'curiosity as a way of life' },
  { id: 'beauty',     name: 'beauty',     desc: 'being moved by the world' },
  { id: 'thrill',     name: 'thrill',     desc: 'the feeling of being fully alive' },
]

// Maps "always matters" survey answers to canvas need IDs.
// 'creativity' consolidates into 'beauty' — the canvas has no separate creativity
// need; beauty covers aesthetic/creative expression in the need taxonomy.
const ALWAYS_MATTERS_TO_NEED = {
  community:  'community',
  reflection: 'reflection',
  creativity: 'beauty',
  movement:   'movement',
  intimacy:   'intimacy',
  learning:   'information',
  beauty:     'beauty',
  thrill:     'thrill',
}

const CAN_WAIT_OPTIONS = [
  { id: 'money',       name: 'money',       desc: 'financial stability' },
  { id: 'dwelling',    name: 'dwelling',    desc: 'home environment' },
  { id: 'touch',       name: 'touch',       desc: 'physical affection and contact' },
  { id: 'information', name: 'information', desc: 'staying oriented in the world' },
  { id: 'play',        name: 'play',        desc: 'purposeless joy' },
  { id: 'community',   name: 'community',   desc: 'belonging and group connection' },
  { id: 'beauty',      name: 'beauty',      desc: 'contact with what moves you' },
  { id: 'thrill',      name: 'thrill',      desc: 'intensity and aliveness' },
]

const FLEXIBILITY_OPTIONS = [
  {
    id: 'low',
    name: 'very little',
    desc: 'life is full and margins are thin. too much change at once will create more stress, not less.',
    tag: 'start with 5–6 practices · no exploration required',
    tagBg: 'rgba(217,59,28,0.08)',
    tagColor: '#993C1D',
  },
  {
    id: 'mid',
    name: 'some',
    desc: "there's room for intentional change but it has to stay realistic and sustainable.",
    tag: 'start with 7–8 practices · exploration optional',
    tagBg: 'rgba(232,184,31,0.12)',
    tagColor: '#854F0B',
  },
  {
    id: 'high',
    name: 'quite a bit',
    desc: 'actively making space for growth and ready to commit to something meaningful.',
    tag: 'start with 9–10 practices · full canvas',
    tagBg: 'rgba(27,58,45,0.1)',
    tagColor: '#1B3A2D',
  },
]

const HOW_IT_WORKS = [
  { mode: 'exploration',  color: '#1B3A2D', desc: 'deepest commitment — 3 practices a day' },
  { mode: 'appreciation', color: '#B8C3B1', desc: 'present and intentional — 2 practices a day' },
  { mode: 'nourishment',  color: '#E8B81F', desc: 'steady and reliable — 1 practice a day' },
  { mode: 'survival',     color: '#D93B1C', desc: 'the floor that frees everything else — 1 practice, half weight' },
]

// Steps 1–7 show a progress bar; PROGRESS[step - 1]
const PROGRESS = [14, 28, 42, 57, 71, 85, 100]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function modeRank(mode) {
  return { survival: 0, nourishment: 1, appreciation: 2, exploration: 3 }[mode] ?? -1
}

function nextMode(needId, mode) {
  const order = needId === 'rest' ? ['survival', 'nourishment'] : MODE_ORDER
  const idx = order.indexOf(mode)
  return order[(idx + 1) % order.length]
}

// Daily practice count per mode (for canvas budget estimation — distinct from
// the scoring weights in constants.js which use equal weights for all modes).
const MODE_DAILY_PRACTICES = { exploration: 3, appreciation: 2, nourishment: 1, survival: 0.5 }
const FLEX_MAX = { low: 6, mid: 8, high: 10 }
const DROP_ORDER = ['money', 'dwelling', 'thrill', 'touch', 'intimacy', 'play', 'information', 'beauty', 'reflection', 'community']

function practiceWeight(canvasObj) {
  return Object.values(canvasObj).reduce((sum, mode) => sum + (MODE_DAILY_PRACTICES[mode] || 0), 0)
}

// Round up — half-weight survival needs still count as a full practice slot for display.
function practiceCount(universal, personal) {
  return Math.ceil(practiceWeight(universal) + practiceWeight(personal))
}

function ensureAppreciation(universal, personal, alwaysNeedId) {
  const hasAppreciation = Object.values(universal).includes('appreciation') || Object.values(personal).includes('appreciation')
  if (hasAppreciation) return null

  for (const id of FILL_ORDER) {
    if (id === alwaysNeedId) continue
    if (personal[id] && modeRank(personal[id]) < modeRank('appreciation')) {
      personal[id] = 'appreciation'
      return id
    }
  }
  for (const id of FILL_ORDER) {
    if (!personal[id]) {
      personal[id] = 'appreciation'
      return id
    }
  }
  return null
}

function capPersonalNeeds(universal, personal, maxTotal, protectedId) {
  const budget = maxTotal - practiceWeight(universal)
  let total = practiceWeight(personal)
  for (const id of DROP_ORDER) {
    if (total <= budget) break
    if (id === protectedId) continue
    if (personal[id]) {
      total -= MODE_DAILY_PRACTICES[personal[id]] || 0
      delete personal[id]
    }
  }
}

function buildRecommendation({ anxietyLevel, anxietyType, energyGives, energyDrains, season, alwaysNeedId, canWait, flexibility }) {
  const universal = { movement: 'survival', nutrition: 'survival', rest: 'nourishment' }
  const personal  = {}

  if (anxietyType === 'frenetic') {
    personal.reflection  = 'exploration'
    personal.information = 'nourishment'
  } else if (anxietyType === 'overwhelm') {
    personal.reflection  = 'nourishment'
    personal.information = 'nourishment'
  } else if (anxietyType === 'apathy') {
    personal.beauty = 'appreciation'
    personal.play   = 'appreciation'
  }

  if (anxietyLevel === 'major') {
    if (!personal.reflection) personal.reflection = 'nourishment'
    for (const id of Object.keys(personal)) {
      if (modeRank(personal[id]) > modeRank('nourishment')) personal[id] = 'nourishment'
    }
  } else if (anxietyLevel === 'specific') {
    for (const id of Object.keys(personal)) {
      if (personal[id] === 'nourishment') personal[id] = 'appreciation'
    }
  }

  if (season === 'career building') {
    if (!personal.information) personal.information = 'nourishment'
    if (!personal.reflection)  personal.reflection  = anxietyType === 'frenetic' ? 'appreciation' : 'nourishment'
  } else if (season === 'family first') {
    if (!personal.community || modeRank(personal.community) < modeRank('appreciation')) personal.community = 'appreciation'
  } else if (season === 'health focus') {
    if (modeRank(universal.movement) < modeRank('appreciation')) universal.movement = 'appreciation'
  } else if (season === 'in transition' || season === 'rebuilding') {
    if (!personal.reflection) personal.reflection = 'nourishment'
    if (!personal.money)      personal.money      = 'survival'
    if (!personal.dwelling)   personal.dwelling   = 'survival'
  } else if (season === 'creative pursuit') {
    if (!personal.beauty || modeRank(personal.beauty) < modeRank('appreciation')) personal.beauty = 'appreciation'
  } else if (season === 'caregiving') {
    if (modeRank(universal.rest) < modeRank('nourishment')) universal.rest = 'nourishment'
    if (!personal.community) personal.community = 'nourishment'
  } else if (season === 'finding direction') {
    if (!personal.reflection) personal.reflection = 'nourishment'
  }

  if (energyGives.includes('creative output')) {
    if (!personal.beauty || modeRank(personal.beauty) < modeRank('appreciation')) personal.beauty = 'appreciation'
  }
  if (energyGives.includes('deep 1:1 conversations')) {
    if (!personal.community || modeRank(personal.community) < modeRank('nourishment')) personal.community = 'nourishment'
  }
  if (energyGives.includes('physical exertion')) {
    if (modeRank(universal.movement) < modeRank('appreciation')) universal.movement = 'appreciation'
  }
  if (energyGives.includes('learning something new')) {
    if (!personal.information) personal.information = 'nourishment'
  }

  if (energyDrains.includes('large social gatherings')) {
    if (personal.community && modeRank(personal.community) > modeRank('nourishment')) personal.community = 'nourishment'
  }
  if (energyDrains.includes('high-stakes pressure')) {
    if (modeRank(universal.rest) < modeRank('nourishment')) universal.rest = 'nourishment'
  }
  if (energyDrains.includes('unstructured free time')) {
    if (personal.play   && modeRank(personal.play)   > modeRank('nourishment')) personal.play   = 'nourishment'
    if (personal.beauty && modeRank(personal.beauty) > modeRank('nourishment')) personal.beauty = 'nourishment'
  }

  if (!personal.money)    personal.money    = 'survival'
  if (!personal.dwelling) personal.dwelling = 'survival'

  const meaningful = Object.keys(personal).filter(id => id !== 'money' && id !== 'dwelling')
  if (meaningful.length === 0) {
    const fill = FILL_ORDER.find(id => !personal[id])
    if (fill) personal[fill] = anxietyType === 'overwhelm' ? 'nourishment' : 'appreciation'
  }

  if (modeRank(universal.rest) > modeRank('nourishment')) universal.rest = 'nourishment'

  const isUniversalAlways = alwaysNeedId === 'movement' || alwaysNeedId === 'nutrition'

  if (alwaysNeedId) {
    if (alwaysNeedId === 'rest') {
      universal.rest = 'nourishment'
    } else if (flexibility === 'low') {
      // low flexibility never assigns exploration — the non-negotiable need lands in appreciation instead.
      if (isUniversalAlways) universal[alwaysNeedId] = 'appreciation'
      else personal[alwaysNeedId] = 'appreciation'
    } else {
      if (isUniversalAlways) universal[alwaysNeedId] = 'exploration'
      else personal[alwaysNeedId] = 'exploration'
    }
  }

  for (const needId of (canWait || [])) {
    if (needId !== alwaysNeedId) delete personal[needId]
  }

  const maxTotal = FLEX_MAX[flexibility] || FLEX_MAX.high

  // mid: exploration is optional — drop back to appreciation if it would blow the practice budget.
  if (flexibility === 'mid' && alwaysNeedId && alwaysNeedId !== 'rest' && practiceCount(universal, personal) > maxTotal) {
    if (isUniversalAlways) universal[alwaysNeedId] = 'appreciation'
    else personal[alwaysNeedId] = 'appreciation'
  }

  let protectedId = alwaysNeedId
  if (flexibility === 'low' || flexibility === 'mid') {
    protectedId = ensureAppreciation(universal, personal, alwaysNeedId) || alwaysNeedId
  }

  capPersonalNeeds(universal, personal, maxTotal, protectedId)

  return { universal, personal }
}

// ─── Session persistence (answers survive a mid-flow refresh) ────────────────

const SS_KEY = 'maslow_onboarding_v1'

function loadSavedAnswers() {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY)) || {} } catch { return {} }
}

function rebuildFromSaved(s) {
  try {
    const alwaysNeedId = ALWAYS_MATTERS_TO_NEED[s.alwaysMatters] || s.alwaysMatters
    const gives  = Object.entries(s.energyMap || {}).filter(([, v]) => v === 'gives').map(([k]) => k)
    const drains = Object.entries(s.energyMap || {}).filter(([, v]) => v === 'drains').map(([k]) => k)
    return buildRecommendation({ anxietyLevel: s.anxietyLevel, anxietyType: s.anxietyType, energyGives: gives, energyDrains: drains, season: s.season, alwaysNeedId, canWait: s.canWait || [], flexibility: s.flexibility })
  } catch { return null }
}

// ─── "Because" lines: make the personalization legible ───────────────────────

const NEED_NAMES = Object.fromEntries([...UNIVERSAL_NEEDS, ...PERSONAL_NEEDS].map(n => [n.id, n.name.toLowerCase()]))

const BECAUSE_TYPE = {
  frenetic:  'because anxiety runs frenetic for you, reflection takes your deepest commitment — clarity over more to-dos.',
  overwhelm: 'because overwhelm is the shape of it, your canvas leans on small, steady, provable wins.',
  apathy:    'because apathy is the shape of it, beauty and play carry extra weight — feeling something comes first.',
}

function becauseLines({ anxietyType, alwaysNeedId, flexibility }) {
  const lines = []
  if (BECAUSE_TYPE[anxietyType]) lines.push(BECAUSE_TYPE[anxietyType])
  if (alwaysNeedId && NEED_NAMES[alwaysNeedId]) {
    lines.push(flexibility === 'low'
      ? `${NEED_NAMES[alwaysNeedId]} is your non-negotiable — and because margins are thin right now, the canvas starts small on purpose.`
      : `${NEED_NAMES[alwaysNeedId]} is your non-negotiable — it holds the deepest slot on your canvas.`)
  }
  return lines.slice(0, 2)
}

function canvasModeWeights(recommendation) {
  const weights = { exploration: 0, appreciation: 0, nourishment: 0, survival: 0 }
  for (const mode of Object.values({ ...recommendation.universal, ...recommendation.personal })) {
    if (weights[mode] != null) weights[mode] += MODE_DAILY_PRACTICES[mode] || 0.5
  }
  return weights
}

// ─── Small components ─────────────────────────────────────────────────────────

function MaslowMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="10" r="3" fill="#E8B81F"/>
      <circle cx="21" cy="20" r="3" fill="#ffffff"/>
      <circle cx="31" cy="20" r="3" fill="#ffffff"/>
      <circle cx="16" cy="30" r="3" fill="#ffffff"/>
      <circle cx="26" cy="30" r="3" fill="#ffffff"/>
      <circle cx="36" cy="30" r="3" fill="#ffffff"/>
      <circle cx="11" cy="40" r="3" fill="#ffffff"/>
      <circle cx="21" cy="40" r="3" fill="#ffffff"/>
      <circle cx="31" cy="40" r="3" fill="#ffffff"/>
      <circle cx="41" cy="40" r="3" fill="#ffffff"/>
    </svg>
  )
}

// The brand's opening statement, miniaturized: colors reclaim space from black.
function WelcomeBar() {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const ts = [setTimeout(() => setStage(1), 500), setTimeout(() => setStage(2), 1800), setTimeout(() => setStage(3), 3100)]
    return () => ts.forEach(clearTimeout)
  }, [])
  const GROWS = [
    { e: 0.3, a: 0.3, n: 0.3, s: 0.3, x: 5 },
    { e: 0.8, a: 0.9, n: 1.1, s: 1.2, x: 3.4 },
    { e: 0.8, a: 1.2, n: 1.5, s: 1.7, x: 2.2 },
    { e: 1.1, a: 1.5, n: 1.7, s: 2.0, x: 1.4 },
  ]
  const g = GROWS[stage]
  return (
    <div className={styles.welcomeBar} aria-hidden="true">
      <div className={styles.welcomeSeg} style={{ flexGrow: g.e, background: MODE_COLORS.exploration }} />
      <div className={styles.welcomeSeg} style={{ flexGrow: g.a, background: MODE_COLORS.appreciation }} />
      <div className={styles.welcomeSeg} style={{ flexGrow: g.n, background: MODE_COLORS.nourishment }} />
      <div className={styles.welcomeSeg} style={{ flexGrow: g.s, background: MODE_COLORS.survival }} />
      <div className={styles.welcomeSegX} style={{ flexGrow: g.x }} />
    </div>
  )
}

// The reveal: THEIR canvas, sweeping in from black.
function RevealBar({ recommendation }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 400); return () => clearTimeout(t) }, [])
  const weights = canvasModeWeights(recommendation)
  return (
    <div className={styles.revealBar} aria-hidden="true">
      {CARD_MODE_ORDER.map(m => weights[m] > 0 && (
        <div key={m} className={styles.revealSeg} style={{ flexGrow: on ? weights[m] : 0.25, background: MODE_COLORS[m] }} />
      ))}
      <div className={`${styles.revealSeg} ${styles.welcomeSegX}`} style={{ flexGrow: on ? 0.9 : 6 }} />
    </div>
  )
}

// Static mini bar — the thing being saved on the account screen.
function CanvasMiniBar({ recommendation }) {
  if (!recommendation) return null
  const weights = canvasModeWeights(recommendation)
  return (
    <div className={styles.miniBar} aria-hidden="true">
      {CARD_MODE_ORDER.map(m => weights[m] > 0 && (
        <div key={m} className={styles.miniBarSeg} style={{ flexGrow: weights[m], background: MODE_COLORS[m] }} />
      ))}
    </div>
  )
}

function ProgressBar({ pct }) {
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ModeDropdown({ id, currentMode, modes, onSelect, isOpen, onToggle }) {
  const wrapRef = useRef(null)
  const m = MODES[currentMode]

  useEffect(() => {
    if (!isOpen) return
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onToggle(null)
    }
    document.addEventListener('mousedown', handleOutside, true)
    document.addEventListener('touchstart', handleOutside, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside, true)
      document.removeEventListener('touchstart', handleOutside, true)
    }
  }, [isOpen, onToggle])

  return (
    <div className={styles.modeDropdownWrap} ref={wrapRef}>
      <button
        className={styles.modePill}
        style={{ background: m.bg, color: m.text }}
        onClick={() => onToggle(isOpen ? null : id)}
      >
        {m.name}
      </button>
      {isOpen && (
        <div className={styles.modeDropdown}>
          {modes.map((opt, i) => (
            <div key={opt}>
              {i > 0 && <div className={styles.dropdownHairline} />}
              <div
                className={styles.dropdownOption}
                onClick={() => { onSelect(opt); onToggle(null) }}
              >
                <div className={styles.dropdownPip} style={{ background: MODE_COLORS[opt] }} />
                <span className={styles.dropdownModeName}>{opt}</span>
                <span className={styles.dropdownModeDesc}>{MODE_DESCRIPTIONS[opt]}</span>
                {currentMode === opt && <div className={styles.dropdownSelectedDot} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Account screen (final step) ─────────────────────────────────────────────

function OnboardingAccount({ destination, recommendation, updateCanvas, onDone, onBack }) {
  const [mode, setMode]             = useState('create')

  // Create form
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  // Sign-in form
  const [siEmail, setSiEmail]       = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [magicSent, setMagicSent]   = useState(false)
  const [resetSent, setResetSent]   = useState(false)

  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [duplicateAccount, setDuplicateAccount] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    setError(null)
    setDuplicateAccount(false)
    signInNavRef.skip = true

    const { error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authErr) {
      signInNavRef.skip = false
      const msg = (authErr.message || '').toLowerCase()
      const isDuplicate = authErr.code === 'user_already_exists' || msg.includes('already registered') || msg.includes('already exists')
      if (isDuplicate) {
        setDuplicateAccount(true)
      } else {
        setError(authErr.message)
      }
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    let canvasObj = null
    if (userId && recommendation) {
      canvasObj = { ...recommendation.universal, ...recommendation.personal }
      await supabase.from('users').upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        canvas: canvasObj,
        onboarded: true,
        onboarded_at: new Date().toLocaleDateString('en-CA'),
      }, { onConflict: 'id' })
    }

    setLoading(false)
    // Pass canvasObj so handleAccountDone can set it explicitly in completeOnboarding,
    // preventing the SIGNED_IN → restoreFromSupabase race from clobbering the canvas.
    onDone(destination, userId, canvasObj)
  }

  async function handleSignIn() {
    setLoading(true)
    setError(null)

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: siEmail.trim().toLowerCase(),
      password: siPassword,
    })

    if (authErr) {
      setError(authErr.message)
      setLoading(false)
      return
    }

    setLoading(false)
    // onAuthStateChange in store restores state and navigates to /today
  }

  async function handleMagicLink() {
    if (!siEmail.trim()) { setError('enter your email first'); return }
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: siEmail.trim().toLowerCase(),
      options: { emailRedirectTo: 'https://app.mymaslow.com' },
    })
    if (err) setError(err.message)
    else setMagicSent(true)
  }

  async function handleForgotPassword() {
    if (!siEmail.trim()) { setError('enter your email first'); return }
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      siEmail.trim().toLowerCase(),
      { redirectTo: 'https://app.mymaslow.com/password' }
    )
    if (err) setError(err.message)
    else setResetSent(true)
  }

  if (mode === 'create') {
    const canSubmit = name.trim() && email.trim() && password.length >= 8

    return (
      <div className={styles.screen}>
        <ProgressBar pct={100} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={onBack}>← back</button>
          <div className={styles.eyebrow}>SAVE YOUR CANVAS</div>
          <div className={styles.headline}>create your account.</div>
          <CanvasMiniBar recommendation={recommendation} />
          <div className={styles.sub}>your canvas, practices, and data are tied to your account.</div>

          <form className={styles.accountForm} onSubmit={e => { e.preventDefault(); if (canSubmit && !loading) handleSignUp() }}>
            <input
              className={styles.accountInput}
              type="text"
              placeholder="your name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
            <input
              className={styles.accountInput}
              type="email"
              placeholder="your email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); setDuplicateAccount(false) }}
              autoComplete="email"
            />
            <div>
              <input
                className={styles.accountInput}
                type="password"
                placeholder="create a password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <div className={styles.inputHintNote}>8+ characters</div>
            </div>
            <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
          </form>

          {error && <div className={styles.formError}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <div className={styles.privacyNote}>your answers stay yours — never shared, never sold.</div>
          <button className="btn-primary" onClick={handleSignUp} disabled={!canSubmit || loading}>
            {loading ? 'creating account…' : 'create account →'}
          </button>
          {duplicateAccount && (
            <div className={styles.duplicateNote}>
              looks like you already have an account. <span className={styles.duplicateLink} onClick={() => { setMode('signin'); setError(null); setDuplicateAccount(false) }}>sign in instead →</span>
            </div>
          )}
          <div className={styles.signInPrompt}>
            already have an account? <span className={styles.signInLink} onClick={() => { setMode('signin'); setError(null); setDuplicateAccount(false) }}>sign in →</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Sign-in mode ──
  const canSignIn = siEmail.trim() && siPassword.length > 0

  return (
    <div className={styles.screen}>
      <ProgressBar pct={100} />
      <div className={styles.content}>
        <div className={styles.eyebrow}>WELCOME BACK</div>
        <div className={styles.headline}>sign in.</div>
        <div className={styles.sub}>your canvas and data are waiting.</div>

        <div className={styles.accountForm}>
          <input
            className={styles.accountInput}
            type="email"
            placeholder="your email"
            value={siEmail}
            onChange={e => { setSiEmail(e.target.value); setError(null) }}
            autoComplete="email"
          />
          <input
            className={styles.accountInput}
            type="password"
            placeholder="your password"
            value={siPassword}
            onChange={e => { setSiPassword(e.target.value); setError(null) }}
            autoComplete="current-password"
          />
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <div className={styles.authSecondarySection}>
          <div className={styles.authHairline} />
          <div
            className={`${styles.authSecondaryLink} ${magicSent ? styles.authSecondaryConfirm : ''}`}
            onClick={!magicSent ? handleMagicLink : undefined}
          >
            {magicSent ? '✓ check your email for a sign-in link' : 'send a magic link instead'}
          </div>
          <div className={styles.authHairline} />
          <div
            className={`${styles.authSecondaryLink} ${resetSent ? styles.authSecondaryConfirm : ''}`}
            onClick={!resetSent ? handleForgotPassword : undefined}
          >
            {resetSent ? '✓ check your email to reset your password' : 'forgot password?'}
          </div>
          <div className={styles.authHairline} />
        </div>
      </div>

      <div className={styles.footer}>
        <button className="btn-primary" onClick={handleSignIn} disabled={!canSignIn || loading}>
          {loading ? 'signing in…' : 'sign in →'}
        </button>
        <div className={styles.authToggle} onClick={() => { setMode('create'); setError(null) }}>
          don't have an account? create one
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiagnosticFlow({ updateCanvas, completeOnboarding }) {
  const navigate = useNavigate()
  const [saved] = useState(loadSavedAnswers)
  const [step, setStep]                     = useState(() => saved.step ?? 0)
  const [destination, setDestination]       = useState('/practices')

  const [anxietyLevel, setAnxietyLevel]     = useState(saved.anxietyLevel ?? null)
  const [anxietyType, setAnxietyType]       = useState(saved.anxietyType ?? null)
  const [energyMap, setEnergyMap]           = useState(saved.energyMap ?? {})
  const [season, setSeason]                 = useState(saved.season ?? null)
  const [flexibility, setFlexibility]       = useState(saved.flexibility ?? null)
  const [alwaysMatters, setAlwaysMatters]   = useState(saved.alwaysMatters ?? null)
  const [canWait, setCanWait]               = useState(saved.canWait ?? [])
  // A refresh at the reveal/account step rebuilds the recommendation from saved answers.
  const [recommendation, setRecommendation] = useState(() => ((saved.step ?? 0) >= 8 ? rebuildFromSaved(saved) : null))
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const [revealCount, setRevealCount]       = useState(0)

  // Persist answers as they're given — five minutes of honesty shouldn't die on a refresh.
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        step: typeof step === 'number' ? step : 3,
        anxietyLevel, anxietyType, energyMap, season, flexibility, alwaysMatters, canWait,
      }))
    } catch {}
  }, [step, anxietyLevel, anxietyType, energyMap, season, flexibility, alwaysMatters, canWait])

  // Staged reveal: canvas rows land one at a time when the reveal opens.
  const totalRevealRows = recommendation
    ? Object.keys(recommendation.universal).length + Object.keys(recommendation.personal).length
    : 0
  useEffect(() => {
    if (step !== 8 || !recommendation) return
    setRevealCount(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setRevealCount(i)
      if (i >= totalRevealRows) clearInterval(t)
    }, 140)
    return () => clearInterval(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function cycleSituation(s) {
    hapticTick()
    setEnergyMap(prev => {
      const cur = prev[s]
      if (!cur)            return { ...prev, [s]: 'gives' }
      if (cur === 'gives') return { ...prev, [s]: 'drains' }
      const next = { ...prev }
      delete next[s]
      return next
    })
  }

  function toggleCanWait(needId) {
    hapticTick()
    setCanWait(prev => prev.includes(needId) ? prev.filter(id => id !== needId) : [...prev, needId])
  }

  function goToCanvas() {
    const alwaysNeedId = ALWAYS_MATTERS_TO_NEED[alwaysMatters] || alwaysMatters
    const energyGives  = Object.entries(energyMap).filter(([, v]) => v === 'gives').map(([k]) => k)
    const energyDrains = Object.entries(energyMap).filter(([, v]) => v === 'drains').map(([k]) => k)
    const rec = buildRecommendation({ anxietyLevel, anxietyType, energyGives, energyDrains, season, alwaysNeedId, canWait, flexibility })
    setRecommendation(rec)
    setStep(8)
  }

  function setNeedMode(section, needId, mode) {
    setRecommendation(prev => ({
      ...prev,
      [section]: { ...prev[section], [needId]: mode },
    }))
  }

  function removePersonalNeed(needId) {
    setRecommendation(prev => {
      const next = { ...prev.personal }
      delete next[needId]
      return { ...prev, personal: next }
    })
  }

  function addPersonalNeed(needId, mode = 'nourishment') {
    setRecommendation(prev => ({ ...prev, personal: { ...prev.personal, [needId]: mode } }))
  }

  function saveCanvas() {
    for (const [needId, mode] of Object.entries(recommendation.universal)) updateCanvas(needId, mode)
    for (const [needId, mode] of Object.entries(recommendation.personal))  updateCanvas(needId, mode)
  }

  function handleAccountDone(dest, userId, canvas) {
    try { sessionStorage.removeItem(SS_KEY) } catch {}
    // Pass canvas explicitly so it survives any restoreFromSupabase race in the SIGNED_IN handler.
    if (completeOnboarding) completeOnboarding(canvas || null, null, userId ? { userId } : undefined)
    navigate(dest)
  }

  const energyMapValid = Object.values(energyMap).includes('gives') && Object.values(energyMap).includes('drains')

  // ── Screen 0: Opening ────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.welcomeHeader}>
          <MaslowMark />
          <span className={styles.welcomeWordmark}>mymaslow.</span>
        </div>
        <div className={styles.logoHairline} />
        <div className={styles.welcomeBody}>
          <div className={styles.welcomeWrap}>
            <div className={styles.headline}>
              meet your needs.<br />
              <em>become more of yourself.</em>
            </div>
            <WelcomeBar />
            <div className={styles.bodyText}>
              anxiety fills the space you give it. answer seven honest questions and maslow builds you a canvas to take that space back.
            </div>
            <div className={styles.mutedNote} style={{ marginTop: 16 }}>takes about 5 minutes. your answers stay yours.</div>
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(1)}>let's start →</button>
        </div>
      </div>
    )
  }

  // ── Screen 1: Anxiety level ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[0]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(0)}>← back</button>
          <div className={styles.eyebrow}>STEP 1 OF 7 — ANXIETY</div>
          <div className={styles.headline}>what's your relationship with anxiety?</div>
          <div className={styles.sub}>be honest — there's no right answer.</div>
          <div className={styles.options}>
            {ANXIETY_LEVEL_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.optionCard} ${anxietyLevel === opt.id ? styles.optionCardSelected : ''}`}
                onClick={() => { hapticTick(); setAnxietyLevel(opt.id) }}
              >
                <div className={styles.optionName}>{opt.name}</div>
                <div className={styles.optionDesc}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(2)} disabled={!anxietyLevel}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 2: Anxiety type ───────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[1]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(1)}>← back</button>
          <div className={styles.eyebrow}>STEP 2 OF 7 — ANXIETY TYPE</div>
          <div className={styles.headline}>how does anxiety tend to show up?</div>
          <div className={styles.sub}>one of these is probably more familiar than the others.</div>
          <div className={styles.options}>
            {ANXIETY_TYPE_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.optionCard} ${anxietyType === opt.id ? styles.optionCardSelected : ''}`}
                onClick={() => { hapticTick(); setAnxietyType(opt.id) }}
              >
                <div className={styles.optionName}>{opt.name}</div>
                <div className={styles.optionDesc}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep('breath')} disabled={!anxietyType}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Interstitial: an exhale after the hard questions ────────────────────────
  if (step === 'breath') {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[1]} />
        <div className={styles.breathWrap}>
          <div className={styles.breathLine}>that&apos;s the hard part.</div>
          <div className={styles.breathSub}>now the good stuff — what gives you energy?</div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(3)}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 3: Energy map ─────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[2]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(2)}>← back</button>
          <div className={styles.eyebrow}>STEP 3 OF 7 — ENERGY MAP</div>
          <div className={styles.headline}>what creates energy and what drains it?</div>
          <div className={styles.sub}>tap once for creates, twice for drains, three times to clear.</div>
          <div className={styles.legendRow}>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: '#1B3A2D' }} />
              <span className={styles.legendText}>creates energy</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: '#D93B1C' }} />
              <span className={styles.legendText}>drains energy</span>
            </div>
          </div>
          <div className={styles.twoColGrid}>
            {ENERGY_SITUATIONS.map((s, si) => {
              const state = energyMap[s]
              const nudge = si === 0 && Object.keys(energyMap).length === 0
              return (
                <div
                  key={s}
                  className={`${styles.situationCard} ${state === 'gives' ? styles.situationCardGives : state === 'drains' ? styles.situationCardDrains : ''} ${nudge ? styles.situationNudge : ''}`}
                  onClick={() => cycleSituation(s)}
                >
                  {s}
                </div>
              )
            })}
          </div>
        </div>
        <div className={styles.footer}>
          {!energyMapValid && <div className={styles.hint}>mark at least one of each</div>}
          <button className="btn-primary" onClick={() => setStep(4)} disabled={!energyMapValid}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 4: Life season ────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[3]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(3)}>← back</button>
          <div className={styles.eyebrow}>STEP 4 OF 7 — YOUR SEASON</div>
          <div className={styles.headline}>what does life look like right now?</div>
          <div className={styles.sub}>seasons change. the canvas should reflect where things actually are, not where they'd ideally be.</div>
          <div className={styles.twoColGrid}>
            {SEASON_OPTIONS.map(s => (
              <div
                key={s}
                className={`${styles.gridCard} ${season === s ? styles.gridCardSelected : ''}`}
                onClick={() => { hapticTick(); setSeason(s) }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(5)} disabled={!season}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 5: Flexibility ────────────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[4]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(4)}>← back</button>
          <div className={styles.eyebrow}>STEP 5 OF 7 — FLEXIBILITY</div>
          <div className={styles.headline}>how much room do you have to make change right now?</div>
          <div className={styles.sub}>this determines how many practices to start with. starting too many at once is its own form of overwhelm. becoming more of yourself is a marathon, not a sprint.</div>
          <div className={styles.options}>
            {FLEXIBILITY_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.optionCard} ${flexibility === opt.id ? styles.optionCardSelected : ''}`}
                onClick={() => { hapticTick(); setFlexibility(opt.id) }}
              >
                <div className={styles.optionName}>{opt.name}</div>
                <div className={styles.optionDesc}>{opt.desc}</div>
                <div className={styles.flexTag} style={{ background: opt.tagBg, color: opt.tagColor }}>{opt.tag}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(6)} disabled={!flexibility}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 6: Always matters ─────────────────────────────────────────────────
  if (step === 6) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[5]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(5)}>← back</button>
          <div className={styles.eyebrow}>STEP 6 OF 7 — WHAT ALWAYS MATTERS</div>
          <div className={styles.headline}>no matter the season — what's non-negotiable?</div>
          <div className={styles.sub}>this becomes the exploration need. the one thing that gets the deepest daily commitment. choose one.</div>
          <div className={styles.twoColGrid}>
            {ALWAYS_MATTERS_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.needGridCard} ${alwaysMatters === opt.id ? styles.needGridCardSelected : ''}`}
                onClick={() => { hapticTick(); setAlwaysMatters(opt.id) }}
              >
                <div className={styles.needGridName}>{opt.name}</div>
                <div className={styles.needGridDesc}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(7)} disabled={!alwaysMatters}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 7: Can wait ───────────────────────────────────────────────────────
  if (step === 7) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[6]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(6)}>← back</button>
          <div className={styles.eyebrow}>STEP 7 OF 7 — WHAT CAN WAIT</div>
          <div className={styles.headline}>what doesn't need attention right now?</div>
          <div className={styles.sub}>not ignored — just not taking up mental space. these won't appear on the canvas until the time is right.</div>
          <div className={styles.twoColGrid}>
            {CAN_WAIT_OPTIONS.map(opt => {
              const selected = canWait.includes(opt.id)
              return (
                <div
                  key={opt.id}
                  className={`${styles.needGridCard} ${selected ? styles.needGridCardWait : ''}`}
                  onClick={() => toggleCanWait(opt.id)}
                >
                  <div className={`${styles.needGridName} ${selected ? styles.needGridNameWait : ''}`}>{opt.name}</div>
                  <div className={styles.needGridDesc}>{opt.desc}</div>
                </div>
              )
            })}
          </div>
          <div className={styles.gridNote}>select as many or as few as feels right. nothing selected means everything stays in the mix.</div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={goToCanvas}>build my canvas →</button>
        </div>
      </div>
    )
  }

  // ── Screen 8: Canvas reveal ──────────────────────────────────────────────────
  if (step === 8 && recommendation) {
    const addableNeeds = PERSONAL_NEEDS.filter(n => !(n.id in recommendation.personal))

    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[6]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(7)}>← back</button>
          <div className={styles.eyebrow}>YOUR CANVAS</div>
          <div className={styles.headline}>here's what we're working with.</div>

          <RevealBar recommendation={recommendation} />
          <div className={styles.revealSummary}>
            {totalRevealRows} needs · {practiceCount(recommendation.universal, recommendation.personal)} practices a day — space claimed back from anxiety.
          </div>

          {(() => {
            const lines = becauseLines({ anxietyType, alwaysNeedId: ALWAYS_MATTERS_TO_NEED[alwaysMatters] || alwaysMatters, flexibility })
            return lines.length > 0 && (
              <div className={styles.becauseCard}>
                <div className={styles.becauseEyebrow}>WHY THIS SHAPE</div>
                {lines.map(line => <div key={line} className={styles.becauseLine}>{line}</div>)}
              </div>
            )
          })()}

          <div className={styles.sub}>a starting point, not a verdict — change anything that doesn&apos;t feel right. tap a mode to change it.</div>

          <div className={styles.canvasSectionLabel}>RECOMMENDED CANVAS</div>

          {(() => { let rowIdx = 0
          const rowStyle = () => {
            const visible = rowIdx++ < revealCount
            return { opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(6px)', transition: 'opacity .35s ease, transform .35s ease' }
          }
          return CARD_MODE_ORDER.map(mode => {
            const color           = MODE_COLORS[mode]
            const universalInMode = UNIVERSAL_NEEDS.filter(n => recommendation.universal[n.id] === mode)
            const personalInMode  = PERSONAL_NEEDS.filter(n => recommendation.personal[n.id] === mode)
            const hasNeeds = universalInMode.length > 0 || personalInMode.length > 0

            return (
              <div key={mode} className={styles.modeCard} style={{ borderLeft: `3px solid ${color}` }}>
                <div className={styles.modeCardHeader}>
                  <span className={styles.modeCardName}>{mode}</span>
                </div>
                {hasNeeds && (
                  <div className={styles.needsList}>
                    {universalInMode.map(n => {
                      const dropId  = `u-${n.id}`
                      const uModes  = n.id === 'rest' ? ['nourishment', 'survival'] : MODE_ORDER
                      return (
                        <div key={n.id} className={styles.needRow} style={rowStyle()}>
                          <div className={styles.needName}>{n.name}</div>
                          <ModeDropdown
                            id={dropId}
                            currentMode={recommendation.universal[n.id]}
                            modes={uModes}
                            onSelect={m => setNeedMode('universal', n.id, m)}
                            isOpen={openDropdownId === dropId}
                            onToggle={setOpenDropdownId}
                          />
                        </div>
                      )
                    })}
                    {personalInMode.map(n => {
                      const dropId = `p-${n.id}`
                      return (
                        <div key={n.id} className={styles.needRow} style={rowStyle()}>
                          <div className={styles.needName}>{n.name}</div>
                          <div className={styles.needRowRight}>
                            <ModeDropdown
                              id={dropId}
                              currentMode={recommendation.personal[n.id]}
                              modes={MODE_ORDER}
                              onSelect={m => setNeedMode('personal', n.id, m)}
                              isOpen={openDropdownId === dropId}
                              onToggle={setOpenDropdownId}
                            />
                            <button className={styles.removeBtn} onClick={() => removePersonalNeed(n.id)}>×</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }) })()}

          {addableNeeds.length > 0 && (
            <div className={styles.addWrap}>
              <div className={styles.addLabel}>add more needs</div>
              <div className={styles.addChips}>
                {addableNeeds.map(n => (
                  <div key={n.id} className={styles.addChip} onClick={() => addPersonalNeed(n.id)}>+ {n.name}</div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.howItWorksCard}>
            <div className={styles.howItWorksEyebrow}>HOW THE CANVAS WORKS</div>
            {HOW_IT_WORKS.map(({ mode, color, desc }) => (
              <div key={mode} className={styles.howItWorksRow}>
                <div className={styles.howItWorksPip} style={{ background: color }} />
                <span className={styles.howItWorksName}>{mode}</span>
                <span className={styles.howItWorksDesc}> — {desc}</span>
              </div>
            ))}
          </div>

        </div>
        <div className={styles.footer}>
          <button
            className="btn-primary"
            onClick={() => { saveCanvas(); setDestination('/practices'); setStep(9) }}
          >
            this feels right →
          </button>
          <button
            className="btn-ghost"
            onClick={() => { saveCanvas(); setDestination('/canvas'); setStep(9) }}
          >
            i want to adjust this
          </button>
        </div>
      </div>
    )
  }

  // ── Screen 9: Account ────────────────────────────────────────────────────────
  if (step === 9) {
    return (
      <OnboardingAccount
        destination={destination}
        recommendation={recommendation}
        updateCanvas={updateCanvas}
        onDone={handleAccountDone}
        onBack={() => setStep(8)}
      />
    )
  }

  return null
}
