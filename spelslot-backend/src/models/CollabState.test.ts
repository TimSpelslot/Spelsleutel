import { describe, it, expect } from 'vitest'
import CollabState from './CollabState'

function makeState(overrides: Record<string, unknown> = {}) {
  return new CollabState({
    docId: 'doc-1',
    state: Buffer.from([1, 2, 3]),
    ...overrides,
  })
}

describe('CollabState model', () => {
  it('should validate a populated collab state', () => {
    const err = makeState().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require docId and state', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new CollabState({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.docId).toBeDefined()
    expect(err?.errors.state).toBeDefined()
  })

  it('should default updatedAt to a Date', () => {
    expect(makeState().updatedAt).toBeInstanceOf(Date)
  })
})
