import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { marketplaceService, RARITY_LABEL, RARITY_SEVERITY } from './marketplaceService'
import type { MarketplaceItem, MarketplaceOverview } from './marketplaceService'
import { api } from './api'

function makeMarketplaceItem(overrides: Partial<MarketplaceItem> = {}): MarketplaceItem {
  return {
    _id: 'item-1',
    name: 'Potion of Healing',
    description: 'Heals 2d4+2 hit points.',
    rarity: 'common',
    category: 'potion',
    basePrice: 50,
    currentPrice: 50,
    stock: 10,
    maxStock: 20,
    oneTime: false,
    consumable: true,
    attunement: false,
    active: true,
    ...overrides,
  }
}

function makeMarketplaceOverview(
  overrides: Partial<MarketplaceOverview> = {},
): MarketplaceOverview {
  return {
    stats: { totalItems: 5, avgPrice: 100, mostPopularRarity: 'common' },
    recentPurchases: [],
    bestDeals: [],
    ...overrides,
  }
}

const apiMock = api as { get: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('marketplaceService.listItems', () => {
  it('should call api.get without a query string when no params are given', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'ok', data: { items: [] } })

    // ── act ──────────────────────────────────────────────────────────────────
    await marketplaceService.listItems()

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.get).toHaveBeenCalledWith('/api/marketplace/items')
  })

  it('should append ?search= when only the search param is given', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'ok', data: { items: [] } })

    // ── act ──────────────────────────────────────────────────────────────────
    await marketplaceService.listItems({ search: 'sword' })

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.get).toHaveBeenCalledWith('/api/marketplace/items?search=sword')
  })

  it('should build correct query string with multiple params', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'ok', data: { items: [] } })

    // ── act ──────────────────────────────────────────────────────────────────
    await marketplaceService.listItems({ search: 'ring', category: 'jewelry', rarity: 'rare' })

    // ── assert ────────────────────────────────────────────────────────────────
    const calledUrl = apiMock.get.mock.calls[0][0] as string
    expect(calledUrl).toContain('search=ring')
    expect(calledUrl).toContain('category=jewelry')
    expect(calledUrl).toContain('rarity=rare')
    expect(calledUrl.startsWith('/api/marketplace/items?')).toBe(true)
  })

  it('should unwrap { items } on ok and return the array', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const items = [makeMarketplaceItem(), makeMarketplaceItem({ _id: 'item-2', name: 'Staff' })]
    apiMock.get.mockResolvedValue({ type: 'ok', data: { items } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await marketplaceService.listItems()

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].name).toBe('Potion of Healing')
    }
  })

  it('should pass through error from api', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Service unavailable' })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await marketplaceService.listItems()

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Service unavailable')
    }
  })
})

describe('marketplaceService.getItem', () => {
  it('should unwrap { item } on ok', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const item = makeMarketplaceItem({ _id: 'item-42', name: 'Cloak of Elvenkind' })
    apiMock.get.mockResolvedValue({ type: 'ok', data: { item } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await marketplaceService.getItem('item-42')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data.name).toBe('Cloak of Elvenkind')
      expect(result.data._id).toBe('item-42')
    }
  })

  it('should call api.get with the correct path', async () => {
    apiMock.get.mockResolvedValue({ type: 'ok', data: { item: makeMarketplaceItem() } })

    await marketplaceService.getItem('item-99')

    expect(apiMock.get).toHaveBeenCalledWith('/api/marketplace/items/item-99')
  })

  it('should pass through error from api', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Item not found' })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await marketplaceService.getItem('missing')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
  })
})

describe('marketplaceService.getOverview', () => {
  it('should return the api result directly without unwrapping', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const overview = makeMarketplaceOverview()
    const apiResult = { type: 'ok' as const, data: overview }
    apiMock.get.mockResolvedValue(apiResult)

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await marketplaceService.getOverview()

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result).toBe(apiResult)
    expect(apiMock.get).toHaveBeenCalledWith('/api/marketplace/overview')
  })

  it('should pass through error from api', async () => {
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Unavailable' })

    const result = await marketplaceService.getOverview()

    expect(result.type).toBe('error')
  })
})

describe('RARITY_LABEL and RARITY_SEVERITY constants', () => {
  it('should export RARITY_LABEL with all five rarities', () => {
    expect(RARITY_LABEL.common).toBeDefined()
    expect(RARITY_LABEL.uncommon).toBeDefined()
    expect(RARITY_LABEL.rare).toBeDefined()
    expect(RARITY_LABEL.very_rare).toBeDefined()
    expect(RARITY_LABEL.legendary).toBeDefined()
  })

  it('should export RARITY_SEVERITY with all five rarities', () => {
    expect(RARITY_SEVERITY.common).toBeDefined()
    expect(RARITY_SEVERITY.uncommon).toBeDefined()
    expect(RARITY_SEVERITY.rare).toBeDefined()
    expect(RARITY_SEVERITY.very_rare).toBeDefined()
    expect(RARITY_SEVERITY.legendary).toBeDefined()
  })
})
