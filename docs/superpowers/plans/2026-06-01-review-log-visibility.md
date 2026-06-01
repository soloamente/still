# Review & Diary Log Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patrons choose who can see each review and each diary log — `public`, `followers`, `friends` (mutual follows), or `private` — with an account-level default.

**Architecture:** Add a Postgres enum `content_visibility` and a `visibility` column to both `review` and `log` (replacing `review.is_public`), plus `profile.default_visibility`. One shared access predicate (a Drizzle SQL fragment + a pure boolean helper) is reused by every *attributed* read path. Anonymous aggregates (title counts, averages, your own badges) are left untouched.

**Tech Stack:** Drizzle ORM + Postgres (`packages/db`), Elysia API (`apps/server`), Next.js App Router web (`apps/web`), `bun:test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-01-review-log-visibility-design.md`

---

## Conventions in this repo (read before starting)

- Migrations are **hand-written** `.sql` files under `packages/db/src/migrations/` plus a matching entry in `meta/_journal.json` (see `0013_profile_pinned_review_ids.sql` for the minimal style). Do **not** rely on `drizzle-kit generate` for this one — it won't emit the `is_public → visibility` backfill ordering.
- Tests are pure-function unit tests using `import { describe, expect, it } from "bun:test"`, colocated as `*.test.ts` (see `apps/server/src/lib/movie-following-ratings.test.ts`). Run with `bun test <path>`.
- The Eden client is `api.api.<segment>`; web `/api/*` fetches go through `stillApiOrigin()`. Body fields are validated with Elysia `t.*` typebox.
- Ratings are stored oddly (tenths / half-stars) — **do not touch rating logic**; this feature only adds a visibility column alongside it.

---

## File Structure

**Create:**
- `packages/db/src/schema/visibility.ts` — the `content_visibility` pgEnum + `ContentVisibility` type.
- `packages/db/src/migrations/0016_content_visibility.sql` — the migration.
- `apps/server/src/lib/content-visibility.ts` — shared predicate (SQL fragment + pure `canViewContent`) + typebox literal.
- `apps/server/src/lib/content-visibility.test.ts` — unit tests for the pure helper.
- `apps/web/src/components/review/visibility-select.tsx` — reusable web visibility picker (wraps `StillPopoverSelect`).

**Modify:**
- `packages/db/src/schema/activity.ts` — `review` (swap `isPublic`→`visibility`), `log` (add `visibility`).
- `packages/db/src/schema/profile.ts` — add `defaultVisibility`.
- `packages/db/src/migrations/meta/_journal.json` — append idx 16.
- `apps/server/src/routes/reviews.ts`, `movies.ts`, `profiles.ts`, `feed.ts`, `logs.ts`.
- `apps/server/src/lib/movie-following-ratings.ts`, `friends-ratings.ts`, `feed-rating-divergence.ts`, `creator-recognition.ts`, `profile-pinned-reviews.ts`.
- `apps/web/src/components/review/review-composer.tsx`, the Quick Log composer, and the settings page.

---

## Task 1: Visibility enum + schema columns + migration

**Files:**
- Create: `packages/db/src/schema/visibility.ts`
- Modify: `packages/db/src/schema/index.ts`, `packages/db/src/schema/activity.ts:86-117` (review) and `:31-80` (log), `packages/db/src/schema/profile.ts:80-107` (profile columns)
- Create: `packages/db/src/migrations/0016_content_visibility.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Add the enum module**

Create `packages/db/src/schema/visibility.ts`:

```ts
import { pgEnum } from "drizzle-orm/pg-core";

/** Who can see a review or diary log. Tiers nest: friends ⊆ followers ⊆ public. */
export const contentVisibility = pgEnum("content_visibility", [
	"public",
	"followers",
	"friends",
	"private",
]);

export type ContentVisibility = (typeof contentVisibility.enumValues)[number];
```

- [ ] **Step 2: Export it from the schema barrel**

In `packages/db/src/schema/index.ts`, add (keep the list alphabetical-ish, near `tv-watch`):

```ts
export * from "./visibility";
```

- [ ] **Step 3: Swap `review.isPublic` for `visibility`**

In `packages/db/src/schema/activity.ts`, add to the imports at top:

```ts
import { contentVisibility } from "./visibility";
```

In the `review` table (around line 100), **delete**:

```ts
		isPublic: boolean("is_public").default(true).notNull(),
```

and replace with:

```ts
		visibility: contentVisibility("visibility").notNull().default("public"),
```

- [ ] **Step 4: Add `visibility` to `log`**

In the same file, in the `log` table (after the `containsSpoilers` column, around line 50), add:

```ts
		visibility: contentVisibility("visibility").notNull().default("public"),
