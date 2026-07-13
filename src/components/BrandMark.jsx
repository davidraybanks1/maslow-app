/* Brand mark B: the italic serif m standing on the space bar.
   `dark` renders for dark surfaces (cream m, cream tail segment). */
export default function BrandMark({ size = 22, dark = false }) {
  const ink = dark ? '#F5F3ED' : 'var(--ink)'
  const tail = dark ? '#F5F3ED' : '#1A1A18'
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden="true">
      <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: size, lineHeight: 1, color: ink }}>m</span>
      <svg
        width={Math.round(size * 1.15)}
        height={Math.max(3, Math.round(size * 0.2))}
        viewBox="0 0 56 12"
        preserveAspectRatio="none"
        style={{ marginTop: Math.max(2, Math.round(size * 0.12)), display: 'block' }}
      >
        <rect x="0" width="15" height="12" fill="#1B3A2D" />
        <rect x="15" width="11" height="12" fill="#B8C3B1" />
        <rect x="26" width="9" height="12" fill="#E8B81F" />
        <rect x="35" width="8" height="12" fill="#D93B1C" />
        <rect x="43" width="13" height="12" fill={tail} />
      </svg>
    </span>
  )
}
