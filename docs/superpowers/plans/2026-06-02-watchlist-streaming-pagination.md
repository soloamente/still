# Watchlist Streaming + Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/watchlist` paint its shell instantly and stream a paginated, sorted, infinite-scrolling poster wall (home-style) instead of blocking on one all-at-once fetch.

**Architecture:** `GET /api/watchlist` becomes paginated + server-sorted, with the "hide watched" rule moved into SQL (`NOT EXISTS`) so `LIMIT/OFFSET` apply post-filter. The shared `PopularMoviesInfinite` component gains an optional `loadPage` injection (and a `getDedupeKey`) so it can page a personal list. The watchlist page streams only the grid via `<Suspense>`; the first page (24) is server-rendered, the rest load on scroll via a new client fetcher.

**Tech Stack:** Elysia + Drizzle (server), Next.js 16 / React 19 App Router (web), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-02-watchlist-streaming-pagination-design.md`

---

## File Structure

**Server**
- `apps/server/src/lib/watchlist-query-args.ts` (new) — pure parse/clamp/offset/total-pages helpers. One responsibility: turn raw query strings + counts into validated numbers.
- `apps/server/src/lib/watchlist-query-args.test.ts` (new) — unit tests for the above.
- `apps/server/src/routes/watchlist.ts` (modify) — paginated + sorted GET, SQL seen-filter.
- `apps/server/src/lib/watchlist-seen-filter.ts` + `.test.ts` (delete) — replaced by SQL.

**Web**
- `apps/web/src/lib/watchlist-lobby-order.ts` (modify) — add `WATCHLIST_PAGE_SIZE` and move `watchlistRowToPopularSeed` here (shared by client fetcher + server helper). Drop the now-unused client sort helpers.
- `apps/web/src/lib/still-api-fetch.ts` (modify) — add `fetchMyWatchlist` (client load-more).
- `apps/web/src/lib/fetch-my-watchlist-server.ts` (new) — RSC helper for page 1.
- `apps/web/src/components/movie/popular-movies-infinite.tsx` (modify) — `loadPage` + `getDedupeKey` injections.
- `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx` (modify) — wire pager, derive cell keys, host empty state.
- `apps/web/src/components/watchlist/watchlist-patron-lobby-shell.tsx` (modify) — becomes chrome + slot (provider + chips + children).
- `apps/web/src/components/watchlist/watchlist-lobby-fallback.tsx` (new) — grid shimmer fallback.
- `apps/web/src/app/(app)/watchlist/page.tsx` (modify) — read `searchParams.order`, stream grid in `<Suspense>`.

---

## Task 1: Server — pure query-args helpers (TDD)

**Files:**
- Create: `apps/server/src/lib/watchlist-query-args.ts`
- Test: `apps/server/src/lib/watchlist-query-args.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/watchlist-query-args.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	parseWatchlistLimit,
	parseWatchlistOrder,
	parseWatchlistPage,
	WATCHLIST_DEFAULT_LIMIT,
	WATCHLIST_MAX_LIMIT,
	watchlistOffset,
	watchlistTotalPages,
} from "./watchlist-query-args";

describe("parseWatchlistPage", () => {
	test("defaults to 1 for missing / junk / sub-1 values", () => {
		expect(parseWatchlistPage(undefined)).toBe(1);
		expect(parseWatchlistPage("nope")).toBe(1);
		expect(parseWatchlistPage("0")).toBe(1);
		expect(parseWatchlistPage("-4")).toBe(1);
	});
	test("floors valid pages", () => {
		expect(parseWatchlistPage("3")).toBe(3);
		expect(parseWatchlistPage("3.9")).toBe(3);
	});
});

describe("parseWatchlistLimit", () => {
	test("defaults when missing / junk / sub-1", () => {
		expect(parseWatchlistLimit(undefined)).toBe(WATCHLIST_DEFAULT_LIMIT);
		expect(parseWatchlistLimit("nope")).toBe(WATCHLIST_DEFAULT_LIMIT);
		expect(parseWatchlistLimit("0")).toBe(WATCHLIST_DEFAULT_LIMIT);
	});
	test("clamps to max", () => {
		expect(parseWatchlistLimit("9999")).toBe(WATCHLIST_MAX_LIMIT);
	});
	test("passes through valid limits", () => {
		expect(parseWatchlistLimit("12")).toBe(12);
	});
});

