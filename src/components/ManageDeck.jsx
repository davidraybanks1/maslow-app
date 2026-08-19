import { useState, useEffect, useRef } from 'react'
import {
  loadNoteDeck, loadNoteLibrary,
  addNoteToLibrary, updateNoteDeckCard, deleteNoteDeckCard,
  archiveNoteDeckCard, restoreNoteDeckCard,
  reorderNoteDeck, uploadNoteImage,
} from '../lib/store'
import styles from './ManageDeck.module.css'

const DECK_MAX = 5

function PhotoPill({ image, isUploading, onTap }) {
  return (
    <button className={styles.photoPill} onClick={onTap} disabled={isUploading}>
      {isUploading
        ? 'uploading…'
        : image
          ? <><img src={image} className={styles.photoPillThumb} alt="" />photo added ✓</>
          : '+ add a photo'}
    </button>
  )
}

export default function ManageDeck({ userId, onClose, onDeckChanged }) {
  const [deck, setDeck] = useState([])
  const [library, setLibrary] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [imageDrafts, setImageDrafts] = useState({})
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerDraft, setComposerDraft] = useState('')
  const [composerImage, setComposerImage] = useState(null)
  const [uploadingTarget, setUploadingTarget] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [closing, setClosing] = useState(false)
  const fileRef = useRef(null)
  const pendingTarget = useRef(null)

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

  // ── Reorder ──────────────────────────────────────────────────────────────
  function handleMove(index, dir) {
    const j = index + dir
    if (j < 0 || j >= deck.length) return
    const next = [...deck]
    ;[next[index], next[j]] = [next[j], next[index]]
    setDeck(next)
    onDeckChanged?.(next)
    reorderNoteDeck(next).catch(() => {
      setDeck(deck)
      onDeckChanged?.(deck)
    })
  }

  // ── Archive (✕ on deck card → library) ───────────────────────────────────
  async function handleArchive(id) {
    setErrorMsg(null)
    const card = deck.find(c => c.id === id)
    if (!card) return
    if (editingId === id) setEditingId(null)
    const newDeck = deck.filter(c => c.id !== id)
    const archived = { ...card, archived_at: new Date().toISOString() }
    setDeck(newDeck)
    setLibrary(prev => [archived, ...prev])
    onDeckChanged?.(newDeck)
    const { error } = await archiveNoteDeckCard(id)
    if (error) {
      setDeck(deck)
      setLibrary(prev => prev.filter(c => c.id !== id))
      onDeckChanged?.(deck)
      setErrorMsg('failed to remove — try again')
    }
  }

  // ── Restore (+ add to deck) ───────────────────────────────────────────────
  async function handleRestore(id) {
    setErrorMsg(null)
    const card = library.find(c => c.id === id)
    if (!card) return
    const newLibrary = library.filter(c => c.id !== id)
    const newDeck = [...deck, { ...card, archived_at: null }]
    setDeck(newDeck)
    setLibrary(newLibrary)
    onDeckChanged?.(newDeck)
    const { error } = await restoreNoteDeckCard(userId, id)
    if (error) {
      setDeck(deck)
      setLibrary(library)
      onDeckChanged?.(deck)
      setErrorMsg(
        error.message?.toLowerCase().includes('full')
          ? 'deck is full — remove a card first'
          : 'failed to add — try again'
      )
    }
  }

  // ── Edit open/close ────────────────────────────────────────────────────────
  function handleEditOpen(id, text, imageUrl) {
    if (editingId === id) {
      setEditingId(null)
      setDeleteConfirmId(null)
    } else {
      setEditingId(id)
      setDrafts(prev => ({ ...prev, [id]: text }))
      setImageDrafts(prev => ({ ...prev, [id]: imageUrl || null }))
      setDeleteConfirmId(null)
      setComposerOpen(false)
    }
  }

  function handleCancelEdit() {
    setEditingId(null)
    setDeleteConfirmId(null)
  }

  // ── Save edit ──────────────────────────────────────────────────────────────
  async function handleSaveEdit(id, isDeck) {
    const text = (drafts[id] || '').trim()
    if (!text) return
    const all = isDeck ? deck : library
    const card = all.find(c => c.id === id)
    const imageUrl = imageDrafts[id] !== undefined ? imageDrafts[id] : (card?.image_url || null)
    const { error } = await updateNoteDeckCard(id, { text, imageUrl, userId, previousText: card?.text })
    if (error) { setErrorMsg('failed to save — try again'); return }
    const updater = c => c.id === id ? { ...c, text, image_url: imageUrl } : c
    if (isDeck) {
      const updated = deck.map(updater)
      setDeck(updated)
      onDeckChanged?.(updated)
    } else {
      setLibrary(prev => prev.map(updater))
    }
    setEditingId(null)
  }

  // ── Delete (library only, two-step) ──────────────────────────────────────
  function handleDeleteTap(id) {
    if (deleteConfirmId === id) {
      const card = library.find(c => c.id === id)
      if (!card) return
      setLibrary(prev => prev.filter(c => c.id !== id))
      setEditingId(null)
      setDeleteConfirmId(null)
      deleteNoteDeckCard(id, userId, card.text, card.image_url)
    } else {
      setDeleteConfirmId(id)
    }
  }

  // ── Composer ───────────────────────────────────────────────────────────────
  function handleComposerToggle() {
    if (composerOpen) {
      setComposerOpen(false)
      setComposerDraft('')
      setComposerImage(null)
    } else {
      setComposerOpen(true)
      setComposerDraft('')
      setComposerImage(null)
      setEditingId(null)
      setDeleteConfirmId(null)
    }
  }

  async function handleSaveNew() {
    const text = composerDraft.trim()
    if (!text) return
    const { data, error } = await addNoteToLibrary(userId, { text, imageUrl: composerImage })
    if (error) { setErrorMsg('failed to save — try again'); return }
    setLibrary(prev => [data, ...prev])
    setComposerOpen(false)
    setComposerDraft('')
    setComposerImage(null)
  }

  // ── Photo ──────────────────────────────────────────────────────────────────
  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const target = pendingTarget.current
    setUploadingTarget(target)
    const { url } = await uploadNoteImage(userId, file)
    if (url) {
      if (target === 'composer') setComposerImage(url)
      else setImageDrafts(prev => ({ ...prev, [target]: url }))
    }
    setUploadingTarget(null)
    e.target.value = ''
  }

  function handlePhotoTap(target) {
    if (target === 'composer') {
      if (composerImage) { setComposerImage(null); return }
    } else {
      if (imageDrafts[target]) { setImageDrafts(prev => ({ ...prev, [target]: null })); return }
    }
    pendingTarget.current = target
    fileRef.current?.click()
  }

  const deckFull = deck.length >= DECK_MAX
  const slotsLeft = DECK_MAX - deck.length

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      {/* ── App bar ── */}
      <div className={styles.header}>
        <span className={styles.title}>notes to self.</span>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      {/* ── Scrollable body ── */}
      <div className={styles.body}>
        {errorMsg && (
          <div className={styles.errorBanner} onClick={() => setErrorMsg(null)}>{errorMsg}</div>
        )}

        {/* ── ON YOUR TODAY SCREEN ── */}
        <div className={styles.sectionRow}>
          <span className={styles.sectionLabel}>ON YOUR TODAY SCREEN</span>
          <span className={
            deck.length > DECK_MAX ? styles.metaDestructive
            : deck.length === DECK_MAX ? styles.metaMuted
            : styles.metaAmber
          }>{deck.length} of 5</span>
        </div>
        <div className={styles.sectionSubhead}>these are what greet you on the today screen, in this order.</div>

        <div className={styles.deckList}>
          {deck.map((card, i) => {
            const isEditing = editingId === card.id
            const editText = drafts[card.id] ?? card.text
            const editImage = imageDrafts[card.id] !== undefined ? imageDrafts[card.id] : (card.image_url || null)
            return (
              <div key={card.id} className={styles.deckCard}>
                <div className={styles.cardRow}>
                  <div className={styles.reorderCol}>
                    <button
                      className={styles.reorderBtn}
                      style={{ color: i === 0 ? 'rgba(0,0,0,.15)' : 'rgba(0,0,0,.45)' }}
                      onClick={() => handleMove(i, -1)}
                      disabled={i === 0}
                      aria-label="move up"
                    >▲</button>
                    <button
                      className={styles.reorderBtn}
                      style={{ color: i === deck.length - 1 ? 'rgba(0,0,0,.15)' : 'rgba(0,0,0,.45)' }}
                      onClick={() => handleMove(i, 1)}
                      disabled={i === deck.length - 1}
                      aria-label="move down"
                    >▼</button>
                  </div>
                  {card.image_url && (
                    <img src={card.image_url} className={styles.thumb44} alt="" />
                  )}
                  <p className={styles.noteTextDeck}>{card.text}</p>
                  <button className={styles.iconBtn} onClick={() => handleEditOpen(card.id, card.text, card.image_url)} aria-label="edit">✎</button>
                  <button className={styles.iconBtn} onClick={() => handleArchive(card.id)} aria-label="remove">✕</button>
                </div>
                {isEditing && (
                  <div className={styles.editPanel}>
                    <textarea
                      className={styles.noteTextarea}
                      value={editText}
                      onChange={e => setDrafts(prev => ({ ...prev, [card.id]: e.target.value }))}
                      autoFocus
                    />
                    <div className={styles.photoRow}>
                      <PhotoPill
                        image={editImage}
                        isUploading={uploadingTarget === card.id}
                        onTap={() => handlePhotoTap(card.id)}
                      />
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.savePrimaryBtn} onClick={() => handleSaveEdit(card.id, true)}>save</button>
                      <button className={styles.cancelBtn} onClick={handleCancelEdit}>cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Slots open / over-cap message */}
          {deck.length < DECK_MAX ? (
            <div className={styles.slotsHint}>
              {slotsLeft} more slot{slotsLeft === 1 ? '' : 's'} open — add from your library below
            </div>
          ) : deck.length > DECK_MAX ? (
            <div className={styles.slotsHint}>
              one over — remove a card to get back to five.
            </div>
          ) : null}
        </div>

        {/* ── YOUR LIBRARY ── */}
        <div className={styles.librarySectionRow}>
          <span className={styles.sectionLabel}>YOUR LIBRARY</span>
          <span className={styles.metaMuted}>{library.length} {library.length === 1 ? 'note' : 'notes'}</span>
        </div>

        {deckFull && (
          <div className={styles.deckFullNote}>
            your deck is full — remove a card above, or add this one and something will need to make room.
          </div>
        )}

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
              <PhotoPill
                image={composerImage}
                isUploading={uploadingTarget === 'composer'}
                onTap={() => handlePhotoTap('composer')}
              />
              <span className={styles.spacer} />
              <button className={styles.cancelBtn} onClick={handleComposerToggle}>cancel</button>
              <button
                className={`${styles.savePrimaryBtn} ${!composerDraft.trim() ? styles.savePrimaryBtnDim : ''}`}
                onClick={handleSaveNew}
                disabled={!composerDraft.trim()}
              >save to library</button>
            </div>
          </div>
        )}

        <div className={styles.libraryList}>
          {library.map(card => {
            const isEditing = editingId === card.id
            const isConfirming = deleteConfirmId === card.id
            const editText = drafts[card.id] ?? card.text
            const editImage = imageDrafts[card.id] !== undefined ? imageDrafts[card.id] : (card.image_url || null)
            const canAdd = !deckFull

            return (
              <div key={card.id} className={styles.libCard}>
                <div className={styles.cardRow}>
                  {card.image_url && (
                    <img src={card.image_url} className={styles.thumb40} alt="" />
                  )}
                  <p className={styles.noteTextLib}>{card.text}</p>
                  <button className={styles.iconBtnLib} onClick={() => handleEditOpen(card.id, card.text, card.image_url)} aria-label="edit">✎</button>
                  <button
                    className={canAdd ? styles.addPillRoom : styles.addPillFull}
                    onClick={canAdd ? () => handleRestore(card.id) : undefined}
                    disabled={!canAdd}
                  >{canAdd ? '+ add to deck' : 'deck full'}</button>
                </div>
                {isEditing && (
                  <div className={styles.editPanel}>
                    <textarea
                      className={styles.noteTextarea}
                      value={editText}
                      onChange={e => setDrafts(prev => ({ ...prev, [card.id]: e.target.value }))}
                      autoFocus
                    />
                    <div className={styles.photoRow}>
                      <PhotoPill
                        image={editImage}
                        isUploading={uploadingTarget === card.id}
                        onTap={() => handlePhotoTap(card.id)}
                      />
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.savePrimaryBtn} onClick={() => handleSaveEdit(card.id, false)}>save</button>
                      <button className={styles.cancelBtn} onClick={handleCancelEdit}>cancel</button>
                      <button
                        className={isConfirming ? styles.deleteBtnConfirm : styles.deleteBtn}
                        onClick={() => handleDeleteTap(card.id)}
                      >{isConfirming ? 'confirm delete' : 'delete'}</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFilePick} />
    </div>
  )
}
