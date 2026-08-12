import { IconChevronLeft } from '@tabler/icons-react'
import { CLAY, ON_CLAY } from '../lib/constants'
import { useIsDesktop } from '../lib/useIsDesktop'
import { DURATION_OPTIONS, computeRemaining, formatTimerTime } from '../lib/useTimer'
import DesktopModal from './DesktopModal'
import styles from './TimerCard.module.css'

const RADIUS = 122
const SVG_SIZE = 270
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const CLAY_VARS = { '--clay': CLAY, '--on-clay': ON_CLAY }
const CLAY_MODAL_STYLE = { background: CLAY, color: ON_CLAY, border: 'none' }

export default function TimerCard({
  timer,
  fullScreen,
  isDone,
  remaining,
  isPaused,
  startTimer,
  pauseTimer,
  resumeTimer,
  endTimer,
  dismissModal,
  hideBar = false,
}) {
  const isDesktop = useIsDesktop()

  const elapsedFraction = timer ? Math.max(0, Math.min(1, 1 - remaining / timer.durationMs)) : 0
  const dashOffset = CIRCUMFERENCE * (1 - elapsedFraction)

  const ringJSX = (
    <div className={styles.ringWrapper}>
      <svg width={SVG_SIZE} height={SVG_SIZE} className={styles.ring} aria-hidden="true">
        <circle cx={SVG_SIZE / 2} cy={SVG_SIZE / 2} r={RADIUS}
          fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.16} />
        <circle cx={SVG_SIZE / 2} cy={SVG_SIZE / 2} r={RADIUS}
          fill="none" stroke="currentColor" strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset} />
      </svg>
      <div className={styles.ringContent}>
        <div className={styles.timeDisplay}>{formatTimerTime(remaining)}</div>
        <div className={styles.timeLabel}>{isDone ? 'DONE' : 'REMAINING'}</div>
      </div>
    </div>
  )

  const footerButtons = (
    <>
      {!isDone && (
        <button className={`${styles.fsBtn} ${styles.fsBtnOutline}`} onClick={isPaused ? resumeTimer : pauseTimer}>
          {isPaused ? 'resume' : 'pause'}
        </button>
      )}
      <button className={`${styles.fsBtn} ${styles.fsBtnFilled}`} onClick={endTimer}>
        {isDone ? 'close' : 'end'}
      </button>
    </>
  )

  return (
    <>
      {!hideBar && (
        <div className={styles.bar} style={CLAY_VARS}>
          <span className={styles.label}>set a timer</span>
          {isDesktop && timer ? (
            <button className={styles.barCountdown} onClick={() => {}}>
              {isDone ? 'done' : formatTimerTime(remaining)}
            </button>
          ) : (
            <div className={styles.pills}>
              {DURATION_OPTIONS.map(m => (
                <button key={m} className={styles.pill} onClick={() => startTimer(m)}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!isDesktop && fullScreen && timer && (
        <div className={styles.fullScreen} style={CLAY_VARS}>
          <div className={styles.fsHeader}>
            <button className={styles.fsBack} onClick={endTimer} aria-label="close timer">
              <IconChevronLeft size={22} strokeWidth={1.75} />
            </button>
            <span className={styles.fsEyebrow}>TIMER</span>
            <span className={styles.fsSpacer} />
          </div>
          <div className={styles.fsBody}>
            {ringJSX}
          </div>
          <div className={styles.fsFooter}>
            {footerButtons}
          </div>
        </div>
      )}

      {isDesktop && fullScreen && timer && (
        <DesktopModal
          title="timer"
          onClose={dismissModal}
          onDismiss={dismissModal}
          cardStyle={CLAY_MODAL_STYLE}
          lightScrim
        >
          <div className={styles.timerModal}>
            <span className={styles.timerModalEyebrow}>TIMER</span>
            {ringJSX}
            <div className={styles.timerModalFooter}>
              {footerButtons}
            </div>
          </div>
        </DesktopModal>
      )}
    </>
  )
}
