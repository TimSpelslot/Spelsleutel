import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'
import { errorHandler } from '../middleware/errorHandler'

// Auth: requireAuth attaches a principal; optionalAuth leaves it for the
// per-test toggle (logged-in vs anonymous).
let attachUser = true
vi.mock('../middleware/auth', () => ({
  requireAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { uid: 'u-uid', email: 'me@b.nl', name: 'Me', picture: '' }
    next()
  },
  optionalAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    if (attachUser) req.user = { uid: 'u-uid', email: 'me@b.nl', name: 'Me', picture: '' }
    next()
  },
}))

const entryFind = vi.fn()
const entryFindOne = vi.fn()
const entryFindById = vi.fn()
const entryFindByIdAndUpdate = vi.fn()
const entryCreate = vi.fn()
vi.mock('../models/WorldEntry', () => ({
  WorldEntry: {
    find: (...a: unknown[]) => entryFind(...a),
    findOne: (...a: unknown[]) => entryFindOne(...a),
    findById: (...a: unknown[]) => entryFindById(...a),
    findByIdAndUpdate: (...a: unknown[]) => entryFindByIdAndUpdate(...a),
    create: (...a: unknown[]) => entryCreate(...a),
  },
}))

const docFind = vi.fn()
const docCreate = vi.fn()
const docFindOneAndUpdate = vi.fn()
const docFindOneAndDelete = vi.fn()
vi.mock('../models/WorldDocument', () => ({
  WorldDocument: {
    find: (...a: unknown[]) => docFind(...a),
    create: (...a: unknown[]) => docCreate(...a),
    findOneAndUpdate: (...a: unknown[]) => docFindOneAndUpdate(...a),
    findOneAndDelete: (...a: unknown[]) => docFindOneAndDelete(...a),
  },
}))

const relFind = vi.fn()
vi.mock('../models/WorldEntryRelation', () => ({
  WorldEntryRelation: { find: (...a: unknown[]) => relFind(...a) },
}))

const userFindOne = vi.fn()
vi.mock('../models/User', () => ({
  User: { findOne: (...a: unknown[]) => userFindOne(...a) },
}))

vi.mock('../utils/slug', () => ({ uniqueSlug: vi.fn().mockResolvedValue('generated-slug') }))
vi.mock('../utils/pos', () => ({ posAfter: vi.fn().mockReturnValue('a1') }))

import { codexRouter } from './codex'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/codex', codexRouter)
  app.use(errorHandler)
  return app
}

function lean(doc: unknown) {
  return { lean: () => Promise.resolve(doc) }
}

const USER_ID = new Types.ObjectId()

function makeMongoUser(overrides: Record<string, unknown> = {}) {
  return { _id: USER_ID, role: 'PLAYER', isWorldbuilder: false, ...overrides }
}

function makeEntryDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    name: 'Tavern',
    slug: 'tavern',
    type: 'location',
    status: 'PUBLISHED',
    permission: 'PLAYERS',
    isLocked: false,
    aliases: [],
    tags: [],
    editors: [],
    banner: { enabled: false, url: '', yPosition: 50 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  attachUser = true
  for (const fn of [
    entryFind,
    entryFindOne,
    entryFindById,
    entryFindByIdAndUpdate,
    entryCreate,
    docFind,
    docCreate,
    docFindOneAndUpdate,
    docFindOneAndDelete,
    relFind,
    userFindOne,
  ]) {
    fn.mockReset()
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ── GET /api/codex ──────────────────────────────────────────────────────────
describe('GET /api/codex', () => {
  it('should list accessible entry summaries for a logged-in user', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    userFindOne.mockReturnValue(lean(makeMongoUser()))
    const entry = makeEntryDoc()
    entryFind.mockReturnValue({
      select: () => ({ sort: () => ({ limit: () => lean([entry]) }) }),
    })

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/codex')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0]).toMatchObject({ id: entry._id.toString(), name: 'Tavern' })
  })

  it('should query only PUBLIC entries for an anonymous request', async () => {
    attachUser = false
    entryFind.mockReturnValue({
      select: () => ({ sort: () => ({ limit: () => lean([]) }) }),
    })

    const res = await request(makeApp()).get('/api/codex')

    expect(res.status).toBe(200)
    expect(entryFind.mock.calls[0][0]).toMatchObject({ permission: 'PUBLIC' })
  })
})

// ── POST /api/codex ───────────────────────────────────────────────────────
describe('POST /api/codex', () => {
  it('should 401 when the Mongo user is not found', async () => {
    userFindOne.mockReturnValue(lean(null))

    const res = await request(makeApp()).post('/api/codex').send({ name: 'X', type: 'lore' })

    expect(res.status).toBe(401)
  })

  it('should 403 for a non-worldbuilder player', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ isWorldbuilder: false })))

    const res = await request(makeApp()).post('/api/codex').send({ name: 'X', type: 'lore' })

    expect(res.status).toBe(403)
  })

  it('should 400 when name or type is missing', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'DM' })))

    const res = await request(makeApp()).post('/api/codex').send({ name: 'X' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'name and type are required' })
  })

  it('should create an entry for a DM and return the summary', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'DM' })))
    entryFindOne.mockReturnValue({ sort: () => ({ select: () => lean(null) }) })
    const created = makeEntryDoc({ name: 'New Place', slug: 'generated-slug' })
    entryCreate.mockResolvedValue({ toObject: () => created })

    const res = await request(makeApp())
      .post('/api/codex')
      .send({ name: 'New Place', type: 'location' })

    expect(res.status).toBe(201)
    expect(res.body.entry).toMatchObject({ name: 'New Place', slug: 'generated-slug' })
  })

  it('should allow a worldbuilder player to create entries', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ isWorldbuilder: true })))
    entryFindOne.mockReturnValue({ sort: () => ({ select: () => lean(null) }) })
    entryCreate.mockResolvedValue({ toObject: () => makeEntryDoc() })

    const res = await request(makeApp())
      .post('/api/codex')
      .send({ name: 'Place', type: 'location' })

    expect(res.status).toBe(201)
  })
})

