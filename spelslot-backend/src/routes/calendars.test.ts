import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'

vi.mock('../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

const findOne = vi.fn()
vi.mock('../models/LkCalendar', () => ({
  LkCalendar: { findOne: (...a: unknown[]) => findOne(...a) },
}))

import { calendarsRouter } from './calendars'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/calendars', calendarsRouter)
  app.use(errorHandler)
  return app
}

function lean(doc: unknown) {
  return { lean: () => Promise.resolve(doc) }
}

beforeEach(() => {
  findOne.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/calendars/:id', () => {
  it('should return the calendar when found', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    findOne.mockReturnValue(lean({ lkCalendarId: 'cal-1', name: 'Harptos' }))

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/calendars/cal-1')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ lkCalendarId: 'cal-1', name: 'Harptos' })
    expect(findOne).toHaveBeenCalledWith({ lkCalendarId: 'cal-1' })
  })

  it('should 404 when the calendar is not found', async () => {
    findOne.mockReturnValue(lean(null))

    const res = await request(makeApp()).get('/api/calendars/missing')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'Calendar not found' })
  })

  it('should delegate to the error handler on a query failure', async () => {
    findOne.mockReturnValue({ lean: () => Promise.reject(new Error('db down')) })

    const res = await request(makeApp()).get('/api/calendars/cal-1')

    expect(res.status).toBe(500)
  })
})
