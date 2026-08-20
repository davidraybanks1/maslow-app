import { useState, useEffect, useRef } from 'react'
import { useIsDesktop } from '../lib/useIsDesktop'
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
  tierEl, triggerEl, onClose,
}) {
  const isDesktop = useIsDesktop()
  const [phase, setPhase] = useState('open')
  const phaseRef = useRef('open')
  const closeTimerRef = useRef(null)
  const containerRef = useRef(null)
  const closeRef = useRef(null)

  // Snapshot sort order at mount — prevents rows jumping while user taps
  const [sortedPools] = useState(() => buildSortedPools(modeNeeds, state, checked))

  useEffect(() => {
    containerRef.current?.focus()
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }
  }, [])

  // Keep closeRef current so stale-closure event listeners always call the latest close
  closeRef.current = function close() {
    if (phaseRef.current === 'closing') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      phaseRef.current = 'closing'
      triggerEl?.focus()
      onClose()
      return
    }
    const mobile = !window.matchMedia('(min-width: 900px)').matches
    phaseRef.current = 'closing'
    setPhase('closing')
    closeTimerRef.current = setTimeout(() => {
      triggerEl?.focus()
      onClose()
    }, mobile ? 220 : 150)
  }

  useEffect(() => {
    function onOutside(e) {
      if (tierEl && !tierEl.contains(e.target)) closeRef.current()
    }
    function onKey(e) { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [tierEl])

  const isClosing = phase === 'closing'

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

  const popupId = `needs-popup-${mode}`

  const header = (
    <div className={styles.popupHeader}>
      <div className={styles.popupHeaderLeft}>
        <div className={styles.popupDot} style={{ background: pip }} />
        <span className={styles.popupModeName}>{mode}</span>
      </div>
      <button className={styles.popupClose} onClick={() => closeRef.current()} aria-label="close">✕</button>
    </div>
  )

  const needsList = (
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
                  onClick={e => { e.stopPropagation(); handlePracticeTap(n.id, mode, practice.label, practice.id) }}
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
  )

  if (!isDesktop) {
    return (
      <>
        <div
          className={`${styles.scrim} ${isClosing ? styles.scrimClosing : ''}`}
          onClick={() => closeRef.current()}
        />
        <div
          id={popupId}
          role="dialog"
          aria-label={mode}
          aria-modal
          tabIndex={-1}
          ref={containerRef}
          className={`${styles.sheet} ${isClosing ? styles.sheetClosing : ''}`}
        >
          <div className={styles.dragHandle} />
          {header}
          {needsList}
        </div>
      </>
    )
  }

  return (
    <div
      id={popupId}
      role="dialog"
      aria-label={mode}
      tabIndex={-1}
      ref={containerRef}
      className={`${styles.popup} ${isClosing ? styles.popupClosing : ''}`}
    >
      {header}
      {needsList}
    </div>
  )
}
