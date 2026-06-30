---
applyTo: "spelslot-frontend/**"
---

# Frontend Conventions — Vue 3 + TypeScript

## Tech Stack

The frontend is the `spelslot-frontend` workspace of an npm-workspaces monorepo. `package.json`
is the source of truth for versions.

| Concern | Choice | Version |
|---------|--------|---------|
| Language | TypeScript (strict) | ~5.7 |
| Framework | Vue 3 (`<script setup>`) | ^3.5 |
| Build tool | Vite | ^6.0 |
| Router | vue-router | ^4.5 |
| State | Pinia (setup stores) | ^3.0 |
| UI library | PrimeVue 4 + `@primevue/themes` (custom `spelslotPreset`) | ^4.2 |
| HTTP/data layer | `fetch` wrapped by `src/services/api.ts` | — |
| Rich text / collab | Tiptap 3 + Yjs + `@hocuspocus/provider` | ^3.27 / ^13.6 |
| Auth / messaging | Firebase Web SDK (Google OAuth + FCM) | ^12 |
| vue-i18n | none | — |
| Test runner | none yet — see `testing.instructions.md` | — |
| Lint/format | ESLint (flat config, `eslint-plugin-vue`) + Prettier — root `eslint.config.mjs` | — |

Package manager: **npm** (workspaces). Path alias: `@/` → `spelslot-frontend/src/`.
Pre-merge gate: `npm run type-check --workspace=spelslot-frontend` (`vue-tsc`) **and**
`npm run lint` must pass. Run `npm run format` (Prettier) before committing.

---

## Folder Structure

```
src/
├── main.ts            # app bootstrap / mount (see Bootstrap order)
├── App.vue            # root component
├── firebase.ts        # Firebase Web SDK init (Auth + FCM messaging)
├── assets/            # global CSS (tokens.css) + static SVG assets
├── components/        # grouped BY FEATURE: codex/, layout/, session/, session/panels/
├── composables/       # use<Name>.ts — reusable reactive logic
├── layouts/           # AppLayout.vue (route shell)
├── router/            # routes + single global guard (index.ts)
├── services/          # data layer + the api.ts HTTP client
├── stores/            # Pinia setup stores
├── theme/             # spelslotPreset.ts (PrimeVue palette — single source of truth)
├── types/             # shared domain types + barrel (index.ts)
├── utils/             # pure helpers (rank.ts, lkCalendar.ts)
└── views/             # route-level pages (*View.vue)
```

**Placement rules:**
- `components/` is grouped **by feature** (`codex/`, `session/`), not by type. New components join
  the matching feature folder.
- The only barrel is `src/types/index.ts` — import shared types from `@/types`, not deep paths.
- Route-level pages are `views/*View.vue`. There is no `pages/` directory.
- Responsive variants are **not** split into `desktop/`/`mobile/` directories — a single component
  adapts via `useIsMobile()` + CSS (see §1, Responsive split).
- Tests are not yet established; when added, co-locate per `testing.instructions.md`.

---

## 1. Component Conventions

### `<script setup lang="ts">` exclusively
Every component uses `<script setup lang="ts">`. Options API is never used.
Canonical example: `src/views/CodexEntryView.vue`.

### Typed props and events
Use `defineProps<{...}>()` and `defineEmits<{...}>()` with explicit types — no runtime options
object. Use `withDefaults` only when a non-`undefined` default is genuinely required.

### Sharing state down a tree
Use `provide` / `inject` with a typed `InjectionKey` rather than deep prop-drilling. Export the
`ReturnType` alias alongside the key.

### Component file naming
- Single-instance / layout components: `The` prefix — `TheNavbar.vue`, `TheSidebar.vue`.
- Purely presentational primitives: `Base` prefix.
- Dialog/overlay components: `*Dialog.vue` suffix only — **never** `*Modal.vue`.

### Responsive / platform split
- Breakpoint: **768px** (`@media (max-width: 767px)` in styles).
- In script: `useIsMobile()` from `src/composables/useIsMobile.ts` returns a reactive `isMobile`.
- A single component adapts responsively; do **not** create parallel `desktop/`/`mobile/`
  component directories.

