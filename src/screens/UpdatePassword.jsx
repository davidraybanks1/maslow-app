import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Onboarding.module.css'

export default function UpdatePassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError('password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) {
      setError(err.message || 'something went wrong. please try again.')
    } else {
      navigate('/today')
    }
  }

  return (
    <div className={styles.qWrap} style={{ maxWidth: 480 }}>
      <div className={styles.qNum}>account</div>
      <div className={styles.qText}>update your password.</div>

      <form onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>new password</label>
          <input
            className={styles.input}
            type="password"
            placeholder="new password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>confirm new password</label>
          <input
            className={styles.input}
            type="password"
            placeholder="confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button
          type="submit"
          className="btn-primary"
          style={{ marginTop: 8 }}
          disabled={loading || !password || !confirm}
        >
          {loading ? 'updating…' : 'update password →'}
        </button>
      </form>

      <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
        ← back
      </button>
    </div>
  )
}
