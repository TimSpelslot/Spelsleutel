import { Types } from 'mongoose'
import { getMessaging } from 'firebase-admin/messaging'
import { Notification, type NotificationType } from '../models/Notification'
import { User } from '../models/User'

const PREF_MAP: Partial<Record<NotificationType, 'notifySignup' | 'notifyAssignment' | 'notifyMarketplace' | 'notifySession'>> = {
  signup: 'notifySignup',
  assignment: 'notifyAssignment',
  marketplace: 'notifyMarketplace',
  session: 'notifySession',
}

// Sends FCM push to all registered tokens for a user.
// Cleans up invalid/expired tokens automatically.
async function sendPush(
  userId: Types.ObjectId,
  title: string,
  body: string,
  href?: string,
) {
  const user = await User.findById(userId).select('fcmTokens').lean()
  if (!user?.fcmTokens?.length) return

  try {
    const messaging = getMessaging()
    const result = await messaging.sendEachForMulticast({
      tokens: user.fcmTokens,
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        },
        fcmOptions: { link: href ?? '/' },
      },
    })

    // Remove tokens that are no longer valid
    const stale = user.fcmTokens.filter((_, i) => {
      const code = result.responses[i]?.error?.code
      return code === 'messaging/registration-token-not-registered' ||
             code === 'messaging/invalid-registration-token'
    })
    if (stale.length) {
      await User.findByIdAndUpdate(userId, { $pullAll: { fcmTokens: stale } })
    }
  } catch (err) {
    // Push failure must never block notification creation
    console.error('[fcm] sendPush failed:', err)
  }
}

// Creates a notification for a user, respecting their preferences.
// System notifications are always delivered.
// Sends FCM push fire-and-forget.
export async function createNotification(
  userId: Types.ObjectId,
  type: NotificationType,
  title: string,
  message: string,
  href?: string,
) {
  const prefField = PREF_MAP[type]
  if (prefField) {
    const user = await User.findById(userId).select(prefField).lean()
    if (!user || !user[prefField]) return null
  }

  const notification = await Notification.create({ userId, type, title, message, href })

  // Fire-and-forget — never awaited so it doesn't slow down the caller
  sendPush(userId, title, message, href).catch(() => {})

  return notification
}
