import { useEffect, useRef, useState } from 'react'
import { allNeeds } from '../lib/constants'
import { normalizeBand, BANDS, BAND_LABEL, FEELINGS } from '../lib/frequency'
import { currentSlot } from '../lib/slots'
import { loadCustomTags } from '../lib/store'
import { MOOD_PIP_COLOR } from './FrequencyCard'
import styles from './JournalTags.module.css'

// The tags on a blank page: the part of the day, a vibration, a need, and your
// own tags. The vibration starts as today's check-in for this part of the day
// (a hollow dot); choosing another one makes it yours (a solid dot).
// Reports { needId, custom, band, feeling } through onChange.
export default function JournalTags({ state, today, logMood, onChange }) {
  const slot = currentSlot()
  const slotMood = (state.moods || []).find(m => m.date_key === today && m.prompt_time === slot)
  const inheritedBand = slotMood ? normalizeBand(slotMood.mood) : null
  const inheritedFeeling = slotMood?.feeling || null

  const [needId, setNeedId] = useState(null)
  const [custom, setCustom] = useState(null)
  const [moodBand, setMoodBand] = useState(null)
  const [moodFeeling, setMoodFeeling] = useState(null)
  const [inherited, setInherited] = useState(true)
  const [open, setOpen] = useState(null) // 'vibration' | 'need' | 'custom' | null
  const [customTags, setCustomTags] = useState([])
  const newSlot = useRef(false)

  useEffect(() => {
    if (!state.userId) return
    loadCustomTags(state.userId).then(setCustomTags)
  }, [state.userId])

  const band = inherited ? inheritedBand : moodBand
  const feeling = inherited ? inheritedFeeling : moodFeeling
  const needs = allNeeds().filter(n => state.canvas?.[n.id])

  useEffect(() => { onChange({ needId, custom, band, feeling }) }, [needId, custom, band, feeling])

  function toggle(which) {
    if (which === 'vibration') newSlot.current = !inheritedBand
    setOpen(o => (o === which ? null : which))
  }

  // choosing a band keeps the picker open for the feeling; choosing a feeling closes it.
  // If today's check-in for this part of the day was never answered, this answers it.
  function settle(b, f) {
    setMoodBand(b)
    setMoodFeeling(f || null)
    setInherited(false)
    if (f) setOpen(null)
    if (newSlot.current) logMood?.(state.userId, slot, b, null, today, f || null)
  }
  function pickBand(b) { settle(b, null) }
  function pickFeeling(f) { settle(band, f) }

  return (
    <div className={styles.tags}>
      <div className={styles.row}>
        {band ? (
          <button type="button" className={styles.on} onClick={() => toggle('vibration')} aria-expanded={open === 'vibration'}>
            <span className={styles.dot} style={inherited ? { border: `1.5px solid ${MOOD_PIP_COLOR[band]}` } : { background: MOOD_PIP_COLOR[band] }} />
            {feeling || BAND_LABEL[band]}
            {!inherited && (
              <span
                className={styles.x}
                role="button"
                aria-label="remove vibration"
                onClick={e => { e.stopPropagation(); setInherited(true); setMoodBand(null); setMoodFeeling(null); setOpen(null) }}
              >×</span>
            )}
          </button>
        ) : (
          <button type="button" className={`${styles.parent} ${open === 'vibration' ? styles.parentOpen : ''}`} onClick={() => toggle('vibration')} aria-expanded={open === 'vibration'}>+ vibration</button>
        )}

        {needId ? (
          <button type="button" className={styles.on} onClick={() => setNeedId(null)} aria-label={`remove ${needId}`}>{needId} <span className={styles.x} aria-hidden="true">×</span></button>
        ) : (
          <button type="button" className={`${styles.parent} ${open === 'need' ? styles.parentOpen : ''}`} onClick={() => toggle('need')} aria-expanded={open === 'need'}>+ need</button>
        )}

        {customTags.length > 0 && (custom ? (
          <button type="button" className={styles.on} onClick={() => setCustom(null)} aria-label={`remove ${custom}`}>{custom} <span className={styles.x} aria-hidden="true">×</span></button>
        ) : (
          <button type="button" className={`${styles.parent} ${open === 'custom' ? styles.parentOpen : ''}`} onClick={() => toggle('custom')} aria-expanded={open === 'custom'}>+ custom</button>
        ))}
      </div>

      {open === 'vibration' && (
        <div className={styles.picker}>
          <div className={styles.list} role="group" aria-label="vibration">
            {BANDS.map(b => (
              <button
                type="button"
                key={b}
                className={`${styles.item} ${b === band ? styles.itemOn : ''}`}
                aria-pressed={b === band}
                onClick={() => pickBand(b)}
              >
                <span className={styles.dot} style={{ background: MOOD_PIP_COLOR[b] }} />
                {BAND_LABEL[b]}
              </button>
            ))}
          </div>
          {band && (
            <div className={styles.list} role="group" aria-label="feeling">
              {FEELINGS[band].map(f => (
                <button
                  type="button"
                  key={f}
                  className={`${styles.item} ${f === feeling ? styles.itemOn : ''}`}
                  aria-pressed={f === feeling}
                  onClick={() => pickFeeling(f)}
                >{f}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {open === 'need' && needs.length > 0 && (
        <div className={styles.list}>
          {needs.map(n => <button type="button" key={n.id} className={styles.item} onClick={() => { setNeedId(n.id); setOpen(null) }}>{n.name}</button>)}
        </div>
      )}
      {open === 'custom' && customTags.length > 0 && (
        <div className={styles.list}>
          {customTags.map(t => <button type="button" key={t.id} className={styles.item} onClick={() => { setCustom(t.label); setOpen(null) }}>{t.label}</button>)}
        </div>
      )}
    </div>
  )
}
