import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { todayKey, addJournalEntry, settleRevisit } from '../lib/store'
import { currentSlot } from '../lib/slots'
import { hapticSuccess } from '../lib/native'
import { SHAPE_DB, latestMoodToday } from '../lib/shapeFacts'
import { GLYPHS } from './shapes/ShapesFlow'
import { SPACES } from './JournalSpaces'
import JournalTags from './JournalTags'
import styles from './JournalPage.module.css'

// The writing section on Today (phones). The five writing experiences ("spaces")
// are a row of glyphs at the top. Tap one and it explains itself, with a start
// button; tap start and you're in it, with a way out. Below that is the blank
// page, open by default so you can just type, with tags (part of the day,
// vibration, need, your own).
//
// Whatever you've written stays when you move between the blank page and a
// space. What's saved is an ordinary journal entry, with `shape` set when a
// space was used. The unfinished draft (text + space) autosaves on this device.

const BLANK = "what's on your mind?"

const EXPERIENCES = [
  { id: 'timer',        name: 'timer room',   description: 'You pick the time. It saves itself when the ring closes.',         placeholder: 'set a time, then write.' },
  { id: 'continue',     name: 'revisit',      description: 'Keep a conversation going on a previous draft.',                   placeholder: 'pick a draft to answer…' },
  { id: 'one_thing',    name: 'gave and took', description: 'What gave you energy today, what took it, and what you want more of tomorrow.', placeholder: 'something that gave you energy…' },
  { id: 'tension',      name: 'tension',      description: 'Two things pulling on you. Write the space between.',               placeholder: 'what lives between these two?' },
  { id: 'three_truths', name: 'three truths', description: 'Three facts about you right now. Write what they have in common.', placeholder: 'one true thing about you right now…' },
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

export default function JournalPage({ state, logMood }) {
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  const [text, setText] = useState(() => readDraft()?.text || '')
  const [mode, setMode] = useState(() => {
    const s = readDraft()?.shape
    return EXPERIENCES.some(e => e.id === s) ? s : null
  })
  // a space has been picked (mode) and also started (you're writing in it)
  const [started, setStarted] = useState(() => EXPERIENCES.some(e => e.id === readDraft()?.shape))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  // what the open space adds around the page (see JournalSpaces)
  const [extraRaw, setExtra] = useState({})
  // tags on the blank page (see JournalTags)
  const [tags, setTags] = useState({})
  const [size, setSize] = useState({ w: 0, h: 0 })
  const pageRef = useRef(null)
  // The blank page's height, remembered so a space's intro card can stand in
  // for it at exactly the same height - tapping a space then swaps the card
  // without moving anything below it.
  const blankWrapRef = useRef(null)
  const blankH = useRef(0)
  const taRef = useRef(null)
  const doneRef = useRef(null)
  const firstRun = useRef(true)

  const exp = useMemo(() => EXPERIENCES.find(e => e.id === mode) || null, [mode])
  const inSpace = !!exp && started       // writing inside a space
  const intro = !!exp && !started        // a space picked, not yet started
  const blank = !exp                     // the blank page

  // a space's extras belong to that space, so they're tagged with its mode
  // and ignored once the mode changes
  const extra = extraRaw.__mode === mode ? extraRaw : {}
  const onSpace = useMemo(
    () => patch => setExtra(prev => (prev.__mode === mode ? { ...prev, ...patch } : { ...patch, __mode: mode })),
    [mode],
  )

  const Space = inSpace ? SPACES[mode] : null
  const placeholder = inSpace ? (extra.placeholder || exp.placeholder) : BLANK
  const body = text.trim()
  const entry = inSpace && extra.lead ? (body ? `${extra.lead}\n\n${body}` : '') : body

  function pick(id) {
    if (id === mode) exit()
    else { setMode(id); setStarted(false) }
  }
  // leave a space: back to the blank page, with what you wrote still there
  function exit() { setMode(null); setStarted(false) }

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
  }, [intro])

  // the page grows with what you write
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, 120) + 'px'
  }, [text, mode, started])

  // autosave about 800 ms after you stop typing (or change space)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(() => {
      writeDraft(text, started ? mode : null)
      if (text.trim()) {
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2000)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [text, mode, started])

  // other parts of the app can open a specific space (e.g. a note's "continue")
  useEffect(() => {
    function onOpen(e) {
      const s = e.detail?.shape
      if (EXPERIENCES.some(x => x.id === s)) { setMode(s); setStarted(true) }
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
    const { data, error: err } = await addJournalEntry(state.userId, today, inSpace ? {
      entry,
      slot: currentSlot(),
      needId: extra.needId || null,
      quotedText: extra.quotedText || null,
      quotedDate: extra.quotedDate || null,
      moodBand: mood?.band || null,
      moodFeeling: mood?.feeling || null,
      shape: SHAPE_DB[mode] || null,
    } : {
      entry,
      slot: currentSlot(),
      needId: tags.needId || null,
      custom: tags.custom || null,
      moodBand: tags.band || null,
      moodFeeling: tags.feeling || null,
    })
    setSaving(false)
    if (err || !data) { setError('could not save. your words are still here. try again.'); return }
    if (inSpace && extra.settleId && !extra.keepOpen) {
      await settleRevisit(extra.settleId)
      window.dispatchEvent(new CustomEvent('maslow:revisit-changed'))
    }
    hapticSuccess()
    window.dispatchEvent(new CustomEvent('maslow:entry-added', { detail: { entry: data, dateKey: today } }))
    writeDraft('', null)
    setText('')
    exit()
  }
  doneRef.current = done

  const empty = !entry

  // a space can write into the page for you (a heading, a tapped suggestion);
  // the caret goes to the end so the next thing typed lands after it
  function writeText(v) {
    setText(v)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (el) { el.focus(); el.setSelectionRange(v.length, v.length) }
    })
  }

  useLayoutEffect(() => {
    if (blank && blankWrapRef.current) blankH.current = blankWrapRef.current.offsetHeight
  })

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>WRITE</span>
      </div>

      {/* always here, so the spaces never jump when one is picked */}
      <p className={styles.caption}>begin with one of these, or just write</p>

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
              onClick={() => pick(x.id)}
            >
              {GLYPHS[x.id]}
              <span id={`${uid}-${x.id}`} className={styles.sr}>{x.description}</span>
            </button>
          )
        })}
      </div>

      {inSpace && <p className={styles.caption} aria-live="polite">{exp.name} — {exp.description}</p>}

      {intro ? (
        <div className={styles.intro} style={blankH.current ? { minHeight: blankH.current } : undefined}>
          <h3 className={styles.introTitle}>{exp.name}</h3>
          <p className={styles.introText}>{exp.description}</p>
          <div className={styles.introActions}>
            <button type="button" className={styles.start} onClick={() => setStarted(true)}>
              <span className={styles.startPill}>start</span>
            </button>
            <button type="button" className={styles.notNow} onClick={exit}>cancel</button>
          </div>
          {body && <p className={styles.kept}>what you've written is kept</p>}
        </div>
      ) : (
        <div className={styles.pageWrap} ref={blank ? blankWrapRef : undefined}>
          <div className={styles.page} ref={pageRef}>
            {Space && (
              <Space
                key={mode}
                state={state}
                today={todayKey()}
                text={text}
                setText={writeText}
                onChange={onSpace}
                onFinish={() => doneRef.current?.()}
              />
            )}
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
            {blank && <JournalTags state={state} today={todayKey()} logMood={logMood} onChange={setTags} />}
            {error && <div className={styles.error} role="alert">{error}</div>}
            <div className={styles.footer}>
              <span className={styles.saves} role={extra.ring != null ? 'timer' : undefined}>{inSpace && extra.note ? extra.note : (justSaved ? 'saved · just now' : 'saves as you type')}</span>
              <div className={styles.footerActions}>
                {inSpace && <button type="button" className={styles.cancel} onClick={exit}>cancel</button>}
                <button type="button" className={styles.done} onClick={done} disabled={empty || saving}>
                  <span className={styles.donePill}>done</span>
                </button>
              </div>
            </div>
          </div>
          {inSpace && extra.ring != null && size.w > 0 && (
            <svg className={styles.ring} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
              <path className={styles.ringTrack} d={ringPath(size.w, size.h)} />
              <path className={styles.ringBar} d={ringPath(size.w, size.h)} pathLength="100" strokeDasharray="100" strokeDashoffset={extra.ring * 100} />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
