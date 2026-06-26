import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

import { ddbService } from './ddbService'
import type { DdbCharacter, DdbStats, DdbResponse } from './ddbService'
import { api } from './api'

function makeDdbStats(overrides: Partial<DdbStats> = {}): DdbStats {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...overrides }
}

function makeDdbCharacter(overrides: Partial<DdbCharacter> = {}): DdbCharacter {
  return {
    id: 1,
    name: 'Thorin',
    avatarUrl: null,
    totalLevel: 5,
    classes: [{ name: 'Fighter', level: 5 }],
    maxHp: 44,
    stats: makeDdbStats(),
    modifiers: makeDdbStats(),
    proficiencyBonus: 3,
    savingThrowProficiencies: ['str', 'con'],
    armorClass: 16,
    speed: 30,
    ...overrides,
  }
}

function makeDdbResponse(overrides: Partial<DdbResponse> = {}): DdbResponse {
  return {
    character: makeDdbCharacter(),
    cachedAt: '2026-06-25T00:00:00Z',
    stale: false,
    ...overrides,
  }
}

const apiMock = api as { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ddbService.getCharacter', () => {
  it('should return ok with DdbResponse shape when api.get succeeds', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const payload = makeDdbResponse()
    apiMock.get.mockResolvedValue({ type: 'ok', data: payload })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await ddbService.getCharacter('123')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data.character.name).toBe('Thorin')
      expect(result.data.character.totalLevel).toBe(5)
    }
  })

  it('should call api.get with the correct path', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'ok', data: makeDdbResponse() })

    // ── act ──────────────────────────────────────────────────────────────────
    await ddbService.getCharacter('456')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.get).toHaveBeenCalledWith('/api/ddb/character/456')
  })

  it('should pass through error from api', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Not found' })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await ddbService.getCharacter('999')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Not found')
    }
  })
})

describe('ddbService.refreshCharacter', () => {
  it('should call api.delete for the cache then api.get for the character', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.delete.mockResolvedValue({ type: 'ok', data: {} })
    apiMock.get.mockResolvedValue({ type: 'ok', data: makeDdbResponse() })

    // ── act ──────────────────────────────────────────────────────────────────
    await ddbService.refreshCharacter('123')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.delete).toHaveBeenCalledWith('/api/ddb/character/123/cache')
    expect(apiMock.get).toHaveBeenCalledWith('/api/ddb/character/123')
  })

  it('should call api.delete before api.get', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const callOrder: string[] = []
    apiMock.delete.mockImplementation(() => {
      callOrder.push('delete')
      return Promise.resolve({ type: 'ok', data: {} })
    })
    apiMock.get.mockImplementation(() => {
      callOrder.push('get')
      return Promise.resolve({ type: 'ok', data: makeDdbResponse() })
    })

    // ── act ──────────────────────────────────────────────────────────────────
    await ddbService.refreshCharacter('123')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(callOrder).toEqual(['delete', 'get'])
  })

  it('should return the character data even when api.delete returns an error', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const payload = makeDdbResponse()
    apiMock.delete.mockResolvedValue({ type: 'error', message: 'Cache delete failed' })
    apiMock.get.mockResolvedValue({ type: 'ok', data: payload })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await ddbService.refreshCharacter('123')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data.character.id).toBe(1)
    }
  })

  it('should pass through error when the subsequent getCharacter fails', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.delete.mockResolvedValue({ type: 'ok', data: {} })
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Character not found' })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await ddbService.refreshCharacter('123')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
  })
})