// ── GET /api/codex/slug/:slug ────────────────────────────────────────────────
describe('GET /api/codex/slug/:slug', () => {
  it('should 404 when no accessible entry matches the slug', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser()))
    entryFindOne.mockReturnValue(lean(null))

    const res = await request(makeApp()).get('/api/codex/slug/missing')

    expect(res.status).toBe(404)
  })

  it('should return the entry with its documents and relations', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser()))
    const entry = makeEntryDoc()
    entryFindOne.mockReturnValue(lean(entry))
    docFind.mockReturnValue({ sort: () => lean([]) })
    relFind.mockReturnValue(lean([]))
    entryFind.mockReturnValue({ select: () => lean([]) })

    const res = await request(makeApp()).get('/api/codex/slug/tavern')

    expect(res.status).toBe(200)
    expect(res.body.entry).toMatchObject({ slug: 'tavern' })
    expect(res.body.documents).toEqual([])
    expect(res.body.relations).toEqual([])
  })
})

// ── GET /api/codex/:id ──────────────────────────────────────────────────────
describe('GET /api/codex/:id', () => {
  it('should 400 for an invalid ObjectId', async () => {
    const res = await request(makeApp()).get('/api/codex/not-valid')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Invalid ID' })
  })

  it('should 404 when not accessible', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser()))
    entryFindOne.mockReturnValue(lean(null))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).get(`/api/codex/${id}`)

    expect(res.status).toBe(404)
  })

  it('should return the entry with relations when accessible', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser()))
    const entry = makeEntryDoc()
    entryFindOne.mockReturnValue(lean(entry))
    docFind.mockReturnValue({ sort: () => lean([]) })
    relFind.mockReturnValue(lean([]))
    entryFind.mockReturnValue({ select: () => lean([]) })

    const res = await request(makeApp()).get(`/api/codex/${entry._id.toString()}`)

    expect(res.status).toBe(200)
    expect(res.body.entry.id).toBe(entry._id.toString())
  })
})

// ── PATCH /api/codex/:id ────────────────────────────────────────────────────
describe('PATCH /api/codex/:id', () => {
  it('should 400 for an invalid id', async () => {
    const res = await request(makeApp()).patch('/api/codex/bad').send({ name: 'X' })

    expect(res.status).toBe(400)
  })

  it('should 404 when the entry does not exist', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'DM' })))
    entryFindById.mockReturnValue(lean(null))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).patch(`/api/codex/${id}`).send({ name: 'X' })

    expect(res.status).toBe(404)
  })

  it('should 403 when a non-worldbuilder player tries to edit', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ isWorldbuilder: false })))
    entryFindById.mockReturnValue(lean(makeEntryDoc()))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).patch(`/api/codex/${id}`).send({ name: 'X' })

    expect(res.status).toBe(403)
  })

  it('should update allowlisted fields for a DM', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'DM' })))
    const entry = makeEntryDoc()
    entryFindById.mockReturnValue(lean(entry))
    entryFindByIdAndUpdate.mockReturnValue(lean(makeEntryDoc({ name: 'Renamed' })))

    const res = await request(makeApp())
      .patch(`/api/codex/${entry._id.toString()}`)
      .send({ name: 'Renamed', notAllowed: 'x' })

    expect(res.status).toBe(200)
    expect(res.body.entry.name).toBe('Renamed')
    expect(entryFindByIdAndUpdate.mock.calls[0][1]).toEqual({ $set: { name: 'Renamed' } })
  })
})

