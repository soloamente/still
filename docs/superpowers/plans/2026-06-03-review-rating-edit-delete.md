# Review rating precision, log sync, and owner edit/delete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix review scores rounding away diary precision (8.7 → 9.0), keep linked review ratings in sync with logs, and add edit/delete for review owners in the review detail sheet only.

**Architecture:** Migrate `review.rating` to the same tenths storage as `log.rating` (0–100), copy verbatim on publish, sync on log PATCH. Web uses existing `formatStoredLogRatingDisplay`; composer gains edit mode (PATCH) and detail sheet gains delete confirm + edit entry. Server DELETE cleans pins, reactions, and comments.

**Tech Stack:** Postgres migration (hand-written SQL), Drizzle/Elysia (`apps/server`), Next.js App Router + Eden client (`apps/web`), Bun test runner.

**Design spec:** `docs/superpowers/specs/2026-06-03-review-rating-edit-delete-design.md`

---

## File map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/db/src/migrations/0017_review_rating_tenths_backfill.sql` | Backfill review ratings from logs / legacy scale |
| Modify | `packages/db/src/migrations/meta/_journal.json` | Register migration `0017` |
| Create | `apps/server/src/lib/review-rating.ts` | Shared tenths validation + display-scale SQL fragment |
| Create | `apps/server/src/lib/review-rating.test.ts` | Unit tests for rating helpers |
| Create | `apps/server/src/lib/sync-linked-review-rating.ts` | Update reviews when log rating changes |
| Modify | `apps/server/src/routes/reviews.ts` | Tenths API, pin/comment/reaction cleanup on delete, PATCH rating guard |
| Modify | `apps/server/src/routes/logs.ts` | Call sync after log rating PATCH |
| Modify | `apps/server/src/routes/movies.ts` | Display-scale `avg(review.rating)` |
| Modify | `apps/server/src/lib/profile-pinned-reviews.ts` | `removePinnedReviewId` helper |
| Create | `apps/web/src/lib/log-rating.test.ts` | Web rating conversion tests |
| Modify | `apps/web/src/lib/log-rating.ts` | Remove rounded `diaryStoredToReviewApiRating` from publish path |
| Modify | `apps/web/src/components/review/review-composer.tsx` | Edit mode + tenths POST/PATCH |
| Modify | `apps/web/src/components/review/review-detail-sheet.tsx` | Display fix, Edit/Delete footer |
| Create | `apps/web/src/components/review/review-delete-confirm-dialog.tsx` | Delete confirm (Quick Log pattern) |

---

## Task 1: Migration — backfill `review.rating` to tenths

**Files:**
- Create: `packages/db/src/migrations/0017_review_rating_tenths_backfill.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Add SQL migration**

Create `packages/db/src/migrations/0017_review_rating_tenths_backfill.sql`:

```sql
-- Align review.rating with log.rating tenths (0–100). Legacy whole 1–10 → ×10.

UPDATE "review" AS r
SET "rating" = l."rating"
FROM "log" AS l
WHERE r."log_id" = l."id"
  AND l."rating" IS NOT NULL;

UPDATE "review"
SET "rating" = "rating" * 10
WHERE "log_id" IS NULL
  AND "rating" IS NOT NULL
  AND "rating" BETWEEN 1 AND 10;
```

- [ ] **Step 2: Register in journal**

Append to `packages/db/src/migrations/meta/_journal.json` `entries`:

```json
{
  "idx": 17,
  "version": "7",
  "when": 1779201300000,
  "tag": "0017_review_rating_tenths_backfill",
  "breakpoints": true
}
```

- [ ] **Step 3: Apply locally**

```bash
cd packages/db && bun run migrate
```

Expected: migration applies without error.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/migrations/0017_review_rating_tenths_backfill.sql packages/db/src/migrations/meta/_journal.json
git commit -m "chore(db): backfill review ratings to tenths scale"
```

---

## Task 2: Server rating helpers

