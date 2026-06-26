import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mock the Mongoose model: WorldEntry.findOne(...).lean() ────────────────
const findOne = vi.fn()
vi.mock('../models/WorldEntry', () => ({
  WorldEntry: { findOne: (...args: unknown[]) => findOne(...args) },
}))

import { toSlug, uniqueSlug } from './slug'

// Queue up the docs that successive findOne().lean() calls should resolve to.
function queueLookups(...docs: Array<{ _id: string } | null>) {
  for (const doc of docs) {
    findOne.mockReturnValueOnce({ lean: () => Promise.resolve(doc) })
  }
}

beforeEach(() => {
  findOne.mockReset()
})

describe('toSlug', () => {
  it('should lowercase and hyphenate a plain name', () => {
    expect(toSlug('The Black Citadel')).toBe('the-black-citadel')
  })

  it('should strip special characters', () => {
    expect(toSlug('Mage’s Guild! (East)')).toBe('mages-guild-east')
  })

  it('should fall back to "entry" when nothing usable remains', () => {
    expect(toSlug('!!!')).toBe('entry')
    expect(toSlug('')).toBe('entry')
  })

  it('should cap the slug at 80 characters', () => {
    const slug = toSlug('a'.repeat(200))
    expect(slug.length).toBe(80)
  })
})

describe('uniqueSlug', () => {
  it('should return the base slug when no entry uses it', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    queueLookups(null)

    // ── act ───────────────────────────────────────────────────────────────
    const slug = await uniqueSlug('Tavern')

    // ── assert ────────────────────────────────────────────────────────────
    expect(slug).toBe('tavern')
    expect(findOne).toHaveBeenCalledTimes(1)
  })

  it('should append an incrementing suffix on collision', async () => {
    queueLookups({ _id: 'a' }, { _id: 'b' }, null)

    const slug = await uniqueSlug('Tavern')

    expect(slug).toBe('tavern-3')
    expect(findOne).toHaveBeenCalledTimes(3)
  })

  it('should keep the base slug when the only match is the excluded entry', async () => {
    queueLookups({ _id: 'self-id' })

    const slug = await uniqueSlug('Tavern', 'self-id')

    expect(slug).toBe('tavern')
  })
})
