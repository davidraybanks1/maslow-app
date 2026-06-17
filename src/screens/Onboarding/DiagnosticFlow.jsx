import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './DiagnosticFlow.module.css'

const MODES = {
  survival:     { name: 'survival',     bg: '#FFF0EC', text: '#D93B1C' },
  nourishment:  { name: 'nourishment',  bg: '#FFF9E0', text: '#8A6A00' },
  appreciation: { name: 'appreciation', bg: '#F2F5F3', text: '#4A6860' },
  exploration:  { name: 'exploration',  bg: '#E8EFE9', text: '#1B3A2D' },
}
const MODE_ORDER = ['survival', 'nourishment', 'appreciation', 'exploration']

const UNIVERSAL_NEEDS = [
  { id: 'movement', name: 'Movement' },
  { id: 'nutrition', name: 'Nutrition' },
  { id: 'rest', name: 'Rest' },
]

const PERSONAL_NEEDS = [
  { id: 'community', name: 'Community' },
  { id: 'reflection', name: 'Reflection' },
  { id: 'beauty', name: 'Beauty' },
  { id: 'play', name: 'Play' },
  { id: 'information', name: 'Information' },
  { id: 'intimacy', name: 'Intimacy' },
  { id: 'touch', name: 'Touch' },
  { id: 'thrill', name: 'Thrill' },
  { id: 'money', name: 'Money' },
  { id: 'dwelling', name: 'Dwelling' },
]

const FILL_ORDER = ['community', 'reflection', 'beauty', 'play', 'information', 'intimacy', 'touch', 'thrill']

const CARD_MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

const MODE_COLORS = {
  exploration:  '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment:  '#E8B81F',
  survival:     '#D93B1C',
}

const MODE_EDU = [
  { mode: 'exploration',  desc: '3 practices per day — your deepest commitment' },
  { mode: 'appreciation', desc: '2 practices per day — present and intentional' },
  { mode: 'nourishment',  desc: '1 practice per day — steady and reliable' },
  { mode: 'survival',     desc: '1 practice per day, half weight — the floor that frees everything else' },
]

const ENERGY_OPTIONS = [
  {
    id: 'physical',
    name: 'Physical',
    description: 'your body feels heavy, exhausted, or disconnected. you run on stimulants and willpower more than actual energy.',
  },
  {
    id: 'mental',
    name: 'Mental',
    description: "your mind is overwhelmed or frenetic with competing thoughts. you can't focus, switch off, or find a clear path forward on the things you need to do.",
  },
  {
    id: 'emotional',
    name: 'Emotional',
    description: "your relationships and inner life feel thin. you feel isolated, performative, or like you're going through the motions.",
  },
]

const ANXIETY_OPTIONS = [
  {
    id: 'frenetic',
    name: 'Frenetic',
    description: "too much going on to focus on anything in particular. you're busy but not sure you're working on what actually matters. you need clarity more than more to-dos.",
  },
  {
    id: 'overwhelm',
    name: 'Overwhelm',
    description: "there are big things you don't feel equipped to handle. you need regular proof that you can do hard things — small wins, every day, that remind you of your own competence.",
  },
  {
    id: 'apathy',
    name: 'Apathy',
    description: "bored, disconnected, can't see the point. you don't need more discipline right now — you need to feel something again. joy, aliveness, the thrill of being here.",
  },
]

const PROGRESS = [0, 20, 40, 70, 100]

function nextMode(needId, mode) {
  const order = needId === 'rest' ? ['survival', 'nourishment'] : MODE_ORDER
  const idx = order.indexOf(mode)
  return order[(idx + 1) % order.length]
}

