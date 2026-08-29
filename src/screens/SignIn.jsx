import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BrandMark from '../components/BrandMark'
import OtpDisclosure from '../components/OtpDisclosure'
import styles from './SignIn.module.css'

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
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

  const canSubmit = email.trim() && password.length > 0

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <BrandMark size={56} />
        <div className={styles.wordmark}>maslow<span className={styles.wordmarkDot}>.</span></div>
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
          <OtpDisclosure
            email={email}
            onSuccess={() => navigate('/password')}
            linkClass={styles.secondaryLink}
            hairlineClass={styles.hairline}
          />
        </div>
      </div>

      <button className={styles.back} onClick={() => navigate('/onboarding')}>
        ← back to start
      </button>

    </div>
  )
}
