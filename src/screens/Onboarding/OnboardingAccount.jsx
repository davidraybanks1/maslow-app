import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { signInNavRef, seedStarterContent, logSupabaseError } from '../../lib/store'
import OtpDisclosure from '../../components/OtpDisclosure'
import styles from './OnboardingAccount.module.css'

// The last screen of onboarding: create the account (or sign in), then save
// what the flow gathered: the canvas, starter practices, and the notes to self.
//   recommendation  { universal: {needId: mode}, personal: {needId: mode} }
//   practicesDraft  per-need practice overrides ({} keeps the starter set)
//   notes           the person's notes to self (array of strings; falls back to the starter three when empty)
//   onDone(destination, userId, canvasObj, seeded)

const CARD_MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

const MODE_COLORS = {
  exploration:  '#1B3A2D',
  appreciation: '#ABBEA3',
  nourishment:  '#F5B622',
  survival:     '#F55127',
}

// Daily practice count per mode (for the little canvas bar below).
const MODE_DAILY_PRACTICES = { exploration: 3, appreciation: 2, nourishment: 1, survival: 0.5 }

function canvasModeWeights(recommendation) {
  const weights = { exploration: 0, appreciation: 0, nourishment: 0, survival: 0 }
  for (const mode of Object.values({ ...recommendation.universal, ...recommendation.personal })) {
    if (weights[mode] != null) weights[mode] += MODE_DAILY_PRACTICES[mode] || 0.5
  }
  return weights
}

// Static mini bar — the thing being saved on the account screen.
function CanvasMiniBar({ recommendation }) {
  if (!recommendation) return null
  const weights = canvasModeWeights(recommendation)
  return (
    <div className={styles.miniBar} aria-hidden="true">
      {CARD_MODE_ORDER.map(m => weights[m] > 0 && (
        <div key={m} className={styles.miniBarSeg} style={{ flexGrow: weights[m], background: MODE_COLORS[m] }} />
      ))}
    </div>
  )
}

