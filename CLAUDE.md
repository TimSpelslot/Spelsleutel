# Spelslot Platform — CLAUDE.md

## What This Is

Spelslot is a D&D club management platform for a Dutch D&D community. It replaces a combination of LegendKeeper (worldbuilding), AdventureBoard (session sign-ups), and a custom Marketplace (magic item shop). The goal is one unified app.

This repository is the **live Vue 3 rebuild** — an npm-workspaces monorepo (`spelslot-frontend` + `spelslot-backend`) built on the target stack (Vue 3 + Express + MongoDB, matching the Marketplace stack). It began as a Next.js mockup; that framing is historical. Active development happens here.

**Owner:** TimSpelSlot (tim@spelslot.nl)
**Deadline:** End of August 2026
**Work pace:** ~2 evenings/week + mobile prompts throughout the day

---

## Current Repo State

This is the live Vue 3 + Express + MongoDB monorepo. Layout:
- `spelslot-frontend/` — Vue 3, Vite, Pinia, PrimeVue 4, vue-router, Tiptap/Yjs, Firebase Web SDK
- `spelslot-backend/` — Express 5, Mongoose, Firebase Admin, Hocuspocus collab server
- Root npm workspaces; `npm run dev` runs both via `concurrently`.

Follow the conventions in `.claude/instructions/` when working in either workspace.

---

## Target Tech Stack (Rebuild)

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Vue 3 + TypeScript + Vite | Matches Marketplace |
| UI Library | PrimeVue 4 (custom `spelslotPreset`, Aura-based) | Matches Marketplace |
| State | Pinia | Matches Marketplace |
| Backend | Express + TypeScript | Matches Marketplace |
| Database | MongoDB + Mongoose | Matches Marketplace |
| Auth | Firebase Auth (Google OAuth only) | Matches AdventureBoard |
| Notifications | Firebase | Matches AdventureBoard |
| Monorepo | `spelslot-frontend/` + `spelslot-backend/` | Consistent with Marketplace layout |

**No email/password auth.** Google OAuth is the only login method.

---

## Related Projects

| Project | Repo | Live URL | Notes |
|---|---|---|---|
| AdventureBoard | github.com/SpelSlot-IT/AdventureBoard | signup.spelslot.nl | Python/Flask. Sign-up system. Source of karma & session data. |
| Marketplace | github.com/I-Do-Hobbys/PP1-item-marketplace (branch: dev) | spelslot-marketplace-dev.idohobbysservers.com | Vue 3 + Express + MongoDB. Source of gold & items. |
| LegendKeeper | External SaaS | — | Worldbuilding tool. Being replaced. Exports `.lk` files. |

AdventureBoard and Marketplace are **live external systems**. This app integrates with them via API. They will eventually be merged into this monorepo.

---

## Feature Map

### Auth & Users
- Google OAuth via Firebase Auth (no email/password)
- Roles: `PLAYER` / `DM` / `ADMIN`
- `isWorldbuilder: boolean` on User — grants Codex create/edit rights to players
  - Players can request the flag; admins approve in admin panel
  - DMs and Admins bypass this (always have full access)
- Karma: pulled from AdventureBoard API (not stored locally)
- Gold: pulled from Marketplace API (not stored locally)
- DnD Beyond character ID linkable per user; admins can set it on behalf of users
- Notification preferences per user

### Notifications
- Firebase (matching AdventureBoard pattern)
- In-app notification center
- Push notifications
- No email notifications in v1

### Adventure Board
- AdventureBoard is the source of truth — this app integrates, doesn't rebuild it
- Display upcoming sessions, assignments, party roster
- Session page creation: AdventureBoard sends a webhook when a session is confirmed → this app creates a Codex session page automatically
- Webhook support needs to be added to AdventureBoard when we get to that feature

### Marketplace
- External live system used as placeholder until merge
- Display items, player gold balance, inventory

### Worldbuilding / Codex
**This is the main feature.** It replaces LegendKeeper. See LK Import section below.

Permission model:
- `PUBLIC` — visible to everyone including non-logged-in
- `PLAYERS` — visible to all logged-in users (default for entries)
- `DM_ONLY` — visible to DMs and Admins only (maps to LK `isHidden: true`)
- `PRIVATE` — visible only to entry author and explicitly added editors

Write access:
- Players: read-only by default
- `isWorldbuilder` players: can create entries and edit entries they authored
- Session pages: all session participants can edit regardless of `isWorldbuilder`
- DMs: full create/edit on all entries
- Admins: full access including delete

Features:
- Hierarchical entries (parentId chain, same as LK)
- Entry types (lore/location/npc/faction/item/event/rule) — stored as tag + explicit type field
- Multiple documents per entry (Tiptap rich text, ProseMirror JSON)
- `@mention` cross-references between entries (inline in rich text)
- Entry relations (RESOURCE_LINK properties)
- Tags, aliases, cover image (banner), icon (color/glyph/shape)
- `isLocked` flag prevents edits
- Entry status: DRAFT / PUBLISHED / ARCHIVED
- Shared editors per entry
- **Session pages**: special entry type auto-created when AdventureBoard creates a session; linked to session participants; all participants can contribute

Timelines: **deferred to v2** (after August deadline)

