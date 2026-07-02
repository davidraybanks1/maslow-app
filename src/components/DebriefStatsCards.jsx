import DonutChart from './DonutChart'
import styles from './DebriefStatsCards.module.css'

function DistributionRow({ label, data }) {
  return (
    <div className={styles.distRow}>
      <DonutChart data={data} className={styles.donutCanvas} />
      <div className={styles.distLegend}>
        <div className={styles.distLabel}>{label}</div>
        {data.map(d => (
          <div key={d.name} className={styles.distLegendItem}>
            <div className={styles.distDot} style={{ background: d.color }} />
            <span className={styles.distName}>{d.name}</span>
            <span className={styles.distCount}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnxietyEpisodesCard({ byNatureAnxiety, byEnvironment, pattern, anxietyCount }) {
  return (
    <>
      <div className={styles.card}>
        <div className={styles.eyebrow}>ANXIETY EPISODES</div>
        {anxietyCount === 0 ? (
          <div className={styles.cardEmpty}>no anxiety debriefs yet</div>
        ) : anxietyCount < 3 ? (
          <div className={styles.cardEmpty}>patterns appear after a few anxiety debriefs</div>
        ) : (
          <>
            <DistributionRow label="by nature" data={byNatureAnxiety} />
            <DistributionRow label="by environment" data={byEnvironment} />
          </>
        )}
      </div>
      {pattern && (
        <div className={styles.patternCardGold}>
          <div className={styles.eyebrow}>pattern</div>
          <div className={styles.patternBody}>{pattern}</div>
        </div>
      )}
    </>
  )
}

export function PeakMomentsCard({ byTypePeak, byEnvironment, pattern, peakCount }) {
  return (
    <>
      <div className={styles.cardPeak}>
        <div className={styles.eyebrow}>PEAK MOMENTS</div>
        {peakCount === 0 ? (
          <div className={styles.cardEmpty}>no peak debriefs yet</div>
        ) : peakCount < 3 ? (
          <div className={styles.cardEmpty}>patterns appear after a few peak moments</div>
        ) : (
          <>
            <DistributionRow label="by type" data={byTypePeak} />
            <DistributionRow label="by environment" data={byEnvironment} />
          </>
        )}
      </div>
      {pattern && (
        <div className={styles.patternCardGreen}>
          <div className={styles.eyebrow}>pattern</div>
          <div className={styles.patternBody}>{pattern}</div>
        </div>
      )}
    </>
  )
}