function buildRecommendation(energy, anxietyType) {
  const universal = {
    movement: energy.includes('physical') ? 'nourishment' : 'survival',
    nutrition: 'survival',
    rest: 'nourishment',
  }

  const other = {}

  if (energy.includes('mental')) {
    if (anxietyType === 'frenetic') {
      other.reflection = 'exploration'
      other.information = 'nourishment'
    } else if (anxietyType === 'overwhelm') {
      other.reflection = 'nourishment'
      other.information = 'nourishment'
    } else if (anxietyType === 'apathy') {
      other.beauty = 'appreciation'
      other.play = 'appreciation'
    }
  }

  if (energy.includes('emotional')) {
    other.community = 'appreciation'
    other.intimacy = 'nourishment'
  }

  if (anxietyType === 'overwhelm') {
    for (const id of Object.keys(other)) {
      if (other[id] === 'appreciation' || other[id] === 'exploration') other[id] = 'nourishment'
    }
  }

  if (anxietyType === 'apathy') {
    if (!other.beauty) other.beauty = 'appreciation'
    if (!other.play) other.play = 'appreciation'
    for (const id of Object.keys(other)) {
      if (other[id] === 'nourishment') other[id] = 'appreciation'
    }
  }

  if (anxietyType === 'frenetic') {
    for (const id of Object.keys(other)) {
      if (other[id] === 'nourishment') other[id] = 'appreciation'
    }
  }

  const maxOther = anxietyType === 'frenetic' ? 2 : 3
  const otherIds = Object.keys(other)
  if (otherIds.length > maxOther) {
    for (const id of otherIds.slice(maxOther)) delete other[id]
  }

  if (Object.keys(other).length === 0) {
    other[FILL_ORDER[0]] = anxietyType === 'overwhelm' ? 'nourishment' : 'appreciation'
  }

  return { universal, personal: { ...other, money: 'survival', dwelling: 'survival' } }
}

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

