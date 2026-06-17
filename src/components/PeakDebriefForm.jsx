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

export default function PeakDebriefForm({ userId, debriefTypes, onSaved }) {
  const [nature, setNature] = useState(null)
  const [environment, setEnvironment] = useState(null)
  const [entry, setEntry] = useState('')
  const [timerActive, setTimerActive] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(DEBRIEF_TIMER_SECONDS)
  const [msg, setMsg] = useState(null)
  const textareaRef = useRef(null)

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

  function handleChange(e) {
    const val = e.target.value
    setEntry(val)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }

  function handleFocus() {
    if (!timerActive) setTimerActive(true)
  }

  function reset() {
    setNature(null)
    setEnvironment(null)
    setEntry('')
    setTimerActive(false)
    setSecondsLeft(DEBRIEF_TIMER_SECONDS)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  async function handleSave() {
    if (!nature || !environment) {
      setMsg({ text: 'select a type and environment to save.', color: '#D93B1C' })
      setTimeout(() => setMsg(null), 3000)
      return
    }
    const { error } = await saveDebrief(userId, {
      dateKey: todayKey(),
      nature,
      environment,
      entry,
      stepsCompleted: 4,
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

      <div className={styles.stepList}>
        <div className={styles.stepItem}>1. <strong>name it</strong> — what happened, just the facts.</div>
        <div className={styles.stepItem}>2. <strong>feel it</strong> — what did it feel like in your body and mind.</div>
        <div className={styles.stepItem}>3. <strong>examine it</strong> — what conditions made this possible.</div>
        <div className={styles.stepItem}>4. <strong>anchor it</strong> — what can you do to create more moments like this.</div>
      </div>

      <textarea
        ref={textareaRef}
        className={styles.textarea}
        placeholder="write through it…"
        value={entry}
        onChange={handleChange}
        onFocus={handleFocus}
        rows={4}
      />

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
