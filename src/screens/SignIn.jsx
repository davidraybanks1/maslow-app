import { useState, useRef } from 'react'
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
  // Tracks whether a sign-in request is still in flight after the timeout fired.
  // Prevents a second submit from racing the first and blocks the retry button
  // while the original request is still pending.
  const pendingRef = useRef(false)

  async function handleSignIn(e) {
    e.preventDefault()
    // Drop the click if a request is already in flight (timeout fired but original
    // hasn't resolved yet — a second submit would race it).
    if (pendingRef.current) return

    setLoading(true)
    setError(null)
    pendingRef.current = true

    const TIMEOUT_MS = 5000
    const signInPromise = supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    const result = await Promise.race([
      signInPromise,
      new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), TIMEOUT_MS)),
    ])

    if (result?.timedOut) {
      // Show a retryable error but keep pendingRef true — the original request is
      // still in flight. If it eventually succeeds, onAuthStateChange will navigate
      // to /today and we clear the error so "retry" doesn't flash during navigation.
      // If it fails with an actual error, surface that instead.
      setLoading(false)
      setError('Sign-in is taking longer than expected — check your connection and retry.')
      signInPromise
        .then(({ error: err }) => {
          pendingRef.current = false
          if (err) {
            setError(err.message)
          } else {
            // Late success — onAuthStateChange handles navigation; clear the
            // error so the "retry" prompt doesn't show while the app transitions.
            setError(null)
          }
        })
        .catch(() => {
          pendingRef.current = false
          setError('Sign-in failed — please try again.')
        })
      return
    }

    pendingRef.current = false
    setLoading(false)
    const { error: err } = result
    if (err) setError(err.message)
    // on success the session is delivered via onAuthStateChange in store, which navigates to /today
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
