import { useMemo, useEffect, useState } from 'react'
import { allNeeds, MODES, MODE_ORDER, MODE_MAX_BUBBLES } from '../lib/constants'
import { isSplit } from '../lib/practiceTypes'
import { practiceKey } from '../lib/usePracticeActions'
import { PracticePanel } from './PracticeRow'
import { ChapterRow, LabelRow, PracticeDot } from './loam'
import styles from './NeedsSection.module.css'

// The needs on Today (and the desktop panel): the four modes as chapters i.–iv.,
// each need a full row beneath its chapter. A dot means met; circles belong to
// the practices, which are what gets checked off. Tap a row to open that need's
// practices as press-and-hold rows under it. Only one need is open at a time.
//
// What counts as "met" is the app's own rule, not "one practice": each need has
// a target by mode (exploration 3, appreciation 2, nourishment and survival 1,
// MODE_MAX_BUBBLES), and a row part-way there shows its count.

const NUMERAL = { exploration: 'i', appreciation: 'ii', nourishment: 'iii', survival: 'iv' }
const MODE_FILL = {
  exploration: 'var(--loam-exploration)', appreciation: 'var(--loam-appreciation)',
  nourishment: 'var(--loam-nourishment)', survival: 'var(--loam-survival)',
}
const MODE_TEXT = {
  exploration: 'var(--loam-exploration-text)', appreciation: 'var(--loam-appreciation-text)',
  nourishment: 'var(--loam-nourishment-text)', survival: 'var(--loam-survival-text)',
}
// the ×2 inside a filled dot
const ON_FILL = {
  exploration: 'var(--loam-paper)', appreciation: 'var(--loam-ink)',
  nourishment: 'var(--loam-ink)', survival: 'var(--loam-ink)',
}

function countFor(checked, needId) {
  let n = 0
  for (const e of checked) if (e.need_id === needId) n += e.count || 1
  return n
}

function poolFor(state, need) {
  const db = state.practicesDB
  if (db && db.length > 0) return db.filter(p => p.need_id === need.id && !p.archived_at)
  return (state.practices?.[need.id] || []).map(label => ({ id: null, label }))
}

