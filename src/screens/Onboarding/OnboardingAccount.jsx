import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { signInNavRef, seedStarterContent, logSupabaseError } from '../../lib/store'
import ScreenLayout from './flow/ScreenLayout'
import styles from './OnboardingAccount.module.css'

// The last screen of onboarding: create the account, then save what the flow
// gathered: the needs sorted into modes (the canvas), starter practices, and
// the notes to self. Someone who already has an account signs in on /signin.
//   recommendation  { universal: {needId: mode}, personal: {needId: mode} }
//   practicesDraft  per-need practice overrides ({} keeps the starter set)
//   notes           the person's notes to self (array of strings; falls back to the starter three when empty)
//   onDone(destination, userId, canvasObj, seeded)

const MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']
const STARTER_NOTES = 3

// One dot per need, grouped by mode, drawn in the mode's own colour.
function SavingCard({ recommendation, notes }) {
  const modes = Object.values({ ...(recommendation?.universal || {}), ...(recommendation?.personal || {}) })
  if (modes.length === 0) return null
  const dots = MODE_ORDER.flatMap(m => modes.filter(x => x === m).map((_, i) => ({ m, i })))
  const noteCount = notes && notes.length ? notes.length : STARTER_NOTES
  return (
    <div className={styles.saving}>
      <div className={styles.dots} aria-hidden="true">
        {dots.map(d => <span key={`${d.m}-${d.i}`} className={`${styles.dot} ${styles[d.m]}`} />)}
      </div>
      <div className={styles.savingText}>
        {modes.length} {modes.length === 1 ? 'need' : 'needs'} {'·'} {noteCount} {noteCount === 1 ? 'note' : 'notes'} to self
      </div>
    </div>
  )
}

export default function OnboardingAccount({ destination, recommendation, practicesDraft, notes, onDone, onBack }) {
  const navigate = useNavigate()
  // Create form
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [duplicateAccount, setDuplicateAccount] = useState(false)
  const [showPw, setShowPw]       = useState(false)

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
      setError('Check your email to confirm your account, then sign in.')
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
        setError('Account setup didn’t complete. Please try again.')
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

  const canSubmit = name.trim() && email.trim() && password.length >= 8
  const submit = () => { if (canSubmit && !loading) handleSignUp() }

  return (
    <ScreenLayout
      cta={{ label: loading ? 'Creating your account…' : 'Create your account', disabled: !canSubmit || loading, onClick: submit }}
    >
      <div className={styles.wrap}>
        <button type="button" className={styles.back} onClick={onBack}>{'←'} Back</button>
        <h1 className={styles.title}>Save and get started.</h1>
        <p className={styles.sub}>Create your account with your needs and notes ready to go.</p>

        <SavingCard recommendation={recommendation} notes={notes} />

        <form className={styles.form} onSubmit={e => { e.preventDefault(); submit() }}>
          <input
            className={styles.input}
            type="text"
            placeholder="What should we call you?"
            aria-label="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
          />
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); setDuplicateAccount(false) }}
            autoComplete="email"
          />
          <div className={styles.pwWrap}>
            <input
              className={`${styles.input} ${styles.pwInput}`}
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="button" className={styles.pwToggle} onClick={() => setShowPw(v => !v)} aria-pressed={showPw}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className={styles.hint}>At least 8 characters.</div>
          <button type="submit" className={styles.srOnly} tabIndex={-1} aria-hidden="true" />
        </form>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {duplicateAccount && (
          <div className={styles.error} role="alert">
            That email already has an account.{' '}
            <button type="button" className={styles.link} onClick={() => navigate('/signin')}>Sign in instead</button>
          </div>
        )}

        <div className={styles.fine}>
          <p>Your answers stay yours. Never shared, never sold.</p>
          <p>
            Already have an account?{' '}
            <button type="button" className={styles.link} onClick={() => navigate('/signin')}>Sign in</button>
          </p>
        </div>
      </div>
    </ScreenLayout>
  )
}
