import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'

// ── mock the marketplace service ────────────────────────────────────────────
const listItems = vi.fn()
const getItem = vi.fn()
const getMarketStats = vi.fn()
const getBestDeals = vi.fn()
const getRecentPurchases = vi.fn()
vi.mock('../services/marketplace', () => ({
  listItems: (...a: unknown[]) => listItems(...a),
  getItem: (...a: unknown[]) => getItem(...a),
  getMarketStats: (...a: unknown[]) => getMarketStats(...a),
  getBestDeals: (...a: unknown[]) => getBestDeals(...a),
  getRecentPurchases: (...a: unknown[]) => getRecentPurchases(...a),
}))

import { marketplaceRouter } from './marketplace'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/marketplace', marketplaceRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/marketplace/items', () => {
  it('should return items wrapped in an envelope', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    listItems.mockResolvedValue([{ _id: 'i1', name: 'Sword' }])

    // ── act ───────────────────────────────────────────────────────────────
    const res = await request(makeApp()).get('/api/marketplace/items?search=sword')

    // ── assert ────────────────────────────────────────────────────────────
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [{ _id: 'i1', name: 'Sword' }] })
    expect(listItems).toHaveBeenCalledWith({
      search: 'sword',
      category: undefined,
      rarity: undefined,
    })
  })

  it('should delegate to the error handler when the service throws', async () => {
    listItems.mockRejectedValue(new Error('upstream down'))

    const res = await request(makeApp()).get('/api/marketplace/items')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ message: 'Internal server error' })
  })
})

describe('GET /api/marketplace/items/:id', () => {
  it('should return a single item wrapped in an envelope', async () => {
    getItem.mockResolvedValue({ _id: 'i9', name: 'Wand' })

    const res = await request(makeApp()).get('/api/marketplace/items/i9')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ item: { _id: 'i9', name: 'Wand' } })
    expect(getItem).toHaveBeenCalledWith('i9')
  })
})

describe('GET /api/marketplace/overview', () => {
  it('should combine stats, recent purchases and best deals', async () => {
    getMarketStats.mockResolvedValue({ totalItems: 5 })
    getRecentPurchases.mockResolvedValue([{ id: 'p1' }])
    getBestDeals.mockResolvedValue([{ _id: 'd1' }])

    const res = await request(makeApp()).get('/api/marketplace/overview')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      stats: { totalItems: 5 },
      recentPurchases: [{ id: 'p1' }],
      bestDeals: [{ _id: 'd1' }],
    })
    expect(getRecentPurchases).toHaveBeenCalledWith(12)
    expect(getBestDeals).toHaveBeenCalledWith(6)
  })
})
