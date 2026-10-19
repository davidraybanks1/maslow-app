import { useEffect, useMemo, useRef, useState } from 'react'
import { allNeeds, MODES } from '../../lib/constants'
import { MOOD_PIP_COLOR } from '../FrequencyCard'
import { loadRecentDrafts } from '../../lib/store'
import { hapticTick } from '../../lib/native'
import {
  truthPool, pickTruths, tensionPair, todayChips, anglesFor,
  shortDate, clip,
} from '../../lib/shapeFacts'
import styles from './Shapes.module.css'

/* Every room is a component that reports what would be saved through
   onDraft({ entry, needId, quotedText, quotedDate, settleId, keepOpen }).
   An empty `entry` disables "add". The shell owns saving. */

function autosize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.max(el.scrollHeight, 0) + 'px'
}

/* ── three truths ─────────────────────────────────────────── */
function ThreeTruths({ state, today, onDraft }) {
  const pool = useMemo(() => truthPool(state, today), [state, today])
  const [offset, setOffset] = useState(0)
  const truths = pickTruths(pool, offset)
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const body = text.trim()
    const lead = `Three things that were true: ${truths.map(t => t.text).join(' · ')}.`
    onDraft({ entry: body ? `${lead}\n\n${body}` : '' })
  }, [text, offset])

  const [a, b, c] = truths
  // Notes collapse to chips while you write. One stable tree (the card never
  // changes position) so the textarea keeps focus when this flips; stays
  // collapsed once there's text so the layout doesn't jump under a tap.
  const collapsed = typing || !!text.trim()
  return (
    <div className={styles.body}>
      <div className={styles.stack}>
        {collapsed && (
          <div className={styles.chipRow}>
            {truths.map(t => <span key={t.id} className={styles.chip}>{t.text}</span>)}
          </div>
        )}
        {!collapsed && <div className={`${styles.note} ${styles.noteA}`}>{a?.text}</div>}
        <div className={styles.card}>
          <textarea
            className={styles.area}
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            placeholder="what do these have in common?"
            maxLength={9000}
            aria-label="what do these three truths have in common"
          />
        </div>
        {!collapsed && b && <div className={`${styles.note} ${styles.noteB}`}>{b.text}</div>}
        {!collapsed && c && <div className={`${styles.note} ${styles.noteC}`}>{c.text}</div>}
      </div>
      {!collapsed && <button className={styles.shuffle} onClick={() => setOffset(o => o + 1)}>show me three others</button>}
    </div>
  )
}

/* ── tension ──────────────────────────────────────────────── */
function Tension({ state, today, onDraft }) {
  const [offset, setOffset] = useState(0)
  const [a, b] = useMemo(() => tensionPair(state, today, offset), [state, today, offset])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const body = text.trim()
    onDraft({ entry: body ? `Two things pulling at me: ${a.text} — and ${b.text}.\n\n${body}` : '' })
  }, [text, offset])

  const collapsed = typing || !!text.trim()
  return (
    <div className={styles.body}>
      <div className={styles.stack}>
        {collapsed && (
          <div className={styles.chipRow}>
            <span className={styles.chip}>{a.text}</span>
            <span className={styles.chip}>{b.text}</span>
          </div>
        )}
        {!collapsed && <div className={`${styles.note} ${styles.noteA} ${styles.noteUp}`}>{a.text}</div>}
        {!collapsed && <div className={styles.thread} aria-hidden="true" />}
        <div className={styles.card}>
          <textarea
            className={styles.area}
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            placeholder="what lives between these two?"
            maxLength={9000}
            aria-label="what lives between these two"
          />
        </div>
        {!collapsed && <div className={styles.thread} aria-hidden="true" />}
        {!collapsed && <div className={`${styles.note} ${styles.noteB} ${styles.noteDown}`} style={{ marginTop: 0 }}>{b.text}</div>}
      </div>
      {!collapsed && <button className={styles.shuffle} onClick={() => setOffset(o => o + 1)}>a different pair</button>}
    </div>
  )
}