**Files:**
- Create: `apps/server/src/lib/review-rating.ts`
- Create: `apps/server/src/lib/review-rating.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/lib/review-rating.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
	isValidReviewRatingStored,
	reviewRatingToDisplay,
} from "./review-rating";

describe("reviewRatingToDisplay", () => {
	test("tenths", () => {
		expect(reviewRatingToDisplay(87)).toBe(8.7);
	});
	test("legacy whole", () => {
		expect(reviewRatingToDisplay(9)).toBe(9);
	});
});

describe("isValidReviewRatingStored", () => {
	test("accepts tenths", () => {
		expect(isValidReviewRatingStored(87)).toBe(true);
	});
	test("rejects out of range", () => {
		expect(isValidReviewRatingStored(101)).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests (fail)**

```bash
cd apps/server && bun test src/lib/review-rating.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `apps/server/src/lib/review-rating.ts`:

```ts
/** Matches web `logRatingToDisplay` — tenths or legacy 1–10 whole. */
export function reviewRatingToDisplay(stored: number): number {
	if (stored > 10) return stored / 10;
	return stored;
}

export function isValidReviewRatingStored(stored: number): boolean {
	return Number.isInteger(stored) && stored >= 0 && stored <= 100;
}

/** SQL expression: average review rating on 0–10 display scale. */
export function reviewRatingDisplayAvgSql(column: string): string {
	return `avg(CASE WHEN ${column} > 10 THEN ${column}::float / 10 ELSE ${column} END)`;
}
```

- [ ] **Step 4: Run tests (pass)**

```bash
cd apps/server && bun test src/lib/review-rating.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/review-rating.ts apps/server/src/lib/review-rating.test.ts
git commit -m "feat(server): review rating tenths helpers"
```

---

## Task 3: Sync linked review rating on log PATCH

**Files:**
- Create: `apps/server/src/lib/sync-linked-review-rating.ts`
- Modify: `apps/server/src/routes/logs.ts`

- [ ] **Step 1: Implement sync helper**

Create `apps/server/src/lib/sync-linked-review-rating.ts`:

```ts
import { db, review } from "@still/db";
import { eq } from "drizzle-orm";

/** Keep denormalized review.rating aligned when patron edits diary score (decision C). */
export async function syncLinkedReviewRatingFromLog(
	logId: string,
	rating: number | null,
): Promise<void> {
	await db
		.update(review)
		.set({ rating })
		.where(eq(review.logId, logId));
}
```

- [ ] **Step 2: Call from log PATCH**

In `apps/server/src/routes/logs.ts`, import `syncLinkedReviewRatingFromLog`.

After successful `db.update(log)...returning()` (PATCH handler), when `body.rating !== undefined`:

```ts
if (updated && body.rating !== undefined) {
	await syncLinkedReviewRatingFromLog(
		updated.id,
		updated.rating ?? null,
	);
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/server && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/sync-linked-review-rating.ts apps/server/src/routes/logs.ts
git commit -m "feat(server): sync review rating when diary log rating changes"
```

---

## Task 4: Reviews route — tenths API, publish copy, PATCH guard, DELETE cleanup

**Files:**
- Modify: `apps/server/src/routes/reviews.ts`
- Modify: `apps/server/src/lib/profile-pinned-reviews.ts`

- [ ] **Step 1: Add pin removal helper**

In `apps/server/src/lib/profile-pinned-reviews.ts`, add:

```ts
import { profile } from "@still/db";

export function removePinnedReviewId(
	rawIds: unknown,
	reviewId: string,
): string[] {
	return normalizePinnedReviewIds(rawIds).filter((id) => id !== reviewId);
}
```

- [ ] **Step 2: Update POST handler — no rounding**

In `apps/server/src/routes/reviews.ts`:

1. Delete local `diaryStoredToReviewApiRating` (lines 36–42).
2. When resolving rating from linked log, assign directly: `rating = linkedLog?.rating ?? null` (same for latest log path).
3. Change body schema `rating` to:

