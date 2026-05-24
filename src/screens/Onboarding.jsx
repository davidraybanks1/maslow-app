import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NEEDS, LAYERS, LAYER_ORDER } from '../lib/constants'
import { sendMagicLink } from '../lib/store'
import styles from './Onboarding.module.css'

const QUESTIONS = [
  {
    id: 'lifeStage',
    text: 'Where are you in life right now?',
    sub: 'This shapes what a realistic canvas looks like for you.',
    options: [
      { value: 'building',    label: 'Building',          sub: 'Career, finances, establishing myself' },
      { value: 'family',      label: 'Raising a family',  sub: 'Parenting, partnership, home life' },
      { value: 'transition',  label: 'In transition',     sub: 'Career change, move, big life shift' },
      { value: 'established', label: 'Established',       sub: 'Stable, exploring what\'s next' },
      { value: 'recovery',    label: 'Recovering',        sub: 'From burnout, loss, or health' },
    ],
  },
  {
    id: 'hardest',
    text: 'What\'s making life feel hard right now?',
    sub: 'Be honest. These become your starting focus areas.',
    multi: true,
    options: [
      { value: 'body',         label: 'My body feels neglected' },
      { value: 'finances',     label: 'My finances feel unstable' },
      { value: 'disconnected', label: 'I feel disconnected from people' },
      { value: 'meaning',      label: 'I can\'t seem to find meaning' },
      { value: 'home',         label: 'My home feels chaotic' },
      { value: 'exhausted',    label: 'I\'m exhausted all the time' },
      { value: 'anxious',      label: 'I\'m anxious more days than not' },
      { value: 'love',         label: 'I\'ve lost touch with what I love' },
    ],
  },
  {
    id: 'values',
    text: 'What do you value most deeply right now?',
    sub: 'Not what you think you should value — what actually pulls at you.',
    multi: true,
    options: [
      { value: 'health',     label: 'My physical health and vitality' },
      { value: 'connection', label: 'Deep connection with people I love' },
      { value: 'creative',   label: 'Creative work and purpose' },
      { value: 'security',   label: 'Financial security' },
      { value: 'rest',       label: 'Rest and recovery' },
      { value: 'selfaware',  label: 'Being present and self-aware' },
      { value: 'beauty',     label: 'Beauty, art, and inspiration' },
      { value: 'home',       label: 'My home and environment' },
    ],
  },
  {
    id: 'mostSelf',
    text: 'When do you feel most like yourself?',
    sub: 'The moments where life feels right.',
    options: [
      { value: 'moving',     label: 'When my body is moving',       sub: 'Exercise, physical effort, being outside' },
      { value: 'creating',   label: 'When I\'m making something',   sub: 'Creative work, building, expressing' },
      { value: 'connecting', label: 'When I\'m deeply connected',   sub: 'Real conversations, close relationships' },
      { value: 'quiet',      label: 'When things are quiet and clear', sub: 'Stillness, reflection, being alone' },
      { value: 'flowing',    label: 'When I\'m in flow',            sub: 'Fully absorbed, time disappearing' },
    ],
  },
  {
    id: 'duration',
    text: 'How long have you been feeling this way?',
    sub: 'This helps calibrate how much retraining your nervous system needs.',
    options: [
      { value: 'weeks',  label: 'A few weeks',           sub: 'Recent shift — we\'ll calibrate gently' },
      { value: 'months', label: 'Several months',        sub: 'Building pattern — your ground needs real work' },
      { value: 'years',  label: 'Years',                 sub: 'Long-term — your nervous system needs consistent retraining' },
      { value: 'always', label: 'It\'s always been this way', sub: 'Deeply rooted — we start from the foundation' },
    ],
  },
]

