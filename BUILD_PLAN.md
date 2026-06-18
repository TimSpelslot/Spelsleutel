# Spelslot Platform — Build Plan

Copy this file to the new `spelslot-platform` repo alongside `CLAUDE.md` and `.claude/`.
Each prompt below is ready to paste into Claude Code (desktop or mobile).
Work through them in order. Check off each step when done.

---

## Before You Start

- [ ] New GitHub repo created (`SpelSlot-IT/spelslot-platform`)
- [ ] `CLAUDE.md` added
- [ ] `.claude/instructions/` added (frontend, backend, testing)
- [ ] `.claude/agents/` added (vuejs-expert, vuejs-expert-auto, vuejs-expert-lite)
- [ ] Firebase project created, Google Auth enabled
  - Need: web app config object (for frontend)
  - Need: service account JSON (for backend)

---

## Step 1 — Scaffold the monorepo

> Paste this prompt once the repo exists with CLAUDE.md and .claude/ in place.

```
Scaffold the Spelslot monorepo. Read CLAUDE.md first for full context.

Create two packages:
- `spelslot-backend/` — Express + TypeScript + Mongoose. Include: tsconfig, package.json with dev/build/start scripts, nodemon for dev, a basic Express app in src/app.ts, src/index.ts entry point, src/config/db.ts for MongoDB connection, dotenv setup, a health check route GET /api/health, and a .env.example with MONGO_URI, PORT, JWT_SECRET, FIREBASE_PROJECT_ID.
- `spelslot-frontend/` — Vue 3 + Vite + TypeScript. Include: PrimeVue 4 with Aura preset, Pinia, Vue Router 4, @tiptap/vue-3 and @tiptap/starter-kit. Set up the CSS custom properties from the Spelslot palette (parchment/amber/rust tones from the current mockup globals.css) as design tokens in a src/assets/tokens.css file. All colors in components must use these tokens — never hardcode hex. Set up the @ alias to src/.

Add a root package.json with workspace scripts: `dev:backend`, `dev:frontend`, `dev` (runs both).

Do not add any features yet — just the foundation that compiles and runs cleanly.
```

---

## Step 2 — Firebase Auth + User model

> Do this after Firebase project is set up. Have the Firebase web config and service account JSON ready to paste in.

```
Wire up Firebase Authentication. Read CLAUDE.md first.

Backend:
- Install firebase-admin. Add src/config/firebase.ts that initialises the Admin SDK using a service account (from env var FIREBASE_SERVICE_ACCOUNT_JSON as a JSON string).
- Add src/middleware/auth.ts — verifies Firebase ID token from Authorization: Bearer header, attaches { uid, email, name, picture } to req.user. Returns 401 on failure.
- Add the User Mongoose model (src/models/User.ts): uid (indexed, unique), email, name, displayName, avatarUrl, role (PLAYER/DM/ADMIN, default PLAYER), isWorldbuilder (Boolean, default false), worldbuilderRequestPending (Boolean, default false), dndbeyondCharacterId (String, optional), notifySignup/notifyAssignment/notifyMarketplace/notifySession (Boolean, default true), createdAt, updatedAt.
- Add POST /api/auth/sync — protected by auth middleware. Upserts a User from the Firebase token payload (uid, email, name, picture → avatarUrl). Returns the user. This is called by the frontend on every login to ensure the user exists in MongoDB.

Frontend:
- Install firebase SDK. Add src/firebase.ts that initialises Firebase with the web config (from import.meta.env.VITE_* vars).
- Add src/stores/auth.ts (Pinia setup store): state = { user: User | null, firebaseUser: FirebaseUser | null, loading: bool }. Actions: init() (onAuthStateChanged listener — calls sync on login, clears on logout), loginWithGoogle() (GoogleAuthProvider popup), logout() (signOut + clear state).
- Add src/router/index.ts with a beforeEach guard: unauthenticated users are redirected to /login for protected routes.
- Add a minimal /login page with a "Sign in with Google" button using PrimeVue Button.
- Add src/services/api.ts — the single HTTP client (wraps fetch, reads VITE_API_URL, attaches Firebase ID token as Authorization header on every request, returns Result<T>).

After: a user can sign in with Google, the backend creates/updates their MongoDB document, and protected routes redirect to /login if not authenticated.
```

---

## Step 3 — App shell + layout

```
Build the app shell. Read CLAUDE.md first.

Create a responsive layout for authenticated users:
- A top navigation bar (Thenavbar.vue) showing: app name/logo, current user avatar + display name, role badge, a notification bell icon with unread count badge (static for now), logout button.
- A collapsible sidebar (TheSidebar.vue) with nav links: Dashboard, Codex, Sessions, (Marketplace placeholder), profile icon at bottom. Sidebar collapses to icon-only on mobile. Use CSS custom properties for all colors.
- A main content area that adjusts for the sidebar.
- Route /dashboard shows a placeholder "Dashboard coming soon" card.
- Route /codex shows a placeholder "Codex coming soon".
- Route /session shows a placeholder "Session coming soon".

Use PrimeVue components where they fit (Button, Badge, Avatar). 
All colors via CSS tokens defined in tokens.css — no hardcoded hex anywhere.
The layout should feel like a D&D campaign tool — warm, readable, not a generic SaaS dashboard.
```

