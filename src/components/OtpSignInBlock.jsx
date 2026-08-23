import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './OtpSignInBlock.module.css'

export default function OtpSignInBlock({ initialEmail = '' }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(initialEmail)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function sendCode(e) {
    e?.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (err) {
      const msg = err.message || ''
      setError(msg.toLowerCase().includes('rate') ? 'too many requests — try again shortly' : msg)
    } else {
      setStep('code')
    }
  }

  async function verify(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    })
    setLoading(false)
    if (err) setError(err.message)
    // success: onAuthStateChange in store handles navigation
  }

  if (step === 'code') {
    return (
      <div className={styles.block}>
        <p className={styles.prompt}>enter the code we sent to {email}</p>
        <form className={styles.form} onSubmit={verify}>
          <input
            className={styles.codeInput}
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            maxLength={6}
            value={token}
            onChange={e => { setToken(e.target.value.replace(/\D/g, '')); setError(null) }}
            autoFocus
            autoComplete="one-time-code"
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading || token.length !== 6}>
            {loading ? 'verifying…' : 'verify →'}
          </button>
        </form>
        <div className={styles.links}>
          <span className={styles.link} role="button" tabIndex={0} onClick={() => !loading && sendCode()}>resend</span>
          <span className={styles.sep}>·</span>
          <span className={styles.link} role="button" tabIndex={0} onClick={() => { setStep('email'); setToken(''); setError(null) }}>use a different email</span>
        </div>
      </div>
    )
  }

  return (
    <form className={styles.block} onSubmit={sendCode}>
      <input
        className={styles.input}
        type="email"
        placeholder="your email"
        value={email}
        onChange={e => { setEmail(e.target.value); setError(null) }}
        autoComplete="email"
      />
      {error && <p className={styles.error}>{error}</p>}
      <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading || !email.trim()}>
        {loading ? 'sending…' : 'email me a code'}
      </button>
    </form>
  )
}
