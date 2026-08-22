// Native-shell helpers (Capacitor). Every function is a safe no-op on the web,
// so the PWA keeps today's behavior and the iOS app gets the native extras.
import { Capacitor } from '@capacitor/core'

export function isNative() {
  return Capacitor.isNativePlatform()
}

/* Light haptic tick — used on practice check-ins. */
export async function hapticTick() {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch (e) { console.warn('[native]', e) }
}

/* Hide the native splash once the app (or the daily ritual) has rendered. */
export async function hideSplash() {
  if (!isNative()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch (e) { console.warn('[native]', e) }
}

/* Returns 'granted' | 'denied' | 'prompt'. No-ops to 'prompt' on web. */
export async function checkNotifPermission() {
  if (!isNative()) return 'prompt'
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'granted') return 'granted'
    if (perm.display === 'denied') return 'denied'
    return 'prompt'
  } catch (e) { console.warn('[native]', e); return 'prompt' }
}

/* Requests OS permission. Returns 'granted' | 'denied' | 'prompt'. No-ops to 'prompt' on web. */
export async function requestNotifPermission() {
  if (!isNative()) return 'prompt'
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display === 'granted') return 'granted'
    if (perm.display === 'denied') return 'denied'
    return 'prompt'
  } catch (e) { console.warn('[native]', e); return 'prompt' }
}

const REMINDER_IDS = [1001, 1002, 1003, 1004]
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const DEFAULT_MOOD_REMINDERS = {
  morning: { on: true, time: '09:00' },
  midday:  { on: true, time: '13:00' },
  evening: { on: true, time: '19:00' },
}

const MOOD_SLOTS = [
  { slot: 'morning', id: 1001, body: 'morning — how are you feeling?' },
  { slot: 'midday',  id: 1002, body: 'midday — how are you feeling?' },
  { slot: 'evening', id: 1003, body: 'evening — how did today feel?' },
]

/* Daily mood prompts + the weekly/daily review reminder.
   reviewDay is Monday-indexed (0=Mon..6=Sun); iOS weekday is 1=Sun..7=Sat. */
export async function scheduleReminders({
  remindersEnabled,
  moodReminders = DEFAULT_MOOD_REMINDERS,
  reviewReminderEnabled = true,
  reviewCadence = 'weekly',
  reviewDay = 0,
  reviewTime = '10:00',
} = {}) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return

    await LocalNotifications.cancel({ notifications: REMINDER_IDS.map(id => ({ id })) })

    if (!remindersEnabled) return

    const moodNotifs = MOOD_SLOTS
      .filter(s => moodReminders[s.slot]?.on)
      .filter(s => {
        const t = moodReminders[s.slot]?.time
        if (!TIME_RE.test(t)) {
          console.warn(`[native] skipping ${s.slot} reminder — invalid time: ${JSON.stringify(t)}`)
          return false
        }
        return true
      })
      .map(s => {
        const [h, m] = moodReminders[s.slot].time.split(':').map(n => parseInt(n, 10))
        return { id: s.id, title: 'mood', body: s.body, schedule: { on: { hour: h, minute: m } } }
      })

    const reviewNotifs = []
    if (reviewReminderEnabled) {
      if (!TIME_RE.test(reviewTime)) {
        console.warn(`[native] skipping review reminder — invalid time: ${JSON.stringify(reviewTime)}`)
      } else {
        const [h, m] = reviewTime.split(':').map(n => parseInt(n, 10))
        const on = reviewCadence === 'daily'
          ? { hour: h, minute: m }
          : { weekday: ((reviewDay + 1) % 7) + 1, hour: h, minute: m }
        reviewNotifs.push({
          id: 1004,
          title: reviewCadence === 'daily' ? 'daily review' : 'weekly review',
          body: reviewCadence === 'daily' ? 'your day is ready to look at.' : 'your week is ready to look at.',
          schedule: { on },
        })
      }
    }

    const notifications = [...moodNotifs, ...reviewNotifs]
    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
    }
  } catch (e) { console.warn('[native]', e) }
}
