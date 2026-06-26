import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

// ── mock the Firebase Admin verifyIdToken boundary ─────────────────────────
const verifyIdToken = vi.fn()
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}))

import { requireAuth, optionalAuth, type AuthRequest } from './auth'

// req/res/next factory — minimal Express stand-ins.
function makeReq(authorization?: string): Request {
  return { headers: authorization ? { authorization } : {} } as Request
}
function makeRes() {
  const res = {} as Response & { statusCode?: number; body?: unknown }
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code
    return res
  })
  res.json = vi.fn().mockImplementation((body: unknown) => {
    res.body = body
    return res
  })
  return res
}

beforeEach(() => {
  verifyIdToken.mockReset()
})

describe('requireAuth', () => {
  it('should 401 when no Bearer token is present', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    // ── act ───────────────────────────────────────────────────────────────
    await requireAuth(req, res, next)

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should attach the principal and call next on a valid token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.nl', name: 'Ala', picture: 'p.png' })
    const req = makeReq('Bearer good-token')
    const res = makeRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect((req as AuthRequest).user).toEqual({
      uid: 'u1',
      email: 'a@b.nl',
      name: 'Ala',
      picture: 'p.png',
    })
  })

  it('should 401 when verifyIdToken rejects', async () => {
    verifyIdToken.mockRejectedValue(new Error('expired'))
    const res = makeRes()
    const next = vi.fn()

    await requireAuth(makeReq('Bearer bad'), res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('optionalAuth', () => {
  it('should continue unauthenticated when no token is present', async () => {
    const req = makeReq()
    const next = vi.fn()

    await optionalAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledOnce()
    expect((req as AuthRequest).user).toBeUndefined()
  })

  it('should continue (without throwing) when the token is invalid', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad'))
    const req = makeReq('Bearer bad')
    const next = vi.fn()

    await optionalAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledOnce()
    expect((req as AuthRequest).user).toBeUndefined()
  })

  it('should attach the principal when the token is valid', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u2', email: '', name: '', picture: '' })
    const req = makeReq('Bearer good')
    const next = vi.fn()

    await optionalAuth(req, makeRes(), next)

    expect((req as AuthRequest).user?.uid).toBe('u2')
  })
})
