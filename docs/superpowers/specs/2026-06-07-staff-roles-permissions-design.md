# Staff Roles & Permissions — Design

**Date:** 2026-06-07
**Status:** Approved (brainstorming) — ready for implementation plan
**Scope:** Platform-wide staff with role-based powers. v1 covers user management (A),
content moderation (B), and an audit log (E). Reports queue (C) and editorial tooling
(D) are explicitly out of scope for v1.

## Goal

Introduce platform staff with distinct roles, where each role grants a named bundle of
permissions. Today every authenticated user is equal (`requireUser` only checks
signed-in vs. not). We add roles, permission checks, the endpoints/UI to act on them,
and an audit trail.

## Decisions (from brainstorming)

- **Staff type:** platform-wide (not scoped to lists/communities).
- **Roles:** `owner` → `admin` → `moderator` → `support`, plus the default `user`.
- **Power model:** roles are **named bundles of atomic permissions** (not pure hierarchy,
  not per-user à la carte). This is the native model of better-auth's `admin` plugin.
- **Approach:** use better-auth's official `admin` plugin (Approach 1). User management
  (group A) comes largely for free; we add access-control statements for our own
  resources (group B) and an audit log table (group E).
- **UI surface:** minimal staff panel — full backend + a `/staff` page (users + audit)
  and inline moderation actions on content. No dedicated moderation queue.
- **Mobile (`apps/native`):** out of scope for v1. Staff panel is web-only.

## Roles & Permission Matrix

### Statements (resource → actions)

- `user`: `list`, `ban`, `unban`, `set-role`, `impersonate`
- `content`: `hide`, `delete`, `restore` — applies to `review`, `log`, `list`, `post`, `comment`
- `audit`: `read`

### Matrix

| Permission        | Owner | Admin | Moderator | Support |
|-------------------|:-----:|:-----:|:---------:|:-------:|
| user:list         |  ✅   |  ✅   |    ✅     |   ✅    |
| user:ban / unban  |  ✅   |  ✅   |    ❌     |   ❌    |
| user:set-role     |  ✅   |  ❌   |    ❌     |   ❌    |
| user:impersonate  |  ✅   |  ❌   |    ❌     |   ❌    |
| content:hide      |  ✅   |  ✅   |    ✅     |   ✅    |
| content:delete    |  ✅   |  ✅   |    ✅     |   ❌    |
| content:restore   |  ✅   |  ✅   |    ✅     |   ❌    |
| audit:read        |  ✅   |  ✅   |    ❌     |   ❌    |

Rules:
- **Owner** is the only role that can change roles (`set-role`) — prevents an admin from
  self-promoting or editing other admins.
- **Support** is intentionally soft: can hide content and view users, but cannot delete
  or ban.
- Normal users have role `user` (no staff permissions) — the existing default. Nobody is
  staff until explicitly appointed.
- A staff member **cannot act on a peer or higher rank** (e.g. an admin cannot ban an
  owner). Enforced in endpoints via `assertOutranks`.

## Data Model

### a) `user` table (via better-auth `admin` plugin)

Add to `packages/db/src/schema/auth.ts` (and Drizzle migration):
- `role: text` default `"user"`
- `banned: boolean` default `false`
- `banReason: text` nullable
- `banExpires: timestamp` nullable (timed bans)

### b) Content moderation columns

Add to `review`, `log`, `list`, `post` (the `comment` table already has `deletedAt`,
which we treat as its moderation flag in the same logical scheme):
- `removedAt: timestamp` nullable — when set, the content is hidden
- `removedBy: text` nullable, FK → `user.id` — acting staff member
- `removalReason: text` nullable

hide vs delete semantics:
- `hide` → sets `removedAt` (soft, reversible via `restore`).
- `delete` → also a reversible soft-delete (no physical hard-delete in v1, to preserve
  traceability), but excluded from every public query. Reversible only by Owner/Admin.
- Existing public read queries must filter `removedAt IS NULL` (and `deletedAt IS NULL`
  for comments).

Chosen over a generic `content_moderation(targetType, targetId)` table because per-table
`removedAt` is simpler and more performant to filter in existing read paths.

