# Staff Roles & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform-wide staff with role-based permission bundles (owner/admin/moderator/support) covering user management, content moderation, and an audit log.

**Architecture:** Use better-auth's official `admin` plugin for roles + access-control. Define atomic permission statements; roles are named bundles. Add `role`/`banned` columns to `user`, `removedAt`/`removedBy`/`removalReason` to moderatable content tables, and a `staff_audit_log` table. Expose Elysia `/api/staff/*` endpoints gated by permission checks; mutations write audit rows. A minimal web `/staff` panel plus inline moderation actions consume those endpoints.

**Tech Stack:** Bun, Elysia, Drizzle (Postgres/Neon), better-auth 1.6.9, Next.js 16, Eden/`@still/api-client`, TanStack Query, `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-07-staff-roles-permissions-design.md`

---

## File Structure

**Create:**
- `packages/auth/src/permissions.ts` — access-control statements + role definitions (single source of truth for the matrix)
- `packages/auth/src/permissions.test.ts` — asserts each role's permission set matches the matrix
- `packages/db/src/schema/staff.ts` — `staffAuditLog` table
- `apps/server/src/lib/staff-rank.ts` — rank order + `outranks()` pure helper
- `apps/server/src/lib/staff-rank.test.ts`
- `apps/server/src/lib/staff-audit.ts` — `writeAuditLog()` helper
- `apps/server/src/routes/staff.ts` — `/api/staff/*` routes
- `apps/server/src/routes/staff.test.ts`
- `apps/server/src/jobs/set-owner.ts` — bootstrap script
- `apps/web/src/app/(app)/staff/page.tsx` — staff panel shell + gate
- `apps/web/src/components/staff/staff-users-tab.tsx`
- `apps/web/src/components/staff/staff-audit-tab.tsx`
- `apps/web/src/components/staff/staff-content-actions.tsx` — inline moderation menu

**Modify:**
- `packages/auth/src/index.ts` — register `admin()` plugin
- `packages/db/src/schema/auth.ts` — admin fields on `user`
- `packages/db/src/schema/activity.ts` — moderation columns on `log`, `review`
- `packages/db/src/schema/list.ts` — moderation columns on `list`
- `packages/db/src/schema/social.ts` — moderation columns on `post`
- `packages/db/src/schema/index.ts` — export `./staff`
- `apps/server/src/context.ts` — `requirePermission`, `requireStaff`, ban write-block
- `apps/server/src/server/app.ts` — mount `staffRoute`
- `apps/web/src/lib/auth-client.ts` — add `adminClient()`
- `apps/web/src/lib/auth-server.ts` — add `role`/`banned` to `ServerSession.user`
- Public read queries that select moderatable content — add `removedAt IS NULL` filter (Task 6)

---

## Task 1: Access-control statements & role bundles

Defines the permission matrix once, in a place both server and (type) client can import. No DB or plugin wiring yet — pure data + tests.

**Files:**
- Create: `packages/auth/src/permissions.ts`
- Test: `packages/auth/src/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/auth/src/permissions.test.ts
import { describe, expect, it } from "bun:test";
import { ac, roles, STAFF_ROLES } from "./permissions";

describe("staff permission matrix", () => {
  it("exposes exactly the four staff roles", () => {
    expect(Object.keys(roles).sort()).toEqual(
      ["admin", "moderator", "owner", "support"],
    );
    expect(STAFF_ROLES).toEqual(["owner", "admin", "moderator", "support"]);
  });

  it("owner can do everything including set-role and audit", () => {
    expect(roles.owner.authorize({ user: ["set-role"] }).success).toBe(true);
    expect(roles.owner.authorize({ user: ["ban"] }).success).toBe(true);
    expect(roles.owner.authorize({ content: ["delete"] }).success).toBe(true);
    expect(roles.owner.authorize({ audit: ["read"] }).success).toBe(true);
  });

  it("admin can ban and read audit but cannot set-role or impersonate", () => {
    expect(roles.admin.authorize({ user: ["ban"] }).success).toBe(true);
    expect(roles.admin.authorize({ audit: ["read"] }).success).toBe(true);
    expect(roles.admin.authorize({ user: ["set-role"] }).success).toBe(false);
    expect(roles.admin.authorize({ user: ["impersonate"] }).success).toBe(false);
  });

  it("moderator can moderate content but not ban or read audit", () => {
    expect(roles.moderator.authorize({ content: ["delete"] }).success).toBe(true);
    expect(roles.moderator.authorize({ content: ["hide"] }).success).toBe(true);
    expect(roles.moderator.authorize({ user: ["ban"] }).success).toBe(false);
    expect(roles.moderator.authorize({ audit: ["read"] }).success).toBe(false);
  });

  it("support can hide and list users but cannot delete or ban", () => {
    expect(roles.support.authorize({ content: ["hide"] }).success).toBe(true);
    expect(roles.support.authorize({ user: ["list"] }).success).toBe(true);
    expect(roles.support.authorize({ content: ["delete"] }).success).toBe(false);
    expect(roles.support.authorize({ content: ["restore"] }).success).toBe(false);
    expect(roles.support.authorize({ user: ["ban"] }).success).toBe(false);
  });

  it("ac includes the better-auth default user statements", () => {
    // defaultStatements provides the `user`/`session` admin verbs; our statement
    // extends them, so the resource keys must exist.
    expect(ac.statements.user).toContain("ban");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth && bun test src/permissions.test.ts`
