import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Wordmark from '../components/Wordmark'
import PanelBack from '../components/PanelBack'
import styles from './SignIn.module.css'

// Set a new password: reached from the "forgot your password?" code flow and
// from the profile's account section. Shares the sign-in screen's look.
// `inPanel` is the desktop: the profile's "change password" opens in the side
// panel instead of taking the window, and hands back through onDone.
export default function UpdatePassword({ inPanel = false, onDone }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Your password needs at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords don’t match.')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } else {
      if (inPanel) onDone?.()
      else navigate('/today')
    }
  }

  return (
    <div className={`${styles.screen} ${inPanel ? styles.inPanel : ''}`}>
      {inPanel
        ? <PanelBack label="profile" onClick={() => onDone?.()} />
        : <button type="button" className={styles.back} onClick={() => navigate(-1)}>{'←'} Back</button>}

      {!inPanel && <div className={styles.mark}><Wordmark fit="medium" /></div>}

      <h1 className={styles.title}>Update your password.</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.pwWrap}>
          <input
            className={`${styles.input} ${styles.pwInput}`}
            type={showPw ? 'text' : 'password'}
            placeholder="New password"
            aria-label="New password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            autoComplete="new-password"
            autoFocus
            required
          />
          <button type="button" className={styles.pwToggle} onClick={() => setShowPw(v => !v)} aria-pressed={showPw}>
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          className={styles.input}
          type={showPw ? 'text' : 'password'}
          placeholder="Confirm new password"
          aria-label="Confirm new password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setError('') }}
          autoComplete="new-password"
          required
        />
        <div className={styles.hint}>At least 8 characters.</div>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <button className={styles.cta} type="submit" disabled={loading || !password || !confirm}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
