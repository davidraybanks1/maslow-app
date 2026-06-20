import styles from './Settings.module.css'

export default function Settings({ state, updateShowNoteToSelf }) {
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
    </div>
  )
}
