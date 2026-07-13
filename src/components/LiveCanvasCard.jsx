import { MODE_ORDER } from '../lib/constants'
import styles from './LiveCanvasCard.module.css'

const LC_MODE_COLORS = {
  exploration: '#1B3A2D',
  appreciation: '#B8C3B1',
  nourishment: '#E8B81F',
  survival: '#D93B1C',
}

export default function LiveCanvasCard({ stats, range }) {
  const { overallPace, canvasTarget, needRows, survivalNeeds } = stats.getLiveCanvas(range)

  return (
    <div className={styles.card}>
      <div className={styles.lcEyebrow}>LIVE CANVAS — {range}D PACE</div>

      <div className={styles.lcOverallRow}>
        <div className={styles.lcOverallLabel}>OVERALL</div>
        <div className={styles.lcOverallPace}>{overallPace}%</div>
      </div>
      <div className={styles.lcTrackContainer}>
        <div className={styles.lcOverallTrack}>
          <div className={styles.lcOverallFill} style={{ width: `${overallPace}%` }} />
        </div>
        <div className={styles.lcTick} style={{ left: `${canvasTarget}%` }} />
      </div>
      <div className={styles.lcTrackTarget}>canvas target {canvasTarget}%</div>

      {needRows.length > 0 && <div className={styles.lcDivider} />}

      {needRows.map(({ needId, name, modeColor, pace, target }) => (
        <div key={needId} className={styles.lcNeedRow}>
          <div className={styles.lcPip} style={{ background: modeColor }} />
          <div className={styles.lcNeedName}>{name}</div>
          <div className={styles.lcNeedTrackContainer}>
            <div className={styles.lcNeedTrack}>
              <div className={styles.lcNeedFill} style={{ width: pace > 0 ? `${pace}%` : '3px', background: modeColor, opacity: pace > 0 ? 1 : 0.45 }} />
            </div>
            <div className={styles.lcNeedTick} style={{ left: `${target}%` }} />
          </div>
          <div className={styles.lcNeedPace}>{pace}%</div>
        </div>
      ))}

      {survivalNeeds.length > 0 && (
        <>
          <div className={styles.lcDivider} />
          <div className={styles.lcSurvivalRow}>
            <span className={styles.lcSurvivalX}>✕</span>
            <span className={styles.lcSurvivalNames}>{survivalNeeds.join(', ')}</span>
            <span className={styles.lcSurvivalNote}>survival — no tracking</span>
          </div>
        </>
      )}

      <div className={styles.lcDivider} />
      <div className={styles.lcLegend}>
        {MODE_ORDER.map(m => (
          <div key={m} className={styles.lcLegendItem}>
            <div className={styles.lcLegendPip} style={{ background: LC_MODE_COLORS[m] }} />
            <span className={styles.lcLegendLabel}>{m}</span>
          </div>
        ))}
        <div className={styles.lcLegendItem}>
          <div className={styles.lcLegendTick} />
          <span className={styles.lcLegendLabel}>mode target</span>
        </div>
      </div>
    </div>
  )
}
