import { describe, it, expect } from 'vitest'
import { posAfter, posBetween } from './pos'

describe('posAfter', () => {
  it('should return a non-empty key when given null (start of list)', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const pos = posAfter(null)

    // ── assert ────────────────────────────────────────────────────────────
    expect(typeof pos).toBe('string')
    expect(pos.length).toBeGreaterThan(0)
  })

  it('should return a key that sorts after the given key', () => {
    const first = posAfter(null)
    const second = posAfter(first)

    expect(second > first).toBe(true)
  })

  it('should treat undefined the same as null', () => {
    expect(posAfter(undefined)).toBe(posAfter(null))
  })
})

describe('posBetween', () => {
  it('should return a key that sorts between two adjacent keys', () => {
    // ── arrange ───────────────────────────────────────────────────────────
    const a = posAfter(null)
    const c = posAfter(a)

    // ── act ───────────────────────────────────────────────────────────────
    const b = posBetween(a, c)

    // ── assert ────────────────────────────────────────────────────────────
    expect(a < b).toBe(true)
    expect(b < c).toBe(true)
  })

  it('should append after `before` when `after` is null', () => {
    const a = posAfter(null)
    const next = posBetween(a, null)

    expect(next > a).toBe(true)
  })

  it('should treat undefined endpoints like null', () => {
    expect(posBetween(undefined, undefined)).toBe(posBetween(null, null))
  })
})
