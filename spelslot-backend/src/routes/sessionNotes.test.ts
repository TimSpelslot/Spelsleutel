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

const find = vi.fn()
const findOne = vi.fn()
const create = vi.fn()
const countDocuments = vi.fn()
const findOneAndUpdate = vi.fn()
vi.mock('../models/SessionNote', () => ({
  SessionNote: {
    find: (...a: unknown[]) => find(...a),
    findOne: (...a: unknown[]) => findOne(...a),
    create: (...a: unknown[]) => create(...a),
    countDocuments: (...a: unknown[]) => countDocuments(...a),
    findOneAndUpdate: (...a: unknown[]) => findOneAndUpdate(...a),
  },
}))

import { sessionNotesRouter } from './sessionNotes'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/session-notes', sessionNotesRouter)
  app.use(errorHandler)
  return app
}

function lean(doc: unknown) {
  return { lean: () => Promise.resolve(doc) }
}

beforeEach(() => {
  find.mockReset()
  findOne.mockReset()
  create.mockReset()
  countDocuments.mockReset()
  findOneAndUpdate.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/session-notes/:sessionId/:noteType', () => {
  it('should 400 for an invalid note type', async () => {
    const res = await request(makeApp()).get('/api/session-notes/sess-1/admin')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Invalid note type' })
  })

  it('should list note metadata for the user+session+type', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    find.mockReturnValue({
      sort: () => ({ select: () => lean([{ name: 'Note 1', order: 0 }]) }),
    })

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/session-notes/sess-1/player')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ notes: [{ name: 'Note 1', order: 0 }] })
    expect(find).toHaveBeenCalledWith({ uid: 'u-uid', sessionId: 'sess-1', noteType: 'player' })
  })
})

describe('GET /api/session-notes/:sessionId/:noteType/:noteId', () => {
  it('should 400 for an invalid note id', async () => {
    const res = await request(makeApp()).get('/api/session-notes/sess-1/player/bad-id')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Invalid note ID' })
  })

  it('should 404 when the note is not found', async () => {
    findOne.mockReturnValue(lean(null))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).get(`/api/session-notes/sess-1/player/${id}`)

    expect(res.status).toBe(404)
  })

  it('should return the note with content when found', async () => {
    const id = new Types.ObjectId().toString()
    findOne.mockReturnValue(lean({ _id: id, content: { type: 'doc' } }))

    const res = await request(makeApp()).get(`/api/session-notes/sess-1/player/${id}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ note: { _id: id, content: { type: 'doc' } } })
  })
})

describe('POST /api/session-notes/:sessionId/:noteType', () => {
  it('should 400 for an invalid note type', async () => {
    const res = await request(makeApp()).post('/api/session-notes/sess-1/nope').send({})

    expect(res.status).toBe(400)
  })

  it('should create a note auto-named by the existing count', async () => {
    countDocuments.mockResolvedValue(2)
    create.mockResolvedValue({ _id: 'n3', name: 'Note 3', order: 2 })

    const res = await request(makeApp()).post('/api/session-notes/sess-1/dm').send({})

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ note: { _id: 'n3', name: 'Note 3', order: 2 } })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Note 3', order: 2, noteType: 'dm' }),
    )
  })

  it('should honor an explicit name from the body', async () => {
    countDocuments.mockResolvedValue(0)
    create.mockResolvedValue({ _id: 'n1', name: 'Custom' })

    const res = await request(makeApp())
      .post('/api/session-notes/sess-1/player')
      .send({ name: 'Custom' })

    expect(res.status).toBe(201)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Custom' }))
  })
})

describe('PUT /api/session-notes/:sessionId/:noteType/:noteId', () => {
  it('should 400 for an invalid note id', async () => {
    const res = await request(makeApp())
      .put('/api/session-notes/sess-1/player/bad-id')
      .send({ name: 'X' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Invalid note ID' })
  })

  it('should 400 when neither content nor name is provided', async () => {
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).put(`/api/session-notes/sess-1/player/${id}`).send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Provide content or name' })
  })

  it('should 404 when the note is not found', async () => {
    findOneAndUpdate.mockReturnValue(lean(null))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp())
      .put(`/api/session-notes/sess-1/player/${id}`)
      .send({ name: 'X' })

    expect(res.status).toBe(404)
  })

  it('should persist content and name when provided', async () => {
    const id = new Types.ObjectId().toString()
    findOneAndUpdate.mockReturnValue(lean({ _id: id, name: 'Renamed' }))

    const res = await request(makeApp())
      .put(`/api/session-notes/sess-1/player/${id}`)
      .send({ name: 'Renamed', content: { type: 'doc' } })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ note: { _id: id, name: 'Renamed' } })
    const setArg = findOneAndUpdate.mock.calls[0][1]
    expect(setArg).toEqual({ $set: { content: { type: 'doc' }, name: 'Renamed' } })
  })
})
