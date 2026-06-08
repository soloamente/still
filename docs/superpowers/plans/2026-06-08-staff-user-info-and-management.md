# Staff Panel — User Info & Advanced User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the staff Users tab with an expandable per-user detail row (profile,
activity stats, role-permission summary, notes) and ship four staff powers that were
missing or only declared: profile editing (`user:edit`), internal notes (`user:note`),
a Pro override toggle (`user:pro`), and a fully working impersonation flow
(`user:impersonate`, previously declared in the matrix but never implemented).

**Architecture:** Three new access-control statements (`edit`/`note`/`pro`) extend the
existing named-role-bundle model (Owner+Admin get all three; `impersonate` stays
Owner-only). A new append-only `staff_user_note` table mirrors `staff_audit_log`. New
Elysia endpoints under `/api/staff/users/:id/*` follow the existing
`requirePermission` → `outranks` → mutate → `writeAuditLog` → rate-limit pattern.
Impersonation wraps better-auth's native `impersonateUser`/`stopImpersonating`
(time-boxed via `impersonationSessionDuration`). On the web, the existing
`StaffUsersTab` row becomes expandable, mounting a new `StaffUserDetail` panel that
composes smaller gated sub-components (notes log, edit form, Pro toggle, impersonate
button); a persistent banner in `AppShell` shows when the session is impersonated.

**Tech Stack:** Bun, Elysia, Drizzle (Postgres/Neon), better-auth 1.6.9, Next.js 16,
Eden Treaty (`@/lib/api`), `bun:test`, Tailwind, `sonner` toasts. No TanStack Query on
web (local state + Eden + toasts, per existing convention). No shared `Dialog`/`Switch`
components exist — new UI uses inline expandable forms and the existing `Checkbox`.

---

## Task 1: `staff_user_note` table + migration

**Files:**
- Modify: `packages/db/src/schema/staff.ts`
- Create: `packages/db/src/migrations/0025_staff_user_notes.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Add the `staffUserNote` table to the schema**

Append to `packages/db/src/schema/staff.ts` (after `staffAuditLogRelations`):

```ts
export const staffUserNote = pgTable(
	"staff_user_note",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		authorId: text("author_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("staff_user_note_user_idx").on(table.userId),
		index("staff_user_note_created_idx").on(table.createdAt),
	],
);

export const staffUserNoteRelations = relations(staffUserNote, ({ one }) => ({
	user: one(user, {
		fields: [staffUserNote.userId],
		references: [user.id],
		relationName: "staffUserNoteUser",
	}),
	author: one(user, {
		fields: [staffUserNote.authorId],
		references: [user.id],
		relationName: "staffUserNoteAuthor",
	}),
}));
```

This mirrors `staffAuditLog` exactly (text PK, two FKs to `user` with cascade, two
indexes) — append-only by convention (no update/delete routes will exist). The
`relationName`s disambiguate the two FKs to `user`, following the `followRelations`
pattern in `packages/db/src/schema/profile.ts:196-207`.

- [ ] **Step 2: Write the hand-written migration SQL**

`drizzle-kit generate` is currently broken (missing snapshots after migration 0003 —
known issue), so migrations 0004+ are hand-written. Create
`packages/db/src/migrations/0025_staff_user_notes.sql`:

```sql
CREATE TABLE IF NOT EXISTS "staff_user_note" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_user_note_user_idx" ON "staff_user_note" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_user_note_created_idx" ON "staff_user_note" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_user_note" ADD CONSTRAINT "staff_user_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_user_note" ADD CONSTRAINT "staff_user_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
```

This mirrors the structure of `packages/db/src/migrations/0024_staff_admin_moderation.sql`
(`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN
duplicate_object THEN null; END $$;` guards for idempotent FK creation).

- [ ] **Step 3: Add the journal entry**

Open `packages/db/src/migrations/meta/_journal.json`. Find the entry with
`"idx": 24, "tag": "0024_staff_admin_moderation"` (the last entry in the array, just
before the closing `]`). Add a new entry immediately after it (don't forget the comma
after the `0024` entry's closing `}`):

```json
		{
			"idx": 25,
			"version": "7",
			"when": 1779202100000,
			"tag": "0025_staff_user_notes",
			"breakpoints": true
		}
```

- [ ] **Step 4: Verify the schema compiles**

Run: `cd packages/db && bun run check-types 2>/dev/null || ../../node_modules/.bin/tsc --noEmit -p .`

If neither script exists, run from repo root: `./node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit`

Expected: no new type errors (the table + relations follow the exact shape of
`staffAuditLog`/`staffAuditLogRelations`, which already typecheck).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/staff.ts packages/db/src/migrations/0025_staff_user_notes.sql packages/db/src/migrations/meta/_journal.json
git commit -m "$(cat <<'EOF'
feat(db): add staff_user_note table for append-only staff notes on users

Mirrors staff_audit_log's accountability model — no update/delete routes
will ever target this table.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Access-control statements & role bundles (`edit`/`note`/`pro`)

**Files:**
- Modify: `packages/auth/src/permissions.ts`
- Modify: `packages/auth/src/permissions.test.ts`
- Test: `packages/auth/src/permissions.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/auth/src/permissions.test.ts`, replace the `"owner can do everything..."`
test (lines 28-33) and the `"admin can ban..."` test (lines 35-42) with versions that
also assert the new verbs:

```ts
	it("owner can do everything including set-role, impersonate, edit, note, pro", () => {
		expect(roles.owner.authorize({ user: ["set-role"] }).success).toBe(true);
		expect(roles.owner.authorize({ user: ["ban"] }).success).toBe(true);
		expect(roles.owner.authorize({ user: ["impersonate"] }).success).toBe(true);
		expect(roles.owner.authorize({ user: ["edit"] }).success).toBe(true);
		expect(roles.owner.authorize({ user: ["note"] }).success).toBe(true);
		expect(roles.owner.authorize({ user: ["pro"] }).success).toBe(true);
		expect(roles.owner.authorize({ content: ["delete"] }).success).toBe(true);
		expect(roles.owner.authorize({ audit: ["read"] }).success).toBe(true);
	});

	it("admin can edit/note/pro but not set-role or impersonate", () => {
		expect(roles.admin.authorize({ user: ["ban"] }).success).toBe(true);
		expect(roles.admin.authorize({ user: ["edit"] }).success).toBe(true);
		expect(roles.admin.authorize({ user: ["note"] }).success).toBe(true);
		expect(roles.admin.authorize({ user: ["pro"] }).success).toBe(true);
		expect(roles.admin.authorize({ audit: ["read"] }).success).toBe(true);
		expect(roles.admin.authorize({ user: ["set-role"] }).success).toBe(false);
		expect(roles.admin.authorize({ user: ["impersonate"] }).success).toBe(
			false,
		);
	});

	it("moderator and support lack edit/note/pro/impersonate", () => {
		for (const role of [roles.moderator, roles.support]) {
			expect(role.authorize({ user: ["edit"] } as never).success).toBe(false);
			expect(role.authorize({ user: ["note"] } as never).success).toBe(false);
			expect(role.authorize({ user: ["pro"] } as never).success).toBe(false);
			expect(
				role.authorize({ user: ["impersonate"] } as never).success,
			).toBe(false);
		}
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/auth && bun test src/permissions.test.ts`

Expected: FAIL — `roles.owner.authorize({ user: ["edit"] })` etc. fail because
`"edit"`/`"note"`/`"pro"` are not yet in `statement.user` (TypeScript will also
complain that `"edit"` is not assignable to the statement's action union — this is
expected and resolves once Step 3 lands).

- [ ] **Step 3: Extend the statements and role bundles**

In `packages/auth/src/permissions.ts`, change line 17 and the `owner`/`admin` role
definitions (lines 15-34):

```ts
export const statement = {
	...defaultStatements,
	user: [
		"list",
		"ban",
		"unban",
		"set-role",
		"impersonate",
		"edit",
		"note",
		"pro",
	],
	content: ["hide", "delete", "restore"],
	audit: ["read"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
	user: [
		"list",
		"ban",
		"unban",
		"set-role",
		"impersonate",
		"edit",
		"note",
		"pro",
	],
	content: ["hide", "delete", "restore"],
	audit: ["read"],
});

export const admin = ac.newRole({
	user: ["list", "ban", "unban", "edit", "note", "pro"],
	content: ["hide", "delete", "restore"],
	audit: ["read"],
});
```

`moderator`, `support`, and `user` are unchanged — they were never granted any of the
new verbs, matching the matrix (Moderator/Support: ❌ for `edit`/`note`/`pro`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/auth && bun test src/permissions.test.ts`

Expected: PASS — all assertions including the new `edit`/`note`/`pro`/`impersonate`
checks succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/permissions.ts packages/auth/src/permissions.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): add user:edit/note/pro permissions to Owner+Admin bundles

Per the staff user-management spec matrix — impersonate stays Owner-only,
moderator/support are unaffected.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `permissionSummary` helper (read-only "this role can…" list)

**Files:**
- Create: `packages/auth/src/permission-summary.ts`
- Test: `packages/auth/src/permission-summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/auth/src/permission-summary.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { permissionSummary } from "./permission-summary";

describe("permissionSummary", () => {
	it("owner gets the full list including impersonate and pro", () => {
		const labels = permissionSummary("owner").map((e) => e.label);
		expect(labels).toContain("Impersonate a user's account");
		expect(labels).toContain("Grant or revoke complimentary Pro");
		expect(labels).toContain("Read the staff audit log");
	});

	it("admin gets edit/note/pro but not impersonate or set-role", () => {
		const actions = permissionSummary("admin").map(
			(e) => `${e.resource}:${e.action}`,
		);
		expect(actions).toContain("user:edit");
		expect(actions).toContain("user:note");
		expect(actions).toContain("user:pro");
		expect(actions).not.toContain("user:impersonate");
		expect(actions).not.toContain("user:set-role");
	});

	it("moderator gets only list + content moderation, in stable order", () => {
		const actions = permissionSummary("moderator").map(
			(e) => `${e.resource}:${e.action}`,
		);
		expect(actions).toEqual([
			"user:list",
			"content:hide",
			"content:delete",
			"content:restore",
		]);
	});

	it("support gets list + hide only", () => {
		const actions = permissionSummary("support").map(
			(e) => `${e.resource}:${e.action}`,
		);
		expect(actions).toEqual(["user:list", "content:hide"]);
	});

	it("a plain user gets nothing", () => {
		expect(permissionSummary("user")).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/auth && bun test src/permission-summary.test.ts`

Expected: FAIL with "Cannot find module './permission-summary'" (file doesn't exist
yet).

- [ ] **Step 3: Write the helper**

Create `packages/auth/src/permission-summary.ts`:

```ts
import { type AppRole, roles } from "./permissions";

export type PermissionSummaryEntry = {
	resource: string;
	action: string;
	label: string;
};

/**
 * Human-readable label per `resource:action`. Covers every action granted to
 * any staff role — the Owner bundle is the superset, so this map is exhaustive
 * for display purposes. Object key order defines display order (user, content,
 * audit) so the list renders in a stable, predictable sequence.
 */
const ACTION_LABELS: Record<string, Record<string, string>> = {
	user: {
		list: "View the user list",
		ban: "Ban users",
		unban: "Unban users",
		"set-role": "Change a user's staff role",
		impersonate: "Impersonate a user's account",
		edit: "Edit a user's profile",
		note: "Leave internal notes on a user",
		pro: "Grant or revoke complimentary Pro",
	},
	content: {
		hide: "Hide content",
		delete: "Delete content",
		restore: "Restore removed content",
	},
	audit: {
		read: "Read the staff audit log",
	},
};

/**
 * Flat, human-readable list of what a role can actually do — derived purely
 * from the role's granted statements (`roles[role].statements`, no extra DB
 * access). Consumed by `GET /api/staff/users/:id` and rendered as "This role
 * can…" in the user-detail view. Pure + read-only by design (no per-user
 * à la carte overrides — see the spec's "Out of Scope").
 */
export function permissionSummary(role: AppRole): PermissionSummaryEntry[] {
	const granted = roles[role].statements as Record<string, readonly string[]>;
	const entries: PermissionSummaryEntry[] = [];
	for (const [resource, actionLabels] of Object.entries(ACTION_LABELS)) {
		const allowed = granted[resource] ?? [];
		for (const [action, label] of Object.entries(actionLabels)) {
			if (allowed.includes(action)) entries.push({ resource, action, label });
		}
	}
	return entries;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/auth && bun test src/permission-summary.test.ts`

Expected: PASS — all five cases succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/permission-summary.ts packages/auth/src/permission-summary.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): add permissionSummary helper for read-only role-capability display

