import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendMagicLink } from '../lib/store'
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
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError('')
    const { error: err } = await sendMagicLink(email.trim().toLowerCase())
    setSending(false)
    if (err) {
      setError('Something went wrong. Please try again.')
    } else {
      setSent(true)
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

        {sent ? (
          <div className={styles.success}>
            Check your email — we sent a sign-in link to {email}
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
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
            <button className="btn-primary" type="submit" disabled={sending || !email.trim()}>
              {sending ? 'Sending…' : 'Send sign-in link →'}
            </button>
          </form>
        )}
      </div>

      <button className={styles.back} onClick={() => navigate('/onboarding')}>
        ← back to start
      </button>
    </div>
  )
}