### Bootstrap order (`main.ts`)
Order matters and is fixed:
1. `initColorScheme()` at module level — applies persisted/system light-dark choice **before**
   mount to avoid FOUC.
2. `app.use(PrimeVue, { theme: { preset: spelslotPreset, options: { darkModeSelector: '.ss-dark',
   cssLayer: { name: 'primevue', order: 'primevue' } } } })`.
3. Pinia → `ConfirmationService` → `ToastService` → `v-tooltip` directive.
4. `await auth.init()` **before** `app.use(router)` — so guards never fire against uninitialised
   auth state.
5. `app.mount('#app')`.

### Template rules
- `:key` in `v-for` — always a stable unique id, never the array index.
- Never co-locate `v-if` and `v-for` on the same node — filter through a `computed`.
- Keep template expressions trivial; non-trivial logic moves to a `computed` or composable.
- Always use directive shorthands (`@`, `:`, `#`).

---

## 2. State Management (Pinia)

### Setup store form only
`defineStore('name', () => { ... })`. Never the Options Store.
Canonical example: `src/stores/notifications.ts` (data + loading + derived `computed`).

### Standard state shape
Each async domain exposes its own `data` ref plus `loading`. Add an `error` ref where the store
surfaces failures to the UI; independent async operations get independent loading flags — never one
shared flag for unrelated work.

> Note: `src/stores/auth.ts` deliberately keeps the previous `user` on a sync error (the backend
> may be briefly down) rather than clearing it — follow that intent for resilient identity state.

### Async actions
Services return `Promise<Result<T>>`. Stores **pattern-match on `result.type`** — they never use
`try/catch` and never re-throw.
- Set `loading.value = false` explicitly after the result is handled (no `finally` needed —
  services don't throw).
- For user-triggered actions, a double-submission guard (`if (loading.value) return`) is the first
  line.
- Actions that report failure to the caller return `Result<T>` (see `auth.ts` `updateProfile`).

### Other store rules
- Derived values are `computed`, never recomputed ad hoc.
- Cross-store access happens inside action bodies, never at `defineStore` top level.
- Mutate in place after a successful write — don't blindly re-fetch (see `notifications.ts`
  `markRead`/`remove`).
- Persisted keys (localStorage) are named constants, never inline literals (e.g. `DEV_ROLE_KEY`).

---

## 3. Service / Data Layer

### Services are plain named singleton objects
A service is an exported object literal of async methods; every method returns
`Promise<Result<T>>`. No classes, no `new`. Services own all error handling.
Canonical example: `src/services/codexService.ts`.

### `api.ts` — the single HTTP client
All services call through `api` (wraps `fetch`) in `src/services/api.ts`. Methods: `get`, `post`,
`put`, `patch`, `delete`. Base URL: `import.meta.env.VITE_API_URL ?? ''`. The Firebase ID token is
attached automatically as a `Bearer` header.

### Error normalisation in `api.ts` (one place)
- Network failure → `'Network error — check your internet connection and try again.'`
- HTTP 401 generic → `'You are not logged in. Please log in and try again.'`
- HTTP 401 with a meaningful body message → passed through as-is.
- HTTP 403 → `'You do not have permission to perform this action.'`
- Other HTTP errors → body `message` if present, else `` `HTTP ${res.status}` ``.

### Shape normalisation lives on the BACKEND, not here
Unlike a frontend-normalises-`_id` pattern, this codebase projects documents to client shape on the
**server** via named payload builders (`buildEntrySummary`, `buildDocPayload` in the backend). The
frontend service's only reshaping job is to **unwrap the response envelope** — e.g.
`api.get<{ entries: CodexEntry[] }>` → return `result.data.entries`. Frontend domain types already
use `id` (a `string`); they never see `_id`. Do not re-map ids in components, stores, or composables.

### Type placement
Types used only within one service: `export interface` in that file (e.g. `CodexEntry`,
`CodexDocument` in `codexService.ts`). Types shared across features: `src/types/`.

---

## 4. Composables

