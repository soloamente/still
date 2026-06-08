# Staff Panel — User Info & Advanced User Management — Design

**Date:** 2026-06-08
**Status:** Approved (brainstorming) — ready for implementation plan
**Scope:** First of a planned sequence of staff-panel sub-projects (see "Roadmap" below).
This one extends the existing Users tab with richer per-user information and four new
staff powers: profile editing, internal notes, Pro toggling, and impersonation.

## Context

The Staff Roles & Permissions system (see
`docs/superpowers/specs/2026-06-07-staff-roles-permissions-design.md`) shipped a
minimal Users tab (name/email/role/banned) and a permission matrix covering
`user:list/ban/unban/set-role/impersonate`, `content:hide/delete/restore`, and
`audit:read`.

Two gaps prompted this spec:
1. The Users tab shows too little to act on — no profile info, no activity signal, no
   way to see what a role can actually do.
2. `user:impersonate` is **declared in the matrix but was never implemented** — no
   endpoint, no UI, no wiring to better-auth's native impersonation. Several other
   useful staff powers (editing a user's profile, leaving internal notes, granting
   complimentary Pro) don't exist at all.

## Roadmap (for context — not all built now)

This is sub-project 1 of 6 identified during brainstorming, each to get its own
spec → plan → implementation cycle:
1. **User info & advanced user management** (this spec)
2. Reports/flagging system (full: user-facing report flow + staff queue)
3. Chat moderation
4. Editorial tools (featured news/lists, badge management)

(Impersonation was originally going to be its own step but fits naturally here since
it's a `user:*` permission alongside edit/note/pro.)

## Decisions (from brainstorming)

- **Display:** expandable row in the existing Users table (not a separate page/drawer)
  — keeps the compact list but reveals detail on demand.
- **New permissions:** `user:edit`, `user:note`, `user:pro` — all **Owner + Admin**
  (same tier as ban/set-role: sensitive actions that alter another user's identity,
  subscription, or carry confidential information).
- **`user:impersonate`** stays **Owner-only** (per the original matrix) — the most
  sensitive power (full account access). The Owner may impersonate **any** account,
  including other staff (no extra restriction beyond the existing `outranks` check,
  which an Owner always satisfies).
- **Role permissions display:** read-only — show what a role *can do* in plain
  language. No per-user à la carte permission overrides (would be an architecture
  change away from the deliberate "named bundles" model; out of scope).
- **Notes:** append-only chronological log (author + timestamp + text), like the audit
  log — preserves accountability, no edit/delete.
- **Pro toggle:** manual override of `profile.isPro`. No subscription-sync code
  currently writes to this column, so a manual grant is safe today; documented as an
  "override" in case a future Polar webhook needs to coexist with it.

## Updated Permission Matrix

| Permission        | Owner | Admin | Moderator | Support |
|-------------------|:-----:|:-----:|:---------:|:-------:|
| user:list         |  ✅   |  ✅   |    ✅     |   ✅    |
| user:ban / unban  |  ✅   |  ✅   |    ❌     |   ❌    |
| user:set-role     |  ✅   |  ❌   |    ❌     |   ❌    |
| user:impersonate  |  ✅   |  ❌   |    ❌     |   ❌    |
| **user:edit**     |  ✅   |  ✅   |    ❌     |   ❌    |
| **user:note**     |  ✅   |  ✅   |    ❌     |   ❌    |
| **user:pro**      |  ✅   |  ✅   |    ❌     |   ❌    |
| content:hide      |  ✅   |  ✅   |    ✅     |   ✅    |
| content:delete    |  ✅   |  ✅   |    ✅     |   ❌    |
| content:restore   |  ✅   |  ✅   |    ✅     |   ❌    |
| audit:read        |  ✅   |  ✅   |    ❌     |   ❌    |

(`content:*` and `audit:read` rows are unchanged from the existing matrix — listed for
completeness.)

## Data Model

### New table: `staff_user_note` (in `packages/db/src/schema/staff.ts`)

- `id` (text PK)
- `userId` (text, FK → `user.id`, the user the note is about)
- `authorId` (text, FK → `user.id`, the staff member who wrote it)
- `body` (text, max ~2000 chars enforced at the route)
- `createdAt` (timestamp, default now)
- Indexes on `userId` and `createdAt`.
- **Append-only**: no update/delete endpoints — mirrors `staff_audit_log`'s
  accountability model.

### No other schema changes

- `user:edit` writes to existing `profile` columns (displayName, handle, bio,
  pronouns, location, website, bannerUrl, accentColor, etc.).
- `user:pro` flips the existing `profile.isPro` boolean.
- `user:impersonate` uses better-auth's native impersonation — sessions already carry
  an `impersonatedBy` column; no new table needed.

## Server

### a) Plugin config (`packages/auth/src/index.ts`)

Add `impersonationSessionDuration: 3600` (1 hour) to the `admin` plugin options —
better-auth's native time-limited impersonation, satisfying the "session a tempo
limitato" requirement with zero custom code.

### b) Access control (`packages/auth/src/permissions.ts`)

Extend `statement.user` with `edit`, `note`, `pro`. Update the `owner` and `admin`
role bundles to include all three (per the matrix above); `moderator`/`support`
unchanged.

### c) New/extended endpoints (`apps/server/src/routes/staff.ts`)

All follow the existing pattern: `requirePermission` → `outranks` (where acting on a
target user) → mutate → `writeAuditLog` → rate-limit via `hit()` on write paths.

- `GET /api/staff/users/:id` — full detail: profile fields, `statsCache`, the
  requested role's permission list (derived from the `roles` map — read-only, no
  extra DB access), and the note history. Perm `user:list`.
