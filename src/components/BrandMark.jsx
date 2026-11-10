/* Brand mark B: the italic serif m standing on the space bar.
   `dark` renders for dark surfaces (cream m, cream tail segment). */
export default function BrandMark({ size = 22, dark = false }) {
  const ink = dark ? 'var(--loam-paper)' : 'var(--ink)'
  const tail = dark ? 'var(--loam-paper)' : 'var(--loam-ink)'
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden="true">
      <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300, fontSize: size, lineHeight: 1, color: ink }}>m</span>
      <svg
        width={Math.round(size * 1.15)}
        height={Math.max(3, Math.round(size * 0.2))}
        viewBox="0 0 56 12"
        preserveAspectRatio="none"
        style={{ marginTop: Math.max(2, Math.round(size * 0.12)), display: 'block' }}
      >
        <rect x="0" width="15" height="12" fill="var(--loam-exploration)" />
        <rect x="15" width="11" height="12" fill="var(--loam-appreciation)" />
        <rect x="26" width="9" height="12" fill="var(--loam-nourishment)" />
        <rect x="35" width="8" height="12" fill="var(--loam-survival)" />
        <rect x="43" width="13" height="12" fill={tail} />
      </svg>
    </span>
  )
}