```

- [ ] **Step 5: Add `defaultVisibility` to `profile`**

In `packages/db/src/schema/profile.ts`, add to the imports:

```ts
import { contentVisibility } from "./visibility";
```

Inside the `profile` table column block (alongside the other columns, before the closing `}`), add:

```ts
		defaultVisibility: contentVisibility("default_visibility")
			.notNull()
			.default("public"),
```

- [ ] **Step 6: Write the migration SQL**

Create `packages/db/src/migrations/0016_content_visibility.sql`:

```sql
-- Per-item visibility for reviews and diary logs, plus an account-level default.
CREATE TYPE "content_visibility" AS ENUM ('public', 'followers', 'friends', 'private');

-- review: replace boolean is_public with the visibility enum (backfill before drop).
ALTER TABLE "review" ADD COLUMN "visibility" "content_visibility" NOT NULL DEFAULT 'public';
UPDATE "review" SET "visibility" = CASE WHEN "is_public" THEN 'public' ELSE 'private' END;
ALTER TABLE "review" DROP COLUMN "is_public";

-- log: new column; every existing row is effectively public today.
ALTER TABLE "log" ADD COLUMN "visibility" "content_visibility" NOT NULL DEFAULT 'public';

-- profile: account-level default applied to newly created content.
ALTER TABLE "profile" ADD COLUMN "default_visibility" "content_visibility" NOT NULL DEFAULT 'public';

-- Indexes to keep filtered reads fast.
CREATE INDEX "review_visibility_idx" ON "review" ("visibility");
CREATE INDEX "log_visibility_idx" ON "log" ("visibility");
```

- [ ] **Step 7: Register the migration in the journal**

In `packages/db/src/migrations/meta/_journal.json`, append to the `entries` array (after idx 15):

```json
	{
		"idx": 16,
		"version": "7",
		"when": 1779201200000,
		"tag": "0016_content_visibility",
		"breakpoints": true
	}
```

- [ ] **Step 8: Type-check the schema package**

Run: `bun run --filter @still/db check-types` (or `cd packages/db && bunx tsc --noEmit`)
Expected: PASS — no references to `review.isPublic` remain in the schema. (Route references are fixed in later tasks; they live in `apps/server`, a separate type-check.)

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema/visibility.ts packages/db/src/schema/index.ts packages/db/src/schema/activity.ts packages/db/src/schema/profile.ts packages/db/src/migrations/0016_content_visibility.sql packages/db/src/migrations/meta/_journal.json
git commit -m "feat(db): content_visibility enum + visibility columns on review/log/profile"
```

---

## Task 2: Shared visibility predicate (pure helper + SQL fragment)

**Files:**
- Create: `apps/server/src/lib/content-visibility.ts`
- Test: `apps/server/src/lib/content-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/content-visibility.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { canViewContent } from "./content-visibility";

const base = {
	authorId: "author",
	viewerFollowsAuthor: false,
	viewerIsMutual: false,
};

describe("canViewContent", () => {
	it("shows public content to anyone, including anonymous", () => {
		expect(
			canViewContent({ ...base, viewerId: null, visibility: "public" }),
		).toBe(true);
		expect(
			canViewContent({ ...base, viewerId: "stranger", visibility: "public" }),
		).toBe(true);
	});

	it("always shows authors their own content, any tier", () => {
		for (const visibility of ["public", "followers", "friends", "private"] as const) {
			expect(
				canViewContent({ ...base, viewerId: "author", visibility }),
			).toBe(true);
		}
	});

	it("hides private from everyone but the author", () => {
		expect(
			canViewContent({ ...base, viewerId: "stranger", visibility: "private" }),
		).toBe(false);
		expect(
			canViewContent({
				...base,
				viewerId: "follower",
				visibility: "private",
				viewerFollowsAuthor: true,
				viewerIsMutual: true,
			}),
		).toBe(false);
	});

	it("followers tier needs a one-way follow", () => {
		expect(
			canViewContent({
				...base,
				viewerId: "f",
				visibility: "followers",
				viewerFollowsAuthor: true,
			}),
		).toBe(true);
		expect(
			canViewContent({ ...base, viewerId: "f", visibility: "followers" }),
		).toBe(false);
		expect(
			canViewContent({ ...base, viewerId: null, visibility: "followers" }),
		).toBe(false);
	});

	it("friends tier needs a mutual follow; a one-way follower is denied", () => {
		expect(
			canViewContent({
				...base,
				viewerId: "m",
				visibility: "friends",
				viewerFollowsAuthor: true,
				viewerIsMutual: true,
			}),
		).toBe(true);
		expect(
			canViewContent({
				...base,
				viewerId: "f",
				visibility: "friends",
				viewerFollowsAuthor: true,
				viewerIsMutual: false,
			}),
		).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test apps/server/src/lib/content-visibility.test.ts`
