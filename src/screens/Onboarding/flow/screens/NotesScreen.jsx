import { useEffect, useRef, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import { REDUCED_MOTION } from '../Typed'
import { splitSentences } from '../useTimeline'
import { NOTE_LIBRARY, NOTES_NEEDED, NOTES_MAX } from '../data'

const STEP = 316 + 12 // card width + gap

const BODY = 'These are the phrases, quotes, or mantras that center you for the day. You need three to get started.'

// The last step before the app: pick notes from ours (a scrolling carousel of
// the app's own note cards) and/or write your own. Three get you in; the deck
// holds five.
export default function NotesScreen({ notes, onChange, onDone }) {
  const { picked, own } = notes
  const total = picked.length + own.length
  const atMax = total >= NOTES_MAX
  const [idx, setIdx] = useState(0)
  const [draft, setDraft] = useState('')
  const car = useRef(null)

  useEffect(() => {
    // returning from the account step keeps the carousel where it was
    if (car.current) car.current.scrollLeft = idx * STEP
  }, [])

  function onScroll() {
    const i = Math.max(0, Math.min(NOTE_LIBRARY.length - 1, Math.round(car.current.scrollLeft / STEP)))
    setIdx(i)
  }
  function scrollToCard(n) {
    const i = Math.max(0, Math.min(NOTE_LIBRARY.length - 1, n))
    car.current.scrollTo({ left: i * STEP, behavior: REDUCED_MOTION ? 'auto' : 'smooth' })
  }

  function togglePick(text) {
    const on = picked.indexOf(text) !== -1
    if (on) onChange({ picked: picked.filter(t => t !== text), own })
    else if (!atMax) onChange({ picked: [...picked, text], own })
  }

  function addOwn() {
    const val = draft.trim()
    if (!val || atMax) return
    onChange({ picked, own: [...own, val] })
    setDraft('')
  }

  function removeOwn(i) {
    onChange({ picked, own: own.filter((_, j) => j !== i) })
  }

  const status = total > NOTES_MAX - 1 && atMax
    ? `${total} picked · max`
    : total > NOTES_NEEDED ? `${total} picked` : `${total} of ${NOTES_NEEDED} picked`

  return (
    <ScreenLayout cta={{ label: 'open the app', disabled: total < NOTES_NEEDED, onClick: onDone }}>
      <div className={`${styles.cardStage} ${styles.introStage} ${styles.notesStage}`}>
        <div className={styles.conceptLabel}>Last step</div>
        <div className={styles.conceptTitle} style={{ fontSize: 30 }}>Notes to self</div>
        <div className={styles.hookBody}>
          {splitSentences(BODY).map(s => <span key={s} className={styles.sent}>{s}</span>)}
        </div>
      </div>

      <div className={styles.zones}>
        <div className={styles.notesSectionLabel}>Start with a few of ours</div>
        <div className={styles.noteCarousel} ref={car} onScroll={onScroll}>
          {NOTE_LIBRARY.map(text => {
            const on = picked.indexOf(text) !== -1
            return (
              <div
                key={text}
                className={`${styles.deckCard}${on ? ` ${styles.picked}` : ''}`}
                onClick={() => togglePick(text)}
              >
                <button type="button" className={styles.deckPick} aria-pressed={on} disabled={!on && atMax}>
                  {on ? '✓ using' : '+ use'}
                </button>
                <div className={styles.deckText} data-len={text.length > 150 ? 'long' : text.length > 90 ? 'mid' : undefined}>{text}</div>
              </div>
            )
          })}
        </div>

        <div className={styles.deckMeta}>
          <div className={styles.deckCtrls}>
            <button type="button" className={styles.deckArrow} aria-label="previous note" disabled={idx === 0} onClick={() => scrollToCard(idx - 1)}>{'‹'}</button>
            <span>{idx + 1}/{NOTE_LIBRARY.length}</span>
            <button type="button" className={styles.deckArrow} aria-label="next note" disabled={idx === NOTE_LIBRARY.length - 1} onClick={() => scrollToCard(idx + 1)}>{'›'}</button>
          </div>
          <span>{status}</span>
        </div>

        <div className={`${styles.notesSectionLabel} ${styles.notesSectionLabelSecond}`}>Or write your own</div>
        <div className={styles.noteInputRow}>
          <input
            id="onboarding-own-note"
            type="text"
            className={styles.noteInput}
            placeholder="e.g. take up space."
            value={draft}
            maxLength={200}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOwn() } }}
          />
          <button type="button" className={styles.noteAddBtn} disabled={!draft.trim() || atMax} onClick={addOwn}>add</button>
        </div>

        {own.length > 0 && (
          <div className={styles.ownNotesList}>
            {own.map((text, i) => (
              <div key={`${i}-${text}`} className={styles.ownNoteChip}>
                <span>{text}</span>
                <button type="button" className={styles.ownNoteRemove} aria-label="remove" onClick={() => removeOwn(i)}>{'×'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScreenLayout>
  )
}
