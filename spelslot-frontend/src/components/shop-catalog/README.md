# Shop Catalog (read-only, exportable)

A self-contained, **read-only** version of the marketplace shop: it displays
items in a filterable table (desktop) / card list (mobile) and opens a detail
dialog on click. There is **no purchasing, no auth, no gold balance** — the
detail dialog's only call-to-action is an optional "View in marketplace" link
that sends the user to the live website.

This whole folder is dependency-free of the host repo: it imports only `vue`,
`vue-i18n`, and `primevue`. Copy the entire `shop-catalog/` directory into
another app and it works as-is.

## Usage

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ShopCatalog, type ShopItem } from './shop-catalog'

const items = ref<ShopItem[]>([])

onMounted(async () => {
  const res = await fetch('https://your-api.example.com/api/items')
  items.value = await res.json()
})

// Build the link the "View in marketplace" button points at.
const itemUrl = (item: ShopItem) => `https://marketplace.example.com/shop?item=${item.id}`
</script>

<template>
  <ShopCatalog :items="items" :item-url="itemUrl" />
</template>
```

## Props

| Prop      | Type                                      | Required | Description                                                                                   |
| --------- | ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `items`   | `ShopItem[]`                              | yes      | Items to display. **The host owns fetching** — the catalog never makes network calls.         |
| `itemUrl` | `(item: ShopItem) => string \| undefined` | no       | Builds the external URL for the dialog's "View in marketplace" button. Return `undefined` (or omit) to hide the button. Opens in a new tab. |

The `ShopItem` type is exported from the barrel — see [`types.ts`](./types.ts)
for the full shape. It mirrors the marketplace's API item, minus purchase-only
fields. Unknown extra fields on the objects are ignored.

## Host requirements

The host app must already provide:

1. **Vue 3** (`^3.5`).
2. **vue-i18n** (`^9` or `^11`) installed in **Composition mode**
   (`createI18n({ legacy: false })`). The catalog bundles its own `en`/`nl`
   strings in a component-local scope, so you do **not** need to add any keys to
   your catalog. The scope inherits your app's active locale, so switching
   language re-renders the catalog automatically. To add a locale, extend
   [`messages.ts`](./messages.ts).
3. **PrimeVue** (`^4`) registered via `app.use(PrimeVue, …)`, plus:
   - the **tooltip directive**: `app.directive('tooltip', Tooltip)` (used by the
     tag tooltips; without it the tags still render, just without hover text).
   - **PrimeIcons** CSS imported (`import 'primeicons/primeicons.css'`) — used
     for the category fallback icons and the search/chevron icons.
   - a PrimeVue theme (the styles reference theme CSS vars like
     `--p-surface-200`, `--p-red-500`).

PrimeVue components used (all auto-imported by the `.vue` files, no global
registration needed): `DataTable`, `Column`, `Tag`, `DataView`, `Select`,
`InputText`, `InputNumber`, `MultiSelect`, `ToggleButton`, `Button`,
`IconField`, `InputIcon`, `Dialog`, `Divider`.

## Layout & responsiveness

- Switches between desktop table and mobile cards at **< 768px** (viewport
  width, via `useIsMobile`). Same breakpoint and component-split convention as
  the full marketplace.
- The component renders inline (no fixed positioning); wrap it in your own
  page/section container and heading.

## What was intentionally removed vs. the full shop

- Quantity selector, "Buy" button, login prompt, affordability / ownership /
  monthly-limit warnings.
- All Pinia store, auth, router, and API-service dependencies.
- Filtering is purely client-side over the `items` prop (the full shop also
  pushes the search term to the backend; here there is no backend).
