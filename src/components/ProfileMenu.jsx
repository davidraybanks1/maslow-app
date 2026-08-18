import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './ProfileMenu.module.css'

export default function ProfileMenu({ name, email, dropUp = false }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const wrapperRef = useRef(null)

  const initial = ((name || email || '').trim()[0] || '?').toUpperCase()

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    navigate('/signin')
  }

  useEffect(() => {
    if (!open) return

    function onOutside(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        className={`${styles.avatar} ${open ? styles.avatarOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <>
          <div className={styles.scrim} onClick={() => setOpen(false)} />
          <div className={`${styles.menu} ${dropUp ? styles.menuDropUp : ''}`}>
            <NavLink to="/settings" className={styles.menuItem} onClick={() => setOpen(false)}>settings</NavLink>
            <button className={`${styles.menuItem} ${styles.menuItemBtn}`} onClick={handleSignOut}>sign out</button>
            <div className={styles.version}>v1.0</div>
          </div>
        </>
      )}
    </div>
  )
}
