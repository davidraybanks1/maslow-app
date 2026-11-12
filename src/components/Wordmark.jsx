import styles from './Wordmark.module.css'

/* The Loam wordmark as type: Bricolage Grotesque 800, tight, with a gold
   period. Sized by font-size (pass it or inherit it). Stands in for the old
   orb-pile mark wherever the brand is shown.

   The face is always drawn at its display cut (opsz 96, as the homepage's huge
   wordmark is), so the small marks are the same letters, not the looser
   small-size cut. That cut needs less negative tracking the smaller it is, or
   the letters touch: the tracking goes by the size the mark renders at.
     size  — a number in px: the tracking follows from it
     fit   — when the size comes from a CSS class instead: 'small' (40px and
             below), 'medium' (41–63px) or 'large' (64px and up, the default) */
const fitFor = px => (px <= 40 ? 'small' : px < 64 ? 'medium' : 'large')

export default function Wordmark({ size, fit, className = '' }) {
  const band = size ? fitFor(size) : fit || 'large'
  return (
    <span className={`${styles.mark} ${styles[band]} ${className}`} style={size ? { fontSize: size } : undefined}>
      loam<span className={styles.dot}>.</span>
    </span>
  )
}
