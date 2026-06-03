# Community Lazy-Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Community lobby (`/home?browse=community`) fast by fetching only the active feed on the server and paging Lists / Reviews / Activity on scroll.

**Architecture:** Add *additive* pagination to three endpoints (Lists + Reviews via offset; signed-in Activity via a `before` timestamp cursor) with unchanged response shapes. A shared `useInfinitePager` hook drives infinite scroll for all three feeds. The RSC seeds only the active feed (active period); feed/period chips re-seed via the URL (like the diary). Leaderboards and the logged-out discover snapshot are unchanged.

**Tech Stack:** Elysia + Drizzle (server), Next.js App Router RSC + React client components, `bun:test`, Biome (TAB indentation).

**Spec:** `docs/superpowers/specs/2026-06-03-community-lazy-loading-design.md`

---

## Canonical types & names (used across tasks)

- Server pure helper `apps/server/src/lib/community-page-args.ts`: `parseCommunityPage(raw)`, `communityOffset(page, limit)`.
- Client constants (in `still-api-fetch.ts`): `COMMUNITY_LISTS_LIMIT = 24`, `COMMUNITY_REVIEWS_LIMIT = 20`, `COMMUNITY_ACTIVITY_LIMIT = 40`.
- Hook `apps/web/src/lib/use-infinite-pager.ts`: `useInfinitePager<T, C>(...)`, `LoadMoreResult<T, C>`.
- Shared review mapper `mapCommunityReviewRow(raw): HomeCommunityReviewRow | null` (extracted from `home-community-core-fetch.ts`).
- RSC seed `fetchHomeCommunityFeedSeed(input): CommunityFeedSeed` (replaces `fetchHomeCommunityCore`).
- Feed components: `CommunityListsInfinite`, `CommunityReviewsInfinite`, `CommunityActivityInfinite`.

`CommunityFeedSeed` shape (defined in Task 6, consumed by the lobby in Task 10):
```ts
export type CommunityFeedSeed = {
	listSeeds: ListLobbySeed[];
	reviews: HomeCommunityReviewRow[];
	activityItems: HomeCommunityActivityItem[];
	curatorSpotlights: CuratorSpotlightPatron[];
	/** Page 2 for offset feeds (lists/reviews); null when seed is the whole set. */
	initialListCursor: number | null;
	initialReviewCursor: number | null;
	/** Last item `at` for the activity cursor; null when no more. */
	initialActivityCursor: string | null;
};
```

---

## Task 1: Server pure page-args helper (TDD)

**Files:**
- Create: `apps/server/src/lib/community-page-args.ts`
- Test: `apps/server/src/lib/community-page-args.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/lib/community-page-args.test.ts
import { describe, expect, test } from "bun:test";

import { communityOffset, parseCommunityPage } from "./community-page-args";

describe("parseCommunityPage", () => {
	test("defaults to 1; floors; clamps to >= 1", () => {
		expect(parseCommunityPage(undefined)).toBe(1);
		expect(parseCommunityPage("0")).toBe(1);
		expect(parseCommunityPage("-3")).toBe(1);
		expect(parseCommunityPage("2.9")).toBe(2);
		expect(parseCommunityPage("nope")).toBe(1);
	});
});

describe("communityOffset", () => {
	test("page 1 => 0; page 3, limit 20 => 40", () => {
		expect(communityOffset(1, 20)).toBe(0);
		expect(communityOffset(3, 20)).toBe(40);
		expect(communityOffset(0, 20)).toBe(0);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun test apps/server/src/lib/community-page-args.test.ts`
Expected: FAIL — Cannot find module './community-page-args'.

- [ ] **Step 3: Implement**

```ts
// apps/server/src/lib/community-page-args.ts
/**
 * Pure offset-pagination helpers for the community feed endpoints. Kept separate
 * from the routes so the math is unit-testable without a DB.
 */
export function parseCommunityPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function communityOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `bun test apps/server/src/lib/community-page-args.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/community-page-args.ts apps/server/src/lib/community-page-args.test.ts
git commit -m "feat(community): pure offset page-args helper for feed pagination"
```

---

## Task 2: Server — paginate `/api/lists` and `/api/reviews/recent` (offset)

**Files:**
- Modify: `apps/server/src/routes/lists.ts` (the `.get("/", ...)` handler, ~lines 99-127)
- Modify: `apps/server/src/routes/reviews.ts` (the `.get("/recent", ...)` handler, ~lines 309-348)

Both are additive: a new optional `page` query param; absent ⇒ identical to today.

- [ ] **Step 1: Lists — add import**

In `apps/server/src/routes/lists.ts`, add near the other `../lib/...` imports:
```ts
import { communityOffset, parseCommunityPage } from "../lib/community-page-args";
```
Confirm `desc` is already imported from `drizzle-orm` in this file (it is used by the existing `orderBy`). If not, add it.

- [ ] **Step 2: Lists — apply offset + id tiebreak**

In the `.get("/", ...)` handler, replace the query body:
```ts
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select()
				.from(list)
				.where(
					and(
						eq(list.isPublic, true),
						withinCommunityPeriod(list.updatedAt, start, end),
					),
				)
				.orderBy(
					listDiscoverabilityOrder,
					desc(list.likesCount),
					desc(list.updatedAt),
				)
				.limit(limit);
			return withCoverPosterPaths(rows);
```
with:
```ts
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const page = parseCommunityPage(query.page);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select()
				.from(list)
				.where(
					and(
						eq(list.isPublic, true),
						withinCommunityPeriod(list.updatedAt, start, end),
					),
				)
				.orderBy(
					listDiscoverabilityOrder,
					desc(list.likesCount),
					desc(list.updatedAt),
					desc(list.id),
				)
				.limit(limit)
				.offset(communityOffset(page, limit));
			return withCoverPosterPaths(rows);
```
Then add `page` to the route's query schema. The handler's `query` option is:
```ts
			query: t.Composite([
				t.Object({ limit: t.Optional(t.String()) }),
				communityPeriodQuery,
			]),
```
Change the first object to:
```ts
			query: t.Composite([
				t.Object({
					limit: t.Optional(t.String()),
					page: t.Optional(t.String()),
				}),
				communityPeriodQuery,
			]),