### Session Dashboard
- DM view and Player view
- **Modular/dockable panel layout** (rc-dock or Vue-compatible equivalent)
- DM panels: combat tracker (monsters: name, HP, maxHP, AC, initiative, conditions, stat blocks), party roster, session notes
- Player panels: session notes (own private + shared public), party roster, character sheet preview
- No gold adjustments here (Marketplace handles gold)

### Admin Panel
- Deferred to v2 — build after core features are stable
- Will include: worldbuilder flag approvals, user management, DnD Beyond ID assignment

### DnD Beyond Integration
- Deferred to v2
- Users link their DnD Beyond name; admins can set character IDs manually

---

## LegendKeeper Import

### .lk File Format
`.lk` is gzip-compressed JSON. Structure:
```
LkRoot
├── version: 1
├── exportId: String
├── exportedAt: ISO 8601
├── resources: Resource[] (flat list, tree via parentId)
├── calendars: Calendar[]
└── resourceCount: number
```

Each `Resource`:
- `id`: 8-char alphanumeric (used as `lkId` in our DB)
- `name`, `parentId`, `pos` (fractional index string)
- `isHidden` → maps to `DM_ONLY` permission
- `isLocked`
- `tags`, `aliases`
- `iconColor`, `iconGlyph`, `iconShape`
- `banner: { enabled, url, yPosition }`
- `documents: Document[]` (1-3 per resource)
- `properties: Property[]`

Each `Document` type:
- `"page"` → ProseMirror JSON content (**directly Tiptap-compatible**)
- `"time"` → Timeline content (lanes + events) — store as-is, render in v2
- `"map"` → Map pins/regions — store as-is, skip rendering
- `"board"` → tldraw board — store as-is, skip rendering

Each `Property` type:
- `RESOURCE_LINK` → `WorldEntryRelation` (render in v1)
- `IMAGE` → cover/banner image (render in v1)
- `TEXT_FIELD` → store as-is, render read-only in v1, full UI in v2
- `TAGS`, `ALIAS`, `MENTION` → handled at resource level
- `SPOTIFY_SINGLE` → store as-is, skip rendering

### Import Strategy
- Backend script: gunzip → parse JSON → upsert by `lkId`
- **Idempotent**: can be run repeatedly during development without data loss
- Import preserves ALL LK data, even for features not yet rendered
- Users continue working in LK during development; re-import overwrites with latest
- At go-live: clean database, final import, switch off LK subscription

### MongoDB Schema (adapted from LK)
```
WorldEntry {
  lkId: String (indexed, for upsert)
  name: String
  slug: String (unique, generated)
  type: String (lore/location/npc/faction/item/event/rule/session)
  status: String (DRAFT/PUBLISHED/ARCHIVED)
  permission: String (PUBLIC/PLAYERS/DM_ONLY/PRIVATE)
  isLocked: Boolean
  parentId: ObjectId?
  pos: String (fractional index, from LK)
  aliases: String[]
  tags: String[]
  iconColor, iconGlyph, iconShape: String?
  banner: { enabled, url, yPosition }
  authorId: ObjectId
  editors: ObjectId[]
  lkProperties: Object[] (raw LK properties, stored losslessly)
  createdAt, updatedAt
}

WorldDocument {
  entryId: ObjectId
  lkDocId: String?
  name: String
  type: String (page/time/map/board)
  content: Object (ProseMirror JSON for page; raw JSON for others)
  pos: String
  isHidden: Boolean
  isFirst: Boolean
  calendarId: String?
  createdAt, updatedAt
}

WorldEntryRelation {
  sourceId: ObjectId
  targetId: ObjectId
  type: String?
  lkPropertyId: String?
}
```

---

## Design System

### Color Palette (CSS Custom Properties)
```css
--ss-parchment: warm off-white background
--ss-primary: amber/rust tones (amber-600 ≈ #D97706)
--ss-shell: dark brown sidebar/nav
```
Use CSS custom properties throughout. A team member is working on a new theme format — all colors must come from design tokens, never hardcoded hex. This allows dropping a new theme without touching component code.

### Layout
- Layout is up for rethinking in the rebuild
- Current mockup uses sidebar + top navbar — not required in rebuild
- Mobile-first; responsive with `@media (max-width: 767px)` breakpoint

---

## Coding Conventions (Rebuild)

Follow `.claude/instructions/frontend.instructions.md` and `.claude/instructions/backend.instructions.md` for detailed Vue/Express patterns, and `.claude/instructions/testing.instructions.md` for testing conventions. Key rules:

- `<script setup lang="ts">` exclusively
- Pinia setup stores only (no Options Store)
- Services return `Promise<Result<T>>` — never throw
- All colors via CSS design tokens
- Dialogs named `*Dialog.vue`, never `*Modal.vue`
- `@/` import alias maps to `src/`
- Tests with Vitest, pattern: `it('should ...')`
- Permission checks always through `auth.hasPermission()` — never hardcode role names

---

## Working on This Project from Mobile

Use **claude.ai/code** in a mobile browser. Provide a task prompt and the CLAUDE.md gives enough context to work cold. Keep prompts focused: one feature or one file change per session. The project will be committed to git after each working session so state is always recoverable.