Expected: FAIL — `Cannot find module './content-visibility'`.

- [ ] **Step 3: Implement the helper module**

Create `apps/server/src/lib/content-visibility.ts`:

```ts
import { db, follow } from "@still/db";
import type { ContentVisibility } from "@still/db";
import { and, eq, exists, or, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { t } from "elysia";

/** Typebox literal for request bodies that accept a visibility. */
export const visibilitySchema = t.Union([
	t.Literal("public"),
	t.Literal("followers"),
	t.Literal("friends"),
	t.Literal("private"),
]);

/**
 * Pure visibility check for a single fetched row. Caller resolves the two
 * follow booleans (or passes the SQL fragment below for list queries).
 */
export function canViewContent(args: {
	viewerId: string | null;
	authorId: string;
	visibility: ContentVisibility;
	viewerFollowsAuthor: boolean;
	viewerIsMutual: boolean;
}): boolean {
	const { viewerId, authorId, visibility } = args;
	if (viewerId && viewerId === authorId) return true;
	switch (visibility) {
		case "public":
			return true;
		case "followers":
			return args.viewerFollowsAuthor;
		case "friends":
			return args.viewerIsMutual;
		case "private":
			return false;
	}
}

/**
 * Drizzle WHERE fragment that keeps only rows the viewer may see. Pass the
 * author-id and visibility columns of the table being filtered. `null`
 * viewerId means anonymous (public only). Reuse everywhere attributed
 * review/log rows are read so the rule never drifts.
 */
export function contentVisibilityWhere(
	viewerId: string | null,
	authorCol: PgColumn,
	visibilityCol: PgColumn,
): SQL {
	const conditions: SQL[] = [eq(visibilityCol, "public")];
	if (viewerId) {
		conditions.push(eq(authorCol, viewerId));
		conditions.push(
			and(
				eq(visibilityCol, "followers"),
				exists(
					db
						.select({ one: sql`1` })
						.from(follow)
						.where(
							and(
								eq(follow.followerId, viewerId),
								eq(follow.followingId, authorCol),
							),
						),
				),
			) as SQL,
		);
		conditions.push(
			and(
				eq(visibilityCol, "friends"),
				exists(
					db
						.select({ one: sql`1` })
						.from(follow)
						.where(
							and(
								eq(follow.followerId, viewerId),
								eq(follow.followingId, authorCol),
								eq(follow.isMutual, true),
							),
						),
				),
			) as SQL,
		);
	}
	return or(...conditions) as SQL;
}

/** Resolve the two follow booleans for a single (viewer, author) pair. */
export async function resolveViewerFollow(
	viewerId: string | null,
	authorId: string,
): Promise<{ viewerFollowsAuthor: boolean; viewerIsMutual: boolean }> {
	if (!viewerId || viewerId === authorId) {
		return { viewerFollowsAuthor: false, viewerIsMutual: false };
	}
	const [row] = await db
		.select({ isMutual: follow.isMutual })
		.from(follow)
		.where(
			and(eq(follow.followerId, viewerId), eq(follow.followingId, authorId)),
		)
		.limit(1);
	return {
		viewerFollowsAuthor: Boolean(row),
		viewerIsMutual: Boolean(row?.isMutual),
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test apps/server/src/lib/content-visibility.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/content-visibility.ts apps/server/src/lib/content-visibility.test.ts
git commit -m "feat(server): shared content-visibility predicate + tests"
```

---

## Task 3: Reviews route — visibility field + enforce reads

**Files:**
- Modify: `apps/server/src/routes/reviews.ts`

- [ ] **Step 1: Import the helpers and profile default**

At the top of `apps/server/src/routes/reviews.ts`, add to the `@still/db` import list `profile` (already imported) and add:

```ts
import {
	canViewContent,
	contentVisibilityWhere,
	resolveViewerFollow,
	visibilitySchema,
} from "../lib/content-visibility";
import type { ContentVisibility } from "@still/db";
```

- [ ] **Step 2: Replace `isPublic` in the body types**

Change `CreateReviewBody` and `PatchReviewBody`: replace `isPublic?: boolean;` with `visibility?: ContentVisibility;`.

- [ ] **Step 3: Default new reviews from the account setting**

In the `POST /` handler, before the `db.insert(review)` call, resolve the default:

```ts
				let visibility = body.visibility ?? null;
				if (!visibility) {
					const [own] = await db
						.select({ d: profile.defaultVisibility })
						.from(profile)
						.where(eq(profile.userId, user.id))
						.limit(1);
					visibility = own?.d ?? "public";
				}
```

