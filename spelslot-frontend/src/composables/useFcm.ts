import { getToken, onMessage } from 'firebase/messaging'
import { getFirebaseMessaging } from '@/firebase'
import { notificationService } from '@/services/notificationService'
import { useNotificationsStore } from '@/stores/notifications'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

// Persisted across module lifetime so we only register once per page load.
let registered = false

export function useFcm() {
  async function init() {
    // Guard: only run once, requires browser support and a VAPID key
    if (registered) return
    if (!VAPID_KEY) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    const messaging = await getFirebaseMessaging()
    if (!messaging) return

    // Don't prompt again if already denied
    if (Notification.permission === 'denied') return

    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') return

      // Register the service worker that handles background messages
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      })

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      })

      await notificationService.registerFcmToken(token)
      registered = true

      // Refresh notification list when a message arrives while the app is open
      onMessage(messaging, () => {
        useNotificationsStore().load()
      })
    } catch (err) {
      console.warn('[fcm] init failed:', err)
    }
  }

  // Call this on logout so the token is removed from the backend
  async function cleanup(token?: string) {
    if (!token) return
    await notificationService.unregisterFcmToken(token)
    registered = false
  }

  return { init, cleanup }
}
