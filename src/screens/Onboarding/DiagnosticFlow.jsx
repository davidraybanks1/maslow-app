import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { signInNavRef } from '../../lib/store'
import styles from './DiagnosticFlow.module.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = {
  survival:     { name: 'survival',     bg: '#FFF0EC', text: '#D93B1C' },
  nourishment:  { name: 'nourishment',  bg: '#FFF9E0', text: '#8A6A00' },
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
    desc: 'present most days, shaping how thinking, working, and relating to people happens. it runs in the background constantly.',
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

function buildRecommendation({ anxietyLevel, anxietyType, energyGives, energyDrains, season, alwaysNeedId, canWait }) {
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

  if (alwaysNeedId) {
    if (alwaysNeedId === 'rest') {
      universal.rest = 'nourishment'
    } else if (alwaysNeedId === 'movement' || alwaysNeedId === 'nutrition') {
      universal[alwaysNeedId] = 'exploration'
    } else {
      personal[alwaysNeedId] = 'exploration'
    }
  }

  for (const needId of (canWait || [])) {
    if (needId !== alwaysNeedId) delete personal[needId]
  }

  return { universal, personal }
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

function OnboardingAccount({ destination, recommendation, updateCanvas, onDone }) {
  const [mode, setMode]             = useState('create')

  // Create form
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [phone, setPhone]           = useState('')
  const [smsEnabled, setSmsEnabled] = useState(false)

  // Sign-in form
  const [siEmail, setSiEmail]       = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [magicSent, setMagicSent]   = useState(false)
  const [resetSent, setResetSent]   = useState(false)

  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  async function handleSignUp() {
    setLoading(true)
    setError(null)
    signInNavRef.skip = true

    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authErr) {
      signInNavRef.skip = false
      setError(authErr.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (userId && recommendation) {
      const canvasObj = { ...recommendation.universal, ...recommendation.personal }
      await supabase.from('users').upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        phone: phone.trim() || null,
        canvas: canvasObj,
        onboarded: true,
        profile: { smsEnabled: smsEnabled && !!phone.trim() },
      }, { onConflict: 'id' })

      for (const [needId, m] of Object.entries(canvasObj)) {
        updateCanvas(needId, m)
      }
    }

    setLoading(false)
    onDone(destination)
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
        <div className={styles.content}>
          <div className={styles.eyebrow}>SAVE YOUR CANVAS</div>
          <div className={styles.headline}>create your account.</div>
          <div className={styles.sub}>your canvas, practices, and data are tied to your account. takes 30 seconds.</div>

          <div className={styles.accountForm}>
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
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className={styles.accountInput}
              type="password"
              placeholder="create a password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div>
              <input
                className={styles.accountInput}
                type="tel"
                placeholder="phone number (optional)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoComplete="tel"
              />
              {smsEnabled && !phone.trim() && (
                <div className={styles.inputErrorNote}>add a phone number to enable reminders</div>
              )}
            </div>
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.toggleLabels}>
              <div className={styles.toggleLabel}>daily check-in reminders</div>
              <div className={styles.toggleSub}>a gentle nudge three times a day</div>
            </div>
            <div className={styles.toggleSwitch} onClick={() => setSmsEnabled(p => !p)}>
              <div className={`${styles.toggleTrack} ${smsEnabled ? styles.toggleTrackOn : ''}`}>
                <div className={`${styles.toggleThumb} ${smsEnabled ? styles.toggleThumbOn : ''}`} />
              </div>
            </div>
          </div>

          {error && <div className={styles.formError}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button className="btn-primary" onClick={handleSignUp} disabled={!canSubmit || loading}>
            {loading ? 'creating account…' : 'create account →'}
          </button>
          <div className={styles.authToggle} onClick={() => { setMode('signin'); setError(null) }}>
            already have an account? sign in
          </div>
          <div className={styles.skipLink} onClick={() => onDone(destination)}>
            skip for now — i'll save my account later
          </div>
        </div>
      </div>
    )
  }

  // ── Sign-in mode ──
  const canSignIn = siEmail.trim() && siPassword.length > 0

  return (
    <div className={styles.screen}>
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
        <div className={styles.skipLink} onClick={() => onDone(destination)}>
          skip for now — i'll save my account later
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiagnosticFlow({ updateCanvas, completeOnboarding }) {
  const navigate = useNavigate()
  const [step, setStep]                     = useState(0)
  const [destination, setDestination]       = useState('/practices')

  const [anxietyLevel, setAnxietyLevel]     = useState(null)
  const [anxietyType, setAnxietyType]       = useState(null)
  const [energyMap, setEnergyMap]           = useState({})
  const [season, setSeason]                 = useState(null)
  const [alwaysMatters, setAlwaysMatters]   = useState(null)
  const [canWait, setCanWait]               = useState([])
  const [recommendation, setRecommendation] = useState(null)
  const [openDropdownId, setOpenDropdownId] = useState(null)

  function cycleSituation(s) {
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
    setCanWait(prev => prev.includes(needId) ? prev.filter(id => id !== needId) : [...prev, needId])
  }

  function goToCanvas() {
    const alwaysNeedId = ALWAYS_MATTERS_TO_NEED[alwaysMatters] || alwaysMatters
    const energyGives  = Object.entries(energyMap).filter(([, v]) => v === 'gives').map(([k]) => k)
    const energyDrains = Object.entries(energyMap).filter(([, v]) => v === 'drains').map(([k]) => k)
    const rec = buildRecommendation({ anxietyLevel, anxietyType, energyGives, energyDrains, season, alwaysNeedId, canWait })
    setRecommendation(rec)
    setStep(7)
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

  function handleAccountDone(dest) {
    if (completeOnboarding) completeOnboarding()
    navigate(dest)
  }

  const energyMapValid = Object.values(energyMap).includes('gives') && Object.values(energyMap).includes('drains')

  // ── Screen 0: Opening ────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.welcomeHeader}>
          <MaslowMark />
          <span className={styles.welcomeWordmark}>maslow.</span>
        </div>
        <div className={styles.logoHairline} />
        <div className={styles.welcomeBody}>
          <div className={styles.welcomeWrap}>
            <div className={styles.headline}>
              meet your needs.<br />
              <em>become more of yourself.</em>
            </div>
            <div className={styles.bodyText}>
              maslow identifies your needs, determines to what degree each one should be met, and surfaces the daily practices that express them.
            </div>
            <div className={styles.bodyText}>
              to get started, give thoughtful, honest answers to the following questions and maslow will propose a canvas tailored to you.
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoCardEyebrow}>WHAT YOU GET</div>
              <div className={styles.infoRow}><span className={styles.infoTerm}>a canvas</span> — your needs, each with a mode that sets the daily expectation</div>
              <div className={styles.infoRow}><span className={styles.infoTerm}>a practice library</span> — the specific things you do each day to meet each need</div>
              <div className={styles.infoRow}><span className={styles.infoTerm}>data</span> — patterns that show what's working and what's costing you.</div>
            </div>
            <div className={styles.mutedNote} style={{ marginTop: 16 }}>takes about 5 minutes.</div>
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
          <div className={styles.eyebrow}>STEP 1 OF 6 — ANXIETY</div>
          <div className={styles.headline}>what's your relationship with anxiety?</div>
          <div className={styles.sub}>be honest — there's no right answer. this shapes how much stabilizing work the canvas needs to do.</div>
          <div className={styles.options}>
            {ANXIETY_LEVEL_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.optionCard} ${anxietyLevel === opt.id ? styles.optionCardSelected : ''}`}
                onClick={() => setAnxietyLevel(opt.id)}
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
          <div className={styles.eyebrow}>STEP 2 OF 6 — ANXIETY TYPE</div>
          <div className={styles.headline}>how does anxiety tend to show up?</div>
          <div className={styles.sub}>one of these is probably more familiar than the others.</div>
          <div className={styles.options}>
            {ANXIETY_TYPE_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.optionCard} ${anxietyType === opt.id ? styles.optionCardSelected : ''}`}
                onClick={() => setAnxietyType(opt.id)}
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
        <div className={styles.content}>
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
            {ENERGY_SITUATIONS.map(s => {
              const state = energyMap[s]
              return (
                <div
                  key={s}
                  className={`${styles.situationCard} ${state === 'gives' ? styles.situationCardGives : state === 'drains' ? styles.situationCardDrains : ''}`}
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
          <div className={styles.eyebrow}>STEP 4 OF 6 — YOUR SEASON</div>
          <div className={styles.headline}>what's the most accurate picture of right now?</div>
          <div className={styles.sub}>seasons change. the canvas should reflect where things actually are, not where they'd ideally be.</div>
          <div className={styles.twoColGrid}>
            {SEASON_OPTIONS.map(s => (
              <div
                key={s}
                className={`${styles.gridCard} ${season === s ? styles.gridCardSelected : ''}`}
                onClick={() => setSeason(s)}
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

  // ── Screen 5: Always matters ─────────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[4]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(4)}>← back</button>
          <div className={styles.eyebrow}>STEP 5 OF 6 — WHAT ALWAYS MATTERS</div>
          <div className={styles.headline}>no matter the season — what's non-negotiable?</div>
          <div className={styles.sub}>this becomes the exploration need. the one thing that gets the deepest daily commitment. choose one.</div>
          <div className={styles.twoColGrid}>
            {ALWAYS_MATTERS_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.needGridCard} ${alwaysMatters === opt.id ? styles.needGridCardSelected : ''}`}
                onClick={() => setAlwaysMatters(opt.id)}
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

  // ── Screen 6: Can wait ───────────────────────────────────────────────────────
  if (step === 6) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[5]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(5)}>← back</button>
          <div className={styles.eyebrow}>STEP 6 OF 6 — WHAT CAN WAIT</div>
          <div className={styles.headline}>what's not calling for attention right now?</div>
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

  // ── Screen 7: Canvas reveal ──────────────────────────────────────────────────
  if (step === 7 && recommendation) {
    const addableNeeds = PERSONAL_NEEDS.filter(n => !(n.id in recommendation.personal))

    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[6]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(6)}>← back</button>
          <div className={styles.eyebrow}>YOUR CANVAS</div>
          <div className={styles.headline}>here's what we're working with.</div>
          <div className={styles.sub}>needs are placed in modes that determine how much daily energy each one gets. tap any mode to change it.</div>

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

          <div className={styles.canvasSectionLabel}>RECOMMENDED CANVAS</div>

          {CARD_MODE_ORDER.map(mode => {
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
                        <div key={n.id} className={styles.needRow}>
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
                        <div key={n.id} className={styles.needRow}>
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
                {addableNeeds.length > 0 && (
                  <div className={styles.addWrap}>
                    <div className={styles.addLabel}>add a need</div>
                    <div className={styles.addChips}>
                      {addableNeeds.map(n => (
                        <div key={n.id} className={styles.addChip} onClick={() => addPersonalNeed(n.id, mode)}>+ {n.name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

        </div>
        <div className={styles.footer}>
          <button
            className="btn-primary"
            onClick={() => { saveCanvas(); setDestination('/practices'); setStep(8) }}
          >
            this feels right →
          </button>
          <button
            className="btn-ghost"
            onClick={() => { saveCanvas(); setDestination('/canvas'); setStep(8) }}
          >
            i want to adjust this
          </button>
        </div>
      </div>
    )
  }

  // ── Screen 8: Account ────────────────────────────────────────────────────────
  if (step === 8) {
    return (
      <OnboardingAccount
        destination={destination}
        recommendation={recommendation}
        updateCanvas={updateCanvas}
        onDone={handleAccountDone}
      />
    )
  }

  return null
}