---

## Step 4 — AdventureBoard integration

```
Integrate the AdventureBoard API. Read CLAUDE.md first.

AdventureBoard live API: https://signup.spelslot.nl/api
Auth: Bearer token (service token from env var ADVENTUREBOARD_API_TOKEN)
OpenAPI docs available at: https://signup.spelslot.nl/openapi/docs

Backend:
- Add src/services/adventureBoard.ts — a typed service that wraps the AB API. Functions needed: getUpcomingSessions(userId), getUserAssignments(userId), getAdventure(id). Handle auth header, error normalisation, return typed results.
- Add GET /api/adventure-board/sessions — proxies to AB, returns upcoming sessions for the logged-in user.
- Add GET /api/adventure-board/assignments — proxies to AB, returns the user's current assignments.

Frontend:
- Add src/services/adventureBoardService.ts — calls our backend proxy endpoints, returns Result<T>.
- Update the dashboard (/dashboard): show a "Upcoming Sessions" section listing the user's next 3 sessions (title, date, DM name, status) pulled from AdventureBoard. Show a loading skeleton while fetching. Show a friendly empty state if none.

Do not rebuild any AdventureBoard features — read-only display only.
```

---

## Step 5 — Codex: schema, API, LK import

> This is the largest step. May take 2-3 sessions. Split if needed.

```
Build the Codex (Worldbuilding) feature. Read CLAUDE.md fully — the LK import section is critical.

Backend — MongoDB models:

WorldEntry:
  lkId (String, sparse index — for LK import upsert)
  name, slug (unique), type (lore/location/npc/faction/item/event/rule/session)
  status (DRAFT/PUBLISHED/ARCHIVED), permission (PUBLIC/PLAYERS/DM_ONLY/PRIVATE)
  isLocked (Boolean), parentId (ObjectId ref self), pos (String, fractional index)
  aliases (String[]), tags (String[])
  iconColor, iconGlyph, iconShape (String, optional)
  banner: { enabled: Boolean, url: String, yPosition: Number }
  summary (String), authorId (ObjectId ref User), editors (ObjectId[])
  lkProperties (Mixed[] — raw LK properties stored losslessly)
  timestamps

WorldDocument:
  entryId (ObjectId ref WorldEntry, indexed), lkDocId (String, optional)
  name, type (page/time/map/board), content (Mixed — ProseMirror JSON for page, raw for others)
  pos (String), isHidden (Boolean), isFirst (Boolean), calendarId (String, optional)
  timestamps

WorldEntryRelation:
  sourceId, targetId (ObjectId ref WorldEntry), type (String, optional), lkPropertyId (String)
  unique index on [sourceId, targetId]

Backend — API routes (src/routes/codex.ts):
  GET /api/codex — list entries (permission-filtered by user role)
  POST /api/codex — create entry (DM/Admin or isWorldbuilder)
  GET /api/codex/:id — get entry with documents and relations
  PATCH /api/codex/:id — update entry (author, editor, DM, or Admin)
  GET /api/codex/slug/:slug — get by slug
  GET /api/codex/:id/documents — list documents
  POST /api/codex/:id/documents — add document
  PATCH /api/codex/:id/documents/:docId — update document content
  DELETE /api/codex/:id/documents/:docId — delete document

Backend — LK import script (src/scripts/importLk.ts):
  Takes a path to a .lk file as CLI argument.
  Gunzips and parses JSON. Walks resources array.
  For each resource: upsert WorldEntry by lkId.
  For each resource's documents: upsert WorldDocument by lkDocId.
  For RESOURCE_LINK properties: upsert WorldEntryRelation.
  Store all other properties in lkProperties[] as-is.
  Map isHidden → DM_ONLY permission.
  Log progress. Idempotent — safe to run repeatedly.
  Add npm script: "import:lk": "tsx src/scripts/importLk.ts"

Frontend — basic Codex shell:
  /codex — sidebar tree of entries grouped by type (uses GET /api/codex)
  /codex/:slug — entry detail page: title, type badge, tags, documents as tabs, relations listed
  Tiptap read-only renderer for page documents
  Permission-aware: DM_ONLY entries hidden from PLAYER role
```

---

## Step 6 — Codex: editor

