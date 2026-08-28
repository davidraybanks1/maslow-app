import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { signInNavRef, seedStarterContent, logSupabaseError } from '../../lib/store'
import { STARTER_PRACTICES } from '../../lib/starterContent'
import { hapticTick } from '../../lib/native'
import OtpDisclosure from '../../components/OtpDisclosure'
import styles from './DiagnosticFlow.module.css'
import BrandMark from '../../components/BrandMark'
import CanvasScreen from '../CanvasScreen'
import { MODE_NEED_CAP, MODE_DESCS } from '../../lib/constants'

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

const LEGEND_DESCS = {
  exploration:  'the one need that gives you energy',
  appreciation: 'the needs that bring joy',
  nourishment:  'the needs that keep you from running empty',
  survival:     'the needs you just check the box on',
}

const UNIVERSAL_IDS = new Set(['movement', 'nutrition', 'rest'])

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
    desc: 'everything feels urgent at once; you move fast and land nowhere.',
  },
  {
    id: 'overwhelm',
    name: 'overwhelmed',
    desc: "big and small things can become the single focus of a day, even though you know they shouldn't.",
  },
  {
    id: 'apathy',
    name: 'apathetic',
    desc: 'You just feel bored and question why the things you do matter.',
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

const FLEXIBILITY_OPTIONS = [
  {
    id: 'low',
    name: 'very little',
    desc: 'life is full and margins are thin. too much change at once will create more stress.',
    tag: 'start with 6–8 practices',
    tagBg: 'rgba(217,59,28,0.08)',
    tagColor: '#993C1D',
  },
  {
    id: 'mid',
    name: 'some',
    desc: "there's room for intentional change but it has to stay realistic and sustainable.",
    tag: 'start with 7–8 practices',
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

// Steps 1–6 show a progress bar; PROGRESS[step - 1]
const PROGRESS = [17, 33, 50, 67, 83, 100]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function modeRank(mode) {
  return { survival: 0, nourishment: 1, appreciation: 2, exploration: 3 }[mode] ?? -1
}

// Daily practice count per mode (for canvas budget estimation — distinct from
// the scoring weights in constants.js which use equal weights for all modes).
const MODE_DAILY_PRACTICES = { exploration: 3, appreciation: 2, nourishment: 1, survival: 0.5 }
const FLEX_MAX = { low: 9, mid: 9, high: 10 }
const DROP_ORDER = ['money', 'dwelling', 'thrill', 'touch', 'intimacy', 'play', 'information', 'beauty', 'reflection', 'community']

function practiceWeight(canvasObj) {
  return Object.values(canvasObj).reduce((sum, mode) => sum + (MODE_DAILY_PRACTICES[mode] || 0), 0)
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

function capPersonalNeeds(universal, personal, maxTotal, protectedId, alsoProtectedId) {
  const budget = maxTotal - practiceWeight(universal)
  let total = practiceWeight(personal)
  for (const id of DROP_ORDER) {
    if (total <= budget) break
    if (id === protectedId || id === alsoProtectedId) continue
    if (personal[id]) {
      total -= MODE_DAILY_PRACTICES[personal[id]] || 0
      delete personal[id]
    }
  }
}

// Demote overflowing needs to the nearest mode that still has room.
// capPersonalNeeds removes whole needs to hit the practice budget; it does not
// enforce per-mode head counts. Seasons and energy signals can independently
// push nourishment (cap 3) above its limit. Exploration is excluded — it is
// capped at 1 by construction and never overflows. rest is never promoted to
// appreciation — the generator already forces it to nourishment or below.
// Target selection is budget-aware: prefer a target that keeps the daily-practice
// total within budget; if none does, take the cheapest available target so the
// second capPersonalNeeds pass only needs to drop at most one need, not two.
function rebalanceToCaps(universal, personal, budget) {
  const countIn = mode =>
    Object.values({ ...universal, ...personal }).filter(v => v === mode).length
  const setMode = (id, mode) => {
    if (id in universal) universal[id] = mode; else personal[id] = mode
  }
  const weight = () => practiceWeight(universal) + practiceWeight(personal)

  for (const mode of ['nourishment', 'appreciation', 'survival']) {
    let guard = 0
    while (countIn(mode) > MODE_NEED_CAP[mode] && guard++ < 20) {
      const all    = { ...universal, ...personal }
      const inMode = Object.keys(all).filter(id => all[id] === mode)
      const moveId = inMode.slice().sort((a, b) => {
        const ia = DROP_ORDER.indexOf(a), ib = DROP_ORDER.indexOf(b)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      })[0]
      if (!moveId) break

      const isRest = moveId === 'rest'
      const here   = MODE_DAILY_PRACTICES[mode] || 0
      const cands  = ['appreciation', 'survival', 'nourishment'].filter(t =>
        t !== mode &&
        countIn(t) < MODE_NEED_CAP[t] &&
        !(isRest && t === 'appreciation')
      )
      // Prefer a target that keeps the daily-practice budget intact. If none
      // does, take the cheapest and let capPersonalNeeds settle the remainder.
      const affordable = cands.filter(t =>
        weight() - here + (MODE_DAILY_PRACTICES[t] || 0) <= budget
      )
      const target = affordable[0] ?? cands.slice().sort((a, b) =>
        (MODE_DAILY_PRACTICES[a] || 0) - (MODE_DAILY_PRACTICES[b] || 0)
      )[0]
      if (!target) break
      setMode(moveId, target)
    }
  }
}

// When alwaysNeedId is 'rest' (which can never be exploration), pick the best
// personal need from the user's energyGives signals, then fall back to whatever
// is already in personal, then fall back to the first FILL_ORDER slot available.
function fallbackExploration(personal, energyGives) {
  const candidates = []
  if (energyGives.includes('creative output'))        candidates.push('beauty')
  if (energyGives.includes('learning something new')) candidates.push('information')
  if (energyGives.includes('deep 1:1 conversations')) candidates.push('community')
  for (const id of candidates) {
    personal[id] = 'exploration'
    return id
  }
  for (const id of FILL_ORDER) {
    if (personal[id]) { personal[id] = 'exploration'; return id }
  }
  for (const id of FILL_ORDER) {
    if (!personal[id]) { personal[id] = 'exploration'; return id }
  }
  return null
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

  function applySeason(name) {
    if (name === 'career building') {
      if (!personal.information) personal.information = 'nourishment'
      if (!personal.reflection)  personal.reflection  = anxietyType === 'frenetic' ? 'appreciation' : 'nourishment'
    } else if (name === 'family first') {
      if (!personal.community || modeRank(personal.community) < modeRank('appreciation')) personal.community = 'appreciation'
    } else if (name === 'health focus') {
      if (modeRank(universal.movement) < modeRank('appreciation')) universal.movement = 'appreciation'
    } else if (name === 'in transition' || name === 'rebuilding') {
      if (!personal.reflection) personal.reflection = 'nourishment'
      if (!personal.money)      personal.money      = 'survival'
      if (!personal.dwelling)   personal.dwelling   = 'survival'
    } else if (name === 'creative pursuit') {
      if (!personal.beauty || modeRank(personal.beauty) < modeRank('appreciation')) personal.beauty = 'appreciation'
    } else if (name === 'caregiving') {
      if (modeRank(universal.rest) < modeRank('nourishment')) universal.rest = 'nourishment'
      if (!personal.community) personal.community = 'nourishment'
    } else if (name === 'finding direction') {
      if (!personal.reflection) personal.reflection = 'nourishment'
    }
  }
  // Primary season first so its signals win; secondary only fills what primary left open.
  const seasons = Array.isArray(season) ? season : (season ? [season] : [])
  seasons.forEach(s => applySeason(s))

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

  // Exploration is mandatory for every flexibility level. rest can never be exploration
  // (enforced above at line ~338), so we pick the best personal fallback instead.
  let explorationPersonalId = null
  if (alwaysNeedId) {
    if (alwaysNeedId === 'rest') {
      universal.rest = 'nourishment'
      explorationPersonalId = fallbackExploration(personal, energyGives)
    } else if (isUniversalAlways) {
      universal[alwaysNeedId] = 'exploration'
    } else {
      personal[alwaysNeedId] = 'exploration'
      explorationPersonalId = alwaysNeedId
    }
  }

  // De-duplicate: if another pathway (e.g. frenetic) already set a personal need to exploration,
  // demote it so there is exactly one exploration need on the canvas.
  if (alwaysNeedId) {
    for (const id of Object.keys(personal)) {
      if (personal[id] === 'exploration' && id !== explorationPersonalId) {
        personal[id] = 'appreciation'
      }
    }
  }

  // canWait deletions — never remove the need holding exploration.
  const skipFromCanWait = explorationPersonalId ?? alwaysNeedId
  for (const needId of (canWait || [])) {
    if (needId !== skipFromCanWait) delete personal[needId]
  }

  const maxTotal = FLEX_MAX[flexibility] || FLEX_MAX.high

  // Ensure at least one appreciation need survives; protect both it and the exploration need
  // so capPersonalNeeds cannot silently remove either.
  let appreciationId = null
  if (flexibility === 'low' || flexibility === 'mid') {
    appreciationId = ensureAppreciation(universal, personal, explorationPersonalId ?? alwaysNeedId)
  }

  capPersonalNeeds(universal, personal, maxTotal, explorationPersonalId, appreciationId)

  rebalanceToCaps(universal, personal, maxTotal)

  // rebalanceToCaps can increase practice weight when the only affordable target
  // is more expensive. Re-enforce the budget without creating new mode-cap
  // violations — only drops unprotected personal needs, never demotes a mode.
  capPersonalNeeds(universal, personal, maxTotal, explorationPersonalId, appreciationId)

  return { universal, personal }
}

// ─── Session persistence (answers survive a mid-flow refresh) ────────────────

const SS_KEY = 'maslow_onboarding_v1'

function loadSavedAnswers() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SS_KEY)) || {}
    // Clamp step values from removed screens so users resuming a pre-change session
    // don't land on a branch that no longer exists.
    if (s.step === 'breath') s.step = 3
    if (s.step === 7) s.step = 8
    return s
  } catch { return {} }
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
  frenetic:  'Because frenetic is how anxiety presents itself, your canvas gives reflection the deepest commitment — clarity before more to-dos.',
  overwhelm: 'Because overwhelm is how anxiety presents itself, your canvas focuses on small, steady, provable wins.',
  apathy:    'Because apathy is how anxiety presents itself, beauty and play carry extra weight — feeling something comes first.',
}

