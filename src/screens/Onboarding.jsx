import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NEEDS, LAYERS, LAYER_ORDER } from '../lib/constants'
import styles from './Onboarding.module.css'

const QUESTIONS = [
  {
    id: 'lifeStage',
    text: 'Where are you in life right now?',
    sub: 'This shapes what a realistic canvas looks like for you.',
    options: [
      { value: 'building', label: 'Building', sub: 'Career, finances, establishing myself' },
      { value: 'family', label: 'Raising a family', sub: 'Parenting, partnership, home life' },
      { value: 'transition', label: 'In transition', sub: 'Career change, move, big life shift' },
      { value: 'established', label: 'Established', sub: 'Stable, exploring what\'s next' },
      { value: 'recovery', label: 'Recovering', sub: 'From burnout, loss, or health' },
    ],
  },
  {
    id: 'hardest',
    text: 'What\'s making life feel hard right now?',
    sub: 'Be honest. These become your starting focus areas.',
    multi: true,
    options: [
      { value: 'body', label: 'My body feels neglected' },
      { value: 'finances', label: 'My finances feel unstable' },
      { value: 'disconnected', label: 'I feel disconnected from people' },
      { value: 'meaning', label: 'I can\'t seem to find meaning' },
      { value: 'home', label: 'My home feels chaotic' },
      { value: 'exhausted', label: 'I\'m exhausted all the time' },
      { value: 'anxious', label: 'I\'m anxious more days than not' },
      { value: 'love', label: 'I\'ve lost touch with what I love' },
    ],
  },
  {
    id: 'values',
    text: 'What do you value most deeply right now?',
    sub: 'Not what you think you should value — what actually pulls at you.',
    multi: true,
    options: [
      { value: 'health', label: 'My physical health and vitality' },
      { value: 'connection', label: 'Deep connection with people I love' },
      { value: 'creative', label: 'Creative work and purpose' },
      { value: 'security', label: 'Financial security' },
      { value: 'rest', label: 'Rest and recovery' },
      { value: 'selfaware', label: 'Being present and self-aware' },
      { value: 'beauty', label: 'Beauty, art, and inspiration' },
      { value: 'home', label: 'My home and environment' },
    ],
  },
  {
    id: 'mostSelf',
    text: 'When do you feel most like yourself?',
    sub: 'The moments where life feels right.',
    options: [
      { value: 'moving', label: 'When my body is moving', sub: 'Exercise, physical effort, being outside' },
      { value: 'creating', label: 'When I\'m making something', sub: 'Creative work, building, expressing' },
      { value: 'connecting', label: 'When I\'m deeply connected', sub: 'Real conversations, close relationships' },
      { value: 'quiet', label: 'When things are quiet and clear', sub: 'Stillness, reflection, being alone' },
      { value: 'flowing', label: 'When I\'m in flow', sub: 'Fully absorbed, time disappearing' },
    ],
  },
  {
    id: 'duration',
    text: 'How long have you been feeling this way?',
    sub: 'This helps calibrate how much retraining your nervous system needs.',
    options: [
      { value: 'weeks', label: 'A few weeks', sub: 'Recent shift — we\'ll calibrate gently' },
      { value: 'months', label: 'Several months', sub: 'Building pattern — your ground needs real work' },
      { value: 'years', label: 'Years', sub: 'Long-term — your nervous system needs consistent retraining' },
      { value: 'always', label: 'It\'s always been this way', sub: 'Deeply rooted — we start from the foundation' },
    ],
  },
]

function buildCanvas(answers) {
  const canvas = Object.fromEntries(NEEDS.map(n => [n.id, 'nourishment']))
  if (answers.values?.includes('health')) canvas.movement = 'play'
  if (answers.values?.includes('connection')) canvas.community = 'play'
  if (answers.values?.includes('creative')) canvas.purpose = 'play'
  if (answers.values?.includes('selfaware')) canvas.reflection = 'play'
  if (answers.values?.includes('rest')) canvas.rest = 'play'
  if (answers.values?.includes('beauty')) canvas.beauty = 'appreciation'
  if (answers.values?.includes('security')) canvas.security = 'appreciation'
  if (answers.values?.includes('home')) canvas.dwelling = 'appreciation'
  if (answers.hardest?.includes('body')) canvas.movement = canvas.movement === 'play' ? 'play' : 'appreciation'
  if (answers.hardest?.includes('exhausted')) canvas.rest = 'play'
  if (answers.hardest?.includes('anxious')) { canvas.reflection = 'play'; canvas.rest = 'play' }
  if (answers.hardest?.includes('disconnected')) canvas.community = canvas.community === 'play' ? 'play' : 'appreciation'
  if (answers.hardest?.includes('finances')) canvas.security = 'appreciation'
  if (answers.hardest?.includes('meaning')) canvas.purpose = canvas.purpose === 'play' ? 'play' : 'appreciation'
  if (answers.lifeStage === 'recovery') { canvas.rest = 'play'; canvas.reflection = 'play' }
  if (answers.lifeStage === 'family') canvas.community = canvas.community === 'play' ? 'play' : 'appreciation'
  if (answers.lifeStage === 'building') canvas.security = canvas.security === 'play' ? 'play' : 'appreciation'
  if (answers.mostSelf === 'moving') canvas.movement = 'play'
  if (answers.mostSelf === 'creating') canvas.purpose = 'play'
  if (answers.mostSelf === 'connecting') canvas.community = 'play'
  if (answers.mostSelf === 'quiet') canvas.reflection = 'play'
  return canvas
}

