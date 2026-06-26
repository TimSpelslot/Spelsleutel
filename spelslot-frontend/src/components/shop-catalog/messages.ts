/**
 * Self-contained translations for the Shop Catalog.
 *
 * These are merged into a **component-local** vue-i18n scope (see
 * `useShopCatalogI18n`), so the host app does NOT need to add any keys to its
 * own message catalog — it only needs vue-i18n installed in Composition mode
 * (`legacy: false`). The local scope inherits the host's active locale, so when
 * the host switches language the catalog follows.
 *
 * Supported locales: `en` (fallback) and `nl`. To add a locale, add a sibling
 * block with the exact same key structure.
 */
const en = {
  shop: {
    empty: 'No items match your search.',
    stock: {
      inStock: 'In Stock',
      soldOut: 'Sold Out',
      critical: 'Critical Stock',
      low: 'Low Stock',
      limited: 'Limited Stock',
    },
    rarity: {
      common: 'common',
      uncommon: 'uncommon',
      rare: 'rare',
      veryRare: 'very rare',
      legendary: 'legendary',
    },
    filters: {
      search: 'Search items…',
      allCategories: 'All categories',
      allRarities: 'All rarities',
      maxPrice: 'Max price…',
      soldOutHidden: 'Sold out hidden',
      showSoldOut: 'Show sold out',
    },
    sort: {
      nameAsc: 'Name (A-Z)',
      nameDesc: 'Name (Z-A)',
      priceLow: 'Price: Low',
      priceHigh: 'Price: High',
      rarity: 'Rarity',
    },
    table: {
      name: 'Name',
      category: 'Category',
      rarity: 'Rarity',
      price: 'Price',
      stock: 'Stock',
      tags: 'Tags',
    },
    tags: {
      opc: 'OPC',
      cons: 'CONS',
      mmq: 'MMQ',
      att: 'ATT',
      attWithClass: 'ATT ({classes})',
      onePerCharacter: 'One per character',
      consumable: 'Consumable',
      requiresAttunement: 'Requires attunement',
      requiresAttunementForClass: 'Requires attunement ({classes})',
      opcTooltip: 'One per character: can only be purchased once per character.',
      consTooltip: 'Consumable: cannot be sold back.',
      mmqTooltip: 'Monthly max quantity: {count} per month.',
      onePerCharacterTooltip: 'Can only be purchased once per character.',
      consumableTooltip: 'Consumable items cannot be sold back.',
      attunementTooltip: 'This item requires player attunement.',
      subAttunementTooltip: 'Only {classes} can attune to this item.',
      monthlyMaxTag: 'Monthly max quantity: {count}/month',
      monthlyMaxTooltip: 'Purchase limit resets on the monthly restock day.',
    },
    detail: {
      viewSource: 'View source ↗',
      viewOnSite: 'View in marketplace ↗',
      base: 'base: {price}',
      remainingInfinite: '∞ / ∞ remaining',
      remaining: '{stock} of {max} remaining',
    },
  },
  common: {
    gold: '{amount} gp',
    actions: {
      clear: 'Clear',
      close: 'Close',
    },
  },
}

const nl: typeof en = {
  shop: {
    empty: 'Geen items komen overeen met je zoekopdracht.',
    stock: {
      inStock: 'Op voorraad',
      soldOut: 'Uitverkocht',
      critical: 'Kritieke voorraad',
      low: 'Lage voorraad',
      limited: 'Beperkte voorraad',
    },
    // D&D technical terms are kept in English across locales.
    rarity: {
      common: 'common',
      uncommon: 'uncommon',
      rare: 'rare',
      veryRare: 'very rare',
      legendary: 'legendary',
    },
    filters: {
      search: 'Items zoeken…',
      allCategories: 'Alle categorieen',
      allRarities: 'Alle zeldzaamheden',
      maxPrice: 'Max. prijs…',
      soldOutHidden: 'Uitverkocht verborgen',
      showSoldOut: 'Uitverkocht tonen',
    },
    sort: {
      nameAsc: 'Naam (A-Z)',
      nameDesc: 'Naam (Z-A)',
      priceLow: 'Prijs: laag',
      priceHigh: 'Prijs: hoog',
      rarity: 'Zeldzaamheid',
    },
    table: {
      name: 'Naam',
      category: 'Categorie',
      rarity: 'Zeldzaamheid',
      price: 'Prijs',
      stock: 'Voorraad',
      tags: 'Labels',
    },
    tags: {
      opc: 'OPC',
      cons: 'CONS',
      mmq: 'MMQ',
      att: 'ATT',
      attWithClass: 'ATT ({classes})',
      onePerCharacter: 'Een per karakter',
      consumable: 'Verbruiksartikel',
      requiresAttunement: 'Vereist attunement',
      requiresAttunementForClass: 'Vereist attunement ({classes})',
      opcTooltip: 'Een per karakter: kan slechts eenmaal per karakter worden gekocht.',
      consTooltip: 'Verbruiksartikel: kan niet worden teruggekocht.',
      mmqTooltip: 'Maximale maandhoeveelheid: {count} per maand.',
      onePerCharacterTooltip: 'Kan slechts eenmaal per karakter worden gekocht.',
      consumableTooltip: 'Verbruiksartikelen kunnen niet worden teruggekocht.',
      attunementTooltip: 'Dit item vereist attunement door de speler.',
      subAttunementTooltip: 'Alleen {classes} kan attunement gebruiken met dit item.',
      monthlyMaxTag: 'Maximale maandhoeveelheid: {count}/maand',
      monthlyMaxTooltip: 'De aankooplimiet wordt op de maandelijkse aanvuldag gereset.',
    },
    detail: {
      viewSource: 'Bron bekijken ↗',
      viewOnSite: 'Bekijk in de winkel ↗',
      base: 'basis: {price}',
      remainingInfinite: '∞ / ∞ over',
      remaining: '{stock} van {max} over',
    },
  },
  common: {
    gold: '{amount} gp',
    actions: {
      clear: 'Wissen',
      close: 'Sluiten',
    },
  },
}

export const messages = { en, nl }
