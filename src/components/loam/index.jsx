/* Loam 2b "Cover" primitives — Stage 1
   All visual components for the redesign. Screens rebuild on top of these.
   Parity note: PracticeDot wraps lib/useHold.js unchanged (hapticTick line 102,
   hapticSuccess line 70 stay at their existing call sites). */
import { useState, useRef, useLayoutEffect } from 'react'
import EntryText from '../EntryText'
import JournalQuote from '../JournalQuote'
import SignedImg from '../SignedImg'
import { NavLink } from 'react-router-dom'
import { useHold } from '../../lib/useHold'
import { FEELINGS, BAND_LABEL } from '../../lib/frequency'
import { currentSlot, SLOT_GREETING } from '../../lib/slots'
import { dayNumber } from '../../lib/dayNumber'
import { JOURNAL_TRUNCATE } from '../../lib/constants'
import styles from './index.module.css'

/* ── Dateline ─────────────────────────────────────────────── */
/* WED · OCT 14 · NO. 290  |  ProfileBadge
   onboardedAt: ISO date string from state; badge child passed as prop */
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function Dateline({ onboardedAt, children, docked, text, flush }) {
  const now = new Date()
  const dow = DAY_ABBR[now.getDay()]
  const mon = MON_ABBR[now.getMonth()]
  const day = now.getDate()
  const noNum = dayNumber(onboardedAt, now)
  return (
    <div className={`${styles.dateline} ${docked ? styles.datelineDocked : ''} ${flush ? styles.datelineFlush : ''}`}>
      <span className={styles.datelineText}>{text ?? `${dow} · ${mon} ${day}${noNum ? ` · NO. ${noNum}` : ''}`}</span>
      {children}
    </div>
  )
}

/* ── Greeting ─────────────────────────────────────────────── */
export function Greeting({ word }) {
  return <div className={styles.greeting}>good<br /><em>{word}.</em></div>
}

/* ── ProfileBadge ─────────────────────────────────────────── */
export function ProfileBadge({ initial, onClick, docked, ...rest }) {
  const size = docked ? 26 : 30
  return (
    <button
      type="button"
      className={styles.badge}
      style={{ width: size, height: size }}
      aria-label="profile"
      onClick={onClick}
      {...rest}
    >
      {(initial || '?').toUpperCase()}
    </button>
  )
}

/* ── ProgressRule ─────────────────────────────────────────── */
/* Today's rule is the default. Data's per-row rules pass `bare` (no gutter, no
   %, the row prints its own number), their own label, and tour={null} so only
   Today's carries the tour anchor. `muted` is a day or thread with nothing in it. */
export function ProgressRule({ pct = 0, bare, muted, label, tour = 'space', innerRef }) {
  const p = Math.round(Math.max(0, Math.min(100, pct)))
  return (
    <div
      ref={innerRef}
      className={`${styles.progressRule} ${bare ? styles.progressRuleBare : ''}`}
      role="img"
      aria-label={label ?? `${p}% complete today`}
      data-tour={tour ?? undefined}
    >
      <div className={styles.progressTrack}>
        {p > 0 && <div className={styles.progressFill} style={{ width: `${p}%` }} />}
        <div className={`${styles.progressDots} ${muted ? styles.progressDotsMuted : ''}`} style={{ left: `${p}%`, right: 0 }} />
      </div>
      {!bare && <span className={styles.progressPct}>{p}%</span>}
    </div>
  )
}

/* ── Section furniture (Data, Drafts) ─────────────────────── */
export function SectionTitle({ lead, turn, sub }) {
  return (
    <>
      <h2 className={styles.sectionTitle}>{lead} <em>{turn}</em></h2>
      {sub && <p className={styles.sectionSub}>{sub}</p>}
    </>
  )
}

export function LabelRow({ left, right }) {
  return (
    <div className={styles.labelRow}>
      <span>{left}</span>
      {right != null && <span className={styles.labelRowRight}>{right}</span>}
    </div>
  )
}