describe("parseWatchlistOrder", () => {
	test("accepts known orders", () => {
		expect(parseWatchlistOrder("earliest_added")).toBe("earliest_added");
		expect(parseWatchlistOrder("title_az")).toBe("title_az");
		expect(parseWatchlistOrder("latest_added")).toBe("latest_added");
	});
	test("defaults unknown to latest_added", () => {
		expect(parseWatchlistOrder(undefined)).toBe("latest_added");
		expect(parseWatchlistOrder("garbage")).toBe("latest_added");
	});
});

describe("watchlistOffset", () => {
	test("page 1 → 0; page 3, limit 24 → 48", () => {
		expect(watchlistOffset(1, 24)).toBe(0);
		expect(watchlistOffset(3, 24)).toBe(48);
	});
});

describe("watchlistTotalPages", () => {
	test("ceils total / limit; 0 for empty", () => {
		expect(watchlistTotalPages(0, 24)).toBe(0);
		expect(watchlistTotalPages(24, 24)).toBe(1);
		expect(watchlistTotalPages(25, 24)).toBe(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/watchlist-query-args.test.ts`
Expected: FAIL — `Cannot find module './watchlist-query-args'`.

- [ ] **Step 3: Write the implementation**

Create `apps/server/src/lib/watchlist-query-args.ts`:

```ts
/**
 * Pure query-arg helpers for `GET /api/watchlist` pagination + sort. Kept separate
 * from the route so the parsing/clamp/offset math is unit-testable without a DB.
 */
export type WatchlistOrder = "latest_added" | "earliest_added" | "title_az";

export const WATCHLIST_DEFAULT_LIMIT = 24;
export const WATCHLIST_MAX_LIMIT = 60;

export function parseWatchlistPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function parseWatchlistLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return WATCHLIST_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), WATCHLIST_MAX_LIMIT);
}

export function parseWatchlistOrder(raw: string | undefined): WatchlistOrder {
	if (raw === "earliest_added" || raw === "title_az" || raw === "latest_added") {
		return raw;
	}
	return "latest_added";
}

export function watchlistOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}

export function watchlistTotalPages(total: number, limit: number): number {
	if (total <= 0 || limit <= 0) return 0;
	return Math.ceil(total / limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/watchlist-query-args.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/watchlist-query-args.ts apps/server/src/lib/watchlist-query-args.test.ts
git commit -m "feat(watchlist): pure pagination/sort query-arg helpers"
```

---

## Task 2: Server — paginated + sorted GET with SQL seen-filter

**Files:**
- Modify: `apps/server/src/routes/watchlist.ts` (the `.get("/")` handler + imports)
- Delete: `apps/server/src/lib/watchlist-seen-filter.ts`, `apps/server/src/lib/watchlist-seen-filter.test.ts`

- [ ] **Step 1: Delete the old in-app filter (now superseded by SQL)**

```bash
git rm apps/server/src/lib/watchlist-seen-filter.ts apps/server/src/lib/watchlist-seen-filter.test.ts
```

- [ ] **Step 2: Replace imports at the top of `apps/server/src/routes/watchlist.ts`**

Replace the current top imports:

```ts
import { db, log, movie, tv, watchlistItem } from "@still/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { hit } from "../lib/rate-limit";
import { routeBody } from "../lib/route-body";
import { filterUnseenWatchlistRows } from "../lib/watchlist-seen-filter";
```

with:

```ts
import { db, log, movie, tv, watchlistItem } from "@still/db";
import { and, asc, count, desc, eq, isNotNull, notExists, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { hit } from "../lib/rate-limit";
import { routeBody } from "../lib/route-body";
import {
	parseWatchlistLimit,
	parseWatchlistOrder,
	parseWatchlistPage,
	watchlistOffset,
	watchlistTotalPages,
} from "../lib/watchlist-query-args";
```

- [ ] **Step 3: Replace the `.get("/")` handler body**

Replace the entire current `.get("/", …)` block (the handler that returns `rows`, plus its `{ query: t.Object({ limit: ... }) }` options) with:

```ts
	.get(
		"/",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const page = parseWatchlistPage(query.page);
			const limit = parseWatchlistLimit(query.limit);
			const order = parseWatchlistOrder(query.order);
			const offset = watchlistOffset(page, limit);

			// Hide-watched (Letterbox-shaped): drop any saved title with a diary log.
			// As a SQL clause so LIMIT/OFFSET apply *after* filtering.
			const notWatched = notExists(
				db
					.select({ one: sql`1` })
					.from(log)
					.where(
						and(
							eq(log.userId, user.id),
							or(
								and(
									isNotNull(watchlistItem.movieId),
									eq(log.movieId, watchlistItem.movieId),
								),
								and(
									isNotNull(watchlistItem.tvId),
									eq(log.tvId, watchlistItem.tvId),
								),
							),
						),
					),
			);

			const whereClause = and(eq(watchlistItem.userId, user.id), notWatched);

			// Deterministic tiebreaker so pages never overlap or skip.
			const tiebreak = sql`coalesce(${watchlistItem.movieId}, ${watchlistItem.tvId})`;
			const titleExpr = sql`coalesce(${movie.title}, ${tv.title})`;
			const orderBy =
				order === "earliest_added"
					? [asc(watchlistItem.addedAt), tiebreak]
					: order === "title_az"
						? [asc(titleExpr), desc(watchlistItem.addedAt), tiebreak]
						: [desc(watchlistItem.addedAt), tiebreak];

			const [rows, totals] = await Promise.all([
				db
					.select({ item: watchlistItem, movie, tv })
					.from(watchlistItem)
					.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
					.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(limit)
					.offset(offset),
				db
					.select({ total: count() })
					.from(watchlistItem)
					.where(whereClause),
			]);

			const total = Number(totals[0]?.total ?? 0);
			return {
				results: rows,
				total_pages: watchlistTotalPages(total, limit),
				total_results: total,
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
				order: t.Optional(t.String()),
			}),
		},
	)
```

Leave the `.post`, `.delete`, and `.get("/check/...")` handlers unchanged.

- [ ] **Step 4: Typecheck the server**

Run: `cd apps/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iv "TS5055" | grep -i error`
Expected: no output (the `TS5055` lines are pre-existing stale-`dist` noise, unrelated to this change).

- [ ] **Step 5: Run server lib + route tests**

Run: `bun test apps/server/src/lib/watchlist-query-args.test.ts apps/server/src/routes/lists.test.ts`
Expected: PASS, and no test references the deleted `watchlist-seen-filter`.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/watchlist.ts
git commit -m "feat(watchlist): paginate + sort GET, move hide-watched into SQL"
```

---

## Task 3: Web — shared row→seed transform + page size constant

**Files:**
- Modify: `apps/web/src/lib/watchlist-lobby-order.ts`

This moves `watchlistRowToPopularSeed` out of the client shell so both the client load-more fetcher and the RSC helper can reuse it, and adds the shared page size.

- [ ] **Step 1: Add the page size + transform to `watchlist-lobby-order.ts`**

At the top of the file, add the import (types only — erased at runtime, safe to import from a client module):

```ts
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
```

Then add, near the top after the `DEFAULT_ORDER` constant:

```ts
/** First-page size; mirrors the server `WATCHLIST_DEFAULT_LIMIT`. */
export const WATCHLIST_PAGE_SIZE = 24;
```

And add this function (moved verbatim from the shell, now exported):

```ts
/** Map a joined watchlist row to the poster seed shape the lobby grid renders. */
export function watchlistRowToPopularSeed(
	row: WatchlistLobbyRowWithListing,
): PopularMovieSeed {
	const listing = row.movie ?? row.tv;
	if (!listing) {
		throw new Error("watchlistRowToPopularSeed: row missing movie and tv");
	}
	let poster_url: string | null = listing.posterPath;
	if (poster_url?.length && !poster_url.startsWith("http")) {
		const fragment = poster_url.startsWith("/") ? poster_url : `/${poster_url}`;
		poster_url = `https://image.tmdb.org/t/p/w780${fragment}`;
	}
	return {
		id: listing.tmdbId,
		title: listing.title,
		poster_url,
		listingKind: row.tv != null ? "tv" : "movie",
	};
}
```

- [ ] **Step 2: Remove now-unused client sort helpers**

The server now sorts, so the client no longer sorts rows. Delete `compareWatchlistLobbyRows` and `sortWatchlistLobbyRowsForOrder` and the `listingTitle` helper from this file (they are only used by the shell, which Task 5 rewrites). Keep `parseWatchlistLobbyOrder`, `buildWatchlistLobbyHref`, `isWatchlistRowWithListing`, the types, and the new `watchlistRowToPopularSeed`.

- [ ] **Step 3: Typecheck web (expect transient errors in shell — fixed in Task 5)**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -E "watchlist-lobby-order" | head`
Expected: no errors *originating in* `watchlist-lobby-order.ts` itself. (Errors in `watchlist-patron-lobby-shell.tsx` about the removed exports are expected and resolved in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/watchlist-lobby-order.ts
git commit -m "refactor(watchlist): share row→seed transform + page size, drop client sort"
```

---

## Task 4: Web — client + server fetchers for the paginated endpoint

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Create: `apps/web/src/lib/fetch-my-watchlist-server.ts`

- [ ] **Step 1: Add `fetchMyWatchlist` to `still-api-fetch.ts`**

Add this near the other watchlist helpers (e.g. after `fetchWatchlistCheckTv`). Add the imports at the top of the file if not present:

```ts
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import {
	isWatchlistRowWithListing,
	watchlistRowToPopularSeed,
	type WatchlistLobbyRow,
} from "@/lib/watchlist-lobby-order";
```

Function:

```ts
/**
 * Client load-more for the watchlist lobby — pages the personal list and maps
 * rows to poster seeds for `PopularMoviesInfinite`'s injected `loadPage`.
 */
export async function fetchMyWatchlist(
	page: number,
	opts: { order: string; signal?: AbortSignal },
): Promise<{ results: PopularMovieSeed[]; total_pages: number } | { error: true }> {
	const url = new URL("/api/watchlist", stillApiOrigin());
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	url.searchParams.set("order", opts.order);
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts.signal,
	});
	if (!response.ok) return { error: true };
	const raw = (await response.json().catch(() => null)) as
		| { results?: WatchlistLobbyRow[]; total_pages?: number }
		| null;
	if (!raw || !Array.isArray(raw.results)) return { error: true };
	const results = raw.results
		.filter(isWatchlistRowWithListing)
		.map(watchlistRowToPopularSeed);
	return {
		results,
		total_pages: typeof raw.total_pages === "number" ? raw.total_pages : page,
	};
}
```

- [ ] **Step 2: Create the RSC helper `fetch-my-watchlist-server.ts`**

Create `apps/web/src/lib/fetch-my-watchlist-server.ts`:

```ts
import "server-only";

