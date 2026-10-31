import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { allNeeds } from '../lib/constants'
import { currentSlot } from '../lib/slots'
import { todayKey, addJournalEntry, settleRevisit, toggleJournalRevisit, uploadNoteImage, loadCustomTags } from '../lib/store'
import { normalizeBand } from '../lib/frequency'
import Glyph from '../lib/glyphs'
import { SHAPE_DB } from '../lib/shapeFacts'
import { hapticSuccess } from '../lib/native'
import { useIsDesktop } from '../lib/useIsDesktop'
import { useDeskChrome } from '../lib/deskChrome'
import FrequencyCard, { MOOD_PIP_COLOR } from '../components/FrequencyCard'
import SignedImg from '../components/SignedImg'
import { ROOMS } from '../components/shapes/Rooms'
import { GLYPHS } from '../components/shapes/ShapesFlow'
import styles from './Write.module.css'

/* The desktop writing page.

   One quiet column of paper with a way into every writing room above it and the
   few things that tag a draft (when, how you are, which need) beside the date.
   Everything around the words is furniture that steps back while you type:
   the strip fades, the pills and status line fade, and — if you want it — every
   paragraph but the one you are in dims.

   It saves the same drafts the phone does (addJournalEntry), tagged the same way,
   so nothing about a draft depends on where it was written. The page itself is
   also kept on this device as you go, so a closed tab never eats a paragraph. */

const DRAFT_KEY = 'loam_write_draft'
const QUIET_MS = 1800

