# Community Activity Feed Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Community Activity tab ordering and timestamps so every row uses one relative clock, list edits stop bumping rows incorrectly, and infinite scroll stays monotonic.

**Architecture:** Extend `feed-items.ts` with shared sort/cursor helpers; update `GET /api/feed` to compute list `at` from `max(createdAt, latest list_item.addedAt)`, accept composite cursor `(before, beforeKind, beforeId)`, and skip divergence on paginated requests. Web uses `sortActivityItems` after each page merge and unified bylines from `item.at`.

**Tech Stack:** Elysia + Drizzle (server), Next.js App Router + React, `bun:test`, Biome.

**Spec:** `docs/superpowers/specs/2026-06-07-community-activity-feed-ordering-design.md`

---

## Canonical types (used across tasks)

```ts
// apps/server/src/lib/feed-items.ts & mirrored in apps/web/src/lib/home-community-activity.ts
export type FeedActivityKind = "log" | "review" | "list" | "divergence";

export type FeedSortRow = {
	kind: FeedActivityKind;
	at: string | Date;
	id: string;
};

export type ActivityFeedCursor = {
	before: string; // ISO
	beforeKind: FeedActivityKind;
	beforeId: string;
};
```

Kind tiebreak when `at` is equal (newest-first): `log` → `review` → `list` → `divergence`, then `id` DESC.

---

## Task 1: Feed sort + cursor helpers (TDD)

**Files:**
- Modify: `apps/server/src/lib/feed-items.ts`
- Modify: `apps/server/src/lib/feed-items.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `apps/server/src/lib/feed-items.test.ts`:

```ts
import {
	compareFeedRows,
	feedRowId,
	isFeedRowOlderThanCursor,
	sortFeedRows,
} from "./feed-items";

describe("compareFeedRows", () => {
	test("orders by at desc", () => {
		const newer = {
			kind: "review" as const,
			at: "2026-06-07T12:00:00.000Z",
			id: "a",
		};
		const older = {
			kind: "log" as const,
			at: "2026-06-07T10:00:00.000Z",
			id: "b",
		};
		expect(compareFeedRows(newer, older)).toBeLessThan(0);
		expect(compareFeedRows(older, newer)).toBeGreaterThan(0);
	});

	test("at equal — log before review", () => {
		const at = "2026-06-07T12:00:00.000Z";
		const log = { kind: "log" as const, at, id: "l1" };
		const review = { kind: "review" as const, at, id: "r1" };
		expect(compareFeedRows(log, review)).toBeLessThan(0);
	});

	test("cursor keeps same-second log when cursor is review", () => {
		const at = "2026-06-07T12:00:00.000Z";
		const cursor = { kind: "review" as const, at, id: "r1" };
		const log = { kind: "log" as const, at, id: "l1" };
		expect(isFeedRowOlderThanCursor(log, cursor)).toBe(false);
		expect(isFeedRowOlderThanCursor(cursor, log)).toBe(true);
	});
});

