import { useI18n, type UseI18nOptions } from 'vue-i18n'
import { messages } from './messages'

/**
 * Component-local i18n for the Shop Catalog.
 *
 * Uses a **local scope** seeded with the catalog's own `messages`, so the keys
 * live entirely inside this folder — the host never has to merge them into its
 * global catalog. `inheritLocale` keeps the scope in sync with the host's active
 * locale (so switching language in the host re-renders the catalog), falling
 * back to `en`.
 *
 * Call this in any catalog component instead of `useI18n()` directly.
 */
export function useShopCatalogI18n() {
  // The host repo augments vue-i18n's global `DefineLocaleMessage`, which would
  // otherwise force these component-local messages to satisfy the host's full
  // message schema (and reject catalog-only keys like `shop.detail.viewOnSite`).
  // Casting the options to the generic `UseI18nOptions` keeps this folder's
  // i18n fully self-contained, independent of any host augmentation.
  const { t, locale } = useI18n({
    useScope: 'local',
    inheritLocale: true,
    fallbackLocale: 'en',
    messages,
  } as unknown as UseI18nOptions)

  /** Locale-aware gold formatting: 1234 -> "1,234 gp" (en) / "1.234 gp" (nl). */
  function formatGold(amount: number): string {
    const tag = locale.value === 'nl' ? 'nl-NL' : 'en-US'
    const formatted = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(amount)
    return t('common.gold', { amount: formatted })
  }

  return { t, locale, formatGold }
}