In the `.values({ ... })` object, replace `isPublic: body.isPublic ?? true,` with:

```ts
						visibility,
```

In the `body: t.Object({ ... })` schema, replace `isPublic: t.Optional(t.Boolean()),` with:

```ts
					visibility: t.Optional(visibilitySchema),
```

- [ ] **Step 4: Honor `visibility` on PATCH**

In the `PATCH /:id` handler `.set({ ... })`, replace `isPublic: body.isPublic ?? existing.isPublic,` with:

```ts
					visibility: body.visibility ?? existing.visibility,
```

and in its `body: t.Object({ ... })` replace `isPublic: t.Optional(t.Boolean()),` with `visibility: t.Optional(visibilitySchema),`.

- [ ] **Step 5: Enforce visibility on `GET /:id`**

In the `GET /:id` handler, after the `if (!row) return status(404, ...)` line and before computing `liked`, add:

```ts
				const author = row.review.userId;
				const follows = await resolveViewerFollow(user?.id ?? null, author);
				if (
					!canViewContent({
						viewerId: user?.id ?? null,
						authorId: author,
						visibility: row.review.visibility,
						...follows,
					})
				) {
					return status(404, "Not found");
				}
```

- [ ] **Step 6: Enforce on `GET /recent` and `GET /popular`**

`GET /recent` and `GET /popular` are public/anonymous list endpoints. They must use the viewer when present. Add `user` to each handler's destructured context (e.g. `async ({ query, user }) => {`).

In `GET /recent`, replace the `eq(review.isPublic, true)` condition inside the `.where(and(...))` with:

```ts
						contentVisibilityWhere(user?.id ?? null, review.userId, review.visibility),
```

In `GET /popular`, replace `.where(eq(review.isPublic, true))` with:

```ts
				.where(
					contentVisibilityWhere(user?.id ?? null, review.userId, review.visibility),
				)
```

- [ ] **Step 7: Type-check the server**