function ProgressBar({ pct }) {
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  )
}
export default function OnboardingAccount({ destination, recommendation, practicesDraft, notes, onDone, onBack }) {
  const navigate = useNavigate()
  const [mode, setMode]             = useState('create')

  // Create form
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  // Sign-in form
  const [siEmail, setSiEmail]       = useState('')
  const [siPassword, setSiPassword] = useState('')

  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [duplicateAccount, setDuplicateAccount] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    setError(null)
    setDuplicateAccount(false)
    signInNavRef.skip = true

    // Step 1: sign up — take user and session from the response directly.
    // A separate getUser() call can race before the new session is attached.
    const { data: signUpData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authErr) {
      signInNavRef.skip = false
      const msg = (authErr.message || '').toLowerCase()
      const isDuplicate = authErr.code === 'user_already_exists' || msg.includes('already registered') || msg.includes('already exists')
      if (isDuplicate) {
        setDuplicateAccount(true)
      } else {
        setError(authErr.message)
      }
      setLoading(false)
      return
    }

    // Step 2: email confirmation is enabled — no session, nothing authenticated can run.
    if (!signUpData.session) {
      signInNavRef.skip = false
      setLoading(false)
      setError('check your email to confirm your account, then sign in.')
      return
    }

    const userId = signUpData.user?.id
    let canvasObj = null

    if (userId && recommendation) {
      canvasObj = { ...recommendation.universal, ...recommendation.personal }
      const profileRow = {
        id: userId,
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        canvas: canvasObj,
        onboarded: true,
        onboarded_at: new Date().toLocaleDateString('en-CA'),
      }

      // Step 3: upsert the profile row; retry once on failure (session propagation lag).
      let { error: upsertErr } = await supabase.from('users').upsert(profileRow, { onConflict: 'id' })
      if (upsertErr) {
        logSupabaseError('handleSignUp upsert attempt 1', upsertErr)
        await new Promise(r => setTimeout(r, 400))
        const retry = await supabase.from('users').upsert(profileRow, { onConflict: 'id' })
        upsertErr = retry.error
        if (upsertErr) logSupabaseError('handleSignUp upsert attempt 2', upsertErr)
      }

      // Step 4: read the row back to confirm the write landed.
      const { data: confirmRow } = await supabase.from('users').select('id').eq('id', userId).maybeSingle()

      // Step 5: abort visibly if the profile row isn't there — a ghost account
      // that works on this device only is worse than a visible failure.
      if (!confirmRow) {
        signInNavRef.skip = false
        setLoading(false)
        setError('account setup didn\'t complete — please try again.')
        return
      }

      const seeded = await seedStarterContent(userId, canvasObj, practicesDraft, notes)
      setLoading(false)
      // Pass canvasObj and seeded rows so handleAccountDone can populate both
      // canvas and practicesDB in completeOnboarding before navigating.
      onDone(destination, userId, canvasObj, seeded)
      return
    }

    setLoading(false)
    onDone(destination, userId, canvasObj, null)
  }

  async function handleSignIn() {
    setLoading(true)
    setError(null)

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: siEmail.trim().toLowerCase(),
      password: siPassword,
    })

    if (authErr) {
      setError(authErr.message)
      setLoading(false)
      return
    }

    setLoading(false)
    // onAuthStateChange in store restores state and navigates to /today
  }

  if (mode === 'create') {
    const canSubmit = name.trim() && email.trim() && password.length >= 8

    return (
      <div className={styles.screen}>
        <ProgressBar pct={100} />
        <div className={styles.content}>
          <button className={styles.backBtn} onClick={onBack}>← back</button>
          <div className={styles.eyebrow}>SAVE YOUR CANVAS</div>
          <div className={styles.headline}>create your account.</div>
          <CanvasMiniBar recommendation={recommendation} />
          <div className={styles.sub}>your canvas, practices, and data are tied to your account.</div>

          <form className={styles.accountForm} onSubmit={e => { e.preventDefault(); if (canSubmit && !loading) handleSignUp() }}>
            <input
              className={styles.accountInput}
              type="text"
              placeholder="your name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
            <input
              className={styles.accountInput}
              type="email"
              placeholder="your email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); setDuplicateAccount(false) }}
              autoComplete="email"
            />
            <div>
              <input
                className={styles.accountInput}
                type="password"
                placeholder="create a password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <div className={styles.inputHintNote}>8+ characters</div>
            </div>
            <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
          </form>

          {error && <div className={styles.formError}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <div className={styles.privacyNote}>your answers stay yours — never shared, never sold.</div>
          <button className="btn-primary" onClick={handleSignUp} disabled={!canSubmit || loading}>
            {loading ? 'creating account…' : 'create account →'}
          </button>
          {duplicateAccount && (
            <div className={styles.duplicateNote}>
              looks like you already have an account. <span className={styles.duplicateLink} onClick={() => { setMode('signin'); setError(null); setDuplicateAccount(false) }}>sign in instead →</span>
            </div>
          )}
          <div className={styles.signInPrompt}>
            already have an account? <span className={styles.signInLink} onClick={() => { setMode('signin'); setError(null); setDuplicateAccount(false) }}>sign in →</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Sign-in mode ──
  const canSignIn = siEmail.trim() && siPassword.length > 0

  return (
    <div className={styles.screen}>
      <ProgressBar pct={100} />
      <div className={styles.content}>
        <div className={styles.eyebrow}>WELCOME BACK</div>
        <div className={styles.headline}>sign in.</div>
        <div className={styles.sub}>your canvas and data are waiting.</div>

        <div className={styles.accountForm}>
          <input
            className={styles.accountInput}
            type="email"
            placeholder="your email"
            value={siEmail}
            onChange={e => { setSiEmail(e.target.value); setError(null) }}
            autoComplete="email"
          />
          <input
            className={styles.accountInput}
            type="password"
            placeholder="your password"
            value={siPassword}
            onChange={e => { setSiPassword(e.target.value); setError(null) }}
            autoComplete="current-password"
          />
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <div className={styles.authSecondarySection}>
          <OtpDisclosure
            email={siEmail}
            onSuccess={() => navigate('/password')}
            linkClass={styles.authSecondaryLink}
            hairlineClass={styles.authHairline}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <button className="btn-primary" onClick={handleSignIn} disabled={!canSignIn || loading}>
          {loading ? 'signing in…' : 'sign in →'}
        </button>
        <div className={styles.authToggle} onClick={() => { setMode('create'); setError(null) }}>
          don't have an account? create one
        </div>
      </div>
    </div>
  )
}
