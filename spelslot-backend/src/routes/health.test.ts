import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { healthRouter } from './health'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', healthRouter)
  return app
}

describe('GET /api/health', () => {
  it('should return 200 with an ok status', async () => {
    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/health')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
