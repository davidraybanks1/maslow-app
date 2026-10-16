import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './Sheet.module.css'

// Bottom sheet. Rendered into <body> so no transformed ancestor can trap its
// fixed positioning. Escape and the scrim close it; focus moves in on open and
// returns to whatever opened it on close.
export default function Sheet({ label, onClose, children }) {
  const [on, setOn] = useState(false)
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement
    const raf = requestAnimationFrame(() => setOn(true))
    const t = setTimeout(() => { ref.current?.focus({ preventScroll: true }) }, 0)
    function onKey(e) { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      if (opener && typeof opener.focus === 'function') {
        try { opener.focus({ preventScroll: true }) } catch { /* element gone */ }
      }
    }
  }, [])

  return createPortal(
    <>
      <div className={`${styles.scrim} ${on ? styles.scrimOn : ''}`} onClick={() => closeRef.current()} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`${styles.sheet} ${on ? styles.sheetOn : ''}`}
        style={{ outline: 'none' }}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}
