import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { Notification, type INotification } from './Notification'

function makeNotification(overrides: Partial<INotification> = {}) {
  return new Notification({
    userId: new Types.ObjectId(),
    type: 'system',
    title: 'Heads up',
    message: 'Something happened',
    ...overrides,
  })
}

describe('Notification model', () => {
  it('should validate a minimal valid notification', () => {
    const err = makeNotification().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require userId, type, title and message', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new Notification({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.userId).toBeDefined()
    expect(err?.errors.type).toBeDefined()
    expect(err?.errors.title).toBeDefined()
    expect(err?.errors.message).toBeDefined()
  })

  it('should reject a type outside the enum', () => {
    const err = makeNotification({ type: 'spam' as INotification['type'] }).validateSync()
    expect(err?.errors.type).toBeDefined()
  })

  it('should default read to false', () => {
    expect(makeNotification().read).toBe(false)
  })

  it('should accept each valid notification type', () => {
    for (const type of ['signup', 'assignment', 'marketplace', 'session', 'system'] as const) {
      expect(makeNotification({ type }).validateSync()).toBeUndefined()
    }
  })
})
