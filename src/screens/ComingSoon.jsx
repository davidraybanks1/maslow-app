import { useNavigate } from 'react-router-dom'

export default function ComingSoon({ title }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '48px 24px 32px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink3)', cursor: 'pointer', padding: 0, textAlign: 'left', marginBottom: 32 }}
      >
        ← back
      </button>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 12 }}>{title}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink3)' }}>Coming soon.</div>
    </div>
  )
}
