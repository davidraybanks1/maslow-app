import { useEffect, useRef } from 'react'
import styles from './DesktopModal.module.css'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusable(el) {
  return el ? Array.from(el.querySelectorAll(FOCUSABLE)) : []
}

/**
 * Shared desktop modal shell — scrim + centred card + focus trap.
 *
 * onClose   — called by the × button (always immediate, no confirm)
 * onDismiss — called by Escape / scrim click (caller handles confirm)
 * cardStyle — inline style on the card (use for clay background on timer)
 * lightScrim — use 0.25 opacity instead of 0.35 (timer use)
 */
export default function DesktopModal({ onClose, onDismiss, title, cardStyle, lightScrim, children }) {
  const cardRef = useRef(null)
  const triggerRef = useRef(null)

  // Focus management: move in on mount, return on unmount
  useEffect(() => {
    triggerRef.current = document.activeElement
    const focusable = getFocusable(cardRef.current)
    requestAnimationFrame(() => {
      if (focusable[0]) focusable[0].focus()
    })
    return () => {
      triggerRef.current?.focus()
    }
  }, [])

  // Keyboard: Escape dismisses, Tab cycles within modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss?.()
        return
      }
      if (e.key === 'Tab') {
        const focusable = getFocusable(cardRef.current)
        if (!focusable.length) { e.preventDefault(); return }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  return (
    <div
      className={`${styles.scrim} ${lightScrim ? styles.scrimLight : ''}`}
      onClick={onDismiss}
    >
      <div
        ref={cardRef}
        className={styles.card}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <button className={styles.closeBtn} onClick={onClose} aria-label="close">
          ×
        </button>
        {children}
      </div>
    </div>
  )
}
