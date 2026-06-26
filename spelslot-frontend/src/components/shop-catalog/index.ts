/**
 * Read-only Shop Catalog — public entry point.
 *
 * Import the component and types from this barrel; everything else in the
 * folder is an implementation detail.
 *
 *   import { ShopCatalog, type ShopItem } from '@/components/shop-catalog'
 *
 * See ./README.md for the full props/API contract and host requirements.
 */
export { default as ShopCatalog } from './ShopCatalog.vue'
export type { ShopItem, Rarity } from './types'