Run: `bun run --filter @still/server check-types` (or `cd apps/server && bunx tsc -b`)
Expected: PASS for `reviews.ts`. (Other routes still reference `review.isPublic`; they are fixed in Tasks 4–8 — type errors there are expected until then. If your type-checker is whole-program, do Tasks 4–8 before this step's full green.)

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/routes/reviews.ts
git commit -m "feat(reviews): visibility field + viewer-aware read enforcement"
```

---

## Task 4: Movies route — review list + count

**Files:**
- Modify: `apps/server/src/routes/movies.ts:~745-790`

- [ ] **Step 1: Import the fragment**

At the top of `apps/server/src/routes/movies.ts` add:

```ts
import { contentVisibilityWhere } from "../lib/content-visibility";
```

- [ ] **Step 2: Make the review handler viewer-aware**

Find the handler that returns movie reviews (the two `eq(review.isPublic, true)` sites near lines 753 and 785). Ensure the handler destructures `user` from context (`async ({ params, user, ... }) =>`).

Replace each occurrence of:

```ts
eq(review.isPublic, true)
```

with:

```ts
contentVisibilityWhere(user?.id ?? null, review.userId, review.visibility)
```

(Both the list query at ~753 and the count query at ~785. If they are combined inside an `and(eq(review.movieId, id), eq(review.isPublic, true))`, keep `eq(review.movieId, id)` and swap only the visibility term.)

- [ ] **Step 3: Type-check**

Run: `cd apps/server && bunx tsc -b`
Expected: no new errors in `movies.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/movies.ts
git commit -m "feat(movies): viewer-aware review visibility on detail page"
```

---

## Task 5: Profiles route — reviews + filmography log scores

**Files:**
- Modify: `apps/server/src/routes/profiles.ts:~740-750` (reviews) and the filmography/log-score query in the same file.

- [ ] **Step 1: Import the fragment**

At the top of `apps/server/src/routes/profiles.ts` add:

```ts
import { contentVisibilityWhere } from "../lib/content-visibility";
import { log, review } from "@still/db"; // add `log` if not already imported
```

- [ ] **Step 2: Enforce on the profile's reviews**

At line ~744, replace:

```ts
and(eq(review.userId, targetUserId), eq(review.isPublic, true))
```

with (the requesting user is `user` from context — owner sees all via the predicate's self-branch):

```ts
and(
	eq(review.userId, targetUserId),
	contentVisibilityWhere(user?.id ?? null, review.userId, review.visibility),
)
```

- [ ] **Step 3: Enforce on filmography log scores**

Find the query that returns the target user's `log` rows for filmography poster captions (`patronLogPosterCaption`). Add the visibility fragment to its WHERE, e.g.:

```ts
.where(
	and(
		eq(log.userId, targetUserId),
		contentVisibilityWhere(user?.id ?? null, log.userId, log.visibility),
	),
)
```

When viewing **your own** profile (`user?.id === targetUserId`), the predicate's self-branch returns everything — no special-casing needed.

- [ ] **Step 4: Type-check**

Run: `cd apps/server && bunx tsc -b`
Expected: no new errors in `profiles.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/profiles.ts
git commit -m "feat(profiles): viewer-aware review + diary-score visibility"
```

---

## Task 6: Feed route — review rows + rating divergence

**Files:**
- Modify: `apps/server/src/routes/feed.ts:~80-180`
- Modify: `apps/server/src/lib/feed-rating-divergence.ts` (if it queries logs directly)

- [ ] **Step 1: Import the fragment**

At the top of `apps/server/src/routes/feed.ts` add:

```ts
import { contentVisibilityWhere } from "../lib/content-visibility";
```

- [ ] **Step 2: Swap both review filters**

The feed handler already has the viewer (`user`) since `GET /api/feed` is signed-in only. Replace each of the two `eq(review.isPublic, true)` (lines ~83 and ~176) with:

```ts
contentVisibilityWhere(user.id, review.userId, review.visibility)
```

- [ ] **Step 3: Gate divergence rows by log visibility**

In `apps/server/src/lib/feed-rating-divergence.ts`, locate the query selecting the two patrons' `log` rows. Add `log` visibility filtering with the viewer id threaded in (add a `viewerId` parameter to the function if needed and pass `user.id` from the route). In the log query WHERE add:

```ts
contentVisibilityWhere(viewerId, log.userId, log.visibility)
```

If the function currently takes no viewer id, add `viewerId: string` as a parameter and update its single caller in `feed.ts` to pass `user.id`.

- [ ] **Step 4: Type-check + run divergence test**

Run: `cd apps/server && bunx tsc -b`
Run: `bun test apps/server/src/lib/feed-rating-divergence.test.ts`
Expected: type-check passes; existing divergence test still passes (its pure helper is unchanged — only the DB query gained a filter).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/feed.ts apps/server/src/lib/feed-rating-divergence.ts
git commit -m "feat(feed): viewer-aware visibility for review + divergence rows"
```

---

## Task 7: Following-ratings / friends-ratings + ledger drawer

**Files:**
- Modify: `apps/server/src/lib/movie-following-ratings.ts`, `apps/server/src/lib/friends-ratings.ts`
- Modify: the route(s) that build the `PatronWatchLedgerDrawer` "who logged this" data (search for the ledger query).

- [ ] **Step 1: Import the fragment in each lib**

Add to `movie-following-ratings.ts` and `friends-ratings.ts`:

```ts
import { contentVisibilityWhere } from "./content-visibility";
```

- [ ] **Step 2: Filter the log query by visibility**

In each function that selects other patrons' `log` rows (e.g. `fetchFollowingRatingsForMovie`, `fetchFollowingRatingsForTv`, and the friends-ratings equivalent), thread the viewer id (these already receive the viewer's user id as an argument — confirm the param name, commonly `viewerId`/`userId`). Add to the log query WHERE:

```ts
contentVisibilityWhere(viewerId, log.userId, log.visibility)
```

These rows are already limited to people the viewer follows, so a `followers`-tier log shows correctly; a `friends`-tier log shows only when mutual; a `private` log never shows.

- [ ] **Step 3: Filter the ledger drawer**

Find the query backing `PatronWatchLedgerDrawer` (the attributed list of who logged a title behind Film/TV rank counts). Add the viewer id and the same `contentVisibilityWhere(viewerId, log.userId, log.visibility)` term to its WHERE. The numeric **rank ordering / count** stays unfiltered (aggregate) — only the attributed who-logged list is gated.

- [ ] **Step 4: Type-check + run the following-ratings test**