describe("sortFeedRows", () => {
	test("log with newer createdAt beats older review despite backdated watch", () => {
		const rows = sortFeedRows([
			{
				kind: "review",
				at: "2026-06-07T10:05:00.000Z",
				id: "r1",
			},
			{
				kind: "log",
				at: "2026-06-07T11:00:00.000Z",
				id: "l1",
			},
		]);
		expect(rows[0]?.kind).toBe("log");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/server && bun test src/lib/feed-items.test.ts`  
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement helpers in `feed-items.ts`**

Add after existing exports:

```ts
export type FeedActivityKind = "log" | "review" | "list" | "divergence";

export type FeedSortRow = {
	kind: FeedActivityKind;
	at: FeedAt;
	id: string;
};

const FEED_KIND_RANK: Record<FeedActivityKind, number> = {
	log: 0,
	review: 1,
	list: 2,
	divergence: 3,
};

/** Descending feed order — newer rows sort first. */
export function compareFeedRows(a: FeedSortRow, b: FeedSortRow): number {
	const atDiff = feedAtMs(b.at) - feedAtMs(a.at);
	if (atDiff !== 0) return atDiff;
	const kindDiff = FEED_KIND_RANK[a.kind] - FEED_KIND_RANK[b.kind];
	if (kindDiff !== 0) return kindDiff;
	return b.id.localeCompare(a.id);
}

export function sortFeedRows<T extends FeedSortRow>(rows: T[]): T[] {
	return [...rows].sort(compareFeedRows);
}

/** True when `row` should appear below `cursor` in the feed (page 2+). */
export function isFeedRowOlderThanCursor(
	row: FeedSortRow,
	cursor: FeedSortRow,
): boolean {
	return compareFeedRows(row, cursor) > 0;
}

/** Stable id per kind for cursor tiebreak. */
export function feedRowId(
	kind: FeedActivityKind,
	payload: {
		log?: { id: string };
		review?: { id: string };
		list?: { id: string };
	},
): string {
	if (kind === "log") return payload.log?.id ?? "";
	if (kind === "review") return payload.review?.id ?? "";
	if (kind === "list") return payload.list?.id ?? "";
	return "";
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd apps/server && bun test src/lib/feed-items.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/feed-items.ts apps/server/src/lib/feed-items.test.ts
git commit -m "feat(feed): shared activity sort and composite cursor helpers"
```

---

## Task 2: Server — list activity time + composite cursor in `GET /api/feed`

**Files:**
- Modify: `apps/server/src/routes/feed.ts`
- Modify: `apps/server/src/lib/feed-items.ts` (add `listActivityAt` pure helper if useful)
- Test: `apps/server/src/lib/feed-items.test.ts`

- [ ] **Step 1: Add pure `listActivityAt` helper + test**

```ts
// feed-items.ts
export function listActivityAt(
	list: { createdAt: Date | string; id: string },
	latestItemAddedAt: Date | string | null | undefined,
): Date {
	const created = list.createdAt instanceof Date ? list.createdAt : new Date(list.createdAt);
	if (!latestItemAddedAt) return created;
	const added =
		latestItemAddedAt instanceof Date
			? latestItemAddedAt
			: new Date(latestItemAddedAt);
	return added.getTime() > created.getTime() ? added : created;
}
```

Test: list with `updatedAt` newer but `addedAt` older still uses `createdAt`.

- [ ] **Step 2: Lists query — join latest `list_item.addedAt`**

In `feed.ts`, import `listItem` from `@still/db`. Replace list fetch with subquery or grouped join:

```ts
import { listItem } from "@still/db";
import { max, sql } from "drizzle-orm";

// Inside handler — fetch lists with latest addedAt
const listRows = await db
	.select({
		list,
		user,
		profile,
		latestItemAddedAt: max(listItem.addedAt),
	})
	.from(list)
	.leftJoin(listItem, eq(listItem.listId, list.id))
	.leftJoin(user, eq(list.userId, user.id))
	.leftJoin(profile, eq(profile.userId, user.id))
	.where(
		and(
			inArray(list.userId, ids),
			// period: list.createdAt OR any list_item.addedAt in window — use OR sql fragment
			listPeriodWhere,
			listCursorWhere,
		),
	)
	.groupBy(list.id, user.id, profile.userId /* + all list columns or use subquery */)
	.orderBy(desc(sql`GREATEST(${list.createdAt}, COALESCE(MAX(${listItem.addedAt}), ${list.createdAt}))`))
	.limit(limit);
```

**Pragmatic alternative if groupBy is noisy:** two-step fetch — lists in period via `createdAt`, union list ids with items added in period, dedupe, then compute `listActivityAt` in JS before merge. Prefer one query if Drizzle groupBy stays readable.

Map list rows:

```ts
...listRows.map((row) => ({
	kind: "list" as const,
	at: listActivityAt(row.list, row.latestItemAddedAt),
	id: row.list.id,
	payload: row,
})),
```

- [ ] **Step 3: Parse composite cursor query params**

Extend query schema:

```ts
t.Object({
	limit: t.Optional(t.String()),
	before: t.Optional(t.String()),
	beforeKind: t.Optional(
		t.Union([
			t.Literal("log"),
			t.Literal("review"),
			t.Literal("list"),
			t.Literal("divergence"),
		]),
	),
	beforeId: t.Optional(t.String()),
}),
```

Parse cursor:

```ts
function parseFeedCursor(query: {
	before?: string;
	beforeKind?: string;
	beforeId?: string;
}): FeedSortRow | null {
	if (!query.before) return null;
	const at = new Date(query.before);
	if (Number.isNaN(at.getTime())) return null;
	const kind = query.beforeKind as FeedActivityKind | undefined;
	if (!kind || !query.beforeId) {
		// legacy ISO-only fallback: treat as strict lt(at)
		return { kind: "divergence", at, id: "" };
	}
	return { kind, at, id: query.beforeId };
}
```

Apply per-stream filter in JS after fetch OR via SQL — **minimum viable:** fetch `limit * 2` per stream, filter with `isFeedRowOlderThanCursor`, merge, `sortFeedRows`, slice `limit`. Document as acceptable v1 if SQL cursor is too heavy.

- [ ] **Step 4: Merge with `sortFeedRows`; divergence page 1 only**

```ts
const merged = sortFeedRows([
	...logRows.map(/* kind log, at: log.createdAt, id: log.id */),
	...reviewRows.map(/* ... */),
	...listRows.map(/* at: listActivityAt */),
]);

if (!cursor) {
	const divergence = await findFeedRatingDivergence(/* ... */);
	if (divergence) merged.splice(Math.min(3, merged.length), 0, divergenceRow);
}

const page = merged.slice(0, limit).map(/* serialize at */);
```

- [ ] **Step 5: Run server tests**

Run: `cd apps/server && bun test src/lib/feed-items.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/feed.ts apps/server/src/lib/feed-items.ts apps/server/src/lib/feed-items.test.ts
git commit -m "fix(feed): list activity time and composite activity cursor"
```

---

## Task 3: Web — `sortActivityItems` + cursor types (TDD)

**Files:**
- Modify: `apps/web/src/lib/home-community-activity.ts`
- Create: `apps/web/src/lib/home-community-activity-sort.test.ts`

- [ ] **Step 1: Write failing sort tests**

```ts
import { describe, expect, test } from "bun:test";
import {
	activityFeedCursorFromItem,
	sortActivityItems,
	type HomeCommunityActivityItem,
} from "./home-community-activity";

describe("sortActivityItems", () => {
	test("re-sorts appended page into desc order", () => {
		const items: HomeCommunityActivityItem[] = [
			{
				kind: "review",
				at: "2026-06-07T10:00:00.000Z",
				payload: { review: { id: "r1" } },
			},
			{
				kind: "log",
				at: "2026-06-07T11:00:00.000Z",
				payload: { log: { id: "l1" } },
			},
		];
		const sorted = sortActivityItems([
			items[0]!,
			{ kind: "list", at: "2026-06-07T09:00:00.000Z", payload: { list: { id: "x" } } },
			items[1]!,
		]);
		expect(sorted[0]?.kind).toBe("log");
		expect(sorted[1]?.kind).toBe("review");
	});
});

describe("activityFeedCursorFromItem", () => {
	test("builds composite cursor from last row", () => {
		const item: HomeCommunityActivityItem = {
			kind: "review",
			at: "2026-06-07T10:00:00.000Z",
			payload: { review: { id: "r1" } },
		};
		expect(activityFeedCursorFromItem(item)).toEqual({
			before: "2026-06-07T10:00:00.000Z",
			beforeKind: "review",
			beforeId: "r1",
		});
	});
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/web && bun test src/lib/home-community-activity-sort.test.ts`

- [ ] **Step 3: Implement in `home-community-activity.ts`**

Port `compareFeedRows` logic (mirror server ranks). Add:

```ts
export type ActivityFeedCursor = {
	before: string;
	beforeKind: FeedActivityKind;
	beforeId: string;
};

function feedRowFromItem(item: HomeCommunityActivityItem): FeedSortRow {
	const pl = item.payload as Record<string, unknown>;
	let id = "";
	if (item.kind === "log" && pl.log && typeof pl.log === "object" && "id" in pl.log)
		id = String((pl.log as { id: string }).id);
	// ... review, list similarly; divergence uses synthetic id from payload
	return { kind: item.kind, at: item.at, id };
}

export function sortActivityItems(
	items: HomeCommunityActivityItem[],
): HomeCommunityActivityItem[] {
	return [...items].sort((a, b) => compareFeedRows(feedRowFromItem(a), feedRowFromItem(b)));
}

export function activityFeedCursorFromItem(
	item: HomeCommunityActivityItem,
): ActivityFeedCursor {
	const row = feedRowFromItem(item);
	return { before: row.at, beforeKind: row.kind, beforeId: row.id };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/home-community-activity.ts apps/web/src/lib/home-community-activity-sort.test.ts
git commit -m "feat(web): activity feed sort and composite cursor helpers"
```

---

## Task 4: Web — unified bylines + watch meta

**Files:**
- Modify: `apps/web/src/components/feed/activity-item.tsx`
- Modify: `apps/web/src/lib/format.ts` (add `shouldShowWatchDateMeta(watchedAt, loggedAt)` if needed)

- [ ] **Step 1: Pass `item` into `LogActivity`**

Change `LogActivity` signature to accept `item: Item` like review/list.

- [ ] **Step 2: Unified byline from `item.at`**

```tsx
<ActivityByline
	person={payload}
	kind="log"
	rewatch={log.rewatch}
	dateTime={item.at}
	timeLabel={formatTimeAgoLabel(item.at)}
/>
```

- [ ] **Step 3: Watch date meta when calendar days differ**

Use `dateToYmd` / `formatTodayYmd` from `log-watched-date.ts`:

```tsx
function shouldShowWatchDateMeta(watchedAt: string, loggedAt: string): boolean {
	const watchYmd = dateToYmd(new Date(watchedAt));
	const logYmd = dateToYmd(new Date(loggedAt));
	return watchYmd !== logYmd;
}

// Under title in LogActivity:
{shouldShowWatchDateMeta(watchedAtIso, item.at) ? (
	<ActivityMetaRow>
		<span>Watched {formatActivityWatchTimestamp(log.watchedAt)}</span>
	</ActivityMetaRow>
) : null}
```

- [ ] **Step 4: Manual smoke on `/home?browse=community&sort=activity`**

Confirm log/review/list bylines all show `Nm ago` and descend correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/feed/activity-item.tsx
git commit -m "fix(activity): unified relative bylines and watch date meta"
```

---

## Task 5: Wire fetch + infinite scroll

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Modify: `apps/web/src/components/home/community-activity-infinite.tsx`
- Modify: `apps/web/src/lib/home-community-core-fetch.ts`

- [ ] **Step 1: Extend `fetchCommunityActivity`**

```ts
export async function fetchCommunityActivity(
	period: HomeLeaderboardPeriod,
	tz: string,
	signedIn: boolean,
	opts?: {
		before?: string | null;
		beforeKind?: FeedActivityKind | null;
		beforeId?: string | null;
		signal?: AbortSignal;
	},
): Promise<{ items: ... } | null> {
	// ...
	if (signedIn && opts?.before) {
		url.searchParams.set("before", opts.before);
		if (opts.beforeKind) url.searchParams.set("beforeKind", opts.beforeKind);
		if (opts.beforeId) url.searchParams.set("beforeId", opts.beforeId);
	}
}
```

- [ ] **Step 2: Update `community-activity-infinite.tsx`**

Change cursor type from `string` to `ActivityFeedCursor | null`.

```ts
const loadMore = useCallback(async (cursor: ActivityFeedCursor, signal: AbortSignal) => {
	const payload = await fetchCommunityActivity(period, readViewerTimeZone(), signedIn, {
		before: cursor.before,
		beforeKind: cursor.beforeKind,
		beforeId: cursor.beforeId,
		signal,
	});
	const items = sortActivityItems(parseFeedApiActivityItems(payload));
	const last = items[items.length - 1];
	return {
		items,
		nextCursor:
			items.length >= COMMUNITY_ACTIVITY_LIMIT && last
				? activityFeedCursorFromItem(last)
				: null,
	};
}, [period, signedIn]);

// After merge in pager — re-sort full list:
// Option A: wrap setItems in community-activity-infinite via custom hook
// Option B: sort inside loadMore return + sort seeds in useEffect on items state
```

**Recommended:** sort in `loadMore` before return AND sort seeds in `CommunityActivityInfinite` on render:

```tsx
const sortedSeeds = useMemo(() => sortActivityItems(seeds), [seeds]);
```

Pass `sortedSeeds` to `useInfinitePager`. In `loadMore`, return sorted `items`; update pager to `setItems((prev) => sortActivityItems(mergeDedupe(prev, res.items, getKey)))` — requires thin wrapper or fork merge in component:

```tsx
const { items: rawItems, ...rest } = useInfinitePager(...);
const items = useMemo(() => sortActivityItems(rawItems), [rawItems]);
```

- [ ] **Step 3: Update `home-community-core-fetch.ts` initial cursor**

```ts
const last = activityItems[activityItems.length - 1];
const initialActivityCursor =
	input.session && activityItems.length >= COMMUNITY_ACTIVITY_LIMIT && last
		? activityFeedCursorFromItem(last)
		: null;
```

Update `CommunityFeedSeed.initialActivityCursor` type to `ActivityFeedCursor | null`.

- [ ] **Step 4: Fix TypeScript consumers of `initialActivityCursor`**

Grep `initialActivityCursor` — update `home-community-lobby.tsx` props if needed.

- [ ] **Step 5: Run web tests**

Run: `cd apps/web && bun test src/lib/home-community-activity-sort.test.ts src/lib/activity-feed-timestamp.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/still-api-fetch.ts apps/web/src/components/home/community-activity-infinite.tsx apps/web/src/lib/home-community-core-fetch.ts apps/web/src/lib/home-community-activity.ts
git commit -m "fix(activity): composite cursor pagination and client re-sort"
```

---

## Task 6: Verification

- [ ] **Step 1: Run server + web unit tests**

```bash
cd apps/server && bun test src/lib/feed-items.test.ts
cd apps/web && bun test src/lib/home-community-activity-sort.test.ts src/lib/activity-feed-timestamp.test.ts
```

- [ ] **Step 2: Manual checklist (signed-in Activity tab)**

1. Log film → publish review → add same title to list.
2. Order: list, review, log (newest first).
3. All bylines relative (`Nm ago`), descending.
4. Backdated watch shows `Watched {date}` meta, not `today` in byline.
5. Scroll page 2 — no duplicates, order stays monotonic.
6. Change Community period chip — feed re-seeds.

- [ ] **Step 3: Optional — update spec status**

In spec frontmatter, set `Status: Implemented` after ship.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Unified byline from `item.at` | Task 4 |
| Watch meta when days differ | Task 4 |
| List `at` from createdAt/latest addedAt | Task 2 |
| Composite cursor | Tasks 2, 3, 5 |
| Client re-sort | Tasks 3, 5 |
| Divergence page 1 only | Task 2 |
| Native parity (uses `item.at`) | No code — verify after Task 2 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-community-activity-feed-ordering.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach do you want?
