import { describe, it, expect } from 'vitest'
import { WorldEntry, type IWorldEntry } from './WorldEntry'

function makeEntry(overrides: Partial<IWorldEntry> = {}) {
  return new WorldEntry({
    name: 'The Black Citadel',
    slug: 'the-black-citadel',
    type: 'location',
    ...overrides,
  })
}

describe('WorldEntry model', () => {
  it('should validate a minimal valid entry', () => {
    const err = makeEntry().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require name, slug and type', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new WorldEntry({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.name).toBeDefined()
    expect(err?.errors.slug).toBeDefined()
    expect(err?.errors.type).toBeDefined()
  })

  it('should reject a type outside the enum', () => {
    const err = makeEntry({ type: 'spaceship' as IWorldEntry['type'] }).validateSync()
    expect(err?.errors.type).toBeDefined()
  })

  it('should reject status and permission outside their enums', () => {
    const err = makeEntry({
      status: 'NOPE' as IWorldEntry['status'],
      permission: 'NOPE' as IWorldEntry['permission'],
    }).validateSync()

    expect(err?.errors.status).toBeDefined()
    expect(err?.errors.permission).toBeDefined()
  })

  it('should default status, permission, isLocked and arrays', () => {
    // ── arrange / act ─────────────────────────────────────────────────────
    const entry = makeEntry()

    // ── assert ────────────────────────────────────────────────────────────
    expect(entry.status).toBe('PUBLISHED')
    expect(entry.permission).toBe('PLAYERS')
    expect(entry.isLocked).toBe(false)
    expect(entry.aliases).toEqual([])
    expect(entry.tags).toEqual([])
    expect(entry.lkProperties).toEqual([])
    expect(entry.editors).toEqual([])
  })

  it('should default the embedded banner subdocument', () => {
    const entry = makeEntry()

    expect(entry.banner.enabled).toBe(false)
    expect(entry.banner.url).toBe('')
    expect(entry.banner.yPosition).toBe(50)
  })

  it('should accept each valid entry type', () => {
    const types: IWorldEntry['type'][] = [
      'lore',
      'location',
      'npc',
      'faction',
      'item',
      'event',
      'rule',
      'session',
    ]
    for (const type of types) {
      expect(makeEntry({ type }).validateSync()).toBeUndefined()
    }
  })
})
