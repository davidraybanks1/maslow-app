import { useState } from 'react'
import OtpSignInBlock from './OtpSignInBlock'

// Disclosure wrapper for the two OTP flows (sign-in by code, password reset).
// Default: two link buttons. Clicking one mounts that OtpSignInBlock and hides
// the other. Closing returns to the default. Lives in src/components/ so both
// SignIn.jsx and DiagnosticFlow.jsx can import it with their own CSS module
// classes passed as linkClass/hairlineClass.
export default function OtpDisclosure({ email, onSuccess, linkClass, hairlineClass }) {
  const [open, setOpen] = useState(null) // null | 'otp' | 'recovery'

  return (
    <>
      <div className={hairlineClass} />
      {open ? (
        <>
          <OtpSignInBlock
            key={open}
            initialEmail={email}
            type={open === 'recovery' ? 'recovery' : 'email'}
            onSuccess={open === 'recovery' ? onSuccess : undefined}
          />
          <div className={hairlineClass} />
          <button type="button" className={linkClass} onClick={() => setOpen(null)}>
            ← back to password sign-in
          </button>
        </>
      ) : (
        <>
          <button type="button" className={linkClass} onClick={() => setOpen('otp')}>
            email me a code instead
          </button>
          <div className={hairlineClass} />
          <button type="button" className={linkClass} onClick={() => setOpen('recovery')}>
            forgot your password?
          </button>
        </>
      )}
      <div className={hairlineClass} />
    </>
  )
}
