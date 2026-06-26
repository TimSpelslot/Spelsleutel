import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { WorldDocument, type IWorldDocument } from './WorldDocument'

function makeDoc(overrides: Partial<IWorldDocument> = {}) {
  return new WorldDocument({
    entryId: new Types.ObjectId(),
    type: 'page',
    ...overrides,
  })
}

describe('WorldDocument model', () => {
  it('should validate a minimal valid document', () => {
    const err = makeDoc().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require entryId and type', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new WorldDocument({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.entryId).toBeDefined()
    expect(err?.errors.type).toBeDefined()
  })

  it('should reject a type outside the enum', () => {
    const err = makeDoc({ type: 'spreadsheet' as IWorldDocument['type'] }).validateSync()
    expect(err?.errors.type).toBeDefined()
  })

  it('should default name, pos, isHidden and isFirst', () => {
    const doc = makeDoc()

    expect(doc.name).toBe('Page')
    expect(doc.pos).toBe('')
    expect(doc.isHidden).toBe(false)
    expect(doc.isFirst).toBe(false)
  })

  it('should accept each valid doc type', () => {
    for (const type of ['page', 'time', 'map', 'board'] as const) {
      expect(makeDoc({ type }).validateSync()).toBeUndefined()
    }
  })
})
