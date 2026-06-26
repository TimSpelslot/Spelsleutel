/**
 * Pure display helpers for the Shop Catalog. Self-contained (no app imports) so
 * the folder can be copied into another repo untouched.
 *
 * Functions that produce user-facing text return an **i18n key** (resolved with
 * `t()` at the call site, see `messages.ts`) rather than literal text, so the
 * catalog stays localisable. Severity/class helpers return non-visible enums.
 */

// Percentage-based AND absolute-count-based thresholds (whichever is hit first).
const STOCK_CRITICAL = 0.1 // <= 10% -> Critical Stock
const STOCK_LOW = 0.2 // <= 20% -> Low Stock
const STOCK_LIMITED = 0.35 // <= 35% -> Limited Stock
const STOCK_CRITICAL_ABS = 1 // <= 1 item  -> always Critical Stock
const STOCK_LOW_ABS = 3 // <= 3 items -> always Low Stock
const STOCK_LIMITED_ABS = 5 // <= 5 items -> always Limited Stock

function stockRatios(stock: number, maxStock: number) {
  const ratio = stock / maxStock
  return {
    isCritical: ratio <= STOCK_CRITICAL || stock <= STOCK_CRITICAL_ABS,
    isLow: ratio <= STOCK_LOW || stock <= STOCK_LOW_ABS,
    isLimited: ratio <= STOCK_LIMITED || stock <= STOCK_LIMITED_ABS,
  }
}

/** i18n key (under `shop.stock.*`) for the stock status. Resolve with `t()`. */
export function stockLabel(stock: number | null, maxStock: number | null): string {
  if (stock === null || maxStock === null) return 'shop.stock.inStock'
  if (stock === 0) return 'shop.stock.soldOut'
  const { isCritical, isLow, isLimited } = stockRatios(stock, maxStock)
  if (isCritical) return 'shop.stock.critical'
  if (isLow) return 'shop.stock.low'
  if (isLimited) return 'shop.stock.limited'
  return 'shop.stock.inStock'
}

/** PrimeVue Tag severity for the stock status. */
export function stockSeverity(stock: number | null, maxStock: number | null): 'success' | 'warn' | 'danger' {
  if (stock === null || maxStock === null) return 'success'
  if (stock === 0) return 'danger'
  const { isCritical, isLow, isLimited } = stockRatios(stock, maxStock)
  if (isCritical) return 'danger'
  if (isLow || isLimited) return 'warn'
  return 'success'
}

/** CSS class for the stock status badge. */
export function stockClass(stock: number | null, maxStock: number | null): string {
  if (stock === null || maxStock === null) return 'stock--in-stock'
  if (stock === 0) return 'stock--sold-out'
  const { isCritical, isLow, isLimited } = stockRatios(stock, maxStock)
  if (isCritical) return 'stock--critical'
  if (isLow) return 'stock--low'
  if (isLimited) return 'stock--limited'
  return 'stock--in-stock'
}

type TagSeverity = 'secondary' | 'success' | 'info' | 'warn' | 'danger'

/** PrimeVue Tag severity for a given rarity string. */
export function raritySeverity(rarity: string): TagSeverity {
  const map: Record<string, TagSeverity> = {
    common: 'secondary',
    uncommon: 'success',
    rare: 'info',
    very_rare: 'warn',
    legendary: 'danger',
  }
  return map[rarity] ?? 'secondary'
}

/** i18n key (under `shop.rarity.*`) for a rarity. Unknown rarities pass through unchanged. */
export function rarityLabel(rarity: string): string {
  const map: Record<string, string> = {
    common: 'shop.rarity.common',
    uncommon: 'shop.rarity.uncommon',
    rare: 'shop.rarity.rare',
    very_rare: 'shop.rarity.veryRare',
    legendary: 'shop.rarity.legendary',
  }
  return map[rarity] ?? rarity
}

/** Price trend indicator vs base price. */
export function priceTrend(currentPrice: number, basePrice: number): '↑' | '↓' | '' {
  if (currentPrice > basePrice) return '↑'
  if (currentPrice < basePrice) return '↓'
  return ''
}

/** Display name for a levelled item: "+{lvl} {name}" when lvl > 0, else the plain name. */
export function itemDisplayName(name: string, lvl?: number): string {
  return lvl && lvl > 0 ? `+${lvl} ${name}` : name
}

const CATEGORY_ICON: Record<string, string> = {
  Potion: 'pi-heart',
  Weapon: 'pi-bolt',
  Armor: 'pi-shield',
  Scroll: 'pi-file',
  Ring: 'pi-circle',
  'Wondrous Item': 'pi-star',
  'Adventuring Gear': 'pi-briefcase',
}

/** PrimeIcon class used when an item has no `imageUrl`. */
export function itemIcon(category: string): string {
  return CATEGORY_ICON[category] ?? 'pi-box'
}