Run: `cd apps/server && bunx tsc -b`
Run: `bun test apps/server/src/lib/movie-following-ratings.test.ts`
Expected: passes (the pure `pickLatestFollowingRatingsPerPatron` is untouched; only the DB query gained a filter).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/movie-following-ratings.ts apps/server/src/lib/friends-ratings.ts
git commit -m "feat(social): viewer-aware diary-log visibility in following ratings + ledger"
```

---

## Task 8: Creator-recognition & pinned reviews stay public-only

**Files:**
- Modify: `apps/server/src/lib/creator-recognition.ts:109,160`
- Modify: `apps/server/src/lib/profile-pinned-reviews.ts:47,78`
- Modify: the pin-write handler (`PATCH /api/profiles/me/pins` in `apps/server/src/routes/profiles.ts`)

- [ ] **Step 1: Swap the boolean for the enum in creator-recognition**

In `apps/server/src/lib/creator-recognition.ts`, replace both `eq(review.isPublic, true)` (lines ~109 and ~160) with:

```ts
eq(review.visibility, "public")
```

(Intentional: Community ranking and curator spotlights only surface fully public reviews — restricted reviews never feed recognition.)

- [ ] **Step 2: Swap the boolean in pinned-reviews reads**

In `apps/server/src/lib/profile-pinned-reviews.ts`, replace both `eq(review.isPublic, true)` (lines ~47 and ~78) with:

```ts
eq(review.visibility, "public")
```

- [ ] **Step 3: Reject pinning a non-public review at write time**

In the pin handler in `apps/server/src/routes/profiles.ts` (`PATCH /me/pins`), before persisting `pinned_review_ids`, validate that every submitted review id belongs to the user **and** is public:

```ts
				const pinnable = await db
					.select({ id: review.id })
					.from(review)
					.where(
						and(
							eq(review.userId, user.id),
							eq(review.visibility, "public"),
							inArray(review.id, requestedPinIds),
						),
					);
				const pinnableIds = new Set(pinnable.map((r) => r.id));
				const cleanedPins = requestedPinIds.filter((id) => pinnableIds.has(id));
```

Persist `cleanedPins` instead of the raw input. Ensure `inArray` is imported from `drizzle-orm`. If `requestedPinIds` is empty, skip the query and persist `[]`.

- [ ] **Step 4: Type-check**

Run: `cd apps/server && bunx tsc -b`
Expected: PASS — **no `review.isPublic` references remain anywhere in `apps/server`.** (Grep to confirm: `git grep -n "isPublic" apps/server/src` should return nothing review-related.)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/creator-recognition.ts apps/server/src/lib/profile-pinned-reviews.ts apps/server/src/routes/profiles.ts
git commit -m "feat(community): keep recognition + pinned reviews public-only"
```

---

## Task 9: Logs route — visibility field + account default

**Files:**
- Modify: `apps/server/src/routes/logs.ts:28-77` (schemas/types) and the `POST /` + `PATCH /:id` handlers.

- [ ] **Step 1: Import the helpers**

At the top of `apps/server/src/routes/logs.ts` add:

```ts
import { visibilitySchema } from "../lib/content-visibility";
import type { ContentVisibility } from "@still/db";
import { profile } from "@still/db"; // add to existing @still/db import if missing
```

- [ ] **Step 2: Add `visibility` to the typebox fields and body types**

In `logCreateFields`, add:

```ts
	/** Who can see this diary entry. Defaults to the account default. */
	visibility: t.Optional(visibilitySchema),
```

Add `visibility?: ContentVisibility;` to both `LogCreateBody` and `LogPatchBody`.

- [ ] **Step 3: Default new logs from the account setting**

In the `POST /` handler, before `db.insert(log).values({...})`, add:

```ts
				let visibility = body.visibility ?? null;
				if (!visibility) {
					const [own] = await db
						.select({ d: profile.defaultVisibility })
						.from(profile)
						.where(eq(profile.userId, user.id))
						.limit(1);
					visibility = own?.d ?? "public";
				}
```

In the `.values({ ... })` object add:

```ts
					visibility,
```

- [ ] **Step 4: Honor visibility on PATCH**

In `PATCH /:id`, where the update `.set({...})` is built, add (only when provided):

```ts
					...(body.visibility ? { visibility: body.visibility } : {}),
```

and add `visibility: t.Optional(visibilitySchema),` to that handler's `body` typebox object.

- [ ] **Step 5: Type-check**

Run: `cd apps/server && bunx tsc -b`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/logs.ts
git commit -m "feat(logs): per-log visibility field with account default"
```

---

## Task 10: Web — reusable visibility picker + review composer

**Files:**
- Create: `apps/web/src/components/review/visibility-select.tsx`
- Modify: `apps/web/src/components/review/review-composer.tsx`

- [ ] **Step 1: Build the reusable picker**

Create `apps/web/src/components/review/visibility-select.tsx`:

```tsx
"use client";

import {
	StillPopoverSelect,
	type StillPopoverSelectOption,
} from "@/components/ui/still-popover-select";

export type ContentVisibility = "public" | "followers" | "friends" | "private";

const VISIBILITY_OPTIONS: StillPopoverSelectOption[] = [
	{ value: "public", label: "Public — anyone" },
	{ value: "followers", label: "Followers — people who follow you" },
	{ value: "friends", label: "Friends — only people you follow back" },
	{ value: "private", label: "Private — only you" },
];

