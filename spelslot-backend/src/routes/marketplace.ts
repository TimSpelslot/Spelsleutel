import { Router } from 'express'
import {
  listItems,
  getItem,
  getMarketStats,
  getBestDeals,
  getRecentPurchases,
} from '../services/marketplace'

export const marketplaceRouter = Router()

// ── GET /api/marketplace/items ───────────────────────────────────────────
marketplaceRouter.get('/items', async (req, res, next) => {
  try {
    const { search, category, rarity } = req.query as Record<string, string>
    const items = await listItems({ search, category, rarity })
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/marketplace/items/:id ──────────────────────────────────────
marketplaceRouter.get('/items/:id', async (req, res, next) => {
  try {
    const item = await getItem(req.params.id)
    res.json({ item })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/marketplace/overview ───────────────────────────────────────
// Combines market stats + recent purchases in one request.
marketplaceRouter.get('/overview', async (req, res, next) => {
  try {
    const [stats, recentPurchases, bestDeals] = await Promise.all([
      getMarketStats(),
      getRecentPurchases(12),
      getBestDeals(6),
    ])
    res.json({ stats, recentPurchases, bestDeals })
  } catch (err) {
    next(err)
  }
})
