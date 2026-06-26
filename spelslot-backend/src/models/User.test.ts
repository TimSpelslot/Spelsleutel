import { describe, it, expect } from 'vitest'
import { User, type IUser } from './User'

function makeUser(overrides: Partial<IUser> = {}) {
  return new User({
    uid: 'firebase-uid',
    email: 'a@b.nl',
    name: 'Ada',
    displayName: 'Ada L.',
    ...overrides,
  })
}

describe('User model', () => {
  it('should validate a fully-populated user', () => {
    const err = makeUser().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require uid, email, name and displayName', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new User({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err).toBeDefined()
    expect(err?.errors.uid).toBeDefined()
    expect(err?.errors.email).toBeDefined()
    expect(err?.errors.name).toBeDefined()
    expect(err?.errors.displayName).toBeDefined()
  })

  it('should reject a role outside the enum', () => {
    const err = makeUser({ role: 'WIZARD' as IUser['role'] }).validateSync()

    expect(err?.errors.role).toBeDefined()
  })

  it('should default role to PLAYER and boolean flags appropriately', () => {
    // ── arrange / act ─────────────────────────────────────────────────────
    const user = makeUser()

    // ── assert ────────────────────────────────────────────────────────────
    expect(user.role).toBe('PLAYER')
    expect(user.isWorldbuilder).toBe(false)
    expect(user.worldbuilderRequestPending).toBe(false)
    expect(user.notifySignup).toBe(true)
    expect(user.notifyAssignment).toBe(true)
    expect(user.notifyMarketplace).toBe(true)
    expect(user.notifySession).toBe(true)
    expect(user.fcmTokens).toEqual([])
  })

  it('should accept each valid role', () => {
    for (const role of ['PLAYER', 'DM', 'ADMIN'] as const) {
      expect(makeUser({ role }).validateSync()).toBeUndefined()
    }
  })
})