export default function DiagnosticFlow({ updateCanvas, onComplete }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [energy, setEnergy] = useState([])
  const [anxietyType, setAnxietyType] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [insight, setInsight] = useState(null)

  function toggleEnergy(id) {
    setEnergy(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  function goToCanvas() {
    const rec = buildRecommendation(energy, anxietyType)
    setRecommendation(rec)
    setInsight(rec)
    setStep(3)
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
    for (const [needId, mode] of Object.entries(recommendation.personal)) updateCanvas(needId, mode)
  }

  function handleAdjust() {
    saveCanvas()
    navigate('/canvas')
  }

  function handleFinish() {
    saveCanvas()
    if (onComplete) onComplete()
    else navigate('/canvas')
  }

  if (step === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.welcomeHeader}>
          <MaslowMark />
          <span className={styles.welcomeWordmark}>maslow.</span>
        </div>
        <div className={styles.welcomeBody}>
          <div className={styles.welcomeWrap}>
            <div className={styles.headline}>meet your needs. become more of yourself.</div>
            <div className={styles.bodyText}>before we build your canvas, we need to understand where your energy is going — and where it could be rebuilt.</div>
            <div className={styles.bodyText}>this takes about 3 minutes. your answers shape a starting canvas. you can always change it.</div>
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={() => setStep(1)}>let's start →</button>
        </div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[1]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(0)}>← back</button>
          <div className={styles.eyebrow}>ENERGY</div>
          <div className={styles.headline}>where are you running on empty?</div>
          <div className={styles.sub}>most of us are depleted in one or two areas without realizing it. select everything that feels true right now.</div>
          <div className={styles.options}>
            {ENERGY_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.optionCard} ${energy.includes(opt.id) ? styles.optionCardSelected : ''}`}
                onClick={() => toggleEnergy(opt.id)}
              >
                <div className={styles.optionName}>{opt.name}</div>
                <div className={styles.optionDesc}>{opt.description}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <div className={styles.hint}>select all that apply</div>
          <button className="btn-primary" onClick={() => setStep(2)}>continue →</button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[2]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(1)}>← back</button>
          <div className={styles.eyebrow}>ANXIETY TYPE</div>
          <div className={styles.headline}>how does anxiety tend to show up?</div>
          <div className={styles.sub}>anxiety takes different forms. one of these is probably more familiar than the others.</div>
          <div className={styles.options}>
            {ANXIETY_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`${styles.optionCard} ${anxietyType === opt.id ? styles.optionCardSelected : ''}`}
                onClick={() => setAnxietyType(opt.id)}
              >
                <div className={styles.optionName}>{opt.name}</div>
                <div className={styles.optionDesc}>{opt.description}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn-primary" onClick={goToCanvas} disabled={!anxietyType}>continue →</button>
        </div>
      </div>
    )
  }

  if (step === 3) {
    const drainNeeds = [
      ...UNIVERSAL_NEEDS.filter(n => insight.universal[n.id] === 'survival'),
      ...PERSONAL_NEEDS.filter(n => insight.personal[n.id] === 'survival'),
    ]
    const growthNeeds = PERSONAL_NEEDS.filter(n => ['appreciation', 'exploration'].includes(insight.personal[n.id]))
    const addableNeeds = PERSONAL_NEEDS.filter(n => !(n.id in recommendation.personal))

    return (
      <div className={styles.screen}>
        <ProgressBar pct={PROGRESS[3]} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={() => setStep(2)}>← back</button>
          <div className={styles.eyebrow}>YOUR CANVAS</div>
          <div className={styles.headline}>here's what we're working with.</div>

          <div className={`${styles.insightCard} ${styles.insightCardRed}`}>
            <div className={styles.insightLabel}>PLUG THE DRAIN</div>
            <div className={styles.insightHeadline}>where your energy is being wasted</div>
            <div className={styles.insightBody}>these needs are unmet and running in the background — quietly draining you. ignoring them isn't free. meeting them starts preserving your energy.</div>
            <div className={styles.pillRow}>
              {drainNeeds.map(n => <span key={n.id} className={`${styles.pill} ${styles.pillRed}`}>{n.name}</span>)}
            </div>
          </div>

          <div className={`${styles.insightCard} ${styles.insightCardGreen}`}>
            <div className={styles.insightLabel}>CREATING NEW ENERGY</div>
            <div className={styles.insightHeadline}>where you have room to grow</div>
            <div className={styles.insightBody}>these needs, met intentionally, don't just stop the drain — they generate something. practices here leave you with more than you started with.</div>
            <div className={styles.pillRow}>
              {growthNeeds.map(n => <span key={n.id} className={`${styles.pill} ${styles.pillGreen}`}>{n.name}</span>)}
            </div>
          </div>

          <div className={styles.modeEduCard}>
            {MODE_EDU.map(({ mode, desc }) => (
              <div key={mode} className={styles.modeEduRow}>
                <div className={styles.modeEduPip} style={{ background: MODE_COLORS[mode] }} />
                <span className={styles.modeEduText}>{mode} — {desc}</span>
              </div>
            ))}
          </div>

          <div className={styles.canvasSectionLabel}>RECOMMENDED CANVAS</div>

          {CARD_MODE_ORDER.map(mode => {
            const color = MODE_COLORS[mode]
            const universalInMode = UNIVERSAL_NEEDS.filter(n => recommendation.universal[n.id] === mode)
            const personalInMode = PERSONAL_NEEDS.filter(n => recommendation.personal[n.id] === mode)
            const addableForMode = PERSONAL_NEEDS.filter(n => !(n.id in recommendation.personal))
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

                {addableForMode.length > 0 && (
                  <div className={styles.addWrap}>
                    <div className={styles.addLabel}>add a need</div>
                    <div className={styles.addChips}>
                      {addableForMode.map(n => (
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
          <button className="btn-primary" onClick={() => setStep(4)}>this feels right →</button>
          <button className="btn-ghost" onClick={handleAdjust}>i want to adjust this</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <ProgressBar pct={PROGRESS[4]} />
      <div className={styles.content}>
        <div className={styles.eyebrow}>YOUR MASLOW</div>
        <div className={styles.headline}>your canvas is ready.</div>
        <div className={styles.bodyText}>each need on your canvas now has a mode — how much space it takes up in your life right now. practices are how you actually meet it day to day: the small, repeatable things you do that add up.</div>
        <div className={styles.bodyText}>your practices are your personal expressions of your needs. not what you should do — what actually works for you.</div>
        <div className={styles.mutedNote}>you can always revisit this diagnostic. your needs change. your canvas should too.</div>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerHint}>for each need on your canvas, add the specific things you'll actually do. one practice is enough to start.</div>
        <button className="btn-primary" onClick={handleFinish}>add your practices →</button>
      </div>
    </div>
  )
}
