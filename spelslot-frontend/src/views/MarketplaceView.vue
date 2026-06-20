<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Dialog from 'primevue/dialog'
import {
  marketplaceService,
  RARITY_LABEL,
  RARITY_SEVERITY,
  type MarketplaceItem,
  type Rarity,
} from '@/services/marketplaceService'

// ── State ─────────────────────────────────────────────────────────────────
const items = ref<MarketplaceItem[]>([])
const loadingItems = ref(false)
const itemsError = ref<string | null>(null)

const stats = ref<{ totalItems: number; avgPrice: number; mostPopularRarity: string } | null>(null)
const recentPurchases = ref<{ id: string; buyerUsername: string; itemName: string; quantity: number; totalCost: number; purchasedAt: string }[]>([])
const bestDeals = ref<(MarketplaceItem & { discountPercent: number })[]>([])
const loadingOverview = ref(false)

const selectedItem = ref<MarketplaceItem | null>(null)

// ── Filters ───────────────────────────────────────────────────────────────
const searchQuery = ref('')
const selectedCategory = ref<string>('')
const selectedRarity = ref<string>('')

const RARITY_OPTIONS = [
  { label: 'All rarities', value: '' },
  { label: 'Common', value: 'common' },
  { label: 'Uncommon', value: 'uncommon' },
  { label: 'Rare', value: 'rare' },
  { label: 'Very rare', value: 'very_rare' },
  { label: 'Legendary', value: 'legendary' },
]

const categoryOptions = computed(() => {
  const cats = [...new Set(items.value.map(i => i.category).filter(Boolean))].sort()
  return [{ label: 'All categories', value: '' }, ...cats.map(c => ({ label: c, value: c }))]
})