/* Tags are words (§4.5): a row of lowercase mono buttons, the selected one underlined. */
export function WordTabs({ options, value, onChange, label }) {
  return (
    <span className={styles.wordTabs} role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          className={`${styles.wordTab} ${value === o.v ? styles.wordTabOn : ''}`}
          onClick={() => onChange(o.v)}
        >{o.label}</button>
      ))}
    </span>
  )
}

/* ── PullQuote ────────────────────────────────────────────── */
export function PullQuote({ text, folio, noTopRule, children }) {
  return (
    <div className={`${styles.pullQuote} ${noTopRule ? styles.pullQuoteNoRule : ''}`}>
      <span className={styles.pullQuoteMark}>&ldquo;</span>
      <div className={styles.pullQuoteBody}>
        {text && <p className={styles.pullQuoteText}>{text}</p>}
        {children}
        {folio && <span className={styles.pullQuoteFolio}>{folio}</span>}
      </div>
    </div>
  )
}

/* The folio under a swipeable note. Kept outside the quote so it stays put
   while the note slides. index, total and onNext are absent when there is no
   deck. The arrow takes the same path as a swipe (NoteStack's commit). */
export function NoteFolio({ index, total, onNext, onEdit }) {
  return (
    <div className={styles.noteFolio}>
      <span className={styles.pullQuoteFolio}>
        NOTE TO SELF{total ? ` · ${index}/${total}` : ''}
        {onNext && <button type="button" className={styles.noteFolioNext} aria-label="next note" onClick={onNext}>→</button>}
      </span>
      {onEdit && <button type="button" className={styles.noteFolioEdit} onClick={onEdit}>edit</button>}
    </div>
  )
}

/* ── CheckIn ──────────────────────────────────────────────── */
/* Pure display: parent owns band/feeling state.
   band: 'good' | 'mid' | 'bad' | null
   feeling: string | null
   onBand(band): called when a band word is tapped
   onFeeling(feeling): called when a feeling word is tapped
   editing / onToggleEdit: reopen a finished answer to revise it
   inlineFeeling: the feeling as a parenthetical on the band's own line, with
     nothing under it (phone: the chevron is how an answer is reopened)
   trailing: a control set to the right of the prompt or answer line */
