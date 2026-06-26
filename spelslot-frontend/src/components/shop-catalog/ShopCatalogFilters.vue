<script setup lang="ts">
import { computed, inject } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import ToggleButton from 'primevue/togglebutton'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { ShopCatalogFiltersKey } from './useShopCatalogFilters'
import { useShopCatalogI18n } from './useShopCatalogI18n'
import { rarityLabel } from './helpers'
import type { ShopItem, Rarity } from './types'

const props = defineProps<{ items: ShopItem[] }>()

const { t } = useShopCatalogI18n()
const { filters, hideSoldOut, hasActiveFilters, clearFilters } = inject(ShopCatalogFiltersKey)!

// Category and rarity options are derived from the items currently supplied.
const categoryOptions = computed(() => Array.from(new Set(props.items.map((i) => i.category))).sort())

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'very_rare', 'legendary']
const rarityOptions = computed(() =>
  RARITIES.map((r) => ({ label: t(rarityLabel(r)), value: r })),
)

// Values are the i18n keys returned by stockLabel(), so they match what the
// lists compare against when filtering by stock status.
const stockStatusOptions = computed(() => [
  { label: t('shop.stock.inStock'), value: 'shop.stock.inStock' },
  { label: t('shop.stock.limited'), value: 'shop.stock.limited' },
  { label: t('shop.stock.low'), value: 'shop.stock.low' },
  { label: t('shop.stock.critical'), value: 'shop.stock.critical' },
  { label: t('shop.stock.soldOut'), value: 'shop.stock.soldOut' },
])
</script>

<template>
  <div class="item-filters">
    <!-- Row 1: Search (full width) -->
    <IconField class="item-filters__search">
      <InputIcon><i class="pi pi-search" /></InputIcon>
      <InputText v-model="filters['global'].value" :placeholder="t('shop.filters.search')" fluid />
    </IconField>

    <!-- Row 2: Selects + toggle -->
    <div class="item-filters__row">
      <MultiSelect
        v-model="filters['category'].value"
        :options="categoryOptions"
        :placeholder="t('shop.filters.allCategories')"
        display="chip"
        filter
        show-clear
        class="item-filters__select"
      />

      <MultiSelect
        v-model="filters['rarity'].value"
        :options="rarityOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('shop.filters.allRarities')"
        display="chip"
        filter
        show-clear
        class="item-filters__select"
      />

      <MultiSelect
        v-model="filters['stockStatus'].value"
        :options="stockStatusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('shop.table.stock')"
        display="chip"
        filter
        show-clear
        class="item-filters__select"
      />

      <InputNumber
        v-model="filters['currentPrice'].value"
        :placeholder="t('shop.filters.maxPrice')"
        :min="0"
        fluid
        class="item-filters__price"
        :use-grouping="false"
      />

      <Button
        v-if="hasActiveFilters"
        :label="t('common.actions.clear')"
        icon="pi pi-filter-slash"
        severity="secondary"
        text
        size="small"
        @click="clearFilters"
      />

      <ToggleButton
        v-model="hideSoldOut"
        :on-label="t('shop.filters.soldOutHidden')"
        :off-label="t('shop.filters.showSoldOut')"
        on-icon="pi pi-eye-slash"
        off-icon="pi pi-eye"
        class="item-filters__toggle"
      />
    </div>
  </div>
</template>

<style scoped>
.item-filters {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.item-filters__search {
  width: 100%;
}

@media (min-width: 769px) {
  .item-filters__search {
    max-width: 420px;
  }
}

.item-filters__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.item-filters__select {
  width: 200px;
}

.item-filters__price {
  flex: 0 1 130px;
  min-width: 110px;
  height: -webkit-fill-available;
  height: stretch;
}

.item-filters__toggle {
  flex-shrink: 0;
  margin-left: auto;
}

/* On small screens, price input & toggle fill available space */
@media (max-width: 480px) {
  .item-filters__select,
  .item-filters__price {
    flex: 1 1 calc(50% - 0.25rem);
  }

  .item-filters__toggle {
    flex: 1 1 100%;
  }
}
</style>