Derives a flat, human-readable "this role can…" list from the registered
access-control statements — no extra DB access, no per-user overrides.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Time-boxed impersonation session config

**Files:**
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Add `impersonationSessionDuration` to the admin plugin config**

In `packages/auth/src/index.ts`, find the `adminPlugin({...})` call (around line
77-83):

```ts
			adminPlugin({
				ac,
				roles,
				defaultRole: "user",
				// Users holding these roles may call the admin API endpoints.
				adminRoles: ["owner", "admin"],
			}),
```

Add `impersonationSessionDuration: 3600` (better-auth's native time-limited
impersonation — 1 hour, satisfies the "sessione a tempo limitato" requirement with
zero custom code; this is also better-auth's documented default, so the line is
primarily there to make the choice explicit and reviewable):

```ts
			adminPlugin({
				ac,
				roles,
				defaultRole: "user",
				// Users holding these roles may call the admin API endpoints.
				adminRoles: ["owner", "admin"],
				// Impersonated sessions auto-expire after 1 hour — better-auth's
				// native time-boxed impersonation (no custom session code needed).
				impersonationSessionDuration: 3600,
			}),
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd packages/auth && ../../node_modules/.bin/tsc --noEmit -p .`

If that script path doesn't resolve, run from repo root:
`./node_modules/.bin/tsc -p packages/auth/tsconfig.json --noEmit`

Expected: no new errors — `impersonationSessionDuration?: number` is part of
better-auth 1.6.9's admin plugin `Options` type (`types.d.mts:49`).

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "$(cat <<'EOF'
feat(auth): cap impersonation sessions at 1 hour

Uses better-auth's native impersonationSessionDuration — no custom
session-expiry code needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Export `HANDLE_RE` from the profiles route

**Files:**
- Modify: `apps/server/src/routes/profiles.ts:108`

- [ ] **Step 1: Add the `export` keyword**

The new `POST /api/staff/users/:id/edit` endpoint (Task 8) needs the same handle-format
validation the self-serve profile editor uses. In `apps/server/src/routes/profiles.ts`,
change line 108 from:

```ts
const HANDLE_RE = /^[a-z0-9._-]{2,24}$/;
```

to:

```ts
export const HANDLE_RE = /^[a-z0-9._-]{2,24}$/;
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd apps/server && bun run check-types`

Expected: no new errors — adding `export` to an existing top-level `const` is a
non-breaking, additive change.

- [ ] **Step 3: Commit**

```
git add apps/server/src/routes/profiles.ts
git commit -m "refactor(server): export HANDLE_RE so the staff edit endpoint can reuse it

Avoids duplicating the handle-format regex between the self-serve profile
editor and the new staff profile-edit endpoint.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: `staff-user-notes` lib helper (list + add)

**Files:**
- Create: `apps/server/src/lib/staff-user-notes.ts`
- Test: `apps/server/src/lib/staff-user-notes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/staff-user-notes.test.ts`:

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";

type NoteRow = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: Date;
};

const state: { rows: NoteRow[]; inserted: Array<Record<string, unknown>> } = {
	rows: [],
	inserted: [],
};

const staffUserNoteTable = {
	__table: "staff_user_note",
	userId: { __column: "staff_user_note.userId" },
	createdAt: { __column: "staff_user_note.createdAt" },
};

mock.module("@still/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: async () => state.rows,
				}),
			}),
		}),
		insert: () => ({
			values: async (values: Record<string, unknown>) => {
				state.inserted.push(values);
				return [];
			},
		}),
	},
	staffUserNote: staffUserNoteTable,
}));

const { addStaffUserNote, listStaffUserNotes } = await import(
	"./staff-user-notes"
);

beforeEach(() => {
	state.rows = [];
	state.inserted = [];
});

describe("listStaffUserNotes", () => {
	test("returns the rows from the db query as-is", async () => {
		state.rows = [
			{
				id: "note_1",
				userId: "u-1",
				authorId: "staff-1",
				body: "Heads up about this account",
				createdAt: new Date("2026-01-01T00:00:00Z"),
			},
		];
		const rows = await listStaffUserNotes("u-1");
		expect(rows).toEqual(state.rows);
	});
});

describe("addStaffUserNote", () => {
	test("inserts a row with a generated id and returns it", async () => {
		const note = await addStaffUserNote({
			userId: "u-1",
			authorId: "staff-1",
			body: "Contacted about a billing issue",
		});
		expect(note.id).toMatch(/^note_/);
		expect(note.userId).toBe("u-1");
		expect(note.authorId).toBe("staff-1");
		expect(note.body).toBe("Contacted about a billing issue");
		expect(note.createdAt).toBeInstanceOf(Date);

		expect(state.inserted).toHaveLength(1);
		expect(state.inserted[0]).toMatchObject({
			id: note.id,
			userId: "u-1",
			authorId: "staff-1",
			body: "Contacted about a billing issue",
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/server && bun test src/lib/staff-user-notes.test.ts`

Expected: FAIL with "Cannot find module './staff-user-notes'".

- [ ] **Step 3: Write the helper**

Create `apps/server/src/lib/staff-user-notes.ts`:

```ts
import { db, staffUserNote } from "@still/db";
import { desc, eq } from "drizzle-orm";

import { makeId } from "./cuid";

export type StaffUserNote = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: Date;
};

/**
 * Newest-first chronological log for a user — append-only, mirrors
 * `writeAuditLog`'s accountability model. No update/delete counterparts exist.
 */
export async function listStaffUserNotes(
	userId: string,
): Promise<StaffUserNote[]> {
	return db
		.select()
		.from(staffUserNote)
		.where(eq(staffUserNote.userId, userId))
		.orderBy(desc(staffUserNote.createdAt));
}

export async function addStaffUserNote(entry: {
	userId: string;
	authorId: string;
	body: string;
}): Promise<StaffUserNote> {
	const id = makeId("note");
	const createdAt = new Date();
	await db.insert(staffUserNote).values({
		id,
		userId: entry.userId,
		authorId: entry.authorId,
		body: entry.body,
	});
	return {
		id,
		userId: entry.userId,
		authorId: entry.authorId,
		body: entry.body,
		createdAt,
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/server && bun test src/lib/staff-user-notes.test.ts`

Expected: PASS — both `listStaffUserNotes` and `addStaffUserNote` cases succeed.

- [ ] **Step 5: Commit**

```
git add apps/server/src/lib/staff-user-notes.ts apps/server/src/lib/staff-user-notes.test.ts
git commit -m "feat(server): add staff-user-notes lib helper (list + append-only add)

Mirrors writeAuditLog's pattern — makeId(\"note\") prefixed ids, newest-first
ordering, no update/delete paths.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Extend `staff.test.ts` mock infrastructure for profile/notes/impersonation

**Files:**
- Modify: `apps/server/src/routes/staff.test.ts`

This task only extends the test doubles (table sentinels, mutable state, permission
matrix, auth mocks) so Tasks 8-11 can write endpoint tests against them. No new
`describe` blocks here — just infrastructure, verified by re-running the existing
suite (it must stay green).

- [ ] **Step 1: Add new columns to `makeTable` and two new table sentinels**

In `apps/server/src/routes/staff.test.ts`, extend the object returned by `makeTable`
(lines 38-52) with the columns the new `profile` and `staff_user_note` mocks need:

```ts
function makeTable(name: string) {
	return {
		__table: name,
		id: { __column: `${name}.id` },
		userId: { __column: `${name}.userId` },
		authorId: { __column: `${name}.authorId` },
		name: { __column: `${name}.name` },
		email: { __column: `${name}.email` },
		emailVerified: { __column: `${name}.emailVerified` },
		image: { __column: `${name}.image` },
		role: { __column: `${name}.role` },
		banned: { __column: `${name}.banned` },
		banExpires: { __column: `${name}.banExpires` },
		createdAt: { __column: `${name}.createdAt` },
		removedAt: { __column: `${name}.removedAt` },
		removedBy: { __column: `${name}.removedBy` },
		removalReason: { __column: `${name}.removalReason` },
		actorId: { __column: `${name}.actorId` },
		handle: { __column: `${name}.handle` },
		displayName: { __column: `${name}.displayName` },
		bio: { __column: `${name}.bio` },
		pronouns: { __column: `${name}.pronouns` },
		location: { __column: `${name}.location` },
		website: { __column: `${name}.website` },
		bannerUrl: { __column: `${name}.bannerUrl` },
		accentColor: { __column: `${name}.accentColor` },
		isPro: { __column: `${name}.isPro` },
		isPrivate: { __column: `${name}.isPrivate` },
		statsCache: { __column: `${name}.statsCache` },
		body: { __column: `${name}.body` },
	};
}
```

Then add two new sentinels right after the existing ones (after line 61's
`const notificationTable = makeTable("notification");`):

```ts
const profileTable = makeTable("profile");
const staffUserNoteTable = makeTable("staff_user_note");
```

- [ ] **Step 2: Extend `TestState` and the mutable `state` object**

Add `profiles` and `notes` to the `TestState` type (after the `users` field, around
line 10):

```ts
	// Map of userId -> profile row, used by GET/POST /users/:id and /edit /pro.
	profiles: Record<
		string,
		{
			userId: string;
			handle: string;
			displayName: string;
			isPro: boolean;
			isPrivate: boolean;
			statsCache: Record<string, number>;
		}
	>;
	// Notes recorded via POST /users/:id/notes, keyed implicitly by userId.
	notes: Array<{
		id: string;
		userId: string;
		authorId: string;
		body: string;
		createdAt: Date;
	}>;