### c) `staff_audit_log` table (new — `schema/staff.ts`, exported from the barrel)

- `id` (text PK)
- `actorId` (text, FK → `user.id`)
- `action` (text, e.g. `user.ban`, `user.unban`, `user.set-role`, `content.hide`,
  `content.delete`, `content.restore`)
- `targetType` (text: `user|review|list|post|comment|log`)
- `targetId` (text)
- `reason` (text, nullable)
- `metadata` (jsonb)
- `createdAt` (timestamp, default now)
- Indexes on `actorId` and `createdAt`.

## Server

### a) Access control config (`packages/auth/src/`)

- New `permissions.ts`: `createAccessControl({ user: [...], content: [...], audit: [...] })`
  with the statements above; define `owner`, `admin`, `moderator`, `support` via
  `ac.newRole({...})` matching the matrix.
- `index.ts`: register `admin({ ac, roles, defaultRole: "user", adminRoles: ["owner","admin"] })`
  in the existing `plugins` array (alongside `expo()` and the optional Polar plugin).

### b) Authorization helpers (`apps/server/src/context.ts`)

Alongside `requireUser`:
- `requirePermission(ctx, { resource, action })` — uses `auth.api.userHasPermission` with
  the current session; throws `FORBIDDEN` (403) when the permission is missing.
- `requireStaff(ctx)` — shortcut: user with role ≠ `user`.
- `assertOutranks(actor, target)` — compares rank order
  `owner > admin > moderator > support > user`; throws if actor does not strictly
  outrank target.

### c) Staff routes (`apps/server/src/routes/staff.ts`, mounted in `index.ts`)

- `GET  /api/staff/users` — list/search users (perm `user:list`)
- `POST /api/staff/users/:id/ban` · `/unban` (perm `user:ban`/`unban` + `assertOutranks`)
- `POST /api/staff/users/:id/role` — change role (perm `user:set-role`, owner-only)
- `POST /api/staff/content/:type/:id/hide` · `/delete` · `/restore` (perm `content:*`)
- `GET  /api/staff/audit` — audit log (perm `audit:read`)

Generic `:type` endpoints (not per-content-type endpoints). Every mutating endpoint:
- writes a `staff_audit_log` row, and
- applies rate limiting via the existing `hit()` helper.

### d) Ban enforcement

The `admin` plugin already blocks login/session for banned users. Additionally, in
`context.ts`, if `user.banned` and `banExpires` is unset or in the future, treat the
request as blocked for write actions.

## UI (web only) — `apps/web/src/app/(app)/staff/`

- **`/staff` page**: accessible only to role ≠ `user` (redirect otherwise). Account-menu
  link shown only to staff.
- **Users tab**: searchable table → inline ban/unban; role-change dropdown shown only to
  Owner. Uses the Section "Server" endpoints via Eden + TanStack Query (existing pattern).
- **Audit tab**: chronological list of staff actions (only when `audit:read`).
- **Inline moderation**: on content (reviews, lists, posts, comments) a "⋯ Staff" menu
  offers *Hide / Delete / Restore*, visible only with the relevant `content:*` permission.
- Client gating via `authClient.admin.checkRolePermission`; the real gate is always
  server-side.

## Bootstrapping the first Owner

Cannot appoint an Owner via UI before one exists. A seed script
`apps/server/src/jobs/set-owner.ts` promotes the user with the email passed via
env/arg to `owner`. Run once manually; document the command.

## Testing (Bun test, `*.test.ts`)

- Role/permission unit tests: each role has exactly the permissions in the matrix.
- `assertOutranks`: case table (admin cannot ban owner, peer cannot act on peer, etc.).
- Endpoints: 403 without permission, 200 with permission, audit row written, and public
  queries filter `removedAt IS NULL`.
- Bootstrap: the script promotes the correct user.

## Out of Scope (v1)

- Reports/flagging queue (group C).
- Editorial tooling: curated news, featured lists, badge management (group D).
- Mobile staff tooling (`apps/native`).
- Physical hard-delete of content.
