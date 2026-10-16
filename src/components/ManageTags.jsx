import { useState, useEffect } from 'react'
import { loadCustomTags, createCustomTag, deleteCustomTag, loadCustomTagUsageCounts } from '../lib/store'
import Sheet from './Sheet'
import styles from './ManageTags.module.css'

// Tags. Same shape as Practices and Needs: type a word to add one, tap a tag to
// see what it's on and delete it.
export default function ManageTags({ userId, onClose }) {
  const [tags, setTags] = useState([])
  const [usageCounts, setUsageCounts] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)          // tag id
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    Promise.all([loadCustomTags(userId), loadCustomTagUsageCounts(userId)]).then(([t, counts]) => {
      setTags(t)
      setUsageCounts(counts)
      setLoaded(true)
    })
  }, [userId])

  function handleClose() {
    setClosing(true)
    setTimeout(() => onClose(tags), 200)
  }

  async function handleAdd(e) {
    e?.preventDefault()
    const normalized = draft.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!normalized) return
    if (tags.some(t => t.label === normalized)) { setError('you already have that one.'); return }
    const { data, error: err } = await createCustomTag(userId, normalized)
    if (err) {
      setError(err.code === '23505' ? 'you already have that one.' : "couldn't save. try again.")
      return
    }
    setTags(prev => [...prev, data])
    setDraft('')
    setError('')
  }

  const tag = open ? tags.find(t => t.id === open) : null
  const count = tag ? (usageCounts[tag.label] || 0) : 0

  function closeSheet() { setOpen(null); setConfirmDelete(false) }

  async function handleDelete() {
    if (!tag) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    const previous = tags
    setTags(tags.filter(t => t.id !== tag.id))
    closeSheet()
    const { error: err } = await deleteCustomTag(tag.id)
    if (err) { setTags(previous); setError("couldn't delete. try again.") }
  }

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>Tags</h1>
          <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="close tags">✕</button>
        </div>

        <div className={styles.body}>
          <section className={styles.section} aria-labelledby="add-tag-head">
            <h2 id="add-tag-head" className={styles.sectionHead}>Add a tag</h2>
            <form className={styles.addRow} onSubmit={handleAdd}>
              <label htmlFor="new-tag" className={styles.srOnly}>new tag</label>
              <input
                id="new-tag"
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                type="text"
                placeholder="e.g. kids, work, travel"
                value={draft}
                onChange={e => { setDraft(e.target.value); setError('') }}
                maxLength={40}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" className={styles.addBtn} disabled={!draft.trim()}>Add</button>
            </form>
            <p className={styles.error} role="alert">{error}</p>
          </section>

          <section className={styles.section} aria-labelledby="your-tags-head">
            <h2 id="your-tags-head" className={styles.sectionHead}>Your tags</h2>
            {loaded && tags.length === 0
              ? <p className={styles.empty}>none yet.</p>
              : (
                <div className={styles.pills}>
                  {tags.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.pill}
                      aria-haspopup="dialog"
                      aria-label={`${t.label}, ${usageCounts[t.label] || 0} entries`}
                      onClick={() => { setOpen(t.id); setConfirmDelete(false) }}
                    >
                      {t.label}
                      <span className={styles.pillCount}>{usageCounts[t.label] || 0}</span>
                    </button>
                  ))}
                </div>
              )}
          </section>
        </div>
      </div>

      {tag && (
        <Sheet label={`tag ${tag.label}`} onClose={closeSheet}>
          <h2 className={styles.sheetTitle}>{tag.label}</h2>
          <p className={styles.sheetNote}>on {count} {count === 1 ? 'entry' : 'entries'}</p>
          <button
            type="button"
            className={`${styles.ghostBtn} ${confirmDelete ? styles.ghostBtnArmed : ''}`}
            onClick={handleDelete}
          >{confirmDelete ? 'tap again to delete' : 'delete'}</button>
          {confirmDelete && <p className={styles.sheetNote}>entries keep it. it just won't be offered again.</p>}
          <button type="button" className={styles.ghostBtn} onClick={closeSheet}>not now</button>
        </Sheet>
      )}
    </div>
  )
}