```

And initialize both in the `state` object literal (around line 26-33):

```ts
const state: TestState = {
	users: {},
	profiles: {},
	notes: [],
	content: {},
	updates: [],
	inserts: [],
	audits: [],
	authCalls: [],
};
```

- [ ] **Step 3: Teach `createSelectQuery` to resolve `profile` and `staff_user_note`**

In `resolve()` (inside `createSelectQuery`, around line 117-140), add two branches
before the final `return [];`:

```ts
		if (fromTable === "profile") {
			const id = findEqValue(whereCondition);
			const p = id ? state.profiles[id] : undefined;
			return p ? [p] : [];
		}
		if (fromTable === "staff_user_note") {
			const id = findEqValue(whereCondition);
			return state.notes.filter((n) => n.userId === id);
		}
```

- [ ] **Step 4: Teach `createUpdateQuery.returning` about `profile` (and `user`)**

Replace the `returning` method (lines 157-161) with a version that checks existence
against `state.profiles`/`state.users` for those tables, falling back to the existing
`state.content` lookup for the four moderated content tables:

```ts
			async returning() {
				const id = builder._id;
				state.updates.push({ table: tableName, set: setValues, id: id ?? "" });
				if (tableName === "profile") {
					return id != null && state.profiles[id] ? [{ id }] : [];
				}
				if (tableName === "user") {
					return id != null && state.users[id] ? [{ id }] : [];
				}
				const exists = id != null && state.content[tableName]?.has(id);
				return exists ? [{ id }] : [];
			},
```

- [ ] **Step 5: Register the new tables in the `@still/db` mock**

Extend the `mock.module("@still/db", ...)` export object (lines 184-193):

```ts
mock.module("@still/db", () => ({
	db,
	user: userTable,
	profile: profileTable,
	staffUserNote: staffUserNoteTable,
	review: reviewTable,
	log: logTable,
	list: listTable,
	post: postTable,
	staffAuditLog: staffAuditLogTable,
	notification: notificationTable,
}));
```

- [ ] **Step 6: Add `edit`/`note`/`pro` to the `MATRIX` permission simulation**

Replace the `owner` and `admin` entries in `MATRIX` (lines 200-209):

```ts
const MATRIX: Record<string, Record<string, string[]>> = {
	owner: {
		user: [
			"list",
			"ban",
			"unban",
			"set-role",
			"impersonate",
			"edit",
			"note",
			"pro",
		],
		content: ["hide", "delete", "restore"],
		audit: ["read"],
	},
	admin: {
		user: ["list", "ban", "unban", "edit", "note", "pro"],
		content: ["hide", "delete", "restore"],
		audit: ["read"],
	},
	moderator: {
		user: ["list"],
		content: ["hide", "delete", "restore"],
	},
	support: {
		user: ["list"],
		content: ["hide"],
	},
};
```

- [ ] **Step 7: Mock `impersonateUser` and `stopImpersonating`**

Extend the `auth.api` object inside `mock.module("@still/auth", ...)` (after the
`setRole` entry, around line 263):

```ts
				setRole: async ({ body }: { body: unknown }) => {
					state.authCalls.push({ method: "setRole", body });
					return { user: {} };
				},
				impersonateUser: async ({ body }: { body: unknown }) => {
					state.authCalls.push({ method: "impersonateUser", body });
					return { session: { id: "imp-session" }, user: {} };
				},
				stopImpersonating: async () => {
					state.authCalls.push({ method: "stopImpersonating", body: null });
					return {};
				},
```

- [ ] **Step 8: Reset `profiles`/`notes` in `beforeEach`**

Extend the `beforeEach` reset block (lines 292-299):

```ts
beforeEach(() => {
	state.users = {};
	state.profiles = {};
	state.notes = [];
	state.content = {};
	state.updates = [];
	state.inserts = [];
	state.audits = [];
	state.authCalls = [];
});
```

- [ ] **Step 9: Run the full existing suite to verify nothing broke**

Run: `cd apps/server && bun test src/routes/staff.test.ts`

Expected: PASS — every existing test (GET /users, ban/unban/role, content moderation,
audit) still passes unchanged. This proves the infra extension is purely additive
before Tasks 8-11 build on it.

- [ ] **Step 10: Commit**

```
git add apps/server/src/routes/staff.test.ts
git commit -m "test(server): extend staff route test doubles for profile/notes/impersonation

Adds profile + staff_user_note table sentinels, matching mutable state,
edit/note/pro MATRIX entries, and impersonateUser/stopImpersonating auth
mocks — pure scaffolding for the endpoint tests in the following tasks.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: `GET /api/staff/users/:id` — full detail endpoint

**Files:**
- Modify: `apps/server/src/routes/staff.ts`
- Test: `apps/server/src/routes/staff.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `apps/server/src/routes/staff.test.ts` (after the
`"GET /api/staff/users"` block, around line 321):

```ts
describe("GET /api/staff/users/:id", () => {
	test("returns 401 when signed out", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1", { method: "GET" }),
		);
		expect(res.status).toBe(401);
	});

	test("moderator (has user:list) gets user + profile + permission summary", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "cinephile",
				displayName: "Cinephile",
				isPro: true,
				isPrivate: false,
				statsCache: { filmsLogged: 42, followers: 3 },
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1", {
				method: "GET",
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			user: { id: string };
			profile: { handle: string; isPro: boolean } | null;
			permissions: Array<{ resource: string; action: string }>;
		};
		expect(body.user.id).toBe("u-1");
		expect(body.profile?.handle).toBe("cinephile");
		expect(body.profile?.isPro).toBe(true);
		// Target role is "user" -> no staff permissions.
		expect(body.permissions).toEqual([]);
	});

	test("returns the target role's permission summary, not the viewer's", async () => {
		state.users = { "sup-9": { id: "sup-9", role: "support" } };
		state.profiles = {};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/sup-9", {
				method: "GET",
				headers: authHeaders("owner-1", "owner"),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			profile: unknown;
			permissions: Array<{ resource: string; action: string }>;
		};
		expect(body.profile).toBeNull();
		expect(
			body.permissions.map((p) => `${p.resource}:${p.action}`),
		).toEqual(["user:list", "content:hide"]);
	});

	test("unknown user -> 404", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/missing", {
				method: "GET",
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(404);
	});

	test("non-staff viewer lacks user:list -> 403", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1", {
				method: "GET",
				headers: authHeaders("plain-1", "user"),
			}),
		);
		expect(res.status).toBe(403);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "GET /api/staff/users/:id"`

Expected: FAIL — the route doesn't exist yet (404 instead of 401/200/403, and the
response body doesn't have `profile`/`permissions`).

- [ ] **Step 3: Implement the endpoint**

In `apps/server/src/routes/staff.ts`, update the imports at the top of the file:

```ts
import { auth } from "@still/auth";
import { permissionSummary } from "@still/auth/permission-summary";
import type { AppRole } from "@still/auth/permissions";
import {
	db,
	list,
	log,
	post,
	profile,
	review,
	staffAuditLog,
	user,
} from "@still/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context, requirePermission } from "../context";
import { hit } from "../lib/rate-limit";
import { notifyRoleChanged } from "../lib/role-change-notification";
import { type AuditTargetType, writeAuditLog } from "../lib/staff-audit";
import { outranks } from "../lib/staff-rank";
import { addStaffUserNote, listStaffUserNotes } from "../lib/staff-user-notes";
import { HANDLE_RE } from "./profiles";
```

Then add the new route. Insert it directly after the `.get("/users", ...)` handler
(after the closing `})` on line 59, before `.post("/users/:id/ban", ...)`):

```ts
	.get("/users/:id", async ({ user: viewer, params, status }) => {
		try {
			await requirePermission({ user: viewer }, { user: ["list"] });
		} catch (e) {
			return forbidden(status, e);
		}
		const [target] = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				role: user.role,
				banned: user.banned,
				banExpires: user.banExpires,
				emailVerified: user.emailVerified,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(eq(user.id, params.id));
		if (!target) return status(404, "User not found");

		const [targetProfile] = await db
			.select({
				userId: profile.userId,
				handle: profile.handle,
				displayName: profile.displayName,
				bio: profile.bio,
				pronouns: profile.pronouns,
				location: profile.location,
				website: profile.website,
				bannerUrl: profile.bannerUrl,
				accentColor: profile.accentColor,
				isPro: profile.isPro,
				isPrivate: profile.isPrivate,
				statsCache: profile.statsCache,
			})
			.from(profile)
			.where(eq(profile.userId, params.id));

		const role = (target.role ?? "user") as AppRole;
		return {
			user: target,
			profile: targetProfile ?? null,
			permissions: permissionSummary(role),
		};
	})
```

This follows the spec exactly: full profile fields, `statsCache`, and the **target's**
role permission list (not the viewer's) — derived purely from `permissionSummary`,
with no extra DB access. Perm-gated on `user:list` (the same baseline every staff
member already has, per the spec: "always visible to any staff member who can see the
row").

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "GET /api/staff/users/:id"`

Expected: PASS — all five cases succeed.

- [ ] **Step 5: Run the full staff suite to check for regressions**

Run: `cd apps/server && bun test src/routes/staff.test.ts`

Expected: PASS — all prior describe blocks plus the new one are green.

- [ ] **Step 6: Commit**

