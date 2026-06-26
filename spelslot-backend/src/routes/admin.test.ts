import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'
import { errorHandler } from '../middleware/errorHandler'

// requireAuth passthrough that attaches a principal (requireAdmin reads user.uid).
vi.mock('../middleware/auth', () => ({
  requireAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { uid: 'admin-uid', email: 'a@b.nl', name: 'Admin', picture: '' }
    next()
  },
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

const findOne = vi.fn()
const find = vi.fn()
const findByIdAndUpdate = vi.fn()
vi.mock('../models/User', () => ({
  User: {
    findOne: (...a: unknown[]) => findOne(...a),
    find: (...a: unknown[]) => find(...a),
    findByIdAndUpdate: (...a: unknown[]) => findByIdAndUpdate(...a),
  },
}))

import { adminRouter } from './admin'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/admin', adminRouter)
  app.use(errorHandler)
  return app
}

function lean(doc: unknown) {
  return { lean: () => Promise.resolve(doc) }
}

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    uid: 'u1',
    email: 'p@b.nl',
    name: 'Player',
    displayName: 'Player One',
    avatarUrl: undefined,
    role: 'PLAYER',
    isWorldbuilder: false,
    worldbuilderRequestPending: false,
    dndbeyondCharacterId: undefined,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function asAdmin() {
  findOne.mockReturnValueOnce(lean({ role: 'ADMIN' }))
}

beforeEach(() => {
  findOne.mockReset()
  find.mockReset()
  findByIdAndUpdate.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('admin guard (requireAdmin)', () => {
  it('should 403 when the requester is not an ADMIN', async () => {
    findOne.mockReturnValueOnce(lean({ role: 'PLAYER' }))

    const res = await request(makeApp()).get('/api/admin/users')

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ message: 'Admin access required' })
  })

  it('should 403 when no Mongo user exists for the principal', async () => {
    findOne.mockReturnValueOnce(lean(null))

    const res = await request(makeApp()).get('/api/admin/users')

    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/users', () => {
  it('should return serialized users for an admin', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    asAdmin()
    const user = makeUserDoc({ avatarUrl: 'pic.png' })
    find.mockReturnValue({ sort: () => Promise.resolve([user]) })

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/admin/users')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(1)
    expect(res.body.users[0]).toMatchObject({
      id: user._id.toString(),
      uid: 'u1',
      role: 'PLAYER',
      avatarUrl: 'pic.png',
    })
  })

  it('should map missing avatarUrl and dndbeyondCharacterId to null', async () => {
    asAdmin()
    find.mockReturnValue({ sort: () => Promise.resolve([makeUserDoc()]) })

    const res = await request(makeApp()).get('/api/admin/users')

    expect(res.body.users[0].avatarUrl).toBeNull()
    expect(res.body.users[0].dndbeyondCharacterId).toBeNull()
  })
})

describe('PATCH /api/admin/users/:id', () => {
  it('should 400 for an invalid ObjectId', async () => {
    asAdmin()

    const res = await request(makeApp()).patch('/api/admin/users/not-an-id').send({ role: 'DM' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Invalid user ID' })
  })

  it('should 400 when no updatable fields are provided', async () => {
    asAdmin()
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).patch(`/api/admin/users/${id}`).send({ nope: 1 })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'No updatable fields provided' })
  })

  it('should 404 when the target user does not exist', async () => {
    asAdmin()
    findByIdAndUpdate.mockResolvedValue(null)
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).patch(`/api/admin/users/${id}`).send({ role: 'DM' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'User not found' })
  })

  it('should update only the allowlisted fields and return the serialized user', async () => {
    asAdmin()
    const id = new Types.ObjectId()
    findByIdAndUpdate.mockResolvedValue(makeUserDoc({ _id: id, role: 'DM', isWorldbuilder: true }))

    const res = await request(makeApp())
      .patch(`/api/admin/users/${id.toString()}`)
      .send({ role: 'DM', isWorldbuilder: true, hacker: 'x' })

    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('DM')
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      id.toString(),
      { $set: { role: 'DM', isWorldbuilder: true } },
      { new: true },
    )
  })
})
