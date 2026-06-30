# Go-Live Checklist

Things to remove or change before switching off dev access and opening to the full club.

---

## Remove Dev Role Toggle

The navbar has a toggle that lets any user switch their own role between Admin and Player. This must be removed — it's a security hole in production.

**Backend** — `spelslot-backend/src/routes/auth.ts`
- Delete the entire `PATCH /api/auth/me/flags` route (marked with comment "remove before go-live")
- Delete the entire `PATCH /api/auth/me/role` route (marked with comment "remove before go-live")

**Backend** — `spelslot-backend/src/routes/auth.ts`
- Delete the `SPELSLOT_DEV_ADMIN` block inside `POST /api/auth/sync` (lines ~170–177):
  ```ts
  const devAdmin = process.env.SPELSLOT_DEV_ADMIN === 'true'
  ...(devAdmin ? { role: 'ADMIN', isStoryDm: true, isWorldbuilder: true } : {})
  ```

**Frontend** — `spelslot-frontend/src/services/authService.ts`
- Delete the `switchRole()` method
- Delete the `switchFlags()` method

**Frontend** — `spelslot-frontend/src/stores/auth.ts`
- Delete the `switchRole()` function and remove it from the return object
- Delete the `toggleFlag()` function and remove it from the return object

**Frontend** — `spelslot-frontend/src/components/layout/TheNavbar.vue`
- Delete the `navbar__view-toggles` block in the template
- Delete the `VIEW_ROLES` computed
- Delete the `toggleView()` function
- Delete the `.navbar__view-toggles` and `.view-pill*` CSS rules
- Remove the `UserRole` type import if nothing else uses it

---

## Environment Variables

**`SPELSLOT_DEV_ADMIN`** — set to `false` or remove from `.env` entirely.
As long as this is `true`, every login/page-refresh resets every user's role to ADMIN.

---

## LegendKeeper Migration

- Run a final LK export and re-import into production MongoDB to get the latest worldbuilding data
- Verify all entries, relations, and documents imported cleanly
- Cancel the LegendKeeper subscription

---

## AdventureBoard Webhook

The session page auto-creation feature (AdventureBoard sends a webhook → Spelslot creates a Codex session page) requires a webhook to be added to AdventureBoard before go-live. This is tracked separately but must be in place before the feature works end-to-end.
