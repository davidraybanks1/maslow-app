import { useState } from 'react'
import { MODES } from '../lib/constants'
import {
  isSplit, subLabel, fmtTime, STRETCH_WORDS, MAX_ITEMS,
} from '../lib/practiceTypes'
import PracticeIcon, { TIER_LIT } from './PracticeIcon'
import { useHold } from '../lib/useHold'
import styles from './PracticeRow.module.css'

// Tier colours for a done practice live with the icon (TIER_LIT).
const LIT = TIER_LIT
const PIP = { exploration: '#191612' }

function stampFor(st, lastDays) {
  const { kind, cfg } = st
  if (kind === 'check' && cfg.target > 1) return `${st.tally}/${cfg.target}`
  let s = ''
  if (kind === 'timed') s = st.done ? `${st.detail?.minutes ?? cfg.minutes} min` : ''
  else if (kind === 'checklist') s = st.done ? 'today' : (st.ticked > 0 ? `${st.ticked}/${st.required}` : '')
  else if (kind === 'stretch') s = st.done ? (st.detail?.level != null ? `stretched ${st.detail.level}` : 'today') : ''
  else if (kind === 'boundary') s = st.done ? 'kept' : ''
  else s = st.just ? 'just now' : (st.count >= 1 ? 'today' : '')
  if (!s && !st.done && lastDays > 0) s = `${lastDays}d ago`
  return s
}

function Block({ label, children }) {
  return (
    <div>
      <div className={styles.eyebrow}>{label}</div>
      <div className={styles.text13}>{children}</div>
    </div>
  )
}

function EditLink({ onClick, children = 'edit' }) {
  return <div><button type="button" className={styles.editLink} onClick={onClick}>{children}</button></div>
}

function RitualPanel({ cfg, onEdit }) {
  return (
    <div className={styles.panel}>
      {cfg.anchor && <Block label="begins">{cfg.anchor}</Block>}
      <div>
        <div className={styles.eyebrow}>steps</div>
        <ol className={styles.steps}>
          {cfg.steps.map((s, i) => (
            <li key={i}><span className={styles.stepN}>{i + 1}</span><span className={styles.text13}>{s}</span></li>
          ))}
        </ol>
      </div>
      {cfg.setting && <Block label="setting">{cfg.setting}</Block>}
      {cfg.closing && <Block label="ends with">{cfg.closing}</Block>}
      <EditLink onClick={onEdit}>edit ritual</EditLink>
    </div>
  )
}

function TimedPanel({ st, onBegin, onEdit }) {
  const { cfg } = st
  return (
    <div className={styles.panel}>
      <Block label="timer">
        {cfg.minutes} {cfg.minutes === 1 ? 'minute' : 'minutes'}, full screen. a calm orb keeps the time.
      </Block>
      {st.done
        ? <div className={styles.text13}>logged {st.detail?.minutes ?? cfg.minutes} min today.</div>
        : <div><button type="button" className={styles.pill} onClick={onBegin}>begin · {cfg.minutes} min</button></div>}
      <EditLink onClick={onEdit} />
    </div>
  )
}

function ChecklistPanel({ st, mode, onToggleItem, onAddItem, onEdit }) {
  const { cfg } = st
  const [draft, setDraft] = useState('')
  const pip = PIP[mode] || MODES[mode]?.pip
  const lit = LIT[mode] || LIT.nourishment
  function add() {
    if (onAddItem(draft)) setDraft('')
  }
  return (
    <div className={styles.panel}>
      <div>
        <div className={`${styles.eyebrow} ${styles.listHead}`}>
          <span>{cfg.need === 'all' ? 'items' : `any ${cfg.need} of ${st.items.length}`}</span>
          <span>{st.ticked}/{st.required}</span>
        </div>
        <div className={styles.items}>
          {st.items.map((item, i) => (
            <button
              type="button"
              key={`${i}-${item}`}
              className={styles.item}
              aria-pressed={!!st.ticks[i]}
              onClick={() => onToggleItem(i)}
            >
              <span
                className={`${styles.mini} ${st.ticks[i] ? styles.miniOn : ''}`}
                style={{ '--hi': lit[0], '--lo': lit[1], borderColor: pip }}
              />
              <span className={`${styles.text13} ${st.ticks[i] ? styles.struck : ''}`}>{item}</span>
            </button>
          ))}
        </div>
        {cfg.reset === 'daily' && (
          <>
            {st.items.length < MAX_ITEMS && (
              <div className={styles.addItem}>
                <input
                  className={styles.addInput}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') add() }}
                  placeholder="add something for today"
                  maxLength={60}
                  autoComplete="off"
                  aria-label="add something for today"
                />
                <button type="button" className={styles.addBtn} onClick={add} aria-label="add item">+</button>
              </div>
            )}
            <div className={styles.hint}>this list starts fresh each day.</div>
          </>
        )}
      </div>
      <EditLink onClick={onEdit} />
    </div>
  )
}