const filteredItems = computed(() => {
  let list = items.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
  }
  if (selectedCategory.value) list = list.filter(i => i.category === selectedCategory.value)
  if (selectedRarity.value) list = list.filter(i => i.rarity === selectedRarity.value)
  return list
})

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  loadingItems.value = true
  loadingOverview.value = true

  const [itemsResult, overviewResult] = await Promise.all([
    marketplaceService.listItems(),
    marketplaceService.getOverview(),
  ])

  loadingItems.value = false
  loadingOverview.value = false

  if (itemsResult.type === 'ok') items.value = itemsResult.data
  else itemsError.value = itemsResult.message

  if (overviewResult.type === 'ok') {
    stats.value = overviewResult.data.stats
    recentPurchases.value = overviewResult.data.recentPurchases
    bestDeals.value = overviewResult.data.bestDeals
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────
const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL ?? 'https://spelslot-marketplace-dev.idohobbysservers.com'

function rarityLabel(r: Rarity) { return RARITY_LABEL[r] ?? r }
function raritySeverity(r: Rarity) { return RARITY_SEVERITY[r] ?? 'secondary' }

function formatGold(n: number) {
  return n.toLocaleString('en-GB') + ' gp'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}u`
  return `${Math.floor(h / 24)}d`
}


function openItem(item: MarketplaceItem) { selectedItem.value = item }
</script>

<template>
  <div class="mp-view">
    <!-- Header -->
    <div class="mp-header">
      <div class="mp-header__left">
        <i class="pi pi-shopping-bag mp-header__icon" />
        <div>
          <h1 class="mp-header__title">Marketplace</h1>
          <p class="mp-header__subtitle">Magic items for adventurers</p>
        </div>
      </div>
      <a :href="MARKETPLACE_URL" target="_blank" rel="noopener" class="mp-header__link">
        <Button label="Full marketplace" icon="pi pi-external-link" text size="small" />
      </a>
    </div>

    <!-- Stats bar -->
    <div class="mp-stats" :class="{ 'mp-stats--loading': loadingOverview }">
      <template v-if="loadingOverview">
        <Skeleton height="3.5rem" border-radius="var(--ss-radius)" v-for="i in 3" :key="i" />
      </template>
      <template v-else-if="stats">
        <div class="mp-stat">
          <span class="mp-stat__value">{{ stats.totalItems }}</span>
          <span class="mp-stat__label">Items available</span>
        </div>
        <div class="mp-stat">
          <span class="mp-stat__value">{{ formatGold(Math.round(stats.avgPrice)) }}</span>
          <span class="mp-stat__label">Average price</span>
        </div>
        <div class="mp-stat">
          <Tag
            :value="rarityLabel(stats.mostPopularRarity as Rarity)"
            :severity="raritySeverity(stats.mostPopularRarity as Rarity)"
            class="mp-stat__tag"
          />
          <span class="mp-stat__label">Most popular rarity</span>
        </div>
      </template>
    </div>

    <div class="mp-body">
      <!-- Items column -->
      <div class="mp-items-col">
        <!-- Best deals strip -->
        <template v-if="bestDeals.length && !loadingOverview">
          <h2 class="mp-section-heading">
            <i class="pi pi-star-fill" /> Best deals
          </h2>
          <div class="mp-deals">
            <button
              v-for="deal in bestDeals"
              :key="deal._id"
              class="mp-deal-card"
              @click="openItem(deal)"
            >
              <Tag :value="rarityLabel(deal.rarity)" :severity="raritySeverity(deal.rarity)" class="mp-deal-card__rarity" />
              <p class="mp-deal-card__name">{{ deal.name }}</p>
              <div class="mp-deal-card__prices">
                <span class="mp-deal-card__current">{{ formatGold(deal.currentPrice) }}</span>
                <span class="mp-deal-card__base">{{ formatGold(deal.basePrice) }}</span>
              </div>
              <span class="mp-deal-card__discount">-{{ deal.discountPercent }}%</span>
            </button>
          </div>
        </template>

        <!-- Filters -->
        <div class="mp-filters">
          <div class="mp-filters__search-wrap">
            <i class="pi pi-search mp-filters__search-icon" aria-hidden="true" />
            <InputText
              v-model="searchQuery"
              placeholder="Search items…"
              class="mp-filters__search"
            />
          </div>
          <Select
            v-model="selectedCategory"
            :options="categoryOptions"
            option-label="label"
            option-value="value"
            class="mp-filters__select"
          />
          <Select
            v-model="selectedRarity"
            :options="RARITY_OPTIONS"
            option-label="label"
            option-value="value"
            class="mp-filters__select"
          />
        </div>

        <!-- Items grid -->
        <div v-if="loadingItems" class="mp-grid">
          <Skeleton v-for="i in 12" :key="i" height="120px" border-radius="var(--ss-radius)" />
        </div>

        <p v-else-if="itemsError" class="mp-error">{{ itemsError }}</p>

        <p v-else-if="filteredItems.length === 0" class="mp-empty">
          No items found for the current filters.
        </p>

        <div v-else class="mp-grid">
          <button
            v-for="item in filteredItems"
            :key="item._id"
            class="mp-item-card"
            :class="`mp-item-card--${item.rarity}`"
            @click="openItem(item)"
          >
            <div class="mp-item-card__header">
              <Tag
                :value="rarityLabel(item.rarity)"
                :severity="raritySeverity(item.rarity)"
                class="mp-item-card__rarity"
              />
              <div class="mp-item-card__badges">
                <span v-if="item.attunement" class="mp-badge mp-badge--attune" title="Requires attunement">⚡</span>
                <span v-if="item.consumable" class="mp-badge mp-badge--consume" title="Consumable">🔥</span>
                <span v-if="item.stock !== null" class="mp-badge mp-badge--stock">{{ item.stock }}×</span>
              </div>
            </div>
            <p class="mp-item-card__name">{{ item.name }}</p>
            <p class="mp-item-card__category">{{ item.category }}</p>
            <p class="mp-item-card__price">{{ formatGold(item.currentPrice) }}</p>
          </button>
        </div>
      </div>

      <!-- Activity sidebar -->
      <aside class="mp-sidebar">
        <!-- Gold placeholder -->
        <div class="mp-gold-card">
          <div class="mp-gold-card__header">
            <i class="pi pi-wallet mp-gold-card__icon" />
            <span class="mp-gold-card__label">Your balance</span>
          </div>
          <p class="mp-gold-card__hint">
            Link your Marketplace account to see your gold balance.
          </p>
          <a :href="MARKETPLACE_URL" target="_blank" rel="noopener">
            <Button label="Go to Marketplace" icon="pi pi-external-link" size="small" outlined />
          </a>
        </div>

        <!-- Recent purchases -->
        <div class="mp-recent">
          <h2 class="mp-section-heading">
            <i class="pi pi-history" /> Recent purchases
          </h2>
          <div v-if="loadingOverview" class="mp-recent__list">
            <Skeleton v-for="i in 6" :key="i" height="2.5rem" border-radius="4px" />
          </div>
          <ul v-else class="mp-recent__list">
            <li
              v-for="p in recentPurchases"
              :key="p.id"
              class="mp-recent__item"
            >
              <div class="mp-recent__item-body">
                <span class="mp-recent__buyer">{{ p.buyerUsername }}</span>
                <span class="mp-recent__item-name">{{ p.itemName }}</span>
              </div>
              <div class="mp-recent__item-end">
                <span class="mp-recent__cost">{{ formatGold(p.totalCost) }}</span>
                <span class="mp-recent__time">{{ timeAgo(p.purchasedAt) }}</span>
              </div>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <!-- Item detail dialog -->
    <Dialog
      :visible="!!selectedItem"
      :header="selectedItem?.name ?? ''"
      modal
      :draggable="false"
      class="mp-detail-dialog"
      @update:visible="selectedItem = null"
    >
      <template v-if="selectedItem">
        <div class="mp-detail">
          <div class="mp-detail__tags">
            <Tag
              :value="rarityLabel(selectedItem.rarity)"
              :severity="raritySeverity(selectedItem.rarity)"
            />
            <Tag v-if="selectedItem.attunement" value="Requires attunement" severity="secondary" />
            <Tag v-if="selectedItem.consumable" value="Consumable" severity="secondary" />
            <Tag v-if="selectedItem.oneTime" value="One-time" severity="secondary" />
            <Tag :value="selectedItem.category" severity="secondary" />
          </div>

          <p class="mp-detail__description">{{ selectedItem.description }}</p>

          <div class="mp-detail__pricing">
            <div class="mp-detail__price-row">
              <span class="mp-detail__price-label">Current price</span>
              <span class="mp-detail__price-value mp-detail__price-value--current">
                {{ formatGold(selectedItem.currentPrice) }}
              </span>
            </div>
            <div v-if="selectedItem.currentPrice !== selectedItem.basePrice" class="mp-detail__price-row">
              <span class="mp-detail__price-label">Base price</span>
              <span class="mp-detail__price-value">{{ formatGold(selectedItem.basePrice) }}</span>
            </div>
            <div v-if="selectedItem.stock !== null" class="mp-detail__price-row">
              <span class="mp-detail__price-label">Stock</span>
              <span class="mp-detail__price-value">{{ selectedItem.stock }}</span>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <Button label="Close" text @click="selectedItem = null" />
        <a
          v-if="selectedItem?.sourceUrl"
          :href="selectedItem.sourceUrl"
          target="_blank"
          rel="noopener"
        >
          <Button label="View source" icon="pi pi-external-link" text />
        </a>
        <a :href="MARKETPLACE_URL" target="_blank" rel="noopener">
          <Button label="Buy on Marketplace" icon="pi pi-shopping-cart" />
        </a>
      </template>
    </Dialog>
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

.mp-header__link {
  text-decoration: none;
}

/* ── Stats bar ── */
.mp-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.mp-stats--loading {
  gap: 0.75rem;
}

.mp-stat {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.85rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.mp-stat__value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ss-primary);
}

.mp-stat__tag {
  align-self: flex-start;
}

.mp-stat__label {
  font-size: 0.75rem;
  color: var(--ss-text-muted);
}

/* ── Body layout ── */
.mp-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1.25rem;
  align-items: start;
}

/* ── Section heading ── */
.mp-section-heading {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ss-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* ── Best deals ── */
.mp-deals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.mp-deal-card {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.65rem 0.75rem;
  text-align: left;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.mp-deal-card:hover {
  border-color: var(--ss-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--ss-primary) 15%, transparent);
}

.mp-deal-card__rarity {
  align-self: flex-start;
  font-size: 0.62rem !important;
}

.mp-deal-card__name {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ss-text);
  line-height: 1.2;
}

.mp-deal-card__prices {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.mp-deal-card__current {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ss-primary);
}

.mp-deal-card__base {
  font-size: 0.68rem;
  color: var(--ss-text-subtle, #aaa);
  text-decoration: line-through;
}

.mp-deal-card__discount {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--ss-success, #22c55e);
  color: #fff;
  border-radius: 3px;
  padding: 0.05em 0.3em;
}

/* ── Filters ── */
.mp-filters {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.mp-filters__search-wrap {
  position: relative;
  flex: 1;
  min-width: 160px;
}

.mp-filters__search-icon {
  position: absolute;
  left: 0.65rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--ss-text-muted);
  font-size: 0.85rem;
}

.mp-filters__search {
  width: 100%;
  padding-left: 2rem !important;
}

.mp-filters__select {
  min-width: 140px;
}

/* ── Item grid ── */
.mp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
}

.mp-item-card {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.75rem;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.mp-item-card:hover {
  border-color: var(--ss-primary);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--ss-primary) 12%, transparent);
}

.mp-item-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.3rem;
}

.mp-item-card__rarity {
  font-size: 0.6rem !important;
  flex-shrink: 0;
}

.mp-item-card__badges {
  display: flex;
  gap: 0.2rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mp-badge {
  font-size: 0.65rem;
  border-radius: 3px;
  padding: 0.05em 0.3em;
}

.mp-badge--stock {
  background: color-mix(in srgb, var(--ss-text-muted) 15%, transparent);
  color: var(--ss-text-muted);
  font-weight: 600;
}

.mp-item-card__name {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ss-text);
  line-height: 1.3;
}

.mp-item-card__category {
  margin: 0;
  font-size: 0.7rem;
  color: var(--ss-text-muted);
}

.mp-item-card__price {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ss-primary);
}

/* ── States ── */
.mp-error,
.mp-empty {
  padding: 2rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--ss-text-muted);
}

.mp-error { color: var(--ss-danger); }

/* ── Sidebar ── */
.mp-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Gold card */
.mp-gold-card {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.mp-gold-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mp-gold-card__icon {
  font-size: 1.1rem;
  color: var(--ss-primary);
}

.mp-gold-card__label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ss-text);
}

.mp-gold-card__hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ss-text-muted);
  line-height: 1.4;
}

/* Recent purchases */
.mp-recent {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  overflow: hidden;
}

.mp-recent .mp-section-heading {
  padding: 0.75rem 1rem 0.6rem;
  margin: 0;
  border-bottom: 1px solid var(--ss-border);
}

.mp-recent__list {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0;
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.mp-recent__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
}

.mp-recent__item-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mp-recent__buyer {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ss-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mp-recent__item-name {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mp-recent__item-end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.mp-recent__cost {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ss-text);
}

.mp-recent__time {
  font-size: 0.65rem;
  color: var(--ss-text-subtle, #aaa);
}

/* ── Detail dialog ── */
.mp-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 300px;
  max-width: 480px;
}

.mp-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.mp-detail__description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--ss-text);
  line-height: 1.6;
  white-space: pre-wrap;
}

.mp-detail__pricing {
  background: color-mix(in srgb, var(--ss-primary) 5%, var(--ss-surface));
  border: 1px solid color-mix(in srgb, var(--ss-primary) 20%, transparent);
  border-radius: var(--ss-radius-sm, 6px);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.mp-detail__price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.mp-detail__price-label {
  font-size: 0.78rem;
  color: var(--ss-text-muted);
}

.mp-detail__price-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ss-text);
}

.mp-detail__price-value--current {
  font-size: 1.1rem;
  color: var(--ss-primary);
}

/* ── Responsive ── */
@media (max-width: 767px) {
  .mp-body {
    grid-template-columns: 1fr;
  }

  .mp-sidebar {
    order: -1;
  }

  .mp-stats {
    grid-template-columns: 1fr 1fr;
  }

  .mp-stats > :last-child {
    grid-column: 1 / -1;
  }
}
</style>
