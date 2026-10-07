import { useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import { NEED_BY_ID, RANK_INTRO, NUMBER_WORDS, NEXT_ZONE, DROP_LABEL, rankKeepFor } from '../data'

// A bucket that ended up over its real target: pick which needs matter most.
// Always-kept needs sit on top, locked in; the rest of the needs drop to the
// next mode down. `origin` is where each need was first sorted, so the ones
// that arrived from a higher bucket can say so.
export default function RankScreen({ zone, placed, step, total, origin, onConfirm }) {
  const members = placed[zone.key]
  const pinned = members.filter(id => NEED_BY_ID[id].mandatory)
  const options = members.filter(id => !NEED_BY_ID[id].mandatory)
  const keep = rankKeepFor(zone, placed)
  const [selected, setSelected] = useState([])

  function toggle(id) {
    setSelected(sel => {
      const i = sel.indexOf(id)
      if (i !== -1) return sel.filter(x => x !== id)
      if (sel.length < keep) return [...sel, id]
      return sel
    })
  }

  const atCap = keep !== 0 && selected.length >= keep
  const ready = keep === 0 || selected.length === keep

  return (
    <ScreenLayout
      counter={`${step} of ${total}`}
      cta={{ label: 'continue', disabled: !ready, onClick: () => onConfirm(selected) }}
    >
      <div className={styles.cardStage}>
        <div className={styles.doneCard}>
          <div className={styles.needName}>{RANK_INTRO[zone.key] || zone.label}</div>
          <div className={styles.rankSub}>
            {keep === 0
              ? `No room left here, so these move to “${DROP_LABEL[NEXT_ZONE[zone.key]]}”`
              : `Pick the ${NUMBER_WORDS[keep]} that matter most. The rest move to “${DROP_LABEL[NEXT_ZONE[zone.key]]}”`}
          </div>
        </div>
      </div>

      <div className={styles.zones}>
        <div className={styles.rankList}>
          {pinned.map(id => (
            <div key={id} className={`${styles.rankRow} ${styles.pinned}`} style={{ borderLeftColor: `var(--${zone.key})` }}>
              <span className={styles.rankName}>{NEED_BY_ID[id].name}</span>
              <span className={styles.rankPinTag}>always kept</span>
            </div>
          ))}
          {options.map(id => {
            const idx = selected.indexOf(id)
            const active = idx !== -1
            return (
              <button
                key={id}
                type="button"
                className={`${styles.rankRow2}${active ? ` ${styles.active}` : ''}${atCap ? ` ${styles.atCap}` : ''}`}
                onClick={keep !== 0 ? () => toggle(id) : undefined}
                aria-pressed={active}
              >
                <span className={styles.rankBadge}>{active ? String(idx + 1) : ''}</span>
                <span className={styles.rankRow2Name}>{NEED_BY_ID[id].name}</span>
                {origin && origin[id] && origin[id] !== zone.key && <span className={styles.rankMoved}>moved down</span>}
              </button>
            )
          })}
        </div>
        <div className={styles.rankStatus}>{selected.length} of {keep} picked</div>
      </div>
    </ScreenLayout>
  )
}
