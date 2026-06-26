---
applyTo: "spelslot-backend/**"
---

# Backend Conventions — Express + Mongoose + TypeScript

## Tech Stack

The backend is the `spelslot-backend` workspace of an npm-workspaces monorepo. `package.json` is the
source of truth for versions.

| Concern | Choice | Version |
|---------|--------|---------|
| Language | TypeScript (strict) | ~5.7 |
| Runtime | Node (CommonJS output) | — |
| Framework | Express | ^5.0 |
| Database / ORM | MongoDB via Mongoose | ^8.9 |
| Auth | Firebase Admin SDK (verifies client ID tokens) | ^13 |
| Realtime / collab | `@hocuspocus/server` + Yjs | ^3.4 / ^13.6 |
| Uploads | multer (disk storage) | ^2.2 |
| Validation | manual guard clauses (no library) | — |
| Dev / build | `nodemon` + `tsx` (dev), `tsc` (build) | — |
| Lint / format | ESLint (flat config) + Prettier — root `eslint.config.mjs` / `.prettierrc` | — |
| Test runner | none yet — see `testing.instructions.md` | — |

Package manager: **npm** (workspaces). Lint/format via ESLint + Prettier (config at the monorepo
root, shared with the frontend). Pre-merge gate: `npm run build --workspace=spelslot-backend`
(`tsc`) **and** `npm run lint` must pass. Run `npm run format` (Prettier) before committing.

---

## Folder Structure

```
src/
├── index.ts          # startup sequence (see §1)
├── app.ts            # Express app assembly / middleware pipeline (see §1)
├── collab/           # hocuspocus.ts — Yjs collaborative-editing server
├── config/           # db.ts (Mongo), firebase.ts (Admin SDK)
├── routes/           # one Router per resource; logic lives here (no controllers)
├── models/           # Mongoose schemas + models
├── middleware/       # auth.ts, errorHandler.ts
├── services/         # wrappers around external live APIs (AdventureBoard, Marketplace)
├── scripts/          # one-off CLI scripts (importLk, auditLk, …) run via tsx
└── utils/            # pure helpers (slug.ts, pos.ts)
```

**Placement rules:**
- **No controller layer and no repository layer.** Request logic lives in the route file; complex
  helpers are named functions within that file (see the helpers block at the top of
  `src/routes/codex.ts`). Don't introduce either layer.
- `src/services/` is reserved for typed wrappers around **external** systems (AdventureBoard,
  Marketplace) — not internal business logic.
- The error handler is wired **last** in `app.ts`.

---

## 1. App Structure & Startup