export default function Onboarding({ completeOnboarding }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('intro')
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [canvas, setCanvas] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleSingleSelect(qId, value) {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  function handleMultiSelect(qId, value) {
    setAnswers(prev => {
      const current = prev[qId] || []
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [qId]: updated }
    })
  }

  function nextQuestion() {
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(q => q + 1)
    } else {
      const built = buildCanvas(answers)
      setCanvas(built)
      setStep('details')
    }
  }

  function updateCanvasMode(needId, mode) {
    setCanvas(prev => ({ ...prev, [needId]: mode }))
  }

  async function handleFinish() {
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .insert({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          canvas,
          profile: answers,
          onboarded: true,
        })
        .select()
        .single()
      if (dbError) throw dbError
      completeOnboarding(canvas, { name: name.trim(), email: email.trim(), userId: data.id, ...answers })
      navigate('/today')
    } catch (err) {
      if (err.code === '23505') {
        setError('That email is already registered. Try signing in instead.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSaving(false)
    }
  }

  const q = QUESTIONS[qIndex]
  const answer = answers[q?.id]
  const canNext = q?.multi ? (answer?.length > 0) : !!answer

  if (step === 'intro') {
    return (
      <div className={styles.screen}>
        <div className={styles.introWrap}>
          <div className={styles.word}>maslow.</div>
          <div className={styles.phonetic}>/ ˈmæz.loʊ / · your needs, intentionally met</div>
          <div className={styles.introDef}>
            <p>Anxiety fills the space your unmet needs leave behind. The louder it gets, the more essential parts of yourself are being ignored.</p>
            <p style={{ marginTop: 14 }}>Maslow helps you fill that space first — by building intentional habits around the needs that actually fuel you.</p>
            <p style={{ marginTop: 14 }}><strong>Don't manage anxiety. Crowd it out.</strong></p>
          </div>
          <button className="btn-primary" onClick={() => setStep('questions')}>
            Build my canvas →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'questions') {
    return (
      <div className={styles.screen}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
        <div className={styles.qWrap}>
          <div className={styles.qNum}>Question {qIndex + 1} of {QUESTIONS.length}</div>
          <div className={styles.qText}>{q.text}</div>
          <div className={styles.qSub}>{q.sub}</div>
          <div className={styles.options}>
            {q.options.map(opt => {
              const selected = q.multi
                ? (answer || []).includes(opt.value)
                : answer === opt.value
              return (
                <div
                  key={opt.value}
                  className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
                  onClick={() => q.multi
                    ? handleMultiSelect(q.id, opt.value)
                    : handleSingleSelect(q.id, opt.value)
                  }
                >
                  <div className={`${styles.optCheck} ${selected ? styles.optCheckSelected : ''}`}>
                    {selected && <div className={styles.optCheckInner} />}
                  </div>
                  <div className={styles.optBody}>
                    <div className={styles.optLabel}>{opt.label}</div>
                    {opt.sub && <div className={styles.optSub}>{opt.sub}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className={styles.qFooter}>
          <button className="btn-primary" onClick={nextQuestion} disabled={!canNext}>
            {qIndex < QUESTIONS.length - 1 ? 'Continue' : 'Build my canvas'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'details') {
    return (
      <div className={styles.screen}>
        <div className={styles.qWrap}>
          <div className={styles.qNum}>Almost there</div>
          <div className={styles.qText}>Let's personalize your experience.</div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Your first name</label>
            <input
              className={styles.input}
              type="text"
              placeholder="David"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Your email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="david@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <div className={styles.inputHint}>We'll use this for weekly reminders and check-ins.</div>
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </div>
        <div className={styles.qFooter}>
          <button className="btn-primary" onClick={() => setStep('reveal')} disabled={!name.trim() || !email.trim()}>
            See my canvas →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'reveal') {
    return (
      <div className={styles.screen}>
        <div className={styles.revealHeader}>
          <div className={styles.qNum}>Your starting canvas</div>
          <div className={styles.qText}>Here's your ground, {name}.</div>
          <div className={styles.qSub}>Built from your answers. Adjust anything that doesn't feel right.</div>
        </div>
        <div className={styles.revealCanvas}>
          {NEEDS.map(n => {
            const mode = canvas[n.id]
            const lyr = LAYERS[mode]
            return (
              <div key={n.id} className={styles.revealRow}>
                <div className={styles.revealPip} style={{ background: lyr.pip }} />
                <div className={styles.revealName}>{n.name}</div>
                <div className={styles.revealPills}>
                  {LAYER_ORDER.map(l => (
                    <button
                      key={l}
                      className={`${styles.pill} ${mode === l ? styles.pillActive : ''}`}
                      style={mode === l ? { borderColor: LAYERS[l].border, color: LAYERS[l].text, background: LAYERS[l].bg } : {}}
                      onClick={() => updateCanvasMode(n.id, l)}
                    >
                      {l.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {error && <div className={styles.error} style={{ padding: '0 20px' }}>{error}</div>}
        <div className={styles.qFooter}>
          <button className="btn-primary" onClick={handleFinish} disabled={saving}>
            {saving ? 'Saving...' : 'This is my canvas →'}
          </button>
          <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setStep('details')}>
            Back
          </button>
        </div>
      </div>
    )
  }
}
