<script setup lang="ts">
import { computed, inject } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import {
  ShopCatalogFiltersKey,
  useShopCatalogFilters,
} from '../useShopCatalogFilters'
import { useShopCatalogI18n } from '../useShopCatalogI18n'
import { stockLabel, stockSeverity, stockClass, priceTrend, raritySeverity, rarityLabel, itemDisplayName, itemIcon } from '../helpers'
import type { ShopItem } from '../types'

const props = defineProps<{ items: ShopItem[] }>()
const emit = defineEmits<{ 'row-click': [item: ShopItem] }>()

const { t, formatGold } = useShopCatalogI18n()

const { filters, hideSoldOut } = inject(ShopCatalogFiltersKey, () => useShopCatalogFilters(), true)

const itemsWithStatus = computed(() =>
  props.items
    .filter((item) => !hideSoldOut.value || item.stock !== 0)
    .map((item) => ({
      ...item,
      stockStatus: stockLabel(item.stock, item.maxStock),
    })),
)
</script>

<template>
  <DataTable
    v-model:filters="filters"
    :value="itemsWithStatus"
    :row-hover="true"
    striped-rows
    paginator
    :rows="25"
    :rows-per-page-options="[25, 50, 100]"
    removableSort
    size="small"
    responsive-layout="scroll"
    :global-filter-fields="['name', 'category', 'rarity', 'description']"
    class="item-table"
    @row-click="(e) => emit('row-click', e.data as ShopItem)"
  >
    <template #empty>
      <span class="table__empty">{{ t('shop.empty') }}</span>
    </template>

    <Column header="" style="width: 48px; padding-right: 0" :show-filter-menu="false">
      <template #body="{ data }: { data: ShopItem }">
        <div class="col-icon">
          <img v-if="data.imageUrl" :src="data.imageUrl" :alt="data.name" class="col-icon__img" />
          <span v-else class="col-icon__fallback pi" :class="itemIcon(data.category)" />
        </div>
      </template>
    </Column>

    <Column field="name" :header="t('shop.table.name')" sortable style="min-width: 180px">
      <template #body="{ data }: { data: ShopItem }">
        <span class="col-name">{{ itemDisplayName(data.name, data.baseLvl) }}</span>
      </template>
    </Column>

    <Column field="category" :header="t('shop.table.category')" sortable style="min-width: 130px" />

    <Column field="rarity" :header="t('shop.table.rarity')" sortable style="min-width: 120px">
      <template #body="{ data }: { data: ShopItem }">
        <Tag :value="t(rarityLabel(data.rarity))" :severity="raritySeverity(data.rarity)" style="text-transform: capitalize" />
      </template>
    </Column>

    <Column field="currentPrice" :header="t('shop.table.price')" sortable style="min-width: 120px">
      <template #body="{ data }: { data: ShopItem }">
        <span class="col-price">
          {{ formatGold(data.currentPrice) }}
          <span
            v-if="priceTrend(data.currentPrice, data.basePrice)"
            class="price-trend"
            :class="{
              'price-trend--up': data.currentPrice > data.basePrice,
              'price-trend--down': data.currentPrice < data.basePrice,
            }"
          >
            {{ priceTrend(data.currentPrice, data.basePrice) }}
          </span>
        </span>
      </template>
    </Column>

    <Column field="stock" filter-field="stockStatus" :header="t('shop.table.stock')" style="min-width: 120px">
      <template #body="{ data }: { data: ShopItem }">
        <Tag
          :value="t(stockLabel(data.stock, data.maxStock))"
          :severity="stockSeverity(data.stock, data.maxStock)"
          :class="stockClass(data.stock, data.maxStock)"
        />
      </template>
    </Column>

    <Column :header="t('shop.table.tags')" style="min-width: 130px" :show-filter-menu="false">
      <template #body="{ data }: { data: ShopItem }">
        <div class="item-tags-col">
          <Tag v-if="data.oneTime" :value="t('shop.tags.opc')" severity="danger" v-tooltip="{ value: t('shop.tags.opcTooltip'), showDelay: 200 }" />
          <Tag v-if="data.consumable" :value="t('shop.tags.cons')" severity="warning" v-tooltip="{ value: t('shop.tags.consTooltip'), showDelay: 200 }" />
          <Tag
            v-if="data.attunement"
            :value="data.subAttunement?.length ? t('shop.tags.attWithClass', { classes: data.subAttunement.join(', ') }) : t('shop.tags.att')"
            severity="info"
            v-tooltip="{ value: data.subAttunement?.length ? t('shop.tags.subAttunementTooltip', { classes: data.subAttunement.join(', ') }) : t('shop.tags.attunementTooltip'), showDelay: 200 }"
          />
          <Tag v-if="(data.monthlyMaxQuantity ?? 0) > 0" :value="t('shop.tags.mmq')" severity="info" v-tooltip="{ value: t('shop.tags.mmqTooltip', { count: data.monthlyMaxQuantity }), showDelay: 200 }" />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.item-table {
  cursor: pointer;
}

.table__empty {
  display: block;
  text-align: center;
  padding: 2rem 0;
  color: var(--p-text-muted-color);
}

.col-name {
  font-weight: 600;
}

.col-price {
  font-weight: 700;
}

.price-trend {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-left: 0.2rem;
}

.price-trend--up {
  color: var(--p-red-500);
}

.price-trend--down {
  color: var(--p-green-500);
}

.col-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.col-icon__img {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
}

.col-icon__fallback {
  font-size: 1.1rem;
  color: var(--p-text-muted-color);
}

.item-tags-col {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
</style>
