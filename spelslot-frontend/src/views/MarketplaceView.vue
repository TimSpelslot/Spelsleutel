<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { marketplaceService } from '@/services/marketplaceService'
import { ShopCatalog, type ShopItem } from '@/components/shop-catalog'

// ── State ─────────────────────────────────────────────────────────────────
const items = ref<ShopItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  const result = await marketplaceService.listItems()
  loading.value = false

  if (result.type === 'ok') {
    items.value = result.data
      .filter((i) => i.active)
      .map((i) => ({
        id: i._id,
        name: i.name,
        description: i.description,
        rarity: i.rarity,
        category: i.category,
        basePrice: i.basePrice,
        currentPrice: i.currentPrice,
        stock: i.stock,
        maxStock: i.maxStock,
        oneTime: i.oneTime,
        consumable: i.consumable,
        attunement: i.attunement,
        imageUrl: i.imageUrl,
        sourceUrl: i.sourceUrl,
      }))
  } else {
    error.value = result.message
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────
const MARKETPLACE_URL =
  import.meta.env.VITE_MARKETPLACE_URL ?? 'https://spelslot-marketplace-dev.idohobbysservers.com'

// The detail dialog's "View in marketplace" button. Item-level deep-link format
// is unknown, so we link to the marketplace root for now.
function itemUrl(_item: ShopItem): string {
  return MARKETPLACE_URL
}
</script>

<template>
  <div class="mp-view">
    <!-- Header -->
    <div class="mp-header">
      <div class="mp-header__left">
        <i class="pi pi-shopping-bag mp-header__icon" />
        <div>
          <h1 class="mp-header__title">{{ $t('marketplace.title') }}</h1>
          <p class="mp-header__subtitle">{{ $t('marketplace.subtitle') }}</p>
        </div>
      </div>

      <div class="mp-header__actions">
        <!-- TODO Part 2: fetch player gold from Marketplace API -->
        <div class="mp-gold" :title="$t('marketplace.gold.linkHint')">
          <i class="pi pi-wallet mp-gold__icon" />
          <span class="mp-gold__label">{{ $t('marketplace.gold.yourBalance') }}</span>
          <span class="mp-gold__value">—</span>
        </div>

        <!-- TODO Part 2: real redirect wiring -->
        <a :href="MARKETPLACE_URL" target="_blank" rel="noopener" class="mp-header__link">
          <Button
            :label="$t('marketplace.fullMarketplaceButton')"
            icon="pi pi-external-link"
            size="small"
            outlined
          />
        </a>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="mp-loading">
      <div class="mp-loading__filters">
        <Skeleton height="2.5rem" class="mp-loading__search" border-radius="var(--ss-radius)" />
        <Skeleton width="9rem" height="2.5rem" border-radius="var(--ss-radius)" />
        <Skeleton width="9rem" height="2.5rem" border-radius="var(--ss-radius)" />
      </div>
      <div class="mp-loading__rows">
        <Skeleton v-for="i in 10" :key="i" height="2.75rem" border-radius="var(--ss-radius)" />
      </div>
    </div>

    <!-- Error -->
    <p v-else-if="error" class="mp-error">{{ error || $t('marketplace.loadError') }}</p>

    <!-- Catalog -->
    <ShopCatalog v-else :items="items" :item-url="itemUrl" />
  </div>
</template>

<style scoped>
.mp-view {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Header ── */
.mp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.mp-header__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mp-header__icon {
  font-size: 1.6rem;
  color: var(--ss-primary);
}

.mp-header__title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
}

.mp-header__subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.mp-header__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mp-header__link {
  text-decoration: none;
}

/* ── Gold placeholder (Part 2) ── */
.mp-gold {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
}

.mp-gold__icon {
  font-size: 1rem;
  color: var(--ss-primary);
}

.mp-gold__label {
  font-size: 0.75rem;
  color: var(--ss-text-muted);
}

.mp-gold__value {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ss-primary);
}

/* ── Loading ── */
.mp-loading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mp-loading__filters {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.mp-loading__search {
  flex: 1;
  min-width: 160px;
}

.mp-loading__rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ── Error ── */
.mp-error {
  padding: 2rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--ss-danger);
}
</style>
