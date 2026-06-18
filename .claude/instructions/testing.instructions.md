---
applyTo: "**/__tests__/**,**/*.test.ts,**/*.spec.ts"
---

# Testing Conventions — Vitest

## Run tests as the final step before closing a task

```
npm run test --prefix Item-Marketplace-Frontend
npm run test --prefix Item-Marketplace-Backend
```

Never consider a task complete if the test suite is failing.

---

## Framework: Vitest + `vi` (not Jest)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

## Test naming — always `it('should ...')`

## Section dividers
```ts
// ── initial state ─────────────────────────────────────────────
```

---

## Frontend Store Tests

Fresh Pinia per test + mock service layer. See canonical setup: `Item-Marketplace-Frontend/src/stores/__tests__/items.test.ts:1`

**Always mock the service layer — never hit the network.**

---

## Backend Tests

**Always mock Mongoose models — never hit a database.**

Mongoose query builder chain mock pattern: `Item-Marketplace-Backend/src/routes/__tests__/accounts.test.ts:114`

`mockRes` / `mockNext` factory pattern: `Item-Marketplace-Backend/src/routes/__tests__/accounts.goldAdjust.test.ts:26`

---

## Factory functions for domain fixtures

Every test file defines a `makeX()` factory with sensible defaults and partial overrides. See: `Item-Marketplace-Frontend/src/stores/__tests__/items.test.ts:24`
