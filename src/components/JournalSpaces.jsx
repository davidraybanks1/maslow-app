import { useEffect, useMemo, useRef, useState } from 'react'
import { allNeeds, MODES } from '../lib/constants'
import { MOOD_PIP_COLOR } from './FrequencyCard'
import { loadRecentDrafts } from '../lib/store'
import { hapticTick } from '../lib/native'
import {
  truthPool, pickTruths, tensionPair,
  shortDate, clip, daySeed,
} from '../lib/shapeFacts'
import { factDot, sentence } from './shapes/Rooms'
import styles from './JournalSpaces.module.css'

/* The six writing experiences, as the bit that sits around the page.
   The page itself (one textarea, one footer) belongs to JournalPage, so
   writing feels the same in all of them. Each space here shows its own
   affordance above the textarea and reports what it adds through
   onChange({ lead, needId, quotedText, quotedDate, settleId, keepOpen,
             placeholder, locked, ring, note }).
   Props every space gets: state, today, text (what's typed), onChange. */

/* A fact (from the person's own data) as a quiet block inside the page. */
function Fact({ fact }) {
  return (
    <div className={styles.fact}>
      <div className={styles.factLabel}>
        <span className={styles.factDot} style={{ background: factDot(fact) }} />
        {fact.label}
      </div>
      <div className={styles.factText}>{sentence(fact.text)}</div>
    </div>
  )
}

