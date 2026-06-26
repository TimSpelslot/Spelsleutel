import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'
import { errorHandler } from '../middleware/errorHandler'

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { uid: 'u-uid', email: 'me@b.nl', name: 'Me', picture: 'pic.png' }
    next()
  },
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

const findOne = vi.fn()
const findOneAndUpdate = vi.fn()
vi.mock('../models/User', () => ({
  User: {
    findOne: (...a: unknown[]) => findOne(...a),
    findOneAndUpdate: (...a: unknown[]) => findOneAndUpdate(...a),
  },
}))

import { authRouter } from './auth'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use(errorHandler)
  return app
}

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    uid: 'u-uid',
    email: 'me@b.nl',
    name: 'Me',
    displayName: 'Me',
    avatarUrl: undefined,
    role: 'PLAYER',
    isWorldbuilder: false,
    worldbuilderRequestPending: false,
    dndbeyondCharacterId: undefined,
    notifySignup: true,
    notifyAssignment: true,
    notifyMarketplace: true,
    notifySession: true,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  findOne.mockReset()
  findOneAndUpdate.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  delete process.env.SPELSLOT_DEV_ADMIN
})

describe('PATCH /api/auth/me', () => {
  it('should 400 when displayName is missing or blank', async () => {
    const res = await request(makeApp()).patch('/api/auth/me').send({ displayName: '   ' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'displayName is required' })
  })

  it('should 404 when the user does not exist', async () => {
    findOneAndUpdate.mockResolvedValue(null)

    const res = await request(makeApp()).patch('/api/auth/me').send({ displayName: 'New Name' })

    expect(res.status).toBe(404)
  })

  it('should trim and persist the new displayName', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    findOneAndUpdate.mockResolvedValue(makeUserDoc({ displayName: 'New Name' }))

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).patch('/api/auth/me').send({ displayName: '  New Name  ' })

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body.displayName).toBe('New Name')
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { uid: 'u-uid' },
      { $set: { displayName: 'New Name' } },
      { new: true },
    )
  })
})

describe('PATCH /api/auth/me/preferences', () => {
  it('should 400 when no boolean preference fields are provided', async () => {
    const res = await request(makeApp())
      .patch('/api/auth/me/preferences')
      .send({ notifySignup: 'yes' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'No preference fields provided' })
  })

  it('should update only boolean preference fields', async () => {
    findOneAndUpdate.mockResolvedValue(makeUserDoc({ notifySignup: false }))

    const res = await request(makeApp())
      .patch('/api/auth/me/preferences')
      .send({ notifySignup: false, notifyMarketplace: 'bad' })

    expect(res.status).toBe(200)
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { uid: 'u-uid' },
      { $set: { notifySignup: false } },
      { new: true },
    )
  })

  it('should 404 when the user does not exist', async () => {
    findOneAndUpdate.mockResolvedValue(null)

    const res = await request(makeApp())
      .patch('/api/auth/me/preferences')
      .send({ notifySession: true })

    expect(res.status).toBe(404)
  })
})

describe('POST /api/auth/me/request-worldbuilder', () => {
  it('should 404 when the user does not exist', async () => {
    findOne.mockResolvedValue(null)

    const res = await request(makeApp()).post('/api/auth/me/request-worldbuilder')

    expect(res.status).toBe(404)
  })

  it('should 403 when the user is not a PLAYER', async () => {
    findOne.mockResolvedValue(makeUserDoc({ role: 'DM' }))

    const res = await request(makeApp()).post('/api/auth/me/request-worldbuilder')

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ message: 'Only players can request worldbuilder access' })
  })

  it('should 400 when the user is already a worldbuilder', async () => {
    findOne.mockResolvedValue(makeUserDoc({ role: 'PLAYER', isWorldbuilder: true }))

    const res = await request(makeApp()).post('/api/auth/me/request-worldbuilder')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Already a worldbuilder' })
  })

  it('should 400 when a request is already pending', async () => {
    findOne.mockResolvedValue(makeUserDoc({ role: 'PLAYER', worldbuilderRequestPending: true }))

    const res = await request(makeApp()).post('/api/auth/me/request-worldbuilder')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Request already pending' })
  })

  it('should set the pending flag and save when eligible', async () => {
    const user = makeUserDoc({ role: 'PLAYER' })
    findOne.mockResolvedValue(user)

    const res = await request(makeApp()).post('/api/auth/me/request-worldbuilder')

    expect(res.status).toBe(200)
    expect(user.worldbuilderRequestPending).toBe(true)
    expect(user.save).toHaveBeenCalledOnce()
  })
})

describe('POST /api/auth/sync', () => {
  it('should upsert the user and return the payload', async () => {
    findOneAndUpdate.mockResolvedValue(makeUserDoc())

    const res = await request(makeApp()).post('/api/auth/sync')

    expect(res.status).toBe(200)
    expect(res.body.uid).toBe('u-uid')
    const call = findOneAndUpdate.mock.calls[0]
    expect(call[0]).toEqual({ uid: 'u-uid' })
    expect(call[1].$set).toMatchObject({ email: 'me@b.nl', name: 'Me', avatarUrl: 'pic.png' })
    expect(call[1].$set.role).toBeUndefined()
  })

  it('should upgrade the user to ADMIN when SPELSLOT_DEV_ADMIN is true', async () => {
    process.env.SPELSLOT_DEV_ADMIN = 'true'
    findOneAndUpdate.mockResolvedValue(makeUserDoc({ role: 'ADMIN', isWorldbuilder: true }))

    await request(makeApp()).post('/api/auth/sync')

    const call = findOneAndUpdate.mock.calls[0]
    expect(call[1].$set).toMatchObject({ role: 'ADMIN', isWorldbuilder: true })
  })

  it('should delegate to the error handler when the upsert returns null', async () => {
    findOneAndUpdate.mockResolvedValue(null)

    const res = await request(makeApp()).post('/api/auth/sync')

    expect(res.status).toBe(500)
  })
})
