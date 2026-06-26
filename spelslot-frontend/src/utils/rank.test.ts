import { describe, it, expect } from 'vitest'
import { rankColor, rankLabel } from './rank'

describe('rankColor', () => {
  it('should return the low token for values <= 1', () => {
    expect(rankColor(0)).toBe('var(--ss-rank-low)')
    expect(rankColor(1)).toBe('var(--ss-rank-low)')
  })

  it('should return the mid token for exactly 2', () => {
    expect(rankColor(2)).toBe('var(--ss-rank-mid)')
  })

  it('should return the max token for values > 2', () => {
    expect(rankColor(3)).toBe('var(--ss-rank-max)')
    expect(rankColor(99)).toBe('var(--ss-rank-max)')
  })
})

describe('rankLabel', () => {
  it('should map 1..3 to Low/Medium/High', () => {
    expect(rankLabel(1)).toBe('Low')
    expect(rankLabel(2)).toBe('Medium')
    expect(rankLabel(3)).toBe('High')
  })

  it('should fall back to the stringified number when out of range', () => {
    expect(rankLabel(7)).toBe('7')
  })
})