function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    return d && typeof d.text === 'string' ? d : null
  } catch { return null }
}
function writeDraft(d) {
  try {
    if (!d || !d.text.trim()) localStorage.removeItem(DRAFT_KEY)
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {}
}

function fmtClock(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// "wednesday, october 14" — lowercase, like every label in the app
function dateLine() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()
}

// The blank page first, then the phone's writing spaces in the phone's order
// and under its names (JournalPage.jsx). Picking the open space again puts you
// back on the blank page.
const PILLS = [
  { id: 'blank', label: 'blank page' },
  { id: 'timer', label: 'timer room' },
  { id: 'continue', label: 'revisit' },
  { id: 'one_thing', label: 'gave and took' },
  { id: 'tension', label: 'tension' },
  { id: 'three_truths', label: 'three truths' },
]
const IN_PILLS = id => id !== 'blank' && PILLS.some(p => p.id === id)

/* ── the page itself: a textarea over a mirror ──────────────────────────────
   The textarea holds the real text but paints nothing; the mirror underneath
   paints the same text in the same metrics, which is what lets one paragraph be
   lit while the rest dim, and gives us the caret's position
   without any measuring hacks. */
function Page({ text, onText, sel, onSel, fade, taRef, caretRef, onInput, placeholder }) {
  const idx = Math.min(sel, text.length)
  const before = text.slice(0, idx)
  const lineStart = before.lastIndexOf('\n') + 1
  const nl = text.indexOf('\n', idx)
  const lineEnd = nl === -1 ? text.length : nl

  const head = text.slice(0, lineStart)
  const cur = { a: text.slice(lineStart, idx), b: text.slice(idx, lineEnd) }
  const tail = text.slice(lineEnd)

  return (
    <div className={styles.paper} data-fade={fade ? '' : undefined}>
      <div className={styles.mirror} aria-hidden="true">
        {head && <span className={styles.other}>{head}</span>}
        <span className={styles.current}>{cur.a}<i ref={caretRef} className={styles.caretMark} />{cur.b}</span>
        {tail && <span className={styles.other}>{tail}</span>}
        {'​'}
      </div>
      {!text && <div className={styles.placeholder} aria-hidden="true">{placeholder}</div>}
      <textarea
        ref={taRef}
        id="write-page"
        className={styles.input}
        value={text}
        spellCheck
        maxLength={10000}
        aria-label="your page"
        onChange={e => { onText(e.target.value); onSel(e.target.selectionStart) }}
        onSelect={e => onSel(e.target.selectionStart)}
        onInput={onInput}
      />
    </div>
  )
}

export default function Write({ state, logMood }) {
  const isDesktop = useIsDesktop()
  const location = useLocation()
  const navigate = useNavigate()
  const { focus, setFocus, quiet, setQuiet } = useDeskChrome()

  const today = todayKey()
  const slot = currentSlot()


  // which room is open: 'blank' or a shape id (arrived with one from another screen, maybe)
  const arrivedShape = location.state?.shape
  const arrivedSource = location.state?.source || null
  const [stage, setStage] = useState(() => (arrivedShape && ROOMS[arrivedShape] && IN_PILLS(arrivedShape) ? arrivedShape : 'blank'))
  const [source, setSource] = useState(arrivedSource)
  const [roomDraft, setRoomDraft] = useState({ entry: '' })
  const [pendingStage, setPendingStage] = useState(null)

  // another screen handed over a room while we are already here
  useEffect(() => {
    const sh = location.state?.shape
    if (sh && ROOMS[sh] && IN_PILLS(sh)) { setStage(sh); setSource(location.state?.source || null); setRoomDraft({ entry: '' }) }
  }, [location.state?.at])

  // the blank page, restored from this device if there was one in progress
  const restored = useMemo(readDraft, [])
  const [text, setText] = useState(restored?.text || '')
  const [sel, setSel] = useState(restored?.text?.length || 0)
  const [needId, setNeedId] = useState(restored?.needId || null)
  const [custom, setCustom] = useState(restored?.custom || null)
  const [image, setImage] = useState(restored?.image || null)
  const [uploading, setUploading] = useState(false)
  const [revisit, setRevisit] = useState(false)

  // mood chip: inherits the slot's check-in until you choose otherwise
  const [moodBand, setMoodBand] = useState(null)
  const [moodFeeling, setMoodFeeling] = useState(null)
  const [moodInherited, setMoodInherited] = useState(true)
  const slotMood = (state.moods || []).find(m => m.date_key === today && m.prompt_time === slot)
  const inheritedBand = slotMood ? normalizeBand(slotMood.mood) : null
  const inheritedFeeling = slotMood?.feeling || null
  const chipBand = moodInherited ? inheritedBand : moodBand
  const chipFeeling = moodInherited ? inheritedFeeling : moodFeeling

  const [popover, setPopover] = useState(null) // 'mood' | 'need' | 'custom' | null
  const [customTags, setCustomTags] = useState([])
  const [status, setStatus] = useState(restored ? 'kept' : 'idle') // idle | kept | saving | saved | error
  const [savedNote, setSavedNote] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const taRef = useRef(null)
  const caretRef = useRef(null)
  const scrollerRef = useRef(null)
  const fileRef = useRef(null)
  const quietT = useRef(null)
  const lastTypeAt = useRef(0)
  const savingRef = useRef(false)
  const fillRef = useRef(false)

  const activeNeeds = allNeeds().filter(n => state.canvas?.[n.id])

  useEffect(() => {
    if (!state.userId) return
    loadCustomTags(state.userId).then(setCustomTags)
  }, [state.userId])

  // the page keeps the whole window when asked; leaving this screen gives it back
  useEffect(() => () => { setFocus(false); setQuiet(false); clearTimeout(quietT.current) }, [setFocus, setQuiet])

  // a new room, or a fresh page after saving, starts at the top
  useEffect(() => { scrollerRef.current?.scrollTo({ top: 0 }) }, [stage, status === 'saved'])

  // land with the cursor on the page
  useEffect(() => {
    if (stage === 'blank') {
      const t = setTimeout(() => {
        const el = taRef.current
        if (!el) return
        el.focus({ preventScroll: true })
        el.setSelectionRange(el.value.length, el.value.length)
      }, 60)
      return () => clearTimeout(t)
    }
  }, [stage])

  // writing time: counts only the seconds you are actually typing
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastTypeAt.current < 5000) setSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // keep a copy of the page on this device
  useEffect(() => {
    if (stage !== 'blank') return
    const t = setTimeout(() => {
      writeDraft({ text, needId, custom, image })
      if (text.trim()) setStatus(s => (s === 'saved' || s === 'saving' ? s : 'kept'))
    }, 500)
    return () => clearTimeout(t)
  }, [text, needId, custom, image, stage])

  // pointer movement ends the quiet; typing starts it
  useEffect(() => {
    function onMove(e) {
      if (Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return
      clearTimeout(quietT.current)
      setQuiet(false)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [setQuiet])

  function handleInput() {
    lastTypeAt.current = Date.now()
    setStatus(s => (s === 'saved' ? 'idle' : s))
    setSavedNote(false)
    setQuiet(true)
    clearTimeout(quietT.current)
    quietT.current = setTimeout(() => setQuiet(false), QUIET_MS)
    followCaret()
  }

  // never let the line you are writing run under the status line
  function followCaret() {
    const sc = scrollerRef.current
    const mark = caretRef.current
    if (!sc || !mark) return
    requestAnimationFrame(() => {
      const s = sc.getBoundingClientRect()
      const m = mark.getBoundingClientRect()
      const rel = m.top - s.top
      if (m.bottom > s.bottom - 110) {
        sc.scrollTo({ top: sc.scrollTop + (m.bottom - (s.bottom - 110)), behavior: 'smooth' })
      } else if (rel < 8) {
        sc.scrollTo({ top: sc.scrollTop + rel - 60, behavior: 'smooth' })
      }
    })
  }

  // ── saving ──────────────────────────────────────────────────────────────
  const words = useMemo(() => {
    const t = (stage === 'blank' ? text : roomDraft.entry || '').trim()
    return t ? t.split(/\s+/).length : 0
  }, [stage, text, roomDraft.entry])

  const entryText = stage === 'blank' ? text : roomDraft.entry || ''
  const canSave = !!entryText.trim() && !!state.userId && status !== 'saving'

  async function save(override) {
    const d = override || null
    const entry = (d ? d.entry : entryText).trim()
    if (!entry || !state.userId || savingRef.current) return
    savingRef.current = true
    setStatus('saving')
    const isRoom = stage !== 'blank'
    const { data, error } = await addJournalEntry(state.userId, today, {
      entry,
      slot,
      needId: isRoom ? (d?.needId || roomDraft.needId || null) : needId,
      custom: isRoom ? null : custom,
      imageUrl: isRoom ? null : image,
      quotedText: isRoom ? (d?.quotedText || roomDraft.quotedText || null) : null,
      quotedDate: isRoom ? (d?.quotedDate || roomDraft.quotedDate || null) : null,
      moodBand: chipBand,
      moodFeeling: chipFeeling,
      shape: isRoom ? (SHAPE_DB[stage] || null) : null,
    })
    if (error || !data) {
      savingRef.current = false
      setStatus('error')
      return
    }
    const settleId = isRoom ? (d?.settleId || roomDraft.settleId) : null
    const keepOpen = isRoom ? (d?.keepOpen || roomDraft.keepOpen) : false
    if (settleId && !keepOpen) await settleRevisit(settleId)
    if (revisit) await toggleJournalRevisit(data.id, true, '')
    hapticSuccess()
    window.dispatchEvent(new CustomEvent('maslow:entry-added', { detail: { entry: data, dateKey: today } }))
    if (settleId) window.dispatchEvent(new CustomEvent('maslow:revisit-changed'))
    savingRef.current = false

    // a clean page, ready for the next thing
    writeDraft(null)
    setText(''); setSel(0); setNeedId(null); setCustom(null); setImage(null); setRevisit(false)
    setMoodInherited(true); setMoodBand(null); setMoodFeeling(null)
    setRoomDraft({ entry: '' }); setSource(null); setSeconds(0)
    setStage('blank')
    setStatus('saved')
    setSavedNote(true)
    setPopover(null)
  }

  // ── rooms ───────────────────────────────────────────────────────────────
  function goStage(next) {
    if (next === stage) return
    if (stage !== 'blank' && stage !== 'timer' && roomDraft.entry?.trim()) { setPendingStage(next); return }
    enterStage(next)
  }
  function enterStage(next) {
    setPendingStage(null)
    setRoomDraft({ entry: '' })
    setSource(null)
    setStage(next)
    setPopover(null)
    setSavedNote(false)
    setStatus(s => (s === 'saved' ? 'idle' : s))
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0]
    if (!file || !state.userId) return
    setUploading(true)
    const { url } = await uploadNoteImage(state.userId, file)
    if (url) setImage(url)
    setUploading(false)
    e.target.value = ''
  }

  // ── keys ────────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') { e.preventDefault(); setFocus(f => !f) ; return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); return }
      if (e.key === 'Escape') {
        if (popover) { setPopover(null); return }
        if (pendingStage) { setPendingStage(null); return }
        setFocus(f => !f)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // setFocus from context takes a boolean; allow the updater form here
  const toggleFocus = () => setFocus(!focus)

  if (!isDesktop) return <Navigate to="/today" replace />

  const room = stage !== 'blank' ? ROOMS[stage] : null
  const Room = room?.Comp
  const needLabel = needId ? (allNeeds().find(n => n.id === needId)?.name || needId) : null

  const statusText = {
    idle: '',
    kept: 'kept on this device',
    saving: 'saving…',
    saved: 'saved to drafts',
    error: 'could not save — your words are still here',
  }[status]

  return (
    <div
      className={styles.page}
      data-focus={focus ? '' : undefined}
      data-quiet={quiet ? '' : undefined}
      onClick={e => { if (popover && !e.target.closest('[data-pop]')) setPopover(null) }}
    >
      <header className={styles.top} data-furniture>
        <span aria-hidden="true" />
        <div className={styles.pills} role="group" aria-label="how to write">
          {PILLS.map(p => (
            <button
              key={p.id} type="button" aria-pressed={stage === p.id}
              className={`${styles.shape} ${stage === p.id ? styles.shapeOn : ''}`}
              onClick={() => goStage(stage === p.id ? 'blank' : p.id)}
            >
              <span className={styles.shapeGlyph} aria-hidden="true">{p.id === 'blank' ? <Glyph kind="note" height={13} /> : GLYPHS[p.id]}</span>
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.btn} onClick={toggleFocus} aria-pressed={focus}>
          {focus ? 'leave focus' : 'focus'} <kbd>{focus ? 'esc' : '⌘.'}</kbd>
        </button>
      </header>

      <div className={styles.scroller} ref={scrollerRef}>
        <div className={styles.col}>
          {pendingStage && (
            <div className={styles.discard} role="alert" data-furniture>
              <span>discard what you wrote in this room?</span>
              <span>
                <button type="button" className={styles.link} onClick={() => setPendingStage(null)}>keep writing</button>
                <button type="button" className={styles.link} onClick={() => enterStage(pendingStage)}>discard</button>
              </span>
            </div>
          )}

          <div className={styles.meta} data-furniture>
            <span className={styles.when}>{dateLine()}</span>
            <span className={styles.chip}>{slot}</span>

            <span className={styles.popWrap} data-pop>
              <button type="button" className={chipBand ? styles.chipOn : styles.chipAdd} onClick={() => setPopover(p => (p === 'mood' ? null : 'mood'))}>
                {chipBand ? (
                  <>
                    <i className={styles.pip} style={moodInherited ? { border: `1.5px solid ${MOOD_PIP_COLOR[chipBand]}` } : { background: MOOD_PIP_COLOR[chipBand] }} />
                    {chipFeeling || (chipBand === 'mid' ? 'fine' : chipBand)}
                  </>
                ) : '+ vibration'}
              </button>
              {popover === 'mood' && (
                <div className={styles.pop} style={{ width: 360 }}>
                  <FrequencyCard
                    initialBand={chipBand}
                    initialFeeling={chipFeeling}
                    compact
                    onSettle={(band, feeling) => {
                      setMoodBand(band); setMoodFeeling(feeling || null); setMoodInherited(false)
                      if (!inheritedBand) logMood?.(state.userId, slot, band, null, today, feeling || null)
                      if (feeling) setPopover(null)
                    }}
                  />
                </div>
              )}
            </span>

            {stage === 'blank' && (
              <>
                <span className={styles.popWrap} data-pop>
                  {needId ? (
                    <button type="button" className={styles.chipOn} onClick={() => setNeedId(null)}>{needLabel} ×</button>
                  ) : (
                    <button type="button" className={styles.chipAdd} onClick={() => setPopover(p => (p === 'need' ? null : 'need'))}>+ need</button>
                  )}
                  {popover === 'need' && activeNeeds.length > 0 && (
                    <div className={styles.pop}>
                      <div className={styles.picker}>
                        {activeNeeds.map(n => (
                          <button key={n.id} type="button" className={styles.pickItem} onClick={() => { setNeedId(n.id); setPopover(null) }}>{n.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </span>
                {customTags.length > 0 && (
                  <span className={styles.popWrap} data-pop>
                    {custom ? (
                      <button type="button" className={styles.chipOn} onClick={() => setCustom(null)}>{custom} ×</button>
                    ) : (
                      <button type="button" className={styles.chipAdd} onClick={() => setPopover(p => (p === 'custom' ? null : 'custom'))}>+ custom</button>
                    )}
                    {popover === 'custom' && (
                      <div className={styles.pop}>
                        <div className={styles.picker}>
                          {customTags.map(t => (
                            <button key={t.id} type="button" className={styles.pickItem} onClick={() => { setCustom(t.label); setPopover(null) }}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </span>
                )}
                {image && (
                  <button type="button" className={styles.chipOn} onClick={() => setImage(null)} aria-label="remove photo">
                    <SignedImg src={image} alt="" className={styles.thumb} /> ×
                  </button>
                )}
              </>
            )}
          </div>

          {stage === 'blank' ? (
            <Page
              text={text} onText={setText} sel={sel} onSel={setSel}
              fade={focus || quiet} taRef={taRef} caretRef={caretRef}
              onInput={handleInput}
              placeholder="start anywhere."
            />
          ) : (
            <div className={styles.room}>
              <h2 className={styles.roomTitle}>{room.title[0]} <em>{room.title[1]}</em></h2>
              <Room key={stage} state={state} today={today} source={source} onDraft={setRoomDraft} onSave={save} />
              {status === 'error' && <p className={styles.error} role="alert">{statusText}</p>}
            </div>
          )}
        </div>
      </div>

      <footer className={styles.status} data-furniture>
        <span className={styles.stat}>{words} {words === 1 ? 'word' : 'words'}</span>
        {seconds > 0 && stage === 'blank' && <span className={styles.stat}>{fmtClock(seconds)} writing</span>}
        {statusText && (
          <span className={`${styles.stat} ${status === 'error' ? styles.statErr : ''}`} role="status">
            {status === 'saved' && <i className={styles.okDot} />}{statusText}
            {savedNote && <button type="button" className={styles.link} onClick={() => navigate('/drafts')}>see drafts</button>}
          </span>
        )}
        <span className={styles.grow} />

        {stage === 'blank' && (
          <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'uploading…' : 'photo'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />


        {stage === 'blank' && (
          <button type="button" className={`${styles.btn} ${revisit ? styles.btnOn : ''}`} onClick={() => setRevisit(r => !r)} aria-pressed={revisit}>
            {revisit ? 'will revisit ✓' : 'mark to revisit'}
          </button>
        )}
        {stage !== 'timer' && (
          <button type="button" className={`${styles.btn} ${styles.btnDark}`} onClick={() => save()} disabled={!canSave}>
            save draft <kbd>⌘↵</kbd>
          </button>
        )}
      </footer>
    </div>
  )
}
