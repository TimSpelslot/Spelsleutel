import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'

vi.mock('../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// ── mock the adventureBoard service ─────────────────────────────────────────
const getUpcomingSessions = vi.fn()
const getUserAssignments = vi.fn()
const getAdventure = vi.fn()
vi.mock('../services/adventureBoard', () => ({
  getUpcomingSessions: (...a: unknown[]) => getUpcomingSessions(...a),
  getUserAssignments: (...a: unknown[]) => getUserAssignments(...a),
  getAdventure: (...a: unknown[]) => getAdventure(...a),
}))

import { adventureBoardRouter } from './adventureBoard'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/adventure-board', adventureBoardRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/adventure-board/sessions', () => {
  it('should return upcoming sessions', async () => {
    getUpcomingSessions.mockResolvedValue([{ id: 1 }, { id: 2 }])

    const res = await request(makeApp()).get('/api/adventure-board/sessions')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('should delegate to the error handler when the service throws', async () => {
    getUpcomingSessions.mockRejectedValue(new Error('AB down'))

    const res = await request(makeApp()).get('/api/adventure-board/sessions')

    expect(res.status).toBe(500)
  })
})

describe('GET /api/adventure-board/sessions/:id', () => {
  it('should 400 when the id is not a number', async () => {
    const res = await request(makeApp()).get('/api/adventure-board/sessions/abc')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'id must be a number' })
    expect(getAdventure).not.toHaveBeenCalled()
  })

  it('should return the adventure detail for a numeric id', async () => {
    getAdventure.mockResolvedValue({ id: 7, title: 'Quest' })

    const res = await request(makeApp()).get('/api/adventure-board/sessions/7')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 7, title: 'Quest' })
    expect(getAdventure).toHaveBeenCalledWith(7)
  })
})

describe('GET /api/adventure-board/assignments', () => {
  it('should return an empty array when abUserId is missing', async () => {
    const res = await request(makeApp()).get('/api/adventure-board/assignments')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    expect(getUserAssignments).not.toHaveBeenCalled()
  })

  it('should 400 when abUserId is not a number', async () => {
    const res = await request(makeApp()).get('/api/adventure-board/assignments?abUserId=foo')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'abUserId must be a number' })
  })

  it('should return assignments for a valid abUserId', async () => {
    getUserAssignments.mockResolvedValue([{ id: 3 }])

    const res = await request(makeApp()).get('/api/adventure-board/assignments?abUserId=42')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([{ id: 3 }])
    expect(getUserAssignments).toHaveBeenCalledWith(42)
  })
})