export function VisibilitySelect({
	id,
	value,
	onChange,
	disabled,
	popoverPositionerClassName,
	popoverSide = "top",
}: {
	id: string;
	value: ContentVisibility;
	onChange: (next: ContentVisibility) => void;
	disabled?: boolean;
	popoverPositionerClassName?: string;
	popoverSide?: "top" | "bottom" | "left" | "right";
}) {
	return (
		<StillPopoverSelect
			id={id}
			value={value}
			onChange={(next) => onChange(next as ContentVisibility)}
			options={VISIBILITY_OPTIONS}
			placeholder="Who can see this"
			listAriaLabel="Choose who can see this"
			disabled={disabled}
			popoverPositionerClassName={popoverPositionerClassName}
			popoverSide={popoverSide}
		/>
	);
}
```

- [ ] **Step 2: Wire it into the review composer**

In `apps/web/src/components/review/review-composer.tsx`:

Add the import:

```tsx
import {
	type ContentVisibility,
	VisibilitySelect,
} from "@/components/review/visibility-select";
```

Add state near the other composer state (default seeded from a `defaultVisibility` prop if the composer receives one, else `"public"`):

```tsx
	const [visibility, setVisibility] = useState<ContentVisibility>(
		props.defaultVisibility ?? "public",
	);
```

Render the picker in the composer footer/controls row (next to spoilers/rating controls), wrapping with a small label:

```tsx
				<label className="flex flex-col gap-1.5 text-sm" htmlFor="review-visibility">
					<span className="text-muted-foreground">Who can see this</span>
					<VisibilitySelect
						id="review-visibility"
						value={visibility}
						onChange={setVisibility}
						popoverPositionerClassName={APP_MODAL_POPOVER_POSITIONER_CLASS}
					/>
				</label>
```

Include `visibility` in the `POST /api/reviews` (and `PATCH`) request body. Find the existing submit call and add `visibility` to the JSON body. (Confirm whether the composer uses `api.api.reviews.post(...)` or a `fetch(stillApiOrigin()...)`; add the field to whichever body object is sent.)

- [ ] **Step 3: Lint/build the web app**

Run: `cd apps/web && rm -rf .next && bun run build`
Expected: build succeeds. (Stale `.next` route types can false-positive — the README/AGENTS note says delete `.next` first.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/review/visibility-select.tsx apps/web/src/components/review/review-composer.tsx
git commit -m "feat(web): visibility picker in review composer"
```

---

## Task 11: Web — Quick Log visibility picker

**Files:**
- Modify: the Quick Log composer component (the one rendering venue/rewatch `SegmentedPillToolbar` and `StillPopoverSelect` scope pickers — locate via `git grep -l "SegmentedPillToolbar" apps/web/src/components` and pick the Quick Log diary composer).

- [ ] **Step 1: Add visibility state**

In the Quick Log composer, add:

```tsx
import {
	type ContentVisibility,
	VisibilitySelect,
} from "@/components/review/visibility-select";
```

```tsx
	const [visibility, setVisibility] = useState<ContentVisibility>(
		initialLog?.visibility ?? defaultVisibility ?? "public",
	);
```

(`initialLog?.visibility` for edit mode; `defaultVisibility` prop sourced from the signed-in profile if available; else `"public"`.)

- [ ] **Step 2: Render the picker**

Place it near the venue toolbar, mirroring Step 2 of Task 10:

```tsx
				<label className="flex flex-col gap-1.5 text-sm" htmlFor="log-visibility">
					<span className="text-muted-foreground">Who can see this</span>
					<VisibilitySelect
						id="log-visibility"
						value={visibility}
						onChange={setVisibility}
						popoverPositionerClassName={APP_MODAL_POPOVER_POSITIONER_CLASS}
					/>
				</label>
```

- [ ] **Step 3: Send `visibility` in create + edit requests**

Add `visibility` to the `POST /api/logs` and `PATCH /api/logs/:id` request bodies in the composer's submit handlers.

- [ ] **Step 4: Build**

Run: `cd apps/web && rm -rf .next && bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/<quick-log-composer-path>
git commit -m "feat(web): visibility picker in Quick Log composer"
```

---

## Task 12: Web — account default-visibility setting

**Files:**
- Modify: `apps/server/src/routes/profiles.ts` (the `PATCH /api/profiles/me` settings update)
- Modify: the Settings page/component (locate via `git grep -l "Settings" apps/web/src/app/(app)` / the existing settings rows like the theme picker).

- [ ] **Step 1: Accept `defaultVisibility` in the profile-update route**

In the `PATCH /me` (profile settings) handler in `apps/server/src/routes/profiles.ts`, add `defaultVisibility` to the typebox body (`visibility` reused) and to the `.set({...})`:

```ts
					...(body.defaultVisibility
						? { defaultVisibility: body.defaultVisibility }
						: {}),
```

Body schema: add `defaultVisibility: t.Optional(visibilitySchema),` (import `visibilitySchema` from `../lib/content-visibility`).

