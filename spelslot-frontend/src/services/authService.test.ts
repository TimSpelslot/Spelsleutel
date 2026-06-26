import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from './authService'
import type { User } from '@/types'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

import { api } from './api'

// ── Fixture factory ────────────────────────────────────────────────────────

type RawUser = User & { _id?: string }

function makeRawUser(overrides: Partial<RawUser> = {}): RawUser {
  return {
    id: 'user-abc',
    uid: 'firebase-uid-abc',
    email: 'player@spelslot.nl',
    name: 'Test Player',
    displayName: 'TestPlayer',
    avatarUrl: 'https://example.com/avatar.png',
    role: 'PLAYER',
    isWorldbuilder: false,
    worldbuilderRequestPending: false,
    dndbeyondCharacterId: null,
    notifySignup: true,
    notifyAssignment: true,
    notifyMarketplace: false,
    notifySession: true,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sync', () => {
    it('should normalise a raw user that has id', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ id: 'mongo-id', avatarUrl: 'https://cdn.example.com/pic.jpg' })
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await authService.sync()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.id).toBe('mongo-id')
        expect(result.data.avatarUrl).toBe('https://cdn.example.com/pic.jpg')
        expect(result.data.dndbeyondCharacterId).toBeNull()
      }
    })

    it('should fall back to _id when id is absent', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ _id: 'fallback-id' })
      // Simulate mongo raw: no id field, only _id
      const { id: _removed, ...rawWithout } = raw
      vi.mocked(api.post).mockResolvedValueOnce({
        type: 'ok',
        data: { ...rawWithout, _id: 'fallback-id' },
      })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await authService.sync()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.id).toBe('fallback-id')
      }
    })

    it('should coerce null avatarUrl to null', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ avatarUrl: null })
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await authService.sync()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.avatarUrl).toBeNull()
      }
    })

    it('should coerce null dndbeyondCharacterId to null', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ dndbeyondCharacterId: null })
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await authService.sync()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.dndbeyondCharacterId).toBeNull()
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'error', message: 'Not authenticated' })
      const result = await authService.sync()
      expect(result.type).toBe('error')
    })

    it('should post to the correct endpoint', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: makeRawUser() })
      await authService.sync()
      expect(api.post).toHaveBeenCalledWith('/api/auth/sync', {})
    })
  })

  describe('requestWorldbuilder', () => {
    it('should return a normalised user on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ worldbuilderRequestPending: true })
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await authService.requestWorldbuilder()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.worldbuilderRequestPending).toBe(true)
        expect(result.data).toHaveProperty('id')
        expect(result.data).toHaveProperty('uid')
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'error', message: 'Forbidden' })
      const result = await authService.requestWorldbuilder()
      expect(result.type).toBe('error')
    })
  })

  describe('updateProfile', () => {
    it('should pass displayName in the patch payload', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ displayName: 'NewName' })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      await authService.updateProfile('NewName')

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.patch).toHaveBeenCalledWith('/api/auth/me', { displayName: 'NewName' })
    })

    it('should return a normalised user with the updated displayName', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ displayName: 'NewName' })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await authService.updateProfile('NewName')

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.displayName).toBe('NewName')
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await authService.updateProfile('X')
      expect(result.type).toBe('error')
    })
  })

  describe('updatePreferences', () => {
    it('should pass the prefs payload to the correct endpoint', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ notifyMarketplace: true })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: raw })
      const prefs = { notifyMarketplace: true, notifySignup: false }

      // ── act ───────────────────────────────────────────────────────────────
      await authService.updatePreferences(prefs)

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.patch).toHaveBeenCalledWith('/api/auth/me/preferences', prefs)
    })

    it('should return a normalised user on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawUser({ notifySession: false })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await authService.updatePreferences({ notifySession: false })

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.notifySession).toBe(false)
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'error', message: 'Server error' })
      const result = await authService.updatePreferences({ notifySignup: true })
      expect(result.type).toBe('error')
    })
  })
})
