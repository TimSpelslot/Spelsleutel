import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { errorHandler } from './errorHandler'

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
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('errorHandler', () => {
  it('should respond with 500 and the uniform error body', () => {
    // ── arrange ───────────────────────────────────────────────────────────
    const res = makeRes()

    // ── act ───────────────────────────────────────────────────────────────
    errorHandler(new Error('boom'), {} as Request, res, vi.fn() as NextFunction)

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: 'Internal server error' })
  })

  it('should log the error message under the [error] prefix', () => {
    const spy = vi.spyOn(console, 'error')

    errorHandler(new Error('kaboom'), {} as Request, makeRes(), vi.fn() as NextFunction)

    expect(spy).toHaveBeenCalledWith('[error]', 'kaboom')
  })

  it('should not call next', () => {
    const next = vi.fn()

    errorHandler(new Error('x'), {} as Request, makeRes(), next as NextFunction)

    expect(next).not.toHaveBeenCalled()
  })
})
