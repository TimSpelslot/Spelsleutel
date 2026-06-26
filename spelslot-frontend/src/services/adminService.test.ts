import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminService } from './adminService'
import type { AdminUser, AdminUserPatch } from './adminService'

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

// ── Fixture factories ──────────────────────────────────────────────────────

function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    uid: 'firebase-uid-1',
    email: 'admin@spelslot.nl',
    name: 'Admin User',
    displayName: 'Admin',
    avatarUrl: null,
    role: 'ADMIN',
    isWorldbuilder: true,
    worldbuilderRequestPending: false,
    dndbeyondCharacterId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listUsers', () => {
    it('should unwrap the users envelope and return the array on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const users = [makeAdminUser({ id: 'user-1' }), makeAdminUser({ id: 'user-2', role: 'DM' })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { users } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adminService.listUsers()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toHaveLength(2)
        expect(result.data[0]).toMatchObject({ id: 'user-1', role: 'ADMIN' })
        expect(result.data[1]).toMatchObject({ id: 'user-2', role: 'DM' })
      }
    })

    it('should pass through an error result', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Unauthorized' })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adminService.listUsers()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('error')
    })

    it('should call the correct endpoint', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { users: [] } })
      await adminService.listUsers()
      expect(api.get).toHaveBeenCalledWith('/api/admin/users')
    })
  })

  describe('updateUser', () => {
    it('should unwrap the user envelope and return the updated user on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const updated = makeAdminUser({ id: 'user-5', isWorldbuilder: true })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: { user: updated } })
      const patch: AdminUserPatch = { isWorldbuilder: true }

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adminService.updateUser('user-5', patch)

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toMatchObject({ id: 'user-5', isWorldbuilder: true })
      }
    })

    it('should call the correct endpoint with the patch payload', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const updated = makeAdminUser({ id: 'user-5' })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: { user: updated } })
      const patch: AdminUserPatch = { role: 'DM', worldbuilderRequestPending: false }

      // ── act ───────────────────────────────────────────────────────────────
      await adminService.updateUser('user-5', patch)

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.patch).toHaveBeenCalledWith('/api/admin/users/user-5', patch)
    })

    it('should pass through an error result', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'error', message: 'Forbidden' })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adminService.updateUser('user-5', { role: 'DM' })

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('error')
    })
  })
})
