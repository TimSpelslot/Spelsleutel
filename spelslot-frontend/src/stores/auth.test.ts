import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { User } from '@/types'

// ── Mocks (must be declared before any imports that depend on them) ──────────

vi.mock('@/services/authService', () => ({
  authService: {
    sync: vi.fn(),
    updateProfile: vi.fn(),
    requestWorldbuilder: vi.fn(),
    updatePreferences: vi.fn(),
  },
}))

vi.mock('@/firebase', () => ({
  firebaseAuth: {},
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}))

import { useAuthStore } from './auth'
import { authService } from '@/services/authService'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'

// ── Fixture factory ──────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    uid: 'firebase-uid',
    email: 'test@example.com',
    name: 'Test User',
    displayName: 'TestUser',
    avatarUrl: null,
    role: 'PLAYER',
    isWorldbuilder: false,
    worldbuilderRequestPending: false,
    dndbeyondCharacterId: null,
    notifySignup: true,
    notifyAssignment: true,
    notifyMarketplace: true,
    notifySession: true,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have user as null', () => {
      const store = useAuthStore()
      expect(store.user).toBeNull()
    })

    it('should have firebaseUser as null', () => {
      const store = useAuthStore()
      expect(store.firebaseUser).toBeNull()
    })

    it('should have loading as false', () => {
      const store = useAuthStore()
      expect(store.loading).toBe(false)
    })
  })

  // ── init ───────────────────────────────────────────────────────────────────

  describe('init', () => {
    it('should set user when firebase user is present and sync returns ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const user = makeUser()
      vi.mocked(authService.sync).mockResolvedValueOnce({ type: 'ok', data: user })
      const fakeFbUser = { uid: 'firebase-uid' }
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
        ;(cb as (u: unknown) => void)(fakeFbUser)
        return () => {}
      })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      await store.init()

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.user).toEqual(user)
    })

    it('should keep previous user when sync returns an error (resilience)', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const existingUser = makeUser({ id: 'existing-u' })
      vi.mocked(authService.sync).mockResolvedValueOnce({ type: 'error', message: 'Backend down' })
      const fakeFbUser = { uid: 'firebase-uid' }
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
        ;(cb as (u: unknown) => void)(fakeFbUser)
        return () => {}
      })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = existingUser
      await store.init()

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.user).toEqual(existingUser)
    })

    it('should clear user when firebase user is null', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
        ;(cb as (u: null) => void)(null)
        return () => {}
      })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser()
      await store.init()

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.user).toBeNull()
    })

    it('should resolve the promise after the first callback fires', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(authService.sync).mockResolvedValueOnce({ type: 'ok', data: makeUser() })
      const fakeFbUser = { uid: 'firebase-uid' }
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
        ;(cb as (u: unknown) => void)(fakeFbUser)
        return () => {}
      })
      const store = useAuthStore()

      // ── act + assert ──────────────────────────────────────────────────────
      await expect(store.init()).resolves.toBeUndefined()
    })
  })

  // ── loginWithGoogle ────────────────────────────────────────────────────────

  describe('loginWithGoogle', () => {
    it('should set user and return ok result on success', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const user = makeUser()
      vi.mocked(signInWithPopup).mockResolvedValueOnce({} as never)
      vi.mocked(authService.sync).mockResolvedValueOnce({ type: 'ok', data: user })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      const result = await store.loginWithGoogle()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      expect(store.user).toEqual(user)
    })

    it('should return error result when popup is closed by user', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(signInWithPopup).mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      const result = await store.loginWithGoogle()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('error')
    })

    it('should return error result for an unknown error code', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(signInWithPopup).mockRejectedValueOnce({ code: 'auth/some-unknown-code' })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      const result = await store.loginWithGoogle()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('error')
    })

    it('should not set user when signInWithPopup rejects', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(signInWithPopup).mockRejectedValueOnce({ code: 'auth/popup-blocked' })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      await store.loginWithGoogle()

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.user).toBeNull()
    })
  })

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should call signOut and clear user and firebaseUser', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const store = useAuthStore()
      store.user = makeUser()
      store.firebaseUser = { uid: 'firebase-uid' } as never

      // ── act ───────────────────────────────────────────────────────────────
      await store.logout()

      // ── assert ────────────────────────────────────────────────────────────
      expect(signOut).toHaveBeenCalledOnce()
      expect(store.user).toBeNull()
      expect(store.firebaseUser).toBeNull()
    })
  })

  // ── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('should set user and return ok result on success', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const updated = makeUser({ displayName: 'NewName' })
      vi.mocked(authService.updateProfile).mockResolvedValueOnce({ type: 'ok', data: updated })

      // ── act ───────────────────────────────────────────────────────────────
      const store = useAuthStore()
      const result = await store.updateProfile('NewName')

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      expect(store.user).toEqual(updated)
    })

    it('should return the error result and not change user on error', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(authService.updateProfile).mockResolvedValueOnce({
        type: 'error',
        message: 'Not found',
      })
      const store = useAuthStore()
      const originalUser = makeUser()
      store.user = originalUser

      // ── act ───────────────────────────────────────────────────────────────
      const result = await store.updateProfile('NewName')

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('error')
      expect(store.user).toEqual(originalUser)
    })
  })

  // ── hasPermission ──────────────────────────────────────────────────────────

  describe('hasPermission', () => {
    it('should return false when there is no user', () => {
      const store = useAuthStore()
      expect(store.hasPermission('PLAYER')).toBe(false)
    })

    it('should return true for the matching role', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'DM' })

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.hasPermission('DM')).toBe(true)
    })

    it('should return false for a non-matching role', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'PLAYER' })

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.hasPermission('ADMIN')).toBe(false)
    })

    it('should return true when the user role is in an array of allowed roles', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'DM' })

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.hasPermission(['PLAYER', 'DM', 'ADMIN'])).toBe(true)
    })

    it('should use the devRole override when checking permissions', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'PLAYER' })
      store.devRole = 'DM'

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.hasPermission('DM')).toBe(true)
      expect(store.hasPermission('PLAYER')).toBe(false)
    })
  })

  // ── effectiveUser / setDevRole ─────────────────────────────────────────────

  describe('effectiveUser / setDevRole', () => {
    it('should return null when user is null', () => {
      const store = useAuthStore()
      expect(store.effectiveUser).toBeNull()
    })

    it('should return the base user when devRole is null', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      const user = makeUser({ role: 'PLAYER', isWorldbuilder: false })
      store.user = user
      store.devRole = null

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.effectiveUser).toEqual(user)
    })

    it('should set isWorldbuilder to true when devRole is DM even if base user has it false', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'PLAYER', isWorldbuilder: false })
      store.devRole = 'DM'

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.effectiveUser?.role).toBe('DM')
      expect(store.effectiveUser?.isWorldbuilder).toBe(true)
    })

    it('should set isWorldbuilder to true when devRole is ADMIN', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'PLAYER', isWorldbuilder: false })
      store.devRole = 'ADMIN'

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.effectiveUser?.role).toBe('ADMIN')
      expect(store.effectiveUser?.isWorldbuilder).toBe(true)
    })

    it('should preserve the base user isWorldbuilder when devRole is PLAYER', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'PLAYER', isWorldbuilder: false })
      store.devRole = 'PLAYER'

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.effectiveUser?.role).toBe('PLAYER')
      expect(store.effectiveUser?.isWorldbuilder).toBe(false)
    })

    it('should preserve isWorldbuilder true when devRole is PLAYER and base user already has it', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      store.user = makeUser({ role: 'PLAYER', isWorldbuilder: true })
      store.devRole = 'PLAYER'

      // ── act + assert ──────────────────────────────────────────────────────
      expect(store.effectiveUser?.isWorldbuilder).toBe(true)
    })

    it('should persist the devRole to localStorage via setDevRole', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      // ── act ───────────────────────────────────────────────────────────────
      store.setDevRole('DM')

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.devRole).toBe('DM')
      expect(setItemSpy).toHaveBeenCalledWith('spelslot-dev-role', 'DM')
    })

    it('should remove the devRole from localStorage when set to null', () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const store = useAuthStore()
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')
      store.devRole = 'DM'

      // ── act ───────────────────────────────────────────────────────────────
      store.setDevRole(null)

      // ── assert ────────────────────────────────────────────────────────────
      expect(store.devRole).toBeNull()
      expect(removeItemSpy).toHaveBeenCalledWith('spelslot-dev-role')
    })
  })
})
