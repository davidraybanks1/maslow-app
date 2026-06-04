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
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.qWrap}>
        <div className={styles.qNum}>Account</div>
        <div className={styles.qText}>Update your password.</div>

        {success ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#1B3A2D', marginTop: 24 }}>
            Password updated.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>New password</label>
              <input
                className={styles.input}
                type="password"
                placeholder="New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Confirm new password</label>
              <input
                className={styles.input}
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
          </form>
        )}
      </div>

      <div className={styles.qFooter}>
        {!success && (
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !password || !confirm}
          >
            {loading ? 'Updating…' : 'Update password →'}
          </button>
        )}
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => navigate(-1)}>
          ← back
        </button>
      </div>
    </div>
  )
}
