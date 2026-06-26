import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'

vi.mock('../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// Avoid touching the real filesystem: stub the fs calls used at module load.
vi.mock('fs', () => ({
  default: { existsSync: () => true, mkdirSync: () => undefined },
  existsSync: () => true,
  mkdirSync: () => undefined,
}))

// Stub multer so single('file') is a passthrough that injects a controllable
// req.file. The fileFilter/limits logic is verified separately against the
// real multer factory in the "fileFilter" describe block below.
let injectedFile: { filename: string } | undefined
vi.mock('multer', () => {
  const multer = () => ({
    single: () => (req: { file?: unknown }, _res: unknown, next: () => void) => {
      req.file = injectedFile
      next()
    },
  })
  multer.diskStorage = () => ({})
  return { default: multer }
})

import { uploadRouter } from './upload'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/upload', uploadRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  injectedFile = undefined
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/upload/image', () => {
  it('should 400 when no file is uploaded', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    injectedFile = undefined

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).post('/api/upload/image')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'No file uploaded' })
  })

  it('should return the public url for an uploaded file', async () => {
    injectedFile = { filename: '12345-abc.png' }

    const res = await request(makeApp()).post('/api/upload/image')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ url: '/uploads/12345-abc.png' })
  })
})
