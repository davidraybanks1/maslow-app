import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { todayKey, addJournalEntry, settleRevisit } from '../lib/store'
import { currentSlot } from '../lib/slots'
import { hapticSuccess } from '../lib/native'
import { SHAPE_DB, latestMoodToday } from '../lib/shapeFacts'
import { GLYPHS } from './shapes/ShapesFlow'
import { SPACES } from './JournalSpaces'
import styles from './JournalPage.module.css'

// The writing page on Today (phones). The page is open from the start, so you
// can just type. The six writing experiences are a row of glyphs underneath:
// picking one swaps the placeholder, label and caption in place and keeps
// whatever you've already written. Picking it again goes back to the blank page.
//
// What's saved: an ordinary journal entry, with `shape` set when an
// experience was picked, same as the shapes panel did. The unfinished draft
// (text + experience) autosaves on this device so it's there when you come back.

const BLANK = "what's on your mind?"

const EXPERIENCES = [
  { id: 'three_truths', name: 'three truths', description: 'Three facts about you right now. Write what they have in common.', placeholder: 'one true thing about you right now…' },
  { id: 'tension',      name: 'tension',      description: 'Two things pulling on you. Write the space between.',               placeholder: 'what lives between these two?' },
  { id: 'sort_first',   name: 'sort first',   description: 'Sort the day into three piles, a line each.',                      placeholder: 'pile one…' },
  { id: 'continue',     name: 'continue',     description: 'Pick up a note from before and answer it.',                        placeholder: 'pick a note to answer…' },
  { id: 'one_thing',    name: 'one thing',    description: 'Pick a need. Write one thing about it.',                           placeholder: 'which need?' },
  { id: 'timer',        name: 'timer room',   description: 'You pick the time. It saves itself when the ring closes.',         placeholder: 'set a time, then write.' },
]

const DRAFT_KEY = 'loam_today_draft'
function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (d && typeof d.text === 'string') return d
  } catch { /* no draft */ }
  return null
}
function writeDraft(text, shape) {
  try {
    if (!text.trim()) localStorage.removeItem(DRAFT_KEY)
    else localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, shape, at: Date.now() }))
  } catch { /* storage blocked: the draft just won't survive a reload */ }
}