/* ── sort first ───────────────────────────────────────────── */
const BUCKETS = [
  { key: 'gave', label: 'gave me energy', color: MODES.exploration.color },
  { key: 'took', label: 'took energy', color: MODES.survival.color },
  { key: 'carry', label: 'still carrying', color: MODES.nourishment.color },
]

function SortFirst({ state, today, onDraft }) {
  const chips = useMemo(() => todayChips(state, today), [state, today])
  const [vals, setVals] = useState({ gave: '', took: '', carry: '' })
  const [focus, setFocus] = useState('gave')

  useEffect(() => {
    const lines = BUCKETS
      .filter(b => vals[b.key].trim())
      .map(b => `${b.label[0].toUpperCase()}${b.label.slice(1)}: ${vals[b.key].trim()}`)
    onDraft({ entry: lines.join('\n') })
  }, [vals])

  function addChip(label) {
    hapticTick()
    setVals(v => ({ ...v, [focus]: v[focus] ? `${v[focus]}, ${label}` : label }))
  }

  return (
    <div className={styles.body}>
      {chips.length > 0 ? (
        <>
          <div className={styles.eyebrow} style={{ marginBottom: 8 }}>you checked in today · tap to place</div>
          <div className={styles.tray}>
            {chips.map(c => (
              <button key={c} className={`${styles.chip} ${styles.chipBtn}`} onClick={() => addChip(c)}>{c}</button>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.trayHint}>nothing checked in yet today. sort whatever you remember.</p>
      )}
      {BUCKETS.map(b => (
        <div key={b.key} className={styles.bucket}>
          <div className={styles.bucketLabel}>
            <span className={styles.bucketDot} style={{ background: b.color }} />
            {b.label}
          </div>
          <textarea
            className={styles.bucketInput}
            rows={2}
            value={vals[b.key]}
            onChange={e => setVals(v => ({ ...v, [b.key]: e.target.value }))}
            onFocus={() => setFocus(b.key)}
            onInput={e => autosize(e.target)}
            placeholder="a line is enough"
            maxLength={2000}
            aria-label={b.label}
          />
        </div>
      ))}
    </div>
  )
}

/* ── continue a conversation with yourself ────────────────── */
function Continue({ state, today, source: initialSource, onDraft }) {
  const [drafts, setDrafts] = useState(null)
  const [source, setSource] = useState(initialSource || null)
  const [picking, setPicking] = useState(false)
  const [text, setText] = useState('')
  const [keepOpen, setKeepOpen] = useState(false)
  const [fresh, setFresh] = useState(false)

  useEffect(() => {
    let live = true
    loadRecentDrafts(state.userId, 14).then(rows => {
      if (!live) return
      setDrafts(rows)
      if (!initialSource && rows.length) {
        // the revisit-marked ones first, then the most recent
        const mark = rows.find(r => r.revisit)
        setSource(mark || rows[0])
      }
    })
    return () => { live = false }
  }, [state.userId])

  useEffect(() => {
    const body = text.trim()
    if (!body) { onDraft({ entry: '' }); return }
    if (fresh || !source) { onDraft({ entry: body }); return }
    onDraft({
      entry: body,
      quotedText: source.entry,
      quotedDate: source.date_key || null,
      needId: source.need_id || null,
      settleId: source.revisit ? source.id : null,
      keepOpen,
    })
  }, [text, source, keepOpen, fresh])

  if (drafts && !drafts.length && !source) {
    return (
      <div className={styles.body}>
        <p className={styles.trayHint}>there is nothing to continue yet. write one first. this room will be here after.</p>
        <div className={styles.card}>
          <textarea className={styles.area} value={text} onChange={e => setText(e.target.value)} placeholder="a note to self" maxLength={9000} aria-label="a note to self" />
        </div>
      </div>
    )
  }

  if (picking) {
    return (
      <div className={styles.body}>
        <div className={styles.eyebrow} style={{ marginBottom: 10 }}>older drafts</div>
        <div className={styles.pick}>
          {(drafts || []).map(d => (
            <button key={d.id} className={styles.pickItem} onClick={() => { setSource(d); setFresh(false); setPicking(false) }}>
              <div className={styles.pastMeta}>{shortDate(d.date_key)}{d.mood_feeling ? ` · ${d.mood_feeling}` : ''}</div>
              <p className={styles.pastText}>{clip(d.entry, 140)}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.body}>
      {!fresh && source && (
        <div className={styles.thread2}>
          {source.quoted_text && (
            <div className={styles.past} style={{ opacity: 0.75 }}>
              <div className={styles.pastMeta}>you{source.quoted_date ? ` · ${shortDate(source.quoted_date)}` : ''}</div>
              <p className={styles.pastText}>{clip(source.quoted_text, 200)}</p>
            </div>
          )}
          <div className={styles.past}>
            <div className={styles.pastMeta}>
              <span>you · {shortDate(source.date_key)}</span>
              {source.mood_band && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: MOOD_PIP_COLOR[source.mood_band] }} />
                  {source.mood_feeling || source.mood_band}
                </span>
              )}
            </div>
            {source.revisit_question && <p className={styles.pastAsk}>you asked: {source.revisit_question}</p>}
            <p className={styles.pastText}>{clip(source.entry, 360)}</p>
          </div>
        </div>
      )}
      <div className={styles.youToday}>{fresh ? 'a note to self' : 'you · today'}</div>
      <div className={styles.card}>
        <textarea
          className={styles.area}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={fresh ? 'whatever is here' : 'reply to yourself'}
          maxLength={9000}
          aria-label={fresh ? 'a note to self' : 'reply to yourself'}
        />
      </div>
      {!fresh && source?.revisit && (
        <label className={styles.keepOpen}>
          <input type="checkbox" checked={keepOpen} onChange={e => setKeepOpen(e.target.checked)} />
          keep this one in revisit
        </label>
      )}
      <div className={styles.linkRow}>
        <button className={styles.link} onClick={() => setPicking(true)}>older drafts</button>
        <button className={styles.link} onClick={() => setFresh(f => !f)}>{fresh ? 'back to the thread' : 'a note to self · start fresh'}</button>
      </div>
    </div>
  )
}

/* ── one thing ────────────────────────────────────────────── */
function OneThing({ state, today, onDraft }) {
  const needs = useMemo(() => {
    const ids = Object.keys(state.canvas || {})
    const list = allNeeds().filter(n => ids.includes(n.id))
    return list.length ? list : allNeeds().slice(0, 6)
  }, [state.canvas])
  const [needId, setNeedId] = useState(null)
  const [angleIx, setAngleIx] = useState(0)
  const [text, setText] = useState('')
  const need = needs.find(n => n.id === needId)
  const angles = anglesFor(needId)

  useEffect(() => {
    const body = text.trim()
    onDraft({ entry: body, needId: needId || null })
  }, [text, needId])

  return (
    <div className={styles.body}>
      <div className={styles.needs} role="group" aria-label="pick a need">
        {needs.map(n => (
          <button
            key={n.id}
            className={`${styles.need} ${n.id === needId ? styles.needOn : ''}`}
            aria-pressed={n.id === needId}
            onClick={() => { hapticTick(); setNeedId(id => id === n.id ? null : n.id); setAngleIx(0) }}
          >
            <span className={styles.needDot} style={{ background: MODES[state.canvas?.[n.id]]?.color || 'var(--ink4)' }} />
            {n.name}
          </button>
        ))}
      </div>
      {need ? (
        <>
          <p className={styles.angle}>{angles[angleIx % angles.length]}</p>
          <div className={styles.card}>
            <textarea
              className={`${styles.area} ${styles.areaShort}`}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`one thing about ${need.name}`}
              maxLength={9000}
              aria-label={`one thing about ${need.name}`}
            />
          </div>
          <button className={styles.shuffle} onClick={() => setAngleIx(i => i + 1)}>another angle</button>
        </>
      ) : (
        <p className={styles.trayHint}>pick one. the page opens once you have.</p>
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
const RING_W = 3          // stroke width of the countdown ring
const RING_R = 18         // matches the card's corner radius

// A rounded-rect path that starts at top-centre and runs clockwise, so the
// ring "closes" from the top around the card.
function ringPath(w, h) {
  const i = RING_W / 2
  const r = RING_R - i
  const x0 = i, y0 = i, x1 = w - i, y1 = h - i
  return [
    `M ${w / 2} ${y0}`,
    `H ${x1 - r}`, `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `V ${y1 - r}`, `A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
    `H ${x0 + r}`, `A ${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
    `V ${y0 + r}`, `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
    `H ${w / 2}`,
  ].join(' ')
}

function TimerRoom({ onDraft, onSave }) {
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState(readMinutes)
  const [customOpen, setCustomOpen] = useState(() => !PRESETS.includes(readMinutes()))
  const [customText, setCustomText] = useState(() => (PRESETS.includes(readMinutes()) ? '' : String(readMinutes())))
  const total = minutes * 60
  const [left, setLeft] = useState(total)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const startedAt = useRef(0)
  const textRef = useRef('')
  const cardRef = useRef(null)
  textRef.current = text

  useEffect(() => { onDraft({ entry: text.trim() }) }, [text])

  // Measure the card so the ring hugs it exactly.
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
        const t = textRef.current.trim()
        if (t) onSave({ entry: t })
      }
    }, 250)
    return () => clearInterval(id)
  }, [running])

  const mm = String(Math.floor(left / 60))
  const ss = String(left % 60).padStart(2, '0')
  const used = 1 - left / total
  const started = running || done || left !== total

  // Pick the length before you start; it locks once the ring is moving.
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
    <div className={styles.body}>
      <div className={styles.lengths} role="group" aria-label="how long">
        {PRESETS.map(n => (
          <button
            key={n}
            className={`${styles.length} ${!customOpen && minutes === n ? styles.lengthOn : ''}`}
            aria-pressed={!customOpen && minutes === n}
            disabled={started}
            onClick={() => { setCustomOpen(false); pick(n) }}
          >{n} min</button>
        ))}
        <button
          className={`${styles.length} ${customOpen ? styles.lengthOn : ''}`}
          aria-pressed={customOpen}
          disabled={started}
          onClick={() => { setCustomOpen(true); if (!customText) setCustomText(String(minutes)) }}
        >custom</button>
        {customOpen && (
          <label className={styles.customWrap}>
            <input
              id="timer-custom-minutes"
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
      <div className={styles.timerCard} ref={cardRef}>
        <div className={styles.card}>
          <textarea
            className={styles.area}
            value={text}
            onChange={e => { setText(e.target.value); if (!running && !done) setRunning(true) }}
            disabled={done}
            placeholder="start typing. the ring starts with you."
            maxLength={9000}
            aria-label={`${minutes} minute draft`}
          />
        </div>
        {size.w > 0 && (
          <svg className={styles.timerRing} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
            <path className={styles.ringTrack} d={ringPath(size.w, size.h)} />
            <path className={styles.ringBar} d={ringPath(size.w, size.h)} pathLength="100" strokeDasharray="100" strokeDashoffset={used * 100} />
          </svg>
        )}
      </div>
      <p className={styles.timerNote} role="timer" aria-label={`${mm} minutes ${ss} seconds left`}>
        {done
          ? (text.trim() ? 'saved. nice.' : 'time. nothing written, and that is fine.')
          : <><span className={styles.timerClock}>{mm}:{ss}</span> · saves itself when the ring closes</>}
      </p>
    </div>
  )
}

/* ── registry ─────────────────────────────────────────────── */
export const ROOMS = {
  three_truths: { eyebrow: 'three truths', title: ['three things are true.', 'what do they share?'], Comp: ThreeTruths },
  tension:      { eyebrow: 'tension',      title: ['two things pull.', 'what lives between?'], Comp: Tension },
  sort_first:   { eyebrow: 'sort first',   title: ['sort it first.', 'then say a line.'], Comp: SortFirst },
  continue:     { eyebrow: 'continue',     title: ['continue a conversation', 'with yourself.'], Comp: Continue },
  one_thing:    { eyebrow: 'one thing',    title: ['one need.', 'one thing about it.'], Comp: OneThing },
  timer:        { eyebrow: 'timer room',   title: ['set a timer.', 'then it is done.'], Comp: TimerRoom },
}