- Location & naming: `src/composables/use<Name>.ts`.
- Composables return **objects** (or a single ref, e.g. `useIsMobile`), never positional tuples.
- Export the `ReturnType` alias alongside any `InjectionKey`.
- Pure utilities (no reactivity) live in `src/utils/` and are imported and called directly.
- Module-level singleton state (shared across all callers) is declared **outside** the function and
  documented as deliberate (e.g. color-scheme / sidebar state).

---

## 5. Type Conventions

- Domain types live in `src/types/` (interfaces, no runtime logic) and are re-exported from
  `src/types/index.ts`.
- Naming: `PascalCase` interfaces; closed sets as union literals
  (`type EntryType = 'lore' | 'location' | ...`); generic params prefixed `T`.
- `null` vs `undefined`: `null` for an explicit "no value" (e.g. `parentId: string | null`); `?:`
  for fields absent from some responses.
- `Result<T>` is the discriminated-union outcome type, defined in `src/types/result.ts`:
  `{ type: 'ok'; data: T } | { type: 'error'; message: string }`. Services return
  `Promise<Result<T>>`; callers branch on `result.type`. Never `throw` from a service or store.
- Prefer built-in utility types (`Partial`, `Pick`, `Omit`, `Record`) over hand-declaring subsets.

---

## 6. Routing & Navigation Guards

- Lazy-load all route components: `component: () => import('@/views/XxxView.vue')`.
- Routes declare access requirements as `meta`: `requiresAuth`, `requiresGuest`, `requiresDM`,
  `requiresAdmin`. Nested children inherit `requiresAuth` from the layout route — the guard checks
  the full matched chain (`to.matched.some(...)`).
- A single global `beforeEach` in `src/router/index.ts` enforces, in order: auth check → guest
  redirect → `requiresDM` → `requiresAdmin`.
- Permission/role checks always go through `auth.hasPermission(role | role[])` — never hardcode role
  strings inline in components.

---

## 7. CSS & Styling

- Every component uses `<style scoped>`. Global CSS lives in `src/assets/` (`tokens.css`).
- **All colours come from design tokens — never hardcode hex.** The PrimeVue preset
  (`src/theme/spelslotPreset.ts`) is the single source of truth; `tokens.css` exposes `--ss-*`
  aliases of the generated `--p-*` variables. Use `--ss-*` in custom CSS, `--p-*` for PrimeVue
  internals. To change a colour, edit the preset, not `tokens.css`.
- Dark mode: toggled by a `.ss-dark` class on `<html>` (managed by `useColorScheme`). Because
  `--ss-*` alias the `--p-*` variables, the whole palette flips automatically — no per-token dark
  overrides needed.
- Use `:deep()` to reach PrimeVue component internals.
- Re-state the breakpoint from §1: **768px** (`@media (max-width: 767px)`).

---

## 8. Forms & Validation

### Two-layer validation
1. **Client-side**: synchronous check in the submit handler; set a local validation-error ref and
   return early.
2. **Server-side**: surfaced from the store/service `Result` error and shown to the user.

### Rules
- One inline-error pattern for all field errors; client validation takes precedence over the server
  error in display order.
- Bind invalid state to inputs (`:invalid`).
- Reusable validation helpers return a typed `string | null`.

---

## 9. Error Handling & Loading States

- **Double-submission guard** (`if (loading.value) return`) is the first line of every
  user-triggered async function, in addition to `:disabled="loading"` in the UI. The disabled state
  is feedback; the guard is the hard net.
- Loading-ref shapes: single op → one boolean; per-row → an id ref (`processingId`); multiple
  independent ops → separately named flags.
- User feedback goes through PrimeVue `useToast()` — success `life: 3000`, error `life: 5000`.

---

## 10. PrimeVue 4 (custom `spelslotPreset`)

- The theme is a **custom preset** (`src/theme/spelslotPreset.ts`), not the stock Aura preset. It
  defines the parchment/amber/shell palette for both light and dark.
- Check PrimeVue for an existing component before building a custom one.
- All colours via `--p-*` / `--ss-*` design tokens — never hardcode hex.
- `DataTable` components use `size="small"`.
- Reach into component internals only via `:deep()`.
