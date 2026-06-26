import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mock the Firebase auth boundary (token attachment) ─────────────────────
vi.mock('@/firebase', () => ({
  firebaseAuth: { currentUser: null as null | { getIdToken: () => Promise<string> } },
}))

import { api } from './api'
import { firebaseAuth } from '@/firebase'

// Build a minimal Response stand-in for handleResponse().
function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  firebaseAuth.currentUser = null
})

describe('api success handling', () => {
  it('should unwrap an ok response into a Result.ok', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    fetchMock.mockResolvedValue(makeResponse({ entries: [1, 2] }))

    // ── act ───────────────────────────────────────────────────────────────
    const result = await api.get<{ entries: number[] }>('/api/codex')

    // ── assert ────────────────────────────────────────────────────────────
    expect(result).toEqual({ type: 'ok', data: { entries: [1, 2] } })
  })
})

describe('api auth header', () => {
  it('should omit Authorization when no user is signed in', async () => {
    fetchMock.mockResolvedValue(makeResponse({}))

    await api.get('/api/codex')

    const [, init] = fetchMock.mock.calls[0]
    expect(init?.headers).toEqual({})
  })

  it('should attach a Bearer token when a user is signed in', async () => {
    firebaseAuth.currentUser = { getIdToken: vi.fn().mockResolvedValue('tok123') }
    fetchMock.mockResolvedValue(makeResponse({}))

    await api.post('/api/codex', { name: 'x' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok123' })
  })
})

describe('api error normalisation', () => {
  it('should map a network failure to the offline message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await api.get('/api/codex')

    expect(result).toEqual({
      type: 'error',
      message: 'Network error — check your internet connection and try again.',
    })
  })

  it('should map a bare 401 to the generic login message', async () => {
    fetchMock.mockResolvedValue(makeResponse({ message: 'Unauthorized' }, 401))

    const result = await api.get('/api/codex')

    expect(result).toEqual({
      type: 'error',
      message: 'You are not logged in. Please log in and try again.',
    })
  })

  it('should pass through a meaningful 401 body message', async () => {
    fetchMock.mockResolvedValue(makeResponse({ message: 'Token expired' }, 401))

    const result = await api.get('/api/codex')

    expect(result).toEqual({ type: 'error', message: 'Token expired' })
  })

  it('should map 403 to the permission message', async () => {
    fetchMock.mockResolvedValue(makeResponse({ message: 'nope' }, 403))

    const result = await api.get('/api/codex')

    expect(result).toEqual({
      type: 'error',
      message: 'You do not have permission to perform this action.',
    })
  })

  it('should surface a body message for other error statuses', async () => {
    fetchMock.mockResolvedValue(makeResponse({ message: 'name is required' }, 400))

    const result = await api.post('/api/codex', {})

    expect(result).toEqual({ type: 'error', message: 'name is required' })
  })

  it('should fall back to HTTP <status> when no body message is present', async () => {
    fetchMock.mockResolvedValue(makeResponse({}, 500))

    const result = await api.get('/api/codex')

    expect(result).toEqual({ type: 'error', message: 'HTTP 500' })
  })
})