Expected: FAIL — `Cannot find module './permissions'`.

- [ ] **Step 3: Write the implementation**

```typescript
// packages/auth/src/permissions.ts
import {
  createAccessControl,
  defaultStatements,
} from "better-auth/plugins/access";

/**
 * Atomic permission statements (resource -> actions). We extend better-auth's
 * `defaultStatements` (which already defines the `user`/`session` admin verbs
 * the plugin needs internally) with our own `content` and `audit` resources,
 * and add our extra `user` verbs (set-role / impersonate / list / unban).
 */
export const statement = {
  ...defaultStatements,
  user: ["list", "ban", "unban", "set-role", "impersonate"],
  content: ["hide", "delete", "restore"],
  audit: ["read"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  user: ["list", "ban", "unban", "set-role", "impersonate"],
  content: ["hide", "delete", "restore"],
  audit: ["read"],
});

export const admin = ac.newRole({
  user: ["list", "ban", "unban"],
  content: ["hide", "delete", "restore"],
  audit: ["read"],
});

export const moderator = ac.newRole({
  user: ["list"],
  content: ["hide", "delete", "restore"],
});

export const support = ac.newRole({
  user: ["list"],
  content: ["hide"],
});

/** Map consumed by the better-auth `admin` plugin `roles` option. */
export const roles = { owner, admin, moderator, support };

/** Rank order, highest first. Mirrors the spec hierarchy. */
export const STAFF_ROLES = ["owner", "admin", "moderator", "support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AppRole = StaffRole | "user";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/auth && bun test src/permissions.test.ts`
Expected: PASS (all assertions). If `authorize` shape differs in 1.6.9, adapt the test to use `ac`/role API actually exported — but `newRole(...).authorize(query)` returning `{ success }` is the documented 1.x API.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/permissions.ts packages/auth/src/permissions.test.ts
git commit -m "feat(auth): define staff access-control statements and role bundles"
```

---

## Task 2: Register the better-auth `admin` plugin

Wires the matrix into better-auth so sessions carry `role` and the admin API (ban/list/setRole) becomes available.

**Files:**
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Add the import**

At the top of `packages/auth/src/index.ts`, alongside the existing imports:

```typescript
import { admin } from "better-auth/plugins";

import { ac, roles } from "./permissions";
```

- [ ] **Step 2: Register the plugin in the `plugins` array**

In `createAuth()`, change the `plugins` array (currently `[expo(), ...(polarPlugin ? [polarPlugin] : [])]`) to:

```typescript
    plugins: [
      // Order matters: expo() must come before any plugin that schedules
      // post-signup work so its session bridge is initialized.
      expo(),
      admin({
        ac,
        roles,
        defaultRole: "user",
        // Users holding these roles may call the admin API endpoints.
        adminRoles: ["owner", "admin"],
      }),
      ...(polarPlugin ? [polarPlugin] : []),
    ],
```

- [ ] **Step 3: Typecheck**

Run from repo root: `./node_modules/.bin/tsc -p packages/auth/tsconfig.json --noEmit`
Expected: no new errors referencing `index.ts` (pre-existing baseline errors elsewhere are acceptable per project memory). If `packages/auth` has no tsconfig, run `cd packages/auth && bunx tsc --noEmit` or skip to the build check in Task 11.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "feat(auth): register better-auth admin plugin with staff roles"
```

---

## Task 3: Database schema — user admin fields, moderation columns, audit table

The `admin` plugin reads/writes `role`, `banned`, `banReason`, `banExpires` on `user`. Moderation needs soft-removal columns. Audit needs its own table.

**Files:**
- Modify: `packages/db/src/schema/auth.ts`
- Modify: `packages/db/src/schema/activity.ts`
- Modify: `packages/db/src/schema/list.ts`
- Modify: `packages/db/src/schema/social.ts`
- Create: `packages/db/src/schema/staff.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add admin fields to `user`**

In `packages/db/src/schema/auth.ts`, inside the `user` `pgTable` definition, add these columns after `image`:

```typescript
    role: text("role").default("user").notNull(),
    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
```

(`text` and `boolean` and `timestamp` are already imported in this file.)

- [ ] **Step 2: Add moderation columns to `log` and `review`**

In `packages/db/src/schema/activity.ts`, add to BOTH the `log` and `review` `pgTable` column objects (after their existing timestamp columns, before the table-extras array):

```typescript
    removedAt: timestamp("removed_at"),
    removedBy: text("removed_by"),
    removalReason: text("removal_reason"),