// Build a canvas that respects the 1/2/3/4 constraint
function buildCanvas(answers) {
  // Score each need — higher = more important to user
  const scores = Object.fromEntries(NEEDS.map(n => [n.id, 0]))

  if (answers.values?.includes('health'))     scores.movement   += 3
  if (answers.values?.includes('connection')) scores.community  += 3
  if (answers.values?.includes('creative'))   scores.purpose    += 3
  if (answers.values?.includes('selfaware'))  scores.reflection += 3
  if (answers.values?.includes('rest'))       scores.rest       += 3
  if (answers.values?.includes('beauty'))     scores.beauty     += 2
  if (answers.values?.includes('security'))   scores.security   += 2
  if (answers.values?.includes('home'))       scores.dwelling   += 2

  if (answers.hardest?.includes('body'))         scores.movement   += 2
  if (answers.hardest?.includes('exhausted'))    scores.rest       += 3
  if (answers.hardest?.includes('anxious'))      { scores.reflection += 2; scores.rest += 2 }
  if (answers.hardest?.includes('disconnected')) scores.community  += 2
  if (answers.hardest?.includes('finances'))     scores.security   += 2
  if (answers.hardest?.includes('meaning'))      scores.purpose    += 2
  if (answers.hardest?.includes('home'))         scores.dwelling   += 1

  if (answers.lifeStage === 'recovery')    { scores.rest += 2; scores.reflection += 2 }
  if (answers.lifeStage === 'family')      scores.community += 2
  if (answers.lifeStage === 'building')    scores.security  += 2

  if (answers.mostSelf === 'moving')     scores.movement   += 3
  if (answers.mostSelf === 'creating')   scores.purpose    += 3
  if (answers.mostSelf === 'connecting') scores.community  += 3
  if (answers.mostSelf === 'quiet')      scores.reflection += 3
  if (answers.mostSelf === 'flowing')    scores.purpose    += 2

  // Sort needs by score descending
  const sorted = [...NEEDS].sort((a, b) => scores[b.id] - scores[a.id])

  // Assign modes based on rank: 1 play, 2 appreciation, 3 nourishment, 4 survival
  const canvas = {}
  sorted.forEach((n, i) => {
    if (i === 0)      canvas[n.id] = 'play'
    else if (i <= 2)  canvas[n.id] = 'appreciation'
    else if (i <= 5)  canvas[n.id] = 'nourishment'
    else              canvas[n.id] = 'survival'
  })

  return canvas
}

