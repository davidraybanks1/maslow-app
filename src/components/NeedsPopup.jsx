import { useState, useEffect, useRef } from 'react'
import styles from './NeedsPopup.module.css'

function countAt(n, practice, checked) {
  return checked
    .filter(e => {
      if (e.need_id !== n.id) return false
      if (practice.id && e.practice_id) return e.practice_id === practice.id
      return e.practice_text === practice.label
    })
    .reduce((s, e) => s + (e.count || 1), 0)
}

function buildSortedPools(modeNeeds, state, checked) {
  return modeNeeds.map(n => {
    const pool = (state.practicesDB && state.practicesDB.length > 0)
      ? state.practicesDB.filter(p => p.need_id === n.id && !p.archived_at)
      : (state.practices[n.id] || []).map(label => ({ id: null, label }))
    return { need: n, sorted: [...pool].sort((a, b) => countAt(n, a, checked) - countAt(n, b, checked)) }
  })
}

export default function NeedsPopup({
  mode, pip, modeNeeds, maxBubbles, checked, justTapped,
  lastDoneMap, state, handlePracticeTap, navigate,
  triggerEl, onClose,
}) {
  const closeRef = useRef(null)

  // Snapshot sort order at mount — prevents rows jumping mid-tap.
  // Closing unmounts (key={popupMode} in Today.jsx); reopening re-sorts.
  const [sortedPools] = useState(() => buildSortedPools(modeNeeds, state, checked))

  // Keep closeRef current so the stale-closure keydown listener always sees latest onClose
  closeRef.current = function close() {
    triggerEl?.focus()
    onClose()
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function getLiveCount(n, practice) {
    return checked
      .filter(e => {
        if (e.need_id !== n.id) return false
        if (practice.id && e.practice_id) return e.practice_id === practice.id
        return e.practice_text === practice.label
      })
      .reduce((s, e) => s + (e.count || 1), 0)
  }

  function getNeedDone(n) {
    return Math.min(
      checked.filter(e => e.need_id === n.id).reduce((s, e) => s + (e.count || 1), 0),
      maxBubbles
    )
  }

  return (
    <div
      id={`needs-popup-${mode}`}
      role="dialog"
      aria-label={mode}
      className={styles.popup}
    >
      <div className={styles.popupHeader}>
        <div className={styles.popupHeaderLeft}>
          <div className={styles.popupDot} style={{ background: pip }} />
          <span className={styles.popupModeName}>{mode}</span>
        </div>
        <button className={styles.popupClose} onClick={() => closeRef.current()} aria-label="close">✕</button>
      </div>
      <div className={styles.popupContent}>
        {sortedPools.map(({ need: n, sorted }) => {
          const needDone = getNeedDone(n)
          return (
            <div key={n.id} className={styles.needGroup}>
              <div className={styles.needSubHeader}>
                <span className={styles.needSubName}>{n.name}</span>
                <span className={styles.needSubCount}>{needDone}/{maxBubbles}</span>
              </div>
              {sorted.length === 0 ? (
                <div className={styles.noPractice}>
                  no practices — <span className={styles.noPracticeLink} onClick={() => { closeRef.current(); navigate('/canvas') }}>add some</span>
                </div>
              ) : sorted.map(practice => {
                const practiceKey = practice.id || `${n.id}_${practice.label}`
                const count = getLiveCount(n, practice)
                const isJustNow = justTapped === practiceKey
                const lastDays = lastDoneMap.get(practiceKey) ?? null
                const meta = isJustNow ? 'just now' : count >= 1 ? 'today' : (lastDays !== null && lastDays > 0 ? `${lastDays}d ago` : '')
                return (
                  <div
                    key={practiceKey}
                    className={styles.practiceRow}
                    onClick={() => handlePracticeTap(n.id, mode, practice.label, practice.id)}
                  >
                    <div
                      className={`${styles.practiceCheck} ${count > 0 ? styles.practiceCheckFilled : ''}`}
                      style={count > 0 ? { background: pip, borderColor: pip } : { borderColor: pip }}
                    />
                    <span className={styles.practiceLabel}>{practice.label}</span>
                    <div className={styles.practiceMeta}>
                      {count >= 2 && <span className={styles.practiceX2}>×2</span>}
                      {meta && <span className={styles.practiceStamp}>{meta}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