- `POST /api/staff/users/:id/edit` — body: partial profile fields (displayName,
  handle, bio, pronouns, location, website, bannerUrl, accentColor — reuses existing
  validation helpers, e.g. handle format). Perm `user:edit` + `assertOutranks`.
  Audit action `user.edit` with a `changedFields` metadata list (not full before/after
  values, to avoid logging PII-heavy diffs).
- `POST /api/staff/users/:id/pro` — body `{ isPro: boolean }`. Perm `user:pro` +
  `assertOutranks`. Audit action `user.pro.grant` / `user.pro.revoke`.
- `GET /api/staff/users/:id/notes` — list, newest first. Perm `user:note`.
- `POST /api/staff/users/:id/notes` — body `{ body: string }`, max 2000 chars. Perm
  `user:note`. Audit action `user.note.add` (references the note id in metadata).
- `POST /api/staff/users/:id/impersonate` — wraps `auth.api.impersonateUser({ body: {
  userId } })`. Perm `user:impersonate` (Owner-only by matrix) + `assertOutranks`.
  Audit action `user.impersonate.start`.
- `POST /api/staff/stop-impersonating` — wraps `auth.api.stopImpersonating()`.
  Audit action `user.impersonate.stop`. No extra permission check — anyone in an
  impersonated session can exit it.

### d) Role-permissions helper (`packages/auth/src/permissions.ts` or a small new module)

A pure function `permissionsForRole(role): { resource, action, label }[]` that walks
the `roles` map and returns a flat, human-readable list — consumed by both the new
`GET /users/:id` endpoint and any future surface that needs "what can this role do".

## UI (web) — `apps/web/src/components/staff/`

### Expandable user row (extends `StaffUsersTab`)

Clicking a row expands it in place to show (each block gated on the viewer's
permission, mirroring the existing `canModerate`/`canSetRole` pattern):

- Handle as a link to the public profile (new tab), join date, email-verified state,
  **Pro**/**Private** badges, activity stats (films logged, reviews, lists,
  followers/following) from `statsCache`.
- **"This role can…"** — plain-language list of the target's role permissions (always
  visible to any staff member who can see the row; pure display, server-derived).
- **Notes** — chronological list (author name + relative timestamp + text) with an
  inline textarea + submit, shown only with `user:note`.
- **Pro toggle** — switch control, shown only with `user:pro`.
- **"Edit profile"** button (only with `user:edit`) — opens a dialog with the
  editable profile fields, reusing existing form patterns from the profile-settings
  UI where practical.
- **"Impersonate"** button (Owner only) — calls the impersonate endpoint, then
  navigates to `/home`.

### Impersonation banner (`apps/web/src/components/app/app-shell.tsx` or a small new
host component, mounted the same way `RoleChangeDialogRoot` is)

A persistent bar shown across the app whenever the session carries `impersonatedBy`:
"You're impersonating **{name}**" + an "Exit" button that calls
`stop-impersonating` and returns to `/staff`.

## Testing (Bun test, `*.test.ts`)

- `permissions.test.ts`: each role has exactly the `edit`/`note`/`pro`/`impersonate`
  permissions in the updated matrix.
- `staff.test.ts`: 403 without permission / 200 with permission / audit row written /
  `outranks` enforced, for each new endpoint; notes are append-only (no PATCH/DELETE
  routes exist); impersonation produces a session with `impersonatedBy` set and
  `stopImpersonating` restores the original session.
- `permissionsForRole` (or equivalent helper): unit test asserting the flat list
  matches the matrix per role.
- Web: type-check clean; conditional-rendering checks for permission-gated controls
  (buttons/sections appear only for the right role) following existing component test
  patterns in `apps/web/src/components/staff/`.

Full verification pass at the end: typecheck (web baseline currently 14 errors, must
stay there), full web + server suites compared pre/post for zero regressions — same
process used for the redirect-loop fix (`c248990`).

## Out of Scope (this spec)

- Per-user à la carte permission overrides (explicitly rejected — stays role-based).
- Session/login activity (IP, user-agent, last-seen) — not selected during
  brainstorming; can be added to a future iteration of the user-detail view.
- The other 5 roadmap sub-projects (reports, chat moderation, editorial tools) — each
  gets its own spec.
