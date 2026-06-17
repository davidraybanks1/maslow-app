import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  { id: 'money',       name: 'money' },
  { id: 'dwelling',    name: 'dwelling' },
  { id: 'touch',       name: 'touch' },
  { id: 'information', name: 'information' },
  { id: 'play',        name: 'play' },
  { id: 'community',   name: 'community' },
  { id: 'beauty',      name: 'beauty' },
  { id: 'thrill',      name: 'thrill' },
]

const HOW_IT_WORKS = [
  { mode: 'exploration',  color: '#1B3A2D', desc: 'deepest commitment — 3 practices a day' },
  { mode: 'appreciation', color: '#B8C3B1', desc: 'present and intentional — 2 practices a day' },
  { mode: 'nourishment',  color: '#E8B81F', desc: 'steady and reliable — 1 practice a day' },
  { mode: 'survival',     color: '#D93B1C', desc: 'the floor that frees everything else — 1 practice, half weight' },
]

const PROGRESS = [16, 33, 50, 66, 83, 100]

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
  const universal = {
    movement:  'survival',
    nutrition: 'survival',
    rest:      'nourishment',
  }
  const personal = {}

  // Anxiety type base rules
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

  // Anxiety level modifiers
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

  // Season modifiers
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

  // Energy gives
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

  // Energy drains (caps)
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

  // Defaults
  if (!personal.money)    personal.money    = 'survival'
  if (!personal.dwelling) personal.dwelling = 'survival'

  // Ensure at least one meaningful personal need beyond money/dwelling
  const meaningful = Object.keys(personal).filter(id => id !== 'money' && id !== 'dwelling')
  if (meaningful.length === 0) {
    const fill = FILL_ORDER.find(id => !personal[id])
    if (fill) personal[fill] = anxietyType === 'overwhelm' ? 'nourishment' : 'appreciation'
  }

  // Rest cap
  if (modeRank(universal.rest) > modeRank('nourishment')) universal.rest = 'nourishment'

  // Always matters → exploration override
  if (alwaysNeedId) {
    if (alwaysNeedId === 'rest') {
      universal.rest = 'nourishment'
    } else if (alwaysNeedId === 'movement' || alwaysNeedId === 'nutrition') {
      universal[alwaysNeedId] = 'exploration'
    } else {
      personal[alwaysNeedId] = 'exploration'
    }
  }

  // Can wait → remove from canvas
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

function ModePill({ needId, mode, onCycle }) {
  const m = MODES[mode]
  return (
    <button className={styles.modePill} style={{ background: m.bg, color: m.text }} onClick={onCycle}>
      {m.name}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiagnosticFlow({ updateCanvas, onComplete }) {
  const navigate = useNavigate()
  const [step, setStep]                     = useState(0)
  const [anxietyLevel, setAnxietyLevel]     = useState(null)
  const [anxietyType, setAnxietyType]       = useState(null)
  const [energyMap, setEnergyMap]           = useState({})
  const [season, setSeason]                 = useState(null)
  const [alwaysMatters, setAlwaysMatters]   = useState(null)
  const [canWait, setCanWait]               = useState([])
  const [recommendation, setRecommendation] = useState(null)

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
    const alwaysNeedId  = ALWAYS_MATTERS_TO_NEED[alwaysMatters] || alwaysMatters
    const energyGives   = Object.entries(energyMap).filter(([, v]) => v === 'gives').map(([k]) => k)
    const energyDrains  = Object.entries(energyMap).filter(([, v]) => v === 'drains').map(([k]) => k)
    const rec = buildRecommendation({ anxietyLevel, anxietyType, energyGives, energyDrains, season, alwaysNeedId, canWait })
    setRecommendation(rec)
    setStep(7)
  }

  function cycleNeedMode(section, needId) {
    setRecommendation(prev => ({
      ...prev,
      [section]: { ...prev[section], [needId]: nextMode(needId, prev[section][needId]) },
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

  function handleFinish() {
    saveCanvas()
    if (onComplete) onComplete()
    else navigate('/canvas')
  }

  function handleAdjust() {
    saveCanvas()
    navigate('/canvas')
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
              maslow identifies your needs, determines to what degree each should be met right now, and builds a daily practice library that reflects them.
            </div>
            <div className={styles.bodyText}>
              answer six short questions — thoughtfully. your answers shape a canvas built for where you actually are.
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
          <div className={styles.eyebrow}>ANXIETY</div>
          <div className={styles.headline}>how present is anxiety in your life right now?</div>
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
          <div className={styles.eyebrow}>ANXIETY TYPE</div>
          <div className={styles.headline}>how does it tend to show up?</div>
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
          <div className={styles.eyebrow}>ENERGY</div>
          <div className={styles.headline}>what gives and what drains?</div>
          <div className={styles.sub}>tap to mark. tap again to change.</div>
          <div className={styles.legendRow}>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: '#1B3A2D' }} />
              <span className={styles.legendText}>gives energy</span>
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
          <div className={styles.eyebrow}>SEASON</div>
          <div className={styles.headline}>what season are you in?</div>
          <div className={styles.sub}>pick the one that best describes your life right now.</div>
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
          <div className={styles.eyebrow}>NON-NEGOTIABLE</div>
          <div className={styles.headline}>what always matters, no matter what?</div>
          <div className={styles.sub}>the need that is non-negotiable — the one that, when ignored, everything else suffers. this becomes your exploration mode slot.</div>
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
          <div className={styles.eyebrow}>WHAT CAN WAIT</div>
          <div className={styles.headline}>what can take a back seat for now?</div>
          <div className={styles.sub}>not ignored — just not taking up mental space. these won't appear on your canvas.</div>
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
                </div>
              )
            })}
          </div>
          <div className={styles.gridNote}>none is a valid answer if everything feels relevant.</div>
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
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(6)}>← back</button>
          <div className={styles.eyebrow}>YOUR CANVAS</div>
          <div className={styles.headline}>here's your starting canvas.</div>

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
            const color          = MODE_COLORS[mode]
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
                    {universalInMode.map(n => (
                      <div key={n.id} className={styles.needRow}>
                        <div className={styles.needName}>{n.name}</div>
                        <ModePill needId={n.id} mode={recommendation.universal[n.id]} onCycle={() => cycleNeedMode('universal', n.id)} />
                      </div>
                    ))}
                    {personalInMode.map(n => (
                      <div key={n.id} className={styles.needRow}>
                        <div className={styles.needName}>{n.name}</div>
                        <div className={styles.needRowRight}>
                          <ModePill needId={n.id} mode={recommendation.personal[n.id]} onCycle={() => cycleNeedMode('personal', n.id)} />
                          <button className={styles.removeBtn} onClick={() => removePersonalNeed(n.id)}>×</button>
                        </div>
                      </div>
                    ))}
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

          <div className={styles.instructionNote}>tap any mode to change it. you can also add or remove needs.</div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={handleFinish}>this feels right →</button>
          <button className="btn-ghost" onClick={handleAdjust}>i want to adjust this</button>
        </div>
      </div>
    )
  }

  return null
}
