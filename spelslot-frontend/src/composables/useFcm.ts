import { getToken, onMessage } from 'firebase/messaging'
import { getFirebaseMessaging } from '@/firebase'
import { notificationService } from '@/services/notificationService'
import { useNotificationsStore } from '@/stores/notifications'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

let registered = false

async function register() {
  if (registered) return
  if (!VAPID_KEY) return
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return

  const messaging = await getFirebaseMessaging()
  if (!messaging) return

  try {
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    await notificationService.registerFcmToken(token)
    registered = true

    onMessage(messaging, () => {
      useNotificationsStore().load()
    })
  } catch (err) {
    console.warn('[fcm] register failed:', err)
  }
}

export function useFcm() {
  // Called on app layout mount — only registers if permission is already granted.
  // Never triggers the browser permission prompt.
  async function initIfAlreadyGranted() {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') await register()
  }

  // Called explicitly from the Notifications page when the user clicks "Enable".
  // Triggers the browser permission prompt if not yet asked.
  async function requestAndInit(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied'
    if (Notification.permission === 'denied') return 'denied'

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()

    if (permission === 'granted') await register()
    return permission
  }

  async function cleanup(token?: string) {
    if (!token) return
    await notificationService.unregisterFcmToken(token)
    registered = false
  }

  return { initIfAlreadyGranted, requestAndInit, cleanup }
}
