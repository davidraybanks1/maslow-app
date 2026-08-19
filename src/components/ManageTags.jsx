import { useState, useEffect, useRef } from 'react'
import { loadCustomTags, createCustomTag, deleteCustomTag, loadCustomTagUsageCounts } from '../lib/store'
import styles from './ManageTags.module.css'

export default function ManageTags({ userId, onClose }) {
  const [tags, setTags] = useState([])
  const [usageCounts, setUsageCounts] = useState({})
  const [draft, setDraft] = useState('')
  const [dupeError, setDupeError] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    Promise.all([
      loadCustomTags(userId),
      loadCustomTagUsageCounts(userId),
    ]).then(([t, counts]) => {
      setTags(t)
      setUsageCounts(counts)
    })
  }, [userId])

  function handleClose() {
    setClosing(true)
    setTimeout(() => onClose(tags), 200)
  }

  function handleDraftChange(e) {
    setDraft(e.target.value)
    setDupeError(false)
    setSaveError(null)
  }

  async function handleAdd() {
    const trimmed = draft.replace(/\s+/g, ' ').trim()
    if (!trimmed) return
    const isDupe = tags.some(t => t.label.toLowerCase() === trimmed.toLowerCase())
    if (isDupe) { setDupeError(true); return }
    const { data, error } = await createCustomTag(userId, trimmed)
    if (error) {
      if (error.code === '23505') { setDupeError(true); return }
      setSaveError('save failed — try again')
      return
    }
    setTags(prev => [...prev, data])
    setDraft('')
    setDupeError(false)
    setSaveError(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  async function handleDelete(id) {
    if (deleteConfirmId !== id) { setDeleteConfirmId(id); return }
    const prev = tags
    const tag = tags.find(t => t.id === id)
    setTags(tags.filter(t => t.id !== id))
    setDeleteConfirmId(null)
    const { error } = await deleteCustomTag(id)
    if (error) {
      setTags(prev)
      setSaveError('delete failed — try again')
    } else {
      // Keep usage count row — orphaned values remain filterable in archive
      const next = { ...usageCounts }
      delete next[tag?.label]
      setUsageCounts(next)
    }
  }

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>your tags.</span>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.subhead}>
        tag journal entries with words that are yours — not just needs and states.
      </div>

      <div className={styles.body}>
        {saveError && (
          <div className={styles.errorBanner} onClick={() => setSaveError(null)}>{saveError}</div>
        )}

        <div className={styles.createRow}>
          <input
            ref={inputRef}
            className={`${styles.createInput} ${dupeError ? styles.createInputError : ''}`}
            type="text"
            placeholder="new tag…"
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            maxLength={40}
          />
          <button
            className={styles.addBtn}
            onClick={handleAdd}
            disabled={!draft.trim()}
          >add</button>
        </div>
        {dupeError && (
          <div className={styles.dupeError}>you already have that tag</div>
        )}

        <div className={styles.tagList}>
          {tags.length === 0 && (
            <div className={styles.emptyHint}>no tags yet — create one above.</div>
          )}
          {tags.map(tag => {
            const count = usageCounts[tag.label] || 0
            const isConfirming = deleteConfirmId === tag.id
            return (
              <div key={tag.id} className={styles.tagRow}>
                <span className={styles.tagLabel}>{tag.label}</span>
                <span className={styles.tagMeta}>{count} {count === 1 ? 'entry' : 'entries'}</span>
                <button
                  className={isConfirming ? styles.deleteBtnConfirm : styles.deleteBtn}
                  onClick={() => handleDelete(tag.id)}
                >
                  {isConfirming ? 'confirm' : 'delete'}
                </button>
              </div>
            )
          })}
        </div>

        {deleteConfirmId && (
          <div className={styles.deleteHint}>
            entries keep this tag — it just won't be offered again.
          </div>
        )}
      </div>
    </div>
  )
}
