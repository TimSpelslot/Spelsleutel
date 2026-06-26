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

const entryFindOneAndUpdate = vi.fn()
const entryFindOne = vi.fn()
vi.mock('../models/WorldEntry', () => ({
  WorldEntry: {
    findOneAndUpdate: (...a: unknown[]) => entryFindOneAndUpdate(...a),
    findOne: (...a: unknown[]) => entryFindOne(...a),
  },
}))

const docFindOne = vi.fn()
const docCreate = vi.fn()
vi.mock('../models/WorldDocument', () => ({
  WorldDocument: {
    findOne: (...a: unknown[]) => docFindOne(...a),
    create: (...a: unknown[]) => docCreate(...a),
  },
}))

const userFindOne = vi.fn()
vi.mock('../models/User', () => ({
  User: { findOne: (...a: unknown[]) => userFindOne(...a) },
}))

const getAdventure = vi.fn()
vi.mock('../services/adventureBoard', () => ({
  getAdventure: (...a: unknown[]) => getAdventure(...a),
}))

import { codexSessionsRouter } from './codexSessions'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/codex/sessions', codexSessionsRouter)
  app.use(errorHandler)
  return app
}

function lean(doc: unknown) {
  return { lean: () => Promise.resolve(doc) }
}
function sortLean(doc: unknown) {
  return { sort: () => lean(doc) }
}

function makeAdventure(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    title: 'The Lost Mine',
    short_description: 'A delve',
    date: '2026-07-15',
    ...overrides,
  }
}

function asDm() {
  userFindOne.mockReturnValue(lean({ role: 'DM' }))
}

beforeEach(() => {
  entryFindOneAndUpdate.mockReset()
  entryFindOne.mockReset()
  docFindOne.mockReset()
  docCreate.mockReset()
  userFindOne.mockReset()
  getAdventure.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/codex/sessions/sync', () => {
  it('should 403 when the requester is neither DM nor ADMIN', async () => {
    userFindOne.mockReturnValue(lean({ role: 'PLAYER' }))

    const res = await request(makeApp()).post('/api/codex/sessions/sync').send({ abSessionId: 77 })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ message: 'DM or ADMIN required' })
  })

  it('should 400 when abSessionId is not a number', async () => {
    asDm()

    const res = await request(makeApp())
      .post('/api/codex/sessions/sync')
      .send({ abSessionId: 'nope' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'abSessionId must be a number' })
  })

  it('should build the hierarchy and create a page document on first sync', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    asDm()
    getAdventure.mockResolvedValue(makeAdventure())
    const diaryId = new Types.ObjectId()
    const monthId = new Types.ObjectId()
    const sessionId = new Types.ObjectId()
    entryFindOneAndUpdate
      .mockResolvedValueOnce({ _id: diaryId })
      .mockResolvedValueOnce({ _id: monthId })
      .mockResolvedValueOnce({ _id: sessionId })
    docFindOne.mockReturnValue(sortLean(null))
    const newDocId = new Types.ObjectId()
    docCreate.mockResolvedValue({ _id: newDocId })

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).post('/api/codex/sessions/sync').send({ abSessionId: 77 })

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      entryId: sessionId.toString(),
      slug: 'adventure-diary-the-lost-mine-2026-07',
      docId: newDocId.toString(),
    })
    expect(docCreate).toHaveBeenCalledOnce()
  })

  it('should reuse the existing page document on repeated sync', async () => {
    asDm()
    getAdventure.mockResolvedValue(makeAdventure())
    const sessionId = new Types.ObjectId()
    entryFindOneAndUpdate
      .mockResolvedValueOnce({ _id: new Types.ObjectId() })
      .mockResolvedValueOnce({ _id: new Types.ObjectId() })
      .mockResolvedValueOnce({ _id: sessionId })
    const existingDocId = new Types.ObjectId()
    docFindOne.mockReturnValue(sortLean({ _id: existingDocId }))

    const res = await request(makeApp()).post('/api/codex/sessions/sync').send({ abSessionId: 77 })

    expect(res.status).toBe(200)
    expect(res.body.docId).toBe(existingDocId.toString())
    expect(docCreate).not.toHaveBeenCalled()
  })
})

describe('GET /api/codex/sessions/by-ab/:abSessionId', () => {
  it('should 400 when abSessionId is not a number', async () => {
    const res = await request(makeApp()).get('/api/codex/sessions/by-ab/nope')

    expect(res.status).toBe(400)
  })

  it('should 404 when no session page exists yet', async () => {
    getAdventure.mockResolvedValue(makeAdventure())
    entryFindOne.mockReturnValue(lean(null))

    const res = await request(makeApp()).get('/api/codex/sessions/by-ab/77')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'No session page yet' })
  })

  it('should return entry, slug and docId when the page exists', async () => {
    getAdventure.mockResolvedValue(makeAdventure())
    const entryId = new Types.ObjectId()
    const docId = new Types.ObjectId()
    entryFindOne.mockReturnValue(
      lean({ _id: entryId, slug: 'adventure-diary-the-lost-mine-2026-07' }),
    )
    docFindOne.mockReturnValue(sortLean({ _id: docId }))

    const res = await request(makeApp()).get('/api/codex/sessions/by-ab/77')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      entryId: entryId.toString(),
      slug: 'adventure-diary-the-lost-mine-2026-07',
      docId: docId.toString(),
    })
  })

  it('should return a null docId when no page document exists', async () => {
    getAdventure.mockResolvedValue(makeAdventure())
    entryFindOne.mockReturnValue(lean({ _id: new Types.ObjectId(), slug: 's' }))
    docFindOne.mockReturnValue(sortLean(null))

    const res = await request(makeApp()).get('/api/codex/sessions/by-ab/77')

    expect(res.status).toBe(200)
    expect(res.body.docId).toBeNull()
  })
})