/* The same dotted bend used in the old notes, colour of the note it leaves. */
function Thread({ fact }) {
  return (
    <div className={styles.thread} aria-hidden="true" style={{ color: factDot(fact) }}>
      <svg width="44" height="30" viewBox="0 0 44 38">
        <path d="M22 1 C 4 11, 40 27, 22 37" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="0.1 7" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/* ── three truths ─────────────────────────────────────────── */
function ThreeTruths({ state, today, text, onChange }) {
  const pool = useMemo(() => truthPool(state, today), [state, today])
  const [offset, setOffset] = useState(0)
  const truths = pickTruths(pool, offset, daySeed(today))
  const body = text.trim()
  useEffect(() => {
    onChange({ lead: `Three things that were true: ${truths.map(t => t.text).join(' · ')}.`, placeholder: 'what do these have in common?' })
  }, [offset, pool])
  // The notes stay put while you write: they're what you're writing about.
  // Once there are words, swapping them would no longer match, so that stops.
  return (
    <div className={styles.space}>
      {truths.map(t => <Fact key={t.id} fact={t} />)}
      <button type="button" className={styles.link} disabled={!!body} onClick={() => setOffset(o => o + 1)}>show me three others</button>
    </div>
  )
}

/* ── tension ──────────────────────────────────────────────── */
function Tension({ state, today, text, onChange }) {
  const [offset, setOffset] = useState(0)
  const [a, b] = useMemo(() => tensionPair(state, today, offset, daySeed(today)), [state, today, offset])
  const body = text.trim()
  useEffect(() => {
    onChange({ lead: `Two things pulling at me: ${a.text} — and ${b.text}.`, placeholder: 'what lives between these two?' })
  }, [offset, a.text, b.text])
  return (
    <div className={styles.space}>
      <Fact fact={a} />
      <Thread fact={a} />
      <Fact fact={b} />
      <button type="button" className={styles.link} disabled={!!body} onClick={() => setOffset(o => o + 1)}>a different pair</button>
    </div>
  )
}

/* ── revisit (stored as the "continue" shape) ───────────────── */
function Continue({ state, onChange }) {
  const [drafts, setDrafts] = useState(null)      // drafts marked 'revisit'
  const [source, setSource] = useState(null)
  const [picking, setPicking] = useState(true)    // opens on the chooser, no note pre-picked
  const [keepOpen, setKeepOpen] = useState(false)

  useEffect(() => {
    let live = true
    loadRecentDrafts(state.userId, 60).then(rows => {
      if (!live) return
      setDrafts(rows.filter(r => r.revisit))
    })
    return () => { live = false }
  }, [state.userId])

  useEffect(() => {
    if (!source) onChange({ placeholder: 'pick a draft to answer…', locked: true })
    else onChange({
      placeholder: 'reply to yourself',
      locked: false,
      quotedText: source.entry,
      quotedDate: source.date_key || null,
      needId: source.need_id || null,
      settleId: source.revisit ? source.id : null,
      keepOpen,
    })
  }, [source, keepOpen])

  const chooseLabel = "drafts you marked 'revisit'"

  if (picking) {
    return (
      <div className={styles.space}>
        <div className={styles.eyebrow}>{chooseLabel}</div>
        {drafts && !drafts.length && (
          <p className={styles.hint}>nothing marked 'revisit' yet. mark a draft and it will be here.</p>
        )}
        <div className={styles.pick}>
          {(drafts || []).map(d => (
            <button type="button" key={d.id} className={styles.pickItem} onClick={() => { setSource(d); setPicking(false) }}>
              <span className={styles.pastMeta}>{shortDate(d.date_key)}{d.mood_feeling ? ` · ${d.mood_feeling}` : ''}</span>
              <span className={styles.pastText}>{clip(d.entry, 120)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className={styles.space}>
      {source && (
        <div className={styles.past}>
          <div className={styles.pastMeta}>
            <span>you · {shortDate(source.date_key)}</span>
            {source.mood_band && (
              <span className={styles.pastMood}>
                <span className={styles.factDot} style={{ background: MOOD_PIP_COLOR[source.mood_band] }} />
                {source.mood_feeling || source.mood_band}
              </span>
            )}
          </div>
          {source.revisit_question && <p className={styles.pastAsk}>you asked: {source.revisit_question}</p>}
          <p className={styles.pastText}>{clip(source.entry, 280)}</p>
        </div>
      )}
      {source?.revisit && (
        <label className={styles.keepOpen}>
          <input type="checkbox" checked={keepOpen} onChange={e => setKeepOpen(e.target.checked)} />
          keep this one in revisit
        </label>
      )}
      <div className={styles.linkRow}>
        <button type="button" className={styles.link} onClick={() => setPicking(true)}>{chooseLabel}</button>
      </div>
    </div>
  )
}

/* ── gave and took (stored as the "one_thing" shape) ─────────── */
// One page, three beats: what gave you energy, what took it, what you want
// more of tomorrow. The first heading rides along as the entry's lead; the
// later ones are written into the page when you move on, so the step you are
// on is simply read back from the text. The needs you moved toward today are
// offered as tags for the entry (an entry carries one need tag).
const GT_HEADINGS = ['took it:', 'tomorrow:']
const GT_STEPS = [
  { q: 'what gave you energy today?', ph: 'something that gave you energy…', color: MODES.nourishment.pip },
  { q: 'what took it?', ph: 'this is slowly draining me because…', color: MODES.survival.pip },
  { q: 'what do you want more of tomorrow?', ph: 'more of…', color: MODES.exploration.pip },
]
function gtStepOf(text) {
  const lines = (text || '').split('\n').map(l => l.trim().toLowerCase())
  let step = 0
  GT_HEADINGS.forEach((h, i) => { if (lines.includes(h)) step = i + 1 })
  return step
}
function OneThing({ state, today, text, onChange }) {
  const step = gtStepOf(text)
  const s = GT_STEPS[step]
  const [needId, setNeedId] = useState(null)
  // the needs they have moved toward today, from the check-ins already on the device
  const moved = useMemo(() => {
    const counts = {}
    for (const e of ((state.checkins || {})[today] || [])) counts[e.need_id] = (counts[e.need_id] || 0) + (e.count || 1)
    return allNeeds().filter(n => counts[n.id] > 0 && state.canvas?.[n.id])
  }, [state.checkins, state.canvas, today])
  const pickedName = moved.find(n => n.id === needId)?.name
  // "next" stands in for "done" until the last step, and only lights once the
  // current step has something in it
  const sectionText = (() => {
    const lines = (text || '').split('\n')
    let from = 0
    GT_HEADINGS.slice(0, step).forEach(h => { const ix = lines.findIndex(l => l.trim().toLowerCase() === h); if (ix >= 0) from = ix + 1 })
    return lines.slice(from).join('\n').trim()
  })()
  const ph = step === 0 && pickedName ? `how'd ${pickedName} feel…` : s.ph
  useEffect(() => {
    onChange({
      lead: 'gave me energy:',
      placeholder: ph,
      needId: needId || null,
      nextHeading: step < GT_HEADINGS.length ? GT_HEADINGS[step] : null,
      ctaDisabled: !sectionText,
    })
  }, [step, needId, ph, !!sectionText])
  return (
    <div className={styles.space}>
      <div className={styles.steps} aria-hidden="true">
        {GT_STEPS.map((x, i) => <span key={i} className={styles.stepPip} style={i <= step ? { background: x.color } : undefined} />)}
      </div>
      <p className={styles.stepQ} aria-live="polite">{s.q}</p>
      {step === 0 && moved.length > 0 && (
        <>
          <p className={styles.stepHint}>needs you moved toward today · tap to tag</p>
          <div className={styles.needs} role="group" aria-label="tag a need">
            {moved.map(n => (
              <button
                type="button"
                key={n.id}
                className={`${styles.need} ${n.id === needId ? styles.needOn : ''}`}
                aria-pressed={n.id === needId}
                onClick={() => { hapticTick(); setNeedId(id => id === n.id ? null : n.id) }}
              >
                <span className={styles.factDot} style={{ background: MODES[state.canvas?.[n.id]]?.color || 'var(--ink4)' }} />
                {n.name}
              </button>
            ))}
          </div>
        </>
      )}
      {step > 0 && needId && <p className={styles.stepHint}>tagged · {pickedName}</p>}
    </div>
  )
}

/* ── timer room ───────────────────────────────────────────── */
const PRESETS = [2, 5, 10]
const DEFAULT_MINUTES = 5
const MAX_MINUTES = 60
const MINUTES_KEY = 'loam_timer_minutes'
function readMinutes() {
  try {
    const n = parseInt(localStorage.getItem(MINUTES_KEY) || '', 10)
    if (n >= 1 && n <= MAX_MINUTES) return n
  } catch { /* storage unavailable */ }
  return DEFAULT_MINUTES
}
function TimerRoom({ text, onChange }) {
  const [minutes, setMinutes] = useState(readMinutes)
  const [customOpen, setCustomOpen] = useState(() => !PRESETS.includes(readMinutes()))
  const [customText, setCustomText] = useState(() => (PRESETS.includes(readMinutes()) ? '' : String(readMinutes())))
  const total = minutes * 60
  const [left, setLeft] = useState(total)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const startedAt = useRef(0)
  const started = running || done || left !== total

  // the ring starts with the first word
  useEffect(() => { if (!started && text.length > 0) setRunning(true) }, [text])

  useEffect(() => {
    if (!running) return
    startedAt.current = Date.now() - (total - left) * 1000
    const id = setInterval(() => {
      const remaining = Math.max(0, total - Math.floor((Date.now() - startedAt.current) / 1000))
      setLeft(remaining)
      if (remaining === 0) {
        clearInterval(id)
        setRunning(false)
        setDone(true)
      }
    }, 250)
    return () => clearInterval(id)
  }, [running])

  const mm = String(Math.floor(left / 60))
  const ss = String(left % 60).padStart(2, '0')
  useEffect(() => {
    onChange({
      placeholder: 'start typing. the ring starts with you.',
      ring: 1 - left / total,
      locked: done,
    })
  }, [left, total, done])

  function pick(n) {
    if (started) return
    setMinutes(n)
    setLeft(n * 60)
    try { localStorage.setItem(MINUTES_KEY, String(n)) } catch { /* storage unavailable */ }
  }
  function onCustom(v) {
    const digits = v.replace(/[^0-9]/g, '').slice(0, 2)
    setCustomText(digits)
    const n = parseInt(digits, 10)
    if (n >= 1 && n <= MAX_MINUTES) pick(n)
  }
  return (
    <div className={styles.space}>
      <div className={styles.lengths} role="group" aria-label="how long">
        {PRESETS.map(n => (
          <button
            type="button"
            key={n}
            className={`${styles.length} ${!customOpen && minutes === n ? styles.lengthOn : ''}`}
            aria-pressed={!customOpen && minutes === n}
            disabled={started}
            onClick={() => { setCustomOpen(false); pick(n) }}
          >{n} min</button>
        ))}
        <button
          type="button"
          className={`${styles.length} ${customOpen ? styles.lengthOn : ''}`}
          aria-pressed={customOpen}
          disabled={started}
          onClick={() => { setCustomOpen(true); if (!customText) setCustomText(String(minutes)) }}
        >custom</button>
        {customOpen && (
          <label className={styles.customWrap}>
            <input
              className={styles.customInput}
              inputMode="numeric"
              pattern="[0-9]*"
              value={customText}
              onChange={e => onCustom(e.target.value)}
              disabled={started}
              aria-label="minutes"
              placeholder="7"
            />
            <span>min</span>
          </label>
        )}
      </div>
    </div>
  )
}

export const SPACES = {
  three_truths: ThreeTruths,
  tension: Tension,
  continue: Continue,
  one_thing: OneThing,
  timer: TimerRoom,
}