```
git add apps/server/src/routes/staff.ts apps/server/src/routes/staff.test.ts
git commit -m "feat(server): add GET /api/staff/users/:id full-detail endpoint

Returns profile fields, statsCache, and the target role's read-only
permission summary (permissionSummary) — gated on the existing user:list
permission so any staff member who can see the row can expand it.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: `POST /api/staff/users/:id/edit` — staff profile editing

**Files:**
- Modify: `apps/server/src/routes/staff.ts`
- Test: `apps/server/src/routes/staff.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block (after the new `"GET /api/staff/users/:id"` block):

```ts
describe("POST /api/staff/users/:id/edit", () => {
	test("admin edits a regular user's profile -> 200, updates profile, audits user.edit", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "old-handle",
				displayName: "Old Name",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({
					displayName: "New Name",
					handle: "new-handle",
					bio: "Loves cinema",
				}),
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		const upd = state.updates.find((u) => u.table === "profile");
		expect(upd).toBeDefined();
		expect(upd?.id).toBe("u-1");
		expect(upd?.set.displayName).toBe("New Name");
		expect(upd?.set.handle).toBe("new-handle");
		expect(upd?.set.bio).toBe("Loves cinema");

		const audit = state.audits.find((a) => a.action === "user.edit");
		expect(audit).toBeDefined();
		expect(audit?.targetId).toBe("u-1");
		expect(audit?.metadata).toEqual({
			changedFields: ["displayName", "handle", "bio"],
		});
	});

	test("invalid handle format -> 400, no update/audit", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "old-handle",
				displayName: "Old Name",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ handle: "Not Valid!" }),
			}),
		);
		expect(res.status).toBe(400);
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("admin editing an owner -> 403 from outranks, no update/audit", async () => {
		state.users = { "owner-1": { id: "owner-1", role: "owner" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/owner-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ displayName: "Hijacked" }),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("moderator lacks user:edit -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({ displayName: "Nope" }),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.updates).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "POST /api/staff/users/:id/edit"`

Expected: FAIL — route doesn't exist (404s instead of 200/400/403).

- [ ] **Step 3: Implement the endpoint**

Add this constant near the top of `apps/server/src/routes/staff.ts`, just below the
`CONTENT_TABLES`/`ContentType` declarations (after line 13):

```ts
const EDITABLE_PROFILE_FIELDS = [
	"displayName",
	"handle",
	"bio",
	"pronouns",
	"location",
	"website",
	"bannerUrl",
	"accentColor",
] as const;
type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];
```

Then add the route after the `.post("/users/:id/role", ...)` block (after its closing
`)` around line 179, before `.post("/content/:type/:id/:op", ...)`):

```ts
	.post(
		"/users/:id/edit",
		async ({ user: viewer, params, body, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["edit"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			if (
				!hit(`staff:edit:${viewer.id}`, { limit: 30, windowMs: 60_000 }).ok
			) {
				return status(429, "Slow down");
			}
			const [target] = await db
				.select({ id: user.id, role: user.role })
				.from(user)
				.where(eq(user.id, params.id));
			if (!target) return status(404, "User not found");
			if (!outranks(viewer.role, target.role)) {
				return status(
					403,
					"Cannot act on a peer or higher-ranked staff member",
				);
			}

			const setValues: Record<string, unknown> = {};
			const changedFields: EditableProfileField[] = [];
			for (const field of EDITABLE_PROFILE_FIELDS) {
				const value = body[field];
				if (value === undefined) continue;
				if (field === "handle") {
					const desired = value.toLowerCase();
					if (!HANDLE_RE.test(desired)) {
						return status(400, "Invalid handle format");
					}
					const [taken] = await db
						.select({ userId: profile.userId })
						.from(profile)
						.where(
							and(
								eq(profile.handle, desired),
								sql`${profile.userId} <> ${params.id}`,
							),
						);
					if (taken) return status(409, "Handle already taken");
					setValues.handle = desired;
				} else {
					setValues[field] = value;
				}
				changedFields.push(field);
			}
			if (changedFields.length === 0) {
				return status(400, "No fields to update");
			}
			setValues.updatedAt = new Date();

			const updated = await db
				.update(profile)
				.set(setValues)
				.where(eq(profile.userId, params.id))
				.returning({ userId: profile.userId });
			if (updated.length === 0) return status(404, "Profile not found");

			// Log which fields changed, not their before/after values — full
			// diffs would put PII (bios, locations, websites) in the audit log.
			await writeAuditLog({
				actorId: viewer.id,
				action: "user.edit",
				targetType: "user",
				targetId: params.id,
				metadata: { changedFields },
			});
			return { ok: true };
		},
		{
			body: t.Object({
				displayName: t.Optional(t.String({ maxLength: 80 })),
				handle: t.Optional(t.String({ maxLength: 24 })),
				bio: t.Optional(t.String({ maxLength: 500 })),
				pronouns: t.Optional(t.String({ maxLength: 40 })),
				location: t.Optional(t.String({ maxLength: 80 })),
				website: t.Optional(t.String({ maxLength: 200 })),
				bannerUrl: t.Optional(t.String({ maxLength: 1000 })),
				accentColor: t.Optional(t.String({ maxLength: 20 })),
			}),
		},
	)
```

This mirrors the spec: full editable profile fields, reuses `HANDLE_RE` + the
uniqueness-check pattern from `profiles.ts`, enforces `outranks`, rate-limits, and
audits `user.edit` with a `changedFields` list rather than full before/after diffs
(avoiding PII-heavy audit entries, per the spec).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "POST /api/staff/users/:id/edit"`

Expected: PASS — all four cases succeed.

- [ ] **Step 5: Run the full staff suite to check for regressions**

Run: `cd apps/server && bun test src/routes/staff.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```
git add apps/server/src/routes/staff.ts apps/server/src/routes/staff.test.ts
git commit -m "feat(server): add POST /api/staff/users/:id/edit profile-edit endpoint

Gated on user:edit + outranks; validates/uniqueness-checks handle changes
via the shared HANDLE_RE; audits user.edit with a changedFields list (not
full diffs, to keep PII out of the audit log).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: `POST /api/staff/users/:id/pro` — Pro override toggle

**Files:**
- Modify: `apps/server/src/routes/staff.ts`
- Test: `apps/server/src/routes/staff.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block (after the `"POST /api/staff/users/:id/edit"` block):

```ts
describe("POST /api/staff/users/:id/pro", () => {
	test("admin grants Pro -> 200, updates profile.isPro, audits user.pro.grant", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "h",
				displayName: "H",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/pro", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ isPro: true }),
			}),
		);
		expect(res.status).toBe(200);
		const upd = state.updates.find((u) => u.table === "profile");
		expect(upd?.set.isPro).toBe(true);
		expect(
			state.audits.find((a) => a.action === "user.pro.grant"),
		).toBeDefined();
	});

	test("admin revokes Pro -> 200, audits user.pro.revoke", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "h",
				displayName: "H",
				isPro: true,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/pro", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ isPro: false }),
			}),
		);
		expect(res.status).toBe(200);
		expect(
			state.audits.find((a) => a.action === "user.pro.revoke"),
		).toBeDefined();
	});

	test("admin acting on an owner -> 403 from outranks", async () => {
		state.users = { "owner-1": { id: "owner-1", role: "owner" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/owner-1/pro", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ isPro: true }),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("moderator lacks user:pro -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/pro", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({ isPro: true }),
			}),
		);
		expect(res.status).toBe(403);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "POST /api/staff/users/:id/pro"`

Expected: FAIL — route doesn't exist (404s).

- [ ] **Step 3: Implement the endpoint**

Add it directly after the new `/edit` route block:

```ts
	.post(
		"/users/:id/pro",
		async ({ user: viewer, params, body, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["pro"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			const [target] = await db
				.select({ id: user.id, role: user.role })
				.from(user)
				.where(eq(user.id, params.id));
			if (!target) return status(404, "User not found");
			if (!outranks(viewer.role, target.role)) {
				return status(
					403,
					"Cannot act on a peer or higher-ranked staff member",
				);
			}
			const updated = await db
				.update(profile)
				.set({ isPro: body.isPro, updatedAt: new Date() })
				.where(eq(profile.userId, params.id))
				.returning({ userId: profile.userId });
			if (updated.length === 0) return status(404, "Profile not found");

			await writeAuditLog({
				actorId: viewer.id,
				action: body.isPro ? "user.pro.grant" : "user.pro.revoke",
				targetType: "user",
				targetId: params.id,
			});
			return { ok: true };
		},
		{ body: t.Object({ isPro: t.Boolean() }) },
	)
```