```ts
rating: t.Optional(
	t.Union([t.Integer({ minimum: 0, maximum: 100 }), t.Null()]),
),
```

4. If `body.rating` provided, validate with `isValidReviewRatingStored` or allow `null` to clear.

- [ ] **Step 3: PATCH — ignore rating when `logId` set**

In PATCH handler, before `db.update`:

```ts
const nextRating =
	existing.logId != null
		? existing.rating
		: body.rating !== undefined
			? body.rating
			: existing.rating;
```

Use `nextRating` in `.set({ rating: nextRating, ... })`.

Update PATCH body schema to same `0–100` union as POST.

- [ ] **Step 4: DELETE — pins, reactions, comments**

In DELETE handler, before `db.delete(review)`:

```ts
import { comment, profile, reaction } from "@still/db";
import { removePinnedReviewId } from "../lib/profile-pinned-reviews";

// … inside handler after ownership check:
const [prof] = await db
	.select({ pinnedReviewIds: profile.pinnedReviewIds })
	.from(profile)
	.where(eq(profile.userId, user.id))
	.limit(1);
if (prof) {
	const next = removePinnedReviewId(prof.pinnedReviewIds, params.id);
	await db
		.update(profile)
		.set({ pinnedReviewIds: next })
		.where(eq(profile.userId, user.id));
}

await db
	.delete(reaction)
	.where(
		and(
			eq(reaction.parentType, "review"),
			eq(reaction.parentId, params.id),
		),
	);
await db
	.delete(comment)
	.where(
		and(
			eq(comment.parentType, "review"),
			eq(comment.parentId, params.id),
		),
	);
```

Then existing `db.delete(review)`.

- [ ] **Step 5: Typecheck**

```bash
cd apps/server && bun run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/reviews.ts apps/server/src/lib/profile-pinned-reviews.ts
git commit -m "feat(server): review tenths API, log-linked PATCH guard, delete cleanup"
```

---

## Task 5: Movie community average — display-scale SQL

**Files:**
- Modify: `apps/server/src/routes/movies.ts`

- [ ] **Step 1: Fix aggregate**

Import `reviewRatingDisplayAvgSql` from `../lib/review-rating`.

Replace:

```ts
avgRating: sql<number>`avg(${review.rating})`.as("avgRating"),
```

With:

```ts
avgRating: sql<number>`${sql.raw(reviewRatingDisplayAvgSql("review.rating"))}`.as(
	"avgRating",
),
```

(If `sql.raw` is awkward, inline the `CASE WHEN review.rating > 10 …` expression directly in the template literal.)

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/server && bun run typecheck
git add apps/server/src/routes/movies.ts
git commit -m "fix(server): community avg uses display-scale review ratings"
```

---

## Task 6: Web rating tests + composer publish fix

**Files:**
- Create: `apps/web/src/lib/log-rating.test.ts`
- Modify: `apps/web/src/lib/log-rating.ts`
- Modify: `apps/web/src/components/review/review-composer.tsx`

- [ ] **Step 1: Add web tests**

Create `apps/web/src/lib/log-rating.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
	logRatingToDisplay,
	logRatingToStored,
} from "./log-rating";

describe("logRatingToStored", () => {
	test("8.7 → 87", () => {
		expect(logRatingToStored(8.7)).toBe(87);
	});
});

describe("logRatingToDisplay", () => {
	test("87 → 8.7", () => {
		expect(logRatingToDisplay(87)).toBe(8.7);
	});
});
```

Run:

```bash
cd apps/web && bun test src/lib/log-rating.test.ts
```

- [ ] **Step 2: Stop rounding on publish**

In `review-composer.tsx` `submit()`:

Replace `diaryStoredToReviewApiRating` branch with:

```ts
const rating = usesDiaryRating
	? (args.diaryRatingStored ?? undefined)
	: logRatingToStored(ratingDisplay) ?? undefined;
