import styles from './Wordmark.module.css'

/* The Loam wordmark as type: Bricolage Grotesque 800, tight, with a gold
   period. Sized by font-size (pass it or inherit it). Stands in for the old
   orb-pile mark wherever the brand is shown. */
export default function Wordmark({ size, className = '' }) {
  return (
    <span className={`${styles.mark} ${className}`} style={size ? { fontSize: size } : undefined}>
      loam<span className={styles.dot}>.</span>
    </span>
  )
}
