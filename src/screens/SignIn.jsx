import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoamMark from '../components/LoamMark'
import OtpDisclosure from '../components/OtpDisclosure'
import styles from './SignIn.module.css'

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
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
      <button type="button" className={styles.back} onClick={() => navigate('/onboarding')}>{'←'} Back</button>

      <div className={styles.mark}><LoamMark width={112} /></div>

      <h1 className={styles.title}>Welcome back.</h1>

      <form className={styles.form} onSubmit={handleSignIn}>
        <input
          className={styles.input}
          type="email"
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(null) }}
          autoComplete="email"
        />
        <div className={styles.pwWrap}>
          <input
            className={`${styles.input} ${styles.pwInput}`}
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null) }}
            autoComplete="current-password"
          />
          <button type="button" className={styles.pwToggle} onClick={() => setShowPw(v => !v)} aria-pressed={showPw}>
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <button className={styles.cta} type="submit" disabled={loading || !canSubmit}>
          {loading ? 'Signing in…' : 'Sign in'}
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

      <p className={styles.fine}>
        New here?{' '}
        <button type="button" className={styles.link} onClick={() => navigate('/onboarding')}>Create an account</button>
      </p>
    </div>
  )
}