// ── GET /api/codex/:id/documents ────────────────────────────────────────────
describe('GET /api/codex/:id/documents', () => {
  it('should 400 for an invalid id', async () => {
    const res = await request(makeApp()).get('/api/codex/bad/documents')

    expect(res.status).toBe(400)
  })

  it('should 404 when the entry is not accessible', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser()))
    entryFindOne.mockReturnValue(lean(null))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).get(`/api/codex/${id}/documents`)

    expect(res.status).toBe(404)
  })

  it('should return the documents for an accessible entry', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser()))
    const entry = makeEntryDoc()
    entryFindOne.mockReturnValue(lean(entry))
    const doc = { _id: new Types.ObjectId(), entryId: entry._id, name: 'Page', type: 'page' }
    docFind.mockReturnValue({ sort: () => lean([doc]) })

    const res = await request(makeApp()).get(`/api/codex/${entry._id.toString()}/documents`)

    expect(res.status).toBe(200)
    expect(res.body.documents).toHaveLength(1)
    expect(res.body.documents[0].name).toBe('Page')
  })
})

// ── POST /api/codex/:id/documents ───────────────────────────────────────────
describe('POST /api/codex/:id/documents', () => {
  it('should 403 when the user cannot write to the entry', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ isWorldbuilder: false })))
    entryFindById.mockReturnValue(lean(makeEntryDoc()))
    const id = new Types.ObjectId().toString()

    const res = await request(makeApp()).post(`/api/codex/${id}/documents`).send({})

    expect(res.status).toBe(403)
  })

  it('should create a document for a DM', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'DM' })))
    const entry = makeEntryDoc()
    entryFindById.mockReturnValue(lean(entry))
    const created = { _id: new Types.ObjectId(), entryId: entry._id, name: 'Page', type: 'page' }
    docCreate.mockResolvedValue({ toObject: () => created })

    const res = await request(makeApp())
      .post(`/api/codex/${entry._id.toString()}/documents`)
      .send({ name: 'Page' })

    expect(res.status).toBe(201)
    expect(res.body.document.name).toBe('Page')
  })
})

// ── PATCH /api/codex/:id/documents/:docId ───────────────────────────────────
describe('PATCH /api/codex/:id/documents/:docId', () => {
  it('should 400 for an invalid id pair', async () => {
    const res = await request(makeApp())
      .patch('/api/codex/bad/documents/also-bad')
      .send({ name: 'X' })

    expect(res.status).toBe(400)
  })

  it('should 404 when the document is not found', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'DM' })))
    entryFindById.mockReturnValue(lean(makeEntryDoc()))
    docFindOneAndUpdate.mockReturnValue(lean(null))
    const id = new Types.ObjectId().toString()
    const docId = new Types.ObjectId().toString()

    const res = await request(makeApp())
      .patch(`/api/codex/${id}/documents/${docId}`)
      .send({ name: 'X' })

    expect(res.status).toBe(404)
  })

  it('should update an existing document', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'DM' })))
    const entry = makeEntryDoc()
    entryFindById.mockReturnValue(lean(entry))
    const docId = new Types.ObjectId()
    docFindOneAndUpdate.mockReturnValue(
      lean({ _id: docId, entryId: entry._id, name: 'Renamed', type: 'page' }),
    )

    const res = await request(makeApp())
      .patch(`/api/codex/${entry._id.toString()}/documents/${docId.toString()}`)
      .send({ name: 'Renamed' })

    expect(res.status).toBe(200)
    expect(res.body.document.name).toBe('Renamed')
  })
})

// ── DELETE /api/codex/:id/documents/:docId ──────────────────────────────────
describe('DELETE /api/codex/:id/documents/:docId', () => {
  it('should 403 for a non-DM/Admin user', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'PLAYER', isWorldbuilder: true })))
    const id = new Types.ObjectId().toString()
    const docId = new Types.ObjectId().toString()

    const res = await request(makeApp()).delete(`/api/codex/${id}/documents/${docId}`)

    expect(res.status).toBe(403)
  })

  it('should 404 when the document does not exist', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'ADMIN' })))
    docFindOneAndDelete.mockResolvedValue(null)
    const id = new Types.ObjectId().toString()
    const docId = new Types.ObjectId().toString()

    const res = await request(makeApp()).delete(`/api/codex/${id}/documents/${docId}`)

    expect(res.status).toBe(404)
  })

  it('should delete the document for an admin', async () => {
    userFindOne.mockReturnValue(lean(makeMongoUser({ role: 'ADMIN' })))
    docFindOneAndDelete.mockResolvedValue({ _id: 'd1' })
    const id = new Types.ObjectId().toString()
    const docId = new Types.ObjectId().toString()

    const res = await request(makeApp()).delete(`/api/codex/${id}/documents/${docId}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
  })
})