function StretchPanel({ st, onStretch, onEdit }) {
  const { cfg } = st
  const level = st.detail?.level
  return (
    <div className={styles.panel}>
      {cfg.small && <Block label="the smallest version">{cfg.small}</Block>}
      <Block label="how often">{cfg.cadence}</Block>
      {st.done && level != null ? (
        <div>
          <div className={styles.eyebrow}>how far you stretched</div>
          <div className={styles.meter}><i className={styles.meterFill} style={{ width: `${level * 10}%` }} /></div>
          <div className={styles.text13}>
            {level} of 10 · {STRETCH_WORDS[level]}{' '}
            <button type="button" className={styles.editLink} onClick={onStretch}>change</button>
          </div>
        </div>
      ) : (
        <div className={`${styles.text13} ${styles.hintText}`}>
          after you do it, hold the practice and tell it how far you went.
        </div>
      )}
      <EditLink onClick={onEdit} />
    </div>
  )
}

function BoundaryPanel({ st, onEdit }) {
  const { cfg, phase } = st
  const win = `${fmtTime(cfg.window.from)} – ${fmtTime(cfg.window.until)}`
  const msg = st.done ? 'you kept it. nicely done.'
    : phase === 'before' ? 'it hasn’t started yet.'
    : phase === 'in' ? `you’re in it now. you’ll check it off once it ends at ${fmtTime(cfg.window.until)}.`
    : 'it’s over. hold the practice if you kept it.'
  return (
    <div className={styles.panel}>
      <Block label="the window">not {win}</Block>
      <div className={`${styles.text13} ${styles.hintText}`}>{msg}</div>
      <EditLink onClick={onEdit} />
    </div>
  )
}

export default function PracticeRow({
  need, mode, practice, status: st, lastDays, expanded,
  onTap, onToggle, onToggleItem, onAddItem, onBegin, onStretch, onEdit, onHint,
}) {
  const kind = st.kind
  const lit = LIT[mode] || LIT.nourishment
  const split = isSplit(practice)
  const inert = kind === 'boundary' && !st.done && st.phase !== 'ended'
  const holding = kind === 'boundary' && !st.done && st.phase === 'in'
  const sub = subLabel(practice, { done: st.done, phase: st.phase, items: st.items })
  const stamp = stampFor(st, lastDays)
  const showX2 = (kind === 'check' && st.cfg.target <= 1 || kind === 'ritual') && st.count >= 2

  // Press and hold to check off (or undo). A quick tap opens the practice if it
  // has something to open, and otherwise reminds you how this works.
  const hold = useHold({
    onComplete: onTap,
    onTap: split ? onToggle : onHint,
    fill: !inert,
  })

  // a thin bar for practices that are partly done: a tally, or a checklist
  let part = 0
  if (!st.done) {
    if (kind === 'check' && st.cfg.target > 1) part = st.tally / st.cfg.target
    else if (kind === 'checklist' && st.required > 0) part = st.ticked / st.required
  }

  const name = `${practice.label}${sub ? `, ${sub}` : ''}${st.done ? ', done' : ''}`
  const panelProps = { st, onEdit }
  return (
    <div className={expanded ? styles.open : undefined} data-kind={kind}>
      <div
        ref={hold.cardRef}
        className={`${styles.card} ${st.done ? styles.cardDone : ''} ${inert ? styles.cardInert : ''} ${holding ? styles.cardHolding : ''} ${split ? styles.cardSplit : ''}`}
        style={{ '--mc': MODES[mode]?.color || '#ABBEA3' }}
        data-undo={st.done ? '1' : undefined}
      >
        <span ref={hold.fillRef} className={styles.fill} aria-hidden="true" />
        <span className={styles.icon}><PracticeIcon kind={kind} size={34} lit={st.done ? lit : null} /></span>
        <span className={styles.text}>
          <span className={styles.label}>{practice.label}</span>
          {sub && <span className={styles.sub}>{sub}</span>}
        </span>
        <span className={styles.meta}>
          {showX2 && <span className={styles.x2}>×2</span>}
          {stamp && <span className={styles.stamp}>{stamp}</span>}
        </span>
        {part > 0 && <span className={styles.partial} aria-hidden="true"><i style={{ width: `${Math.min(1, part) * 100}%` }} /></span>}
        <button
          type="button"
          className={styles.hit}
          aria-label={`${name}. hold to ${st.done ? 'undo' : 'check off'}`}
          aria-pressed={st.done}
          {...hold.press}
        />
        {split && (
          <button
            type="button"
            className={styles.chevBtn}
            aria-label={`${expanded ? 'close' : 'open'} ${practice.label}`}
            aria-expanded={!!expanded}
            onClick={e => { e.stopPropagation(); onToggle() }}
          ><i className={styles.chev} /></button>
        )}
      </div>
      {split && (
        <div
          className={`${styles.panelWrap} ${expanded ? styles.panelWrapOpen : ''}`}
          aria-hidden={!expanded}
          {...(expanded ? {} : { inert: '' })}
        >
          <div className={styles.panelClip}>
            {kind === 'ritual' && <RitualPanel cfg={st.cfg} onEdit={onEdit} />}
            {kind === 'timed' && <TimedPanel {...panelProps} onBegin={onBegin} />}
            {kind === 'checklist' && (
              <ChecklistPanel {...panelProps} mode={mode} onToggleItem={onToggleItem} onAddItem={onAddItem} />
            )}
            {kind === 'stretch' && <StretchPanel {...panelProps} onStretch={onStretch} />}
            {kind === 'boundary' && <BoundaryPanel {...panelProps} />}
          </div>
        </div>
      )}
    </div>
  )
}