import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { serverApi } from "@/lib/server-api";
import {
	isWatchlistRowWithListing,
	watchlistRowToPopularSeed,
	WATCHLIST_PAGE_SIZE,
	type WatchlistLobbyRow,
} from "@/lib/watchlist-lobby-order";

/**
 * RSC helper for page 1 of **`GET /api/watchlist`** — forwards the visitor's
 * cookies via Eden and returns poster seeds + pagination meta for the lobby.
 */
export async function fetchMyWatchlistServer(opts: {
	order: string;
}): Promise<{
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
}> {
	try {
		const client = await serverApi();
		const res = await client.api.watchlist.get({
			query: {
				page: "1",
				limit: String(WATCHLIST_PAGE_SIZE),
				order: opts.order,
			},
		});
		if (res.error != null) {
			console.error("[fetchMyWatchlistServer] failed:", res.error);
			return { seeds: [], totalPages: 0, totalResults: 0 };
		}
		const data = res.data as {
			results?: WatchlistLobbyRow[];
			total_pages?: number;
			total_results?: number;
		} | null;
		const rows = Array.isArray(data?.results) ? data.results : [];
		const seeds = rows
			.filter(isWatchlistRowWithListing)
			.map(watchlistRowToPopularSeed);
		return {
			seeds,
			totalPages: typeof data?.total_pages === "number" ? data.total_pages : 1,
			totalResults:
				typeof data?.total_results === "number"
					? data.total_results
					: seeds.length,
		};
	} catch (err) {
		console.error("[fetchMyWatchlistServer] threw:", err);
		return { seeds: [], totalPages: 0, totalResults: 0 };
	}
}
```

- [ ] **Step 3: Typecheck web**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -E "still-api-fetch|fetch-my-watchlist-server" | head`
Expected: no errors in these two files.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/still-api-fetch.ts apps/web/src/lib/fetch-my-watchlist-server.ts
git commit -m "feat(watchlist): client + server fetchers for paginated endpoint"
```

---

## Task 5: Web — extend `PopularMoviesInfinite` with `loadPage` + `getDedupeKey`

**Files:**
- Modify: `apps/web/src/components/movie/popular-movies-infinite.tsx`

- [ ] **Step 1: Add the two optional props to `PopularMoviesInfiniteProps`**

In the `interface PopularMoviesInfiniteProps` block, add:

```ts
	/**
	 * Personal-list pager. When provided, `loadMore` calls this instead of the TMDb
	 * fetch switch — used by `/watchlist` to page its own server endpoint.
	 */
	loadPage?: (
		page: number,
	) => Promise<{ results: PopularMovieSeed[]; total_pages: number } | { error: true }>;
	/**
	 * Stable cross-page dedupe key. Defaults to `String(m.id)`; mixed movie+tv grids
	 * (watchlist) must disambiguate a film and show sharing a TMDb id.
	 */
	getDedupeKey?: (m: PopularMovieSeed) => string;
