/* Loam 2b "Cover" primitives — Stage 1
   All visual components for the redesign. Screens rebuild on top of these.
   Parity note: PracticeDot wraps lib/useHold.js unchanged (hapticTick line 102,
   hapticSuccess line 70 stay at their existing call sites). */
import { NavLink } from 'react-router-dom'
import { useHold } from '../../lib/useHold'
import { FEELINGS, BAND_LABEL } from '../../lib/frequency'
import { currentSlot, SLOT_GREETING } from '../../lib/slots'
import styles from './index.module.css'

/* ── Dateline ─────────────────────────────────────────────── */
/* WED · OCT 14 · NO. 290  |  ProfileBadge
   onboardedAt: ISO date string from state; badge child passed as prop */
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function Dateline({ onboardedAt, children, docked }) {
  const now = new Date()
  const dow = DAY_ABBR[now.getDay()]
  const mon = MON_ABBR[now.getMonth()]
  const day = now.getDate()
  const noNum = onboardedAt
    ? String(Math.max(1, Math.floor((Date.now() - new Date(onboardedAt).getTime()) / 86400000) + 1)).padStart(3, '0')
    : '001'
  return (
    <div className={`${styles.dateline} ${docked ? styles.datelineDocked : ''}`}>
      <span className={styles.datelineText}>{dow} · {mon} {day} · NO. {noNum}</span>
      {children}
    </div>
  )
}

/* ── ProfileBadge ─────────────────────────────────────────── */
export function ProfileBadge({ initial, onClick, docked }) {
  const size = docked ? 26 : 30
  return (
    <button
      type="button"
      className={styles.badge}
      style={{ width: size, height: size }}
      aria-label="profile"
      onClick={onClick}
    >
      {(initial || '?').toUpperCase()}
    </button>
  )
}

/* ── ProgressRule ─────────────────────────────────────────── */
export function ProgressRule({ pct = 0 }) {
  const p = Math.round(Math.max(0, Math.min(100, pct)))
  return (
    <div
      className={styles.progressRule}
      role="img"
      aria-label={`${p}% complete today`}
      data-tour="space"
    >
      <div className={styles.progressTrack}>
        {p > 0 && <div className={styles.progressFill} style={{ width: `${p}%` }} />}
        <div className={styles.progressDots} style={{ left: `${p}%`, right: 0 }} />
      </div>
      <span className={styles.progressPct}>{p}%</span>
    </div>
  )
}

/* ── PullQuote ────────────────────────────────────────────── */
export function PullQuote({ text, folio, noTopRule }) {
  return (
    <div className={`${styles.pullQuote} ${noTopRule ? styles.pullQuoteNoRule : ''}`}>
      <span className={styles.pullQuoteMark}>&ldquo;</span>
      <div className={styles.pullQuoteBody}>
        <p className={styles.pullQuoteText}>{text}</p>
        {folio && <span className={styles.pullQuoteFolio}>{folio}</span>}
      </div>
    </div>
  )
}

/* ── CheckIn ──────────────────────────────────────────────── */
/* Pure display: parent owns band/feeling state.
   band: 'good' | 'mid' | 'bad' | null
   feeling: string | null
   onBand(band): called when a band word is tapped
   onFeeling(feeling): called when a feeling word is tapped */
const BAND_WORDS = ['good', 'mid', 'bad']
export function CheckIn({ band, feeling, onBand, onFeeling }) {
  const slot = currentSlot()
  const greeting = SLOT_GREETING[slot] || 'day'
  if (!band) {
    return (
      <div className={styles.checkIn}>
        <div className={styles.checkInLabel}>HOW ARE YOU THIS {greeting.toUpperCase()}?</div>
        <div className={styles.checkInBands} role="group" aria-label="how are you">
          {BAND_WORDS.map(b => (
            <button
              key={b}
              type="button"
              className={`${styles.checkInWord} ${band === b ? styles.checkInWordActive : ''}`}
              aria-pressed={band === b}
              onClick={() => onBand?.(b)}
            >
              {BAND_LABEL[b]}
            </button>
          ))}
        </div>
      </div>
    )
  }
  const bandFeelings = FEELINGS[band] || []
  return (
    <div className={styles.checkIn}>
      <div className={styles.checkInChosen}>
        i&apos;m feeling <em>{BAND_LABEL[band]}.</em>
      </div>
      {!feeling && (
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
      {feeling && (
        <div className={styles.checkInLabel}>· {feeling}</div>
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
      <span className={styles.chapterName} style={complete ? { color } : undefined}>{name}</span>
      <span className={styles.chapterCount}>{met}/{total}{complete ? ' ✓' : ''}</span>
    </div>
  )
}

/* ── PracticeDot ──────────────────────────────────────────── */
/* count: 0 = unchecked, 1 = done, 2 = ×2
   onCheck: called when hold completes; parent cycles the count
   onOpen: called on quick tap
   color: filled color for this mode */
export function PracticeDot({ count = 0, onCheck, onOpen, color = 'var(--loam-nourishment)' }) {
  const hold = useHold({ onComplete: onCheck, onTap: onOpen })
  const done = count > 0
  return (
    <div
      ref={hold.cardRef}
      className={`${styles.practiceDot} ${done ? styles.practiceDotDone : ''}`}
      style={done ? { background: color, borderColor: color } : undefined}
      data-hold-card
      {...hold.press}
    >
      <span ref={hold.fillRef} className={styles.practiceDotFill} />
      {count === 2 && <span className={styles.practiceDotX2}>×2</span>}
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
export function EntryRow({ dateLabel, text, tags = [], onRevisit, onFavorite, favorite }) {
  return (
    <div className={styles.entryRow}>
      <div className={styles.entryRowDate}>{dateLabel}</div>
      <p className={styles.entryRowText}>{text}</p>
      {tags.length > 0 && (
        <div className={styles.entryRowTags}>{tags.join(' · ')}</div>
      )}
      <div className={styles.entryRowActions}>
        {onRevisit && (
          <button type="button" className={styles.entryRowAction} onClick={onRevisit}>↩ revisit</button>
        )}
        {onFavorite && (
          <button type="button" className={`${styles.entryRowAction} ${favorite ? styles.entryRowActionActive : ''}`} onClick={onFavorite}>♡</button>
        )}
      </div>
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
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
