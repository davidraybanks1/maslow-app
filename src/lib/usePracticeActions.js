import { useState, useEffect, useRef, useCallback } from 'react'
import { hapticTick } from './native'
import { readProgress, writeProgress } from './practiceProgress'
import {
  configOf, isTally, boundaryPhase, nowMinutes, fmtTime,
  checklistRequired, tickCount, MAX_ITEMS,
} from './practiceTypes'

// Everything Today needs to show and change a typed practice, in one place so
// the mobile accordion and the desktop popup behave identically.
//
// A practice is "done" for the day when it has a check-in row. Each type just
// decides when that row appears and what goes in its `detail`:
//
//   check/ritual  a tap makes the row; a second tap makes it ×2; a third clears it
//   tally         taps count up to the target, then the row appears
//   timed         the circle logs the full length; "begin" runs the timer first
//   checklist     enough items ticked (or the circle tapped) makes the row
//   stretch       the circle opens a 0–10 slider; saving makes the row
//   boundary      the circle works once the window has ended

export function practiceKey(need, practice) {
  return practice.id || `${need.id}_${practice.label}`
}

function matches(entry, need, practice) {
  if (entry.need_id !== need.id) return false
  if (practice.id && entry.practice_id) return entry.practice_id === practice.id
  return entry.practice_text === practice.label
}

