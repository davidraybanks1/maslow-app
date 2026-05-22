import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Log.module.css'

const TRIGGERS = [
  'work', 'sleep', 'relationships', 'health', 'money',
  'purpose', 'loneliness', 'overwhelm', 'movement', 'food',
]

export default function Log({ state }) {
  const [energy, setEnergy] = useState(3)
  const [ease, setEase] = useState(3)
  const [trigger, setTrigger] = useState('')
  const [customTrigger, setCustomTrigger] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const ENERGY_LABELS = ['', 'Drained', 'Low', 'Steady', 'Good', 'Charged']
  const EASE_LABELS   = ['', 'Tight', 'Heavy', 'Neutral', 'Light', 'Flowing']

  async function handleSubmit() {
    setSaving(true)
    const finalTrigger = trigger === 'other' ? customTrigger : trigger
    try {
      if (state.userId) {
        await supabase.from('feelings').insert({
          user_id: state.userId,
          energy,
          ease,
          trigger: finalTrigger || null,
        })
      }
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setEnergy(3)
        setEase(3)
        setTrigger('')
        setCustomTrigger('')
      }, 2000)
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  if (saved) {
    return (
      <div className={styles.screen}>
        <div className={styles.savedState}>
          <div className={styles.savedIcon}>✓</div>
          <div className={styles.savedText}>logged.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>how are you?</div>
        <div className={styles.sub}>honest check-in. takes 30 seconds.</div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.blockLabel}>energy</span>
          <span className={styles.blockValue}>{ENERGY_LABELS[energy]}</span>
        </div>
        <div className={styles.scaleRow}>
          {[1,2,3,4,5].map(v => (
            <button key={v} className={`${styles.scaleBtn} ${energy === v ? styles.scaleBtnActive : ''}`} onClick={() => setEnergy(v)}>{v}</button>
          ))}
        </div>
        <div className={styles.scaleLabels}><span>drained</span><span>charged</span></div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.blockLabel}>ease</span>
          <span className={styles.blockValue}>{EASE_LABELS[ease]}</span>
        </div>
        <div className={styles.scaleRow}>
          {[1,2,3,4,5].map(v => (
            <button key={v} className={`${styles.scaleBtn} ${ease === v ? styles.scaleBtnActive : ''}`} onClick={() => setEase(v)}>{v}</button>
          ))}
        </div>
        <div className={styles.scaleLabels}><span>tight</span><span>flowing</span></div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.blockLabel}>what's driving it?</span>
          <span className={styles.blockValue} style={{ opacity: trigger ? 1 : 0 }}>optional</span>
        </div>
        <div className={styles.triggerGrid}>
          {TRIGGERS.map(t => (
            <button key={t} className={`${styles.triggerBtn} ${trigger === t ? styles.triggerBtnActive : ''}`} onClick={() => setTrigger(trigger === t ? '' : t)}>{t}</button>
          ))}
          <button className={`${styles.triggerBtn} ${trigger === 'other' ? styles.triggerBtnActive : ''}`} onClick={() => setTrigger(trigger === 'other' ? '' : 'other')}>other</button>
        </div>
        {trigger === 'other' && (
          <input className={styles.customInput} placeholder="what's on your mind..." value={customTrigger} onChange={e => setCustomTrigger(e.target.value)} autoFocus />
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? 'logging...' : 'log how I feel'}
        </button>
      </div>
    </div>
  )
}