const BAND_WORDS = ['good', 'mid', 'bad']
export function CheckIn({ band, feeling, onBand, onFeeling, editing, onToggleEdit, inlineFeeling = false, trailing }) {
  const slot = currentSlot()
  const greeting = SLOT_GREETING[slot] || 'day'
  // retapping the answer you already gave changes nothing
  const pickBand = b => { if (b !== band || !feeling) onBand?.(b) }

  // Phone: the block changes height as it is answered, and what's below eases
  // with it rather than jumping.
  const boxRef = useRef(null)
  const lastHeight = useRef(null)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || !inlineFeeling) return undefined
    const moving = el.style.height !== ''
    const from = moving ? el.getBoundingClientRect().height : lastHeight.current
    el.style.transition = 'none'
    el.style.height = ''
    const to = el.getBoundingClientRect().height
    lastHeight.current = to
    if (from == null || from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.transition = ''
      el.style.overflow = ''
      return undefined
    }
    el.style.boxSizing = 'border-box'
    el.style.overflow = 'hidden'
    el.style.height = `${from}px`
    void el.offsetHeight
    el.style.transition = 'height 220ms ease'
    el.style.height = `${to}px`
    const clear = () => { el.style.transition = ''; el.style.height = ''; el.style.overflow = ''; el.style.boxSizing = '' }
    const timer = setTimeout(clear, 260)
    return () => clearTimeout(timer)
  }, [band, feeling, editing, inlineFeeling])
  const bandRow = (
    <div className={styles.checkInBands} role="group" aria-label="how are you">
      {BAND_WORDS.map(b => (
        <button
          key={b}
          type="button"
          className={`${styles.checkInWord} ${band === b ? styles.checkInWordActive : ''}`}
          aria-pressed={band === b}
          onClick={() => pickBand(b)}
        >
          {BAND_LABEL[b]}
        </button>
      ))}
    </div>
  )
  if (!band) {
    return (
      <div ref={boxRef} className={styles.checkIn}>
        <div className={styles.checkInHead}>
          <div className={styles.checkInLabel}>HOW ARE YOU THIS {greeting.toUpperCase()}?</div>
          {trailing}
        </div>
        {bandRow}
      </div>
    )
  }
  const bandFeelings = FEELINGS[band] || []
  const answered = !!feeling && !editing
  return (
    <div ref={boxRef} className={styles.checkIn}>
      <div className={styles.checkInHead}>
        <div className={styles.checkInChosen}>
          i&apos;m feeling <em>{BAND_LABEL[band]}.</em>
          {inlineFeeling && feeling && <span className={styles.checkInParen}> ({feeling})</span>}
        </div>
        {trailing}
      </div>
      {editing && bandRow}
      {!answered && (
        <>
          <div className={styles.checkInLabel}>WHAT KIND OF {BAND_LABEL[band].toUpperCase()}?</div>
          <div className={styles.checkInFeelings} role="group" aria-label="what kind">
            {bandFeelings.map(f => (
              <button
                key={f}
                type="button"
                className={`${styles.checkInWord} ${feeling === f ? styles.checkInWordActive : ''}`}
                aria-pressed={feeling === f}
                onClick={() => onFeeling?.(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </>
      )}
      {(editing || (answered && !inlineFeeling)) && (
        <div className={styles.checkInAnswer}>
          {answered && <span className={styles.checkInLabel}>· {feeling}</span>}
          {onToggleEdit && (
            <button type="button" className={styles.checkInChange} aria-expanded={!!editing} onClick={onToggleEdit}>
              {editing ? 'done' : 'change'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── ChapterRow ───────────────────────────────────────────── */
/* numeral: 'i' – 'iv', name, met, total, color = mode text token */
export function ChapterRow({ numeral, name, met, total, color, complete }) {
  return (
    <div className={`${styles.chapterRow} ${complete ? styles.chapterRowDone : ''}`}>
      <span className={styles.chapterNumeral} style={{ color }}>{numeral}.</span>
      <span className={styles.chapterName}>{name}</span>
      <span className={styles.chapterCount}>{met}/{total}{complete ? ' ✓' : ''}</span>
    </div>
  )
}

/* ── PracticeDot ──────────────────────────────────────────── */
/* One practice, as a row. The whole row is the press-and-hold target (a finger
   would hide a 20px dot): useHold paints the gold wash across it, a hold
   completes, a quick tap opens. touch-action stays `manipulation` so a swipe
   starting on the row still scrolls the page; moving past useHold's slop
   cancels the hold. A keyboard or screen-reader click completes at once. */
export function PracticeDot({
  label, meta, ariaLabel, done, x2, inert, expandable, expanded,
  fill = 'var(--loam-nourishment)', ring = 'var(--loam-ink)', onFill = 'var(--loam-paper)',
  onCheck, onOpen,
}) {
  const hold = useHold({ onComplete: onCheck, onTap: onOpen, fill: !inert })
  return (
    <div
      ref={hold.cardRef}
      data-hold-card=""
      data-undo={done ? '1' : undefined}
      className={`${styles.practiceRow} ${inert ? styles.practiceRowInert : ''}`}
    >
      <span ref={hold.fillRef} className={styles.practiceWash} aria-hidden="true" />
      <button
        type="button"
        className={styles.practiceHit}
        aria-label={ariaLabel}
        aria-pressed={!!done}
        aria-expanded={expandable ? !!expanded : undefined}
        {...hold.press}
      >
        <span
          className={styles.practiceDot}
          style={done ? { background: fill, borderColor: fill, color: onFill } : { borderColor: ring }}
        >{x2 ? '×2' : ''}</span>
        <span className={styles.practiceLabel}>
          {label}
          {expandable && <span className={styles.practiceCaret} aria-hidden="true">{expanded ? ' ▴' : ' ▾'}</span>}
        </span>
        {meta && <span className={styles.practiceMeta}>{meta}</span>}
      </button>
    </div>
  )
}

/* ── IndexRow ─────────────────────────────────────────────── */
export function IndexRow({ name, value, onClick }) {
  return (
    <button
      type="button"
      className={styles.indexRow}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className={styles.indexRowName}>{name}</span>
      <span className={styles.indexRowLeader} aria-hidden="true" />
      <span className={styles.indexRowValue}>{value}</span>
    </button>
  )
}

/* ── EntryRow ─────────────────────────────────────────────── */
/* Slot and time, then the entry (a room's own lines set off by EntryText), then
   its tags. Delete is two-step: the parent owns pendingDelete. */
export function EntryRow({
  slot, time, text, shape, tags = [], onRevisit, revisited, onFavorite, favorite,
  metaDot, truncate = true, collapsible = false, extra,
  pendingDelete = false, onDelete,
  quotedText, quotedDate,
  imageUrl, onImageClick,
  roomTag,
  moodBand, moodFeeling, moodPipColor,
  expanded = false, onToggleExpand,
}) {
  const body = text || ''
  const long = truncate && body.length > JOURNAL_TRUNCATE
  const isTrunc = long && !expanded
  const display = isTrunc ? body.slice(0, JOURNAL_TRUNCATE).trimEnd() + '…' : body
  const words = [...tags, roomTag].filter(Boolean)
  return (
    <div className={styles.entryRow}>
      <div className={styles.entryRowMeta}>
        {metaDot && <span className={styles.entryRowMoodDot} style={{ background: metaDot }} />}
        <span className={styles.entryRowSlot}>{slot}</span>
        {time && <span className={styles.entryRowTime}>{time}</span>}
        {onDelete && (
          <button
            type="button"
            className={`${styles.entryRowDeleteBtn}${pendingDelete ? ` ${styles.entryRowDeleteBtnPending}` : ''}`}
            onMouseDown={e => e.stopPropagation()}
            onClick={onDelete}
            aria-label={pendingDelete ? 'confirm delete' : 'delete entry'}
          >{pendingDelete ? 'delete?' : '×'}</button>
        )}
      </div>
      {quotedText && (
        <JournalQuote
          text={quotedText}
          dateLabel={quotedDate}
          blockClass={styles.entryRowQuote}
          dateClass={styles.entryRowQuoteDate}
          textClass={styles.entryRowQuoteText}
          readMoreClass={styles.entryRowReadMore}
        />
      )}
      {collapsible && long ? (
        <button type="button" className={styles.entryRowTextBtn} onClick={onToggleExpand} aria-expanded={expanded}>
          <EntryText text={display} shape={shape} />
        </button>
      ) : (
        <div className={styles.entryRowText}><EntryText text={display} shape={shape} /></div>
      )}
      {isTrunc && (
        <button type="button" className={styles.entryRowReadMore} onClick={onToggleExpand}>read more</button>
      )}
      {imageUrl && (
        <button type="button" className={styles.entryRowImageBtn} onClick={() => onImageClick?.(imageUrl)} aria-label="view photo">
          <SignedImg src={imageUrl} className={styles.entryRowImage} alt="" />
        </button>
      )}
      {(moodBand || words.length > 0) && (
        <div className={styles.entryRowTags}>
          {moodBand && (
            <span className={styles.entryRowMoodChip}>
              <span className={styles.entryRowMoodDot} style={{ background: moodPipColor }} />
              {moodFeeling || moodBand}
            </span>
          )}
          {words.map((w, i) => <span key={w}>{(moodBand || i > 0) ? ' · ' : ''}{w}</span>)}
        </div>
      )}
      {extra}
      {(onRevisit || onFavorite) && (
        <div className={styles.entryRowActions}>
          {onRevisit && (
            <button type="button" className={`${styles.entryRowAction} ${revisited ? styles.entryRowActionActive : ''}`} aria-pressed={!!revisited} onClick={onRevisit}>↩ revisit</button>
          )}
          {onFavorite && (
            <button type="button" className={`${styles.entryRowAction} ${favorite ? styles.entryRowActionActive : ''}`} aria-pressed={!!favorite} aria-label={favorite ? 'remove from favorites' : 'add to favorites'} onClick={onFavorite}>{favorite ? '♥' : '♡'}</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── WriteBlock ───────────────────────────────────────────── */
/* resting: prompt + textarea + a link to the writing rooms
   active (text present or textarea focused): stamp + textarea + chips + footer
   The greeting and the stamp share one grid cell, so the writing area never
   moves when typing starts. What is under it takes its natural height.
   draft persistence is owned by the parent; just value/onChange here */
export function WriteBlock({
  text = '',
  onTextChange,
  onKeyDown,
  onSubmit,
  onClear,
  saving = false,
  error,
  stamp,
  tags,
  attach,
  keepOpen = false,
  entryCount = 0,
  onRooms,
}) {
  const [focused, setFocused] = useState(false)
  const active = focused || text.length > 0 || keepOpen
  // a press on the tags or the footer must not blur the page closed under the finger
  const holdFocus = e => e.preventDefault()
  return (
    <div className={styles.writeBlock} data-tour="journal">
      <div className={styles.writeBlockHeader}>
        <span className={styles.writeBlockLabel}>WRITE</span>
        {entryCount > 0 && (
          <span className={styles.writeBlockCount}>TODAY · {entryCount} {entryCount === 1 ? 'ENTRY' : 'ENTRIES'} SO FAR</span>
        )}
      </div>
      <div className={styles.writeStack}>
        <div className={`${styles.writeBlockStamp} ${active ? '' : styles.writeStackOff}`}>{stamp}</div>
        <div className={`${styles.writeBlockGreeting} ${active ? styles.writeStackOff : ''}`}>what's on <em>your mind?</em></div>
      </div>
      <textarea
        className={styles.writeBlockTextarea}
        placeholder="start writing…"
        value={text}
        onChange={e => onTextChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={4}
        maxLength={10000}
      />
      {error && <div className={styles.writeBlockError}>{error}</div>}
      {active ? (
        <div onMouseDown={holdFocus}>
          <div className={styles.writeBlockTags}>{tags}</div>
          <div className={styles.writeBlockFooter}>
            <button type="button" className={styles.writeBlockLink} onClick={onRooms}>rooms →</button>
            {attach}
            <button type="button" className={`${styles.writeBlockLink} ${styles.writeBlockClear}`} onClick={onClear}>clear</button>
            <button
              type="button"
              className={styles.writeBlockSubmit}
              onClick={onSubmit}
              disabled={!text.trim() || saving}
            >{saving ? '…' : 'add'}</button>
          </div>
        </div>
      ) : (
        <div className={styles.writeBlockRooms}>
          <button type="button" className={`${styles.writeBlockLink} ${styles.writeRoomsLink}`} onClick={onRooms}>writing rooms →</button>
        </div>
      )}
    </div>
  )
}

/* ── TabBar ───────────────────────────────────────────────── */
const TABS = [
  { to: '/today',  label: 'today' },
  { to: '/data',   label: 'data' },
  { to: '/log',    label: 'drafts' },
]

export function LoamTabBar() {
  return (
    <nav className={styles.tabBar} aria-label="Primary" data-tour="nav">
      {TABS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
        >
          <span className={styles.tabLabel}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
