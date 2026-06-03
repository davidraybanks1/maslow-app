import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendMagicLink, signInWithPassword, signUpWithPassword } from '../lib/store'
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
  const [mode, setMode] = useState('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function switchMode(m) {
    setMode(m)
    setError('')
    setMessage('')
    setSent(false)
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await sendMagicLink(email.trim().toLowerCase())
    setLoading(false)
    if (err) {
      setError('Something went wrong. Please try again.')
    } else {
      setSent(true)
    }
  }

  async function handleSignIn(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    const { error: err } = await signInWithPassword(email.trim().toLowerCase(), password)
    setLoading(false)
    if (err) {
      setError(err.message || 'Invalid email or password.')
    }
    // on success, onAuthStateChange fires and navigates to /today
  }

  async function handleCreateAccount(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    const { error: err } = await signUpWithPassword(email.trim().toLowerCase(), password)
    setLoading(false)
    if (err) {
      setError(err.message || 'Could not create account. Please try again.')
    } else {
      setMessage('Account created — check your email to confirm.')
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <Logo />
        <div className={styles.wordmark}>maslow.</div>
      </div>

      <div className={styles.body}>
        <div className={styles.heading}>welcome back.</div>

        <div className={styles.toggle}>
          <button
            className={styles.toggleBtn}
            data-active={mode === 'magic'}
            onClick={() => switchMode('magic')}
          >
            Magic link
          </button>
          <button
            className={styles.toggleBtn}
            data-active={mode === 'password'}
            onClick={() => switchMode('password')}
          >
            Password
          </button>
        </div>

        {mode === 'magic' ? (
          sent ? (
            <div className={styles.success}>
              Check your email — we sent a sign-in link to {email}
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleMagicLink}>
              <input
                className={styles.input}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
              {error && <div className={styles.error}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={loading || !email.trim()}>
                {loading ? 'Sending…' : 'Send sign-in link →'}
              </button>
            </form>
          )
        ) : (
          message ? (
            <div className={styles.success}>{message}</div>
          ) : (
            <form className={styles.form} onSubmit={handleSignIn}>
              <input
                className={styles.input}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
              <input
                className={styles.input}
                type="password"
                placeholder="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              {error && <div className={styles.error}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={loading || !email.trim() || !password}>
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
              <button
                type="button"
                className={styles.ghost}
                disabled={loading || !email.trim() || !password}
                onClick={handleCreateAccount}
              >
                Create account →
              </button>
            </form>
          )
        )}
      </div>

      <button className={styles.back} onClick={() => navigate('/onboarding')}>
        ← back to start
      </button>
    </div>
  )
}
