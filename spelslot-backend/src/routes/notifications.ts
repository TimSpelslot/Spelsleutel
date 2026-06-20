import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { Notification } from '../models/Notification'
import { User } from '../models/User'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth)

async function mongoUser(uid: string) {
  return User.findOne({ uid }).lean()
}

// ── GET /api/notifications ───────────────────────────────────────────────
// Returns most recent 50 notifications for the authenticated user.
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const user = await mongoUser((req as AuthRequest).user!.uid)
    if (!user) { res.status(401).json({ message: 'User not found' }); return }

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    res.json({ notifications })
  } catch (err) { next(err) }
})

// ── PATCH /api/notifications/read-all ───────────────────────────────────
notificationsRouter.patch('/read-all', async (req, res, next) => {
  try {
    const user = await mongoUser((req as AuthRequest).user!.uid)
    if (!user) { res.status(401).json({ message: 'User not found' }); return }

    await Notification.updateMany({ userId: user._id, read: false }, { $set: { read: true } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── PATCH /api/notifications/:id/read ───────────────────────────────────
notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }

    const user = await mongoUser((req as AuthRequest).user!.uid)
    if (!user) { res.status(401).json({ message: 'User not found' }); return }

    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { $set: { read: true } },
      { new: true },
    ).lean()

    if (!n) { res.status(404).json({ message: 'Notification not found' }); return }
    res.json({ notification: n })
  } catch (err) { next(err) }
})

// ── POST /api/notifications/fcm-token ───────────────────────────────────
// Registers an FCM token for the current user (upserts to avoid duplicates).
notificationsRouter.post('/fcm-token', async (req, res, next) => {
  try {
    const { token } = req.body
    if (!token || typeof token !== 'string') {
      res.status(400).json({ message: 'token is required' }); return
    }
    const user = await mongoUser((req as AuthRequest).user!.uid)
    if (!user) { res.status(401).json({ message: 'User not found' }); return }

    await User.findByIdAndUpdate(user._id, { $addToSet: { fcmTokens: token } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── DELETE /api/notifications/fcm-token ─────────────────────────────────
// Removes an FCM token (called on logout or permission revoked).
notificationsRouter.delete('/fcm-token', async (req, res, next) => {
  try {
    const { token } = req.body
    if (!token || typeof token !== 'string') {
      res.status(400).json({ message: 'token is required' }); return
    }
    const user = await mongoUser((req as AuthRequest).user!.uid)
    if (!user) { res.status(401).json({ message: 'User not found' }); return }

    await User.findByIdAndUpdate(user._id, { $pull: { fcmTokens: token } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── DELETE /api/notifications/:id ───────────────────────────────────────
notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }

    const user = await mongoUser((req as AuthRequest).user!.uid)
    if (!user) { res.status(401).json({ message: 'User not found' }); return }

    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, userId: user._id })
    if (!deleted) { res.status(404).json({ message: 'Notification not found' }); return }
    res.json({ success: true })
  } catch (err) { next(err) }
})
