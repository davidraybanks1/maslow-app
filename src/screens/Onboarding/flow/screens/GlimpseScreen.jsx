import { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import { REDUCED_MOTION } from '../Typed'
import { splitSentences } from '../useTimeline'

// A real render of one of the app's screens after a week of use, in a window
// that scrolls itself slowly, then rests. Touch, wheel or a key press hands
// control back to the viewer.
export default function GlimpseScreen({ slices, alt, body, onNext }) {
  const frame = useRef(null)
  const [loaded, setLoaded] = useState(() => new Set())
  const ready = loaded.size >= slices.length
  const markLoaded = useCallback(i => setLoaded(prev => (prev.has(i) ? prev : new Set(prev).add(i))), [])

  // A slice that was already cached can finish before React has attached its
  // onLoad, so look for the ones that are complete once on mount.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    Array.from(el.querySelectorAll('img')).forEach((img, i) => {
      if (img.complete && img.naturalHeight > 0) markLoaded(i)
    })
  }, [markLoaded])

  // The pan starts once every slice is in, so there is always something to scroll through.
  useEffect(() => {
    const el = frame.current
    if (!el || REDUCED_MOTION || !ready) return undefined
    let cancelled = false
    let raf = null
    const stop = () => { cancelled = true }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown']
    events.forEach(ev => el.addEventListener(ev, stop, { passive: true, once: true }))
    const start = setTimeout(() => {
      const max = el.scrollHeight - el.clientHeight
      if (cancelled || max <= 0) return
      const dur = Math.max(6000, max / 0.11)
      let t0 = null
      function step(ts) {
        if (cancelled) return
        if (t0 === null) t0 = ts
        const k = Math.min(1, (ts - t0) / dur)
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        el.scrollTop = max * (0.7 * k + 0.3 * e)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, 900)
    return () => {
      cancelled = true
      clearTimeout(start)
      if (raf) cancelAnimationFrame(raf)
      events.forEach(ev => el.removeEventListener(ev, stop))
    }
  }, [ready])

  return (
    <ScreenLayout cta={{ arrow: true, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <div className={styles.conceptTitle} style={{ fontSize: 30 }}>After about a week</div>
        <div className={styles.hookBody}>
          {splitSentences(body).map(s => <span key={s} className={styles.sent}>{s}</span>)}
        </div>
        <div className={styles.glimpseCaption}>sample data {'·'} scroll to explore</div>
        <div className={styles.glimpseWrap}>
          <div className={styles.glimpseFrame} ref={frame}>
            <div className={styles.glimpseStack} role="img" aria-label={alt}>
              {slices.map((s, i) => (
                <img
                  key={s.src}
                  src={s.src}
                  width={s.width}
                  height={s.height}
                  alt=""
                  draggable={false}
                  loading="eager"
                  onLoad={() => markLoaded(i)}
                  onError={() => markLoaded(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScreenLayout>
  )
}
