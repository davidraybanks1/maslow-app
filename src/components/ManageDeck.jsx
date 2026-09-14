import { useState, useEffect } from 'react'
import {
  loadNoteDeck, loadNoteLibrary,
  addNoteToLibrary, updateNoteDeckCard, deleteNoteDeckCard,
  archiveNoteDeckCard, restoreNoteDeckCard,
  reorderNoteDeck,
} from '../lib/store'
import styles from './ManageDeck.module.css'

export default function ManageDeck({ userId, onClose, onDeckChanged }) {
  const [deck, setDeck] = useState([])
  const [library, setLibrary] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerDraft, setComposerDraft] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    Promise.all([loadNoteDeck(userId), loadNoteLibrary(userId)]).then(([d, l]) => {
      setDeck(d)
      setLibrary(l)
    })
  }, [userId])

  function handleClose() {
    setClosing(true)
    setTimeout(() => onClose(), 200)
  }

  // ── Reorder within deck ────────────────────────────────────────────────────
  function handleMove(deckIndex, dir) {
    const j = deckIndex + dir
    if (j < 0 || j >= deck.length) return
    const next = [...deck]
    ;[next[deckIndex], next[j]] = [next[j], next[deckIndex]]
    setDeck(next)
    onDeckChanged?.(next)
    reorderNoteDeck(next).catch(() => {
      setDeck(deck)
      onDeckChanged?.(deck)
    })
  }

  // ── Toggle switch (archive ↔ restore) ─────────────────────────────────────
  async function handleToggle(id) {
    const deckCard = deck.find(c => c.id === id)
    if (deckCard) {
      // ON → OFF: archive
      if (editingId === id) setEditingId(null)
      setDeleteConfirmId(null)
      const newDeck = deck.filter(c => c.id !== id)
      const archived = { ...deckCard, archived_at: new Date().toISOString() }
      setDeck(newDeck)
      setLibrary(prev => [archived, ...prev])
      onDeckChanged?.(newDeck)
      const { error } = await archiveNoteDeckCard(id)
      if (error) {
        setDeck(deck)
        setLibrary(prev => prev.filter(c => c.id !== id))
        onDeckChanged?.(deck)
        setErrorMsg(
          error.message?.toLowerCase().includes('at least three')
            ? 'a deck keeps at least three notes — write another before removing this one'
            : 'failed to remove — try again'
        )
      }
    } else {
      // OFF → ON: restore
      const libCard = library.find(c => c.id === id)
      if (!libCard) return
      const newLibrary = library.filter(c => c.id !== id)
      const newDeck = [...deck, { ...libCard, archived_at: null }]
      setDeck(newDeck)
      setLibrary(newLibrary)
      onDeckChanged?.(newDeck)
      const { error } = await restoreNoteDeckCard(userId, id)
      if (error) {
        setDeck(deck)
        setLibrary(library)
        onDeckChanged?.(deck)
        setErrorMsg('failed to add — try again')
      }
    }
  }

  // ── Edit panel open/close ──────────────────────────────────────────────────
  function handleEditOpen(id, text) {

    if (editingId === id) {
      setEditingId(null)
      setDeleteConfirmId(null)
    } else {
      setEditingId(id)
      setDrafts(prev => ({ ...prev, [id]: text }))
      setDeleteConfirmId(null)
      setComposerOpen(false)
    }
  }

  function handleCancelEdit() {

    setEditingId(null)
    setDeleteConfirmId(null)
  }

  // ── Save edit ──────────────────────────────────────────────────────────────
  async function handleSaveEdit(id) {

    const text = (drafts[id] || '').trim()
    if (!text) return
    const card = [...deck, ...library].find(c => c.id === id)
    const imageUrl = card?.image_url || null
    const { error } = await updateNoteDeckCard(id, { text, imageUrl, userId, previousText: card?.text })
    if (error) { setErrorMsg('failed to save — try again'); return }
    const updater = c => c.id === id ? { ...c, text, image_url: imageUrl } : c
    if (deck.find(c => c.id === id)) {
      const updated = deck.map(updater)
      setDeck(updated)
      onDeckChanged?.(updated)
    } else {
      setLibrary(prev => prev.map(updater))
    }
    setEditingId(null)
  }

  // ── Delete (all notes, two-step) ───────────────────────────────────────────
  async function handleDeleteTap(id) {
    if (deleteConfirmId === id) {
      const card = [...deck, ...library].find(c => c.id === id)
      if (!card) return
      const isActive = !!deck.find(c => c.id === id)
      if (isActive) {
        const newDeck = deck.filter(c => c.id !== id)
        setDeck(newDeck)
        onDeckChanged?.(newDeck)
      } else {
        setLibrary(prev => prev.filter(c => c.id !== id))
      }
      setEditingId(null)
      setDeleteConfirmId(null)
      const { error } = await deleteNoteDeckCard(id, userId, card.text, card.image_url)
      if (error && isActive) {
        setDeck(deck)
        onDeckChanged?.(deck)
        setErrorMsg(
          error.message?.toLowerCase().includes('at least three')
            ? 'a deck keeps at least three notes — write another before removing this one'
            : 'failed to delete — try again'
        )
      }
    } else {
      setDeleteConfirmId(id)
    }
  }

  // ── Composer ───────────────────────────────────────────────────────────────
  function handleComposerToggle() {

    if (composerOpen) {
      setComposerOpen(false)
      setComposerDraft('')
    } else {
      setComposerOpen(true)
      setComposerDraft('')
      setEditingId(null)
      setDeleteConfirmId(null)
    }
  }

  async function handleSaveNew() {
    const text = composerDraft.trim()
    if (!text) return
    const { data, error } = await addNoteToLibrary(userId, { text, imageUrl: null })
    if (error) { setErrorMsg('failed to save — try again'); return }
    setLibrary(prev => [data, ...prev])
    setComposerOpen(false)
    setComposerDraft('')
  }

  const allNotes = [...deck, ...library]

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={styles.inner}>
      {/* ── App bar ── */}
      <div className={styles.header}>
        <span className={styles.title}>notes to self.</span>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      {/* ── Subhead (not scrollable) ── */}
      <div className={styles.subhead}>
        the phrases, mantras and quotes that put you in the right headspace. these show on your today screen. a deck keeps at least three.{' '}
        <span>({deck.length})</span>
      </div>

      {/* ── Scrollable body ── */}
      <div className={styles.body}>
        {errorMsg && (
          <div className={styles.errorBanner} onClick={() => setErrorMsg(null)}>{errorMsg}</div>
        )}

        {/* ── Composer opener ── */}
        <button className={styles.newNoteBtn} onClick={handleComposerToggle}>
          <span className={styles.newNotePlus}>+</span>
          <span className={styles.newNoteLabel}>write a new note to self</span>
        </button>

        {composerOpen && (
          <div className={styles.composerBox}>
            <textarea
              className={styles.noteTextarea}
              placeholder="a line to remind yourself of…"
              value={composerDraft}
              onChange={e => setComposerDraft(e.target.value)}
              autoFocus
            />
            <div className={styles.composerActions}>
              <span className={styles.spacer} />
              <button className={styles.cancelBtn} onClick={handleComposerToggle}>cancel</button>
              <button
                className={`${styles.savePrimaryBtn} ${!composerDraft.trim() ? styles.savePrimaryBtnDim : ''}`}
                onClick={handleSaveNew}
                disabled={!composerDraft.trim()}
              >save</button>
            </div>
          </div>
        )}

        {/* ── Unified note list ── */}
        <div className={styles.noteList}>
          {allNotes.map(card => {
            const isOn = card.archived_at === null
            const deckIndex = isOn ? deck.findIndex(c => c.id === card.id) : -1
            const pos = isOn ? deckIndex + 1 : null
            const isEditing = editingId === card.id
            const isConfirming = deleteConfirmId === card.id
            const editText = drafts[card.id] ?? card.text
            // floor: once the deck reaches 3, active cards can't be removed below 3
            const atFloor = isOn && deck.length <= 3

            return (
              <div key={card.id} className={isOn ? styles.noteRowOn : styles.noteRowOff}>
                <div className={styles.cardRow}>
                  {isOn && <span className={styles.badge}>{pos}</span>}
                  {card.image_url && (
                    <img src={card.image_url} className={styles.thumb34} alt="" />
                  )}
                  <p className={isOn ? styles.noteTextOn : styles.noteTextOff}>{card.text}</p>
                  <button
                    className={styles.editPill}
                    onClick={() => handleEditOpen(card.id, card.text)}
                  >edit</button>
                  <button
                    className={`${styles.switch} ${isOn ? styles.switchOn : styles.switchOff}`}
                    onClick={() => !atFloor && handleToggle(card.id)}
                    aria-label={isOn ? 'remove from today' : 'add to today'}
                    disabled={atFloor}
                    title={atFloor ? 'a deck keeps at least three notes' : undefined}
                  >
                    <span className={styles.switchKnob} style={{ left: isOn ? '21px' : '2px' }} />
                  </button>
                </div>

                {atFloor && (
                  <div className={styles.floorNote}>
                    a deck keeps at least three notes.
                  </div>
                )}

                {isEditing && (
                  <div className={styles.editPanel}>
                    {isOn && (
                      <div className={styles.moveRow}>
                        <button
                          className={`${styles.movePill} ${deckIndex === 0 ? styles.movePillDim : ''}`}
                          onClick={() => handleMove(deckIndex, -1)}
                          disabled={deckIndex === 0}
                        >move earlier</button>
                        <button
                          className={`${styles.movePill} ${deckIndex === deck.length - 1 ? styles.movePillDim : ''}`}
                          onClick={() => handleMove(deckIndex, 1)}
                          disabled={deckIndex === deck.length - 1}
                        >move later</button>
                      </div>
                    )}
                    <textarea
                      className={styles.noteTextarea}
                      value={editText}
                      onChange={e => setDrafts(prev => ({ ...prev, [card.id]: e.target.value }))}
                      autoFocus
                    />
                    <div className={styles.editActions}>
                      <button className={styles.savePrimaryBtn} onClick={() => handleSaveEdit(card.id)}>save</button>
                      <button className={styles.cancelBtn} onClick={handleCancelEdit}>cancel</button>
                      <button
                        className={isConfirming ? styles.deleteBtnConfirm : styles.deleteBtn}
                        onClick={() => handleDeleteTap(card.id)}
                        disabled={atFloor}
                        title={atFloor ? 'a deck keeps at least three notes' : undefined}
                      >{isConfirming ? 'confirm' : 'delete'}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </div>
  )
}