```

Remove import of `diaryStoredToReviewApiRating`.

Optionally delete `diaryStoredToReviewApiRating` from `log-rating.ts` if no other references (grep first).

- [ ] **Step 3: Run web tests + commit**

```bash
cd apps/web && bun test src/lib/log-rating.test.ts
git add apps/web/src/lib/log-rating.test.ts apps/web/src/lib/log-rating.ts apps/web/src/components/review/review-composer.tsx
git commit -m "fix(web): publish review rating as diary tenths without rounding"
```

---

## Task 7: Review composer — edit mode

**Files:**
- Modify: `apps/web/src/components/review/review-composer.tsx`
- Modify: `apps/web/src/components/review/review-detail-sheet.tsx` (wire Edit button — partial; full footer in Task 8)

- [ ] **Step 1: Extend `ComposerArgs`**

```ts
type ComposerArgs = {
	movieId: number;
	movieTitle: string;
	posterUrl?: string | null;
	averageRating?: number | null;
	reviewId?: string;
	diaryLogId?: string;
	diaryRatingStored?: number | null;
	/** Edit mode seed — avoids extra fetch when opening from detail sheet. */
	initialTitle?: string | null;
	initialBody?: string;
	initialContainsSpoilers?: boolean;
	initialVisibility?: ContentVisibility;
};
```

- [ ] **Step 2: Prefill on open**

In the `useEffect` that runs when `isOpen && args`, also set:

```ts
if (args.reviewId) {
	setTitle(args.initialTitle ?? "");
	setBody(args.initialBody ?? "");
	setContainsSpoilers(args.initialContainsSpoilers ?? false);
	setVisibility(args.initialVisibility ?? "public");
	setVisibilityTouched(true);
}
```

- [ ] **Step 3: Submit PATCH when `args.reviewId`**

```ts
const isEdit = Boolean(args.reviewId);

if (isEdit) {
	await api.api.reviews({ id: args.reviewId! }).patch({
		title: title.trim() || undefined,
		body: body.trim(),
		containsSpoilers,
		...(visibilityTouched ? { visibility } : {}),
		// Omit rating when usesDiaryRating (log-linked)
		...(!usesDiaryRating
			? { rating: logRatingToStored(ratingDisplay) ?? undefined }
			: {}),
	});
	toast.success("Review updated");
} else {
	await api.api.reviews.post({ /* existing fields + rating tenths */ });
	toast.success("Review published");
}
```

- [ ] **Step 4: Copy strings**

- Compose step title: `args.reviewId ? "Edit your review" : "Share your review"`
- Publish button on spoiler step: `isEdit ? "Save changes" : "Publish"`

- [ ] **Step 5: Detail sheet — Edit opens composer**

In `review-detail-sheet.tsx`, import `useReviewComposer`, add handler:

```ts
const openComposer = useReviewComposer((s) => s.open);

function handleEdit() {
	if (!detail?.review || !detail.movie) return;
	openComposer({
		reviewId: detail.review.id,
		movieId: detail.review.movieId,
		movieTitle: detail.movie.title,
		posterUrl: detail.movie.posterPath,
		diaryLogId: undefined, // fetch log id from GET payload if API returns it — extend GET to include logId on review object (already on row)
		diaryRatingStored: detail.review.rating,
		initialTitle: detail.review.title,
		initialBody: detail.review.body,
		initialContainsSpoilers: detail.review.containsSpoilers,
		initialVisibility: detail.review.visibility,
	});
	handleClose();
}
```

Ensure `ReviewDetailPayload.review` includes `logId` — add to type and use `diaryLogId: detail.review.logId ?? undefined` so composer knows linked state.

- [ ] **Step 6: Typecheck web**

```bash
cd apps/web && bun run check-types
```

Delete stale `.next` if `RouteImpl` errors per AGENTS.md.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/review/review-composer.tsx apps/web/src/components/review/review-detail-sheet.tsx
git commit -m "feat(web): review composer edit mode via PATCH"
```

---

