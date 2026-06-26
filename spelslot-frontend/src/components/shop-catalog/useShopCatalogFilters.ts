import { ref, computed, type InjectionKey } from 'vue'
import { FilterMatchMode } from '@primevue/core/api'

export type ShopCatalogFiltersReturn = ReturnType<typeof useShopCatalogFilters>

/** Provided by `ShopCatalog`, injected by the filters bar and the desktop/mobile lists. */
export const ShopCatalogFiltersKey: InjectionKey<ShopCatalogFiltersReturn> = Symbol('ShopCatalogFilters')

/**
 * Reactive, store-free filter state for the read-only catalog.
 *
 * `global` (search), `category`, `rarity`, `currentPrice`, and `stockStatus`
 * are consumed by the desktop PrimeVue DataTable (via `v-model:filters`) and
 * re-implemented manually for the mobile list. Unlike the full marketplace,
 * nothing is mirrored to a Pinia store — filtering is purely client-side over
 * the `items` prop.
 */
export function useShopCatalogFilters() {
  const hideSoldOut = ref(true)

  const filters = ref({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    category: { value: [] as string[], matchMode: FilterMatchMode.IN },
    rarity: { value: [] as string[], matchMode: FilterMatchMode.IN },
    currentPrice: { value: null as number | null, matchMode: FilterMatchMode.LESS_THAN_OR_EQUAL_TO },
    stockStatus: { value: [] as string[], matchMode: FilterMatchMode.IN },
  })

  const hasActiveFilters = computed(
    () =>
      !!filters.value.global.value ||
      !!filters.value.name.value ||
      filters.value.category.value.length > 0 ||
      filters.value.rarity.value.length > 0 ||
      filters.value.currentPrice.value !== null ||
      filters.value.stockStatus.value.length > 0,
  )

  function clearFilters() {
    filters.value.global.value = null
    filters.value.name.value = null
    filters.value.category.value = []
    filters.value.rarity.value = []
    filters.value.currentPrice.value = null
    filters.value.stockStatus.value = []
  }

  return { filters, hideSoldOut, hasActiveFilters, clearFilters }
}