This is a manual override of `profile.isPro` (per the spec — no subscription-sync code
currently writes that column, so this is safe today and documented as an "override").

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "POST /api/staff/users/:id/pro"`

Expected: PASS — all four cases succeed.

- [ ] **Step 5: Run the full staff suite to check for regressions**

Run: `cd apps/server && bun test src/routes/staff.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```
git add apps/server/src/routes/staff.ts apps/server/src/routes/staff.test.ts
git commit -m "feat(server): add POST /api/staff/users/:id/pro override-toggle endpoint

Manual override of profile.isPro (no subscription-sync writes there
today); gated on user:pro + outranks; audits user.pro.grant/revoke.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Notes endpoints + impersonation endpoints

**Files:**
- Modify: `apps/server/src/routes/staff.ts`
- Test: `apps/server/src/routes/staff.test.ts`

- [ ] **Step 1: Write the failing tests for notes endpoints**

Add a new `describe` block:

```ts
describe("staff user notes endpoints", () => {
	test("GET /users/:id/notes -> 200 with notes for staff with user:note", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.notes = [
			{
				id: "note-1",
				userId: "u-1",
				authorId: "mod-1",
				body: "Heads up",
				createdAt: new Date("2026-01-01T00:00:00Z"),
			},
		];
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { notes: Array<{ id: string }> };
		expect(data.notes).toHaveLength(1);
		expect(data.notes[0]?.id).toBe("note-1");
	});

	test("POST /users/:id/notes -> 201, persists note, audits user.note.add", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({ body: "Watch this account" }),
			}),
		);
		expect(res.status).toBe(201);
		expect(state.notes).toHaveLength(1);
		expect(state.notes[0]?.body).toBe("Watch this account");
		expect(state.notes[0]?.authorId).toBe("mod-1");
		expect(
			state.audits.find((a) => a.action === "user.note.add"),
		).toBeDefined();
	});

	test("POST /users/:id/notes rejects an empty body -> 422", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({ body: "" }),
			}),
		);
		expect(res.status).toBe(422);
		expect(state.notes).toHaveLength(0);
	});

	test("support lacks user:note -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				headers: authHeaders("support-1", "support"),
			}),
		);
		expect(res.status).toBe(403);
	});
});
```

- [ ] **Step 2: Write the failing tests for impersonation endpoints**

Add a second new `describe` block:

```ts
describe("staff impersonation endpoints", () => {
	test("POST /users/:id/impersonate -> 200, calls auth.api.impersonateUser, audits user.impersonate.start", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/impersonate", {
				method: "POST",
				headers: authHeaders("owner-1", "owner"),
			}),
		);
		expect(res.status).toBe(200);
		expect(state.impersonateCalls).toEqual([{ userId: "u-1" }]);
		expect(
			state.audits.find((a) => a.action === "user.impersonate.start"),
		).toBeDefined();
	});

	test("POST /users/:id/impersonate -> owner can impersonate another owner (no outranks gate)", async () => {
		state.users = { "owner-2": { id: "owner-2", role: "owner" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/owner-2/impersonate", {
				method: "POST",
				headers: authHeaders("owner-1", "owner"),
			}),
		);
		expect(res.status).toBe(200);
		expect(state.impersonateCalls).toEqual([{ userId: "owner-2" }]);
	});

	test("admin lacks user:impersonate -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/impersonate", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.impersonateCalls).toHaveLength(0);
	});

	test("POST /stop-impersonating -> 200, calls auth.api.stopImpersonating, audits user.impersonate.stop attributed to the real actor", async () => {
		state.session = {
			user: { id: "u-1", role: "user" },
			session: { id: "sess-1", impersonatedBy: "owner-1" },
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/stop-impersonating", {
				method: "POST",
				headers: authHeaders("u-1", "user"),
			}),
		);
		expect(res.status).toBe(200);
		expect(state.stopImpersonatingCalls).toBe(1);
		const entry = state.audits.find(
			(a) => a.action === "user.impersonate.stop",
		);
		expect(entry?.actorId).toBe("owner-1");
		expect(entry?.targetId).toBe("u-1");
	});

	test("POST /stop-impersonating when not impersonating -> 400", async () => {
		state.session = {
			user: { id: "u-1", role: "user" },
			session: { id: "sess-1", impersonatedBy: null },
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/stop-impersonating", {
				method: "POST",
				headers: authHeaders("u-1", "user"),
			}),
		);
		expect(res.status).toBe(400);
		expect(state.stopImpersonatingCalls).toBe(0);
	});
});
```

> **Note:** these tests assume Task 7 extended the mock infra with `state.impersonateCalls`,
> `state.stopImpersonatingCalls`, and a `state.session` override consumed by the
> mocked `context` (so `authHeaders` users can be made to "carry" an `impersonatedBy`
> field). If your `context` mock derives the session strictly from `authHeaders`,
> adjust the mock's session resolution to check `state.session` first when set —
> this is the pattern already used for `state.users` overrides elsewhere in the file.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "staff user notes endpoints"`
Run: `cd apps/server && bun test src/routes/staff.test.ts -t "staff impersonation endpoints"`

Expected: FAIL — routes don't exist (404s/undefined mocks).

- [ ] **Step 4: Implement the notes endpoints**

Add directly after the `/pro` route block:

```ts
	.get(
		"/users/:id/notes",
		async ({ user: viewer, params, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["note"] });
			} catch (e) {
				return forbidden(status, e);
			}
			const notes = await listStaffUserNotes(params.id);
			return { notes };
		},
	)
	.post(
		"/users/:id/notes",
		async ({ user: viewer, params, body, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["note"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			const note = await addStaffUserNote({
				userId: params.id,
				authorId: viewer.id,
				body: body.body,
			});
			await writeAuditLog({
				actorId: viewer.id,
				action: "user.note.add",
				targetType: "user",
				targetId: params.id,
			});
			return status(201, { note });
		},
		{ body: t.Object({ body: t.String({ minLength: 1, maxLength: 2000 }) }) },
	)
```

- [ ] **Step 5: Implement the impersonation endpoints**

Add directly after the notes routes:

```ts
	.post(
		"/users/:id/impersonate",
		async ({ user: viewer, params, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["impersonate"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			const [target] = await db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.id, params.id));
			if (!target) return status(404, "User not found");

			// No `outranks` gate here, intentionally: `user:impersonate` is granted
			// Owner-only by the access-control matrix, and the Owner must be able
			// to impersonate *any* account — including other Owners — to debug
			// account-specific issues. Gating on rank would block owner-vs-owner.
			await auth.api.impersonateUser({ body: { userId: params.id } });

			await writeAuditLog({
				actorId: viewer.id,
				action: "user.impersonate.start",
				targetType: "user",
				targetId: params.id,
			});
			return { ok: true };
		},
	)
	.post("/stop-impersonating", async ({ user: viewer, session, status }) => {
		if (!viewer || !session) return status(401, "Sign in");
		const realActorId = session.impersonatedBy;
		if (!realActorId) {
			return status(400, "Not currently impersonating");
		}
		await auth.api.stopImpersonating();
		await writeAuditLog({
			actorId: realActorId,
			action: "user.impersonate.stop",
			targetType: "user",
			targetId: viewer.id,
		});
		return { ok: true };
	})
```

> This requires `session` to be available in the route context. Confirm (from the
> Task 7 mock-infra read of `context.ts`) that `.use(context)` already exposes
> `session` alongside `user` — if not, add `session` to the destructured handler
> params per the existing `context.ts` derivation (it already attaches the
> better-auth session object, which carries `impersonatedBy` once the admin
> plugin's `impersonationSessionDuration` option from Task 4 is active).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/server && bun test src/routes/staff.test.ts -t "staff user notes endpoints"`
Run: `cd apps/server && bun test src/routes/staff.test.ts -t "staff impersonation endpoints"`

Expected: PASS — all nine new cases succeed.

- [ ] **Step 7: Run the full staff suite to check for regressions**

Run: `cd apps/server && bun test src/routes/staff.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```
git add apps/server/src/routes/staff.ts apps/server/src/routes/staff.test.ts
git commit -m "feat(server): add staff notes and impersonation endpoints

GET/POST /users/:id/notes (gated on user:note, audits user.note.add);
POST /users/:id/impersonate and /stop-impersonating using better-auth's
admin-plugin impersonation API. The impersonate endpoint deliberately
has no outranks gate — user:impersonate is Owner-only in the access
matrix, and the Owner must be able to impersonate any account including
peer Owners. stop-impersonating attributes the audit entry to the real
actor via session.impersonatedBy, not the impersonated user.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Extract shared `errorMessage` helper for the web staff panel

**Files:**
- Create: `apps/web/src/lib/staff-error-message.ts`
- Modify: `apps/web/src/components/staff/staff-users-tab.tsx`
- Modify: `apps/web/src/components/staff/staff-content-actions.tsx`

Both `staff-users-tab.tsx` and `staff-content-actions.tsx` currently define their own
local `errorMessage(value, fallback)` helper with identical bodies (confirmed by
reading both files). New components in this plan (Tasks 14-16) will need the same
helper, so this task DRYs it up before adding more call sites.

- [ ] **Step 1: Find the existing duplicated definition**

Run: `cd apps/web && grep -n "function errorMessage" src/components/staff/staff-users-tab.tsx src/components/staff/staff-content-actions.tsx`

Expected output (showing the identical helper in both files):
```
src/components/staff/staff-users-tab.tsx:NN:function errorMessage(value: unknown, fallback: string): string {
src/components/staff/staff-content-actions.tsx:MM:function errorMessage(value: unknown, fallback: string): string {
```

Note the line numbers `NN` and `MM` — you'll remove those blocks in Step 3.

- [ ] **Step 2: Create the shared helper module**

Create `apps/web/src/lib/staff-error-message.ts`:

```ts
/**
 * Best-effort extraction of a human-readable message from an Eden Treaty
 * error/value shape (`{ value: { message } }`, `{ message }`, plain string,
 * or anything else). Falls back to `fallback` when nothing usable is found.
 *
 * Shared across staff-panel components that surface API errors via `sonner`
 * toasts — previously duplicated verbatim in `staff-users-tab.tsx` and
 * `staff-content-actions.tsx`.
 */
export function errorMessage(value: unknown, fallback: string): string {
	if (typeof value === "string" && value.trim()) return value;
	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;
		if (typeof obj.message === "string" && obj.message.trim()) {
			return obj.message;
		}
		if (obj.value && typeof obj.value === "object") {
			const inner = obj.value as Record<string, unknown>;
			if (typeof inner.message === "string" && inner.message.trim()) {
				return inner.message;
			}
		}
	}
	return fallback;
}
```

> **Before pasting this into the file:** open both existing definitions
> (`staff-users-tab.tsx:NN` and `staff-content-actions.tsx:MM` from Step 1) and
> copy the **actual** body verbatim into this new file instead of the body shown
> above — the snippet above is a best-effort reconstruction of the "identical
> local helper" described in the design notes. If the two existing copies are not
> byte-identical, treat `staff-users-tab.tsx`'s version as canonical (it's the
> older of the two call sites) and note the discrepancy in the commit message.

- [ ] **Step 3: Remove the duplicated definitions and import the shared helper**

In `apps/web/src/components/staff/staff-users-tab.tsx`:
- Delete the local `function errorMessage(value: unknown, fallback: string): string { ... }` block.
- Add to the top-level imports:
```ts
import { errorMessage } from "@/lib/staff-error-message";
```

In `apps/web/src/components/staff/staff-content-actions.tsx`:
- Delete the local `function errorMessage(value: unknown, fallback: string): string { ... }` block.
- Add to the top-level imports:
```ts
import { errorMessage } from "@/lib/staff-error-message";
```

- [ ] **Step 4: Typecheck**

Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

Expected: Same baseline error count as before this change (per the memory note,
the project has a known baseline — this refactor must not add or remove errors
other than fixing/moving the two duplicated-helper sites, which produce none).

- [ ] **Step 5: Commit**

```
git add apps/web/src/lib/staff-error-message.ts apps/web/src/components/staff/staff-users-tab.tsx apps/web/src/components/staff/staff-content-actions.tsx
git commit -m "refactor(web): extract shared errorMessage helper for staff panel

staff-users-tab.tsx and staff-content-actions.tsx each defined an
identical local errorMessage(value, fallback) for surfacing Eden
Treaty API errors via sonner toasts. Move it to lib/staff-error-message
so the new user-detail components (notes, edit form, pro toggle,
impersonation) can reuse it without a third copy.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Impersonation banner — session type, component, layout wiring

**Files:**
- Modify: `apps/web/src/lib/auth-server.ts`
- Create: `apps/web/src/components/staff/impersonation-banner.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Add `impersonatedBy` to `ServerSession`**

