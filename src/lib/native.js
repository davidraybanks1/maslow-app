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
  } catch {}
}

/* Hide the native splash once the app (or the daily ritual) has rendered. */
export async function hideSplash() {
  if (!isNative()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {}
}

const REMINDER_IDS = [1001, 1002, 1003, 1004]

/* Daily mood prompts + the weekly review reminder.
   reviewDay is Monday-indexed (0=Mon..6=Sun); iOS weekday is 1=Sun..7=Sat. */
export async function scheduleReminders({ reviewDay = 0, reviewTime = '10:00' } = {}) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return

    await LocalNotifications.cancel({ notifications: REMINDER_IDS.map(id => ({ id })) })

    const [h, m] = (reviewTime || '10:00').split(':').map(n => parseInt(n, 10) || 0)
    const weekday = ((reviewDay + 1) % 7) + 1

    await LocalNotifications.schedule({
      notifications: [
        { id: 1001, title: 'mood', body: 'morning — how are you feeling?', schedule: { on: { hour: 9, minute: 0 } } },
        { id: 1002, title: 'mood', body: 'midday — how are you feeling?', schedule: { on: { hour: 13, minute: 0 } } },
        { id: 1003, title: 'mood', body: 'evening — how did today feel?', schedule: { on: { hour: 19, minute: 0 } } },
        { id: 1004, title: 'weekly review', body: 'your week is ready to look at.', schedule: { on: { weekday, hour: h, minute: m } } },
      ],
    })
  } catch {}
}
