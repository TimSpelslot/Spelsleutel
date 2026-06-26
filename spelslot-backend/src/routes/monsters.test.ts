import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── mock the auth middleware so the router mounts without Firebase ─────────
// (route tests stub the whole guard; see auth.test.ts for the verifyIdToken
// boundary itself.)
vi.mock('../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

import { monstersRouter } from './monsters'

// Build a throwaway app with the central error contract for 500s.
function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/monsters', monstersRouter)
  return app
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

describe('GET /api/monsters', () => {
  it('should 400 when the search parameter is missing', async () => {
    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/monsters')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'search parameter required' })
  })

  it('should return upstream results for a search', async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({ results: [{ name: 'Goblin' }] }) })

    const res = await request(makeApp()).get('/api/monsters?search=goblin')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ results: [{ name: 'Goblin' }] })
  })
})

describe('GET /api/monsters/:slug', () => {
  it('should reject a slug with invalid characters', async () => {
    const res = await request(makeApp()).get('/api/monsters/not a slug')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'Invalid slug' })
  })

  it('should pass through a 404 from upstream', async () => {
    fetchMock.mockResolvedValue({ status: 404, json: () => Promise.resolve({}) })

    const res = await request(makeApp()).get('/api/monsters/goblin')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'Monster not found' })
  })
})

describe('POST /api/monsters/from-url', () => {
  it('should 400 when url is missing', async () => {
    const res = await request(makeApp()).post('/api/monsters/from-url').send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'url is required' })
  })

  it('should extract the name from a dndbeyond url and return the exact match', async () => {
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ results: [{ name: 'Goblin' }, { name: 'Goblin Boss' }] }),
    })

    const res = await request(makeApp())
      .post('/api/monsters/from-url')
      .send({ url: 'https://www.dndbeyond.com/monsters/16-goblin' })

    expect(res.status).toBe(200)
    expect(res.body.monster).toEqual({ name: 'Goblin' })
  })

  it('should 404 when the extracted name is not in Open5e', async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({ results: [] }) })

    const res = await request(makeApp())
      .post('/api/monsters/from-url')
      .send({ url: 'https://www.dndbeyond.com/monsters/999-homebrew-thing' })

    expect(res.status).toBe(404)
    expect(res.body.extractedName).toBe('homebrew thing')
  })
})
