import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { WorldEntryRelation, type IWorldEntryRelation } from './WorldEntryRelation'

function makeRelation(overrides: Partial<IWorldEntryRelation> = {}) {
  return new WorldEntryRelation({
    sourceId: new Types.ObjectId(),
    targetId: new Types.ObjectId(),
    ...overrides,
  })
}

describe('WorldEntryRelation model', () => {
  it('should validate a relation with source and target', () => {
    const err = makeRelation().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require sourceId and targetId', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new WorldEntryRelation({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.sourceId).toBeDefined()
    expect(err?.errors.targetId).toBeDefined()
  })

  it('should accept optional type and lkPropertyId', () => {
    const err = makeRelation({ type: 'RESOURCE_LINK', lkPropertyId: 'p1' }).validateSync()
    expect(err).toBeUndefined()
  })
})
