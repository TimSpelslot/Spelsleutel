---
applyTo: "Item-Marketplace-Frontend/**"
---

# Frontend Conventions — Vue 3 + TypeScript

## 1. Vue 3 Component Conventions

### `<script setup lang="ts">` exclusively
Every component uses `<script setup lang="ts">`. Options API is never used.

### Props — typed generic, no runtime options object
Use `defineProps<{...}>()`. Use `withDefaults` only when a non-`undefined` default is required.

### Emits — typed generic syntax
Use `defineEmits<{(e: 'event-name', ...): void}>()`. Event names must be kebab-case both when emitting and listening — Vue converts camelCase for props but **not** for events.

### Props — camelCase in `<script>`, kebab-case in templates
Declare props in camelCase in `defineProps`. Always use kebab-case in parent templates.

### `toRef(props, 'field')` when passing props to composables
```ts
const itemRef = toRef(props, 'item')
const { quantity, canAfford } = usePurchaseConstraints(itemRef)
```

### `provide` / `inject` with typed `InjectionKey`
```ts
export type ItemGridFiltersReturn = ReturnType<typeof useItemGridFilters>
export const ItemGridFiltersKey: InjectionKey<ItemGridFiltersReturn> = Symbol('ItemGridFilters')
provide(ItemGridFiltersKey, filtersState)   // parent
const filters = inject(ItemGridFiltersKey)! // child
```

### Dialog components
- Named `*Dialog.vue`, **never** `*Modal.vue`.
- Always use PrimeVue `<Dialog>` with `v-model:visible`, `modal`, and `:header` prop.
- Emit `'update:visible'` to let the parent close the dialog.

### Mobile / desktop split
Separate subcomponents in `desktop/` and `mobile/` directories. Parent switches with `v-if="isMobile"` / `v-else`. Never CSS-only hiding.

### App bootstrap order (`main.ts`)
`main.ts` awaits `auth.init()` **before** `app.use(router)` to prevent guards firing against uninitialised auth state. PrimeVue registration order: PrimeVue → Pinia → ConfirmationService → ToastService → `v-tooltip` → Router. Dark mode applied at module level to prevent FOUC.

### Template rules
- `:key` in `v-for` — always a stable unique ID, never array index.
- Never co-locate `v-if` and `v-for` — filter through `computed`.
- `watch(dep, fn, { immediate: true })` instead of duplicating in `onMounted` + watcher.
- Template expressions must be simple — complex logic belongs in `computed` or composable.
- Always use directive shorthands (`@`, `:`, `#`).

### Component naming
- Single-instance: `The` prefix — `TheHeader.vue`.
- Purely presentational: `Base` prefix — `BaseButton.vue`.

---

## 2. Pinia Store Patterns

### Always use the Setup Store (Composition API) form
`defineStore('name', () => { ... })`. Never Options Store.

### Standard state shape
```ts
const items   = ref<Item[]>([])
const loading = ref(false)
const error   = ref<string | null>(null)
```
Multiple independent async domains each get their own `loading`/`error` pair.

### Async action skeleton
Services return `Promise<Result<T>>`. Stores **never** use `try/catch` — pattern-match on `result.type`. Double-submission guard is the **first line**. See canonical example: `Item-Marketplace-Frontend/src/stores/items.ts:38`

Actions that communicate failure to the caller return `Result<T>` — same skeleton, add `return result`. Never re-throw.

### Settings store — generic request wrapper
When many actions share the same loading/error pair, wrap them. See: `Item-Marketplace-Frontend/src/stores/admin.ts:86`

### Other store rules
- **Getters** — always `computed(() => ...)`, never plain functions.
- **Cross-store access** — call `useOtherStore()` inside the action body, never at `defineStore` top level.
- **Mutations** — update in-place, never re-fetch after a mutation.
- **LocalStorage keys** — explicit named string constants. Never inline literals.

---

## 3. Service Layer

### Services are plain named singleton objects
Services own all `try/catch`. Every method returns `Promise<Result<T>>`. No classes, no `new`. See canonical example: `Item-Marketplace-Frontend/src/services/itemsService.ts:29`

### `api.ts` — the single HTTP client
All services call through `api` (wraps `fetch`). Methods: `get`, `post`, `put`, `patch`, `delete`. Base URL: `import.meta.env.VITE_API_URL` with `/api` fallback.

### Error normalisation in `api.ts`
- Network failure → `'Network error — check your internet connection and try again.'`
- HTTP 401 generic → `'You are not logged in. Please log in and try again.'`
- HTTP 401 with meaningful message (e.g. `'Invalid credentials'`) → passed through as-is
- HTTP 403 → `'You do not have permission to perform this action.'`
- Other HTTP errors → `` `HTTP ${res.status}` ``

