import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { NEEDS, MODE_ORDER, MODES, MODE_NEED_CAP, MODE_DESCS, MODE_MAX_BUBBLES } from '../lib/constants'
import { canPlace } from '../lib/canvasRules'
import { useNeedDrag } from '../lib/useNeedDrag'
import Sheet from '../components/Sheet'
import styles from './CanvasScreen.module.css'

// Needs: which mode each need is in right now. Drag a need into a mode, or back
// to the library to take it out of play. Tapping a need opens a list instead,
// for anyone who'd rather not drag. Practices live on their own page.

const needName = id => NEEDS.find(n => n.id === id)?.name || id

export default function CanvasScreen({ state, updateCanvas }) {
  const navigate = useNavigate()
  const location = useLocation()
  const canvas = state.canvas || {}

  const [moving, setMoving] = useState(null)   // need id: "move {need} to…"
  const [filling, setFilling] = useState(null) // mode: "add a need to {mode}"
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)
  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  function say(msg) {
    clearTimeout(noticeTimer.current)
    setNotice(msg)
    noticeTimer.current = setTimeout(() => setNotice(null), 3600)
  }

  // Everything that moves a need goes through here, so a drag, the list and the
  // slot picker all follow the same rules and bounce back the same way.
  function place(needId, target) {
    const res = canPlace(needId, target, canvas)
    if (!res.ok) { say(res.reason); return false }
    if (res.noop) return true
    Promise.resolve(updateCanvas(needId, target)).catch(() => say("couldn't save that move. try again."))
    return true
  }

  const { drag, chipProps } = useNeedDrag({
    onDrop: (id, over) => {
      if (over == null) return
      place(id, over === 'library' ? null : over)
    },
  })

  const placedIn = mode => NEEDS.filter(n => canvas[n.id] === mode)
  const library = NEEDS.filter(n => !canvas[n.id])

  function handleClose() {
    navigate(location.state?.returnTo || '/today', location.state?.fromProfile ? { state: { openProfile: true } } : undefined)
  }

  // How a mode card (or the library) looks while a chip is held over it.
  function zoneClass(key) {
    if (!drag || drag.over !== key) return ''
    const target = key === 'library' ? null : key
    return canPlace(drag.id, target, canvas).ok ? styles.over : styles.overBad
  }

  function chip(need, variant) {
    const held = drag?.id === need.id
    return (
      <button
        key={need.id}
        type="button"
        data-need={need.id}
        className={`${variant === 'row' ? styles.row : styles.pill} ${held ? styles.held : ''}`}
        {...chipProps(need.id, need.name, id => setMoving(id))}
      >
        <span className={styles.chipName}>{need.name}</span>
        {variant === 'row' && <span className={styles.grip} aria-hidden="true" />}
      </button>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>needs.</h1>
          <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="close needs">✕</button>
        </div>
        <p className={styles.sub}>drag each need into the mode that fits it right now. or tap one to pick from a list.</p>
      </div>

      <div className={styles.body}>
        <section
          data-drop="library"
          aria-label="needs library"
          className={`${styles.library} ${zoneClass('library')}`}
        >
          <div className={styles.zoneHead}>
            <span className={styles.zoneName}>library</span>
            <span className={styles.zoneCount}>
              {library.length === 0 ? 'every need is in a mode' : `${library.length} not in a mode`}
            </span>
          </div>
          {library.length > 0 && (
            <div className={styles.pills}>
              {library.map(n => chip(n, 'pill'))}
            </div>
          )}
          <p className={styles.note}>drop a need here to take it out. its practices and history are kept.</p>
        </section>

        {MODE_ORDER.map(mode => {
          const placed = placedIn(mode)
          const cap = MODE_NEED_CAP[mode]
          const perDay = MODE_MAX_BUBBLES[mode]
          const open = placed.length < cap ? 1 : 0 // one open slot is enough; the count says how many fit
          return (
            <section
              key={mode}
              data-drop={mode}
              aria-label={mode}
              className={`${styles.card} ${zoneClass(mode)}`}
              style={{ '--mc': MODES[mode].color }}
            >
              <div className={styles.zoneHead}>
                <span className={styles.dot} />
                <span className={styles.zoneName}>{mode}</span>
                <span className={styles.zoneCount}>{placed.length} of {cap}</span>
              </div>
              <p className={styles.blurb}>
                {MODE_DESCS[mode]} · {perDay} {perDay === 1 ? 'practice' : 'practices'} a day each
              </p>
              <div className={styles.slots}>
                {placed.map(n => chip(n, 'row'))}
                {Array.from({ length: open }, (_, i) => (
                  <button
                    key={`open-${i}`}
                    type="button"
                    className={styles.openSlot}
                    onClick={() => setFilling(mode)}
                    aria-label={`add a need to ${mode}`}
                  >
                    {i === 0 && <span>drop a need here</span>}
                    {i === 0 && <span className={styles.plus} aria-hidden="true">+</span>}
                  </button>
                ))}
              </div>
            </section>
          )
        })}

        <button
          type="button"
          className={styles.practicesLink}
          onClick={() => navigate('/practices', { state: location.state })}
        >
          next: set the practices for each need →
        </button>
      </div>

      <div className={styles.live} role="status" aria-live="polite">
        {notice && <div className={styles.notice}>{notice}</div>}
      </div>

      {moving && (
        <Sheet label={`move ${needName(moving)}`} onClose={() => setMoving(null)}>
          <h2 className={styles.sheetTitle}>move {needName(moving)} to</h2>
          <div className={styles.choices}>
            {MODE_ORDER.map(m => {
              const here = canvas[moving] === m
              const res = canPlace(moving, m, canvas)
              const hint = here ? 'here'
                : !res.ok ? (moving === 'rest' && (m === 'exploration' || m === 'appreciation') ? 'not for rest' : 'full')
                : `${placedIn(m).length} of ${MODE_NEED_CAP[m]}`
              return (
                <button
                  key={m}
                  type="button"
                  className={styles.choice}
                  style={{ '--mc': MODES[m].color }}
                  aria-pressed={here}
                  disabled={!here && !res.ok}
                  onClick={() => { if (!here) place(moving, m); setMoving(null) }}
                >
                  <span className={styles.dot} />
                  <span className={styles.choiceName}>{m}</span>
                  <span className={styles.choiceHint}>{hint}</span>
                </button>
              )
            })}
            {canvas[moving] && (
              <button
                type="button"
                className={styles.choice}
                disabled={!canPlace(moving, null, canvas).ok}
                onClick={() => { place(moving, null); setMoving(null) }}
              >
                <span className={styles.choiceName}>back to the library</span>
                <span className={styles.choiceHint}>
                  {canPlace(moving, null, canvas).ok ? 'practices kept' : 'always on your canvas'}
                </span>
              </button>
            )}
          </div>
          <button type="button" className={styles.sheetCancel} onClick={() => setMoving(null)}>cancel</button>
        </Sheet>
      )}

      {filling && (
        <Sheet label={`add a need to ${filling}`} onClose={() => setFilling(null)}>
          <h2 className={styles.sheetTitle}>add a need to {filling}</h2>
          {library.length === 0 ? (
            <p className={styles.sheetNote}>every need is already in a mode. drag one out of its mode to move it.</p>
          ) : (
            <div className={styles.choices}>
              {library.map(n => {
                const res = canPlace(n.id, filling, canvas)
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={styles.choice}
                    style={{ '--mc': MODES[filling].color }}
                    disabled={!res.ok}
                    onClick={() => { place(n.id, filling); setFilling(null) }}
                  >
                    <span className={styles.choiceName}>{n.name}</span>
                    {!res.ok && <span className={styles.choiceHint}>not for {filling}</span>}
                  </button>
                )
              })}
            </div>
          )}
          <button type="button" className={styles.sheetCancel} onClick={() => setFilling(null)}>cancel</button>
        </Sheet>
      )}

      {drag && createPortal(
        <div
          className={styles.ghost}
          style={{ width: drag.w, height: drag.h, transform: `translate(${drag.x - drag.ox}px, ${drag.y - drag.oy}px) scale(1.04)` }}
          aria-hidden="true"
        >
          {drag.label}
        </div>,
        document.body,
      )}
    </div>
  )
}