function becauseLines({ anxietyType, alwaysNeedId, flexibility }) {
  const lines = []
  if (BECAUSE_TYPE[anxietyType]) lines.push(BECAUSE_TYPE[anxietyType])
  if (alwaysNeedId && NEED_NAMES[alwaysNeedId]) {
    const n = NEED_NAMES[alwaysNeedId]
    const cap = n[0].toUpperCase() + n.slice(1)
    lines.push(flexibility === 'low'
      ? `${cap} is your flow state, so it sits in exploration where it gets the most room. Margins are thin right now, so the canvas starts small on purpose.`
      : `${cap} is your flow state, so it sits in exploration where it gets the most room.`)
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

// ─── Account screen (final step) ─────────────────────────────────────────────

function OnboardingAccount({ destination, recommendation, updateCanvas, practicesDraft, onDone, onBack }) {
  const navigate = useNavigate()
  const [mode, setMode]             = useState('create')

  // Create form
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  // Sign-in form
  const [siEmail, setSiEmail]       = useState('')
  const [siPassword, setSiPassword] = useState('')

  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [duplicateAccount, setDuplicateAccount] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    setError(null)
    setDuplicateAccount(false)
    signInNavRef.skip = true

    // Step 1: sign up — take user and session from the response directly.
    // A separate getUser() call can race before the new session is attached.
    const { data: signUpData, error: authErr } = await supabase.auth.signUp({
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

    // Step 2: email confirmation is enabled — no session, nothing authenticated can run.
    if (!signUpData.session) {
      signInNavRef.skip = false
      setLoading(false)
      setError('check your email to confirm your account, then sign in.')
      return
    }

    const userId = signUpData.user?.id
    let canvasObj = null

    if (userId && recommendation) {
      canvasObj = { ...recommendation.universal, ...recommendation.personal }
      const profileRow = {
        id: userId,
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        canvas: canvasObj,
        onboarded: true,
        onboarded_at: new Date().toLocaleDateString('en-CA'),
      }

      // Step 3: upsert the profile row; retry once on failure (session propagation lag).
      let { error: upsertErr } = await supabase.from('users').upsert(profileRow, { onConflict: 'id' })
      if (upsertErr) {
        logSupabaseError('handleSignUp upsert attempt 1', upsertErr)
        await new Promise(r => setTimeout(r, 400))
        const retry = await supabase.from('users').upsert(profileRow, { onConflict: 'id' })
        upsertErr = retry.error
        if (upsertErr) logSupabaseError('handleSignUp upsert attempt 2', upsertErr)
      }

      // Step 4: read the row back to confirm the write landed.
      const { data: confirmRow } = await supabase.from('users').select('id').eq('id', userId).maybeSingle()

      // Step 5: abort visibly if the profile row isn't there — a ghost account
      // that works on this device only is worse than a visible failure.
      if (!confirmRow) {
        signInNavRef.skip = false
        setLoading(false)
        setError('account setup didn\'t complete — please try again.')
        return
      }

      const seeded = await seedStarterContent(userId, canvasObj, practicesDraft)
      setLoading(false)
      // Pass canvasObj and seeded rows so handleAccountDone can populate both
      // canvas and practicesDB in completeOnboarding before navigating.
      onDone(destination, userId, canvasObj, seeded)
      return
    }

    setLoading(false)
    onDone(destination, userId, canvasObj, null)
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
          <OtpDisclosure
            email={siEmail}
            onSuccess={() => navigate('/password')}
            linkClass={styles.authSecondaryLink}
            hairlineClass={styles.authHairline}
          />
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
  const [destination, setDestination]       = useState('/today')

  const [anxietyLevel, setAnxietyLevel]     = useState(saved.anxietyLevel ?? null)
  const [anxietyType, setAnxietyType]       = useState(saved.anxietyType ?? null)
  const [energyMap, setEnergyMap]           = useState(saved.energyMap ?? {})
  const [season, setSeason]                 = useState(() => { const s = saved.season ?? null; return typeof s === 'string' ? [s] : s })
  const [flexibility, setFlexibility]       = useState(saved.flexibility ?? null)
  const [alwaysMatters, setAlwaysMatters]   = useState(saved.alwaysMatters ?? null)
  // A refresh at the reveal/account step rebuilds the recommendation from saved answers.
  const [recommendation, setRecommendation] = useState(() => ((saved.step ?? 0) >= 8 ? rebuildFromSaved(saved) : null))
  const [canvasIntroSeen, setCanvasIntroSeen] = useState(() => !!(loadSavedAnswers().canvasIntroSeen))
  const [practicesDraft, setPracticesDraft]   = useState(() => loadSavedAnswers().practicesDraft ?? {})

  const contentRef = useRef(null)
  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0 }, [step])

  // Persist answers as they're given — five minutes of honesty shouldn't die on a refresh.
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        step: typeof step === 'number' ? step : 3,
        anxietyLevel, anxietyType, energyMap, season, flexibility, alwaysMatters,
        canvasIntroSeen, practicesDraft,
      }))
    } catch {}
  }, [step, anxietyLevel, anxietyType, energyMap, season, flexibility, alwaysMatters, canvasIntroSeen, practicesDraft])

  function dismissCanvasIntro() {
    setCanvasIntroSeen(true)
  }

  useEffect(() => {
    if (step !== 8 || canvasIntroSeen) return
    function onKey(e) { if (e.key === 'Escape') dismissCanvasIntro() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canvasIntroSeen])

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

  function toggleSeason(s) {
    hapticTick()
    setSeason(prev => {
      if (!prev) return [s]
      const idx = prev.indexOf(s)
      if (idx !== -1) {
        const next = prev.filter(x => x !== s)
        return next.length === 0 ? null : next
      }
      if (prev.length < 2) return [...prev, s]
      return [prev[0], s]
    })
  }

  function goToCanvas() {
    const alwaysNeedId = ALWAYS_MATTERS_TO_NEED[alwaysMatters] || alwaysMatters
    const energyGives  = Object.entries(energyMap).filter(([, v]) => v === 'gives').map(([k]) => k)
    const energyDrains = Object.entries(energyMap).filter(([, v]) => v === 'drains').map(([k]) => k)
    const rec = buildRecommendation({ anxietyLevel, anxietyType, energyGives, energyDrains, season, alwaysNeedId, canWait: [], flexibility })
    setRecommendation(rec)
    setStep(8)
  }

  function saveCanvas() {
    for (const [needId, mode] of Object.entries(recommendation.universal)) updateCanvas(needId, mode)
    for (const [needId, mode] of Object.entries(recommendation.personal))  updateCanvas(needId, mode)
  }

  function addPracticeLocal(needId, label) {
    setPracticesDraft(prev => {
      const current = prev[needId] ?? STARTER_PRACTICES[needId] ?? []
      if (current.length >= 10) return prev
      return { ...prev, [needId]: [...current, label] }
    })
  }

  function renamePracticeLocal(practiceId, newLabel) {
    const lastUnderscore = practiceId.lastIndexOf('_')
    const needId = practiceId.slice(0, lastUnderscore)
    const index = parseInt(practiceId.slice(lastUnderscore + 1), 10)
    setPracticesDraft(prev => {
      const current = prev[needId] ?? STARTER_PRACTICES[needId] ?? []
      const updated = [...current]
      updated[index] = newLabel
      return { ...prev, [needId]: updated }
    })
  }

  function archivePracticeLocal(practiceId) {
    const lastUnderscore = practiceId.lastIndexOf('_')
    const needId = practiceId.slice(0, lastUnderscore)
    const index = parseInt(practiceId.slice(lastUnderscore + 1), 10)
    setPracticesDraft(prev => {
      const current = prev[needId] ?? STARTER_PRACTICES[needId] ?? []
      return { ...prev, [needId]: current.filter((_, i) => i !== index) }
    })
  }

  function handleAccountDone(dest, userId, canvas, seeded) {
    try { sessionStorage.removeItem(SS_KEY) } catch {}
    // Pass canvas and seeded practicesDB so state is fully populated before navigation,
    // without waiting for a reload or the SIGNED_IN restoreFromSupabase path.
    if (completeOnboarding) completeOnboarding(
      canvas || null,
      seeded?.practices || null,
      userId ? { userId } : undefined,
      seeded?.practicesDB || null,
      seeded?.noteDeck || null,
    )
    navigate(dest)
  }

  const energyMapValid = Object.values(energyMap).includes('gives') && Object.values(energyMap).includes('drains')

  // ── Screen 0: Opening ────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.welcomeHeader}>
          <BrandMark size={18} dark />
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
              <p style={{ margin: 0 }}>Anxiety fills the space you give it. MyMaslow helps you take it back.</p>
              <p style={{ margin: '12px 0 0' }}>Answer a few questions to tailor your experience.</p>
            </div>
            <div className={styles.mutedNote} style={{ marginTop: 16 }}>Takes about 5 minutes. Your answers stay yours.</div>
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(1)}>let's start →</button>
          <div className={styles.signInPrompt}>
            already have an account? <span className={styles.signInLink} onClick={() => navigate('/signin')}>sign in →</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Screen 1: Anxiety level ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[0]} />
        <div className={styles.content} ref={contentRef}>
          <button className={styles.backBtn} onClick={() => setStep(0)}>← back</button>
          <div className={styles.eyebrow}>STEP 1 OF 6 — ANXIETY PRESENCE</div>
          <div className={styles.headline}>what's your relationship with anxiety?</div>
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
        <div className={styles.content} ref={contentRef}>
          <button className={styles.backBtn} onClick={() => setStep(1)}>← back</button>
          <div className={styles.eyebrow}>STEP 2 OF 6 — ANXIETY EXPERIENCE</div>
          <div className={styles.headline}>how does anxiety usually make you feel?</div>
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
          <button className="btn-primary" onClick={() => setStep(3)} disabled={!anxietyType}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 3: Energy map ─────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[2]} />
        <div className={styles.content} ref={contentRef}>
          <button className={styles.backBtn} onClick={() => setStep(2)}>← back</button>
          <div className={styles.eyebrow}>STEP 3 OF 6 — ENERGY MAP</div>
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
        <div className={styles.content} ref={contentRef}>
          <button className={styles.backBtn} onClick={() => setStep(3)}>← back</button>
          <div className={styles.eyebrow}>STEP 4 OF 6 — YOUR SEASON</div>
          <div className={styles.headline}>what does life look like right now?</div>
          <div className={styles.sub}>seasons change. goals evolve. choose two — your first matters most.</div>
          <div className={styles.twoColGrid}>
            {SEASON_OPTIONS.map(s => {
              const posIdx = season ? season.indexOf(s) : -1
              const posNum = posIdx !== -1 ? posIdx + 1 : null
              return (
                <div
                  key={s}
                  className={`${styles.gridCard} ${posNum !== null ? styles.gridCardSelectedNum : ''}`}
                  onClick={() => toggleSeason(s)}
                >
                  {posNum !== null && <span className={styles.seasonBadge}>{posNum}</span>}
                  {s}
                </div>
              )
            })}
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(5)} disabled={!season || season.length !== 2}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 5: Hidden gem (what puts you in flow) ────────────────────────────
  if (step === 5) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[4]} />
        <div className={styles.content} ref={contentRef}>
          <button className={styles.backBtn} onClick={() => setStep(4)}>← back</button>
          <div className={styles.eyebrow}>STEP 5 OF 6 — FLOW STATE</div>
          <div className={styles.headline}>what makes you feel most yourself?</div>
          <div className={styles.sub}>What puts you in your most natural state, after which you feel recharged.</div>
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
          <button className="btn-primary" onClick={() => setStep(6)} disabled={!alwaysMatters}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 6: Flexibility ────────────────────────────────────────────────────
  if (step === 6) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[5]} />
        <div className={styles.content} ref={contentRef}>
          <button className={styles.backBtn} onClick={() => setStep(5)}>← back</button>
          <div className={styles.eyebrow}>STEP 6 OF 6 — FLEXIBILITY</div>
          <div className={styles.headline}>how much room do you have to make change right now?</div>
          <div className={styles.sub}>this determines how many practices to start with. starting too many at once is its own form of overwhelm.</div>
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
          <button className="btn-primary" onClick={goToCanvas} disabled={!flexibility}>continue →</button>
        </div>
      </div>
    )
  }

  // ── Screen 8: Canvas reveal ──────────────────────────────────────────────────
  if (step === 8 && recommendation) {
    const canvasObj = { ...recommendation.universal, ...recommendation.personal }
    const practicesForCanvas = {}
    for (const id of Object.keys(canvasObj)) {
      practicesForCanvas[id] = practicesDraft[id] ?? STARTER_PRACTICES[id] ?? []
    }

    function updateRecommendedCanvas(needId, mode) {
      const section = UNIVERSAL_IDS.has(needId) ? 'universal' : 'personal'
      setRecommendation(prev => {
        const next = { ...prev[section] }
        if (mode == null) delete next[needId]
        else next[needId] = mode
        return { ...prev, [section]: next }
      })
    }

    const lines = becauseLines({ anxietyType, alwaysNeedId: ALWAYS_MATTERS_TO_NEED[alwaysMatters] || alwaysMatters, flexibility })

    return (
      <>
        <CanvasScreen
          onboarding
          state={{ canvas: canvasObj, practices: practicesForCanvas, practicesDB: [], checkins: {}, moods: [] }}
          updateCanvas={updateRecommendedCanvas}
          addPractice={addPracticeLocal}
          renamePractice={renamePracticeLocal}
          archivePractice={archivePracticeLocal}
          header={<>
            <ProgressBar pct={PROGRESS[5]} />
            <button className={styles.backBtn} onClick={() => setStep(6)}>← back</button>
          </>}
          banner={lines.length > 0 && (
            <div className={styles.becauseCard}>
              <div className={styles.becauseEyebrow}>WHY THIS SHAPE</div>
              {lines.map(line => <div key={line} className={styles.becauseLine}>{line}</div>)}
            </div>
          )}
          footer={
            <div className={styles.footer}>
              <button
                className="btn-primary"
                onClick={() => { saveCanvas(); setDestination('/today'); setStep(9) }}
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
          }
        />
        {!canvasIntroSeen && (
          <>
            <div className={styles.canvasIntroScrim} onClick={dismissCanvasIntro} />
            <div className={styles.canvasIntroSheet} role="dialog" aria-modal="true">
              <p className={styles.canvasIntroHeading}>your canvas.</p>
              <div className={styles.canvasIntroBody}>
                <p>Your canvas creates the right shape for your days. Each need sits in a mode, and the mode determines how many daily practices it gets.</p>
                <div className={styles.canvasIntroLegend}>
                  {CARD_MODE_ORDER.map(m => (
                    <div key={m} className={styles.canvasIntroLegendRow}>
                      <span className={styles.canvasIntroSwatch} style={{ background: MODE_COLORS[m] }} />
                      <span>
                        <span className={styles.canvasIntroModeName}>{m}</span>
                        <span className={styles.canvasIntroModeDesc}> — {LEGEND_DESCS[m]}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p>You can tweak your canvas now, or at any time.</p>
              </div>
              <button className={styles.canvasIntroDismiss} onClick={dismissCanvasIntro}>got it</button>
            </div>
          </>
        )}
      </>
    )
  }

  // ── Screen 9: Account ────────────────────────────────────────────────────────
  if (step === 9) {
    return (
      <OnboardingAccount
        destination={destination}
        recommendation={recommendation}
        updateCanvas={updateCanvas}
        practicesDraft={practicesDraft}
        onDone={handleAccountDone}
        onBack={() => setStep(8)}
      />
    )
  }

  return null
}
