import { useState, useMemo } from 'react'
import { NEEDS, MODE_ORDER } from '../lib/constants'
import { createDataStats } from '../lib/dataStats'
import styles from './Data.module.css'

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
]

const MODE_THRESHOLDS = { exploration: 80, appreciation: 60, nourishment: 50, survival: 20 }

// 7px dots use deep sage for appreciation (< 12px threshold)
const TIER_DOT = {
  exploration: '#1B3A2D',
  appreciation: '#9DB394',
  nourishment: '#E8B81F',
  survival: '#D93B1C',
}
// bars keep brand sage for appreciation
const TIER_BAR = {
  exploration: '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment: '#E8B81F',
  survival: '#D93B1C',
}

// Rolling window ending today; comparison = same length immediately prior.
// 7d: today-6 through today inclusive. 30d: same pattern.
function buildWindowKeys(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - offset - (n - 1 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

function buildSubhead(period) {
  const today = new Date()
  if (period === 30) return 'last 30 days · compared with the 30 before'
  const start = new Date(today)
  start.setDate(today.getDate() - (period - 1))
  const fmtDay = d => {
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase()
    return `${weekday} ${d.getDate()}`
  }
  const month = today.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase()
  return `${fmtDay(start)} — ${fmtDay(today)} ${month} · compared with the week before`
}

function buildNeedDeltas(canvas, checkins, period) {
  const cur = buildWindowKeys(period, 0)
  const pri = buildWindowKeys(period, period)
  return NEEDS.filter(n => canvas[n.id]).map(need => {
    const pct = Math.round(
      cur.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length / cur.length * 100
    )
    const priorPct = Math.round(
      pri.filter(dk => (checkins[dk] || []).some(e => e.need_id === need.id)).length / pri.length * 100
    )
    return { need, mode: canvas[need.id], pct, priorPct, delta: pct - priorPct }
  })
}

function cap(str) { return str[0].toUpperCase() + str.slice(1) }

function headlineSentence(pct, canvasTarget, modeStats) {
  const diff = pct - canvasTarget
  const pacePhrase = Math.abs(diff) < 3
    ? 'Right on your pace.'
    : `${Math.abs(diff)} pts ${diff > 0 ? 'ahead of' : 'behind'} your own pace.`
  const behind = modeStats.filter(ms => ms.pct < MODE_THRESHOLDS[ms.mode])
  if (behind.length === 0) return pacePhrase
  const modeClause = behind.length === 1
    ? `${cap(behind[0].mode)} is the only mode still behind.`
    : behind.length === modeStats.length
    ? 'All modes are running below target.'
    : `${behind.map(m => cap(m.mode)).join(' and ')} are still behind.`
  return `${pacePhrase} ${modeClause}`
}

function HeadlineCard({ period, stats, canvas }) {
  const { pct, delta } = stats.getCompletion(period)
  const activeNeeds = NEEDS.filter(n => canvas[n.id])
  const canvasTarget = activeNeeds.length > 0
    ? Math.round(activeNeeds.reduce((s, n) => s + (MODE_THRESHOLDS[canvas[n.id]] || 50), 0) / activeNeeds.length)
    : 50
  const modeStats = stats.getModeStats(period).filter(ms => NEEDS.some(n => canvas[n.id] === ms.mode))
  const periodLabel = period === 7 ? 'last week' : 'last 30d'

  return (
    <div className={styles.headlineCard}>
      <div className={styles.headlineTop}>
        <span className={styles.headlineLabel}>THE HEADLINE</span>
        {delta !== 0 && (
          <span className={`${styles.headlineDelta}${delta < 0 ? ` ${styles.headlineDeltaDown}` : ''}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs {periodLabel}
          </span>
        )}
      </div>
      <div className={styles.headlineNumberRow}>
        <span className={styles.headlineBig}>{pct}</span>
        <span className={styles.headlinePct}>%</span>
        <div className={styles.headlineContext}>
          <span>of your canvas met</span>
          <span>you set a pace of {canvasTarget}%</span>
        </div>
      </div>
      <div className={styles.headlineBarWrap}>
        <div className={styles.headlineBarTrack}>
          <div className={styles.headlineBarFill} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className={styles.headlinePaceTick} style={{ left: `${canvasTarget}%` }} />
      </div>
      <p className={styles.headlineSentence}>{headlineSentence(pct, canvasTarget, modeStats)}</p>
    </div>
  )
}

function WhatChanged({ period, canvas, checkins }) {
  const needDeltas = useMemo(
    () => buildNeedDeltas(canvas, checkins, period),
    [canvas, checkins, period]
  )
  const sorted = [...needDeltas].sort((a, b) => b.delta - a.delta)
  const risers = sorted.filter(n => n.delta > 0).slice(0, 3)
  const fallers = [...sorted].reverse().filter(n => n.delta < 0).slice(0, 3)
  const rows = [...risers, ...fallers]
  if (rows.length === 0) return null

  const modeCounts = {}
  for (const ns of fallers) modeCounts[ns.mode] = (modeCounts[ns.mode] || 0) + 1
  const topEntry = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]
  const closingRead = topEntry && topEntry[1] >= 2 && fallers.length >= 2
    ? `${topEntry[1] === fallers.length ? 'All' : topEntry[1]} of the needs losing ground are in ${topEntry[0]} mode.`
    : null

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>WHAT CHANGED</span>
        <span className={styles.sectionMeta}>biggest movers</span>
      </div>
      {rows.map(ns => (
        <div key={ns.need.id} className={styles.moverRow}>
          <span className={styles.moverDot} style={{ background: TIER_DOT[ns.mode] }} />
          <span className={styles.moverName}>{ns.need.name}</span>
          <div className={styles.moverBarTrack}>
            <div className={styles.moverBarFill} style={{ width: `${Math.min(ns.pct, 100)}%`, background: TIER_BAR[ns.mode] }} />
          </div>
          <span className={styles.moverValue}>{ns.pct}%</span>
          <span className={`${styles.moverDelta} ${ns.delta > 0 ? styles.moverDeltaUp : ns.delta < 0 ? styles.moverDeltaDown : styles.moverDeltaFlat}`}>
            {ns.delta > 0 ? '+' : ''}{ns.delta}
          </span>
        </div>
      ))}
      {closingRead && <p className={styles.sectionRead}>{closingRead}</p>}
    </section>
  )
}

export default function Data({ state }) {
  const [period, setPeriod] = useState(7)

  const canvas    = state?.canvas    ?? {}
  const checkins  = state?.checkins  ?? {}
  const moods     = state?.moods     ?? []
  const practices = state?.practices ?? {}
  const practicesDB = state?.practicesDB ?? []

  const stats = useMemo(
    () => createDataStats({ canvas, checkins, moods, practices, practicesDB }),
    [canvas, checkins, moods, practices, practicesDB]
  )

  const hasCanvas = Object.keys(canvas).length > 0

  return (
    <div className={styles.screen}>
      <div className={styles.appBar}>
        <span className={styles.wordmark}>m</span>
        <div className={styles.periodToggle}>
          {PERIODS.map(p => (
            <button
              key={p.days}
              className={`${styles.periodPill}${period === p.days ? ` ${styles.periodPillActive}` : ''}`}
              onClick={() => setPeriod(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scrollArea}>
        <h1 className={styles.pageTitle}>data</h1>
        <p className={styles.pageSubhead}>{buildSubhead(period)}</p>

        {hasCanvas && (
          <>
            <HeadlineCard period={period} stats={stats} canvas={canvas} />
            <WhatChanged period={period} canvas={canvas} checkins={checkins} />
          </>
        )}

        {/* sections 3–9 added in later stages */}
      </div>
    </div>
  )
}