export function usePracticeActions({
  today, checked,
  checkIn, clearPracticeCheckins, incrementCheckinCount, setCheckinDetail,
}) {
  const [progress, setProgressState] = useState(() => readProgress(today))
  const [just, setJust] = useState(null)
  const [notice, setNotice] = useState(null)
  const [stretchFor, setStretchFor] = useState(null)
  const [timerFor, setTimerFor] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [nowMin, setNowMin] = useState(() => nowMinutes())
  const progressRef = useRef(progress)
  const noticeTimer = useRef(null)

  // Midnight: yesterday's half-finished tallies don't carry over.
  useEffect(() => {
    const next = readProgress(today)
    progressRef.current = next
    setProgressState(next)
  }, [today])

  useEffect(() => {
    const id = setInterval(() => setNowMin(nowMinutes()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  const setProgress = useCallback((key, value) => {
    const next = { ...progressRef.current }
    if (value == null) delete next[key]
    else next[key] = value
    progressRef.current = next
    setProgressState(next)
    writeProgress(today, next)
  }, [today])

  const say = useCallback(msg => {
    clearTimeout(noticeTimer.current)
    setNotice(msg)
    noticeTimer.current = setTimeout(() => setNotice(null), 3200)
  }, [])

  function entriesOf(need, practice) {
    return checked.filter(e => matches(e, need, practice))
  }

  // Everything a row needs to draw itself.
  function statusOf(need, practice) {
    const key = practiceKey(need, practice)
    const kind = practice.kind || 'check'
    const cfg = configOf(practice)
    const entries = entriesOf(need, practice)
    const entry = entries[entries.length - 1] || null
    const count = entries.reduce((s, e) => s + (e.count || 1), 0)
    const done = entries.length > 0
    const prog = progress[key] || {}
    const detail = entry?.detail || null
    const st = { key, kind, cfg, entry, count, done, just: just === key, prog, detail }

    if (kind === 'check' && cfg.target > 1) {
      st.tally = done ? cfg.target : (prog.tally || 0)
    }
    if (kind === 'checklist') {
      const items = cfg.reset === 'daily'
        ? (done && detail?.items?.length ? detail.items : (prog.items || cfg.items))
        : cfg.items
      const ticks = done ? (detail?.ticks || []) : (prog.ticks || [])
      st.items = items
      st.ticks = ticks
      st.manual = done ? !!detail?.manual : !!prog.manual
      st.required = checklistRequired(practice, items.length)
      st.ticked = tickCount(ticks, items.length)
    }
    if (kind === 'boundary') st.phase = boundaryPhase(cfg, nowMin)
    return st
  }

  // ── taps ────────────────────────────────────────────────────────────────

  function tapCycle(need, mode, practice, st) {
    // 0 → checked → ×2 → cleared: how every plain practice has always worked
    if (st.count === 0) {
      checkIn(need.id, practice.label, mode, undefined, practice.id)
      setJust(st.key)
    } else if (st.count === 1) {
      incrementCheckinCount(st.entry.id)
      setJust(st.key)
    } else {
      clearPracticeCheckins(need.id, practice.label)
      setJust(null)
    }
  }

  function clearDone(need, practice, st) {
    clearPracticeCheckins(need.id, practice.label)
    setProgress(st.key, null)
    setJust(null)
  }

  // Move a checklist between "in progress" (device only) and "done" (a row).
  function commitChecklist(need, mode, practice, st, { ticks, items, manual }) {
    const n = tickCount(ticks, items.length)
    const required = checklistRequired(practice, items.length)
    const doneNow = manual || n >= required
    const daily = st.cfg.reset === 'daily'
    const detail = {
      ticks: ticks.slice(0, items.length).map(Boolean),
      ...(daily ? { items } : {}),
      ...(manual ? { manual: true } : {}),
    }
    if (st.done) {
      if (doneNow) setCheckinDetail(st.entry.id, detail)
      else {
        clearPracticeCheckins(need.id, practice.label)
        setProgress(st.key, { ticks: detail.ticks, ...(daily ? { items } : {}) })
        setJust(null)
      }
    } else if (doneNow) {
      checkIn(need.id, practice.label, mode, undefined, practice.id, detail)
      setProgress(st.key, null)
      setJust(st.key)
    } else {
      setProgress(st.key, { ticks: detail.ticks, ...(daily ? { items } : {}) })
    }
  }

  function tap(need, mode, practice) {
    hapticTick()
    const st = statusOf(need, practice)
    switch (st.kind) {
      case 'check':
        if (isTally(practice)) {
          if (st.done) { clearDone(need, practice, st); return }
          const n = (st.prog.tally || 0) + 1
          if (n >= st.cfg.target) {
            checkIn(need.id, practice.label, mode, undefined, practice.id, { tally: st.cfg.target })
            setProgress(st.key, null)
            setJust(st.key)
          } else {
            setProgress(st.key, { tally: n })
          }
        } else {
          tapCycle(need, mode, practice, st)
        }
        return
      case 'ritual':
        tapCycle(need, mode, practice, st)
        return
      case 'timed':
        if (st.done) clearDone(need, practice, st)
        else {
          checkIn(need.id, practice.label, mode, undefined, practice.id, { minutes: st.cfg.minutes })
          setJust(st.key)
        }
        return
      case 'checklist':
        if (st.done) clearDone(need, practice, st)
        else commitChecklist(need, mode, practice, st, { ticks: st.ticks, items: st.items, manual: true })
        return
      case 'stretch':
        if (st.done) clearDone(need, practice, st)
        else setStretchFor({ need, mode, practice })
        return
      case 'boundary':
        if (st.done) { clearDone(need, practice, st); return }
        if (st.phase === 'ended') {
          checkIn(need.id, practice.label, mode, undefined, practice.id, { kept: true })
          setJust(st.key)
        } else {
          say(st.phase === 'in'
            ? `you can check this off once it ends at ${fmtTime(st.cfg.window.until)}`
            : `it begins at ${fmtTime(st.cfg.window.from)}`)
        }
        return
      default:
    }
  }

  function toggleItem(need, mode, practice, index) {
    hapticTick()
    const st = statusOf(need, practice)
    const ticks = st.items.map((_, i) => (i === index ? !st.ticks[i] : !!st.ticks[i]))
    // un-ticking something drops a manual "I did it" so the count is honest
    const manual = st.manual && ticks[index]
    commitChecklist(need, mode, practice, st, { ticks, items: st.items, manual })
  }

  function addItem(need, mode, practice, text) {
    const label = text.trim().slice(0, 60)
    const st = statusOf(need, practice)
    if (!label || st.cfg.reset !== 'daily' || st.items.length >= MAX_ITEMS) return false
    const items = [...st.items, label]
    commitChecklist(need, mode, practice, st, { ticks: st.ticks, items, manual: st.manual })
    return true
  }

  function saveStretch(level) {
    if (!stretchFor) return
    const { need, mode, practice } = stretchFor
    const st = statusOf(need, practice)
    if (st.done) setCheckinDetail(st.entry.id, { level })
    else checkIn(need.id, practice.label, mode, undefined, practice.id, { level })
    setJust(st.key)
    setExpanded(prev => ({ ...prev, [st.key]: true }))
    setStretchFor(null)
    say('stretch logged')
  }

  function openStretch(need, mode, practice) {
    setStretchFor({ need, mode, practice })
  }

  function beginTimer(need, mode, practice) {
    setTimerFor({ need, mode, practice })
  }

  function finishTimer() {
    if (!timerFor) return
    const { need, mode, practice } = timerFor
    const st = statusOf(need, practice)
    if (!st.done) {
      checkIn(need.id, practice.label, mode, undefined, practice.id, { minutes: st.cfg.minutes })
      setJust(st.key)
    }
    setTimerFor(null)
  }

  function toggleExpanded(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return {
    statusOf, tap, toggleItem, addItem,
    stretchFor, openStretch, closeStretch: () => setStretchFor(null), saveStretch,
    timerFor, beginTimer, endTimer: () => setTimerFor(null), finishTimer,
    expanded, toggleExpanded,
    notice, say,
  }
}
