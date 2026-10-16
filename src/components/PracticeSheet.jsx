import { useState } from 'react'
import {
  TYPES, typeOf, defaultConfig, sanitizeConfig, isConfigComplete, MAX_MINUTES,
} from '../lib/practiceTypes'
import PracticeIcon from './PracticeIcon'
import Sheet from './Sheet'
import styles from './PracticeSheet.module.css'

const optList = f => f.opts.map(o => (typeof o === 'object' ? o : { v: o, t: `${o}${f.unit || ''}` }))

function ChipRow({ items, onPick, prefix = '+ ' }) {
  return (
    <div className={styles.chips}>
      {items.map(s => (
        <button type="button" key={s} className={styles.chip} onClick={() => onPick(s)}>{prefix}{s}</button>
      ))}
    </div>
  )
}

function Field({ field, value, onChange }) {
  const f = field
  if (f.kind === 'text') {
    return (
      <div className={styles.field}>
        <div className={styles.eyebrow}>{f.label}</div>
        <input
          className={styles.input}
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={80}
          placeholder={f.ph || ''}
          autoComplete="off"
          aria-label={f.label}
        />
        <div className={styles.hint}>{f.hint}</div>
        {f.sugg && <ChipRow items={f.sugg} onPick={onChange} />}
      </div>
    )
  }
  if (f.kind === 'steps') {
    const list = value
    const set = next => onChange(next)
    const addIdea = s => {
      const i = list.findIndex(x => !x.trim())
      if (i === -1) { if (list.length < f.max) set([...list, s]) }
      else set(list.map((x, j) => (j === i ? s : x)))
    }
    return (
      <div className={styles.field}>
        <div className={styles.eyebrow}>{f.label} <i>{list.length}/{f.max}</i></div>
        {list.map((s, i) => (
          <div key={i} className={`${styles.stepRow} ${f.ordered ? '' : styles.stepRowFlat}`}>
            <span className={styles.stepN}>{f.ordered ? i + 1 : '·'}</span>
            <input
              className={styles.input}
              value={s}
              maxLength={60}
              placeholder={i === 0 ? f.ph : (f.ordered ? 'then…' : f.ph)}
              autoComplete="off"
              aria-label={`${f.ordered ? 'step' : 'item'} ${i + 1}`}
              onChange={e => set(list.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {f.ordered && (
              <button type="button" className={styles.mini} aria-label="move step up" disabled={i === 0}
                onClick={() => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set(a) }}>↑</button>
            )}
            <button type="button" className={styles.mini} aria-label="remove" disabled={list.length === 1}
              onClick={() => { const a = list.filter((_, j) => j !== i); set(a.length ? a : ['']) }}>×</button>
          </div>
        ))}
        {list.length < f.max && (
          <>
            <button type="button" className={styles.link} onClick={() => set([...list, ''])}>
              + add {f.ordered ? 'a step' : 'an item'}
            </button>
            <div className={styles.hint} style={{ marginTop: 6 }}>ideas</div>
            <ChipRow items={f.sugg} onPick={addIdea} />
          </>
        )}
      </div>
    )
  }
  if (f.kind === 'choice') {
    const list = optList(f)
    const isCustom = f.custom && !list.some(o => String(o.v) === String(value))
    return (
      <div className={styles.field}>
        <div className={styles.eyebrow}>{f.label}</div>
        <div className={styles.row}>
          {list.map(o => (
            <button type="button" key={String(o.v)} className={styles.chip}
              aria-pressed={String(o.v) === String(value)} onClick={() => onChange(o.v)}>{o.t}</button>
          ))}
          {f.custom && (
            <>
              <input
                className={`${styles.input} ${styles.num}`}
                inputMode="numeric"
                placeholder="other"
                aria-label={`${f.label}, other`}
                value={isCustom ? value : ''}
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  if (n > 0) onChange(Math.min(n, MAX_MINUTES))
                }}
              />
              <span className={styles.hint} style={{ margin: 0 }}>min</span>
            </>
          )}
        </div>
        {f.hint && <div className={styles.hint}>{f.hint}</div>}
      </div>
    )
  }
  if (f.kind === 'stepper') {
    return (
      <div className={styles.field}>
        <div className={styles.eyebrow}>{f.label}</div>
        <div className={styles.stepper}>
          <button type="button" className={styles.mini} aria-label="fewer" onClick={() => onChange(Math.max(f.min, value - 1))}>−</button>
          <b>{value}</b>
          <button type="button" className={styles.mini} aria-label="more" onClick={() => onChange(Math.min(f.max, value + 1))}>+</button>
        </div>
        {f.hint && <div className={styles.hint}>{f.hint}</div>}
      </div>
    )
  }
  // window
  return (
    <div className={styles.field}>
      <div className={styles.eyebrow}>{f.label}</div>
      <div className={styles.timeRow}>
        from
        <input className={styles.input} type="time" value={value.from} aria-label="from"
          onChange={e => onChange({ ...value, from: e.target.value })} />
        until
        <input className={styles.input} type="time" value={value.until} aria-label="until"
          onChange={e => onChange({ ...value, until: e.target.value })} />
      </div>
      {f.hint && <div className={styles.hint}>{f.hint}</div>}
    </div>
  )
}

