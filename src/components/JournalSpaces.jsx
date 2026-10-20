import { useEffect, useMemo, useRef, useState } from 'react'
import { allNeeds, MODES } from '../lib/constants'
import { MOOD_PIP_COLOR } from './FrequencyCard'
import { loadRecentDrafts } from '../lib/store'
import { hapticTick } from '../lib/native'
import {
  truthPool, pickTruths, tensionPair, todayChips, anglesFor,
  shortDate, clip, daySeed,
} from '../lib/shapeFacts'
import { factDot, sentence } from './shapes/Rooms'
import styles from './JournalSpaces.module.css'

/* The six writing experiences, as the bit that sits around the page.
   The page itself (one textarea, one footer) belongs to JournalPage, so
   writing feels the same in all of them. Each space here shows its own
   affordance above the textarea and reports what it adds through
   onChange({ lead, leadOnly, needId, quotedText, quotedDate, settleId, keepOpen,
             placeholder, locked, hideInput, ring, note }).
   Props every space gets: state, today, text (what's typed), onChange, onFinish (timer: the ring closed). */

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

/* ── sort first ───────────────────────────────────────────── */
const BUCKETS = [
  { key: 'gave', label: 'gave me energy', color: MODES.exploration.color },
  { key: 'took', label: 'took energy', color: MODES.survival.color },
  { key: 'carry', label: 'still carrying', color: MODES.nourishment.color },
]
function SortFirst({ state, today, onChange }) {
  const chips = useMemo(() => todayChips(state, today), [state, today])
  const [vals, setVals] = useState({ gave: '', took: '', carry: '' })
  const [focus, setFocus] = useState('gave')
  useEffect(() => {
    const lines = BUCKETS
      .filter(b => vals[b.key].trim())
      .map(b => `${b.label[0].toUpperCase()}${b.label.slice(1)}: ${vals[b.key].trim()}`)
    onChange({ lead: lines.join('\n'), leadOnly: true, hideInput: true })
  }, [vals])
  function addChip(label) {
    hapticTick()
    setVals(v => ({ ...v, [focus]: v[focus] ? `${v[focus]}, ${label}` : label }))
  }
  return (
    <div className={styles.space}>
      {chips.length > 0 && (
        <>
          <div className={styles.eyebrow}>you checked in today · tap to place</div>
          <div className={styles.chipRow}>
            {chips.map(c => <button type="button" key={c} className={`${styles.chip} ${styles.chipBtn}`} onClick={() => addChip(c)}>{c}</button>)}
          </div>
        </>
      )}
      <div className={styles.piles}>
        {BUCKETS.map(b => (
          <label key={b.key} className={`${styles.pile} ${focus === b.key ? styles.pileOn : ''}`}>
            <span className={styles.pileLabel}><span className={styles.factDot} style={{ background: b.color }} />{b.label}</span>
            <input
              className={styles.pileInput}
              value={vals[b.key]}
              onChange={e => setVals(v => ({ ...v, [b.key]: e.target.value }))}
              onFocus={() => setFocus(b.key)}
              placeholder="a line is enough"
              maxLength={2000}
              aria-label={b.label}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

/* ── continue ─────────────────────────────────────────────── */
function Continue({ state, onChange }) {
  const [drafts, setDrafts] = useState(null)
  const [source, setSource] = useState(null)
  const [picking, setPicking] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false)
  const [fresh, setFresh] = useState(false)

  useEffect(() => {
    let live = true
    loadRecentDrafts(state.userId, 14).then(rows => {
      if (!live) return
      setDrafts(rows)
      if (rows.length) setSource(rows.find(r => r.revisit) || rows[0])
    })
    return () => { live = false }
  }, [state.userId])

  useEffect(() => {
    if (fresh || !source) onChange({ placeholder: fresh ? 'a note to self' : 'pick a note to answer…' })
    else onChange({
      placeholder: 'reply to yourself',
      quotedText: source.entry,
      quotedDate: source.date_key || null,
      needId: source.need_id || null,
      settleId: source.revisit ? source.id : null,
      keepOpen,
    })
  }, [source, keepOpen, fresh])

  if (drafts && !drafts.length) {
    return <p className={styles.hint}>nothing to continue yet. write one first. this will be here after.</p>
  }
  if (picking) {
    return (
      <div className={styles.space}>
        <div className={styles.eyebrow}>older drafts</div>
        <div className={styles.pick}>
          {(drafts || []).map(d => (
            <button type="button" key={d.id} className={styles.pickItem} onClick={() => { setSource(d); setFresh(false); setPicking(false) }}>
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
      {!fresh && source && (
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
      {!fresh && source?.revisit && (
        <label className={styles.keepOpen}>
          <input type="checkbox" checked={keepOpen} onChange={e => setKeepOpen(e.target.checked)} />
          keep this one in revisit
        </label>
      )}
      <div className={styles.linkRow}>
        <button type="button" className={styles.link} onClick={() => setPicking(true)}>older drafts</button>
        <button type="button" className={styles.link} onClick={() => setFresh(f => !f)}>{fresh ? 'back to the thread' : 'a note to self'}</button>
      </div>
    </div>
  )
}

/* ── one thing ────────────────────────────────────────────── */
function OneThing({ state, onChange }) {
  const needs = useMemo(() => {
    const ids = Object.keys(state.canvas || {})
    const list = allNeeds().filter(n => ids.includes(n.id))
    return list.length ? list : allNeeds().slice(0, 6)
  }, [state.canvas])
  const [needId, setNeedId] = useState(null)
  const [angleIx, setAngleIx] = useState(0)
  const need = needs.find(n => n.id === needId)
  const angles = anglesFor(needId)
  useEffect(() => {
    onChange({ needId: needId || null, locked: !need, placeholder: need ? `one thing about ${need.name}` : 'which need?' })
  }, [needId])
  return (
    <div className={styles.space}>
      <div className={styles.needs} role="group" aria-label="pick a need">
        {needs.map(n => (
          <button
            type="button"
            key={n.id}
            className={`${styles.need} ${n.id === needId ? styles.needOn : ''}`}
            aria-pressed={n.id === needId}
            onClick={() => { hapticTick(); setNeedId(id => id === n.id ? null : n.id); setAngleIx(0) }}
          >
            <span className={styles.factDot} style={{ background: MODES[state.canvas?.[n.id]]?.color || 'var(--ink4)' }} />
            {n.name}
          </button>
        ))}
      </div>
      {need && (
        <>
          <p className={styles.angle}>{angles[angleIx % angles.length]}</p>
          <button type="button" className={styles.link} onClick={() => setAngleIx(i => i + 1)}>another angle</button>
        </>
      )}
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
function TimerRoom({ text, onChange, onFinish }) {
  const [minutes, setMinutes] = useState(readMinutes)
  const [customOpen, setCustomOpen] = useState(() => !PRESETS.includes(readMinutes()))
  const [customText, setCustomText] = useState(() => (PRESETS.includes(readMinutes()) ? '' : String(readMinutes())))
  const total = minutes * 60
  const [left, setLeft] = useState(total)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const startedAt = useRef(0)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
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
        finishRef.current?.()
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
      note: done ? (text.trim() ? 'saved. nice.' : 'time. nothing written, and that is fine.') : `${mm}:${ss} · saves when the ring closes`,
    })
  }, [left, total, done, text])

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
  sort_first: SortFirst,
  continue: Continue,
  one_thing: OneThing,
  timer: TimerRoom,
}