### MongoDB `_id` → `id` normalisation — service layer only
Each service defines a local `normalise()` function. The frontend `Item` type never exposes `_id`. Never normalise in stores, components, or composables. See: `Item-Marketplace-Frontend/src/services/itemsService.ts:23`

### Service-specific types
Types used only within one service: `export interface` in that file. Types used across features: `src/types/`.

---

## 4. Composable Patterns

- Location: `src/composables/use<Name>.ts` or `src/composables/admin/use<Name>.ts`.
- All composables return **objects**, never arrays.
- Export `ReturnType` alias alongside any `InjectionKey`.
- Module-level singleton state: declare refs **outside** the function for global sharing.

### Admin CRUD composable pattern
Each admin resource gets its own composable with per-operation `dialog`/`form`/`loading`/`error` refs and an `open*` + `confirm*` pair. Double-submission guard is always first in `confirm*`. See: `Item-Marketplace-Frontend/src/composables/admin/useItemCrud.ts:53`

### Pure utility composables
Files like `usePricing.ts` contain only pure functions with no reactivity. Import and call directly.

---

## 5. TypeScript Type Conventions

### Domain types in `src/types/` — interfaces only, no runtime logic

### Naming
- Domain types: `PascalCase` interfaces — `Item`, `Purchase`, `Account`
- Union literals: `type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary'`
- Intersection for composed settings: `type AppSettings = BrandingSettings & PricingSettings & ...`
- Generic params: prefix `T` — `TData`, `TResult`
- Exhaustive permission lists: `as const` + derived type. See: `Item-Marketplace-Frontend/src/types/role.ts:90`

### `null` vs `undefined`
- `null` for explicit "no value" in store error refs and nullable domain fields.
- `stock: number | null` — `null` means unlimited.
- `?:` for fields absent from some API responses; use JSDoc to clarify which endpoint populates them.

### `Result<T>` — discriminated union for async outcomes
Defined in `Item-Marketplace-Frontend/src/types/result.ts`. Services return `Promise<Result<T>>`. Stores pattern-match on `result.type`. Never `throw` from a service or store.

### Prefer built-in utility types
`Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`. Never re-declare a subset of an existing interface by hand.

---

## 6. Router & Navigation Guards

- Non-home routes: lazy loading `component: () => import('@/views/XxxView.vue')`.
- All routes declare `meta: { requiresAuth, requiresGuest?, requiredPermission? }`.
- Single global `beforeEach` — three cases in order: auth check → guest redirect → permission check.
- Permission checks in components: always `computed(() => auth.hasPermission('key'))`. Never hardcode role names.

---

## 7. CSS & Styling

- Every component uses `<style scoped>`. Global styles in `src/assets/`.
- PrimeVue form controls in dialogs/grids must use the `fluid` prop to expand to column width.
- Mixed fixed/flexible rows: use `grid-template-columns` rather than flex shrink.
- BEM-adjacent class naming: `.block`, `.block__element`, `.block--modifier`.
- PrimeVue design tokens for all colours — never hardcode hex (`var(--p-surface-card)`, etc.).
- Use `:deep()` for PrimeVue internals.
- Dark mode: `.app-dark` class on `<html>`. All custom classes include `.app-dark &` overrides.
- Mobile breakpoint: `768px`. Use `@media (max-width: 767px)` in styles, `useIsMobile` in script.

---

## 8. Forms & Validation

### Two-layer validation
1. **Client-side** — synchronous check in submit handler; set `validationError.value` and return early.
2. **Server-side** — passed as `error` prop from parent (the store's `error` ref).

### Rules
- PrimeVue `<Message>` for all inline errors. Validation errors take precedence (`v-if="validationError"` / `v-else-if="error"`).
- Bind `:invalid` to validation state on inputs.
- Admin form validation in composables returns `string | null`.

---

## 9. Error Handling & Loading States

### Async double-submission guard
**First line** of every user-triggered async function: `if (loading.value) return`. Both the guard AND `:disabled="loading"` are required — `:disabled` gives visual feedback; the guard is the hard net. Applies to `.vue` handlers, Pinia actions, and composable functions called from user interactions.

`loading.value = false` is always set explicitly after the `result.type` check — no `finally` needed (services never throw).

### Loading ref shapes
- Single op: `const loading = ref(false)`
- Per-row/ID: `const processingId = ref<string | null>(null)`
- Multiple independent: separate named refs (`createLoading`, `editLoading`, `deleteLoading`)

### Toast notifications
`useToast()` for all async feedback. Success: `life: 3000`; error: `life: 5000`. Pattern-match on `result.type`.

---

## 10. PrimeVue 4 (Aura preset)

- Always check PrimeVue before building a custom component.
- All `DataTable` components use `size="small"`.
- Use `--p-*` CSS design tokens — never hardcode hex.
- Use `:deep()` for component internals.
- When integrating a new PrimeVue component, write a todo list covering styling and architecture before implementing.