In `apps/web/src/lib/auth-server.ts`, the `ServerSession` type's `session` field
currently reads (per the full file read earlier):

```ts
	session: { id: string; userId: string; expiresAt?: Date | string };
```

Change it to:

```ts
	session: {
		id: string;
		userId: string;
		expiresAt?: Date | string;
		// Present once an Owner starts impersonating this account; carries the
		// real staff member's user id so we can show a "you are impersonating"
		// banner and let them stop.
		impersonatedBy?: string | null;
	};
```

- [ ] **Step 2: Create the banner component**

Create `apps/web/src/components/staff/impersonation-banner.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@still/ui/components/button";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

/**
 * Sticky banner shown across the app while a staff member is impersonating
 * another account (via POST /api/staff/users/:id/impersonate). Lets them end
 * the session in one click; the server attributes the resulting audit entry
 * to the real staff member via `session.impersonatedBy`, not this account.
 */
export function ImpersonationBanner({ name }: { name: string }) {
	const [stopping, setStopping] = useState(false);

	async function handleStop() {
		setStopping(true);
		try {
			const res = await api.api.staff["stop-impersonating"].post();
			if (res.error) {
				toast.error(errorMessage(res.error, "Could not stop impersonating"));
				return;
			}
			toast.success("Stopped impersonating");
			window.location.href = "/staff";
		} catch (err) {
			toast.error(errorMessage(err, "Could not stop impersonating"));
		} finally {
			setStopping(false);
		}
	}

	return (
		<div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-amber-950 text-sm">
			<span>
				You&apos;re impersonating <strong>{name}</strong>.
			</span>
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="border-amber-950/30 bg-transparent text-amber-950 hover:bg-amber-950/10"
				disabled={stopping}
				onClick={handleStop}
			>
				{stopping ? "Stopping…" : "Stop impersonating"}
			</Button>
		</div>
	);
}
```

> Check `packages/ui/src/components/button.tsx` for the actual exported `Button`
> prop names (`size`/`variant` values) before pasting — match whatever variants
> the codebase already uses elsewhere in `staff-content-actions.tsx` or
> `role-change-dialog-root.tsx` (both were read earlier in this plan's research
> and use the shared `Button`). Adjust the `variant`/`size`/`className` strings
> to whichever values those files use, keeping the amber "warning" coloring.

- [ ] **Step 3: Wire the banner into the app layout**

Read `apps/web/src/app/(app)/layout.tsx` (already read in full during planning) to
find where `authServer()` is called and where the page shell/`AppShell` is rendered.
Add a `session.impersonatedBy` check and conditionally render the banner directly
above the existing shell content:

```tsx
import { ImpersonationBanner } from "@/components/staff/impersonation-banner";
```

Then, in the component body where `const session = await authServer();` (or
equivalent) already runs, compute:

```tsx
	const impersonatedBy = session?.session.impersonatedBy ?? null;
	// While impersonating, `session.user` IS the impersonated account (better-auth
	// swaps the session's user), so its name is exactly what the banner should show.
	const impersonatedName = session?.user.name || session?.user.email || "this account";
```

And render the banner as the first child of the returned JSX, immediately before
the existing `<AppShell ...>` (or top-level fragment) wrapper:

```tsx
	return (
		<>
			{impersonatedBy ? <ImpersonationBanner name={impersonatedName} /> : null}
			{/* ...existing layout JSX unchanged below... */}
```

> The exact wrapper element/fragment depends on what `layout.tsx` currently
> returns — match its existing structure exactly; only insert the conditional
> banner as a new first sibling. Do not restructure existing layout JSX.

- [ ] **Step 4: Typecheck**

Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

Expected: Same baseline error count as before (no new errors from the new
component or the `ServerSession` field addition).

- [ ] **Step 5: Commit**

```
git add apps/web/src/lib/auth-server.ts apps/web/src/components/staff/impersonation-banner.tsx "apps/web/src/app/(app)/layout.tsx"
git commit -m "feat(web): show impersonation banner when staff is viewing as another account

Adds impersonatedBy to ServerSession (better-auth admin plugin attaches
it to the session once an Owner starts impersonating), a sticky banner
with a one-click 'Stop impersonating' action, and wires it into the app
layout so it's visible everywhere while active.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: `StaffUserNotes` component

**Files:**
- Create: `apps/web/src/components/staff/staff-user-notes.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/staff/staff-user-notes.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@still/ui/components/button";
import { Textarea } from "@still/ui/components/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

export type StaffUserNote = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: string | null;
};