```

- [ ] **Step 3: Reviews — add import + apply offset + id tiebreak**

In `apps/server/src/routes/reviews.ts`, add the import:
```ts
import { communityOffset, parseCommunityPage } from "../lib/community-page-args";
```
In the `.get("/recent", ...)` handler replace:
```ts
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select({ review, movie, user, profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(user, eq(review.userId, user.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.where(
					and(
						contentVisibilityWhere(
							currentUser?.id ?? null,
							review.userId,
							review.visibility,
						),
						withinCommunityPeriod(review.publishedAt, start, end),
					),
				)
				.orderBy(desc(reviewEngagementOrderSql()), desc(review.publishedAt))
				.limit(limit);
			return rows;
```
with:
```ts
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const page = parseCommunityPage(query.page);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select({ review, movie, user, profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(user, eq(review.userId, user.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.where(
					and(
						contentVisibilityWhere(
							currentUser?.id ?? null,
							review.userId,
							review.visibility,
						),
						withinCommunityPeriod(review.publishedAt, start, end),
					),
				)
				.orderBy(
					desc(reviewEngagementOrderSql()),
					desc(review.publishedAt),
					desc(review.id),
				)
				.limit(limit)
				.offset(communityOffset(page, limit));
			return rows;
```
Add `page` to the `/recent` query schema (it currently has `limit`, `period`, `tz`):
```ts
			query: t.Object({
				limit: t.Optional(t.String()),
				page: t.Optional(t.String()),
				period: t.Optional(
					t.Union([
						t.Literal("week"),
						t.Literal("month"),
						t.Literal("year"),
						t.Literal("all"),
					]),
				),
				tz: t.Optional(t.String()),
			}),
```

- [ ] **Step 4: Type-check**

Run: `cd apps/server && bunx tsc --noEmit 2>&1 | grep -E "lists\.ts|reviews\.ts"`
Expected: NO output (no new errors in these files). Pre-existing unrelated errors elsewhere are fine.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/lists.ts apps/server/src/routes/reviews.ts
git commit -m "feat(community): additive offset pagination for lists + recent reviews"
```

---

## Task 3: Server — paginate `/api/feed` (timestamp cursor)

**Files:**
- Modify: `apps/server/src/routes/feed.ts` (the `.get("/", ...)` handler, ~lines 46-166)

Add an optional `before` ISO cursor; each stream filters `time < before`; the synthetic divergence row is page-1-only (absent `before`).

- [ ] **Step 1: Add a `before` predicate per stream**

The three stream queries filter by `withinCommunityPeriod(<timeCol>, start, end)`. Add an extra `lt(<timeCol>, beforeDate)` when `before` is present. At the top of the `.get("/", ...)` handler body, after `const { start, end } = resolveCommunityPeriodQuery(query);`, add:
```ts
			const beforeDate =
				typeof query.before === "string" && query.before.length > 0
					? new Date(query.before)
					: null;
			const beforeValid = beforeDate != null && !Number.isNaN(beforeDate.getTime());
			const logBefore = beforeValid ? lt(log.watchedAt, beforeDate) : undefined;
			const reviewBefore = beforeValid ? lt(review.publishedAt, beforeDate) : undefined;
			const listBefore = beforeValid ? lt(list.updatedAt, beforeDate) : undefined;
```
Ensure `lt` is imported from `drizzle-orm` at the top of `feed.ts` (add it to the existing import if missing).

- [ ] **Step 2: Apply the predicates in the three `.where(and(...))` clauses**

- Logs query `.where(and(...))`: add `logBefore` as the last argument.
- Reviews query `.where(and(...))`: add `reviewBefore` as the last argument.
- Lists query `.where(and(...))`: add `listBefore` as the last argument.

(`and(...)` ignores `undefined` arguments, so page 1 — `before` absent — is unchanged.)

- [ ] **Step 3: Gate the divergence row to page 1**

The divergence block currently runs whenever `followingOnly.length >= 2`. Change its condition to also require no cursor:
```ts
			const divergence =
				!beforeValid && followingOnly.length >= 2
					? await findFeedRatingDivergence({
							viewerId: viewer.id,
							followingUserIds: followingOnly,
							periodStart: start,
							periodEnd: end,
						})
					: null;
```

- [ ] **Step 4: Add `before` to the `/` query schema**

The `.get("/", ...)` query option is:
```ts
			query: t.Composite([
				t.Object({ limit: t.Optional(t.String()) }),
				communityPeriodQuery,
			]),
```
Change to:
```ts
			query: t.Composite([
				t.Object({
					limit: t.Optional(t.String()),
					before: t.Optional(t.String()),
				}),
				communityPeriodQuery,
			]),
```

- [ ] **Step 5: Type-check**

Run: `cd apps/server && bunx tsc --noEmit 2>&1 | grep "feed.ts"`
Expected: NO output.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/feed.ts
git commit -m "feat(community): additive before-cursor pagination for the activity feed"
```

---

## Task 4: Shared `useInfinitePager` hook (TDD where feasible)

**Files:**
- Create: `apps/web/src/lib/use-infinite-pager.ts`
- Test: `apps/web/src/lib/use-infinite-pager.test.ts`

This ports the proven loop from `DiaryLobbyInfinite` (sentinel + IntersectionObserver + generation-guard/abort + dedupe + footer states) into a reusable, cursor-generic hook.

- [ ] **Step 1: Write a focused unit test for the pure cursor/dedupe reducer**

The IntersectionObserver parts need a DOM; the *merge/dedupe* logic is pure and is the part most worth testing. Extract it as an exported helper and test it.

```ts
// apps/web/src/lib/use-infinite-pager.test.ts
import { describe, expect, test } from "bun:test";

import { mergeDedupe } from "./use-infinite-pager";

describe("mergeDedupe", () => {
	const key = (n: { id: string }) => n.id;
	test("appends only new keys, preserving order", () => {
		const prev = [{ id: "a" }, { id: "b" }];
		const next = [{ id: "b" }, { id: "c" }];
		expect(mergeDedupe(prev, next, key).map((x) => x.id)).toEqual([
			"a",
			"b",
			"c",
		]);
	});
	test("drops fully-duplicate batches", () => {
		const prev = [{ id: "a" }];
		expect(mergeDedupe(prev, [{ id: "a" }], key)).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun test apps/web/src/lib/use-infinite-pager.test.ts`
Expected: FAIL — Cannot find module './use-infinite-pager'.

- [ ] **Step 3: Implement the hook**

```ts
// apps/web/src/lib/use-infinite-pager.ts
"use client";

import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

export type LoadMoreResult<T, C> =
	| { items: T[]; nextCursor: C | null }
	| { error: true };

/** Pure merge used by the pager and unit-tested directly. */
export function mergeDedupe<T>(
	prev: T[],
	next: T[],
	getKey: (item: T) => string,
): T[] {
	const seen = new Set(prev.map(getKey));
	const out = [...prev];
	for (const row of next) {
		const k = getKey(row);
		if (!seen.has(k)) {
			seen.add(k);
			out.push(row);
		}
	}
	return out;
}

const SCROLL_MARGIN_PX = 280;

/**
 * Infinite-scroll engine shared by the community feeds. `C` is an opaque cursor —
 * a page number for offset feeds, an ISO timestamp for the activity feed.
 */
export function useInfinitePager<T, C>(opts: {
	seeds: T[];
	/** Cursor that fetches the next page; null when the seed is the whole set. */
	initialCursor: C | null;
	loadMore: (cursor: C, signal: AbortSignal) => Promise<LoadMoreResult<T, C>>;
	getKey: (item: T) => string;
}): {
	items: T[];
	footerState: "idle" | "loading" | "exhausted" | "error";
	sentinelRef: RefObject<HTMLDivElement | null>;
	retry: () => void;
} {
	const { seeds, initialCursor, loadMore, getKey } = opts;

	const [items, setItems] = useState<T[]>(() => [...seeds]);
	const [footerState, setFooterState] = useState<
		"idle" | "loading" | "exhausted" | "error"
	>(() => (initialCursor == null ? "exhausted" : "idle"));

	const cursorRef = useRef<C | null>(initialCursor);
	const loadingRef = useRef(false);
	const genRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const loadMoreRef = useRef<() => Promise<void>>(async () => {});

	// Re-seed when the server sends a new first page (chip navigation).
	useEffect(() => {
		genRef.current += 1;
		abortRef.current?.abort();
		abortRef.current = null;
		loadingRef.current = false;
		cursorRef.current = initialCursor;
		setItems([...seeds]);
		setFooterState(initialCursor == null ? "exhausted" : "idle");
	}, [seeds, initialCursor]);

	const peek = useCallback(() => {
		if (typeof window === "undefined") return;
		if (loadingRef.current || cursorRef.current == null) return;
		const el = sentinelRef.current;
		if (!el) return;
		if (el.getBoundingClientRect().top <= window.innerHeight + SCROLL_MARGIN_PX) {
			void loadMoreRef.current();
		}
	}, []);

	const runLoadMore = useCallback(async () => {
		const cursor = cursorRef.current;
		if (cursor == null) {
			setFooterState("exhausted");
			return;
		}
		if (loadingRef.current) return;
		loadingRef.current = true;
		setFooterState("loading");

		const gen = genRef.current;
		const controller = new AbortController();
		abortRef.current = controller;

		let res: LoadMoreResult<T, C>;
		try {
			res = await loadMore(cursor, controller.signal);
		} catch {
			if (gen !== genRef.current) return;
			loadingRef.current = false;
			setFooterState("error");
			return;
		}
		if (gen !== genRef.current) return;

		loadingRef.current = false;
		if ("error" in res) {
			setFooterState("error");
			return;
		}
		setItems((prev) => mergeDedupe(prev, res.items, getKey));
		cursorRef.current = res.nextCursor;
		const depleted = res.nextCursor == null || res.items.length === 0;
		setFooterState(depleted ? "exhausted" : "idle");
		if (!depleted) queueMicrotask(() => peek());
	}, [loadMore, getKey, peek]);

	useEffect(() => {
		loadMoreRef.current = runLoadMore;
	}, [runLoadMore]);

	const showSentinel = footerState !== "exhausted";

	useEffect(() => {
		if (!showSentinel) return;
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) void loadMoreRef.current();
			},
			{ root: null, rootMargin: `${SCROLL_MARGIN_PX}px`, threshold: 0 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [showSentinel]);

	useEffect(() => {
		queueMicrotask(() => peek());
	}, [peek]);

	const retry = useCallback(() => {
		loadingRef.current = false;
		setFooterState("idle");
		queueMicrotask(() => peek());
	}, [peek]);

	return { items, footerState, sentinelRef, retry };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `bun test apps/web/src/lib/use-infinite-pager.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep "use-infinite-pager"`
Expected: NO output.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/use-infinite-pager.ts apps/web/src/lib/use-infinite-pager.test.ts
git commit -m "feat(community): shared useInfinitePager hook"
```

---

## Task 5: Client loaders + shared review mapper

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts` (extend the three community fetchers; add limit constants)
- Modify: `apps/web/src/lib/home-community-core-fetch.ts` (export a shared `mapCommunityReviewRow`)

- [ ] **Step 1: Extract the review-row mapper**

In `apps/web/src/lib/home-community-core-fetch.ts`, the `.get("/recent")` rows are mapped inline inside `fetchHomeCommunityCore`. Extract that mapping into an exported pure function so the client loader reuses it. Add:
```ts
/** One `/api/reviews/recent` raw row → community review card row (shared RSC + client). */
export function mapCommunityReviewRow(raw: unknown): HomeCommunityReviewRow | null {
	const row = raw as {
		review: {
			id: string;
			userId: string;
			movieId: number;
			title: string | null;
			body: string;
			rating: number | null;
			likesCount: number;
			commentsCount: number;
			publishedAt: string | Date;
		};
		movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	};
	const r = row.review;
	if (!r?.id) return null;
	const movie = row.movie;
	return {
		id: r.id,
		userId: r.userId,
		movieId: r.movieId,
		title: r.title,
		body: r.body,
		rating: r.rating,
		likesCount: r.likesCount ?? 0,
		commentsCount: r.commentsCount ?? 0,
		publishedAt: coerceActivityTimestamp(r.publishedAt),
		listing: movie
			? {
					title: movie.title,
					posterUrl: tmdbPosterUrlFromPath(movie.posterPath, "w185"),
					href: `/movies/${movie.tmdbId}`,
					listingKind: "movie" as const,
				}
			: undefined,
	};
}
```
Then, inside `fetchHomeCommunityCore`, replace the inline `.map((raw) => { ... })` for `reviewsAll` with:
```ts
	const reviewsAll = ((reviewsRes.data as unknown[]) ?? [])
		.map(mapCommunityReviewRow)
		.filter((r): r is HomeCommunityReviewRow => r != null);
```
(Leave the rest of `fetchHomeCommunityCore` intact for now — it is replaced in Task 6.)

- [ ] **Step 2: Add limit constants + extend the three client fetchers**

In `apps/web/src/lib/still-api-fetch.ts`, add the constants near the community fetchers:
```ts
export const COMMUNITY_LISTS_LIMIT = 24;
export const COMMUNITY_REVIEWS_LIMIT = 20;
export const COMMUNITY_ACTIVITY_LIMIT = 40;
```
Change `fetchCommunityLists` to accept an options object with `page`:
```ts
/** Public lists lobby — respects community period window. */
export async function fetchCommunityLists(
	period: HomeLeaderboardPeriod,
	tz: string,
	opts?: { page?: number; signal?: AbortSignal },
): Promise<unknown[] | null> {
	const url = new URL("/api/lists", stillApiOrigin());
	url.searchParams.set("limit", String(COMMUNITY_LISTS_LIMIT));
	if (opts?.page && opts.page > 1) url.searchParams.set("page", String(opts.page));
	for (const [key, value] of communityPeriodSearchParams({ period, tz })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as unknown[];
}
```
Change `fetchCommunityReviewsRecent` the same way (use `COMMUNITY_REVIEWS_LIMIT`, add `page`):
```ts
/** Recent public reviews — respects community period window. */
export async function fetchCommunityReviewsRecent(
	period: HomeLeaderboardPeriod,
	tz: string,
	opts?: { page?: number; signal?: AbortSignal },
): Promise<unknown[] | null> {
	const url = new URL("/api/reviews/recent", stillApiOrigin());
	url.searchParams.set("limit", String(COMMUNITY_REVIEWS_LIMIT));
	if (opts?.page && opts.page > 1) url.searchParams.set("page", String(opts.page));
	for (const [key, value] of communityPeriodSearchParams({ period, tz })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as unknown[];
}
```
Change `fetchCommunityActivity` to accept `before` (keep `signedIn`):
```ts
/** Following or discover activity — respects community period window. */
export async function fetchCommunityActivity(
	period: HomeLeaderboardPeriod,
	tz: string,
	signedIn: boolean,
	opts?: { before?: string | null; signal?: AbortSignal },
): Promise<{
	items: { kind: string; at: string | Date; payload: unknown }[];
} | null> {
	const path = signedIn ? "/api/feed" : "/api/feed/discover";
	const url = new URL(path, stillApiOrigin());
	if (signedIn) url.searchParams.set("limit", String(COMMUNITY_ACTIVITY_LIMIT));
	if (signedIn && opts?.before) url.searchParams.set("before", opts.before);
	for (const [key, value] of communityPeriodSearchParams({ period, tz })) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return null;
	return (await response.json()) as {
		items: { kind: string; at: string | Date; payload: unknown }[];
	};
}
```

- [ ] **Step 3: Update the existing `fetchCommunityActivity` caller**

`apps/web/src/components/home/home-community-lobby-params-context.tsx` calls `fetchCommunityActivity(active.period, tz, true, { signal: controller.signal })`. That still type-checks (the 4th arg is now `{ before?, signal? }`). No change needed yet — this whole call site is removed in Task 10. Leave it.

- [ ] **Step 4: Type-check**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep -E "still-api-fetch|home-community-core-fetch"`
Expected: NO output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/still-api-fetch.ts apps/web/src/lib/home-community-core-fetch.ts
git commit -m "feat(community): paginated client loaders + shared review mapper"
```

---

## Task 6: RSC active-feed-only seed

**Files:**
- Modify: `apps/web/src/lib/home-community-core-fetch.ts` (add `fetchHomeCommunityFeedSeed`)
- Modify: `apps/web/src/components/home/home-community-rsc-payload.tsx`
- Modify: `apps/web/src/app/(app)/home/page.tsx` (pass `feed`/`period` into the payload)

- [ ] **Step 1: Add `CommunityFeedSeed` + `fetchHomeCommunityFeedSeed`**

In `apps/web/src/lib/home-community-core-fetch.ts`, add (keep `fetchHomeCommunityCore` for now; it is removed in Task 10 once unused). Add imports at top: `import { listBoardRowToLobbySeed } from "@/lib/lists-lobby-order";` (already imported), `import type { HomeCommunityFeed } from "@/lib/home-community-feed";`, `import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";`, and the limit constants from `@/lib/still-api-fetch`.

```ts
import {
	COMMUNITY_ACTIVITY_LIMIT,
	COMMUNITY_LISTS_LIMIT,
	COMMUNITY_REVIEWS_LIMIT,
} from "@/lib/still-api-fetch";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";

export type CommunityFeedSeed = {
	listSeeds: ListLobbySeed[];
	reviews: HomeCommunityReviewRow[];
	activityItems: HomeCommunityActivityItem[];
	curatorSpotlights: CuratorSpotlightPatron[];
	initialListCursor: number | null;
	initialReviewCursor: number | null;
	initialActivityCursor: string | null;
};

const EMPTY_SEED: CommunityFeedSeed = {
	listSeeds: [],
	reviews: [],
	activityItems: [],
	curatorSpotlights: [],
	initialListCursor: null,
	initialReviewCursor: null,
	initialActivityCursor: null,
};

/**
 * Community critical path — fetches ONLY the active feed (active period). Feeds the
 * infinite components their page-1 seed + the cursor that fetches page 2. Leaderboard
 * feeds return the empty seed (client-deferred).
 */
export async function fetchHomeCommunityFeedSeed(input: {
	api: HomeApi;
	session: HomeSession;
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
}): Promise<CommunityFeedSeed> {
	const periodQuery = { period: input.period, tz: "UTC" as const };

	if (input.feed === "lists") {
		const [listsRes, curatorsRes] = await Promise.all([
			input.api.api.lists
				.get({ query: { limit: String(COMMUNITY_LISTS_LIMIT), ...periodQuery } })
				.catch(() => ({ data: [] })),
			input.api.api.profiles.curators.spotlight
				.get({ query: { limit: "6" } })
				.catch(() => ({ data: { patrons: [] } })),
		]);
		const listRows = ((listsRes.data as unknown[]) ?? []).map(toListBoardRow);
		const listSeeds = listRows.map(listBoardRowToLobbySeed);
		const curatorPayload = curatorsRes.data as
			| { patrons?: CuratorSpotlightPatron[] }
			| null
			| undefined;
		return {
			...EMPTY_SEED,
			listSeeds,
			curatorSpotlights: curatorPayload?.patrons ?? [],
			initialListCursor: listSeeds.length >= COMMUNITY_LISTS_LIMIT ? 2 : null,
		};
	}

	if (input.feed === "reviews") {
		const reviewsRes = await input.api.api.reviews.recent
			.get({ query: { limit: String(COMMUNITY_REVIEWS_LIMIT), ...periodQuery } })
			.catch(() => ({ data: [] }));
		const reviews = ((reviewsRes.data as unknown[]) ?? [])
			.map(mapCommunityReviewRow)
			.filter((r): r is HomeCommunityReviewRow => r != null);
		return {
			...EMPTY_SEED,
			reviews,
			initialReviewCursor: reviews.length >= COMMUNITY_REVIEWS_LIMIT ? 2 : null,
		};
	}

	if (input.feed === "activity") {
		const activityRes = input.session
			? await input.api.api.feed
					.get({ query: { limit: String(COMMUNITY_ACTIVITY_LIMIT), ...periodQuery } })
					.catch(() => ({ data: { items: [] } }))
			: await input.api.api.feed.discover
					.get({ query: periodQuery })
					.catch(() => ({ data: { items: [] } }));
		const activityItems = parseFeedApiActivityItems(
			activityRes.data as {
				items?: { kind: string; at: string | Date; payload: unknown }[];
			},
		);
		// Discover (logged-out) is a bounded snapshot — never paginates.
		const last = activityItems[activityItems.length - 1];
		const initialActivityCursor =
			input.session &&
			activityItems.length >= COMMUNITY_ACTIVITY_LIMIT &&
			last
				? last.at
				: null;
		return { ...EMPTY_SEED, activityItems, initialActivityCursor };
	}

	// film-ranks / tv-ranks — leaderboards are client-deferred.
	return EMPTY_SEED;
}
```

- [ ] **Step 2: Rewrite `home-community-rsc-payload.tsx`**

```tsx
import type { ReactNode } from "react";

import { HomeCommunityPatronProviders } from "@/components/home/home-community-patron-shell";
import { authServer } from "@/lib/auth-server";
import { fetchHomeCommunityFeedSeed } from "@/lib/home-community-core-fetch";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { serverApi } from "@/lib/server-api";

/**
 * Async RSC boundary for Community — seeds ONLY the active feed; leaderboards fill on the client.
 */
export async function HomeCommunityRscPayload({
	feed,
	period,
	children,
}: {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	children: ReactNode;
}) {
	const api = await serverApi();
	const session = await authServer();
	const seed = await fetchHomeCommunityFeedSeed({ api, session, feed, period });

	return (
		<HomeCommunityPatronProviders
			seed={seed}
			feed={feed}
			period={period}
			signedIn={Boolean(session?.user)}
		>
			{children}
		</HomeCommunityPatronProviders>
	);
}
```
(`HomeCommunityPatronProviders`'s new props are defined in Task 10.)

- [ ] **Step 3: Pass `feed`/`period` from `home/page.tsx`**

In `apps/web/src/app/(app)/home/page.tsx`, the community branch renders `<HomeCommunityRscPayload>`. The page already computes `sort` and a period. Add the parsed community feed + period and pass them. Near where `sort`/`browse` are parsed, add:
```ts
	const communityFeed = parseHomeCommunityFeed(sp.sort);
	const communityPeriod = parseHomeCommunityPeriod(sp.period);
```
Add imports:
```ts
import { parseHomeCommunityFeed } from "@/lib/home-community-feed";
import { parseHomeCommunityPeriod } from "@/lib/home-leaderboard-period";
```
(Confirm the `searchParams` type includes `period?: string` — add it if missing.) Then change the JSX:
```tsx
							<HomeCommunityRscPayload feed={communityFeed} period={communityPeriod}>
```

- [ ] **Step 4: Type-check (expect this task to leave intermediate errors)**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep -E "home-community-rsc-payload|home/page"`
Expected: errors ONLY about `HomeCommunityPatronProviders` props (its new `seed`/`feed`/`period` props don't exist until Task 10). That is expected — Task 10 finishes the wiring. Confirm `home/page.tsx` itself has no *other* new errors (e.g. missing imports). If `home-community-rsc-payload.tsx` shows errors unrelated to the provider props, fix them.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/home-community-core-fetch.ts apps/web/src/components/home/home-community-rsc-payload.tsx "apps/web/src/app/(app)/home/page.tsx"
git commit -m "feat(community): RSC seeds only the active feed"
```

---

## Task 7: `CommunityListsInfinite` component

**Files:**
- Create: `apps/web/src/components/home/community-lists-infinite.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/home/community-lists-infinite.tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback } from "react";

import { ListLobbyPoster } from "@/components/list/list-lobby-poster";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import { listBoardRowToLobbySeed, type ListLobbySeed } from "@/lib/lists-lobby-order";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	COMMUNITY_LISTS_LIMIT,
	fetchCommunityLists,
} from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function CommunityListsInfinite({
	seeds,
	initialCursor,
	period,
	monochromePeersOnHover,
}: {
	seeds: ListLobbySeed[];
	initialCursor: number | null;
	period: HomeLeaderboardPeriod;
	monochromePeersOnHover: boolean;
}) {
	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const raw = await fetchCommunityLists(period, readViewerTimeZone(), {
				page,
				signal,
			});
			if (raw == null) return { error: true as const };
			const items = raw.map((r) => listBoardRowToLobbySeed(toListBoardRow(r)));
			return {
				items,
				nextCursor: items.length >= COMMUNITY_LISTS_LIMIT ? page + 1 : null,
			};
		},
		[period],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		ListLobbySeed,
		number
	>({
		seeds,
		initialCursor,
		loadMore,
		getKey: (l) => l.id,
	});

	return (
		<>
			<div
				className={cn(
					HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
					monochromePeersOnHover &&
						HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
				)}
			>
				{items.map((list, index) => (
					<ListLobbyPoster
						key={list.id}
						list={list}
						priority={index < 6}
						className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
						frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
					/>
				))}
			</div>
			<CommunityInfiniteFooter
				footerState={footerState}
				sentinelRef={sentinelRef}
				retry={retry}
				loadingLabel="Loading more lists"
			/>
		</>
	);
}
```

This references a small shared footer component — create it in Step 2.

- [ ] **Step 2: Create the shared footer**

```tsx
// add to apps/web/src/components/home/community-infinite-footer.tsx
"use client";

import { Loader2 } from "lucide-react";
import type { RefObject } from "react";

export function CommunityInfiniteFooter({
	footerState,
	sentinelRef,
	retry,
	loadingLabel,
}: {
	footerState: "idle" | "loading" | "exhausted" | "error";
	sentinelRef: RefObject<HTMLDivElement | null>;
	retry: () => void;
	loadingLabel: string;
}) {
	return (
		<>
			{footerState !== "exhausted" ? (
				<div
					ref={sentinelRef}
					className="pointer-events-none h-px w-full shrink-0"
					aria-hidden
				/>
			) : null}
			<div
				className="flex min-h-10 justify-center pt-4 pb-8"
				aria-live="polite"
				aria-busy={footerState === "loading"}
			>
				{footerState === "loading" ? (
					<>
						<Loader2
							className="size-7 animate-spin text-muted-foreground"
							aria-hidden
						/>
						<span className="sr-only">{loadingLabel}</span>
					</>
				) : null}
				{footerState === "error" ? (
					<p className="text-center text-muted-foreground text-sm">
						Something jammed loading more —{" "}
						<button
							type="button"
							className="underline decoration-dashed underline-offset-2 hover:text-foreground"
							onClick={retry}
						>
							try again
						</button>
						.
					</p>
				) : null}
			</div>
		</>
	);
}
```
Remove the now-unused `Loader2` import from `community-lists-infinite.tsx` (it lives in the footer now).

- [ ] **Step 3: Type-check**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep -E "community-lists-infinite|community-infinite-footer"`
Expected: NO output. (Verify `ListLobbySeed.id` is a string — `getKey` returns it; and confirm `readViewerTimeZone` is exported from `@/lib/home-leaderboard-period`.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/home/community-lists-infinite.tsx apps/web/src/components/home/community-infinite-footer.tsx
git commit -m "feat(community): infinite-scroll Lists feed"
```

---

## Task 8: `CommunityReviewsInfinite` component

**Files:**
- Create: `apps/web/src/components/home/community-reviews-infinite.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/home/community-reviews-infinite.tsx
"use client";

import { useCallback } from "react";

import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { ReviewCard } from "@/components/review/review-card";
import {
	type HomeCommunityReviewRow,
	mapCommunityReviewRow,
} from "@/lib/home-community-core-fetch";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	COMMUNITY_REVIEWS_LIMIT,
	fetchCommunityReviewsRecent,
} from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function CommunityReviewsInfinite({
	seeds,
	initialCursor,
	period,
}: {
	seeds: HomeCommunityReviewRow[];
	initialCursor: number | null;
	period: HomeLeaderboardPeriod;
}) {
	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const raw = await fetchCommunityReviewsRecent(period, readViewerTimeZone(), {
				page,
				signal,
			});
			if (raw == null) return { error: true as const };
			const items = raw
				.map(mapCommunityReviewRow)
				.filter((r): r is HomeCommunityReviewRow => r != null);
			return {
				items,
				nextCursor: raw.length >= COMMUNITY_REVIEWS_LIMIT ? page + 1 : null,
			};
		},
		[period],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		HomeCommunityReviewRow,
		number
	>({
		seeds,
		initialCursor,
		loadMore,
		getKey: (r) => r.id,
	});

	return (
		<>
			<p className="mx-auto mb-4 max-w-2xl text-center text-muted-foreground text-xs leading-relaxed">
				Ranked by likes and replies in this period — not review length.
			</p>
			<ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
				{items.map((review) => (
					<li key={review.id}>
						<ReviewCard review={review} />
					</li>
				))}
			</ul>
			<CommunityInfiniteFooter
				footerState={footerState}
				sentinelRef={sentinelRef}
				retry={retry}
				loadingLabel="Loading more reviews"
			/>
		</>
	);
}
```
Note: `nextCursor` uses `raw.length` (the unmapped row count) so a page that fully maps-to-null still advances correctly; `items` (mapped) feed the list.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep "community-reviews-infinite"`
Expected: NO output. (Confirm `ReviewCard`'s `review` prop type accepts `HomeCommunityReviewRow` — it is the same shape passed today in `home-community-lobby.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/community-reviews-infinite.tsx
git commit -m "feat(community): infinite-scroll Reviews feed"
```

---

## Task 9: `CommunityActivityInfinite` component

**Files:**
- Create: `apps/web/src/components/home/community-activity-infinite.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/home/community-activity-infinite.tsx
"use client";

import { useCallback, useMemo } from "react";

import { ActivityItem } from "@/components/feed/activity-item";
import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { HomeFriendActivityRail } from "@/components/home/home-friend-activity-rail";
import {
	type HomeCommunityActivityItem,
	homeCommunityActivityRowKey,
	parseFeedApiActivityItems,
} from "@/lib/home-community-activity";
import { deriveFriendRailEntries } from "@/lib/home-friend-rail";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	COMMUNITY_ACTIVITY_LIMIT,
	fetchCommunityActivity,
} from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function CommunityActivityInfinite({
	seeds,
	initialCursor,
	period,
	signedIn,
}: {
	seeds: HomeCommunityActivityItem[];
	initialCursor: string | null;
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
}) {
	const loadMore = useCallback(
		async (before: string, signal: AbortSignal) => {
			const payload = await fetchCommunityActivity(
				period,
				readViewerTimeZone(),
				signedIn,
				{ before, signal },
			);
			if (payload == null) return { error: true as const };
			const items = parseFeedApiActivityItems(payload);
			const last = items[items.length - 1];
			return {
				items,
				nextCursor:
					items.length >= COMMUNITY_ACTIVITY_LIMIT && last ? last.at : null,
			};
		},
		[period, signedIn],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		HomeCommunityActivityItem,
		string
	>({
		seeds,
		initialCursor,
		loadMore,
		getKey: homeCommunityActivityRowKey,
	});

	const friendRailEntries = useMemo(
		() => deriveFriendRailEntries(items),
		[items],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
					{items.map((item) => (
						<li key={homeCommunityActivityRowKey(item)}>
							<ActivityItem item={item} />
						</li>
					))}
				</ul>
				<CommunityInfiniteFooter
					footerState={footerState}
					sentinelRef={sentinelRef}
					retry={retry}
					loadingLabel="Loading more activity"
				/>
			</div>
			{friendRailEntries.length > 0 ? (
				<HomeFriendActivityRail entries={friendRailEntries} />
			) : null}
		</div>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep "community-activity-infinite"`
Expected: NO output. (Confirm `ActivityItem`'s `item` prop accepts `HomeCommunityActivityItem`, and `deriveFriendRailEntries` accepts `HomeCommunityActivityItem[]` — both are used the same way in `home-community-lobby.tsx` today.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/community-activity-infinite.tsx
git commit -m "feat(community): infinite-scroll Activity feed (before-cursor)"
```

---

## Task 10: Wire lobby + simplify params context; remove dead code

**Files:**
- Modify: `apps/web/src/components/home/home-community-patron-shell.tsx`
- Modify: `apps/web/src/components/home/home-community-lobby.tsx`
- Modify: `apps/web/src/components/home/home-community-lobby-params-context.tsx`
- Remove (if unused): `apps/web/src/lib/community-period-filter.ts`, `apps/web/src/lib/home-community-core-fetch.ts`'s `fetchHomeCommunityCore`

- [ ] **Step 1: Reshape the params context to drop the all-feeds bundle**

In `home-community-lobby-params-context.tsx`:
- Change `HomeCommunityBundledData` → the provider now takes a `seed: CommunityFeedSeed`, `feed: HomeCommunityFeed`, `period: HomeLeaderboardPeriod`, and `signedIn`.
- REMOVE the client period-filtering: delete the `filterListSeedsByCommunityPeriod` / `filterReviewsByCommunityPeriod` / `filterActivityByCommunityPeriod` imports and the `listSeeds`/`reviews`/`activityItems` `useMemo`s, and the signed-in `fetchCommunityActivity` effect + `activityItemsAll` state (pagination now owns that).
- KEEP: the leaderboard-deferral state machine (`filmLeaderboardsByPeriod`, `tvLeaderboardsByPeriod`, `leaderboardsLoading/Failed`, `retryLeaderboards`, the fetch effect) and `selectFeed`/`selectPeriod`/navigation.
- The context value now exposes: `feed`, `period`, the raw `seed`, `leaderboard`, `leaderboardsLoading`, `leaderboardsFailed`, `retryLeaderboards`, `selectFeed`, `selectPeriod`. Derive `feed`/`period` from the `feed`/`period` props (URL-resolved upstream) rather than re-parsing — but KEEP reading `useSearchParams` for the `pending`/optimistic chip state so chip taps feel instant (set `pending` on select, clear when props catch up). Use the incoming `feed`/`period` props as the committed state.

Concretely, the provider signature becomes:
```tsx
export function HomeCommunityLobbyParamsProvider({
	seed,
	feed,
	period,
	signedIn,
	children,
}: {
	seed: CommunityFeedSeed;
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
	children: ReactNode;
}) { ... }
```
and the snapshot/`active` logic uses `{ feed, period }` from props as the committed value, with the existing `pending` optimistic overlay driven by `selectFeed`/`selectPeriod` (compare against the `feed`/`period` props to clear pending). Expose `seed` on the context value.

> This is the most involved edit. Keep the leaderboard block character-for-character; only the bundle/period-filter/activity-refetch parts are removed and the snapshot source changes from `useSearchParams` to the `feed`/`period` props (with `pending` retained for snappy chips).

- [ ] **Step 2: Update `HomeCommunityPatronProviders` + `HomeCommunityPatronBody`**

In `home-community-patron-shell.tsx`:
```tsx
"use client";

import type { ReactNode } from "react";

import { HomeCommunityLobby } from "@/components/home/home-community-lobby";
import {
	HomeCommunityLobbyParamsProvider,
	useHomeCommunityLobbyParams,
} from "@/components/home/home-community-lobby-params-context";
import type { CommunityFeedSeed } from "@/lib/home-community-core-fetch";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";

export function HomeCommunityPatronBody({
	monochromePeersOnHover,
	signedIn,
	viewerUserId,
}: {
	monochromePeersOnHover: boolean;
	signedIn: boolean;
	viewerUserId: string | null;
}) {
	const { feed, period, seed, leaderboard } = useHomeCommunityLobbyParams();
	return (
		<HomeCommunityLobby
			feed={feed}
			period={period}
			seed={seed}
			leaderboard={leaderboard}
			monochromePeersOnHover={monochromePeersOnHover}
			signedIn={signedIn}
			viewerUserId={viewerUserId}
		/>
	);
}

export function HomeCommunityPatronProviders({
	seed,
	feed,
	period,
	signedIn,
	children,
}: {
	seed: CommunityFeedSeed;
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
	children: ReactNode;
}) {
	return (
		<HomeCommunityLobbyParamsProvider
			seed={seed}
			feed={feed}
			period={period}
			signedIn={signedIn}
		>
			{children}
		</HomeCommunityLobbyParamsProvider>
	);
}
```

- [ ] **Step 3: Rewrite `home-community-lobby.tsx` to render the infinite feeds**

Replace the props + the lists/reviews/activity branches. Keep the leaderboard branch and the empty states. The component signature becomes:
```tsx
export function HomeCommunityLobby({
	feed,
	period,
	seed,
	leaderboard,
	monochromePeersOnHover,
	signedIn,
	viewerUserId,
}: {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	seed: CommunityFeedSeed;
	leaderboard: LeaderboardPayload | null;
	monochromePeersOnHover: boolean;
	signedIn: boolean;
	viewerUserId: string | null;
}) { ... }
```
- Leaderboard branch (`isHomeLeaderboardFeed(feed)`): unchanged (uses `leaderboard`).
- Lists branch: when `seed.listSeeds.length === 0` show the existing empty state; else:
```tsx
		return (
			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<HomeCuratorSpotlights patrons={seed.curatorSpotlights} />
				<CommunityListsInfinite
					seeds={seed.listSeeds}
					initialCursor={seed.initialListCursor}
					period={period}
					monochromePeersOnHover={monochromePeersOnHover}
				/>
			</div>
		);
```
- Reviews branch: empty state when `seed.reviews.length === 0`; else:
```tsx
		return (
			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<CommunityReviewsInfinite
					seeds={seed.reviews}
					initialCursor={seed.initialReviewCursor}
					period={period}
				/>
			</div>
		);
```
- Activity branch: empty state when `seed.activityItems.length === 0` (keep the existing `HomeEditorialHighlights` + empty copy); else:
```tsx
		return (
			<CommunityActivityInfinite
				seeds={seed.activityItems}
				initialCursor={seed.initialActivityCursor}
				period={period}
				signedIn={signedIn}
			/>
		);
```
Add imports for `CommunityListsInfinite`, `CommunityReviewsInfinite`, `CommunityActivityInfinite`, `CommunityFeedSeed`, and `HomeLeaderboardPeriod`. Remove now-unused imports (`ListsLobbyCatalogue`, `ActivityItem`, `ReviewCard`, `HomeFriendActivityRail`, `homeCommunityActivityRowKey`, the `CommunityReviewCard` local type, `deriveFriendRailEntries` if it moved) — let the type-check tell you which are unused and delete them.

- [ ] **Step 4: Remove dead code**

Run: `rg "fetchHomeCommunityCore|community-period-filter|HomeCommunityBundledData" apps/web/src`
- If `fetchHomeCommunityCore` has no remaining callers, delete it from `home-community-core-fetch.ts` (keep `fetchHomeCommunityFeedSeed`, `mapCommunityReviewRow`, types).
- If `community-period-filter.ts` has no remaining importers, `git rm apps/web/src/lib/community-period-filter.ts`.
- Remove the now-unused `HomeCommunityBundledData` export if nothing references it.
If anything still imports them, leave them and note it.

- [ ] **Step 5: Full type-check + tests**

Run: `cd apps/web && bunx tsc --noEmit 2>&1 | grep -E "community|home/page|still-api-fetch|use-infinite-pager"`
Expected: NO output. Investigate/fix any community-related error. (Pre-existing unrelated errors — e.g. test files importing `vitest` — are acceptable; note them.)

Run: `bun test apps/web/src/lib/use-infinite-pager.test.ts apps/server/src/lib/community-page-args.test.ts`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Start the app (`bun run dev`). Open `/home?browse=community`:
- Network shows ONE feed request on load (not four). Switch to `?sort=reviews`, `?sort=activity`, `?sort=lists` — each re-seeds one feed.
- Scroll each feed → a follow-up request loads more (lists/reviews `?page=2`; activity `?before=`), appended without dupes.
- Period chips re-seed page 1.
- Logged-out: Activity shows the discover snapshot (no infinite scroll); Film/TV ranks still defer + render.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/home/home-community-patron-shell.tsx apps/web/src/components/home/home-community-lobby.tsx apps/web/src/components/home/home-community-lobby-params-context.tsx apps/web/src/lib/home-community-core-fetch.ts
git rm apps/web/src/lib/community-period-filter.ts
git commit -m "feat(community): active-feed-only lobby wiring + infinite feeds; drop client period-filter"
```

---

## Self-Review Notes

- **Spec coverage:** §1 hook → Task 4; §2 server pagination → Tasks 1–3; §3 RSC active-feed → Task 6; §4 per-feed components → Tasks 7–9; §5 context simplification → Task 10; §6 testing → Tasks 1, 4 unit + Task 10 manual. Decomposition order matches the spec's 6 phases.
- **Type consistency:** `CommunityFeedSeed` (Task 6) is consumed unchanged in Tasks 7–10; `useInfinitePager<T,C>` + `LoadMoreResult` (Task 4) are used with `<ListLobbySeed, number>`, `<HomeCommunityReviewRow, number>`, `<HomeCommunityActivityItem, string>` in Tasks 7–9; `mapCommunityReviewRow` (Task 5) used in Tasks 6 + 8; client limit constants (Task 5) used in Tasks 6–9; `fetchCommunity*` signatures (Task 5) match call sites (Tasks 7–9).
- **Backward compatibility:** server changes are additive (Tasks 2–3); other consumers of `/api/lists`, `/api/reviews/recent`, `/api/feed` are unaffected when the new params are absent.
- **Known intermediate state:** Task 6 leaves type errors on `HomeCommunityPatronProviders` props until Task 10 finishes the wiring (called out in Task 6 Step 4).
- **Deferred follow-up (out of scope):** retrofitting `DiaryLobbyInfinite` onto `useInfinitePager`.
