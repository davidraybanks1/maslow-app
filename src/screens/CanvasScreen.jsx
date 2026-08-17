import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NEEDS, MODE_ORDER, MODES } from '../lib/constants'
import { createDataStats } from '../lib/dataStats'
import styles from './CanvasScreen.module.css'

// Capacity: how many needs each mode can hold
const MODE_NEED_CAP = { exploration: 1, appreciation: 2, nourishment: 3, survival: 4 }

const MODE_DESCS = {
  exploration:  'the one need that feels like a passion',
  appreciation: 'needs that bring enjoyment to your life',
  nourishment:  'needs that keep you from feeling drained',
  survival:     'needs you just check the box on',
}

const MODE_ABBR = { exploration: 'explr', appreciation: 'apprc', nourishment: 'nrsh', survival: 'srvl' }

const GUIDE_KEY = 'maslow_canvas_guide_seen'

export default function CanvasScreen({ state, updateCanvas, addPractice, renamePractice, archivePractice }) {
  const navigate = useNavigate()
  const [guideOpen, setGuideOpen] = useState(() => {
    try { return !localStorage.getItem(GUIDE_KEY) } catch { return true }
  })

  useEffect(() => {
    if (guideOpen) {
      try { localStorage.setItem(GUIDE_KEY, '1') } catch {}
    }
  }, [])

  const useDB = Array.isArray(state.practicesDB) && state.practicesDB.length > 0

  function needsInMode(mode) {
    return NEEDS.filter(n => state.canvas[n.id] === mode)
  }

  function isModeFull(mode, excludeId = null) {
    const count = NEEDS.filter(n => n.id !== excludeId && state.canvas[n.id] === mode).length
    return count >= MODE_NEED_CAP[mode]
  }

  function getPractices(needId) {
    if (useDB) return state.practicesDB.filter(p => p.need_id === needId && !p.archived_at)
    return (state.practices[needId] || []).map((label, i) => ({ id: `${needId}_${i}`, label, need_id: needId, archived_at: null }))
  }

  // Derived counts
  const needCount = NEEDS.filter(n => state.canvas[n.id]).length
  const practiceCount = NEEDS.reduce((sum, n) => sum + getPractices(n.id).length, 0)
  const totalCap = Object.values(MODE_NEED_CAP).reduce((a, b) => a + b, 0) // 10
  const openSlots = totalCap - needCount
  const openSlotPhrase = openSlots === 0
    ? 'every mode at capacity'
    : openSlots === 1
      ? '1 open slot'
      : `${openSlots} open slots`

  return (
    <div className={styles.screen}>
      {/* ── Static header ── */}
      <div className={styles.staticHeader}>
        {/* App bar: wordmark + guide pill */}
        <div className={styles.appBar}>
          <span className={styles.wordmark}>m</span>
          <button
            className={`${styles.guidePill} ${guideOpen ? styles.guidePillActive : ''}`}
            onClick={() => setGuideOpen(o => !o)}
          >
            {guideOpen ? 'hide guide' : 'what is this?'}
          </button>
        </div>

        {/* Guide card */}
        {guideOpen && (
          <div className={styles.guideCard}>
            <div className={styles.guideTerm}>
              <span className={styles.guideTermLabel}>needs</span>
              <span className={styles.guideTermDef}>the parts of life that give you energy.</span>
            </div>
            <div className={styles.guideTerm}>
              <span className={styles.guideTermLabel}>modes</span>
              <span className={styles.guideTermDef}>the emphasis a need warrants for you right now — from just checking the box to real passion.</span>
            </div>
            <div className={styles.guideTerm}>
              <span className={styles.guideTermLabel}>practices</span>
              <span className={styles.guideTermDef}>the daily acts that meet a need.</span>
            </div>
          </div>
        )}

        {/* Title + subhead */}
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>your canvas.</h1>
          <p className={styles.pageSubhead}>
            {needCount} {needCount === 1 ? 'need' : 'needs'} placed · {practiceCount} {practiceCount === 1 ? 'practice' : 'practices'} · {openSlotPhrase}
          </p>
        </div>

        {/* Bottom hairline */}
        <div className={styles.headerHairline} />
      </div>

      {/* ── Scroll area (mode cards — stages 2+) ── */}
      <div className={styles.scrollArea}>
        {/* Stage 2 will add mode cards here */}
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(0,0,0,.35)' }}>
          mode cards — coming in stage 2
        </div>
      </div>
    </div>
  )
}
