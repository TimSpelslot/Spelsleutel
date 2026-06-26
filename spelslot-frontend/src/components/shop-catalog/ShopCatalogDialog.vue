<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Divider from 'primevue/divider'
import { stockLabel, stockSeverity, stockClass, priceTrend, raritySeverity, rarityLabel, itemDisplayName } from './helpers'
import { useShopCatalogI18n } from './useShopCatalogI18n'
import type { ShopItem } from './types'

const props = defineProps<{
  item: ShopItem | null
  visible: boolean
  /** Builds the external "View in marketplace" link for an item. Return undefined to hide the button. */
  itemUrl?: (item: ShopItem) => string | undefined
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { t, formatGold } = useShopCatalogI18n()

const visibleModel = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const isConsumable = computed(() => props.item?.consumable === true)
const hasMonthlyMax = computed(() => (props.item?.monthlyMaxQuantity ?? 0) > 0)

const marketplaceHref = computed(() => (props.item && props.itemUrl ? props.itemUrl(props.item) : undefined))
</script>

<template>
  <Dialog
    v-model:visible="visibleModel"
    :header="item ? itemDisplayName(item.name, item.baseLvl) : ''"
    :modal="true"
    :draggable="false"
    :style="{ width: '38rem', maxWidth: '95vw' }"
  >
    <template v-if="item">
      <!-- Rarity + tags row -->
      <div class="dialog__meta">
        <Tag :value="t(rarityLabel(item.rarity))" :severity="raritySeverity(item.rarity)" style="text-transform: capitalize" />
        <Tag v-if="item.oneTime" :value="t('shop.tags.onePerCharacter')" severity="danger" class="dialog__one-per-character-tag" v-tooltip.top="t('shop.tags.onePerCharacterTooltip')" />
        <Tag v-if="isConsumable" :value="t('shop.tags.consumable')" severity="warn" v-tooltip.top="t('shop.tags.consumableTooltip')" />
        <Tag
          v-if="item.attunement"
          :value="item.subAttunement?.length ? t('shop.tags.requiresAttunementForClass', { classes: item.subAttunement.join(', ') }) : t('shop.tags.requiresAttunement')"
          severity="info"
          v-tooltip.top="item.subAttunement?.length ? t('shop.tags.subAttunementTooltip', { classes: item.subAttunement.join(', ') }) : t('shop.tags.attunementTooltip')"
        />
        <Tag
          v-if="hasMonthlyMax"
          :value="t('shop.tags.monthlyMaxTag', { count: item.monthlyMaxQuantity })"
          severity="info"
          v-tooltip.top="t('shop.tags.monthlyMaxTooltip')"
        />
      </div>

      <!-- Description -->
      <p class="dialog__description">{{ item.description }}</p>

      <!-- Source link -->
      <Button
        v-if="item.sourceUrl"
        :as="'a'"
        :href="item.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        :label="t('shop.detail.viewSource')"
        link
        size="small"
        class="dialog__source"
      />

      <Divider />

      <!-- Price & stock -->
      <div class="dialog__price-row">
        <div>
          <span class="dialog__price">{{ formatGold(item.currentPrice) }}</span>
          <span
            v-if="priceTrend(item.currentPrice, item.basePrice)"
            class="dialog__trend"
            :class="{
              'dialog__trend--up': item.currentPrice > item.basePrice,
              'dialog__trend--down': item.currentPrice < item.basePrice,
            }"
          >
            {{ priceTrend(item.currentPrice, item.basePrice) }}
            ({{ t('shop.detail.base', { price: formatGold(item.basePrice) }) }})
          </span>
        </div>
        <Tag :value="t(stockLabel(item.stock, item.maxStock))" :severity="stockSeverity(item.stock, item.maxStock)" :class="stockClass(item.stock, item.maxStock)" />
      </div>

      <!-- Stock remaining -->
      <p class="dialog__stock-count">
        <template v-if="item.maxStock === null">{{ t('shop.detail.remainingInfinite') }}</template>
        <template v-else-if="item.stock !== null">{{ t('shop.detail.remaining', { stock: item.stock, max: item.maxStock }) }}</template>
      </p>
    </template>

    <template #footer>
      <Button :label="t('common.actions.close')" severity="secondary" text @click="emit('update:visible', false)" />
      <Button
        v-if="marketplaceHref"
        :as="'a'"
        :href="marketplaceHref"
        target="_blank"
        rel="noopener noreferrer"
        :label="t('shop.detail.viewOnSite')"
        icon="pi pi-external-link"
        icon-pos="right"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog__meta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.dialog__description {
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.dialog__price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.dialog__price {
  font-size: 1.3rem;
  font-weight: 700;
}

.dialog__trend {
  margin-left: 0.4rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.dialog__trend--up {
  color: var(--p-red-500);
}

.dialog__trend--down {
  color: var(--p-green-500);
}

.dialog__stock-count {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.dialog__one-per-character-tag {
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
