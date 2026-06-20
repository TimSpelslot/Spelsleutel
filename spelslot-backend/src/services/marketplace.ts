// Thin wrapper around the live Marketplace API.
// All public endpoints (items, stats, recent purchases) need no auth.
// Gold/inventory endpoints require a privileged Marketplace JWT (future work).

const BASE = (process.env.MARKETPLACE_API_URL ?? 'https://spelslot-marketplace-dev.idohobbysservers.com/api').replace(/\/$/, '')

async function mpGet<T>(path: string, auth?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (auth) headers.Authorization = `Bearer ${auth}`
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`Marketplace API returned ${res.status} on ${path}`)
  return res.json() as Promise<T>
}

export interface MpItem {
  _id: string
  name: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary'
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

export interface MpRecentPurchase {
  id: string
  buyerUsername: string
  itemName: string
  quantity: number
  pricePerUnit: number
  totalCost: number
  purchasedAt: string
}

export interface MpMarketStats {
  totalItems: number
  avgPrice: number
  mostPopularRarity: string
}

export function listItems(params: { search?: string; category?: string; rarity?: string }) {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.category) qs.set('category', params.category)
  if (params.rarity) qs.set('rarity', params.rarity)
  const q = qs.toString()
  return mpGet<MpItem[]>(`/items${q ? `?${q}` : ''}`)
}

export function getItem(id: string) {
  return mpGet<MpItem>(`/items/${id}`)
}

export function getMarketStats() {
  return mpGet<MpMarketStats>('/items/stats/market')
}

export function getBestDeals(limit = 6) {
  return mpGet<(MpItem & { discountPercent: number })[]>(`/items/best-deals/list?limit=${limit}`)
}

export function getRecentPurchases(limit = 12) {
  return mpGet<MpRecentPurchase[]>(`/purchases/recent/global?limit=${limit}`)
}