// needs: [{ id, name }] the person can file this under; fullNeeds: ids at the cap.
// initial: { kind?, needId?, name?, config?, editing? }
// onArchive: when given (and editing), the sheet also offers "archive", the one stop for everything.
export default function PracticeSheet({ needs, fullNeeds = [], initial = {}, onSave, onArchive, onClose }) {
  const editing = !!initial.editing
  const [kind, setKind] = useState(initial.kind || null)
  const [needId, setNeedId] = useState(initial.needId || null)
  const [name, setName] = useState(initial.name || '')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [vals, setVals] = useState(() => (initial.kind
    ? { ...defaultConfig(initial.kind), ...(initial.config || {}) }
    : {}))

  function pickKind(id) {
    setKind(id)
    setVals(defaultConfig(id))
  }

  const t = kind ? typeOf(kind) : null
  const needFull = !editing && needId && fullNeeds.includes(needId)
  const canSave = !!kind && !!needId && !needFull && name.trim().length > 0 && isConfigComplete(kind, vals)

  function save() {
    if (!canSave) return
    onSave({ needId, label: name.trim(), kind, config: sanitizeConfig(kind, vals) })
  }

  if (!t) {
    return (
      <Sheet label="New practice" onClose={onClose}>
        <div className={styles.head}>what type of practice is it?</div>
        <div className={styles.sub}>pick the one that fits. you can change it.</div>
        <div className={styles.typeGrid}>
          {TYPES.map(ty => (
            <button type="button" key={ty.id} className={styles.tile} onClick={() => pickKind(ty.id)}>
              <PracticeIcon kind={ty.id} size={40} />
              <span className={styles.tileLabel}>{ty.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>not now</button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet label={editing ? `Edit ${t.noun}` : `New ${t.noun}`} onClose={onClose}>
      <div className={styles.top}>
        <PracticeIcon kind={t.id} size={44} />
        <div className={styles.head}>{editing ? `edit ${t.noun}.` : `a new ${t.noun}.`}</div>
      </div>
      <div className={styles.sub}>
        {t.blurb}
        {' '}<button type="button" className={styles.link} onClick={() => setKind(null)}>change type</button>
      </div>
      {!editing && (
        <div className={styles.field}>
          <div className={styles.eyebrow}>under which need?</div>
          <div className={styles.row}>
            {needs.map(n => (
              <button type="button" key={n.id} className={styles.chip} aria-pressed={needId === n.id}
                onClick={() => setNeedId(n.id)}>{n.name}</button>
            ))}
          </div>
          {needFull && <div className={styles.note}>that need already has 10 practices.</div>}
        </div>
      )}
      <div className={styles.field}>
        <div className={styles.eyebrow}>name</div>
        <input
          className={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={80}
          autoComplete="off"
          placeholder="what do you call it?"
          aria-label="name"
        />
      </div>
      {t.fields.map(f => (
        <Field key={f.k} field={f} value={vals[f.k]} onChange={v => setVals(prev => ({ ...prev, [f.k]: v }))} />
      ))}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!canSave} onClick={save}>
          {editing ? 'save changes' : 'save'}
        </button>
        <button type="button" className={styles.secondary} onClick={onClose}>not now</button>
      </div>
      {editing && onArchive && (
        <div className={styles.archive}>
          <button
            type="button"
            className={`${styles.archiveBtn} ${confirmArchive ? styles.archiveConfirm : ''}`}
            onClick={() => { if (confirmArchive) onArchive(); else setConfirmArchive(true) }}
          >
            {confirmArchive ? 'tap again to archive' : 'archive this practice'}
          </button>
          <div className={styles.hint}>it stops appearing on Today. its history is kept.</div>
        </div>
      )}
    </Sheet>
  )
}