function formatDate(value: string | null): string {
	if (!value) return "";
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

/**
 * Internal staff notes for a single user: a read-only list (oldest first is
 * NOT assumed — we render whatever order the server returns, which is
 * newest-first per `listStaffUserNotes`) plus a composer for staff with
 * `user:note`. Notes are visible to anyone who can view the expanded user
 * row; only `canNote` staff can add new ones.
 */
export function StaffUserNotes({
	userId,
	notes,
	canNote,
	onNoteAdded,
}: {
	userId: string;
	notes: StaffUserNote[];
	canNote: boolean;
	onNoteAdded: (note: StaffUserNote) => void;
}) {
	const [body, setBody] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit() {
		const trimmed = body.trim();
		if (!trimmed) return;
		setSubmitting(true);
		try {
			const res = await api.api.staff.users[userId].notes.post({
				body: trimmed,
			});
			if (res.error) {
				toast.error(errorMessage(res.error, "Could not add note"));
				return;
			}
			const data = res.data as { note: StaffUserNote } | null;
			if (data?.note) {
				onNoteAdded(data.note);
				setBody("");
				toast.success("Note added");
			}
		} catch (err) {
			toast.error(errorMessage(err, "Could not add note"));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="space-y-3">
			<h4 className="font-medium text-sm">Staff notes</h4>
			{notes.length === 0 ? (
				<p className="text-muted-foreground text-xs">No notes yet.</p>
			) : (
				<ul className="space-y-2">
					{notes.map((note) => (
						<li
							key={note.id}
							className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
						>
							<p className="whitespace-pre-wrap">{note.body}</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{note.authorId} · {formatDate(note.createdAt)}
							</p>
						</li>
					))}
				</ul>
			)}
			{canNote ? (
				<div className="space-y-2">
					<Textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder="Add an internal note about this account…"
						rows={3}
						maxLength={2000}
					/>
					<Button
						type="button"
						size="sm"
						disabled={submitting || !body.trim()}
						onClick={handleSubmit}
					>
						{submitting ? "Adding…" : "Add note"}
					</Button>
				</div>
			) : null}
		</div>
	);
}
```

> Confirm the Eden Treaty path-builder shape `api.api.staff.users[userId].notes`
> matches the route registration from Task 11 (`/users/:id/notes` nested under
> `/api/staff`) — mirror whatever indexing pattern `staff-content-actions.tsx`
> already uses for parameterized routes (it was read in full during planning and
> contains comparable `api.api.staff....[id]....` calls). Adjust the bracket
> path if the existing convention differs (e.g. `.users({ id: userId })`).

- [ ] **Step 2: Typecheck**

Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

Expected: Same baseline error count as before — the new component is self-contained
and only imports already-typed modules (`Button`, `Textarea`, `api`, `errorMessage`).

- [ ] **Step 3: Commit**

```
git add apps/web/src/components/staff/staff-user-notes.tsx
git commit -m "feat(web): add StaffUserNotes component for the staff user detail panel

Read-only note list plus a composer gated on canNote; posts via
POST /api/staff/users/:id/notes and reports the newly created note back
to the parent so it can prepend it without a refetch.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 15: `StaffUserEditForm` component

**Files:**
- Create: `apps/web/src/components/staff/staff-user-edit-form.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/staff/staff-user-edit-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

export type StaffEditableProfile = {
	displayName: string | null;
	handle: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
	bannerUrl: string | null;
	accentColor: string | null;
};

type FormState = {
	displayName: string;
	handle: string;
	bio: string;
	pronouns: string;
	location: string;
	website: string;
	bannerUrl: string;
	accentColor: string;
};

function toFormState(profile: StaffEditableProfile): FormState {
	return {
		displayName: profile.displayName ?? "",
		handle: profile.handle,
		bio: profile.bio ?? "",
		pronouns: profile.pronouns ?? "",
		location: profile.location ?? "",
		website: profile.website ?? "",
		bannerUrl: profile.bannerUrl ?? "",
		accentColor: profile.accentColor ?? "",
	};
}

/**
 * Inline edit form for the eight profile fields staff with `user:edit` may
 * change on someone else's account (per the design spec — display name,
 * handle, bio, pronouns, location, website, banner URL, accent color).
 * Submits the full set to POST /api/staff/users/:id/edit; the server only
 * audits which fields actually changed, so we can send everything unconditionally.
 */
export function StaffUserEditForm({
	userId,
	profile,
	onSaved,
	onCancel,
}: {
	userId: string;
	profile: StaffEditableProfile;
	onSaved: (profile: StaffEditableProfile) => void;
	onCancel: () => void;
}) {
	const [form, setForm] = useState<FormState>(() => toFormState(profile));
	const [saving, setSaving] = useState(false);

	function set<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function toBody() {
		return {
			displayName: form.displayName.trim() || null,
			handle: form.handle.trim(),
			bio: form.bio.trim() || null,
			pronouns: form.pronouns.trim() || null,
			location: form.location.trim() || null,
			website: form.website.trim() || null,
			bannerUrl: form.bannerUrl.trim() || null,
			accentColor: form.accentColor.trim() || null,
		};
	}

	async function handleSave() {
		setSaving(true);
		try {
			const res = await api.api.staff.users[userId].edit.post(toBody());
			if (res.error) {
				toast.error(errorMessage(res.error, "Could not save changes"));
				return;
			}
			const data = res.data as { profile: StaffEditableProfile } | null;
			if (data?.profile) {
				onSaved(data.profile);
				toast.success("Profile updated");
			}
		} catch (err) {
			toast.error(errorMessage(err, "Could not save changes"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-3">
			<div className="grid gap-3 sm:grid-cols-2">
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground text-xs">Display name</span>
					<Input
						value={form.displayName}
						onChange={(e) => set("displayName", e.target.value)}
						maxLength={50}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground text-xs">Handle</span>
					<Input
						value={form.handle}
						onChange={(e) => set("handle", e.target.value)}
						maxLength={32}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground text-xs">Pronouns</span>
					<Input
						value={form.pronouns}
						onChange={(e) => set("pronouns", e.target.value)}
						maxLength={30}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground text-xs">Location</span>
					<Input
						value={form.location}
						onChange={(e) => set("location", e.target.value)}
						maxLength={60}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground text-xs">Website</span>
					<Input
						value={form.website}
						onChange={(e) => set("website", e.target.value)}
						maxLength={200}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground text-xs">Banner URL</span>
					<Input
						value={form.bannerUrl}
						onChange={(e) => set("bannerUrl", e.target.value)}
						maxLength={500}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground text-xs">Accent color</span>
					<Input
						value={form.accentColor}
						onChange={(e) => set("accentColor", e.target.value)}
						maxLength={20}
						placeholder="#7c3aed"
					/>
				</label>
			</div>
			<label className="block space-y-1 text-sm">
				<span className="text-muted-foreground text-xs">Bio</span>
				<Textarea
					value={form.bio}
					onChange={(e) => set("bio", e.target.value)}
					rows={3}
					maxLength={500}
				/>
			</label>
			<div className="flex gap-2">
				<Button type="button" size="sm" disabled={saving} onClick={handleSave}>
					{saving ? "Saving…" : "Save changes"}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={saving}
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}
```

> Confirm `@still/ui/components/input` exports `Input` with a standard
> `value`/`onChange` controlled-input signature (mirror whatever the codebase's
> existing forms use — e.g. `tv-detail-progress-panel.tsx` or other staff
> components read during planning) and adjust the import path/props if it
> differs. Same applies to `Button`'s `variant="outline"` / `size="sm"` props —
> match the values already used in `staff-content-actions.tsx`.

- [ ] **Step 2: Typecheck**

Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

Expected: Same baseline error count as before.

- [ ] **Step 3: Commit**

```
git add apps/web/src/components/staff/staff-user-edit-form.tsx
git commit -m "feat(web): add StaffUserEditForm for editing another user's profile fields

Inline form covering the eight fields staff with user:edit may change
(display name, handle, bio, pronouns, location, website, banner URL,
accent color); submits the full set to POST /api/staff/users/:id/edit
and reports the saved profile back to the parent.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 16: `StaffUserDetail` component (composes the expanded row)

**Files:**
- Create: `apps/web/src/components/staff/staff-user-detail.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/staff/staff-user-detail.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@still/ui/components/button";
import { Checkbox } from "@still/ui/components/checkbox";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";
import { roleLabel } from "@/lib/staff-role-labels";

import {
	type StaffEditableProfile,
	StaffUserEditForm,
} from "./staff-user-edit-form";
import { StaffUserNotes, type StaffUserNote } from "./staff-user-notes";

type StaffUserDetailData = {
	user: {
		id: string;
		name?: string | null;
		email?: string | null;
		emailVerified?: boolean | null;
		role?: string | null;
		banned?: boolean | null;
		createdAt?: string | null;
	};
	profile: (StaffEditableProfile & {
		userId: string;
		isPro: boolean;
		isPrivate: boolean;
		statsCache?: {
			filmsLogged?: number;
			thisYear?: number;
			following?: number;
			followers?: number;
			reviewsCount?: number;
			listsCount?: number;
		} | null;
	}) | null;
	permissions: Array<{ resource: string; action: string; label: string }>;
};

function formatDate(value?: string | null): string {
	if (!value) return "";
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

/**
 * Expanded detail panel for a single user row in the staff Users tab.
 * Fetches GET /api/staff/users/:id on mount and renders:
 *  - profile/account summary + the role's permission list (always, for any
 *    staff member who can see the row — gating happens server-side too)
 *  - an inline edit form gated on `canEdit`
 *  - a Pro override toggle gated on `canPro`
 *  - internal notes (read for everyone who can see the row, write gated on
 *    `canNote`)
 *  - an "Impersonate" action gated on `canImpersonate`
 */
export function StaffUserDetail({
	userId,
	canEdit,
	canNote,
	canPro,
	canImpersonate,
}: {
	userId: string;
	canEdit: boolean;
	canNote: boolean;
	canPro: boolean;
	canImpersonate: boolean;
}) {
	const [data, setData] = useState<StaffUserDetailData | null>(null);
	const [notes, setNotes] = useState<StaffUserNote[]>([]);
	const [loading, setLoading] = useState(true);
	const [editing, setEditing] = useState(false);
	const [proSaving, setProSaving] = useState(false);
	const [impersonating, setImpersonating] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const [detailRes, notesRes] = await Promise.all([
					api.api.staff.users[userId].get(),
					canNote || true
						? api.api.staff.users[userId].notes.get()
						: Promise.resolve({ data: { notes: [] }, error: null }),
				]);
				if (cancelled) return;
				if (detailRes.error) {
					toast.error(errorMessage(detailRes.error, "Could not load user"));
				} else {
					setData(detailRes.data as StaffUserDetailData);
				}
				if (!notesRes.error) {
					const nd = notesRes.data as { notes: StaffUserNote[] } | null;
					setNotes(nd?.notes ?? []);
				}
			} catch (err) {
				if (!cancelled) {
					toast.error(errorMessage(err, "Could not load user"));
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId, canNote]);

	async function handleProToggle(next: boolean) {
		setProSaving(true);
		try {
			const res = await api.api.staff.users[userId].pro.post({ isPro: next });
			if (res.error) {
				toast.error(errorMessage(res.error, "Could not update Pro status"));
				return;
			}
			setData((prev) =>
				prev?.profile ? { ...prev, profile: { ...prev.profile, isPro: next } } : prev,
			);
			toast.success(next ? "Granted Pro" : "Revoked Pro");
		} catch (err) {
			toast.error(errorMessage(err, "Could not update Pro status"));
		} finally {
			setProSaving(false);
		}
	}

	async function handleImpersonate() {
		setImpersonating(true);
		try {
			const res = await api.api.staff.users[userId].impersonate.post();
			if (res.error) {
				toast.error(errorMessage(res.error, "Could not start impersonation"));
				return;
			}
			toast.success("Impersonating — redirecting…");
			window.location.href = "/home";
		} catch (err) {
			toast.error(errorMessage(err, "Could not start impersonation"));
		} finally {
			setImpersonating(false);
		}
	}

	if (loading) {
		return <p className="px-4 py-3 text-muted-foreground text-sm">Loading…</p>;
	}
	if (!data) {
		return (
			<p className="px-4 py-3 text-muted-foreground text-sm">
				Could not load this user.
			</p>
		);
	}

	const { user, profile, permissions } = data;

	return (
		<div className="space-y-6 border-border border-t bg-muted/10 px-4 py-4">
			<section className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1 text-sm">
					<p>
						<span className="text-muted-foreground">Email:</span>{" "}
						{user.email ?? "—"}
						{user.emailVerified ? (
							<span className="ml-1 text-muted-foreground text-xs">
								(verified)
							</span>
						) : (
							<span className="ml-1 text-muted-foreground text-xs">
								(unverified)
							</span>
						)}
					</p>
					<p>
						<span className="text-muted-foreground">Role:</span>{" "}
						{roleLabel(user.role ?? "user")}
					</p>
					<p>
						<span className="text-muted-foreground">Joined:</span>{" "}
						{formatDate(user.createdAt)}
					</p>
					<p>
						<span className="text-muted-foreground">Status:</span>{" "}
						{user.banned ? "Banned" : "Active"}
					</p>
					{profile ? (
						<>
							<p>
								<span className="text-muted-foreground">Handle:</span>{" "}
								<a
									href={`/profile/${profile.handle}`}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-2"
								>
									@{profile.handle}
								</a>
							</p>
							<p className="flex flex-wrap gap-1.5">
								{profile.isPro ? (
									<span className="rounded-full border border-border px-2 py-0.5 text-xs">
										Pro
									</span>
								) : null}
								{profile.isPrivate ? (
									<span className="rounded-full border border-border px-2 py-0.5 text-xs">
										Private
									</span>
								) : null}
							</p>
							{profile.statsCache ? (
								<p className="text-muted-foreground text-xs">
									{(profile.statsCache.filmsLogged ?? 0)} films logged ·{" "}
									{(profile.statsCache.reviewsCount ?? 0)} reviews ·{" "}
									{(profile.statsCache.listsCount ?? 0)} lists ·{" "}
									{(profile.statsCache.followers ?? 0)} followers ·{" "}
									{(profile.statsCache.following ?? 0)} following
								</p>
							) : null}
						</>
					) : null}
				</div>
				<div className="space-y-2 text-sm">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						Permissions for {roleLabel(user.role ?? "user")}
					</p>
					<ul className="flex flex-wrap gap-1.5">
						{permissions.map((p) => (
							<li
								key={`${p.resource}:${p.action}`}
								className="rounded-full border border-border px-2 py-0.5 text-xs"
							>
								{p.label}
							</li>
						))}
					</ul>
				</div>
			</section>

			{canPro && profile ? (
				<section className="flex items-center gap-2">
					<Checkbox
						checked={profile.isPro}
						disabled={proSaving}
						onCheckedChange={(checked) => handleProToggle(checked === true)}
					/>
					<span className="text-sm">Pro override (manually granted)</span>
				</section>
			) : null}

			{canEdit && profile ? (
				<section>
					{editing ? (
						<StaffUserEditForm
							userId={userId}
							profile={profile}
							onCancel={() => setEditing(false)}
							onSaved={(updated) => {
								setData((prev) =>
									prev ? { ...prev, profile: { ...prev.profile, ...updated } } : prev,
								);
								setEditing(false);
							}}
						/>
					) : (
						<Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
							Edit profile
						</Button>
					)}
				</section>
			) : null}

			<section>
				<StaffUserNotes
					userId={userId}
					notes={notes}
					canNote={canNote}
					onNoteAdded={(note) => setNotes((prev) => [note, ...prev])}
				/>
			</section>

			{canImpersonate ? (
				<section>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={impersonating}
						onClick={handleImpersonate}
					>
						{impersonating ? "Starting…" : "Impersonate this user"}
					</Button>
				</section>
			) : null}
		</div>
	);
}
```

> Confirm the `Checkbox` component's change-callback prop name and signature
> against `packages/ui/src/components/checkbox.tsx` (read during planning) and
> the usage example in `tv-detail-progress-panel.tsx` — adjust `onCheckedChange`
> / the `checked === true` comparison if the real signature differs (e.g. a
> plain boolean `onChange`). Likewise verify the Eden path-builder calls
> (`api.api.staff.users[userId].get()`, `.pro.post(...)`, `.impersonate.post()`)
> against the indexing convention already used in `staff-content-actions.tsx`.

- [ ] **Step 2: Typecheck**

Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

Expected: Same baseline error count as before — fix any type mismatches surfaced
by the `Checkbox`/Eden-path adjustments noted above before moving on.

- [ ] **Step 3: Commit**

```
git add apps/web/src/components/staff/staff-user-detail.tsx
git commit -m "feat(web): add StaffUserDetail composing component for expanded user rows

Fetches GET /api/staff/users/:id and /notes on mount; renders profile
summary + role permission chips (visible to anyone who can expand the
row), plus gated sub-sections: Pro override checkbox (canPro), inline
edit form (canEdit), notes composer (canNote), and an Impersonate
button (canImpersonate) that redirects home on success.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 17: Wire expandable rows into `StaffUsersTab`

**Files:**
- Modify: `apps/web/src/components/staff/staff-users-tab.tsx`

The current `users.map` (lines 165-226, read in full during planning) renders each
user as a flat `<li>` containing a name/email block plus a role `<select>` and a
Ban/Unban `Button` — both interactive elements live directly in the row. We need to
add a way to expand a row into a `StaffUserDetail` panel without nesting a `<button>`
(the row-toggle) around the existing `<select>`/`<Button>` (which is invalid HTML
and breaks click handling). The simplest correct approach: make the name/email block
itself the toggle (a `<button type="button">` wrapping just that `<div>`), leaving
the `<select>` and ban `Button` as siblings, exactly as they are today.

- [ ] **Step 1: Add expansion state**

In `apps/web/src/components/staff/staff-users-tab.tsx`, near the existing state
declarations (after `const [busyId, setBusyId] = useState<string | null>(null);`
on line 55), add:

```ts
	const [expandedId, setExpandedId] = useState<string | null>(null);
```

- [ ] **Step 2: Add the import for `StaffUserDetail`**

Add to the top-level imports (alongside the other `./` component imports, or
create the section if there isn't one yet):

```ts
import { StaffUserDetail } from "./staff-user-detail";
```

- [ ] **Step 3: Restructure the row to add a toggle button and conditional detail panel**

Replace the `<li>` block (lines 169-224):

```tsx
							<li
								key={u.id}
								className="flex flex-wrap items-center gap-3 px-4 py-3"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">
										{u.name || "Unnamed"}
										{u.banned ? (
											<span className="ml-2 font-normal text-destructive text-xs">
												banned
											</span>
										) : null}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{u.email} · {role}
									</p>
								</div>

								{canSetRole ? (
									<select
										value={role}
										disabled={busy}
										onChange={(e) => void handleSetRole(u, e.target.value)}
										className="h-8 rounded-md border border-input bg-muted/40 px-2 text-sm outline-none disabled:opacity-60"
										aria-label={`Set role for ${u.email}`}
									>
										{ASSIGNABLE_ROLES.map((r) => (
											<option key={r} value={r}>
												{r}
											</option>
										))}
									</select>
								) : null}

								{canModerate ? (
									u.banned ? (
										<Button
											variant="outline"
											size="sm"
											disabled={busy}
											onClick={() => void handleUnban(u)}
										>
											Unban
										</Button>
									) : (
										<Button
											variant="destructive"
											size="sm"
											disabled={busy}
											onClick={() => void handleBan(u)}
										>
											Ban
										</Button>
									)
								) : null}
							</li>
```

with:

```tsx
							<li key={u.id}>
								<div className="flex flex-wrap items-center gap-3 px-4 py-3">
									<button
										type="button"
										className="min-w-0 flex-1 text-left"
										aria-expanded={expandedId === u.id}
										onClick={() =>
											setExpandedId((prev) => (prev === u.id ? null : u.id))
										}
									>
										<p className="truncate font-medium text-sm">
											{u.name || "Unnamed"}
											{u.banned ? (
												<span className="ml-2 font-normal text-destructive text-xs">
													banned
												</span>
											) : null}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{u.email} · {role}
										</p>
									</button>

									{canSetRole ? (
										<select
											value={role}
											disabled={busy}
											onChange={(e) => void handleSetRole(u, e.target.value)}
											className="h-8 rounded-md border border-input bg-muted/40 px-2 text-sm outline-none disabled:opacity-60"
											aria-label={`Set role for ${u.email}`}
										>
											{ASSIGNABLE_ROLES.map((r) => (
												<option key={r} value={r}>
													{r}
												</option>
											))}
										</select>
									) : null}

									{canModerate ? (
										u.banned ? (
											<Button
												variant="outline"
												size="sm"
												disabled={busy}
												onClick={() => void handleUnban(u)}
											>
												Unban
											</Button>
										) : (
											<Button
												variant="destructive"
												size="sm"
												disabled={busy}
												onClick={() => void handleBan(u)}
											>
												Ban
											</Button>
										)
									) : null}
								</div>

								{expandedId === u.id ? (
									<StaffUserDetail
										userId={u.id}
										canEdit={canModerate}
										canNote={canModerate}
										canPro={canModerate}
										canImpersonate={canSetRole}
									/>
								) : null}
							</li>
```

> `canEdit`/`canNote`/`canPro` all reuse the existing `canModerate` boolean
> (Owner+Admin) because the Task 2 access-control matrix grants identical
> Owner+Admin access to `user:edit`/`user:note`/`user:pro`. Only
> `canImpersonate` needs the stricter `canSetRole` (Owner-only), matching
> `user:impersonate`'s Owner-only grant.

- [ ] **Step 4: Typecheck**

Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

Expected: Same baseline error count as before.

- [ ] **Step 5: Manually verify in the running app**

Run: `cd apps/web && bun dev` (or however the dev server is normally started in
this repo — check `package.json` scripts if unsure)

Expected: Sign in as an Owner or Admin, open the staff Users tab, click a user's
name/email block — the row expands to show `StaffUserDetail` (profile, permissions,
notes, and — for Owner — the Impersonate button) without any console errors about
nested interactive elements or invalid HTML nesting. Click again to collapse.
Stop the dev server when done.

- [ ] **Step 6: Commit**

```
git add apps/web/src/components/staff/staff-users-tab.tsx
git commit -m "feat(web): make staff user rows expandable into StaffUserDetail

Wraps each row's name/email block in a toggle button (leaving the role
select and ban/unban button as siblings, avoiding invalid nested
interactive elements) and conditionally mounts StaffUserDetail below
the row when expanded. canEdit/canNote/canPro reuse canModerate
(Owner+Admin, matching the access-control matrix); canImpersonate
reuses canSetRole (Owner-only).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 18: Full verification pass

**Files:** none (verification only — no production code changes expected; fix
anything this surfaces before committing)

- [ ] **Step 1: Record the pre-existing baselines (if not already known)**

Before trusting "no regressions," capture what currently passes/fails so the
comparison is meaningful. If you started this plan from a clean `main`, you can
skip straight to Step 2 and treat any failure as new. Otherwise run, on a clean
checkout *before* this plan's changes:

Run: `cd apps/server && bun test 2>&1 | tail -30`
Run: `cd packages/auth && bun test 2>&1 | tail -30`
Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | tail -5`

Note the pass/fail counts and the web typecheck error count (per the memory note,
the known baseline is **14 errors** — confirm this still holds before you start).

- [ ] **Step 2: Run the full server test suite**

Run: `cd apps/server && bun test`

Expected: PASS — same or greater test count than baseline, zero failures.
If anything fails, use `superpowers:systematic-debugging` to find the root cause
before patching — do not guess-and-check.

- [ ] **Step 3: Run the full auth package test suite**

Run: `cd packages/auth && bun test`

Expected: PASS — `permissions.test.ts` and `permission-summary.test.ts` (new in
Task 3) both green, zero failures.

- [ ] **Step 4: Run the web typecheck**

Run: `cd "C:\Users\adgv\Documents\Projects\still" && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

Expected: Error count unchanged from the baseline recorded in Step 1 (14, per the
memory note, unless your own Step-1 run found differently). Remember `npx tsc` in
`apps/web` is a decoy that false-passes — always use this exact root-relative
invocation.

If the count increased, read the new errors' file:line references — they will
point at one of this plan's new/modified files (most likely
`staff-user-detail.tsx`, `staff-user-edit-form.tsx`, `staff-user-notes.tsx`,
`impersonation-banner.tsx`, or the Eden client's inferred route types after the
new server endpoints were added). Fix the type mismatch at its source rather than
casting it away.

- [ ] **Step 5: Spot-check the new lib unit tests directly**

Run: `cd packages/auth && bun test src/permission-summary.test.ts`
Run: `cd apps/server && bun test src/lib/staff-user-notes.test.ts`

Expected: Both PASS — these are the two new standalone helpers (Tasks 3 and 6)
and are easy to overlook in a full-suite run's scrollback.

- [ ] **Step 6: Manually exercise the feature end-to-end**

Run: `cd apps/web && bun dev` (check `package.json` for the actual script name
if this differs)

Expected, walking through as an Owner:
1. Staff Users tab → expand a row → see profile info, role permission chips,
   notes section, Pro checkbox, Edit button, and an Impersonate button.
2. Add a note → it appears at the top of the list immediately.
3. Toggle the Pro checkbox → it persists across a collapse/re-expand.
4. Edit the profile (e.g. change the bio) → Save → values persist on reload.
5. Click "Impersonate this user" → the amber banner appears site-wide → click
   "Stop impersonating" → banner disappears, you're back to your own account.
6. Re-open the Audit tab (Owner/Admin) → see `user.note.add`, `user.pro.grant`,
   `user.edit`, `user.impersonate.start`, `user.impersonate.stop` entries with
   the correct actor attribution (the *real* staff member, not the impersonated
   account, for the impersonation entries).

Then repeat the expand/collapse and note/edit checks as an Admin (should work,
minus impersonation) and as a Moderator (should see notes — read + maybe write
depending on the matrix from Task 2 — but no edit/pro/impersonate controls).
Stop the dev server when done.

- [ ] **Step 7: Final commit (only if Step 4-6 required fixes)**

If verification surfaced and you fixed any issues, stage exactly the files you
changed to fix them and commit:

```
git add -A
git commit -m "fix(staff): address issues found during user-info verification pass

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

If verification passed cleanly with no fixes needed, skip this step — there is
nothing to commit.

---