```

Confirm `text` and `timestamp` are imported at the top of the file; add them to the `drizzle-orm/pg-core` import if missing.

- [ ] **Step 3: Add moderation columns to `list`**

In `packages/db/src/schema/list.ts`, add the same three columns to the `list` `pgTable` column object. Verify imports.

- [ ] **Step 4: Add moderation columns to `post`**

In `packages/db/src/schema/social.ts`, add the same three columns to the `post` `pgTable` column object. (The `comment` table already has `deletedAt` and is intentionally left as-is; it is treated as removed when `deletedAt IS NOT NULL`.)

- [ ] **Step 5: Create the audit-log table**

```typescript
// packages/db/src/schema/staff.ts
import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const staffAuditLog = pgTable(
  "staff_audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // e.g. "user.ban", "content.hide"
    targetType: text("target_type").notNull(), // user | review | list | post | comment | log
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("staff_audit_actor_idx").on(table.actorId),
    index("staff_audit_created_idx").on(table.createdAt),
  ],
);

export const staffAuditLogRelations = relations(staffAuditLog, ({ one }) => ({
  actor: one(user, {
    fields: [staffAuditLog.actorId],
    references: [user.id],
  }),
}));
```

- [ ] **Step 6: Export the new schema from the barrel**

In `packages/db/src/schema/index.ts`, add (keeping alphabetical-ish order, after `./social`):

```typescript
export * from "./staff";
```

- [ ] **Step 7: Generate the migration**

Run from repo root: `cd packages/db && bun run db:generate`
Expected: a new file `packages/db/src/migrations/0024_*.sql` containing `ALTER TABLE "user" ADD COLUMN "role" ...`, the moderation `ADD COLUMN` statements for `log`/`review`/`list`/`post`, and `CREATE TABLE "staff_audit_log"`.

- [ ] **Step 8: Inspect the generated SQL**

Read the new `0024_*.sql`. Verify: no `DROP` of existing columns, defaults present on `role`/`banned`, and the new table/indexes. If drizzle-kit asks interactive questions, re-run non-interactively or accept the create operations.

- [ ] **Step 9: Apply the migration**

Run from repo root: `bun run db:migrate`
Expected: migration `0024` applied with no error. (If `DATABASE_URL` is not set locally, document that this must run against the dev DB before endpoints are testable, and proceed — endpoint tests in later tasks mock the DB or run against the migrated dev DB.)

- [ ] **Step 10: Commit**

```bash
git add packages/db/src/schema packages/db/src/migrations
git commit -m "feat(db): add user admin fields, content moderation columns, staff_audit_log"
```

---

## Task 4: Rank helper (`outranks`)

Pure function enforcing "cannot act on a peer or higher rank". Isolated and fully unit-tested.

**Files:**
- Create: `apps/server/src/lib/staff-rank.ts`
- Test: `apps/server/src/lib/staff-rank.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/lib/staff-rank.test.ts
import { describe, expect, it } from "bun:test";
import { outranks, rankOf } from "./staff-rank";

describe("rankOf", () => {
  it("orders roles highest-first", () => {
    expect(rankOf("owner")).toBeGreaterThan(rankOf("admin"));
    expect(rankOf("admin")).toBeGreaterThan(rankOf("moderator"));
    expect(rankOf("moderator")).toBeGreaterThan(rankOf("support"));
    expect(rankOf("support")).toBeGreaterThan(rankOf("user"));
  });

  it("treats unknown/empty role as plain user", () => {
    expect(rankOf(null)).toBe(rankOf("user"));
    expect(rankOf("bogus")).toBe(rankOf("user"));
  });
});

