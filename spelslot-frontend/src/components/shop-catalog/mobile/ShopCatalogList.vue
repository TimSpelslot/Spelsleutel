<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import DataView from 'primevue/dataview'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import {
  ShopCatalogFiltersKey,
  useShopCatalogFilters,
} from '../useShopCatalogFilters'
import { useShopCatalogI18n } from '../useShopCatalogI18n'
import { stockLabel, stockSeverity, stockClass, priceTrend, raritySeverity, rarityLabel, itemDisplayName, itemIcon } from '../helpers'
import type { ShopItem } from '../types'

const props = defineProps<{ items: ShopItem[] }>()
const emit = defineEmits<{ 'item-click': [item: ShopItem] }>()

const { t, formatGold } = useShopCatalogI18n()
const { filters, hideSoldOut } = inject(ShopCatalogFiltersKey, useShopCatalogFilters())

const sortField = ref('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

const sortOptions = computed(() => [
  { label: t('shop.sort.nameAsc'), value: 'name-asc' },
  { label: t('shop.sort.nameDesc'), value: 'name-desc' },
  { label: t('shop.sort.priceLow'), value: 'price-asc' },
  { label: t('shop.sort.priceHigh'), value: 'price-desc' },
  { label: t('shop.sort.rarity'), value: 'rarity-asc' },
])

const sortValue = computed({
  get: () => `${sortField.value}-${sortOrder.value}`,
  set: (v: string) => {
    const [field, order] = v.split('-')
    sortField.value = field ?? 'name'
    sortOrder.value = (order as 'asc' | 'desc') ?? 'asc'
  },
})

const rarityOrder: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, very_rare: 3, legendary: 4,
}

const filtered = computed(() => {
  const q = (filters.value.global.value ?? '').toLowerCase()
  const cat = filters.value.category.value
  const rar = filters.value.rarity.value
  const maxPrice = filters.value.currentPrice.value
  const stockStatus = filters.value.stockStatus.value

  return props.items
    .filter((item) => {
      if (hideSoldOut.value && item.stock === 0) return false
      if (cat.length && !cat.includes(item.category)) return false
      if (rar.length && !rar.includes(item.rarity)) return false
      if (maxPrice !== null && item.currentPrice > maxPrice) return false
      // stockStatus holds i18n keys; stockLabel() returns the same key
      if (stockStatus.length && !stockStatus.includes(stockLabel(item.stock, item.maxStock))) return false
      if (q) {
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.rarity.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      let result = 0
      if (sortField.value === 'name') result = a.name.localeCompare(b.name)
      else if (sortField.value === 'price') result = a.currentPrice - b.currentPrice
      else if (sortField.value === 'rarity') result = (rarityOrder[a.rarity] ?? 0) - (rarityOrder[b.rarity] ?? 0)
      return sortOrder.value === 'asc' ? result : -result
    })
})
</script>

<template>
  <div class="item-list">
    <!-- ── Sort ──────────────────────────────────────────────── -->
    <div class="item-list__sort-row">
      <Select
        v-model="sortValue"
        :options="sortOptions"
        option-label="label"
        option-value="value"
        size="small"
        class="item-list__sort"
      />
    </div>

    <!-- ── Empty state ───────────────────────────────────────── -->
    <div v-if="filtered.length === 0" class="item-list__empty">
      {{ t('shop.empty') }}
    </div>

    <!-- ── DataView list ─────────────────────────────────────── -->
    <DataView v-else :value="filtered" :rows="20" paginator>
      <template #list="slotProps">
        <div class="item-cards">
          <button
            v-for="item in (slotProps.items as ShopItem[])"
            :key="item.id"
            class="item-card"
            @click="emit('item-click', item)"
          >
            <div class="item-card__icon">
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="item-card__img" />
              <span v-else class="item-card__fallback pi" :class="itemIcon(item.category)" />
            </div>
            <div class="item-card__body">
              <div class="item-card__top">
                <span class="item-card__name">{{ itemDisplayName(item.name, item.baseLvl) }}</span>
                <Tag :value="t(rarityLabel(item.rarity))" :severity="raritySeverity(item.rarity)" class="item-card__rarity" />
              </div>
              <div class="item-card__meta">
                <span class="item-card__category">{{ item.category }}</span>
                <span class="item-card__price">
                  {{ formatGold(item.currentPrice) }}
                  <span
                    v-if="priceTrend(item.currentPrice, item.basePrice)"
                    class="item-card__trend"
                    :class="{
                      'item-card__trend--up': item.currentPrice > item.basePrice,
                      'item-card__trend--down': item.currentPrice < item.basePrice,
                    }"
                  >{{ priceTrend(item.currentPrice, item.basePrice) }}</span>
                </span>
              </div>
              <div class="item-card__bottom">
                <Tag
                  :value="t(stockLabel(item.stock, item.maxStock))"
                  :severity="stockSeverity(item.stock, item.maxStock)"
                  :class="stockClass(item.stock, item.maxStock)"
                  class="item-card__stock"
                />
                <div class="item-card__tags">
                  <Tag v-if="item.oneTime" :value="t('shop.tags.opc')" severity="danger" />
                  <Tag v-if="item.consumable" :value="t('shop.tags.cons')" severity="warning" />
                  <Tag
                    v-if="item.attunement"
                    :value="item.subAttunement?.length ? t('shop.tags.attWithClass', { classes: item.subAttunement.join(', ') }) : t('shop.tags.att')"
                    severity="info"
                  />
                  <Tag v-if="(item.monthlyMaxQuantity ?? 0) > 0" :value="t('shop.tags.mmq')" severity="info" />
                </div>
              </div>
            </div>
            <i class="pi pi-chevron-right item-card__arrow" />
          </button>
        </div>
      </template>
    </DataView>
  </div>
</template>

<style scoped>
.item-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Sort row ─────────────────────────────────────────────── */
.item-list__sort-row {
  display: flex;
  padding: 0 0.25rem;
}

.item-list__sort {
  flex: 1;
}

/* ── Empty ────────────────────────────────────────────────── */
.item-list__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--p-text-muted-color);
}

/* ── Cards ────────────────────────────────────────────────── */
.item-cards {
  display: flex;
  flex-direction: column;
}

.item-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--p-surface-200);
  background: transparent;
  border-left: none;
  border-right: none;
  border-top: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: inherit;
  color: inherit;
  transition: background 0.15s;
}

.item-card:first-child {
  border-top: 1px solid var(--p-surface-200);
}

.item-card:active {
  background: var(--p-surface-100);
}

.item-card__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-card__img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 6px;
}

.item-card__fallback {
  font-size: 1.3rem;
  color: var(--p-text-muted-color);
}

.item-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-card__top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.item-card__name {
  font-weight: 700;
  font-size: 0.95rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card__rarity {
  font-size: 0.7rem;
  flex-shrink: 0;
}

.item-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.item-card__category {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.item-card__price {
  font-weight: 700;
  font-size: 0.9rem;
}

.item-card__trend {
  font-size: 0.72rem;
  margin-left: 0.15rem;
}

.item-card__trend--up {
  color: var(--p-red-500);
}

.item-card__trend--down {
  color: var(--p-green-500);
}

.item-card__bottom {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.item-card__stock {
  font-size: 0.72rem;
}

.item-card__tags {
  display: flex;
  gap: 0.25rem;
}

.item-card__arrow {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  flex-shrink: 0;
}
</style>
