import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { monsterService } from './monsterService'
import type { MonsterSummary, Monster } from './monsterService'
import { api } from './api'

function makeMonsterSummary(overrides: Partial<MonsterSummary> = {}): MonsterSummary {
  return {
    slug: 'goblin',
    name: 'Goblin',
    challenge_rating: '1/4',
    type: 'humanoid',
    size: 'Small',
    ...overrides,
  }
}

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    slug: 'goblin',
    name: 'Goblin',
    size: 'Small',
    type: 'humanoid',
    subtype: 'goblinoid',
    alignment: 'neutral evil',
    armor_class: 15,
    armor_desc: 'leather armor, shield',
    hit_points: 7,
    hit_dice: '2d6',
    speed: { walk: 30 },
    strength: 8,
    dexterity: 14,
    constitution: 10,
    intelligence: 10,
    wisdom: 8,
    charisma: 8,
    strength_save: null,
    dexterity_save: null,
    constitution_save: null,
    intelligence_save: null,
    wisdom_save: null,
    charisma_save: null,
    perception: null,
    skills: {},
    damage_vulnerabilities: '',
    damage_resistances: '',
    damage_immunities: '',
    condition_immunities: '',
    senses: 'darkvision 60 ft.',
    languages: 'Common, Goblin',
    challenge_rating: '1/4',
    cr: 0.25,
    actions: [],
    reactions: [],
    legendary_actions: [],
    special_abilities: [],
    document__title: 'SRD 5.1',
    ...overrides,
  }
}

const apiMock = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('monsterService.search', () => {
  it('should URL-encode the search name in the request path', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'ok', data: { results: [] } })

    // ── act ──────────────────────────────────────────────────────────────────
    await monsterService.search('hill giant')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.get).toHaveBeenCalledWith('/api/monsters?search=hill%20giant')
  })

  it('should URL-encode special characters in the name', async () => {
    apiMock.get.mockResolvedValue({ type: 'ok', data: { results: [] } })

    await monsterService.search("d'evil beast")

    const calledUrl = apiMock.get.mock.calls[0][0] as string
    expect(calledUrl).toContain(encodeURIComponent("d'evil beast"))
  })

  it('should unwrap { results } from the response on ok', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const summaries = [makeMonsterSummary(), makeMonsterSummary({ slug: 'orc', name: 'Orc' })]
    apiMock.get.mockResolvedValue({ type: 'ok', data: { results: summaries } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await monsterService.search('goblin')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].slug).toBe('goblin')
    }
  })

  it('should pass through error from api', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Search failed' })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await monsterService.search('goblin')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Search failed')
    }
  })
})

describe('monsterService.get', () => {
  it('should be a direct api.get passthrough', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const apiResult = { type: 'ok' as const, data: makeMonster() }
    apiMock.get.mockResolvedValue(apiResult)

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await monsterService.get('goblin')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result).toBe(apiResult)
    expect(apiMock.get).toHaveBeenCalledWith('/api/monsters/goblin')
  })

  it('should pass through error from api', async () => {
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Not found' })

    const result = await monsterService.get('unknown-slug')

    expect(result.type).toBe('error')
  })
})

describe('monsterService.fromUrl', () => {
  it('should be a direct api.post passthrough', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const apiResult = {
      type: 'ok' as const,
      data: { monster: makeMonster(), alternatives: [], extractedName: 'Goblin' },
    }
    apiMock.post.mockResolvedValue(apiResult)

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await monsterService.fromUrl('https://example.com/monsters/goblin')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result).toBe(apiResult)
    expect(apiMock.post).toHaveBeenCalledWith('/api/monsters/from-url', {
      url: 'https://example.com/monsters/goblin',
    })
  })

  it('should pass through error from api', async () => {
    apiMock.post.mockResolvedValue({ type: 'error', message: 'Could not extract monster' })

    const result = await monsterService.fromUrl('https://bad-url.com')

    expect(result.type).toBe('error')
  })
})
