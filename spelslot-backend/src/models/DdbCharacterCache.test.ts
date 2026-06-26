import { describe, it, expect } from 'vitest'
import { DdbCharacterCache, type IDdbCharacterCache } from './DdbCharacterCache'

function makeCache(overrides: Partial<IDdbCharacterCache> = {}) {
  return new DdbCharacterCache({
    characterId: '12345',
    data: { id: 12345, name: 'Aelar' },
    fetchedAt: new Date(),
    ...overrides,
  })
}

describe('DdbCharacterCache model', () => {
  it('should validate a populated cache entry', () => {
    const err = makeCache().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require characterId, data and fetchedAt', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new DdbCharacterCache({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.characterId).toBeDefined()
    expect(err?.errors.data).toBeDefined()
    expect(err?.errors.fetchedAt).toBeDefined()
  })

  it('should store arbitrary mixed character data', () => {
    const cache = makeCache({ data: { id: 1, name: 'X', nested: { foo: 'bar' } } as never })
    expect(cache.data).toEqual({ id: 1, name: 'X', nested: { foo: 'bar' } })
  })
})