### Entry-point order (`src/index.ts`)
1. `import 'dotenv/config'` — **first**, synchronous.
2. `initFirebase()` — Admin SDK from `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. `await connectDB()` — Mongo.
4. `app.listen(PORT)`.
5. `startCollabServer()` — Hocuspocus realtime server.

### App-assembly / middleware order (`src/app.ts`) — fixed
1. `cors()` — no origin restriction.
2. `express.json({ limit: '10mb' })`.
3. Route handlers mounted under `/api/*`, plus static `/uploads`.
4. `errorHandler` — **always last**.

---

## 2. Request Handler Patterns

### Logic in route files
No controllers. A `Router` per resource exported as `xxxRouter`; helpers are named functions in the
same file. Canonical example: `src/routes/codex.ts`.

### Standard async handler pattern
Wrap the body in `try/catch` and **delegate to the central error handler via `next(err)`** — never
format 500s inline. Canonical example: `src/routes/monsters.ts` / `src/routes/sessionNotes.ts`
(`} catch (err) { next(err) }`).

> All route files follow this rule, including `src/routes/codex.ts` (migrated from its earlier inline
> `res.status(500).json(...)` blocks). Keep `next(err)` as the standard for new and edited handlers —
> never format 500s inline.

### Validation returns early
Per-request guard clauses return early with the right status (`400`/`401`/`403`/`404`) **before**
further logic — see §5 and §7.

### Side-effects after responding
Fire-and-forget work runs **after** the response is sent and is marked intentionally un-awaited
(`void …`).

---

## 3. Data Model Patterns

### Schema definition structure
In order: `IXxx` interface → `XxxSchema = new Schema<IXxx>({...}, { timestamps: true })` →
`export const Xxx = model<IXxx>('Xxx', XxxSchema)`. Canonical example: `src/models/WorldEntry.ts`.

### Field rules
- `timestamps: true` on models that need created/updated dates.
- Closed sets declared as `enum: [...]` at the schema level (mirror them as union types on the
  interface).
- Reference fields: `{ type: Schema.Types.ObjectId, ref: 'ModelName' }` (`required` where
  appropriate).
- Sensitive fields excluded from default reads with `select: false`.
- Indexes declared after the schema via `XxxSchema.index({...})` (e.g. sparse-unique `lkId` /
  `abSessionId` in `WorldEntry`).
- No static or instance methods — business logic stays out of models (lives in route helpers or
  `src/utils/`).

> **Never send raw Mongoose documents / `ObjectId`s to clients.** Project to client shape on the
> server via a named payload builder (see §8). This is the one place `_id` → `id` mapping happens.

---

## 4. Auth & Permission Middleware

Defined in `src/middleware/auth.ts`.

- `requireAuth` reads the `Authorization: Bearer <token>` header, verifies the Firebase ID token via
  `getAuth().verifyIdToken(...)`, attaches the principal to `req.user`
  (`{ uid, email, name, picture }`), and returns `401` on a missing/invalid token.
- `optionalAuth` does the same but lets unauthenticated requests continue (used for `PUBLIC`-visible
  reads like the codex list).
- The request principal is typed via an **inline cast**, not global augmentation:
  `interface AuthRequest extends Request { user?: {...} }`, then `const authReq = req as AuthRequest`.
  Do not use `declare global` for `Request`.
- There is no generic `requirePermission` factory — domain authorization is done in-handler against
  the loaded Mongo user (e.g. `permissionFilter()` / `canWrite()` in `codex.ts`). Role/permission
  decisions live in those helpers, not scattered inline.

---

## 5. Error Handling

- The centralized error handler (`src/middleware/errorHandler.ts`) is the single place 500s are
  formatted: it logs `[error]` and returns `res.status(500).json({ message: 'Internal server
  error' })`. It currently does not inspect the error's status — non-500 responses are produced by
  the route's own early `res.status(4xx)` returns.
- **No custom error classes** — plain `Error` instances only.
- Per-route validation returns early with the right status before further logic.

### Status codes

| Code | Meaning |
|------|---------|
| `200` | Success (read / update) |
| `201` | Created |
| `400` | Bad request / business-rule violation |
| `401` | Unauthenticated |
| `403` | Insufficient permissions |
| `404` | Not found |
| `409` | Conflict (duplicate) |
| `500` | All unhandled errors (via `errorHandler`) |

---

## 6. Language / Type Conventions

- **Strict mode** always (`tsconfig.json`).
- Body parsing via inline assertion: `req.body as { name: string; ... }`. No runtime validation
  library — see §7.
- `.lean()` on all read queries (plain objects, not Mongoose Documents).
- ObjectId validity checked with `isValidObjectId(...)` from mongoose before querying by id.
- Intentionally ignored promises are marked `void …`.
- Gate before merge: `tsc` build passes (no lint/test gate exists yet).

---

## 7. Validation Patterns

### Manual guard clauses — no library
No Zod, Joi, or express-validator. Validate with explicit guard clauses and early returns.

### Rules
- Numerics: `Number(...)` / `parseInt(...)`, validate with `Number.isFinite` + range check, then
  clamp/floor (`Math.max(1, ...)`) before persisting (see the `limit` handling in `codex.ts`).
- Closed sets: validate against a local allowlist array before writing.
- Uploads: allowlist MIME types + size cap in the multer `fileFilter`/`limits` (see
  `src/routes/upload.ts`).

---

## 8. Response Format

- **Wrapped envelope** — handlers return named objects, not bare resources:
  `{ entries }`, `{ entry }`, `{ documents }`, `{ document }`, `{ url }`, `{ success: true }`.
  Match the existing key for the resource.
- Error body, uniform across all status codes: `{ message: string }`.
- **Never serialize raw Mongoose documents.** Project through a named builder in the route file
  (`buildEntrySummary`, `buildDocPayload` in `codex.ts`) — this is where `_id` becomes a string
  `id` and `ObjectId` refs are stringified.
- Use `null` (not `undefined`) for nullable fields in responses (e.g. `parentId: ... ?? null`).

---

## 9. Configuration & Environment

Required secrets throw at startup (the app will not boot without them).

| Variable | Behaviour if missing |
|----------|----------------------|
| `MONGO_URI` | Throws in `connectDB()` — app will not start |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Throws in `initFirebase()` — app will not start |
| `PORT` | Defaults to `3000` |
| `ADVENTUREBOARD_API_TOKEN` | Optional — AdventureBoard calls go unauthenticated if absent |
| `MARKETPLACE_*` | Optional — used by `src/services/marketplace.ts` |

There is no dynamic/in-DB config store or cache layer at present.

---

## 10. Logging & Audit

- Console prefixes used consistently: `[server]` · `[db]` · `[firebase]` · `[error]`.
- There is **no audit-log subsystem** (no `createLog`/`Setting` collection). If one is added, follow
  fire-and-forget-after-response semantics and `snake_case` verb-noun action names.

---

## 11. Data Access

- Direct model calls in route files — no repository layer.
- `.lean()` on all reads; `.select(...)` for projection (e.g. `.select('-lkProperties')`,
  `.select('name slug type')`).
- Parallelize independent queries with `Promise.all` (see `entryWithRelations` in `codex.ts`).
- Upsert idiom: `findOneAndUpdate({ key }, data, { upsert: true, new: true })`. The LK import
  (`src/scripts/importLk.ts`) upserts by `lkId` and must stay **idempotent**.

---

## 12. Utility Functions

`src/utils/` holds pure functions and small helpers — no classes. Key files: `slug.ts`
(`uniqueSlug`), `pos.ts` (`posAfter`, fractional-index ordering). One-off maintenance/import
routines live in `src/scripts/` and are run via `tsx` (e.g. `npm run import:lk`).