export default function Onboarding({ completeOnboarding }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('intro')
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [canvas, setCanvas] = useState(null)
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sendingLink, setSendingLink] = useState(false)

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

  // Canvas reveal — tap to assign
  function handleChip(needId) {
    setSelected(selected === needId ? null : needId)
  }

  function handleSlot(mode) {
    if (!selected) return
    const lyr = LAYERS[mode]
    const currentInMode = NEEDS.filter(n => canvas[n.id] === mode)
    if (currentInMode.length >= lyr.slots) return
    setCanvas(prev => ({ ...prev, [selected]: mode }))
    setSelected(null)
  }

  function handleRemove(needId) {
    setCanvas(prev => ({ ...prev, [needId]: null }))
    setSelected(null)
  }

  async function handleSendMagicLink() {
    setSendingLink(true)
    const { error: e } = await sendMagicLink(email)
    setError(!e ? 'MAGIC_SENT' : 'Something went wrong sending the link. Please try again.')
    setSendingLink(false)
  }

  async function handleFinish() {
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email.')
      return
    }
    // Check all needs assigned
    const unassigned = NEEDS.filter(n => !canvas[n.id])
    if (unassigned.length > 0) {
      setError('Please assign all needs before continuing.')
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
      const msg = err?.message || ''
      if (err.code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
        setError('DUPLICATE_EMAIL')
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSaving(false)
    }
  }

  const q = QUESTIONS[qIndex]
  const answer = answers[q?.id]
  const canNext = q?.multi ? (answer?.length > 0) : !!answer

  // ── Intro ──────────────────────────────────────────────────
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

  // ── Questions ──────────────────────────────────────────────
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

  // ── Details ────────────────────────────────────────────────
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

  // ── Reveal ────────────────────────────────────────────────
  if (step === 'reveal') {
    const unassigned = NEEDS.filter(n => !canvas[n.id])
    const allAssigned = unassigned.length === 0

    return (
      <div className={styles.screen}>
        <div className={styles.revealHeader}>
          <div className={styles.qNum}>Your starting canvas</div>
          <div className={styles.qText}>Here's your ground, {name}.</div>
          <div className={styles.qSub}>
            {selected
              ? `Tap a slot to assign ${NEEDS.find(n => n.id === selected)?.name}`
              : 'Tap a need below, then tap a slot to assign it.'}
          </div>
        </div>

        {/* Mode slots */}
        <div className={styles.revealCanvas}>
          {LAYER_ORDER.map(mode => {
            const lyr = LAYERS[mode]
            const assigned = NEEDS.filter(n => canvas[n.id] === mode)
            const sw = lyr.slots === 1 ? '100%' : lyr.slots === 2 ? 'calc(50% - 3px)' : 'calc(33.3% - 4px)'
            return (
              <div key={mode} className={styles.modeSection}>
                <div className={styles.modeSectionHead}>
                  <div className={styles.modeSectionLabel}>
                    <div className={styles.modePip} style={{ background: lyr.pip }} />
                    {mode}
                  </div>
                  <div className={styles.modeSectionCount}>{assigned.length}/{lyr.slots}</div>
                </div>
                <div className={styles.slotsRow}>
                  {Array.from({ length: lyr.slots }).map((_, i) => {
                    const need = assigned[i]
                    const canAccept = selected && assigned.length < lyr.slots
                    if (need) {
                      return (
                        <div key={i} className={styles.slotFilled} style={{ width: sw }} onClick={() => handleRemove(need.id)}>
                          <span className={styles.slotName}>{need.name}</span>
                          <span className={styles.slotX}>×</span>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={i}
                        className={`${styles.slotEmpty} ${canAccept ? styles.slotHighlight : ''}`}
                        style={{ width: sw }}
                        onClick={() => handleSlot(mode)}
                      >
                        {canAccept ? 'tap to assign' : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Parking lot */}
          <div className={styles.lotDivider} />
          <div className={styles.lotLabel}>unassigned</div>
          <div className={styles.chips}>
            {unassigned.map(n => (
              <div
                key={n.id}
                className={`${styles.chip} ${selected === n.id ? styles.chipSelected : ''}`}
                onClick={() => handleChip(n.id)}
              >
                {n.name}
              </div>
            ))}
            {allAssigned && (
              <div className={styles.allAssigned}>all needs assigned ✓</div>
            )}
          </div>
        </div>

        {/* Error states */}
        {error === 'DUPLICATE_EMAIL' && (
          <div style={{ padding: '0 20px', marginBottom: 8 }}>
            <div className={styles.error} style={{ marginBottom: 12 }}>That email is already registered.</div>
            <button className="btn-ghost" onClick={handleSendMagicLink} disabled={sendingLink}>
              {sendingLink ? 'Sending...' : 'Send me a sign-in link →'}
            </button>
          </div>
        )}
        {error === 'MAGIC_SENT' && (
          <div style={{ padding: '0 20px', marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#1B3A2D', letterSpacing: '0.04em', lineHeight: 1.6 }}>
              ✓ Check your email — we sent a sign-in link to {email}
            </div>
          </div>
        )}
        {error && error !== 'DUPLICATE_EMAIL' && error !== 'MAGIC_SENT' && (
          <div className={styles.error} style={{ padding: '0 20px' }}>{error}</div>
        )}

        <div className={styles.qFooter}>
          <button className="btn-primary" onClick={handleFinish} disabled={saving || !allAssigned || error === 'MAGIC_SENT'}>
            {saving ? 'Saving...' : allAssigned ? 'This is my canvas →' : `${unassigned.length} needs unassigned`}
          </button>
          <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setStep('details')}>Back</button>
        </div>
      </div>
    )
  }
}