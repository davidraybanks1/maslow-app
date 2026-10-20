import { useMemo, useEffect, useState } from 'react'
import { allNeeds, MODES, MODE_ORDER, MODE_MAX_BUBBLES } from '../lib/constants'
import { isSplit } from '../lib/practiceTypes'
import { practiceKey } from '../lib/usePracticeActions'
import { useHold } from '../lib/useHold'
import { PracticePanel } from './PracticeRow'
import PracticeIcon from './PracticeIcon'
import styles from './NeedsSection.module.css'

// The Needs section on Today (phones). Every need is a chip you can see at a
// glance, filling as you do its practices; tap a chip to open that need's
// practices as a row of cards underneath. Only one need is open at a time.
//
// What counts as "met" is the app's own rule, not "one practice": each need has
// a target by mode (exploration 3, appreciation 2, nourishment and survival 1,
// MODE_MAX_BUBBLES) and the chip fills toward it. Checking a practice is still
// press-and-hold, same as everywhere else in the app.

// Text on a solid mode colour. Chosen for contrast (4.5:1 or better), so
// survival takes dark text even though its colour is warm.
const ON = {
  exploration: '#FFFDF9',
  appreciation: 'var(--ink)',
  nourishment: 'var(--ink)',
  survival: 'var(--ink)',
}

// a light orb for the dark Exploration card once a practice is done
const LIGHT_ORB = ['#FFFDF9', '#D9D3C7']

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
  if (days == null) return 'never'
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

function PracticeCard({ need, mode, practice, st, lastDays, onTap, onHint, onToggle, expanded }) {
  const split = isSplit(practice)
  const inert = st.kind === 'boundary' && !st.done && st.phase !== 'ended'
  const foot = footFor(st, lastDays)
  const showX2 = ((st.kind === 'check' && st.cfg.target <= 1) || st.kind === 'ritual') && st.count >= 2

  // press and hold to check off (or undo); a quick tap opens a practice that
  // has something to open, and otherwise says how this works
  const hold = useHold({ onComplete: onTap, onTap: split ? onToggle : onHint, fill: !inert })

  const label = `${practice.label}, ${st.done ? 'done today' : `last done ${relative(lastDays)}`}. hold to ${st.done ? 'undo' : 'check off'}`
  return (
    <div
      ref={hold.cardRef}
      data-hold-card=""
      className={`${styles.pcard} ${st.done ? styles.pcardDone : ''} ${inert ? styles.pcardInert : ''}`}
      data-undo={st.done ? '1' : undefined}
    >
      <span ref={hold.fillRef} className={styles.pfill} aria-hidden="true" />
      <button
        type="button"
        className={styles.phit}
        aria-label={label}
        aria-pressed={st.done}
        aria-expanded={split ? !!expanded : undefined}
        {...hold.press}
      >
        <span className={styles.ptop}>
          <span className={styles.picon}>
            {/* the practice's own icon; on a done Exploration card (dark green) it flips to light */}
            <PracticeIcon
              kind={st.kind}
              size={30}
              lit={st.done && mode === 'exploration' ? LIGHT_ORB : null}
              color={st.done && mode === 'exploration' ? '#FFFDF9' : 'var(--ink)'}
            />
          </span>
          <span className={styles.pmeta}>
            {showX2 && <span className={styles.x2}>×2</span>}
            {split && <i className={`${styles.chev} ${expanded ? styles.chevOpen : ''}`} aria-hidden="true" />}
          </span>
        </span>
        <span className={styles.pbottom}>
          <span className={styles.pname}>{practice.label}</span>
          <span className={styles.pfoot}>{foot}</span>
        </span>
      </button>
    </div>
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
        {need && sorted.length === 0 && (
          <div className={styles.rail}>
            <button
              type="button"
              className={styles.addCard}
              onClick={() => navigate('/practices', { state: { returnTo: '/today' } })}
            >+ add practice</button>
          </div>
        )}
        {need && sorted.length > 0 && (
          <div className={styles.rail} role="group" aria-label={`${need.name} practices`}>
            {sorted.map(practice => {
              const key = practiceKey(need, practice)
              const st = practices.statusOf(need, practice)
              return (
                <PracticeCard
                  key={key}
                  need={need}
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
      <div className={styles.header}>
        <span className={styles.headerLabel}>NEEDS</span>
        {total > 0 && <span className={styles.headerCount} aria-label={`${met} of ${total} needs met`}>{met}/{total} met</span>}
      </div>
      <div className={styles.list}>
        {cats.map(({ mode, needs, rows, metCount }) => {
          const cat = MODES[mode]
          const drawerId = `needs-drawer-${mode}`
          const openHere = needs.some(n => n.id === openNeedId) ? openNeedId : null
          return (
            <div
              key={mode}
              className={styles.cat}
              style={{ '--cat': cat.color, '--on': ON[mode] }}
              data-tour={mode === tourMode ? 'modes' : undefined}
            >
              <div className={styles.catHead}>
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.catName}>{mode}</span>
                <span className={styles.catScore}>{metCount}/{needs.length}</span>
              </div>
              <div className={styles.chips}>
                {rows.map(({ need, count, target }) => {
                  const isOpen = openNeedId === need.id
                  const pct = target > 0 ? Math.round((count / target) * 100) : 0
                  return (
                    <button
                      key={need.id}
                      type="button"
                      className={`${styles.chip} ${isOpen ? styles.chipOpen : ''}`}
                      aria-expanded={isOpen}
                      aria-controls={drawerId}
                      aria-label={`${need.name}, ${count} of ${target} done today`}
                      onClick={() => toggle(need.id)}
                    >
                      <span className={styles.chipFill} style={{ width: `${pct}%` }} aria-hidden="true" />
                      <span className={styles.chipName}>{need.name}</span>
                      {/* the same label again in the on-colour, shown only over the filled part */}
                      <span className={styles.chipOn} style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} aria-hidden="true">{need.name}</span>
                    </button>
                  )
                })}
              </div>
              <Drawer
                id={drawerId}
                open={openHere}
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
    </>
  )
}