describe("outranks", () => {
  it("is true only when actor is strictly above target", () => {
    expect(outranks("admin", "moderator")).toBe(true);
    expect(outranks("owner", "admin")).toBe(true);
    expect(outranks("admin", "admin")).toBe(false); // peer
    expect(outranks("moderator", "admin")).toBe(false); // lower
    expect(outranks("admin", "owner")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/staff-rank.test.ts`
Expected: FAIL — `Cannot find module './staff-rank'`.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/server/src/lib/staff-rank.ts
import { STAFF_ROLES, type AppRole } from "@still/auth/permissions";

// Highest first in STAFF_ROLES => higher index value via reverse lookup.
const ORDER: AppRole[] = [...STAFF_ROLES].reverse(); // [support, moderator, admin, owner]

export function rankOf(role: string | null | undefined): number {
  if (!role) return 0; // user
  const idx = ORDER.indexOf(role as AppRole);
  return idx < 0 ? 0 : idx + 1; // user=0, support=1, ... owner=4
}

/** True when `actorRole` is strictly higher than `targetRole`. */
export function outranks(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  return rankOf(actorRole) > rankOf(targetRole);
}
```

Note: `@still/auth/permissions` resolves via the existing `"./*"` export in `packages/auth/package.json`. Confirm `apps/server` depends on `@still/auth` (it imports `auth` already in `context.ts`, so yes).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/staff-rank.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/staff-rank.ts apps/server/src/lib/staff-rank.test.ts
git commit -m "feat(server): add staff rank helper enforcing outranks rule"
```

---

## Task 5: Authorization helpers in context

Adds `requireStaff` / `requirePermission` and a ban write-block to the shared request context.

**Files:**
- Modify: `apps/server/src/context.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/server/src/context.ts`, add:

```typescript
import type { StaffRole } from "@still/auth/permissions";
```

- [ ] **Step 2: Add the helpers below `requireUser`**

Append to `apps/server/src/context.ts`:

```typescript
type Resource = "user" | "content" | "audit";

/**
 * Assert the current user is signed in AND holds the given permission for their
 * role. Uses the Better Auth admin plugin's server-side check, which evaluates
 * the same access-control roles registered in `@still/auth`.
 */
export async function requirePermission(
  ctx: { user: { id: string; role?: string | null } | null },
  permission: Partial<Record<Resource, string[]>>,
): Promise<void> {
  if (!ctx.user) throw new Error("UNAUTHORIZED");
  const role = (ctx.user.role ?? "user") as StaffRole | "user";
  if (role === "user") throw new Error("FORBIDDEN");
  const { auth } = await import("@still/auth");
  const result = await auth.api.userHasPermission({
    body: { role, permissions: permission },
  });
  if (!result?.success) throw new Error("FORBIDDEN");
}

/** Assert the user is staff (any non-`user` role). */
export function requireStaff<T extends { user: { role?: string | null } | null }>(
  ctx: T,
): asserts ctx is T & { user: NonNullable<T["user"]> } {
  if (!ctx.user || (ctx.user.role ?? "user") === "user") {
    throw new Error("FORBIDDEN");
  }
}

/** True when a user is currently banned (no expiry, or expiry in the future). */
export function isBanned(
  user: { banned?: boolean | null; banExpires?: Date | string | null } | null,
): boolean {
  if (!user?.banned) return false;
  if (!user.banExpires) return true;
  return new Date(user.banExpires).getTime() > Date.now();
}
```

Note: `auth.api.userHasPermission` accepts `{ body: { role, permissions } }` and returns `{ success: boolean }` in better-auth 1.x. If the session object already carries `role`, no extra DB read happens. We pass `role` (not `userId`) to avoid an extra lookup.

- [ ] **Step 3: Typecheck**

Run from repo root: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
Expected: no new errors in `context.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/context.ts
git commit -m "feat(server): add requireStaff, requirePermission, isBanned helpers"
```

---

## Task 6: Filter removed content from public reads

Before exposing moderation, ensure hidden/deleted content disappears from public surfaces.

**Files:**
- Modify: public read queries selecting `review`, `log`, `list`, `post`
- Modify: queries selecting `comment` (already has `deletedAt`)

- [ ] **Step 1: Enumerate the read sites**

Run from repo root:
`rg -n "from\(review\)|from\(log\)|from\(list\)|from\(post\)" apps/server/src --type ts`
List every public-facing select (feed, profile, movie detail, lists, posts). Exclude the new staff routes and test files.

- [ ] **Step 2: Add the filter to each public select**

For each enumerated query, add `isNull(<table>.removedAt)` to the `where(and(...))` clause (import `isNull` from `drizzle-orm` if not already imported). Example pattern for `post` reads:

```typescript
// before
.where(eq(post.userId, viewerId))
// after
.where(and(eq(post.userId, viewerId), isNull(post.removedAt)))
```

For `comment` reads, add `isNull(comment.deletedAt)` where not already present.

- [ ] **Step 3: Add a regression test for one representative surface**

Pick the feed or posts list route. In its existing `*.test.ts` (or a new `apps/server/src/routes/posts.test.ts`), add a case: insert a post, set `removedAt = now()`, assert the public list endpoint does NOT return it.

```typescript
it("omits removed posts from the public list", async () => {
  // arrange: seed a post, then mark removedAt
  // act: call the public list endpoint
  // assert: removed post id is absent
});
```

Fill the arrange/act/assert with the same helpers the surrounding tests use (mirror an existing test in that file for seeding + calling the route).

- [ ] **Step 4: Run the affected route tests**

Run: `cd apps/server && bun test src/routes`
Expected: PASS, including the new regression test.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): exclude removed content from public read queries"
```

---

## Task 7: Audit-log writer

Small helper that all staff mutations call.

**Files:**
- Create: `apps/server/src/lib/staff-audit.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// apps/server/src/lib/staff-audit.ts
import { db, staffAuditLog } from "@still/db";

import { makeId } from "./cuid";

export type AuditTargetType =
  | "user"
  | "review"
  | "list"
  | "post"
  | "comment"
  | "log";

export async function writeAuditLog(entry: {
  actorId: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(staffAuditLog).values({
    id: makeId("aud"),
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? {},
  });
}
```

Confirm `staffAuditLog` is re-exported from `@still/db` (it is, via the schema barrel + the db package's main export of `* from schema`). If `@still/db` only re-exports specific names, import from `@still/db/schema/staff` instead.

- [ ] **Step 2: Typecheck**

Run from repo root: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
Expected: no new errors. (`makeId` prefix `"aud"` follows the existing `makeId("evt")` pattern.)

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/lib/staff-audit.ts
git commit -m "feat(server): add staff audit-log writer"
```

---

## Task 8: Staff routes — users, content, audit

The HTTP surface. Each handler: signed-in check, permission check, (where relevant) `outranks` check, the mutation, an audit-log write, rate limit.

**Files:**
- Create: `apps/server/src/routes/staff.ts`
- Modify: `apps/server/src/server/app.ts`
- Test: `apps/server/src/routes/staff.test.ts`

- [ ] **Step 1: Write the route module**

```typescript
// apps/server/src/routes/staff.ts
import { auth } from "@still/auth";
import { db, list, log, post, review, staffAuditLog, user } from "@still/db";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context, requirePermission } from "../context";
import { hit } from "../lib/rate-limit";
import { outranks } from "../lib/staff-rank";
import { writeAuditLog, type AuditTargetType } from "../lib/staff-audit";

const CONTENT_TABLES = { review, log, list, post } as const;
type ContentType = keyof typeof CONTENT_TABLES;

function forbidden(status: (c: number, m: string) => unknown, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "UNAUTHORIZED") return status(401, "Sign in");
  if (msg === "FORBIDDEN") return status(403, "Not allowed");
  return status(500, msg);
}

export const staffRoute = new Elysia({ prefix: "/api/staff", tags: ["staff"] })
  .use(context)

  // ---- Users -------------------------------------------------------------
  .get("/users", async ({ user: viewer, query, status }) => {
    try {
      await requirePermission({ user: viewer }, { user: ["list"] });
    } catch (e) {
      return forbidden(status, e);
    }
    const q = (query.q ?? "").trim();
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        banned: user.banned,
        banExpires: user.banExpires,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(
        q
          ? or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`))
          : undefined,
      )
      .orderBy(desc(user.createdAt))
      .limit(50);
    return { users: rows };
  })

  .post(
    "/users/:id/ban",
    async ({ user: viewer, params, body, status }) => {
      try {
        await requirePermission({ user: viewer }, { user: ["ban"] });
      } catch (e) {
        return forbidden(status, e);
      }
      if (!viewer) return status(401, "Sign in");
      if (!hit(`staff:ban:${viewer.id}`, { limit: 30, windowMs: 60_000 }).ok)
        return status(429, "Slow down");
      const [target] = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.id, params.id));
      if (!target) return status(404, "User not found");
      if (!outranks(viewer.role, target.role))
        return status(403, "Cannot act on a peer or higher-ranked staff member");

      await auth.api.banUser({
        body: {
          userId: params.id,
          banReason: body.reason ?? undefined,
          banExpiresIn: body.expiresInSeconds ?? undefined,
        },
        headers: undefined,
      });
      await writeAuditLog({
        actorId: viewer.id,
        action: "user.ban",
        targetType: "user",
        targetId: params.id,
        reason: body.reason ?? null,
        metadata: { expiresInSeconds: body.expiresInSeconds ?? null },
      });
      return { ok: true };
    },
    {
      body: t.Object({
        reason: t.Optional(t.String({ maxLength: 500 })),
        expiresInSeconds: t.Optional(t.Number()),
      }),
    },
  )

  .post("/users/:id/unban", async ({ user: viewer, params, status }) => {
    try {
      await requirePermission({ user: viewer }, { user: ["unban"] });
    } catch (e) {
      return forbidden(status, e);
    }
    if (!viewer) return status(401, "Sign in");
    await auth.api.unbanUser({ body: { userId: params.id } });
    await writeAuditLog({
      actorId: viewer.id,
      action: "user.unban",
      targetType: "user",
      targetId: params.id,
    });
    return { ok: true };
  })

  .post(
    "/users/:id/role",
    async ({ user: viewer, params, body, status }) => {
      try {
        await requirePermission({ user: viewer }, { user: ["set-role"] });
      } catch (e) {
        return forbidden(status, e);
      }
      if (!viewer) return status(401, "Sign in");
      const [target] = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.id, params.id));
      if (!target) return status(404, "User not found");
      // Owner-only endpoint, but still forbid editing a peer owner.
      if (!outranks(viewer.role, target.role) && target.role !== "user")
        return status(403, "Cannot change role of a peer or higher staff member");

      await auth.api.setRole({ body: { userId: params.id, role: body.role } });
      await writeAuditLog({
        actorId: viewer.id,
        action: "user.set-role",
        targetType: "user",
        targetId: params.id,
        metadata: { from: target.role, to: body.role },
      });
      return { ok: true };
    },
    {
      body: t.Object({
        role: t.Union([
          t.Literal("user"),
          t.Literal("support"),
          t.Literal("moderator"),
          t.Literal("admin"),
          t.Literal("owner"),
        ]),
      }),
    },
  )

  // ---- Content moderation -------------------------------------------------
  .post(
    "/content/:type/:id/:op",
    async ({ user: viewer, params, body, status }) => {
      const { type, id, op } = params as {
        type: string;
        id: string;
        op: "hide" | "delete" | "restore";
      };
      if (!(type in CONTENT_TABLES)) return status(400, "Unknown content type");
      if (!["hide", "delete", "restore"].includes(op))
        return status(400, "Unknown operation");
      const permAction = op === "restore" ? "restore" : op;
      try {
        await requirePermission({ user: viewer }, { content: [permAction] });
      } catch (e) {
        return forbidden(status, e);
      }
      if (!viewer) return status(401, "Sign in");
      if (!hit(`staff:mod:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok)
        return status(429, "Slow down");

      const table = CONTENT_TABLES[type as ContentType];
      const setValues =
        op === "restore"
          ? { removedAt: null, removedBy: null, removalReason: null }
          : {
              removedAt: new Date(),
              removedBy: viewer.id,
              removalReason: body.reason ?? null,
            };
      const updated = await db
        .update(table)
        .set(setValues)
        .where(eq(table.id, id))
        .returning({ id: table.id });
      if (updated.length === 0) return status(404, "Content not found");

      await writeAuditLog({
        actorId: viewer.id,
        action: `content.${op}`,
        targetType: type as AuditTargetType,
        targetId: id,
        reason: body.reason ?? null,
      });
      return { ok: true };
    },
    { body: t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) }) },
  )

  // ---- Audit log ----------------------------------------------------------
  .get("/audit", async ({ user: viewer, query, status }) => {
    try {
      await requirePermission({ user: viewer }, { audit: ["read"] });
    } catch (e) {
      return forbidden(status, e);
    }
    const limit = Math.min(Number(query.limit ?? 100), 200);
    const rows = await db
      .select()
      .from(staffAuditLog)
      .orderBy(desc(staffAuditLog.createdAt))
      .limit(limit);
    return { entries: rows };
  });
```

Note on `comment` moderation: comments use `deletedAt`, not `removedAt`. v1 exposes moderation for `review|log|list|post` only (the four in `CONTENT_TABLES`); comment moderation via `deletedAt` is a follow-up. This matches the spec's tables list while keeping the generic endpoint type-safe. Update the spec's "applies to comment" note if reviewers want comment parity in v1.

- [ ] **Step 2: Mount the route**

In `apps/server/src/server/app.ts`, add the import near the other route imports:

```typescript
import { staffRoute } from "../routes/staff";
```

and add `.use(staffRoute)` in the route chain (e.g. after `.use(notificationsRoute)`).

- [ ] **Step 3: Write endpoint tests**

```typescript
// apps/server/src/routes/staff.test.ts
import { describe, expect, it } from "bun:test";
import { staffRoute } from "./staff";

// Helper: build a Request and call the Elysia handler.
function call(path: string, init?: RequestInit) {
  return staffRoute.handle(
    new Request(`http://localhost${path}`, init),
  );
}

describe("staff routes auth gating", () => {
  it("rejects /users when signed out with 401", async () => {
    const res = await call("/api/staff/users");
    expect(res.status).toBe(401);
  });

  it("rejects unknown content type with 400 (after auth) ", async () => {
    // Without a session this returns 401 first; this documents the type guard.
    const res = await call("/api/staff/content/bogus/x/hide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect([400, 401]).toContain(res.status);
  });
});
```

For permission-positive tests (signed-in staff), mirror the session-mocking approach used in `apps/server/src/routes/lists.test.ts` (it already exercises authed routes — copy its session/cookie setup helper). Add at minimum:
- moderator can hide a post (removedAt set, audit row written)
- support cannot delete (403)
- admin cannot ban an owner (403 via outranks)

- [ ] **Step 4: Run the tests**

Run: `cd apps/server && bun test src/routes/staff.test.ts`
Expected: PASS. Iterate on the session helper until the authed cases pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/staff.ts apps/server/src/routes/staff.test.ts apps/server/src/server/app.ts
git commit -m "feat(server): add /api/staff routes for users, content moderation, audit"
```

---

## Task 9: Bootstrap script — promote the first owner

**Files:**
- Create: `apps/server/src/jobs/set-owner.ts`

- [ ] **Step 1: Write the script**

```typescript
// apps/server/src/jobs/set-owner.ts
/**
 * One-off bootstrap: promote a user to `owner` by email. There is no UI path to
 * mint the first owner (set-role is owner-only), so run this once manually:
 *
 *   bun run apps/server/src/jobs/set-owner.ts you@example.com
 */
import { db, user } from "@still/db";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: bun run set-owner.ts <email>");
    process.exit(1);
  }
  const updated = await db
    .update(user)
    .set({ role: "owner" })
    .where(eq(user.email, email))
    .returning({ id: user.id, email: user.email, role: user.role });
  if (updated.length === 0) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  console.log("Promoted to owner:", updated[0]);
  process.exit(0);
}

void main();
```

- [ ] **Step 2: Verify it runs (dry check)**

Run: `cd apps/server && bun run src/jobs/set-owner.ts`
Expected: prints the usage error and exits 1 (no email arg) — confirms it imports/compiles. Running with a real email requires `DATABASE_URL`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/jobs/set-owner.ts
git commit -m "feat(server): add set-owner bootstrap script"
```

---

## Task 10: Web — admin client, session role, staff panel

**Files:**
- Modify: `apps/web/src/lib/auth-client.ts`
- Modify: `apps/web/src/lib/auth-server.ts`
- Create: `apps/web/src/app/(app)/staff/page.tsx`
- Create: `apps/web/src/components/staff/staff-users-tab.tsx`
- Create: `apps/web/src/components/staff/staff-audit-tab.tsx`

- [ ] **Step 1: Add `adminClient` to the web auth client**

```typescript
// apps/web/src/lib/auth-client.ts
import { polarClient } from "@polar-sh/better-auth";
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

import { ac, roles } from "@still/auth/permissions";

export const authClient = createAuthClient({
  plugins: [polarClient(), adminClient({ ac, roles })],
});
```

Passing `ac`/`roles` enables `authClient.admin.checkRolePermission(...)` for client-side gating. Confirm `apps/web` can import `@still/auth/permissions` (it depends on `@still/auth`; the subpath export exists). If importing server access-control into the browser bundle pulls server-only deps, fall back to `adminClient()` with no args and gate purely via the role string from the session.

- [ ] **Step 2: Add `role`/`banned` to the server session type**

In `apps/web/src/lib/auth-server.ts`, extend `ServerSession.user`:

```typescript
  user: {
    id: string;
    name?: string | null;
    email?: string;
    image?: string | null;
    emailVerified?: boolean;
    role?: string | null;
    banned?: boolean | null;
  };
```

(No fetch change needed — the admin plugin already includes `role` in `get-session`.)

- [ ] **Step 3: Create the staff page shell with the gate**

```tsx
// apps/web/src/app/(app)/staff/page.tsx
import { redirect } from "next/navigation";

import { authServer } from "@/lib/auth-server";
import { StaffUsersTab } from "@/components/staff/staff-users-tab";
import { StaffAuditTab } from "@/components/staff/staff-audit-tab";

const STAFF_ROLES = ["owner", "admin", "moderator", "support"];

export default async function StaffPage() {
  const session = await authServer();
  const role = session?.user?.role ?? "user";
  if (!session || !STAFF_ROLES.includes(role)) redirect("/home");

  const canReadAudit = role === "owner" || role === "admin";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Signed in as {session.user.email} · role: {role}
      </p>
      <StaffUsersTab currentRole={role} />
      {canReadAudit ? <StaffAuditTab /> : null}
    </div>
  );
}
```

(Adjust the redirect target/class names to match the app's conventions — mirror an existing page under `apps/web/src/app/(app)/`.)

- [ ] **Step 4: Create the Users tab**

```tsx
// apps/web/src/components/staff/staff-users-tab.tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

const ASSIGNABLE = ["user", "support", "moderator", "admin", "owner"] as const;

export function StaffUsersTab({ currentRole }: { currentRole: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const users = useQuery({
    queryKey: ["staff", "users", q],
    queryFn: async () => {
      const res = await api.api.staff.users.get({ query: { q } });
      if (res.error) throw new Error(String(res.error.value));
      return res.data.users;
    },
  });

  const ban = useMutation({
    mutationFn: (id: string) =>
      api.api.staff.users({ id }).ban.post({ reason: "" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "users"] }),
  });
  const unban = useMutation({
    mutationFn: (id: string) => api.api.staff.users({ id }).unban.post(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "users"] }),
  });
  const setRole = useMutation({
    mutationFn: (vars: { id: string; role: (typeof ASSIGNABLE)[number] }) =>
      api.api.staff.users({ id: vars.id }).role.post({ role: vars.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "users"] }),
  });

  const canSetRole = currentRole === "owner";
  const canBan = currentRole === "owner" || currentRole === "admin";

  return (
    <section className="mb-10">
      <input
        className="border-border mb-4 w-full max-w-sm rounded-md border px-3 py-2 text-sm"
        placeholder="Search name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="divide-border divide-y">
        {users.data?.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="flex-1">
              {u.name} · {u.email} · <b>{u.role}</b>
              {u.banned ? " · BANNED" : ""}
            </span>
            {canBan &&
              (u.banned ? (
                <button onClick={() => unban.mutate(u.id)}>Unban</button>
              ) : (
                <button onClick={() => ban.mutate(u.id)}>Ban</button>
              ))}
            {canSetRole && (
              <select
                value={u.role ?? "user"}
                onChange={(e) =>
                  setRole.mutate({
                    id: u.id,
                    role: e.target.value as (typeof ASSIGNABLE)[number],
                  })
                }
              >
                {ASSIGNABLE.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Note: the exact Eden call shape (`api.api.staff.users.get(...)`) must match the generated `@still/api-client` tree. Verify against an existing usage (e.g. how `apps/web` calls another `/api/...` route) and adjust the accessor chain/casing accordingly. Style with the app's existing UI primitives (buttons/select) rather than raw elements where available.

- [ ] **Step 5: Create the Audit tab**

```tsx
// apps/web/src/components/staff/staff-audit-tab.tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function StaffAuditTab() {
  const audit = useQuery({
    queryKey: ["staff", "audit"],
    queryFn: async () => {
      const res = await api.api.staff.audit.get({ query: {} });
      if (res.error) throw new Error(String(res.error.value));
      return res.data.entries;
    },
  });

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Audit log</h2>
      <ul className="divide-border divide-y text-sm">
        {audit.data?.map((e) => (
          <li key={e.id} className="py-2">
            <code>{e.action}</code> · {e.targetType}/{e.targetId}
            {e.reason ? ` · ${e.reason}` : ""} ·{" "}
            {new Date(e.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Typecheck the web app**

Run from repo root (per project memory, the in-app `tsc` is a decoy):
`./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: no NEW errors beyond the known baseline. Fix any introduced by the new files (most likely Eden accessor shapes).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/auth-client.ts apps/web/src/lib/auth-server.ts apps/web/src/app/\(app\)/staff apps/web/src/components/staff
git commit -m "feat(web): add staff panel with users and audit tabs"
```

---

## Task 11: Web — inline content moderation menu + staff nav link

**Files:**
- Create: `apps/web/src/components/staff/staff-content-actions.tsx`
- Modify: a content card/menu component (e.g. review/list/post) to render `<StaffContentActions>`
- Modify: account menu to show a `/staff` link for staff

- [ ] **Step 1: Create the moderation action menu**

```tsx
// apps/web/src/components/staff/staff-content-actions.tsx
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

type ContentType = "review" | "list" | "post" | "log";

export function StaffContentActions({
  type,
  id,
  role,
  isRemoved,
}: {
  type: ContentType;
  id: string;
  role: string;
  isRemoved?: boolean;
}) {
  const qc = useQueryClient();
  const canHide = ["owner", "admin", "moderator", "support"].includes(role);
  const canDelete = ["owner", "admin", "moderator"].includes(role);
  if (!canHide) return null;

  const act = useMutation({
    mutationFn: (op: "hide" | "delete" | "restore") =>
      api.api.staff.content({ type })({ id })({ op }).post({ reason: "" }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="text-muted-foreground flex gap-2 text-xs">
      {isRemoved ? (
        canDelete && <button onClick={() => act.mutate("restore")}>Restore</button>
      ) : (
        <>
          <button onClick={() => act.mutate("hide")}>Hide</button>
          {canDelete && <button onClick={() => act.mutate("delete")}>Delete</button>}
        </>
      )}
    </div>
  );
}
```

Verify the Eden path-param call shape `api.api.staff.content({type})({id})({op}).post(...)` against `@still/api-client`; adjust to the actual generated accessor for nested path params.

- [ ] **Step 2: Render it on one content surface**

Pick a review or post card component already rendered in feeds/detail (e.g. under `apps/web/src/components/review/` or `.../home/`). Pass the viewer role (from the session/context the app already exposes to client components) and the content's id/type. Render `<StaffContentActions ... />` in the card's action row, behind the role check (the component self-hides for non-staff).

- [ ] **Step 3: Add the `/staff` nav link for staff**

In the account menu component (search: `rg -l "account-menu" apps/web/src/components/app`), add a link to `/staff` shown only when the session role is in `["owner","admin","moderator","support"]`.

- [ ] **Step 4: Manual verification**

Run the web app (`bun run dev` or the project's run command). As a seeded owner (Task 9):
- `/staff` loads; non-staff users are redirected.
- Search users; change a role (owner only); ban/unban.
- On a content card, Hide a post → it disappears from public lists; Restore brings it back.
- Audit tab shows the actions.

- [ ] **Step 5: Typecheck + commit**

Run from repo root: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: no new errors.

```bash
git add apps/web/src/components/staff apps/web/src/components
git commit -m "feat(web): inline staff moderation actions and staff nav link"
```

---

## Task 12: Full verification pass

- [ ] **Step 1: Run the server test suite**

Run: `cd apps/server && bun test`
Expected: PASS (new staff/rank/permission tests included; no regressions).

- [ ] **Step 2: Run the auth package tests**

Run: `cd packages/auth && bun test`
Expected: PASS (permission matrix).

- [ ] **Step 3: Typecheck server + web + auth**

Run from repo root:
```
./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit
```
Expected: no new errors vs. baseline.

- [ ] **Step 4: Confirm migration is applied**

Run: `bun run db:migrate`
Expected: "No migrations to apply" (already applied in Task 3) — confirms journal is consistent.

- [ ] **Step 5: Final commit (if any fixups)**

```bash
git add -A
git commit -m "chore: staff roles & permissions verification fixups"
```

---

## Self-Review Notes (coverage map)

- Spec roles & matrix → Task 1 (+ test).
- Roles=bundles via admin plugin → Task 2.
- Data model (user fields, removed* columns, audit table) → Task 3.
- `requirePermission`/`requireStaff`/ban-block → Task 5.
- `outranks` rule → Task 4 (+ enforced in Task 8).
- Group A (user mgmt endpoints) → Task 8.
- Group B (content moderation endpoints + public filtering) → Tasks 6 & 8.
- Group E (audit log writer + read endpoint) → Tasks 7 & 8.
- Bootstrap owner → Task 9.
- Minimal web panel (users, audit, inline moderation, nav gate) → Tasks 10 & 11.
- Mobile out of scope → no task (intentional).
- Verification → Task 12.

**Known follow-ups (not in v1):** comment moderation via `deletedAt` parity in the generic endpoint; reports queue (C); editorial tooling (D); hard-delete.