```
Add editing to the Codex. Read CLAUDE.md first — pay attention to the permission and worldbuilder flag rules.

Frontend:
- Tiptap rich text editor component (src/components/codex/CodexEditor.vue) with: bold, italic, headings, bullet/ordered lists, blockquote, code, tables, and a custom @mention extension that queries GET /api/codex?name= and inserts a mention node linking to another entry.
- Edit mode on /codex/:slug: "Edit" button appears for users with write access (author, editor, DM, Admin, isWorldbuilder for their own entries). Clicking switches the document view to the editor. Save via PATCH /api/codex/:id/documents/:docId.
- New entry form: /codex/new — fields: name, type, permission, tags, summary. DM/Admin can set permission to DM_ONLY; others default to PLAYERS.
- Entry metadata editor (title, type, status, tags, permission) — shown in a side panel for users with write access.
- Session pages (permission type "session") are always visible to session participants and editable by them — handle this server-side in the permission check.
```

---

## Step 7 — Session dashboard

```
Build the Session Dashboard. Read CLAUDE.md first — the modular panels section is important.

This requires rc-dock or a Vue-compatible docking library. Research the best option for Vue 3 first (rc-dock is React-based; look for vue-dock-layout or implement a simpler drag-to-resize panel system with vue-grid-layout if needed). Recommend the best option before building.

DM View (/session/dm):
  Dockable panels (user can rearrange and resize):
  1. Combat Tracker — list of monsters with: name, current HP / max HP (editable inline), AC, initiative order (drag to reorder), conditions (tag chips). "Add monster" button opens a form. Per-monster: deal damage, heal, remove.
  2. Party Roster — list of session participants with name, character name (from DnD Beyond if linked, else plain text), class, level, HP if available.
  3. Session Notes — shared notes visible to all participants. Tiptap editor for DM. Players see read-only.
  4. Private DM Notes — visible to DM only. Tiptap editor.

Player View (/session/player):
  Same dockable layout, panels:
  1. Party Roster — same as DM view (read only)
  2. Session Notes — shared notes (read only unless DM enables editing)
  3. My Notes — private to this player. Tiptap editor.

Both views pull the active session from AdventureBoard (the session the logged-in user is assigned to today/next). If no session, show a friendly empty state.

Panel layout persists to localStorage per user per view (dm/player).
```

---

## Step 8 — Session pages (requires AdventureBoard webhook)

> This step requires a change to the AdventureBoard repo first. Do that before this prompt.

```
Implement automatic session page creation. Read CLAUDE.md first.

The AdventureBoard webhook sends a POST to /api/webhooks/adventureboard when a session is confirmed.
Payload will include: sessionId, adventureId, adventureTitle, date, dmId (AB user ID), playerIds (AB user IDs).

Backend:
- Add POST /api/webhooks/adventureboard. Validate with a shared secret (ADVENTUREBOARD_WEBHOOK_SECRET env var). 
- On receipt: look up Spelslot users by matching their linked AdventureBoard user IDs. Create a WorldEntry of type "session" with: name = "{adventureTitle} — {date}", permission = PLAYERS, status = PUBLISHED, editors = all matched participant user IDs (so they can all edit). Create one WorldDocument of type "page" with empty content. Store the AB sessionId on the entry for deduplication (upsert — safe to receive twice).
- Add GET /api/codex/session/:abSessionId — returns the session page for a given AB session ID.

Frontend:
- In the session dashboard views, add a "Session Page" button/link that opens the session's Codex page in a new panel or navigates to /codex/:slug.
- On the session page itself (/codex/:slug for type=session), all participants can edit (the editor permission is set server-side at creation).
```

---

## Step 9 — Worldbuilder flag request flow

```
Add the worldbuilder flag request and approval flow. Read CLAUDE.md first.

Backend:
- PATCH /api/users/me/request-worldbuilder — sets worldbuilderRequestPending: true on the current user. Returns 400 if already worldbuilder or already pending.
- GET /api/admin/worldbuilder-requests — Admin only. Returns users where worldbuilderRequestPending: true.
- PATCH /api/admin/users/:id/worldbuilder — Admin only. Body: { approved: boolean }. Sets isWorldbuilder and clears worldbuilderRequestPending.

Frontend:
- On the user profile page: if not isWorldbuilder and not pending, show "Request Worldbuilder access" button. If pending, show "Request pending — waiting for admin approval". If approved, show a Worldbuilder badge.
- Add a minimal Admin panel at /admin/worldbuilder-requests — table of pending requests with Approve/Reject buttons per row. Visible to ADMIN role only.
```

---

## Notes

- After each step, commit with a clear message before moving to the next.
- If a step is too large for one session, split it at a natural boundary and note where you stopped.
- The `.claude/agents/vuejs-expert.md` agent is available for frontend-heavy steps — invoke it for complex Vue component work.
- Design tokens live in `spelslot-frontend/src/assets/tokens.css` — never add a color outside of it.
- All API responses follow `{ data: T }` on success and `{ error: string }` on failure — no envelope variations.
