---
applyTo: "**/__tests__/**,**/*.test.ts,**/*.spec.ts"
---

# Testing Conventions — Vitest

> **Status: Vitest is configured in both workspaces** (`vitest.config.ts` each) with `test`,
> `test:watch`, and `coverage` scripts. Tests are co-located as `*.test.ts` next to source and are
> excluded from the production `tsc`/`vue-tsc` build. `npm run test` (root) runs both workspaces.
> Coverage is being expanded across the logic layer; the canonical patterns below are live
> references.

## Tech Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Test runner | Vitest | ^4.1 |
| Coverage | `@vitest/coverage-v8` | ^4.1 |
| DOM/environment | jsdom (frontend) | ^29 |
| Component/store helpers | `@vue/test-utils`, `@pinia/testing` | ^2.4 / ^1.0 |
| HTTP/route testing (backend) | `supertest` | ^7.2 |

Mocking API: `vi` (Vitest). Gate that must pass before tests: `vue-tsc` (frontend) / `tsc`
(backend), then `eslint`.

---

## Run the suite as the final step before closing a task

```
# once configured, per workspace:
npm run test --workspace=spelslot-frontend
npm run test --workspace=spelslot-backend
```

Never consider a task complete while the test suite is failing.

---

## Framework & imports

Use **Vitest** exclusively — do not mix in Jest. Canonical import line for new test files:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

## Test naming

One convention everywhere: `it('should …')`.

## Section dividers

Use a visual divider to separate arrange/act/assert blocks:

```ts
// ── initial state ─────────────────────────────────────────────
```

---

## Unit / Component / Store Tests (frontend)

- Establish fresh, isolated state per test — a new Pinia instance
  (`setActivePinia(createPinia())`, or `createTestingPinia()` for component tests) in `beforeEach`.
- **Mock the service layer — never hit the real network.** Stub the relevant
  `src/services/*Service.ts` object with `vi.mock(...)` so stores receive a `Result<T>` you control,
  then drive it with `vi.mocked(service.method).mockResolvedValue({ type: 'ok', data })`.
  Canonical setup: `spelslot-frontend/src/stores/notifications.test.ts`.
- For `api.ts` itself, mock the `@/firebase` token boundary and stub `fetch` via
  `vi.stubGlobal('fetch', ...)`. Canonical: `spelslot-frontend/src/services/api.test.ts`.
- Assert on `Result.type` and the returned shape — not on literal user-facing strings (those move
  behind i18n keys; see `frontend.instructions.md`).

---

## Backend / Integration Tests

- **Mock Mongoose models — never hit a real database.** Stub the query-builder chain
  (`findOne(...).lean()` etc.) so each call resolves to a doc you queue.
  Canonical: `spelslot-backend/src/utils/slug.test.ts` (`queueLookups` helper).
- **Route tests** mount the router on a throwaway Express app via `supertest`, `vi.mock` the auth
  middleware (`requireAuth`/`optionalAuth` → passthrough), and stub `fetch` for upstream calls.
  Canonical: `spelslot-backend/src/routes/monsters.test.ts`.
- **The auth boundary itself** is tested by mocking `firebase-admin/auth`'s `getAuth().verifyIdToken`
  and using a `req`/`res`/`next` factory. Canonical: `spelslot-backend/src/middleware/auth.test.ts`.

---

## Fixtures via factory functions

Every test file defines a `make<Entity>()` factory with sensible defaults and partial overrides,
rather than hand-building fixtures inline (e.g. `makeNotification()`, `makeCodexEntry()`).
Canonical example: `makeNotification()` in `spelslot-frontend/src/stores/notifications.test.ts`.