```

- [ ] **Step 2: Destructure the new props**

In the function signature destructuring (where `getPosterCellKey` etc. are pulled), add:

```ts
	loadPage,
	getDedupeKey,
```

- [ ] **Step 3: Branch `loadMore` on `loadPage`**

Inside `loadMore`, replace the TMDb fetch block — i.e. the `const { data, error } = catalogKind === "upcoming" ? … : await fetchMoviesPopular(next);` assignment plus the immediately following:

```ts
			loadingRef.current = false;

			if (error || !data || typeof data !== "object") {
				setFooterState("error");
				return;
			}

			const pageData = data as {
				results?: PopularMovieSeed[];
				total_pages?: number;
			};
```

with this (the `try {` line above it and everything after `const batch = …` stays the same):

```ts
			let pageData: { results?: PopularMovieSeed[]; total_pages?: number } | null =
				null;

			if (loadPage) {
				const res = await loadPage(next);
				loadingRef.current = false;
				if ("error" in res) {
					setFooterState("error");
					return;
				}
				pageData = res;
			} else {
				const isTv = catalogMedia === "tv";
				const { data, error } =
					catalogKind === "upcoming"
						? await fetchMoviesUpcoming(next, {
								region: upcomingReleaseRegion ?? undefined,
							})
						: catalogKind === "now_playing"
							? await fetchMoviesNowPlaying(next)
							: catalogKind === "on_the_air"
								? await fetchTvOnTheAir(next, {
										sortBy: discoverSortBy,
									})
								: catalogKind === "discover"
									? isTv
										? await fetchTvDiscover(next, {
												genreId: discoverGenreId ?? undefined,
												sortBy: discoverSortBy,
												airDateGte: discoverAirDateGte ?? undefined,
												monetization: discoverMonetization ?? undefined,
												watchRegion: discoverWatchRegion ?? undefined,
												status: discoverTvStatus ?? undefined,
											})
										: await fetchMoviesDiscover(next, {
												genreId: discoverGenreId ?? undefined,
												companyId: discoverCompanyId ?? undefined,
												sortBy: discoverSortBy,
												venue:
													catalogMedia === "movie" &&
													(discoverVenue === "theaters" ||
														discoverVenue === "streaming")
														? discoverVenue
														: undefined,
												monetization: discoverMonetization ?? undefined,
												watchRegion: discoverWatchRegion ?? undefined,
												region: discoverReleaseRegion ?? undefined,
												releaseGte: discoverReleaseGte ?? undefined,
											})
									: isTv
										? await fetchTvPopular(next)
										: await fetchMoviesPopular(next);

				loadingRef.current = false;

				if (error || !data || typeof data !== "object") {
					setFooterState("error");
					return;
				}
				pageData = data as {
					results?: PopularMovieSeed[];
					total_pages?: number;
				};
			}
```

(The existing lines that follow — `const batch = Array.isArray(pageData.results) ? pageData.results : [];` onward — remain unchanged.)

- [ ] **Step 4: Use `getDedupeKey` in the merge**

Replace the merge block:

```ts
				setItems((prev) => {
					const seen = new Set(prev.map((m) => m.id));
					const out = [...prev];
					for (const row of batch) {
						if (!seen.has(row.id)) {
							seen.add(row.id);
							out.push(row);
						}
					}
					return out;
				});
```

with:

```ts
				const keyOf = getDedupeKey ?? ((m: PopularMovieSeed) => String(m.id));
				setItems((prev) => {
					const seen = new Set(prev.map(keyOf));
					const out = [...prev];
					for (const row of batch) {
						const k = keyOf(row);
						if (!seen.has(k)) {
							seen.add(k);
							out.push(row);
						}
					}
					return out;
				});
```

- [ ] **Step 5: Add the new props to `loadMore`'s dependency array**

In the `useCallback` dependency list for `loadMore`, add `loadPage,` and `getDedupeKey,`.

- [ ] **Step 6: Typecheck web**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -E "popular-movies-infinite" | head`
Expected: no errors in this file.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/movie/popular-movies-infinite.tsx
git commit -m "feat(catalogue): loadPage + getDedupeKey injection for personal lists"
```

---

## Task 6: Web — rewire the watchlist catalogue, shell, fallback, and page

**Files:**
- Modify: `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx`
- Modify: `apps/web/src/components/watchlist/watchlist-patron-lobby-shell.tsx`
- Create: `apps/web/src/components/watchlist/watchlist-lobby-fallback.tsx`
- Modify: `apps/web/src/app/(app)/watchlist/page.tsx`

- [ ] **Step 1: Rewrite `watchlist-lobby-catalogue.tsx`**

Replace the whole file with:

```tsx
"use client";

import { buttonVariants } from "@still/ui/components/button";
import Link from "next/link";
import { useCallback } from "react";

import {
	type PopularMovieSeed,
	PopularMoviesInfinite,
} from "@/components/movie/popular-movies-infinite";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { fetchMyWatchlist } from "@/lib/still-api-fetch";

/**
 * Client boundary for the `/watchlist` poster wall — seeds page 1 (server-rendered)
 * and pages the personal list on scroll via `fetchMyWatchlist` (see `loadPage`).
 */
export function WatchlistLobbyCatalogue({
	seeds,
	totalPages,
	totalResults,
	monochromePeersOnHover,
	signedIn = false,
}: {
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	monochromePeersOnHover: boolean;
	signedIn?: boolean;
}) {
	const { order } = useWatchlistLobbyParams();

	// Stable, media-aware key — used for both React cell keys and cross-page dedupe.
	const cellKey = useCallback(
		(m: PopularMovieSeed) => `${m.listingKind ?? "movie"}:${m.id}`,
		[],
	);

	const loadPage = useCallback(
		(page: number) => fetchMyWatchlist(page, { order }),
		[order],
	);

	if (seeds.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
				<div
					className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
					role="status"
				>
					<div className="space-y-2">
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							Your watchlist is empty
						</p>
						<p className="text-muted-foreground text-sm leading-relaxed">
							When something catches your eye, open its page and tap{" "}
							<strong className="text-foreground">Watchlist</strong> — it will
							show up in this lobby wall.
						</p>
					</div>
					<Link
						href="/home"
						className={buttonVariants({ variant: "outline", size: "pill" })}
					>
						Search films and shows
					</Link>
				</div>
			</div>
		);
	}

	return (
		<PopularMoviesInfinite
			blockedReason={null}
			catalogueRadialSurface="watchlist"
			signedIn={signedIn}
			catalogMedia="movie"
			catalogLabel="watchlist"
			catalogueWaveKeyOverride={`watchlist:${order}`}
			getPosterCellKey={cellKey}
			getDedupeKey={cellKey}
			loadPage={loadPage}
			gridClassName={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}
			monochromePeersOnHover={monochromePeersOnHover}
			posterFrameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
			posterHoverEffect="elevation"
			posterLinkClassName={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
			seedMovies={seeds}
			seedPage={1}
			showTitle={false}
			staggerPosterEntrance
			totalPages={totalPages}
			totalResults={totalResults}
		/>
	);
}
```

- [ ] **Step 2: Rewrite `watchlist-patron-lobby-shell.tsx` as chrome + slot**

Replace the whole file with:

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { WatchlistCatalogOrderChips } from "@/components/watchlist/watchlist-catalog-order-chips";
import { WatchlistLobbyParamsProvider } from "@/components/watchlist/watchlist-lobby-params-context";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/**
 * Client `/watchlist` chrome — renders the order chips + view toolbar instantly,
 * then slots in the streamed poster grid (`children`). Order is URL-driven so the
 * server can seed page 1 in the same order the chips show.
 */
export function WatchlistPatronLobbyShell({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<LobbyNavigationProvider>
			<WatchlistLobbyParamsProvider>
				<section
					className={cn(
						HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
						"overflow-visible",
					)}
				>
					<div className="flex shrink-0 items-center justify-between gap-3">
						<WatchlistCatalogOrderChips />
						<HomeCatalogViewModeToolbar />
					</div>
					{children}
				</section>
			</WatchlistLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}
```

- [ ] **Step 3: Create the grid streaming fallback `watchlist-lobby-fallback.tsx`**

Create `apps/web/src/components/watchlist/watchlist-lobby-fallback.tsx`:

```tsx
import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import { HOME_LOBBY_CATALOGUE_GRID_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/** Poster-wall placeholder shown while page 1 of the watchlist streams in. */
export function WatchlistLobbyFallback() {
	return (
		<div className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME} aria-hidden>
			{Array.from({ length: 12 }).map((_, i) => (
				<ShimmerBone
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells
					key={i}
					className="aspect-[2/3] w-full rounded-xl bg-card/60"
				/>
			))}
		</div>
	);
}
```

- [ ] **Step 4: Rewrite `app/(app)/watchlist/page.tsx`**

Replace the whole file with:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { LobbyStickyChromeFallback } from "@/components/app/lobby-suspense-fallbacks";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import { WatchlistPatronLobbyShell } from "@/components/watchlist/watchlist-patron-lobby-shell";
import { authServer } from "@/lib/auth-server";
import { fetchMyWatchlistServer } from "@/lib/fetch-my-watchlist-server";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";
import { parseWatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

/** Streamed grid — only this awaits the (slow) watchlist query. */
async function WatchlistLobbyData({
	order,
	monochromePeersOnHover,
	signedIn,
}: {
	order: string;
	monochromePeersOnHover: boolean;
	signedIn: boolean;
}) {
	const { seeds, totalPages, totalResults } = await fetchMyWatchlistServer({
		order,
	});
	return (
		<WatchlistLobbyCatalogue
			seeds={seeds}
			totalPages={totalPages}
			totalResults={totalResults}
			monochromePeersOnHover={monochromePeersOnHover}
			signedIn={signedIn}
		/>
	);
}

export default async function WatchlistPage({
	searchParams,
}: {
	searchParams: Promise<{ order?: string }>;
}) {
	const sp = await searchParams;
	const order = parseWatchlistLobbyOrder(sp?.order);

	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));

	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
		preferences?: Record<string, unknown> | null;
	} | null;

	const mePrefs = profileData?.preferences ?? null;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
	const needsCatalogWatchRegionPrompt = Boolean(
		session && catalogWatchPref === null,
	);

	const stickyUser =
		session && profileData?.handle
			? {
					id: session.user.id,
					name: session.user.name ?? profileData.displayName ?? "You",
					image: session.user.image ?? null,
					handle: profileData.handle,
					email: session.user.email ?? null,
				}
			: null;

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<WatchlistPatronLobbyShell>
				<Suspense fallback={<WatchlistLobbyFallback />}>
					<WatchlistLobbyData
						order={order}
						monochromePeersOnHover={monochromePeersOnHover}
						signedIn={Boolean(session)}
					/>
				</Suspense>
			</WatchlistPatronLobbyShell>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}
