---
applyTo: "Item-Marketplace-Backend/**"
---

# Backend Conventions — Express + Mongoose + TypeScript

## 1. Express App Structure

### Entry point and startup order (`src/index.ts`)
1. `dotenv.config()` — **first statement**, always synchronous
2. `connectDB()` from `src/config/db.ts`
3. Start cron scheduler
4. `app.listen()`

### App factory (`src/app.ts`) — middleware order is fixed
1. `cors()` — no origin restriction
2. `express.json()` — body parser
3. Route handlers (`/api/*`)
4. `errorHandler` — **always last**

---

## 2. Route Handler Patterns

### No controller layer
Logic lives in route files and `src/utils/`. No `controllers/` directory. Complex helpers are named functions within the route file.

### Standard async handler pattern
`try/catch` in every handler; delegate to `errorHandler` via `next(err)` — never format 500s inline. See: `Item-Marketplace-Backend/src/routes/items.ts:1`

### Fire-and-forget logging
Always `void createLog(...)` **after** `res.json()`.

---

## 3. Mongoose Model Patterns

### Schema definition structure
1. `IXxx` interface
2. `XxxSchema = new Schema<IXxx>({...}, { timestamps: true })`
3. `export const Xxx = model<IXxx>('Xxx', XxxSchema)`

### Schema field rules
- `timestamps: true` on most models.
- Enum fields: `enum: [...]` in schema.
- ObjectId refs: `{ type: Schema.Types.ObjectId, ref: 'ModelName', required: true }`.
- Sensitive fields: `select: false`.
- Indexes after schema definition via `XxxSchema.index({...})`.
- No static or instance methods — business logic in `src/utils/`.

> `_id` → `id` is handled by the frontend service layer. Never send `ObjectId` to clients.

---

## 4. Auth & Permission Middleware

### `AuthRequest` — cast inline, not global augmentation
```ts
export interface AuthRequest extends Request { accountId?: string }
const authReq   = req as AuthRequest
const accountId = authReq.accountId!
```
Do not use `declare global` for `Request`.

### `requireAuth` middleware
Reads `Authorization` header, verifies JWT with `JWT_SECRET`. Payload: `{ sub: string }` (the account id, assigned to `req.accountId`). Returns `401` on missing/invalid/expired token.

### `requirePermission(key | key[])` middleware factory
Applied **after** `requireAuth`. Array = OR logic. Wildcard `'*'` grants all. Returns `403` on failure.

---

## 5. Error Handling

### Centralized error handler
See: `Item-Marketplace-Backend/src/middleware/errorHandler.ts`

### Rules
- No custom error classes — plain `Error` instances only.
- Per-route validation: early `res.status(4xx).json({ message })` return before further logic.

### HTTP status codes

| Code | Meaning |
|------|---------|
| `200` | Success (read / update) |
| `201` | Created |
| `400` | Bad request / business rule violation |
| `401` | Unauthenticated |
| `403` | Insufficient permissions |
| `404` | Not found |
| `409` | Conflict (duplicate) |
| `500` | All unhandled errors (via `errorHandler`) |

---

## 6. TypeScript Conventions

- **Strict mode** always.
- Body parsing via inline assertion: `req.body as { name: string; ... }`. No runtime validation library.
- `.lean()` on all read queries.
- `void` for intentionally ignored promises: `void createLog(...)`.
- **ESLint + `tsc --noEmit` must pass before merge.**

---

## 7. Validation Patterns

### No third-party validation library
Manual guard-clause checks with early returns — no Zod, Joi, or express-validator.

### Rules
- **Numerics:** `Number(...)`, validate with `Number.isFinite` + range check.
- **Clamp/floor:** `Math.max(1, Math.floor(value))` before persisting.
- **Enums:** local `VALID_XXX` allowlist array, check with `.includes()`.
- **Settings keys:** explicit allowlist check before writing to DB.

---

## 8. Response Format Conventions

- **No envelope wrapper** — response body is the resource directly.
- **Paginated:** `{ data: T[], total, page, limit, pages }`.
- **Error:** `{ message: string }` — uniform across all status codes.
- **Payload builder functions** — never send raw Mongoose documents. Always project through a named function in the route file. See: `Item-Marketplace-Backend/src/routes/items.ts`
- `null` (not `undefined`) for nullable optional fields.

---

## 9. Configuration & Environment Variables

| Variable | Behaviour if missing |
|----------|---------------------|
| `MONGO_URI` | Throws — app will not start |
| `JWT_SECRET` | Dev: falls back to `'dev_secret'`. Production (`NODE_ENV=production`): **throws at startup** if missing, empty, or `'dev_secret'` — app will not start (`validateEnvironment()` in `src/index.ts`) |
| `PORT` | Defaults to `3000` |

Dynamic config lives in the `Setting` MongoDB collection. Pricing config cached in-memory with 60s TTL — call `invalidatePricingCache()` after saving pricing settings.

---

## 10. Logging & Audit Logs

Console prefixes: `[server]` · `[db]` · `[error]` · `[cron]`.

Audit log utilities in `src/utils/log.ts`: `createLog()`, `createChangeLog()`, `diffObjects()`.

### Rules
- Action names: snake_case verb-noun — `purchase_item`, `edit_item`.
- Always fire-and-forget, always **after** `res.json()`: `void createLog({ action, accountId, details })`

---

## 11. Database Interaction

- Direct model calls in route files — no repository layer.
- `.lean()` on all read queries — plain JS objects, not Mongoose Documents.
- `.select()` for targeted projection.
- `Promise.all` for parallel independent queries.
- Upsert: `findOneAndUpdate({ key }, data, { upsert: true, new: true })`.

---

## 12. Utility Functions

`src/utils/` — pure functions or small async helpers. No classes. Key files: `account.ts`, `log.ts`, `pricing.ts`, `gold.ts`, `restock.ts`, `inventory.ts`, `forgeEvents.ts`. (Alert-rule matching lives in `routes/alerts.ts`, not a util.)