## Task 8: Review detail — display fix, Delete confirm, owner footer

**Files:**
- Create: `apps/web/src/components/review/review-delete-confirm-dialog.tsx`
- Modify: `apps/web/src/components/review/review-detail-sheet.tsx`

- [ ] **Step 1: Fix score display**

In `review-detail-sheet.tsx`, replace:

```ts
import { formatLogRatingDisplay } from "@/lib/log-rating";
// …
{formatLogRatingDisplay(displayRating)}
```

With:

```ts
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";
// …
{displayRating != null ? formatStoredLogRatingDisplay(displayRating) : null}
```

Guard null — do not render `/10` block when label is null.

- [ ] **Step 2: Create delete confirm dialog**

Create `review-delete-confirm-dialog.tsx` by adapting `quick-log-remove-confirm-dialog.tsx`:

- Title: **Delete this review?**
- Description: **This can't be undone.**
- Confirm label: **Delete** (destructive ghost)
- Cancel: primary pill **Keep review**
- Same `z-[250]` overlay class as Quick Log remove confirm

- [ ] **Step 3: Owner footer layout**

When `isReviewOwner && review`:

```tsx
<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
  <Button variant="ghost" … onClick={() => setDeleteOpen(true)} className="text-destructive">
    Delete
  </Button>
  <div className="flex items-center gap-3">
    <ReviewPinToProfileButton … />
    <Button variant="secondary" size="pill" onClick={handleEdit}>Edit</Button>
    <Button variant="default" size="pill" onClick={handleClose}>Done</Button>
  </div>
</footer>
```

- [ ] **Step 4: Wire delete**

```ts
const [deleteOpen, setDeleteOpen] = useState(false);
const [deleting, setDeleting] = useState(false);
const router = useRouter();

async function handleConfirmDelete() {
	if (!review) return;
	setDeleting(true);
	try {
		await api.api.reviews({ id: review.id }).delete();
		toast.success("Review deleted");
		setDeleteOpen(false);
		handleClose();
		router.refresh();
	} catch (err) {
		console.error(err);
		toast.error("Couldn't delete — try again");
	} finally {
		setDeleting(false);
	}
}
```

Render `<ReviewDeleteConfirmDialog open={deleteOpen} deleting={deleting} onCancel=… onConfirm=… />`.

- [ ] **Step 5: Manual smoke**

1. Log 8.7 → publish review → reader shows **8.7**.
2. Edit log to 9.2 → reopen review → **9.2**.
3. Edit review body → save.
4. Delete review → confirm → gone.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/review/review-delete-confirm-dialog.tsx apps/web/src/components/review/review-detail-sheet.tsx
git commit -m "feat(web): review detail edit/delete for owners"
```

---

## Task 9: Graphify + scratchpad

- [ ] **Step 1: Update knowledge graph**

```bash
graphify update .
```

- [ ] **Step 2: Note in `.cursor/scratchpad.md`**

Under Executor progress: review rating tenths + detail sheet edit/delete shipped; link plan path.

---

## Plan self-review (vs spec)

| Spec requirement | Task |
|------------------|------|
| Tenths storage + backfill | Task 1 |
| No rounding on publish | Task 4, 6 |
| Log PATCH sync | Task 3 |
| PATCH ignores rating when linked | Task 4 |
| `formatStoredLogRatingDisplay` in reader | Task 8 |
| Community avg display scale | Task 5 |
| Edit/delete sheet only | Task 7, 8 |
| Pin cleanup on delete | Task 4 |
| Comment/reaction cleanup | Task 4 |
| Tests | Task 2, 6 |

No placeholders remain. Single PR scope.

---

## Manual test checklist (human)

- [ ] 8.7 diary → review shows 8.7 after publish (not 9.0)
- [ ] Change log rating → review score updates
- [ ] Edit review text from detail sheet
- [ ] Delete review with confirm; pinned review removed from profile strip
- [ ] Non-owner does not see Delete/Edit