```

Note: `parseWatchlistLobbyOrder` returns the `WatchlistLobbyOrder` union, which is assignable to the `order: string` props here; no cast needed.

- [ ] **Step 5: Typecheck the whole web app**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -iE "watchlist" | head -30`
Expected: no errors in any `watchlist` file (the Task 3 transient shell errors are now resolved).

- [ ] **Step 6: Lint the touched files**

Run: `cd apps/web && npx biome check src/components/watchlist src/app/\(app\)/watchlist/page.tsx src/lib/fetch-my-watchlist-server.ts`
Expected: no errors (fix any formatting/lint nits Biome reports).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/watchlist apps/web/src/app/\(app\)/watchlist/page.tsx
git commit -m "feat(watchlist): stream grid + infinite-scroll the personal list"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the full server + web test suites**

Run: `bun test apps/server/src/lib/watchlist-query-args.test.ts apps/server/src/routes/lists.test.ts`
Then any web unit tests: `cd apps/web && bun test 2>&1 | tail -20`
Expected: all PASS; nothing references the deleted `watchlist-seen-filter`.

- [ ] **Step 2: Typecheck both packages**

Run: `cd apps/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iv "TS5055" | grep -i error` (expect none)
Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -i error | head` (expect none)

- [ ] **Step 3: Manual smoke test (dev server)**

Start the app (project run skill / `bun dev`), sign in, open `/watchlist`, and confirm:
- The sticky header + order chips appear immediately; the poster grid shows the shimmer fallback, then streams in.
- Scrolling near the bottom loads more posters (network shows `GET /api/watchlist?page=2&order=…`).
- Each sort chip (Recently added / Oldest saves / By title) reorders and re-seeds from page 1.
- A title you've logged does **not** appear in the grid.
- An empty watchlist shows the empty-state card.

- [ ] **Step 4: Final commit (if any lint/format fixups remain)**

```bash
git add -A
git commit -m "chore(watchlist): verification fixups"
```

---

## Self-Review Notes

- **Spec §1 (paginated/sorted GET):** Tasks 1–2. ✓
- **Spec §2 (SQL seen-filter, delete helper):** Task 2 steps 1–3. ✓
- **Spec §3 (`loadPage` + `getDedupeKey`):** Task 5. ✓
- **Spec §4 (fetcher, cell keys, catalogue, shell, streaming page):** Tasks 4 & 6. ✓
- **Spec §5 (order reset, exhaustion, empty state, Saved button):** order reset via `waveKey` (Task 6 step 1); exhaustion via existing component logic + accurate `total_pages` (Task 2); empty state in catalogue (Task 6 step 1); Saved button untouched. ✓
- **Spec §6 (pure-helper tests + manual):** Task 1 tests; Task 7 manual. ✓
- **Type consistency:** `loadPage` returns `{ results: PopularMovieSeed[]; total_pages: number } | { error: true }` in Task 5, Task 4 (`fetchMyWatchlist`), and Task 6 (`loadPage` callback) — consistent. `watchlistRowToPopularSeed` / `isWatchlistRowWithListing` / `WATCHLIST_PAGE_SIZE` defined in Task 3, consumed in Task 4. ✓
- **Streaming note:** session+profile are awaited at page top (one fast call) so chrome renders quickly; only the watchlist query (the slow part) is deferred to a `<Suspense>` child — matching the spec's intent without double-fetching the profile.
