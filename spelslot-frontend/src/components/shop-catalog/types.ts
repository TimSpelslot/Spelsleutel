/**
 * Public data contract for the read-only Shop Catalog.
 *
 * Mirror of the marketplace's internal `Item` shape, trimmed to the fields the
 * catalog actually renders. The host app is responsible for fetching items and
 * passing them in as `ShopItem[]`. There is intentionally no `_id` — ids are
 * always normalised to `id` before reaching this component.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary'

export interface ShopItem {
  id: string
  name: string
  description: string
  rarity: Rarity
  category: string
  basePrice: number
  currentPrice: number
  /** null = unlimited supply */
  stock: number | null
  /** null = unlimited supply */
  maxStock: number | null
  /** When true this item can only be purchased once per character. */
  oneTime?: boolean
  /** When true this item is consumable and cannot be sold back. */
  consumable?: boolean
  /** When true this item requires attunement by the player. */
  attunement?: boolean
  /** Classes, races, or types that can attune (empty/absent = any). */
  subAttunement?: string[]
  /** Maximum quantity per month; null/absent = unlimited. */
  monthlyMaxQuantity?: number | null
  /** Optional thumbnail; falls back to a category icon when absent. */
  imageUrl?: string
  /** Optional external "view source" link (e.g. a rules reference). */
  sourceUrl?: string
  /** Starting upgrade level — rendered as "+{lvl} {name}" when > 0. */
  baseLvl?: number
}