function relative(days) {
  if (days == null) return ''
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

// the small line at the foot of a card: today's state, or how long ago
function footFor(st, lastDays) {
  const { kind, cfg } = st
  if (st.done) {
    if (kind === 'timed') return `${st.detail?.minutes ?? cfg.minutes} min`
    if (kind === 'stretch' && st.detail?.level != null) return `stretched ${st.detail.level}`
    if (kind === 'boundary') return 'kept'
    if (kind === 'check' && cfg.target > 1) return `${cfg.target}/${cfg.target}`
    return 'today'
  }
  if (kind === 'check' && cfg.target > 1 && st.tally > 0) return `${st.tally}/${cfg.target}`
  if (kind === 'checklist' && st.ticked > 0) return `${st.ticked}/${st.required}`
  return relative(lastDays)
}

const KIND_WORD = { ritual: 'ritual', checklist: 'list', stretch: 'stretch', boundary: 'window' }

// The text on the right of a row. The kind icons are gone, so every kind names
// itself here, alongside today's state or how long ago.
function cueFor(st, lastDays) {
  const { kind, cfg } = st
  const foot = footFor(st, lastDays)
  if (kind === 'check') {
    if (cfg.target <= 1) return foot || 'not yet'
    const tally = `${st.tally}/${cfg.target}`
    return !st.done && st.tally === 0 && foot ? `${tally} · ${foot}` : tally
  }
  if (kind === 'timed') return st.done ? foot : [`${cfg.minutes} min`, foot].filter(Boolean).join(' · ')
  if (st.done && (kind === 'boundary' || st.detail?.level != null)) return foot   // "kept", "stretched 7"
  return [KIND_WORD[kind], foot].filter(Boolean).join(' · ')
}

function PracticeCard({ mode, practice, st, lastDays, onTap, onHint, onToggle, expanded }) {
  const split = isSplit(practice)
  const inert = st.kind === 'boundary' && !st.done && st.phase !== 'ended'
  const x2 = ((st.kind === 'check' && st.cfg.target <= 1) || st.kind === 'ritual') && st.count >= 2
  const status = st.done ? 'done today' : lastDays == null ? 'not done yet' : `last done ${relative(lastDays)}`

  // press and hold to check off (or undo); a quick tap opens a practice that
  // has something to open, and otherwise says how this works
  return (
    <PracticeDot
      label={practice.label}
      meta={cueFor(st, lastDays)}
      ariaLabel={`${practice.label}, ${status}. hold to ${st.done ? 'undo' : 'check off'}`}
      done={st.done}
      x2={x2}
      inert={inert}
      expandable={split}
      expanded={expanded}
      fill={MODE_FILL[mode]}
      ring={MODE_TEXT[mode]}
      onFill={ON_FILL[mode]}
      onCheck={onTap}
      onOpen={split ? onToggle : onHint}
    />
  )
}

// The practices of one open need. Kept mounted while it closes so the row can
// fold away instead of vanishing.
function Drawer({ id, open, needs, modeKey, sortSeq, state, checked, practices, lastDoneMap, navigate, onEditPractice }) {
  const [last, setLast] = useState(open)
  useEffect(() => { if (open) setLast(open) }, [open])
  const needId = open || last
  const need = needId ? needs.find(n => n.id === needId) : null

  const pool = need ? poolFor(state, need) : []
  // Rows hold their order while a need is open (fewest-done first at the moment
  // it opened), so tapping one never shuffles the cards under your finger.
  const order = useMemo(() => {
    if (!need) return []
    return [...pool]
      .sort((a, b) => {
        const ca = checked.filter(e => e.need_id === need.id && (a.id && e.practice_id ? e.practice_id === a.id : e.practice_text === a.label)).reduce((s, e) => s + (e.count || 1), 0)
        const cb = checked.filter(e => e.need_id === need.id && (b.id && e.practice_id ? e.practice_id === b.id : e.practice_text === b.label)).reduce((s, e) => s + (e.count || 1), 0)
        return ca - cb
      })
      .map(p => practiceKey(need, p))
  }, [needId, sortSeq])
  const byKey = new Map(pool.map(p => [need ? practiceKey(need, p) : '', p]))
  const sorted = [
    ...order.map(k => byKey.get(k)).filter(Boolean),
    ...pool.filter(p => !order.includes(practiceKey(need, p))),
  ]
  const expandedList = need ? sorted.filter(p => isSplit(p) && practices.expanded[practiceKey(need, p)]) : []

  return (
    <div
      id={id}
      className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
      aria-hidden={!open}
      {...(open ? {} : { inert: '' })}
    >
      <div className={styles.drawerClip}>
        {need && (
          <div className={styles.rows} role="group" aria-label={`${need.name} practices`}>
            {sorted.map(practice => {
              const key = practiceKey(need, practice)
              const st = practices.statusOf(need, practice)
              return (
                <PracticeCard
                  key={key}
                  mode={modeKey}
                  practice={practice}
                  st={st}
                  lastDays={lastDoneMap.get(key) ?? null}
                  expanded={!!practices.expanded[key]}
                  onTap={() => practices.tap(need, modeKey, practice)}
                  onHint={() => practices.say('hold to check off')}
                  onToggle={() => practices.toggleExpanded(key)}
                />
              )
            })}
            <button
              type="button"
              className={styles.addPractice}
              onClick={() => navigate('/practices', { state: { returnTo: '/today' } })}
            >+ add practice</button>
          </div>
        )}
        {expandedList.map(practice => {
          const key = practiceKey(need, practice)
          const st = practices.statusOf(need, practice)
          return (
            <div key={key} className={styles.panelHost}>
              <div className={styles.panelTitle}>{practice.label}</div>
              <PracticePanel
                st={st}
                mode={modeKey}
                onEdit={practice.id ? () => onEditPractice(need, practice) : undefined}
                onBegin={() => practices.beginTimer(need, modeKey, practice)}
                onStretch={() => practices.openStretch(need, modeKey, practice)}
                onToggleItem={i => practices.toggleItem(need, modeKey, practice, i)}
                onAddItem={text => practices.addItem(need, modeKey, practice, text)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function NeedsSection({
  state, checked, practices, lastDoneMap, openNeedId, onOpenNeed, navigate, onEditPractice, tourMode,
}) {
  // bumps every time a need is opened, so its cards re-sort once, then hold still
  const [sortSeq, setSortSeq] = useState(0)

  const cats = MODE_ORDER.map(mode => {
    const needs = allNeeds().filter(n => state.canvas[n.id] === mode)
    const target = MODE_MAX_BUBBLES[mode] || 0
    const rows = needs.map(n => {
      const raw = countFor(checked, n.id)
      return { need: n, count: Math.min(raw, target), target, met: target > 0 && raw >= target }
    })
    return { mode, needs, rows, metCount: rows.filter(r => r.met).length }
  }).filter(c => c.needs.length > 0)

  const total = cats.reduce((s, c) => s + c.needs.length, 0)
  const met = cats.reduce((s, c) => s + c.metCount, 0)

  function toggle(id) {
    if (openNeedId === id) { onOpenNeed(null); return }
    setSortSeq(n => n + 1)
    onOpenNeed(id)
  }

  return (
    <>
      <LabelRow left="NEEDS" right={total > 0 ? <span aria-label={`${met} of ${total} needs met`}>{met}/{total} MET</span> : null} />
      {cats.map(({ mode, needs, rows, metCount }) => (
        <div key={mode} className={styles.cat} data-tour={mode === tourMode ? 'modes' : undefined}>
          <ChapterRow
            numeral={NUMERAL[mode]}
            name={mode}
            met={metCount}
            total={needs.length}
            color={MODE_TEXT[mode]}
            complete={metCount === needs.length}
          />
          <div className={styles.needs}>
            {rows.map(({ need, count, target, met: isMet }) => {
              const isOpen = openNeedId === need.id
              const drawerId = `needs-drawer-${need.id}`
              return (
                <div key={need.id} className={styles.need}>
                  <button
                    type="button"
                    className={`${styles.needRow} ${isOpen ? styles.needRowOpen : ''}`}
                    aria-expanded={isOpen}
                    aria-controls={drawerId}
                    aria-label={`${need.name}, ${count} of ${target}`}
                    onClick={() => toggle(need.id)}
                  >
                    <i className={styles.needDot} style={isMet ? { background: MODE_FILL[mode] } : undefined} />
                    <span className={styles.needName}>{need.name}</span>
                    {count > 0 && !isMet && <small className={styles.needCount}>{count}/{target}</small>}
                    <i className={styles.needArrow} aria-hidden="true" />
                  </button>
                  <Drawer
                    id={drawerId}
                    open={isOpen ? need.id : null}
                    needs={needs}
                    modeKey={mode}
                    sortSeq={sortSeq}
                    state={state}
                    checked={checked}
                    practices={practices}
                    lastDoneMap={lastDoneMap}
                    navigate={navigate}
                    onEditPractice={onEditPractice}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