- [ ] **Step 2: Surface the current default to the web**

Ensure the profile/me GET that the settings page reads returns `defaultVisibility` (add it to the selected columns if the route uses an explicit `select`).

- [ ] **Step 3: Add the settings row**

In the settings component, add a row using the same `VisibilitySelect`, labeled "Default visibility for new posts", bound to the current `defaultVisibility` and persisting via `PATCH /api/profiles/me` on change (optimistic update like the existing theme/setting rows).

```tsx
			<SettingRow label="Default visibility for new posts">
				<VisibilitySelect
					id="default-visibility"
					value={defaultVisibility}
					onChange={(next) => {
						setDefaultVisibility(next);
						void saveDefaultVisibility(next); // PATCH /api/profiles/me
					}}
					popoverSide="bottom"
				/>
			</SettingRow>
```

(Use whatever the existing settings-row wrapper is named; match the surrounding rows.)

- [ ] **Step 4: Build + type-check**

Run: `cd apps/server && bunx tsc -b` then `cd apps/web && rm -rf .next && bun run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/profiles.ts apps/web/src/app/<settings-path>
git commit -m "feat(settings): account default visibility for new posts"
```

---

## Task 13: Web — author reader affordance chip

**Files:**
- Modify: `apps/web/src/components/review/review-card.tsx` and/or `review-detail-sheet.tsx`; the diary log row component.

- [ ] **Step 1: Render a visibility chip when the viewer is the author and tier ≠ public**

In the review card/detail and the diary log row, when the current user owns the item and `visibility !== "public"`, render a small muted chip:

```tsx
{isOwner && visibility !== "public" ? (
	<span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
		<VisibilityGlyph visibility={visibility} />
		{visibility === "private"
			? "Only you"
			: visibility === "friends"
				? "Friends"
				: "Followers"}
	</span>
) : null}
```

Use an existing Nucleo lock/people icon for `VisibilityGlyph` (pick from `packages/ui/src/icons` — a lock for `private`, people for `friends`/`followers`). This is display-only; no API change.

- [ ] **Step 2: Build**

Run: `cd apps/web && rm -rf .next && bun run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/review/review-card.tsx apps/web/src/components/review/review-detail-sheet.tsx
git commit -m "feat(web): author-only visibility chip on reviews + logs"
```

---

## Task 14: Migrate the database & manual verification

**Files:** none (operational)

- [ ] **Step 1: Apply the migration**

Run: `cd packages/db && bun run db:migrate`
Expected: "Migrations finished successfully." (Requires `DATABASE_URL` in `apps/server/.env` pointing at the **direct** Postgres host per the note in `migrate.ts`.)

- [ ] **Step 2: Verify backfill**

Run a quick check (psql or studio): every existing `review.visibility` is `public` (or `private` where `is_public` was false), every `log.visibility` is `public`, every `profile.default_visibility` is `public`.

- [ ] **Step 3: Manual smoke test (two accounts)**

With accounts A (author) and B (viewer):
- A creates a `friends`-only review. B (not following / one-way follower) gets **404** on `GET /api/reviews/:id`; B does not see it on A's profile or movie detail.
- A and B mutually follow → B now sees it.
- A sets a log to `private` → it disappears from B's "people you follow" row on that movie, but the movie's aggregate log **count is unchanged**.
- A's own diary, badges, and streak still include the private log.

- [ ] **Step 4: Run the full server test suite**

Run: `bun test apps/server`
Expected: all green (new `content-visibility.test.ts` plus untouched existing tests).

- [ ] **Step 5: Commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore: verification fixes for content visibility"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** enum + columns (T1), shared predicate + attributed/aggregate rule (T2), all attributed read paths — reviews (T3), movie detail (T4), profile reviews + filmography (T5), feed + divergence (T6), following-ratings + ledger (T7) — public-only recognition/pins (T8), log visibility + account default (T9, T12), UI pickers (T10–T11), reader affordance (T13), migration + verification (T14). All spec sections map to a task.
- **Aggregates untouched:** confirmed no task modifies title counts, averages, rank ordering, badges, streaks, or taste-signature queries — only attributed surfaces gain the predicate.
- **Type consistency:** `ContentVisibility` (db) and the web-local `ContentVisibility` union share identical members; `visibilitySchema` (typebox) and `VISIBILITY_OPTIONS` share identical values; `contentVisibilityWhere(viewerId, authorCol, visibilityCol)` and `canViewContent({...})` signatures are referenced consistently across T3–T9.
- **Placeholder scan:** read-path tasks reference real line numbers from the current grep; where a swap is mechanical (`eq(review.isPublic, true)` → fragment) the exact before/after is given.
