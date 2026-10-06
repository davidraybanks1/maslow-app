import styles from './Flow.module.css'

// One screen's skeleton: the counter row, a scrolling body, and the pinned
// button. `topRight` replaces the counter with other small content (the intro's
// sign-in link). `cta` is { label, arrow, hidden, disabled, onClick }; leave it off for
// a screen that has no button.
export default function ScreenLayout({ counter, topRight, cta, children }) {
  return (
    <div className={styles.layout}>
      <div className={styles.top}>
        <div className={styles.topRow}>
          {counter ? <span className={styles.counter}>{counter}</span> : null}
          {topRight || null}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
      {cta && (
        <div className={styles.ctaRow}>
          <button
            type="button"
            className={`${styles.cta}${cta.arrow ? ` ${styles.ctaArrow}` : ''}${cta.hidden ? ` ${styles.ctaHidden}` : ''}`}
            disabled={cta.disabled}
            onClick={cta.onClick}
            aria-label={cta.arrow ? 'continue' : undefined}
            aria-hidden={cta.hidden || undefined}
            tabIndex={cta.hidden ? -1 : undefined}
          >
            {cta.arrow ? '→' : cta.label}
          </button>
        </div>
      )}
    </div>
  )
}
