import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './SignIn.module.css'

function Logo() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="14" r="4" fill="#E8B81F"/>
      <circle cx="29" cy="28" r="4" fill="#1A1A1A"/>
      <circle cx="43" cy="28" r="4" fill="#1A1A1A"/>
      <circle cx="22" cy="42" r="4" fill="#1A1A1A"/>
      <circle cx="36" cy="42" r="4" fill="#1A1A1A"/>
      <circle cx="50" cy="42" r="4" fill="#1A1A1A"/>
      <circle cx="15" cy="56" r="4" fill="#1A1A1A"/>
      <circle cx="29" cy="56" r="4" fill="#1A1A1A"/>
      <circle cx="43" cy="56" r="4" fill="#1A1A1A"/>
      <circle cx="57" cy="56" r="4" fill="#1A1A1A"/>
    </svg>
  )
}

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [magicSent, setMagicSent]   = useState(false)
  const [resetSent, setResetSent]   = useState(false)

  async function handleSignIn(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    setLoading(false)
    if (err) setError(err.message)
    // on success, onAuthStateChange in store fires and navigates to /today
  }

  async function handleMagicLink() {
    if (!email.trim()) { setError('enter your email first'); return }
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: 'https://app.mymaslow.com' },
    })
    if (err) setError(err.message)
    else setMagicSent(true)
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('enter your email first'); return }
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'https://app.mymaslow.com/password' }
    )
    if (err) setError(err.message)
    else setResetSent(true)
  }

  const canSubmit = email.trim() && password.length > 0

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <Logo />
        <div className={styles.wordmark}>maslow.</div>
      </div>

      <div className={styles.body}>
        <div className={styles.heading}>sign in.</div>

        <form className={styles.form} onSubmit={handleSignIn}>
          <input
            className={styles.input}
            type="email"
            placeholder="your email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null) }}
            autoComplete="email"
            autoFocus
          />
          <input
            className={styles.input}
            type="password"
            placeholder="your password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null) }}
            autoComplete="current-password"
          />

          {error && <div className={styles.error}>{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading || !canSubmit}>
            {loading ? 'signing in…' : 'sign in →'}
          </button>
        </form>

        <div className={styles.secondary}>
          <div className={styles.hairline} />
          <div
            className={`${styles.secondaryLink} ${magicSent ? styles.secondaryConfirm : ''}`}
            onClick={!magicSent ? handleMagicLink : undefined}
          >
            {magicSent ? '✓ check your email for a sign-in link' : 'send a magic link instead'}
          </div>
          <div className={styles.hairline} />
          <div
            className={`${styles.secondaryLink} ${resetSent ? styles.secondaryConfirm : ''}`}
            onClick={!resetSent ? handleForgotPassword : undefined}
          >
            {resetSent ? '✓ check your email to reset your password' : 'forgot password?'}
          </div>
          <div className={styles.hairline} />
        </div>
      </div>

      <button className={styles.back} onClick={() => navigate('/onboarding')}>
        ← back to start
      </button>
    </div>
  )
}
