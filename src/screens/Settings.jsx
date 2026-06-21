import styles from './Settings.module.css'

const REVIEW_DAYS = [
  { value: 0, label: 'mon' },
  { value: 1, label: 'tue' },
  { value: 2, label: 'wed' },
  { value: 3, label: 'thu' },
  { value: 4, label: 'fri' },
  { value: 5, label: 'sat' },
  { value: 6, label: 'sun' },
]

export default function Settings({ state, updateShowNoteToSelf, updateReviewSchedule }) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>settings</div>
      </div>

      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <div className={styles.toggleLabels}>
            <div className={styles.toggleLabel}>note to self</div>
            <div className={styles.toggleSub}>shows at the top of your today screen.</div>
          </div>
          <div className={styles.toggleSwitch} onClick={() => updateShowNoteToSelf(!state.showNoteToSelf)}>
            <div className={`${styles.toggleTrack} ${state.showNoteToSelf ? styles.toggleTrackOn : ''}`}>
              <div className={`${styles.toggleThumb} ${state.showNoteToSelf ? styles.toggleThumbOn : ''}`} />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sectionEyebrow}>WEEKLY REVIEW</div>
      <div className={styles.card}>
        <div className={styles.fieldLabel}>day</div>
        <div className={styles.dayRow}>
          {REVIEW_DAYS.map(d => (
            <button
              key={d.value}
              className={`${styles.dayBtn} ${state.reviewDay === d.value ? styles.dayBtnActive : ''}`}
              onClick={() => updateReviewSchedule(d.value, state.reviewTime || '10:00')}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className={styles.fieldLabel} style={{ marginTop: 16 }}>time</div>
        <input
          type="time"
          className={styles.timeInput}
          value={state.reviewTime || '10:00'}
          onChange={e => updateReviewSchedule(state.reviewDay ?? 0, e.target.value)}
        />
      </div>
    </div>
  )
}
