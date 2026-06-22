import { useState, useEffect, useRef } from 'react'
import { todayKey, saveDebrief } from '../lib/store'
import {
  BUILTIN_ENVIRONMENT_TYPES,
  ENVIRONMENT_TAG_STYLE,
  DEBRIEF_TIMER_SECONDS,
  formatTimer,
} from '../lib/debriefTypes'
import styles from './DebriefForm.module.css'

const BUILTIN_PEAK_TYPES = [
  { name: 'confident', bg: '#1B3A2D', text: '#fff' },
  { name: 'creative',  bg: '#E8B81F', text: 'var(--ink)' },
  { name: 'curious',   bg: '#B8C3B1', text: 'var(--ink)' },
]

function peakTagStyle(name, customPeakTypes) {
  const builtin = BUILTIN_PEAK_TYPES.find(t => t.name === name)
  if (builtin) return { background: builtin.bg, color: builtin.text }
  const custom = (customPeakTypes || []).find(t => t.name === name)
  if (custom) return { background: custom.color, color: '#fff' }
  return { background: '#9A9690', color: '#fff' }
}

const PEAK_FIELDS = [
  { key: 'name_it', label: '1. NAME IT', placeholder: 'what happened, just the facts.' },
  { key: 'feel_it', label: '2. FEEL IT', placeholder: 'what did it feel like in your body and mind.' },
  { key: 'examine_it', label: '3. EXAMINE IT', placeholder: 'what conditions made this possible.' },
  { key: 'anchor_it', label: '4. ANCHOR IT', placeholder: 'what can you do to create more moments like this.' },
]

const EMPTY_FIELDS = { name_it: '', feel_it: '', examine_it: '', anchor_it: '' }

export default function PeakDebriefForm({ userId, debriefTypes, onSaved }) {
  const [nature, setNature] = useState(null)
  const [environment, setEnvironment] = useState(null)
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [timerActive, setTimerActive] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(DEBRIEF_TIMER_SECONDS)
  const [msg, setMsg] = useState(null)
  const textareaRefs = useRef({})

  useEffect(() => {
    if (!timerActive) return
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timerActive])

  function handleFieldChange(key, val) {
    setFields(prev => ({ ...prev, [key]: val }))
    const el = textareaRefs.current[key]
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }

  function handleFocus() {
    if (!timerActive) setTimerActive(true)
  }

  function reset() {
    setNature(null)
    setEnvironment(null)
    setFields(EMPTY_FIELDS)
    setTimerActive(false)
    setSecondsLeft(DEBRIEF_TIMER_SECONDS)
    for (const el of Object.values(textareaRefs.current)) {
      if (el) el.style.height = 'auto'
    }
  }

  async function handleSave() {
    if (!nature || !environment) {
      setMsg({ text: 'select a type and environment to save.', color: '#D93B1C' })
      setTimeout(() => setMsg(null), 3000)
      return
    }
    const stepsCompleted = Object.values(fields).filter(v => v.trim()).length
    const { error } = await saveDebrief(userId, {
      dateKey: todayKey(),
      nature,
      environment,
      entry: JSON.stringify(fields),
      stepsCompleted,
      type: 'peak',
    })
    if (!error) {
      setMsg({ text: 'saved ✓', color: '#1B3A2D' })
      setTimeout(() => { setMsg(null); reset(); onSaved?.() }, 1500)
    }
  }

  const peakOptions = [
    ...BUILTIN_PEAK_TYPES.map(t => t.name),
    ...(debriefTypes.peak || []).map(t => t.name),
  ]
  const environmentOptions = [...BUILTIN_ENVIRONMENT_TYPES, ...(debriefTypes.environment || []).map(t => t.name)]

  return (
    <div className={styles.form}>
      <div className={styles.subhead}>capture a moment when you felt fully alive. reflect in 7 minutes.</div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span className={styles.fieldLabel}>TYPE OF PEAK</span>
          <span className={styles.statusDot} style={{ background: nature ? '#1B3A2D' : '#D93B1C' }} />
        </div>
        <div className={styles.chipRow}>
          {peakOptions.map(name => (
            <button
              key={name}
              className={styles.chip}
              style={nature === name ? peakTagStyle(name, debriefTypes.peak) : {}}
              onClick={() => setNature(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span className={styles.fieldLabel}>ENVIRONMENT</span>
          <span className={styles.statusDot} style={{ background: environment ? '#1B3A2D' : '#D93B1C' }} />
        </div>
        <div className={styles.chipRow}>
          {environmentOptions.map(name => (
            <button
              key={name}
              className={styles.chip}
              style={environment === name ? ENVIRONMENT_TAG_STYLE : {}}
              onClick={() => setEnvironment(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {PEAK_FIELDS.map(f => (
        <div key={f.key} className={styles.stepField}>
          <div className={styles.stepLabel}>{f.label}</div>
          <textarea
            ref={el => { textareaRefs.current[f.key] = el }}
            className={styles.stepTextarea}
            placeholder={f.placeholder}
            value={fields[f.key]}
            onChange={e => handleFieldChange(f.key, e.target.value)}
            onFocus={handleFocus}
            rows={3}
          />
        </div>
      ))}

      {timerActive && (
        secondsLeft > 0
          ? <div className={styles.timerNote}>{formatTimer(secondsLeft)} remaining</div>
          : <div className={styles.timerNote} style={{ color: '#1B3A2D' }}>wrap up when ready</div>
      )}

      <button
        className={styles.saveBtn}
        style={(!nature || !environment) ? { opacity: 0.4 } : {}}
        onClick={handleSave}
      >
        save
      </button>

      {msg && <div className={styles.msg} style={{ color: msg.color }}>{msg.text}</div>}
    </div>
  )
}
