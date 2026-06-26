import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'

vi.mock('../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

const findOne = vi.fn()
const findOneAndUpdate = vi.fn()
const deleteOne = vi.fn()
vi.mock('../models/DdbCharacterCache', () => ({
  DdbCharacterCache: {
    findOne: (...a: unknown[]) => findOne(...a),
    findOneAndUpdate: (...a: unknown[]) => findOneAndUpdate(...a),
    deleteOne: (...a: unknown[]) => deleteOne(...a),
  },
}))

import { ddbRouter } from './ddb'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/ddb', ddbRouter)
  app.use(errorHandler)
  return app
}

const fetchMock = vi.fn()

function lean(doc: unknown) {
  return { lean: () => Promise.resolve(doc) }
}

// Minimal raw DnD Beyond payload that parseCharacter can digest.
function makeRawCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 12345,
    name: 'Aelar',
    avatarUrl: null,
    classes: [{ definition: { name: 'Fighter' }, level: 5 }],
    baseHitPoints: 40,
    stats: [
      { id: 1, value: 16 },
      { id: 2, value: 14 },
      { id: 3, value: 14 },
      { id: 4, value: 10 },
      { id: 5, value: 12 },
      { id: 6, value: 8 },
    ],
    bonusStats: [],
    overrideStats: [],
    modifiers: {},
    inventory: [],
    ...overrides,
  }
}

beforeEach(() => {
  findOne.mockReset()
  findOneAndUpdate.mockReset()
  deleteOne.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  delete process.env.DDB_COBALT_TOKEN
})

describe('GET /api/ddb/character/:characterId', () => {
  it('should 400 when the id is neither numeric nor a DnD Beyond URL', async () => {
    const res = await request(makeApp()).get('/api/ddb/character/not-an-id')

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/number or a DnD Beyond/)
  })

  it('should return fresh cached data without calling DnD Beyond', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    findOne.mockReturnValue(lean({ data: { id: 1, name: 'Cached' }, fetchedAt: new Date() }))

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/ddb/character/12345')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body.character).toEqual({ id: 1, name: 'Cached' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should fetch, parse and cache a character on a cache miss', async () => {
    findOne.mockReturnValue(lean(null))
    findOneAndUpdate.mockResolvedValue({})
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: makeRawCharacter() }),
    })

    const res = await request(makeApp()).get('/api/ddb/character/12345')

    expect(res.status).toBe(200)
    expect(res.body.character).toMatchObject({
      id: 12345,
      name: 'Aelar',
      totalLevel: 5,
      proficiencyBonus: 3,
    })
    expect(res.body.character.modifiers.str).toBe(3)
    expect(findOneAndUpdate).toHaveBeenCalledOnce()
  })

  it('should extract the id from a DnD Beyond character URL', async () => {
    findOne.mockReturnValue(lean(null))
    findOneAndUpdate.mockResolvedValue({})
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: makeRawCharacter() }),
    })

    const url = encodeURIComponent('https://www.dndbeyond.com/characters/98765')
    const res = await request(makeApp()).get(`/api/ddb/character/${url}`)

    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toContain('/98765')
  })

  it('should 404 when DnD Beyond returns 404', async () => {
    findOne.mockReturnValue(lean(null))
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) })

    const res = await request(makeApp()).get('/api/ddb/character/12345')

    expect(res.status).toBe(404)
  })

  it('should 502 on an auth failure with no cache to fall back on', async () => {
    findOne.mockReturnValue(lean(null))
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({}) })

    const res = await request(makeApp()).get('/api/ddb/character/12345')

    expect(res.status).toBe(502)
  })

  it('should serve stale cache when DnD Beyond auth fails', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000)
    findOne.mockReturnValue(lean({ data: { id: 1, name: 'Stale' }, fetchedAt: old }))
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })

    const res = await request(makeApp()).get('/api/ddb/character/12345')

    expect(res.status).toBe(200)
    expect(res.body.stale).toBe(true)
    expect(res.body.character).toEqual({ id: 1, name: 'Stale' })
  })

  it('should serve stale cache on a network error', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000)
    findOne.mockReturnValue(lean({ data: { id: 2, name: 'Net' }, fetchedAt: old }))
    fetchMock.mockRejectedValue(new Error('ECONNRESET'))

    const res = await request(makeApp()).get('/api/ddb/character/12345')

    expect(res.status).toBe(200)
    expect(res.body.stale).toBe(true)
  })

  it('should 404 when the upstream payload has no data field', async () => {
    findOne.mockReturnValue(lean(null))
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })

    const res = await request(makeApp()).get('/api/ddb/character/12345')

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/ddb/character/:characterId/cache', () => {
  it('should delete the cache entry and return ok', async () => {
    deleteOne.mockResolvedValue({ deletedCount: 1 })

    const res = await request(makeApp()).delete('/api/ddb/character/12345/cache')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(deleteOne).toHaveBeenCalledWith({ characterId: '12345' })
  })
})
