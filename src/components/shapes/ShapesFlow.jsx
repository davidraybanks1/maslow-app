import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { todayKey, addJournalEntry, settleRevisit } from '../../lib/store'
import { currentSlot } from '../../lib/slots'
import { hapticSuccess } from '../../lib/native'
import { ROOM_PICKER, HOSTED_ROOMS, SHAPE_DB, latestMoodToday } from '../../lib/shapeFacts'
import JournalPage from '../JournalPage'
import { ROOMS } from './Rooms'
import styles from './Shapes.module.css'

export const GLYPHS = {
  three_truths: <span className={styles.tileGlyph}><i className={styles.tg} /><i className={styles.tg} /><i className={styles.tg} /></span>,
  tension: <span className={styles.tileGlyph}><i className={styles.tgDot} /><i className={styles.tgLine} /><i className={styles.tgDot} /></span>,
  sort_first: <span className={styles.tileGlyph}><i className={styles.tgBar} /><i className={styles.tgBar} /><i className={styles.tgBar} /></span>,
  continue: <span className={styles.tileGlyph}><i className={styles.tgBar} style={{ width: 26 }} /><i className={styles.tgDot} /></span>,
  // gave and took: a lit dot (energy given) beside an empty ring (energy taken)
  one_thing: <span className={styles.tileGlyph} style={{ gap: 7 }}><i className={styles.tgDot} style={{ width: 14, height: 14, background: 'var(--nour)' }} /><i className={styles.tgDot} style={{ width: 14, height: 14, background: 'none', border: '2px solid var(--ink4)', boxSizing: 'border-box' }} /></span>,
  // timer room: the page, with the ring tracing round it as the time runs
  timer: (
    <span className={styles.tileGlyph}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="4.5" width="21" height="17" rx="5.5" strokeWidth="2" style={{ stroke: 'var(--ink4)' }} />
        <path d="M2.5 13V10a5.5 5.5 0 0 1 5.5-5.5H16" strokeWidth="2.8" style={{ stroke: 'var(--exploration)' }} />
      </svg>
    </span>
  ),
}

/* The rooms picker and the writing rooms, in one component.
   mode="inline"  — a persistent section on Today. The picker is always
                    showing; a room opens in place and returns to the picker
                    after saving.
   mode="overlay" — the full-screen version opened from other screens (the
                    composer's "rooms" link) with the window event
                    `maslow:open-shapes` ({ detail: { shape?, source? } }).
   Either way it saves an ordinary draft with `shape` set, then tells the
   rest of the app with `maslow:entry-added`, like the composer does. */
const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v']

export function ShapesPanel({ state, logMood, mode = 'inline', initial, onExit }) {
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
  const hosted = HOSTED_ROOMS.has(stage)
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
          <span className={styles.eyebrow}>{room ? room.eyebrow : 'rooms'} · {dateLabel}</span>
          <button className={styles.close} onClick={leave} aria-label="close">×</button>
        </div>
      )}
      {!inline && discardBar}

      {stage === 'picker' ? (
        <>
          {!inline && (
            <>
              <h2 className={styles.pickerTitle}>how do you want to write <em>today?</em></h2>
              <p className={styles.sub}>pick a room, or close this and write on a blank page. nothing here needs to be finished.</p>
            </>
          )}
          <div className={styles.roomList}>
            {ROOM_PICKER.map((s, i) => (
              <button key={s.id} type="button" className={styles.roomRow} onClick={() => { setStage(s.id); setDraft({ entry: '' }) }}>
                <span className={styles.roomNum}>{NUMERALS[i]}.</span>
                <span className={styles.roomName}>{s.label}</span>
                <span className={styles.roomBlurb}>{s.blurb}</span>
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
          {hosted ? (
            <JournalPage
              key={stage}
              state={state}
              logMood={logMood}
              room={stage}
              source={source}
              onDirty={t => setDraft({ entry: t })}
              onDone={finishLeave}
            />
          ) : (
            <Comp
              key={stage}
              state={state}
              today={today}
              source={source}
              onDraft={setDraft}
              onSave={save}
            />
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {inline && discardBar}
          {hosted ? null : inline ? (
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
export default function ShapesFlow({ state, logMood, open, onClose }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!open) { setOn(false); return }
    const raf = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(raf)
  }, [open])
  if (!open) return null
  return createPortal(
    <div className={`${styles.overlay} ${on ? styles.overlayOn : ''}`} role="dialog" aria-modal="true" aria-label="how do you want to write">
      <ShapesPanel state={state} logMood={logMood} mode="overlay" initial={open} onExit={onClose} />
    </div>,
    document.body,
  )
}
