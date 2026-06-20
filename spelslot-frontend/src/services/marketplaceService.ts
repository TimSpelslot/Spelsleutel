import { api } from './api'
import type { Result } from '@/types'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary'

export interface MarketplaceItem {
  _id: string
  name: string
  description: string
  rarity: Rarity
  category: string
  basePrice: number
  currentPrice: number
  stock: number | null
  maxStock: number | null
  oneTime: boolean
  consumable: boolean
  attunement: boolean
  imageUrl?: string
  sourceUrl?: string
  active: boolean
}

export interface MarketplaceItemWithDeal extends MarketplaceItem {
  discountPercent: number
}

export interface RecentPurchase {
  id: string
  buyerUsername: string
  itemName: string
  quantity: number
  pricePerUnit: number
  totalCost: number
  purchasedAt: string
}

export interface MarketStats {
  totalItems: number
  avgPrice: number
  mostPopularRarity: string
}

export interface MarketplaceOverview {
  stats: MarketStats
  recentPurchases: RecentPurchase[]
  bestDeals: MarketplaceItemWithDeal[]
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
  legendary: 'Legendary',
}

export const RARITY_SEVERITY: Record<Rarity, string> = {
  common: 'secondary',
  uncommon: 'success',
  rare: 'info',
  very_rare: 'warn',
  legendary: 'danger',
}

export const marketplaceService = {
  async listItems(params?: { search?: string; category?: string; rarity?: string }): Promise<Result<MarketplaceItem[]>> {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.category) qs.set('category', params.category)
    if (params?.rarity) qs.set('rarity', params.rarity)
    const q = qs.toString()
    const result = await api.get<{ items: MarketplaceItem[] }>(`/api/marketplace/items${q ? `?${q}` : ''}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.items }
  },

  async getItem(id: string): Promise<Result<MarketplaceItem>> {
    const result = await api.get<{ item: MarketplaceItem }>(`/api/marketplace/items/${id}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.item }
  },

  async getOverview(): Promise<Result<MarketplaceOverview>> {
    return api.get<MarketplaceOverview>('/api/marketplace/overview')
  },
}
