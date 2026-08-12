import { useState, useEffect, useRef } from 'react'

const TIMER_KEY = 'maslow_timer'

export const DURATION_OPTIONS = [10, 15, 30, 45]

function readTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeTimer(t) {
  try {
    if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t))
    else localStorage.removeItem(TIMER_KEY)
  } catch {}
}

export function computeRemaining(t) {
  if (!t) return 0
  if (t.pausedRemainingMs !== null && t.pausedRemainingMs !== undefined) {
    return Math.max(0, t.pausedRemainingMs)
  }
  if (t.startedAt !== null && t.startedAt !== undefined) {
    return Math.max(0, t.durationMs - (Date.now() - t.startedAt))
  }
  return 0
}

export function formatTimerTime(ms) {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function useTimer() {
  const [timer, setTimerRaw] = useState(null)
  const [fullScreen, setFullScreen] = useState(false)
  const [, setTick] = useState(0)
  const vibratedRef = useRef(false)

  function setTimer(t) {
    setTimerRaw(t)
    writeTimer(t)
  }

  useEffect(() => {
    const t = readTimer()
    if (!t) return
    const rem = computeRemaining(t)
    setTimerRaw(t)
    setFullScreen(true)
    if (rem === 0) vibratedRef.current = true
  }, [])

  const isRunning = !!timer &&
    timer.startedAt !== null &&
    timer.startedAt !== undefined &&
    timer.pausedRemainingMs === null

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setTick(n => n + 1), 100)
    return () => clearInterval(id)
  }, [isRunning])

  useEffect(() => {
    function onVisibility() { setTick(n => n + 1) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const remaining = computeRemaining(timer)
  const isDone = !!timer && remaining === 0

  useEffect(() => {
    if (isDone && !vibratedRef.current) {
      vibratedRef.current = true
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
    }
    if (!isDone) vibratedRef.current = false
  }, [isDone])

  function startTimer(minutes) {
    const durationMs = minutes * 60 * 1000
    setTimer({ durationMs, startedAt: Date.now(), pausedRemainingMs: null })
    setFullScreen(true)
  }

  function pauseTimer() {
    if (!timer) return
    const rem = computeRemaining(timer)
    setTimer({ durationMs: timer.durationMs, startedAt: null, pausedRemainingMs: rem })
  }

  function resumeTimer() {
    if (!timer || timer.pausedRemainingMs === null) return
    setTimer({ durationMs: timer.pausedRemainingMs, startedAt: Date.now(), pausedRemainingMs: null })
  }

  function endTimer() {
    writeTimer(null)
    setTimerRaw(null)
    setFullScreen(false)
    vibratedRef.current = false
  }

  function dismissModal() { setFullScreen(false) }

  const isPaused = !!timer &&
    timer.pausedRemainingMs !== null &&
    timer.pausedRemainingMs !== undefined

  return {
    timer,
    fullScreen,
    setFullScreen,
    isDone,
    remaining,
    isPaused,
    startTimer,
    pauseTimer,
    resumeTimer,
    endTimer,
    dismissModal,
  }
}
