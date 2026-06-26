import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'
import { errorHandler } from '../middleware/errorHandler'

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { uid: 'u-uid', email: 'me@b.nl', name: 'Me', picture: '' }
    next()
  },
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

const userFindOne = vi.fn()
const userFindByIdAndUpdate = vi.fn()
vi.mock('../models/User', () => ({
  User: {
    findOne: (...a: unknown[]) => userFindOne(...a),
    findByIdAndUpdate: (...a: unknown[]) => userFindByIdAndUpdate(...a),
  },
}))

const notifFind = vi.fn()
const notifUpdateMany = vi.fn()
const notifFindOneAndUpdate = vi.fn()
const notifFindOneAndDelete = vi.fn()
vi.mock('../models/Notification', () => ({
  Notification: {
    find: (...a: unknown[]) => notifFind(...a),
    updateMany: (...a: unknown[]) => notifUpdateMany(...a),
    findOneAndUpdate: (...a: unknown[]) => notifFindOneAndUpdate(...a),
    findOneAndDelete: (...a: unknown[]) => notifFindOneAndDelete(...a),
  },
}))

import { notificationsRouter } from './notifications'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/notifications', notificationsRouter)
  app.use(errorHandler)
  return app
}

const USER_ID = new Types.ObjectId()

function lean(doc: unknown) {
  return { lean: () => Promise.resolve(doc) }
}

function asUser() {
  userFindOne.mockReturnValueOnce(lean({ _id: USER_ID }))
}

function noUser() {
  userFindOne.mockReturnValueOnce(lean(null))
}

beforeEach(() => {
  userFindOne.mockReset()
  userFindByIdAndUpdate.mockReset()
  notifFind.mockReset()
  notifUpdateMany.mockReset()
  notifFindOneAndUpdate.mockReset()
  notifFindOneAndDelete.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/notifications', () => {
  it('should 401 when the Mongo user is not found', async () => {
    noUser()

    const res = await request(makeApp()).get('/api/notifications')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ message: 'User not found' })
  })

  it('should return the most recent notifications for the user', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    asUser()
    notifFind.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([{ _id: 'n1' }]) }) }),
    })

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/notifications')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ notifications: [{ _id: 'n1' }] })
    expect(notifFind).toHaveBeenCalledWith({ userId: USER_ID })
  })
})

describe('PATCH /api/notifications/read-all', () => {
  it('should mark all unread notifications as read', async () => {
    asUser()
    notifUpdateMany.mockResolvedValue({})

    const res = await request(makeApp()).patch('/api/notifications/read-all')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(notifUpdateMany).toHaveBeenCalledWith(
      { userId: USER_ID, read: false },
      { $set: { read: true } },
    )
  })

  it('should 401 when the user is not found', async () => {
    noUser()

    const res = await request(makeApp()).patch('/api/notifications/read-all')

    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/notifications/:id/read', () => {
  it('should 400 for an invalid id', async () => {
    const res = await request(makeApp()).patch('/api/notifications/bad-id/read')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Invalid ID' })
  })

  it('should 404 when the notification is not owned/found', async () => {
    asUser()
    notifFindOneAndUpdate.mockReturnValue(lean(null))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).patch(`/api/notifications/${id}/read`)

    expect(res.status).toBe(404)
  })

  it('should mark a single notification as read', async () => {
    asUser()
    const id = new Types.ObjectId().toString()
    notifFindOneAndUpdate.mockReturnValue(lean({ _id: id, read: true }))

    const res = await request(makeApp()).patch(`/api/notifications/${id}/read`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ notification: { _id: id, read: true } })
  })
})

describe('POST /api/notifications/fcm-token', () => {
  it('should 400 when no token is provided', async () => {
    const res = await request(makeApp()).post('/api/notifications/fcm-token').send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'token is required' })
  })

  it('should add the token to the user via $addToSet', async () => {
    asUser()
    userFindByIdAndUpdate.mockResolvedValue({})

    const res = await request(makeApp())
      .post('/api/notifications/fcm-token')
      .send({ token: 'tok-1' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith(USER_ID, {
      $addToSet: { fcmTokens: 'tok-1' },
    })
  })
})

describe('DELETE /api/notifications/fcm-token', () => {
  it('should 400 when no token is provided', async () => {
    const res = await request(makeApp()).delete('/api/notifications/fcm-token').send({})

    expect(res.status).toBe(400)
  })

  it('should pull the token from the user', async () => {
    asUser()
    userFindByIdAndUpdate.mockResolvedValue({})

    const res = await request(makeApp())
      .delete('/api/notifications/fcm-token')
      .send({ token: 'tok-1' })

    expect(res.status).toBe(200)
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith(USER_ID, {
      $pull: { fcmTokens: 'tok-1' },
    })
  })
})

describe('DELETE /api/notifications/:id', () => {
  it('should 400 for an invalid id', async () => {
    const res = await request(makeApp()).delete('/api/notifications/bad-id')

    expect(res.status).toBe(400)
  })

  it('should 404 when the notification is not found', async () => {
    asUser()
    notifFindOneAndDelete.mockResolvedValue(null)
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).delete(`/api/notifications/${id}`)

    expect(res.status).toBe(404)
  })

  it('should delete an owned notification', async () => {
    asUser()
    const id = new Types.ObjectId().toString()
    notifFindOneAndDelete.mockResolvedValue({ _id: id })

    const res = await request(makeApp()).delete(`/api/notifications/${id}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(notifFindOneAndDelete).toHaveBeenCalledWith({ _id: id, userId: USER_ID })
  })
})
