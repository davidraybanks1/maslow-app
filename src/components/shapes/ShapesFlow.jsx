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

/* The shape picker and the six writing rooms, in one component.
   mode="inline"  — a persistent section on Today. The picker is always
                    showing; a room opens in place and returns to the picker
                    after saving.
   mode="overlay" — the full-screen version opened from other screens (the
                    composer's "shapes" pill) with the window event
                    `maslow:open-shapes` ({ detail: { shape?, source? } }).
   Either way it saves an ordinary draft with `shape` set, then tells the
   rest of the app with `maslow:entry-added`, like the composer does. */
export function ShapesPanel({ state, mode = 'inline', initial, onExit, onJustWrite }) {
  const inline = mode === 'inline'
  const [stage, setStage] = useState(initial?.shape || 'picker')
  const [source, setSource] = useState(initial?.source || null)
  const [draft, setDraft] = useState({ entry: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [askDiscard, setAskDiscard] = useState(false)
  const savingRef = useRef(false)
  const today = todayKey()

  useEffect(() => {
    if (!initial) return
    setStage(initial.shape || 'picker')
    setSource(initial.source || null)
    setDraft({ entry: '' })
    setError(null)
    setAskDiscard(false)
  }, [initial])

  const mood = useMemo(() => latestMoodToday(state, today), [state, today])
  const suggestion = useMemo(() => suggestShape(mood), [mood])

  const dirty = stage !== 'picker' && stage !== 'timer' && !!draft.entry.trim()

  function reset() {
    setStage('picker')
    setSource(null)
    setDraft({ entry: '' })
    setError(null)
    setAskDiscard(false)
  }
  function leave() {
    if (dirty) { setAskDiscard(true); return }
    finishLeave()
  }
  function finishLeave() {
    if (inline) reset()
    else onExit?.()
  }

  useEffect(() => {
    if (inline) return
    function onKey(e) { if (e.key === 'Escape') leave() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

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
    const done = () => { if (inline) reset(); else onExit?.() }
    // the timer room lingers a beat so "saved" is seen
    if (stage === 'timer') setTimeout(done, 1400)
    else done()
  }

  const room = ROOMS[stage]
  const Comp = room?.Comp
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })

  const discardBar = askDiscard && (
    <div className={styles.discard} role="alert">
      <span>discard what you wrote?</span>
      <span className={styles.discardBtns}>
        <button className={styles.link} onClick={() => setAskDiscard(false)}>keep writing</button>
        <button className={styles.link} onClick={finishLeave}>discard</button>
      </span>
    </div>
  )

  return (
    <div className={inline ? styles.inlinePanel : styles.panel} data-shapes-panel>
      {!inline && (
        <div className={styles.head}>
          <span className={styles.eyebrow}>{room ? room.eyebrow : 'shapes'} · {dateLabel}</span>
          <button className={styles.close} onClick={leave} aria-label="close">✕</button>
        </div>
      )}
      {!inline && discardBar}

      {stage === 'picker' ? (
        <>
          {/* On Today the picker is just the tiles; the suggested one is outlined. */}
          {!inline && (
            <>
              <h2 className={styles.title}>How do you want to write <em>today?</em></h2>
              <p className={styles.sub}>pick a room instead of facing a blank page. nothing here needs to be finished.</p>
              {suggestion && <p className={styles.suggest}>{suggestion.line}</p>}
            </>
          )}
          <button className={styles.justWrite} onClick={() => { if (!inline) onExit?.(); onJustWrite?.() }}>
            blank page
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
          {!inline && (
            <>
              <h2 className={styles.title}>{room.title[0]} <em>{room.title[1]}</em></h2>
              <div style={{ height: 14 }} />
            </>
          )}
          <Comp
            key={stage}
            state={state}
            today={today}
            source={source}
            onDraft={setDraft}
            onSave={save}
          />
          {error && <p className={styles.error} role="alert">{error}</p>}
          {inline && discardBar}
          {inline ? (
            <div className={styles.footInline}>
              <button className={styles.cancel} onClick={leave}>cancel</button>
              {stage !== 'timer' && (
                <button className={styles.add} onClick={() => save()} disabled={!draft.entry.trim() || saving}>add</button>
              )}
            </div>
          ) : stage !== 'timer' && (
            <div className={styles.foot}>
              <span className={styles.savesAs}>saves as · {room.eyebrow}</span>
              <button className={styles.add} onClick={() => save()} disabled={!draft.entry.trim() || saving}>add</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* The full-screen version. */
export default function ShapesFlow({ state, open, onClose, onJustWrite }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!open) { setOn(false); return }
    const raf = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(raf)
  }, [open])
  if (!open) return null
  return createPortal(
    <div className={`${styles.overlay} ${on ? styles.overlayOn : ''}`} role="dialog" aria-modal="true" aria-label="how do you want to write">
      <ShapesPanel state={state} mode="overlay" initial={open} onExit={onClose} onJustWrite={onJustWrite} />
    </div>,
    document.body,
  )
}
