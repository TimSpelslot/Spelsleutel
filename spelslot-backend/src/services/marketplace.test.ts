import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listItems, getItem, getMarketStats, getBestDeals, getRecentPurchases } from './marketplace'

const fetchMock = vi.fn()
const DEFAULT_BASE = 'https://spelslot-marketplace-dev.idohobbysservers.com/api'

function okJson(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) }
}

function calledUrl(): string {
  return fetchMock.mock.calls[0][0] as string
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

describe('listItems', () => {
  it('should hit /items with no query string when no params are given', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    fetchMock.mockResolvedValue(okJson([]))

    // ── act ───────────────────────────────────────────────────────────────
    await listItems({})

    // ── assert ────────────────────────────────────────────────────────────
    expect(calledUrl()).toBe(`${DEFAULT_BASE}/items`)
  })

  it('should append search, category and rarity as query params', async () => {
    fetchMock.mockResolvedValue(okJson([]))

    await listItems({ search: 'sword', category: 'weapon', rarity: 'rare' })

    const url = calledUrl()
    expect(url).toContain('search=sword')
    expect(url).toContain('category=weapon')
    expect(url).toContain('rarity=rare')
  })

  it('should return the parsed JSON body', async () => {
    fetchMock.mockResolvedValue(okJson([{ _id: 'i1', name: 'Sword' }]))

    const items = await listItems({})

    expect(items).toEqual([{ _id: 'i1', name: 'Sword' }])
  })
})

describe('getItem', () => {
  it('should fetch a single item by id', async () => {
    fetchMock.mockResolvedValue(okJson({ _id: 'i9' }))

    await getItem('i9')

    expect(calledUrl()).toBe(`${DEFAULT_BASE}/items/i9`)
  })
})

describe('getMarketStats', () => {
  it('should hit the market stats endpoint', async () => {
    fetchMock.mockResolvedValue(okJson({ totalItems: 3 }))

    const stats = await getMarketStats()

    expect(calledUrl()).toBe(`${DEFAULT_BASE}/items/stats/market`)
    expect(stats).toEqual({ totalItems: 3 })
  })
})

describe('getBestDeals', () => {
  it('should use the default limit of 6', async () => {
    fetchMock.mockResolvedValue(okJson([]))

    await getBestDeals()

    expect(calledUrl()).toBe(`${DEFAULT_BASE}/items/best-deals/list?limit=6`)
  })

  it('should pass through a custom limit', async () => {
    fetchMock.mockResolvedValue(okJson([]))

    await getBestDeals(3)

    expect(calledUrl()).toContain('limit=3')
  })
})

describe('getRecentPurchases', () => {
  it('should use the default limit of 12', async () => {
    fetchMock.mockResolvedValue(okJson([]))

    await getRecentPurchases()

    expect(calledUrl()).toBe(`${DEFAULT_BASE}/purchases/recent/global?limit=12`)
  })
})

describe('error handling', () => {
  it('should throw when the upstream returns a non-ok status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })

    await expect(getItem('x')).rejects.toThrow(/500/)
  })
})
