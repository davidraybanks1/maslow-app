import { useEffect, useRef, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import {
  FLOW_NEEDS, NEED_BY_ID, ZONES, NEED_DESCS, emptyPlaced, isZoneDisabled, isZoneFull,
} from '../data'

const LEAVE_MS = 180

// Sorting: one need card at a time, each tapped into one of five buckets.
// Tapping a placed chip puts that need back in line. When the last need lands
// the screen hands the finished sort up.
export default function SortScreen({ onProgress, onDone }) {
  const [queue, setQueue] = useState(() => FLOW_NEEDS.slice(1).map(n => n.id))
  const [current, setCurrent] = useState(FLOW_NEEDS[0].id)
  const [placed, setPlaced] = useState(emptyPlaced)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const sortedCount = Object.values(placed).reduce((n, list) => n + list.length, 0)
  useEffect(() => { onProgress(sortedCount) }, [sortedCount, onProgress])

  const need = current ? NEED_BY_ID[current] : null

  function commit(zone) {
    if (!need || leaving) return
    if (isZoneDisabled(need, zone) || isZoneFull(zone, placed)) return
    const nextPlaced = { ...placed, [zone.key]: [...placed[zone.key], need.id] }
    setPlaced(nextPlaced)
    setLeaving(true)
    timer.current = setTimeout(() => {
      setLeaving(false)
      if (queue.length === 0) {
        setCurrent(null)
        onDone(nextPlaced)
      } else {
        setCurrent(queue[0])
        setQueue(queue.slice(1))
      }
    }, LEAVE_MS)
  }

  function unplace(id, zoneKey) {
    if (leaving) return
    setPlaced(p => ({ ...p, [zoneKey]: p[zoneKey].filter(x => x !== id) }))
    setQueue(q => [id, ...q])
  }

  const tags = []
  if (need && need.mandatory) tags.push('always tracked')
  if (need && need.id === 'rest') tags.push('tops out at routine')

  return (
    <ScreenLayout counter={`${sortedCount} / ${FLOW_NEEDS.length}`} cta={{ label: 'continue', disabled: true }}>
      <div className={styles.sortHead}>
        <div className={styles.sortHeadTitle}>Let{'’'}s get an idea of your needs</div>
        <div className={styles.sortHeadSub}>for each need, tap how you would describe it.</div>
      </div>

      <div className={`${styles.cardStage} ${styles.sortStage}`}>
        {queue.length >= 2 && <div className={`${styles.needCardPeek} ${styles.peek2}`} />}
        {queue.length >= 1 && <div className={`${styles.needCardPeek} ${styles.peek1}`} />}
        {need && (
          <div className={`${styles.needCard}${leaving ? ` ${styles.leaving}` : ''}`}>
            <div className={styles.needName}>{need.name}</div>
            {tags.length > 0 && (
              <div className={styles.needTags}>
                {tags.map(t => <span key={t} className={styles.needTag}>{t}</span>)}
              </div>
            )}
            <div className={styles.tapHint}>{NEED_DESCS[need.id] || 'tap a bucket below'}</div>
          </div>
        )}
      </div>

      <div className={styles.zones}>
        {ZONES.map(zone => {
          const disabled = isZoneDisabled(need, zone)
          const full = !disabled && isZoneFull(zone, placed)
          const n = placed[zone.key].length
          const atTarget = zone.cap !== Infinity && n === zone.cap
          const overTarget = zone.cap !== Infinity && n > zone.cap
          const interactive = !disabled && !full
          const swatchVar = (zone.key === 'appreciation' || zone.key === 'nourishment') ? `${zone.key}-strong` : zone.key
          return (
            <div
              key={zone.key}
              className={`${styles.zone} ${disabled ? styles.disabled : full ? styles.full : styles.enabled}${(atTarget || overTarget) ? ` ${styles.overTarget}` : ''}`}
              onClick={interactive ? () => commit(zone) : undefined}
            >
              <div className={styles.zoneHead}>
                <span
                  className={`${styles.zoneSwatch}${zone.key === 'unassigned' ? ` ${styles.unassigned}` : ''}`}
                  style={zone.key === 'unassigned' ? undefined : { background: `var(--${swatchVar})` }}
                />
                <span className={`${styles.zoneLabel}${(atTarget || overTarget) ? ` ${styles.dimmed}` : ''}`}>{zone.label}</span>
                {zone.cap !== Infinity && (
                  <span className={`${styles.zoneCount}${(atTarget || overTarget) ? ` ${styles.over}` : ''}`}>
                    {n} of {zone.cap}{overTarget ? ' · we’ll trim' : atTarget ? ' · full' : ''}
                  </span>
                )}
              </div>

              {disabled && need && (
                <div className={styles.zoneWhy}>
                  {zone.key === 'unassigned'
                    ? `${need.name} is always tracked`
                    : need.id === 'rest' ? 'rest tops out at routine' : 'not available for this need'}
                </div>
              )}

              {n > 0 && (
                <div className={styles.chips}>
                  {placed[zone.key].map(id => (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.chip} ${styles[zone.key]}`}
                      onClick={e => { e.stopPropagation(); unplace(id, zone.key) }}
                    >
                      <span>{NEED_BY_ID[id].name}</span><span className={styles.chipX}>{'×'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScreenLayout>
  )
}
