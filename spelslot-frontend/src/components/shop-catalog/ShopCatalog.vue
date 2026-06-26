<script setup lang="ts">
import { ref, provide } from 'vue'
import { useIsMobile } from './useIsMobile'
import { useShopCatalogFilters, ShopCatalogFiltersKey } from './useShopCatalogFilters'
import ShopCatalogFilters from './ShopCatalogFilters.vue'
import ShopCatalogTable from './desktop/ShopCatalogTable.vue'
import ShopCatalogList from './mobile/ShopCatalogList.vue'
import ShopCatalogDialog from './ShopCatalogDialog.vue'
import type { ShopItem } from './types'

const props = defineProps<{
  /** Items to display. The host app owns fetching; the catalog is read-only. */
  items: ShopItem[]
  /**
   * Builds the external URL shown as a "View in marketplace" button in the
   * detail dialog. Return `undefined` (or omit the prop) to hide the button.
   */
  itemUrl?: (item: ShopItem) => string | undefined
}>()

const { isMobile } = useIsMobile()

// Filter state is created here and shared with the filters bar + lists.
const filtersState = useShopCatalogFilters()
provide(ShopCatalogFiltersKey, filtersState)

const dialogVisible = ref(false)
const selectedItem = ref<ShopItem | null>(null)

function openDialog(item: ShopItem) {
  selectedItem.value = item
  dialogVisible.value = true
}
</script>

<template>
  <div class="shop-catalog">
    <ShopCatalogFilters :items="props.items" />
    <ShopCatalogList v-if="isMobile" :items="props.items" @item-click="openDialog" />
    <ShopCatalogTable v-else :items="props.items" @row-click="openDialog" />

    <ShopCatalogDialog
      v-model:visible="dialogVisible"
      :item="selectedItem"
      :item-url="props.itemUrl"
    />
  </div>
</template>