// A rounded-rect path from top-centre, clockwise, so the ring closes from the top
const RING_W = 3
const RING_R = 24
function ringPath(w, h) {
  const i = RING_W / 2
  const r = RING_R - i
  const x0 = i, y0 = i, x1 = w - i, y1 = h - i
  return [
    `M ${w / 2} ${y0}`, `H ${x1 - r}`, `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `V ${y1 - r}`, `A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
    `H ${x0 + r}`, `A ${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
    `V ${y0 + r}`, `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`, `H ${w / 2}`,
  ].join(' ')
}

export default function JournalPage({ state }) {
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  const [text, setText] = useState(() => readDraft()?.text || '')
  const [mode, setMode] = useState(() => {
    const s = readDraft()?.shape
    return EXPERIENCES.some(e => e.id === s) ? s : null
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  // what the open experience adds around the page (see JournalSpaces)
  const [extraRaw, setExtra] = useState({})
  const [size, setSize] = useState({ w: 0, h: 0 })
  const pageRef = useRef(null)
  const taRef = useRef(null)
  const doneRef = useRef(null)
  const firstRun = useRef(true)

  const exp = useMemo(() => EXPERIENCES.find(e => e.id === mode) || null, [mode])
  // a space's extras belong to that space, so they're tagged with its mode
  // and ignored once the mode changes
  const extra = extraRaw.__mode === mode ? extraRaw : {}
  const onSpace = useMemo(
    () => patch => setExtra(prev => (prev.__mode === mode ? { ...prev, ...patch } : { ...patch, __mode: mode })),
    [mode],
  )

  const Space = mode ? SPACES[mode] : null
  const placeholder = extra.placeholder || (exp ? exp.placeholder : BLANK)
  const hideInput = !!extra.hideInput
  const body = hideInput ? '' : text.trim()
  const entry = extra.lead
    ? (extra.leadOnly ? [extra.lead, body].filter(Boolean).join('\n\n') : (body ? `${extra.lead}\n\n${body}` : ''))
    : body

  // measure the page so the timer ring can hug it
  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // the page grows with what you write
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, 120) + 'px'
  }, [text, hideInput, mode])

  // autosave about 800 ms after you stop typing (or change the experience)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(() => {
      writeDraft(text, mode)
      if (text.trim()) {
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2000)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [text, mode])

  // other parts of the app can open a specific experience (e.g. a note's "continue")
  useEffect(() => {
    function onOpen(e) {
      const s = e.detail?.shape
      if (EXPERIENCES.some(x => x.id === s)) setMode(s)
    }
    window.addEventListener('maslow:open-shapes', onOpen)
    return () => window.removeEventListener('maslow:open-shapes', onOpen)
  }, [])

  async function done() {
    if (!entry || saving || !state.userId) return
    setSaving(true)
    setError(null)
    const today = todayKey()
    const mood = latestMoodToday(state, today)
    const { data, error: err } = await addJournalEntry(state.userId, today, {
      entry,
      slot: currentSlot(),
      needId: extra.needId || null,
      quotedText: extra.quotedText || null,
      quotedDate: extra.quotedDate || null,
      moodBand: mood?.band || null,
      moodFeeling: mood?.feeling || null,
      shape: SHAPE_DB[mode] || null,
    })
    setSaving(false)
    if (err || !data) { setError('could not save. your words are still here. try again.'); return }
    if (extra.settleId && !extra.keepOpen) {
      await settleRevisit(extra.settleId)
      window.dispatchEvent(new CustomEvent('maslow:revisit-changed'))
    }
    hapticSuccess()
    window.dispatchEvent(new CustomEvent('maslow:entry-added', { detail: { entry: data, dateKey: today } }))
    writeDraft('', null)
    setText('')
    setMode(null)
  }
  doneRef.current = done

  const empty = !entry

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>WRITE</span>
        {exp && <span className={styles.mode}>{exp.name.toUpperCase()}</span>}
      </div>

      <div className={styles.pageWrap}>
        <div className={styles.page} ref={pageRef}>
          {Space && (
            <Space
              key={mode}
              state={state}
              today={todayKey()}
              text={text}
              onChange={onSpace}
              onFinish={() => doneRef.current?.()}
            />
          )}
          {!hideInput && (
            <textarea
              ref={taRef}
              className={styles.input}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              disabled={!!extra.locked}
              maxLength={10000}
              rows={4}
            />
          )}
          {error && <div className={styles.error} role="alert">{error}</div>}
          <div className={styles.footer}>
            <span className={styles.saves} role={extra.ring != null ? 'timer' : undefined}>{extra.note || (justSaved ? 'saved · just now' : 'saves as you type')}</span>
            <button type="button" className={styles.done} onClick={done} disabled={empty || saving}>
              <span className={styles.donePill}>done</span>
            </button>
          </div>
        </div>
        {extra.ring != null && size.w > 0 && (
          <svg className={styles.ring} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
            <path className={styles.ringTrack} d={ringPath(size.w, size.h)} />
            <path className={styles.ringBar} d={ringPath(size.w, size.h)} pathLength="100" strokeDasharray="100" strokeDashoffset={extra.ring * 100} />
          </svg>
        )}
      </div>

      <div className={styles.glyphs} role="group" aria-label="Writing style">
        {EXPERIENCES.map(x => {
          const on = x.id === mode
          return (
            <button
              key={x.id}
              type="button"
              className={`${styles.glyph} ${on ? styles.glyphOn : ''}`}
              aria-pressed={on}
              aria-label={x.name}
              aria-describedby={`${uid}-${x.id}`}
              onClick={() => setMode(on ? null : x.id)}
            >
              {GLYPHS[x.id]}
              <span id={`${uid}-${x.id}`} className={styles.sr}>{x.description}</span>
            </button>
          )
        })}
      </div>

      <p className={styles.caption} aria-live="polite">
        {exp ? `${exp.name} — ${exp.description}` : 'or begin with one of these'}
      </p>
    </div>
  )
}
