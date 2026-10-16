import { useState, useEffect } from 'react'
import {
  loadNoteDeck, loadNoteLibrary,
  addNoteToLibrary, updateNoteDeckCard, deleteNoteDeckCard,
  archiveNoteDeckCard, restoreNoteDeckCard,
  reorderNoteDeck,
} from '../lib/store'
import Sheet from './Sheet'
import styles from './ManageDeck.module.css'

// Notes to self. Same shape as Practices and Needs: a few short sections, and a
// tap on any note opens one sheet with everything for it. Today shows 3 to 5.
const MIN_DECK = 3
const MAX_DECK = 5

export default function ManageDeck({ userId, onClose, onDeckChanged }) {
  const [deck, setDeck] = useState([])
  const [library, setLibrary] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [sheet, setSheet] = useState(null)        // { id } to edit, { isNew: true } to write
  const [draft, setDraft] = useState('')
  const [wantOn, setWantOn] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    Promise.all([loadNoteDeck(userId), loadNoteLibrary(userId)]).then(([d, l]) => {
      setDeck(d)
      setLibrary(l)
      setLoaded(true)
    })
  }, [userId])

  function handleClose() {
    setClosing(true)
    setTimeout(() => onClose(), 200)
  }

  const card = sheet?.id ? [...deck, ...library].find(c => c.id === sheet.id) : null
  const cardOn = !!card && card.archived_at === null
  const deckIndex = card ? deck.findIndex(c => c.id === card.id) : -1

  function openNew() {
    setDraft(''); setWantOn(deck.length < MAX_DECK); setConfirmDelete(false); setSheet({ isNew: true })
  }
  function openCard(c) {
    setDraft(c.text); setWantOn(c.archived_at === null); setConfirmDelete(false); setSheet({ id: c.id })
  }
  function closeSheet() { setSheet(null); setConfirmDelete(false) }

  // ── Deck membership ────────────────────────────────────────────────────────
  async function deactivate(c) {
    const prevDeck = deck, prevLib = library
    const nd = deck.filter(x => x.id !== c.id)
    setDeck(nd)
    setLibrary([{ ...c, archived_at: new Date().toISOString() }, ...library])
    onDeckChanged?.(nd)
    const { error } = await archiveNoteDeckCard(c.id)
    if (error) {
      setDeck(prevDeck); setLibrary(prevLib); onDeckChanged?.(prevDeck)
      setErrorMsg(error.message?.toLowerCase().includes('at least three')
        ? `today keeps at least ${MIN_DECK} notes. write another first.`
        : "couldn't take it off today. try again.")
    }
  }

  async function activate(c, deckNow = deck, libNow = library) {
    const nd = [...deckNow, { ...c, archived_at: null }]
    setDeck(nd)
    setLibrary(libNow.filter(x => x.id !== c.id))
    onDeckChanged?.(nd)
    const { error } = await restoreNoteDeckCard(userId, c.id)
    if (error) {
      setDeck(deckNow); setLibrary(libNow); onDeckChanged?.(deckNow)
      setErrorMsg(deckNow.length >= MAX_DECK ? `today holds ${MAX_DECK} notes at most.` : "couldn't put it on today. try again.")
    }
  }

  function move(dir) {
    const j = deckIndex + dir
    if (j < 0 || j >= deck.length) return
    const next = [...deck]
    ;[next[deckIndex], next[j]] = [next[j], next[deckIndex]]
    const prev = deck
    setDeck(next)
    onDeckChanged?.(next)
    reorderNoteDeck(next).catch(() => { setDeck(prev); onDeckChanged?.(prev) })
  }

  // ── Save (new or edited) ───────────────────────────────────────────────────
  async function save() {
    const text = draft.trim()
    if (!text) return
    if (sheet.isNew) {
      const { data, error } = await addNoteToLibrary(userId, { text, imageUrl: null })
      if (error) { setErrorMsg("couldn't save. try again."); return }
      const nl = [data, ...library]
      closeSheet()
      if (wantOn && deck.length < MAX_DECK) await activate(data, deck, nl)
      else setLibrary(nl)
      return
    }
    if (!card) return
    const imageUrl = card.image_url || null
    if (text !== card.text) {
      const { error } = await updateNoteDeckCard(card.id, { text, imageUrl, userId, previousText: card.text })
      if (error) { setErrorMsg("couldn't save. try again."); return }
    }
    const updated = { ...card, text, image_url: imageUrl }
    const nd = cardOn ? deck.map(c => c.id === card.id ? updated : c) : deck
    const nl = cardOn ? library : library.map(c => c.id === card.id ? updated : c)
    closeSheet()
    if (cardOn) { setDeck(nd); onDeckChanged?.(nd) } else setLibrary(nl)
    if (wantOn !== cardOn) {
      if (wantOn) await activate(updated, nd, nl)
      else await deactivate(updated)
    }
  }

  async function remove() {
    if (!card) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    const prevDeck = deck, prevLib = library, wasOn = cardOn
    if (wasOn) { const nd = deck.filter(c => c.id !== card.id); setDeck(nd); onDeckChanged?.(nd) }
    else setLibrary(library.filter(c => c.id !== card.id))
    closeSheet()
    const { error } = await deleteNoteDeckCard(card.id, userId, card.text, card.image_url)
    if (error) {
      setDeck(prevDeck); setLibrary(prevLib)
      if (wasOn) onDeckChanged?.(prevDeck)
      setErrorMsg(error.message?.toLowerCase().includes('at least three')
        ? `today keeps at least ${MIN_DECK} notes. write another first.`
        : "couldn't delete. try again.")
    }
  }

  function row(c, n) {
    return (
      <button
        key={c.id}
        type="button"
        className={`${styles.row} ${n ? '' : styles.rowOff}`}
        aria-label={`edit note: ${c.text}`}
        aria-haspopup="dialog"
        onClick={() => openCard(c)}
      >
        {n != null && <span className={styles.badge}>{n}</span>}
        {c.image_url && <img src={c.image_url} className={styles.thumb} alt="" />}
        <span className={styles.rowText}>{c.text}</span>
        <span className={styles.chev} aria-hidden="true" />
      </button>
    )
  }

  // The switch is locked at the ends: today never drops under 3 or over 5.
  const lockedOn = cardOn && deck.length <= MIN_DECK
  const lockedOff = !cardOn && deck.length >= MAX_DECK
  const switchLocked = sheet?.isNew ? deck.length >= MAX_DECK : (lockedOn || lockedOff)
  const switchHint = sheet?.isNew
    ? (deck.length >= MAX_DECK ? `today holds ${MAX_DECK} at most. saved for later.` : '')
    : lockedOn ? `today keeps at least ${MIN_DECK}.` : lockedOff ? `today holds ${MAX_DECK} at most.` : ''
  const on = switchLocked ? (sheet?.isNew ? false : cardOn) : wantOn

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>Notes to self</h1>
          <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="close notes to self">✕</button>
        </div>

        <div className={styles.body}>
          {errorMsg && <div className={styles.errorBanner} role="alert" onClick={() => setErrorMsg(null)}>{errorMsg}</div>}

          <section className={styles.section} aria-labelledby="add-note-head">
            <h2 id="add-note-head" className={styles.sectionHead}>Add a note</h2>
            <button type="button" className={styles.addRow} onClick={openNew}>+ write a note</button>
          </section>

          <section className={styles.section} aria-labelledby="on-today-head">
            <div className={styles.sectionHeadRow}>
              <h2 id="on-today-head" className={styles.sectionHead}>On Today</h2>
              <span className={styles.count}>{deck.length}/{MAX_DECK}</span>
            </div>
            <div className={styles.list}>
              {deck.map((c, i) => row(c, i + 1))}
              {loaded && deck.length === 0 && <p className={styles.empty}>nothing yet.</p>}
            </div>
          </section>

          {library.length > 0 && (
            <section className={styles.section} aria-labelledby="saved-head">
              <h2 id="saved-head" className={styles.sectionHead}>Saved</h2>
              <div className={styles.list}>{library.map(c => row(c, null))}</div>
            </section>
          )}
        </div>
      </div>

      {sheet && (sheet.isNew || card) && (
        <Sheet label={sheet.isNew ? 'write a note' : 'edit note'} onClose={closeSheet}>
          <h2 className={styles.sheetTitle}>{sheet.isNew ? 'New note' : 'Edit note'}</h2>
          <label htmlFor="note-text" className={styles.srOnly}>note</label>
          <textarea
            id="note-text"
            className={styles.textarea}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="a line to remind yourself of…"
            maxLength={500}
            autoFocus={!!sheet.isNew}
          />

          <div className={styles.switchRow}>
            <span className={styles.switchLabel}>show on Today</span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label="show on today"
              disabled={switchLocked}
              className={`${styles.switch} ${on ? styles.switchOn : ''}`}
              onClick={() => setWantOn(!wantOn)}
            ><span className={styles.knob} /></button>
          </div>
          {switchHint && <p className={styles.hint}>{switchHint}</p>}

          {cardOn && deck.length > 1 && (
            <div className={styles.moveRow}>
              <button type="button" className={styles.pillBtn} disabled={deckIndex === 0} onClick={() => move(-1)}>earlier</button>
              <button type="button" className={styles.pillBtn} disabled={deckIndex === deck.length - 1} onClick={() => move(1)}>later</button>
            </div>
          )}

          <button type="button" className={styles.primaryBtn} disabled={!draft.trim()} onClick={save}>
            Save
          </button>
          {card && (
            <button
              type="button"
              className={`${styles.ghostBtn} ${confirmDelete ? styles.ghostBtnArmed : ''}`}
              disabled={lockedOn}
              onClick={remove}
            >{confirmDelete ? 'tap again to delete' : 'delete'}</button>
          )}
          <button type="button" className={styles.ghostBtn} onClick={closeSheet}>not now</button>
        </Sheet>
      )}
    </div>
  )
}
