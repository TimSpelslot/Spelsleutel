import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ── mock the Mongoose models ───────────────────────────────────────────────
const userFindById = vi.fn()
const userFindByIdAndUpdate = vi.fn()
const notificationCreate = vi.fn()
vi.mock('../models/User', () => ({
  User: {
    findById: (...args: unknown[]) => userFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => userFindByIdAndUpdate(...args),
  },
}))
vi.mock('../models/Notification', () => ({
  Notification: { create: (...args: unknown[]) => notificationCreate(...args) },
}))

// ── mock the FCM boundary ───────────────────────────────────────────────────
const sendEachForMulticast = vi.fn()
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEachForMulticast }),
}))

import { createNotification } from './notifications'

// User.findById(...).select(...).lean() chain helper.
function selectLean(doc: unknown) {
  return { select: () => ({ lean: () => Promise.resolve(doc) }) }
}

const userId = new Types.ObjectId()

beforeEach(() => {
  userFindById.mockReset()
  userFindByIdAndUpdate.mockReset()
  notificationCreate.mockReset()
  sendEachForMulticast.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  userFindByIdAndUpdate.mockResolvedValue(undefined)
  notificationCreate.mockResolvedValue({ _id: 'n1' })
  sendEachForMulticast.mockResolvedValue({ responses: [] })
})

describe('createNotification', () => {
  it('should skip creation when the user has the matching preference disabled', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    userFindById.mockReturnValueOnce(selectLean({ notifySignup: false }))

    // ── act ───────────────────────────────────────────────────────────────
    const result = await createNotification(userId, 'signup', 'T', 'M')

    // ── assert ────────────────────────────────────────────────────────────
    expect(result).toBeNull()
    expect(notificationCreate).not.toHaveBeenCalled()
  })

  it('should skip creation when the user no longer exists', async () => {
    userFindById.mockReturnValueOnce(selectLean(null))

    const result = await createNotification(userId, 'assignment', 'T', 'M')

    expect(result).toBeNull()
    expect(notificationCreate).not.toHaveBeenCalled()
  })

  it('should create the notification when the preference is enabled', async () => {
    // pref lookup, then sendPush fcmTokens lookup
    userFindById
      .mockReturnValueOnce(selectLean({ notifyMarketplace: true }))
      .mockReturnValueOnce(selectLean({ fcmTokens: [] }))

    const result = await createNotification(userId, 'marketplace', 'Deal', 'Body', '/shop')

    expect(notificationCreate).toHaveBeenCalledWith({
      userId,
      type: 'marketplace',
      title: 'Deal',
      message: 'Body',
      href: '/shop',
    })
    expect(result).toEqual({ _id: 'n1' })
  })

  it('should always create a system notification (no preference gate)', async () => {
    userFindById.mockReturnValueOnce(selectLean({ fcmTokens: [] }))

    await createNotification(userId, 'system', 'T', 'M')

    expect(notificationCreate).toHaveBeenCalledOnce()
  })

  it('should send an FCM push to all registered tokens', async () => {
    userFindById.mockReturnValueOnce(selectLean({ fcmTokens: ['tok-a', 'tok-b'] }))
    sendEachForMulticast.mockResolvedValue({ responses: [{}, {}] })

    await createNotification(userId, 'system', 'Title', 'Message', '/x')
    // let the fire-and-forget push settle
    await new Promise((r) => setImmediate(r))

    expect(sendEachForMulticast).toHaveBeenCalledOnce()
    const arg = sendEachForMulticast.mock.calls[0][0]
    expect(arg.tokens).toEqual(['tok-a', 'tok-b'])
    expect(arg.notification).toEqual({ title: 'Title', body: 'Message' })
  })

  it('should prune stale tokens reported by FCM', async () => {
    userFindById.mockReturnValueOnce(selectLean({ fcmTokens: ['good', 'stale'] }))
    sendEachForMulticast.mockResolvedValue({
      responses: [{}, { error: { code: 'messaging/registration-token-not-registered' } }],
    })

    await createNotification(userId, 'system', 'T', 'M')
    await new Promise((r) => setImmediate(r))

    expect(userFindByIdAndUpdate).toHaveBeenCalledWith(userId, {
      $pullAll: { fcmTokens: ['stale'] },
    })
  })

  it('should not send a push when the user has no tokens', async () => {
    userFindById.mockReturnValueOnce(selectLean({ fcmTokens: [] }))

    await createNotification(userId, 'system', 'T', 'M')
    await new Promise((r) => setImmediate(r))

    expect(sendEachForMulticast).not.toHaveBeenCalled()
  })

  it('should still return the notification when the push throws', async () => {
    userFindById.mockReturnValueOnce(selectLean({ fcmTokens: ['t'] }))
    sendEachForMulticast.mockRejectedValue(new Error('fcm down'))

    const result = await createNotification(userId, 'system', 'T', 'M')
    await new Promise((r) => setImmediate(r))

    expect(result).toEqual({ _id: 'n1' })
  })
})
