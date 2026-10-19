import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { todayKey, addJournalEntry, settleRevisit } from '../../lib/store'
import { currentSlot } from '../../lib/slots'
import { hapticSuccess } from '../../lib/native'
import { SHAPES, SHAPE_DB, latestMoodToday, suggestShape } from '../../lib/shapeFacts'
import { ROOMS } from './Rooms'
import styles from './Shapes.module.css'

const GLYPHS = {
  three_truths: <span className={styles.tileGlyph}><i className={styles.tg} /><i className={styles.tg} /><i className={styles.tg} /></span>,
  tension: <span className={styles.tileGlyph}><i className={styles.tgDot} /><i className={styles.tgLine} /><i className={styles.tgDot} /></span>,
  sort_first: <span className={styles.tileGlyph}><i className={styles.tgBar} /><i className={styles.tgBar} /><i className={styles.tgBar} /></span>,
  continue: <span className={styles.tileGlyph}><i className={styles.tgBar} style={{ width: 26 }} /><i className={styles.tgDot} /></span>,
  one_thing: <span className={styles.tileGlyph}><i className={styles.tgDot} style={{ width: 16, height: 16 }} /></span>,
  timer: <span className={styles.tileGlyph}><i className={styles.tgRing} /></span>,
}

/* The shape picker and the six writing rooms. Opened with the window event
   `maslow:open-shapes` ({ detail: { shape?, source? } }) so any screen can
   offer it. Saves an ordinary draft with `shape` set, then tells the rest of
   the app with `maslow:entry-added`, like the composer does. */
export default function ShapesFlow({ state, open, onClose, onJustWrite }) {
  const [on, setOn] = useState(false)
  const [stage, setStage] = useState('picker')
  const [source, setSource] = useState(null)
  const [draft, setDraft] = useState({ entry: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [askDiscard, setAskDiscard] = useState(false)
  const savingRef = useRef(false)
  const today = todayKey()

  useEffect(() => {
    if (!open) { setOn(false); return }
    setStage(open.shape || 'picker')
    setSource(open.source || null)
    setDraft({ entry: '' })
    setError(null)
    setAskDiscard(false)
    const raf = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const mood = useMemo(() => latestMoodToday(state, today), [state, today])
  const suggestion = useMemo(() => suggestShape(mood), [mood])

  if (!open) return null

  function handleClose() {
    if (stage !== 'picker' && draft.entry.trim() && stage !== 'timer') {
      setAskDiscard(true)
      return
    }
    onClose()
  }

  async function save(override) {
    const d = override || draft
    if (savingRef.current || !d.entry?.trim() || !state.userId) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    const { data, error: err } = await addJournalEntry(state.userId, today, {
      entry: d.entry.trim(),
      slot: currentSlot(),
      needId: d.needId || null,
      quotedText: d.quotedText || null,
      quotedDate: d.quotedDate || null,
      moodBand: mood?.band || null,
      moodFeeling: mood?.feeling || null,
      shape: SHAPE_DB[stage] || null,
    })
    if (err || !data) {
      savingRef.current = false
      setSaving(false)
      setError('could not save. your words are still here. try again.')
      return
    }
    if (d.settleId && !d.keepOpen) await settleRevisit(d.settleId)
    hapticSuccess()
    window.dispatchEvent(new CustomEvent('maslow:entry-added', { detail: { entry: data, dateKey: today } }))
    if (d.settleId) window.dispatchEvent(new CustomEvent('maslow:revisit-changed'))
    savingRef.current = false
    setSaving(false)
    // the timer room closes itself a beat later so "saved" is seen
    if (stage === 'timer') setTimeout(onClose, 1400)
    else onClose()
  }

  const room = ROOMS[stage]
  const Comp = room?.Comp

  return createPortal(
    <div className={`${styles.overlay} ${on ? styles.overlayOn : ''}`} role="dialog" aria-modal="true" aria-label={room ? room.eyebrow : 'how do you want to write'}>
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>
            {room ? room.eyebrow : 'shapes'} · {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button className={styles.close} onClick={handleClose} aria-label="close">✕</button>
        </div>

        {askDiscard && (
          <div className={styles.discard} role="alert">
            <span>discard what you wrote?</span>
            <span className={styles.discardBtns}>
              <button className={styles.link} onClick={() => setAskDiscard(false)}>keep writing</button>
              <button className={styles.link} onClick={onClose}>discard</button>
            </span>
          </div>
        )}

        {stage === 'picker' ? (
          <>
            <h2 className={styles.title}>How do you want to write <em>today?</em></h2>
            <p className={styles.sub}>pick a room instead of facing a blank page. nothing here needs to be finished.</p>
            {suggestion && <p className={styles.suggest}>{suggestion.line}</p>}
            <button className={styles.justWrite} onClick={() => { onClose(); onJustWrite?.() }}>
              just write
              <span className={styles.justWriteSub}>blank page</span>
            </button>
            <div className={styles.grid}>
              {SHAPES.map(s => (
                <button
                  key={s.id}
                  className={`${styles.tile} ${suggestion?.id === s.id ? styles.tileSuggested : ''}`}
                  onClick={() => { setStage(s.id); setDraft({ entry: '' }) }}
                >
                  {GLYPHS[s.id]}
                  <span className={styles.tileName}>{s.label}</span>
                  <span className={styles.tileBlurb}>{s.blurb}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.title}>{room.title[0]} <em>{room.title[1]}</em></h2>
            <div style={{ height: 14 }} />
            <Comp
              key={stage}
              state={state}
              today={today}
              source={source}
              onDraft={setDraft}
              onSave={save}
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            {stage !== 'timer' && (
              <div className={styles.foot}>
                <span className={styles.savesAs}>saves as · {room.eyebrow}</span>
                <button className={styles.add} onClick={() => save()} disabled={!draft.entry.trim() || saving}>add</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
