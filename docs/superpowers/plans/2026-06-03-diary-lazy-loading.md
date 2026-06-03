# Diary Lazy-Loading + Latest-Seen Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/diary` lazy-load page-by-page on scroll (like `/watchlist` and the profile filmography grid) and give "Latest seen" a deterministic order.

**Architecture:** Add a paginated, grid-shaped `GET /api/logs/me/diary` endpoint modeled on the profile filmography handler (movies one-cell-per-log, TV deduped to newest-per-show with a count + primary scope, venue filter, order, `tabCounts`). Feed page 1 from the RSC into a new self-contained `DiaryLobbyInfinite` client component that pages on scroll and renders diary cells (movie tiles + flip-card TV groups). TV cards lazy-load their full entry list on first flip via the existing `by-tv` endpoint. Fix ordering with a `createdAt`/`id` tiebreaker on both server queries and client comparators.

**Tech Stack:** Elysia + Drizzle (server), Next.js App Router RSC + React client components, `bun:test` for unit tests, Biome for lint/format.

**Spec:** `docs/superpowers/specs/2026-06-03-diary-lazy-loading-design.md`

---

## File Structure

**Create:**
- `apps/server/src/lib/diary-log-query.ts` — pure query-arg parsing/clamp/offset for the diary endpoint (unit-testable without a DB), mirroring `profile-filmography-query.ts`.
- `apps/server/src/lib/diary-log-query.test.ts` — tests for the above.
- `apps/web/src/components/diary/diary-lobby-infinite.tsx` — the diary infinite-scroll grid (seed + page-on-scroll + diary cells).
- `apps/web/src/lib/fetch-my-diary-server.ts` — RSC helper that seeds page 1.

**Modify:**
- `apps/server/src/routes/logs.ts` — add `GET /me/diary`; add `createdAt`/`id` tiebreak to `/recent` and `/by-user/:userId`; remove the old `GET /me`.
- `apps/web/src/lib/diary-lobby-order.ts` — `createdAt`/`id` tiebreak in `compareDiaryLobbyRows`.
- `apps/web/src/lib/diary-lobby-grouping.ts` — `createdAt`/`id` tiebreak in `compareGridItems` + `sortLogsNewestFirst`.
- `apps/web/src/components/diary/diary-entry.tsx` — add `createdAt` to `DiaryLogRow["log"]`.
- `apps/web/src/lib/still-api-fetch.ts` — add `fetchMyDiary` + endpoint row types.
- `apps/web/src/components/diary/diary-tv-group-cell.tsx` — accept a summary (newest log + count + primary scope) and lazy-fetch full logs on flip.
- `apps/web/src/components/diary/diary-patron-lobby-shell.tsx` — feed from seeded page + `tabCounts` instead of full `rawRows`.
- `apps/web/src/app/(app)/diary/page.tsx` — streamed RSC seeding page 1.
- `apps/web/src/lib/diary-lobby-order.test.ts` — comparator tiebreak test.

**Remove:**
- `apps/web/src/lib/fetch-my-logs-me-server.ts` (diary was its only caller).

---

## Task 1: Server diary query-arg helper (pure, TDD)

Mirrors `apps/server/src/lib/profile-filmography-query.ts`. Page size **36** per the spec.

**Files:**
- Create: `apps/server/src/lib/diary-log-query.ts`
- Test: `apps/server/src/lib/diary-log-query.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/lib/diary-log-query.test.ts
import { describe, expect, test } from "bun:test";

import {
	DIARY_DEFAULT_LIMIT,
	DIARY_MAX_LIMIT,
	diaryOffset,
	diaryTotalPages,
	parseDiaryLimit,
	parseDiaryMedia,
	parseDiaryOrder,
	parseDiaryPage,
	parseDiaryVenue,
} from "./diary-log-query";

describe("parseDiaryMedia", () => {
	test("defaults to movie; accepts tv", () => {
		expect(parseDiaryMedia(undefined)).toBe("movie");
		expect(parseDiaryMedia("tv")).toBe("tv");
		expect(parseDiaryMedia("movie")).toBe("movie");
		expect(parseDiaryMedia("junk")).toBe("movie");
	});
});

describe("parseDiaryOrder", () => {
	test("accepts latest/earliest/title; defaults latest", () => {
		expect(parseDiaryOrder("earliest")).toBe("earliest");
		expect(parseDiaryOrder("title")).toBe("title");
		expect(parseDiaryOrder(undefined)).toBe("latest");
		expect(parseDiaryOrder("nope")).toBe("latest");
	});
});

describe("parseDiaryVenue", () => {
	test("null when unset/invalid; passes through theaters/streaming", () => {
		expect(parseDiaryVenue(undefined)).toBeNull();
		expect(parseDiaryVenue("all")).toBeNull();
		expect(parseDiaryVenue("theaters")).toBe("theaters");
		expect(parseDiaryVenue("streaming")).toBe("streaming");
	});
});

describe("page/limit/offset/totalPages", () => {
	test("page floors and clamps to >= 1", () => {
		expect(parseDiaryPage(undefined)).toBe(1);
		expect(parseDiaryPage("0")).toBe(1);
		expect(parseDiaryPage("3.9")).toBe(3);
	});
	test("limit defaults to 36 and caps at max", () => {
		expect(parseDiaryLimit(undefined)).toBe(DIARY_DEFAULT_LIMIT);
		expect(DIARY_DEFAULT_LIMIT).toBe(36);
		expect(parseDiaryLimit("9999")).toBe(DIARY_MAX_LIMIT);
		expect(parseDiaryLimit("12")).toBe(12);
	});
	test("offset and totalPages math", () => {
		expect(diaryOffset(1, 36)).toBe(0);
		expect(diaryOffset(3, 36)).toBe(72);
		expect(diaryTotalPages(0, 36)).toBe(0);
		expect(diaryTotalPages(37, 36)).toBe(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/diary-log-query.test.ts`
Expected: FAIL — `Cannot find module './diary-log-query'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/server/src/lib/diary-log-query.ts
/**
 * Pure query-arg helpers for `GET /api/logs/me/diary`. Kept separate from the
 * route so parsing/clamp/offset math is unit-testable without a DB. Mirrors
 * `profile-filmography-query.ts`.
 */
export type DiaryMedia = "movie" | "tv";
export type DiaryOrder = "latest" | "earliest" | "title";
export type DiaryVenue = "theaters" | "streaming";

/** Matches the dense lobby grid — fast first paint, more scroll fetches. */
export const DIARY_DEFAULT_LIMIT = 36;
export const DIARY_MAX_LIMIT = 72;

export function parseDiaryMedia(raw: string | undefined): DiaryMedia {
	return raw === "tv" ? "tv" : "movie";
}

export function parseDiaryOrder(raw: string | undefined): DiaryOrder {
	if (raw === "earliest" || raw === "title" || raw === "latest") return raw;
	return "latest";
}

/** `null` means "all venues" (no filter). */
export function parseDiaryVenue(raw: string | undefined): DiaryVenue | null {
	if (raw === "theaters" || raw === "streaming") return raw;
	return null;
}

export function parseDiaryPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function parseDiaryLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return DIARY_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), DIARY_MAX_LIMIT);
}

export function diaryOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}

export function diaryTotalPages(total: number, limit: number): number {
	if (total <= 0 || limit <= 0) return 0;
	return Math.ceil(total / limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/diary-log-query.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/diary-log-query.ts apps/server/src/lib/diary-log-query.test.ts
git commit -m "feat(diary): pure query-arg helpers for paginated diary endpoint"
```

---

## Task 2: Client comparator tiebreak (TDD)

Add `createdAt` to the diary row type, then make both comparators break `watchedAt` ties by `createdAt` then `id`. This is the "doesn't respect latest seen" fix on the client side.

**Files:**
- Modify: `apps/web/src/components/diary/diary-entry.tsx:22-40`
- Modify: `apps/web/src/lib/diary-lobby-order.ts:174-209`
- Modify: `apps/web/src/lib/diary-lobby-grouping.ts:23-40,70-108`
- Test: `apps/web/src/lib/diary-lobby-order.test.ts`

- [ ] **Step 1: Write the failing test (append to existing file)**

Append to `apps/web/src/lib/diary-lobby-order.test.ts`:

```ts
import { sortDiaryLobbyRowsForOrder } from "./diary-lobby-order";
import type { DiaryLogRow } from "@/components/diary/diary-entry";

function movieRow(
	id: string,
	watchedAt: string,
	createdAt: string,
): DiaryLogRow {
	return {
		log: {
			id,
			watchedAt,
			createdAt,
			rating: null,
			liked: false,
			rewatch: false,
			note: null,
		},
		movie: { tmdbId: Number(id), title: `M${id}`, posterPath: null, year: null },
		tv: null,
	} as DiaryLogRow;
}

describe("sortDiaryLobbyRowsForOrder tiebreak", () => {
	const sameDay = "2026-05-01T00:00:00.000Z";
	const rows = [
		movieRow("1", sameDay, "2026-05-01T09:00:00.000Z"), // logged first
		movieRow("2", sameDay, "2026-05-01T18:00:00.000Z"), // logged later
	];

	test("latest_seen puts the later-created row first on watchedAt ties", () => {
		const out = sortDiaryLobbyRowsForOrder(rows, "latest_seen");
		expect(out.map((r) => r.log.id)).toEqual(["2", "1"]);
	});

	test("earliest_seen puts the earlier-created row first on watchedAt ties", () => {
		const out = sortDiaryLobbyRowsForOrder(rows, "earliest_seen");
		expect(out.map((r) => r.log.id)).toEqual(["1", "2"]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/diary-lobby-order.test.ts`
Expected: FAIL — order is unstable/wrong because `createdAt` is not part of the type or the comparator (TypeScript may also error that `createdAt` is not on the log type).

- [ ] **Step 3a: Add `createdAt` to the row type**

In `apps/web/src/components/diary/diary-entry.tsx`, inside `DiaryLogRow["log"]` (after `watchedAt: string;`):

```ts
		watchedAt: string;
		/** Row insertion time — deterministic tiebreaker when watchedAt ties. */
		createdAt?: string;
```

- [ ] **Step 3b: Tiebreak in `compareDiaryLobbyRows`**

In `apps/web/src/lib/diary-lobby-order.ts`, add a helper above `compareDiaryLobbyRows` and use it:

```ts
/** Deterministic tiebreak for equal watchedAt — newest-created first, then id. */
function compareLogRecency(a: DiaryLogRow, b: DiaryLogRow): number {
	const aw = new Date(a.log.watchedAt).getTime();
	const bw = new Date(b.log.watchedAt).getTime();
	if (aw !== bw) return bw - aw;
	const ac = a.log.createdAt ? new Date(a.log.createdAt).getTime() : 0;
	const bc = b.log.createdAt ? new Date(b.log.createdAt).getTime() : 0;
	if (ac !== bc) return bc - ac;
	return b.log.id.localeCompare(a.log.id);
}
```

Then replace the `compareDiaryLobbyRows` body:

```ts
function compareDiaryLobbyRows(
	a: DiaryLogWithListing,
	b: DiaryLogWithListing,
	order: DiaryLobbyOrder,
): number {
	switch (order) {
		case "latest_seen":
			return compareLogRecency(a, b);
		case "earliest_seen":
			return -compareLogRecency(a, b);
		case "title_az": {
			const t = diaryListingTitle(a).localeCompare(
				diaryListingTitle(b),
				undefined,
				{ sensitivity: "base" },
			);
			if (t !== 0) return t;
			return compareLogRecency(a, b);
		}
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}
```

- [ ] **Step 3c: Tiebreak in grouping module**

In `apps/web/src/lib/diary-lobby-grouping.ts`, replace `sortLogsNewestFirst` so the within-group order is deterministic:

```ts
function logRecencyValue(row: DiaryLogRow): {
	watched: number;
	created: number;
	id: string;
} {
	return {
		watched: new Date(row.log.watchedAt).getTime(),
		created: row.log.createdAt ? new Date(row.log.createdAt).getTime() : 0,
		id: row.log.id,
	};
}

function sortLogsNewestFirst(logs: DiaryLogRow[]): DiaryLogRow[] {
	return logs.slice().sort((a, b) => {
		const x = logRecencyValue(a);
		const y = logRecencyValue(b);
		if (x.watched !== y.watched) return y.watched - x.watched;
		if (x.created !== y.created) return y.created - x.created;
		return y.id.localeCompare(x.id);
	});
}
```

The existing `compareGridItems` already calls `newestWatchedAtMs`/`oldestWatchedAtMs`, which now derive from this deterministic order — no further change needed there for movies vs TV groups, but add an id fallback for movie-vs-movie ties. Replace the `latest_seen` and `earliest_seen` cases of `compareGridItems` to fall through to a stable id tiebreak:

```ts
		case "latest_seen": {
			const aMs =
				a.kind === "movie" ? watchedAtMs(a.row) : newestWatchedAtMs(a.logs);
			const bMs =
				b.kind === "movie" ? watchedAtMs(b.row) : newestWatchedAtMs(b.logs);
			if (aMs !== bMs) return bMs - aMs;
			return b.key.localeCompare(a.key);
		}
		case "earliest_seen": {
			const aMs =
				a.kind === "movie" ? watchedAtMs(a.row) : oldestWatchedAtMs(a.logs);
			const bMs =
				b.kind === "movie" ? watchedAtMs(b.row) : oldestWatchedAtMs(b.logs);
			if (aMs !== bMs) return aMs - bMs;
			return a.key.localeCompare(b.key);
		}
```

- [ ] **Step 4: Run tests**

Run: `bun test apps/web/src/lib/diary-lobby-order.test.ts apps/web/src/lib/diary-lobby-grouping.test.ts`
Expected: PASS (new tiebreak tests + existing grouping tests stay green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/diary/diary-entry.tsx apps/web/src/lib/diary-lobby-order.ts apps/web/src/lib/diary-lobby-grouping.ts apps/web/src/lib/diary-lobby-order.test.ts
git commit -m "fix(diary): deterministic createdAt/id tiebreak so latest-seen order is stable"
```

---

## Task 3: Server diary endpoint `GET /api/logs/me/diary`

Models the filmography handler. Movies are NOT deduped (one row per log); TV is deduped to newest-per-show with `logCount` + `primaryScope`. Also adds the `createdAt`/`id` tiebreak to `/recent` and `/by-user/:userId`, and removes the old `GET /me`.

**Files:**
- Modify: `apps/server/src/routes/logs.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/server/src/routes/logs.ts`, extend the drizzle import and add the query helper import:

```ts
import { and, asc, count, desc, eq, isNotNull, or, sql } from "drizzle-orm";
```

Add after the existing lib imports:

```ts
import {
	diaryOffset,
	diaryTotalPages,
	parseDiaryLimit,
	parseDiaryMedia,
	parseDiaryOrder,
	parseDiaryPage,
	parseDiaryVenue,
} from "../lib/diary-log-query";
```

- [ ] **Step 2: Add the `createdAt`/`id` tiebreak to existing read routes**

In the `/recent` handler, change:

```ts
		.orderBy(desc(log.watchedAt))
```
to:
```ts
		.orderBy(desc(log.watchedAt), desc(log.createdAt), desc(log.id))
```

In the `/by-user/:userId` handler, make the same change to its `.orderBy(desc(log.watchedAt))`.

- [ ] **Step 3: Replace the old `GET /me` with the paginated diary endpoint**

Delete the entire existing `.get("/me", ...)` block (the one that selects `{ log, movie, tv }` ordered by `desc(log.watchedAt)` with `limit 500`) and replace it with:

```ts
	// My diary — paginated, grid-shaped feed for `/diary`. Movies are one row per
	// log (rewatches stay separate); TV is deduped to the newest log per show with
	// a logCount + primaryScope for the flip-card caption.
	.get(
		"/me/diary",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");

			const media = parseDiaryMedia(query.media);
			const order = parseDiaryOrder(query.order);
			const venue = parseDiaryVenue(query.venue);
			const page = parseDiaryPage(query.page);
			const limit = parseDiaryLimit(query.limit);
			const offset = diaryOffset(page, limit);

			// Venue filter: legacy/unset venue matches both slices (mirrors the web
			// `diaryLogMatchesDiaryLobbyVenue` rule).
			const venueWhere = venue
				? or(
						eq(log.watchVenue, venue),
						sql`${log.watchVenue} not in ('theaters','streaming')`,
					)
				: undefined;

			// Tab counts are venue-independent so tab defaults + empty states are stable.
			const [movieCountRow, tvCountRow] = await Promise.all([
				db
					.select({ total: count() })
					.from(log)
					.where(and(eq(log.userId, user.id), isNotNull(log.movieId))),
				db
					.select({ total: sql<number>`count(distinct ${log.tvId})` })
					.from(log)
					.where(and(eq(log.userId, user.id), isNotNull(log.tvId))),
			]);
			const tabCounts = {
				movies: Number(movieCountRow[0]?.total ?? 0),
				tv: Number(tvCountRow[0]?.total ?? 0),
			};

			if (media === "movie") {
				const where = and(
					eq(log.userId, user.id),
					isNotNull(log.movieId),
					venueWhere,
				);
				const orderBy =
					order === "earliest"
						? [asc(log.watchedAt), asc(log.createdAt), asc(log.id)]
						: order === "title"
							? [asc(movie.title), desc(log.watchedAt), desc(log.id)]
							: [desc(log.watchedAt), desc(log.createdAt), desc(log.id)];

				const [rows, totalRow] = await Promise.all([
					db
						.select({
							id: log.id,
							watchedAt: log.watchedAt,
							createdAt: log.createdAt,
							rating: log.rating,
							liked: log.liked,
							rewatch: log.rewatch,
							watchVenue: log.watchVenue,
							tmdbId: movie.tmdbId,
							title: movie.title,
							posterPath: movie.posterPath,
						})
						.from(log)
						.innerJoin(movie, eq(log.movieId, movie.tmdbId))
						.where(where)
						.orderBy(...orderBy)
						.limit(limit)
						.offset(offset),
					db.select({ total: count() }).from(log).where(where),
				]);

				const total = Number(totalRow[0]?.total ?? 0);
				return {
					results: rows.map((r) => ({
						kind: "movie" as const,
						log: {
							id: r.id,
							watchedAt: r.watchedAt,
							createdAt: r.createdAt,
							rating: r.rating,
							liked: r.liked,
							rewatch: r.rewatch,
							watchVenue: r.watchVenue,
						},
						movie: {
							tmdbId: r.tmdbId,
							title: r.title,
							posterPath: r.posterPath,
						},
					})),
					total_pages: diaryTotalPages(total, limit),
					total_results: total,
					tabCounts,
				};
			}

			// TV: dedupe to newest log per show, then order/paginate the deduped set.
			const deduped = db
				.selectDistinctOn([log.tvId], {
					tvId: log.tvId,
					watchedAt: log.watchedAt,
					createdAt: log.createdAt,
					watchVenue: log.watchVenue,
					tmdbId: tv.tmdbId,
					title: tv.title,
					posterPath: tv.posterPath,
				})
				.from(log)
				.innerJoin(tv, eq(log.tvId, tv.tmdbId))
				.where(and(eq(log.userId, user.id), isNotNull(log.tvId)))
				.orderBy(log.tvId, desc(log.watchedAt), desc(log.createdAt), desc(log.id))
				.as("dedup");

			const outerVenueWhere = venue
				? or(
						eq(deduped.watchVenue, venue),
						sql`${deduped.watchVenue} not in ('theaters','streaming')`,
					)
				: undefined;
			const orderBy =
				order === "earliest"
					? [asc(deduped.watchedAt), asc(deduped.tmdbId)]
					: order === "title"
						? [asc(deduped.title), asc(deduped.tmdbId)]
						: [desc(deduped.watchedAt), desc(deduped.tmdbId)];

			const [rows, totalRow] = await Promise.all([
				db
					.select({
						tmdbId: deduped.tmdbId,
						title: deduped.title,
						posterPath: deduped.posterPath,
						watchedAt: deduped.watchedAt,
					})
					.from(deduped)
					.where(outerVenueWhere)
					.orderBy(...orderBy)
					.limit(limit)
					.offset(offset),
				db.select({ total: count() }).from(deduped).where(outerVenueWhere),
			]);

			// Per-show log count + most-specific scope, scoped to the page's shows.
			const pageTvIds = rows.map((r) => r.tmdbId);
			const [countsByShow, scopeByShow] = await Promise.all([
				pageTvIds.length
					? db
							.select({ tvId: log.tvId, total: count() })
							.from(log)
							.where(
								and(
									eq(log.userId, user.id),
									isNotNull(log.tvId),
									inArrayTvIds(log.tvId, pageTvIds),
								),
							)
							.groupBy(log.tvId)
					: Promise.resolve([] as { tvId: number | null; total: number }[]),
				pageTvIds.length
					? db
							// Representative most-specific log per show: episode > season > show,
							// newest within the chosen tier — drives the front-face caption.
							.selectDistinctOn([log.tvId], {
								tvId: log.tvId,
								logScope: log.logScope,
								seasonNumber: log.seasonNumber,
								episodeNumber: log.episodeNumber,
							})
							.from(log)
							.where(
								and(
									eq(log.userId, user.id),
									isNotNull(log.tvId),
									inArrayTvIds(log.tvId, pageTvIds),
								),
							)
							.orderBy(
								log.tvId,
								sql`case ${log.logScope} when 'episode' then 3 when 'season' then 2 else 1 end desc`,
								desc(log.watchedAt),
								desc(log.id),
							)
					: Promise.resolve(
							[] as {
								tvId: number | null;
								logScope: string;
								seasonNumber: number | null;
								episodeNumber: number | null;
							}[],
						),
			]);

			const countMap = new Map(
				countsByShow.map((r) => [r.tvId, Number(r.total)]),
			);
			const scopeMap = new Map(scopeByShow.map((r) => [r.tvId, r]));

			const total = Number(totalRow[0]?.total ?? 0);
			return {
				results: rows.map((r) => {
					const scope = scopeMap.get(r.tmdbId);
					return {
						kind: "tvGroup" as const,
						tv: {
							tmdbId: r.tmdbId,
							title: r.title,
							posterPath: r.posterPath,
						},
						logCount: countMap.get(r.tmdbId) ?? 1,
						primaryScope: {
							logScope: (scope?.logScope ?? "show") as
								| "show"
								| "season"
								| "episode",
							seasonNumber: scope?.seasonNumber ?? null,
							episodeNumber: scope?.episodeNumber ?? null,
						},
						newestWatchedAt: r.watchedAt,
					};
				}),
				total_pages: diaryTotalPages(total, limit),
				total_results: total,
				tabCounts,
			};
		},
		{
			query: t.Object({
				media: t.Optional(t.String()),
				order: t.Optional(t.String()),
				venue: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
```

Add this small helper near the top of the file (after imports), used above:

```ts
import { inArray } from "drizzle-orm";

/** `inArray` wrapper that no-ops to a false predicate on an empty list. */
function inArrayTvIds(col: typeof log.tvId, ids: number[]) {
	return ids.length ? inArray(col, ids) : sql`false`;
}
```

> Note: `inArray` is also exported from `drizzle-orm`; if you prefer, fold it into the main `drizzle-orm` import line instead of a second import statement.

- [ ] **Step 4: Type-check the server**

Run: `cd apps/server && bun run check-types`
Expected: PASS (no type errors). Fix any drizzle column-type mismatches (e.g. `log.tvId` is `number | null` — the `inArray` list is `number[]`, which is fine).

- [ ] **Step 5: Smoke-test the endpoint manually**

Start the server (`bun run dev:server` from repo root), sign in via the web app, then in the browser console or curl with the session cookie:

Run: open `http://localhost:3000/api/logs/me/diary?media=movie&order=latest&page=1`
Expected: JSON `{ results: [...], total_pages, total_results, tabCounts: { movies, tv } }`; movie rows newest-first; same-day logs ordered by `createdAt` desc. Repeat with `media=tv` and confirm one row per show with `logCount`/`primaryScope`.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/logs.ts
git commit -m "feat(diary): paginated GET /api/logs/me/diary with tabCounts + ordering tiebreak"
```

---

## Task 4: Client fetch `fetchMyDiary` + endpoint row types

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: Add the row types + fetch function**

Add near the other personal-list fetchers (e.g. after `fetchMyWatchlist`, around line 927) in `apps/web/src/lib/still-api-fetch.ts`:

```ts
/** One row from `GET /api/logs/me/diary`. */
export type DiaryMovieResultRow = {
	kind: "movie";
	log: {
		id: string;
		watchedAt: string;
		createdAt: string;
		rating: number | null;
		liked: boolean;
		rewatch: boolean;
		watchVenue: "theaters" | "streaming" | null;
	};
	movie: { tmdbId: number; title: string; posterPath: string | null };
};

export type DiaryTvGroupResultRow = {
	kind: "tvGroup";
	tv: { tmdbId: number; title: string; posterPath: string | null };
	logCount: number;
	primaryScope: {
		logScope: "show" | "season" | "episode";
		seasonNumber: number | null;
		episodeNumber: number | null;
	};
	newestWatchedAt: string;
};

export type DiaryResultRow = DiaryMovieResultRow | DiaryTvGroupResultRow;

export type DiaryTabCounts = { movies: number; tv: number };

export type FetchMyDiaryOpts = {
	media: "movie" | "tv";
	order: "latest" | "earliest" | "title";
	/** Omit / null = all venues. */
	venue?: "theaters" | "streaming" | null;
	signal?: AbortSignal;
};

/** Client load-more for the diary grid (DiaryLobbyInfinite `loadPage`). */
export async function fetchMyDiary(
	page: number,
	opts: FetchMyDiaryOpts,
): Promise<
	| { results: DiaryResultRow[]; total_pages: number; tabCounts: DiaryTabCounts }
	| { error: true }
> {
	const url = new URL("/api/logs/me/diary", stillApiOrigin());
	url.searchParams.set("media", opts.media);
	url.searchParams.set("order", opts.order);
	if (opts.venue) url.searchParams.set("venue", opts.venue);
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts.signal,
	});
	if (!response.ok) return { error: true };
	const raw = (await response.json().catch(() => null)) as {
		results?: DiaryResultRow[];
		total_pages?: number;
		tabCounts?: DiaryTabCounts;
	} | null;
	if (!raw || !Array.isArray(raw.results)) return { error: true };
	return {
		results: raw.results,
		total_pages: typeof raw.total_pages === "number" ? raw.total_pages : page,
		tabCounts: raw.tabCounts ?? { movies: 0, tv: 0 },
	};
}
```

- [ ] **Step 2: Type-check the web app**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: PASS (no new errors from this file). If the project has no standalone tsconfig check, defer to the build in Task 7.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/still-api-fetch.ts
git commit -m "feat(diary): fetchMyDiary client pager + endpoint row types"
```

---

## Task 5: TV group cell — lazy-load entries on flip

`DiaryTvGroupCell` currently requires all `logs`. Change it to accept a summary (newest scope label + count) and lazy-fetch the show's full log list on the first flip via `fetchMyLogsForTv`.

**Files:**
- Modify: `apps/web/src/components/diary/diary-tv-group-cell.tsx`

- [ ] **Step 1: Change the props + add lazy state**

Replace the `DiaryTvGroupCell` prop type and the top of the function body (lines ~47-72) with:

```tsx
export function DiaryTvGroupCell({
	tmdbId,
	title,
	posterPath,
	logCount,
	primaryLabel,
	expanded,
	onToggleExpand,
	priority = false,
}: {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	/** Total diary entries for this show (from the endpoint). */
	logCount: number;
	/** Front-face scope caption (server-computed most-specific scope). */
	primaryLabel: string;
	/** `true` when the card is flipped to the log-list face. */
	expanded: boolean;
	onToggleExpand: () => void;
	priority?: boolean;
}) {
	const router = useRouter();
	const openQuickLog = useQuickLog((s) => s.open);
	const reduceMotion = useReducedMotion();
	const [logs, setLogs] = useState<DiaryLogRow[] | null>(null);
	const [loadingLogs, setLoadingLogs] = useState(false);

	const entryCountLine = logCount > 1 ? `${logCount} diary entries` : null;

	const refresh = () => router.refresh();

	// Fetch the full entry list the first time the card flips open.
	useEffect(() => {
		if (!expanded || logs != null || loadingLogs) return;
		let cancelled = false;
		setLoadingLogs(true);
		void fetchMyLogsForTv(tmdbId)
			.then(({ data }) => {
				if (cancelled) return;
				setLogs(tvLogsToDiaryRows(data, tmdbId, title, posterPath));
			})
			.finally(() => {
				if (!cancelled) setLoadingLogs(false);
			});
		return () => {
			cancelled = true;
		};
	}, [expanded, logs, loadingLogs, tmdbId, title, posterPath]);
```

Add these imports at the top of the file:

```tsx
import { useEffect, useState } from "react";
import { fetchMyLogsForTv } from "@/lib/still-api-fetch";
import type { MyTvLog } from "@/lib/my-tv-log";
```

Remove the now-unused `pickPrimaryTvScopeLabel` import (the label is passed in) and the `primaryLabel`/`entryCountLine` lines that referenced `logs`.

- [ ] **Step 2: Add the `MyTvLog` → `DiaryLogRow` mapper**

Add above the component (after `tmdbPosterUrl`):

```tsx
/** `GET /api/logs/me/by-tv/:id` rows → diary rows for the flip-card list. */
function tvLogsToDiaryRows(
	data: unknown,
	tmdbId: number,
	title: string,
	posterPath: string | null,
): DiaryLogRow[] {
	if (!Array.isArray(data)) return [];
	const listing = { tmdbId, title, posterPath, year: null };
	return (data as MyTvLog[]).map((l) => ({
		log: {
			id: l.id,
			watchedAt: l.watchedAt ?? new Date(0).toISOString(),
			createdAt: undefined,
			rating: l.rating ?? null,
			liked: l.liked,
			rewatch: l.rewatch ?? false,
			note: l.note ?? null,
			logScope: l.logScope ?? "show",
			seasonNumber: l.seasonNumber ?? null,
			episodeNumber: l.episodeNumber ?? null,
		},
		movie: null,
		tv: listing,
	}));
}
```

- [ ] **Step 3: Use `primaryLabel`/`logs` in the JSX**

- Replace every `primaryLabel` usage (front face caption/aria) — it now comes from the prop, no change to the JSX references themselves.
- The back-face entry list (`<ul>`) maps over `logs`. Guard it: while `logs == null`, show a small loading state. Replace the `<ul>...{logs.map(...)}...</ul>` block with:

```tsx
							<ul
								className={cn(
									"min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto",
									DIARY_TV_FLIP_INSET_X,
								)}
							>
								{logs == null ? (
									<li className="py-6 text-center text-[11px] text-muted-foreground">
										Loading entries…
									</li>
								) : (
									logs.map((row) => (
										// ...unchanged <li> body...
									))
								)}
							</ul>
```

Keep the existing `<li>` body exactly as-is inside the `logs.map`.

- [ ] **Step 4: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: PASS. (Callers still pass the old `logs` prop — those break here and are fixed in Task 6, so a full type-check passes only after Task 6. For now confirm this file has no internal type errors.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/diary/diary-tv-group-cell.tsx
git commit -m "feat(diary): TV group cell lazy-loads entries on first flip"
```

---

## Task 6: `DiaryLobbyInfinite` component

A self-contained diary infinite scroller (sentinel + IntersectionObserver pager, mirroring `PopularMoviesInfinite`'s loop) that renders diary cells from accumulated endpoint rows.

**Files:**
- Create: `apps/web/src/components/diary/diary-lobby-infinite.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/diary/diary-lobby-infinite.tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { DiaryTvGroupCell } from "@/components/diary/diary-tv-group-cell";
import { formatTvLogScopeLabel } from "@/lib/tv-log-scope-display";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	type DiaryResultRow,
	fetchMyDiary,
	type FetchMyDiaryOpts,
} from "@/lib/still-api-fetch";

function tmdbPosterUrl(posterPath: string | null): string | null {
	if (!posterPath?.length) return null;
	if (posterPath.startsWith("http")) return posterPath;
	const fragment = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

/** Stable cross-page key per cell. */
function rowKey(row: DiaryResultRow): string {
	return row.kind === "movie"
		? `movie:${row.log.id}`
		: `tv:${row.tv.tmdbId}`;
}

const SCROLL_MARGIN_PX = 280;

export function DiaryLobbyInfinite({
	seeds,
	totalPages,
	query,
	monochromePeersOnHover,
	signedIn = false,
}: {
	seeds: DiaryResultRow[];
	totalPages: number;
	query: Omit<FetchMyDiaryOpts, "signal">;
	monochromePeersOnHover: boolean;
	signedIn?: boolean;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const [items, setItems] = useState<DiaryResultRow[]>(() => [...seeds]);
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	const [footerState, setFooterState] = useState<
		"idle" | "loading" | "exhausted" | "error"
	>(() => (totalPages <= 1 ? "exhausted" : "idle"));

	const nextPageRef = useRef(2);
	const totalPagesRef = useRef(totalPages);
	totalPagesRef.current = totalPages;
	const loadingRef = useRef(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const loadMoreRef = useRef<() => Promise<void>>(async () => {});

	// Re-seed when the server sends a new first page (chip nav changes query).
	useEffect(() => {
		setItems([...seeds]);
		nextPageRef.current = 2;
		loadingRef.current = false;
		setExpandedKey(null);
		setFooterState(totalPages <= 1 ? "exhausted" : "idle");
	}, [seeds, totalPages]);

	const handleToggleExpand = useCallback((key: string) => {
		setExpandedKey((prev) => (prev === key ? null : key));
	}, []);

	// Collapse expanded TV card on outside click / Escape.
	useEffect(() => {
		if (!expandedKey) return;
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (gridRef.current?.contains(target)) return;
			setExpandedKey(null);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setExpandedKey(null);
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [expandedKey]);

	const peekIfRoomForMore = useCallback(() => {
		if (typeof window === "undefined") return;
		if (loadingRef.current) return;
		if (nextPageRef.current > totalPagesRef.current) return;
		const el = sentinelRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		if (r.top <= window.innerHeight + SCROLL_MARGIN_PX) {
			void loadMoreRef.current();
		}
	}, []);

	const loadMore = useCallback(async () => {
		const next = nextPageRef.current;
		if (next > totalPagesRef.current) {
			setFooterState("exhausted");
			return;
		}
		if (loadingRef.current) return;
		loadingRef.current = true;
		setFooterState("loading");
		const res = await fetchMyDiary(next, query);
		loadingRef.current = false;
		if ("error" in res) {
			setFooterState("error");
			return;
		}
		if (res.total_pages > 0) totalPagesRef.current = res.total_pages;
		setItems((prev) => {
			const seen = new Set(prev.map(rowKey));
			const out = [...prev];
			for (const row of res.results) {
				const k = rowKey(row);
				if (!seen.has(k)) {
					seen.add(k);
					out.push(row);
				}
			}
			return out;
		});
		nextPageRef.current = next + 1;
		const depleted =
			res.results.length === 0 || nextPageRef.current > totalPagesRef.current;
		setFooterState(depleted ? "exhausted" : "idle");
		if (!depleted) queueMicrotask(() => peekIfRoomForMore());
	}, [query, peekIfRoomForMore]);

	useEffect(() => {
		loadMoreRef.current = loadMore;
	}, [loadMore]);

	useEffect(() => {
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
	}, []);

	useEffect(() => {
		queueMicrotask(() => peekIfRoomForMore());
	}, [peekIfRoomForMore]);

	const cells = useMemo(
		() =>
			items.map((item, index) => {
				const key = rowKey(item);
				if (item.kind === "tvGroup") {
					return (
						<DiaryTvGroupCell
							key={key}
							tmdbId={item.tv.tmdbId}
							title={item.tv.title}
							posterPath={item.tv.posterPath}
							logCount={item.logCount}
							primaryLabel={formatTvLogScopeLabel(
								item.primaryScope.logScope,
								item.primaryScope.seasonNumber,
								item.primaryScope.episodeNumber,
							)}
							expanded={expandedKey === key}
							onToggleExpand={() => handleToggleExpand(key)}
							priority={index < 6}
						/>
					);
				}
				return (
					<div key={key} className="min-w-0">
						<CataloguePosterTile
							className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
							diaryRow={{
								log: item.log,
								movie: {
									tmdbId: item.movie.tmdbId,
									title: item.movie.title,
									posterPath: item.movie.posterPath,
									year: null,
								},
								tv: null,
							}}
							frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
							hoverEffect="elevation"
							listingKind="movie"
							posterUrl={tmdbPosterUrl(item.movie.posterPath)}
							priority={index < 6}
							surface="diary"
							title={item.movie.title}
							tmdbId={item.movie.tmdbId}
						/>
					</div>
				);
			}),
		[items, expandedKey, handleToggleExpand],
	);

	return (
		<>
			<div
				ref={gridRef}
				className={cn(
					HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
					monochromePeersOnHover &&
						HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
				)}
			>
				{cells}
			</div>

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
						<span className="sr-only">Loading more diary entries</span>
					</>
				) : null}
				{footerState === "error" ? (
					<p className="text-center text-muted-foreground text-sm">
						Something jammed loading more —{" "}
						<button
							type="button"
							className="underline decoration-dashed underline-offset-2 hover:text-foreground"
							onClick={() => {
								loadingRef.current = false;
								setFooterState("idle");
								queueMicrotask(() => peekIfRoomForMore());
							}}
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

> The `signedIn` prop is accepted for parity with the other lobby catalogues / future radial-menu wiring; `CataloguePosterTile surface="diary"` already gates its own radial menu. Keep the prop even if unused now.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: PASS for this file. Confirm `CataloguePosterTile`'s `diaryRow` prop accepts the shape built here (it is the same `DiaryLogRow` shape used by `DiaryLobbyGrid`). If `CataloguePosterTile` requires extra `DiaryListingSnapshot` fields, add them (`year: null`, `runtime: null`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/diary/diary-lobby-infinite.tsx
git commit -m "feat(diary): DiaryLobbyInfinite scroll-paged grid of diary cells"
```

---

## Task 7: Wire the page + shell to paged data; remove the old full-fetch path

**Files:**
- Create: `apps/web/src/lib/fetch-my-diary-server.ts`
- Modify: `apps/web/src/app/(app)/diary/page.tsx`
- Modify: `apps/web/src/components/diary/diary-patron-lobby-shell.tsx`
- Remove: `apps/web/src/lib/fetch-my-logs-me-server.ts`

- [ ] **Step 1: RSC seed helper**

```ts
// apps/web/src/lib/fetch-my-diary-server.ts
import "server-only";

import {
	type DiaryResultRow,
	type DiaryTabCounts,
} from "@/lib/still-api-fetch";
import { stillApiOrigin } from "@/lib/still-api-origin";
import { cookies } from "next/headers";

export type DiarySeed = {
	results: DiaryResultRow[];
	total_pages: number;
	total_results: number;
	tabCounts: DiaryTabCounts;
};

/** RSC seed for page 1 of `/diary`, forwarding the visitor's cookies. */
export async function fetchMyDiaryServer(opts: {
	media: "movie" | "tv";
	order: "latest" | "earliest" | "title";
	venue: "theaters" | "streaming" | null;
}): Promise<DiarySeed> {
	const url = new URL("/api/logs/me/diary", stillApiOrigin());
	url.searchParams.set("media", opts.media);
	url.searchParams.set("order", opts.order);
	if (opts.venue) url.searchParams.set("venue", opts.venue);
	url.searchParams.set("page", "1");
	const empty: DiarySeed = {
		results: [],
		total_pages: 0,
		total_results: 0,
		tabCounts: { movies: 0, tv: 0 },
	};
	try {
		const cookieHeader = (await cookies()).toString();
		const res = await fetch(url, {
			headers: cookieHeader ? { cookie: cookieHeader } : {},
			cache: "no-store",
		});
		if (!res.ok) return empty;
		const raw = (await res.json().catch(() => null)) as Partial<DiarySeed> | null;
		if (!raw || !Array.isArray(raw.results)) return empty;
		return {
			results: raw.results,
			total_pages: raw.total_pages ?? 0,
			total_results: raw.total_results ?? 0,
			tabCounts: raw.tabCounts ?? { movies: 0, tv: 0 },
		};
	} catch {
		return empty;
	}
}
```

> If the codebase has an existing server-fetch helper that already forwards cookies via Eden (check how `fetch-my-watchlist-server.ts` does it), mirror that approach instead of reading `cookies()` directly — prefer the established pattern.

- [ ] **Step 2: Map server `?order=`/`?venue=`/`?tab=` to the endpoint query**

The diary URL uses tokens `latest`/`earliest`/`title` (`parseDiaryLobbyOrder` returns `latest_seen` etc.) and venue `theaters`/`streaming`. Add a tiny adapter at the top of `page.tsx`:

```ts
import {
	parseDiaryLedgerTab,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
} from "@/lib/diary-lobby-order";

function toEndpointOrder(
	o: ReturnType<typeof parseDiaryLobbyOrder>,
): "latest" | "earliest" | "title" {
	return o === "earliest_seen"
		? "earliest"
		: o === "title_az"
			? "title"
			: "latest";
}
```

- [ ] **Step 3: Rewrite `diary/page.tsx`**

Replace the body of `apps/web/src/app/(app)/diary/page.tsx` with a streamed RSC. Keep the sticky chrome + watch-region prompt; seed page 1 for the resolved media/order/venue:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { LobbyStickyChromeFallback } from "@/components/app/lobby-suspense-fallbacks";
import { DiaryPatronLobbyShell } from "@/components/diary/diary-patron-lobby-shell";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { authServer } from "@/lib/auth-server";
import {
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
	parseDiaryLedgerTab,
} from "@/lib/diary-lobby-order";
import { fetchMyDiaryServer } from "@/lib/fetch-my-diary-server";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Diary" };
export const dynamic = "force-dynamic";

function toEndpointOrder(
	o: ReturnType<typeof parseDiaryLobbyOrder>,
): "latest" | "earliest" | "title" {
	return o === "earliest_seen"
		? "earliest"
		: o === "title_az"
			? "title"
			: "latest";
}

export default async function DiaryPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string; order?: string; venue?: string }>;
}) {
	const sp = await searchParams;
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me.get().catch(() => ({ data: null }));
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

	// Resolve params. Tab default needs counts, so seed once with a provisional
	// media, read tabCounts, then re-resolve if the provisional guess was wrong.
	const order = parseDiaryLobbyOrder(sp?.order ?? null);
	const venue = parseDiaryLobbyVenue(sp?.venue ?? null);
	const endpointOrder = toEndpointOrder(order);

	// First seed with the explicit tab if present, else "movie".
	const explicitTab = parseDiaryLedgerTab(sp?.tab ?? null);
	const firstMedia = explicitTab === "tv" ? "tv" : "movie";
	let seed = await fetchMyDiaryServer({
		media: firstMedia,
		order: endpointOrder,
		venue,
	});
	// No explicit tab + movies empty but TV has rows → default to TV (matches resolveDiaryLedgerTab).
	let media: "movie" | "tv" = firstMedia;
	if (!explicitTab && seed.tabCounts.movies === 0 && seed.tabCounts.tv > 0) {
		media = "tv";
		seed = await fetchMyDiaryServer({ media, order: endpointOrder, venue });
	}

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<DiaryPatronLobbyShell
				seed={seed}
				media={media}
				endpointOrder={endpointOrder}
				venue={venue}
				monochromePeersOnHover={monochromePeersOnHover}
				signedIn={Boolean(session)}
			/>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}
```

- [ ] **Step 4: Rewrite `DiaryPatronLobbyShell`**

Replace `apps/web/src/components/diary/diary-patron-lobby-shell.tsx` to consume the seed + tabCounts and render `DiaryLobbyInfinite`. Keep `LobbyNavigationProvider` + `DiaryLobbyParamsProvider` + chrome + empty states.

```tsx
"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { DiaryLobbyChrome } from "@/components/diary/diary-lobby-chrome";
import {
	DiaryLobbyParamsProvider,
	useDiaryLobbyParams,
} from "@/components/diary/diary-lobby-params-context";
import { DiaryLobbyInfinite } from "@/components/diary/diary-lobby-infinite";
import {
	LobbyNavigationProvider,
	useLobbyNavigation,
} from "@/components/lobby/lobby-navigation-provider";
import { buildDiaryLobbyHref } from "@/lib/diary-lobby-order";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { DiarySeed } from "@/lib/fetch-my-diary-server";
import type { HomeVenue } from "@/lib/home-venue";

export interface DiaryPatronLobbyShellProps {
	seed: DiarySeed;
	media: "movie" | "tv";
	endpointOrder: "latest" | "earliest" | "title";
	venue: HomeVenue;
	monochromePeersOnHover: boolean;
	signedIn: boolean;
}

function DiaryPatronLobbyBody(props: DiaryPatronLobbyShellProps) {
	const { seed, media, endpointOrder, venue, monochromePeersOnHover, signedIn } =
		props;
	const { ledgerTab } = useDiaryLobbyParams();
	const { navigate } = useLobbyNavigation();

	const hasRows = seed.results.length > 0;
	const otherTab = ledgerTab === "movies" ? "tv" : "movies";
	const otherTabHasRows =
		otherTab === "movies" ? seed.tabCounts.movies > 0 : seed.tabCounts.tv > 0;
	const ledgerLabel = ledgerTab === "movies" ? "films" : "TV shows";
	const order =
		endpointOrder === "earliest"
			? "earliest_seen"
			: endpointOrder === "title"
				? "title_az"
				: "latest_seen";

	const switchVenueHref = buildDiaryLobbyHref({
		order,
		venue: venue === "theaters" ? "streaming" : "theaters",
		tab: ledgerTab,
	});
	const switchTabHref = buildDiaryLobbyHref({ order, venue, tab: otherTab });

	return (
		<section
			className={cn(
				HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
				"overflow-visible",
			)}
		>
			<DiaryLobbyChrome />

			{!hasRows ? (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
					<div
						className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
						role="status"
					>
						{seed.tabCounts.movies + seed.tabCounts.tv > 0 ? (
							otherTabHasRows ? (
								<>
									<div className="space-y-2">
										<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
											No {ledgerLabel} for{" "}
											{venue === "theaters" ? "in cinemas" : "at home"}
										</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											Switch the venue chip above, or check the other diary tab.
										</p>
									</div>
									<button
										type="button"
										className={buttonVariants({ variant: "outline", size: "pill" })}
										onClick={() => navigate(switchVenueHref)}
									>
										Show {venue === "theaters" ? "at home" : "in cinemas"} instead
									</button>
									<button
										type="button"
										className={buttonVariants({ variant: "outline", size: "pill" })}
										onClick={() => navigate(switchTabHref)}
									>
										Show {otherTab === "movies" ? "Movies" : "TV Shows"}
									</button>
								</>
							) : (
								<>
									<div className="space-y-2">
										<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
											No {ledgerLabel} for{" "}
											{venue === "theaters" ? "in cinemas" : "at home"}
										</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											Switch the venue chip above, or edit a screening and set
											where you watched.
										</p>
									</div>
									<button
										type="button"
										className={buttonVariants({ variant: "outline", size: "pill" })}
										onClick={() => navigate(switchVenueHref)}
									>
										Show {venue === "theaters" ? "at home" : "in cinemas"} instead
									</button>
								</>
							)
						) : (
							<>
								<div className="space-y-2">
									<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
										No screenings logged yet
									</p>
									<p className="text-muted-foreground text-sm leading-relaxed">
										Your diary will mirror the home lobby grid — open a film and
										tap <em>Log</em> to fill this wall.
									</p>
								</div>
								<Link
									href="/home"
									className={buttonVariants({ variant: "outline", size: "pill" })}
								>
									Search films
								</Link>
							</>
						)}
					</div>
				</div>
			) : (
				<DiaryLobbyInfinite
					seeds={seed.results}
					totalPages={seed.total_pages}
					query={{ media, order: endpointOrder, venue: venue ?? null }}
					monochromePeersOnHover={monochromePeersOnHover}
					signedIn={signedIn}
				/>
			)}
		</section>
	);
}

/** Client `/diary` lobby — server seeds page 1; chips re-seed via the URL. */
export function DiaryPatronLobbyShell(props: DiaryPatronLobbyShellProps) {
	return (
		<LobbyNavigationProvider>
			<DiaryLobbyParamsProvider
				movieCount={props.seed.tabCounts.movies}
				tvCount={props.seed.tabCounts.tv}
			>
				<DiaryPatronLobbyBody {...props} />
			</DiaryLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}
```

> `venue` from `parseDiaryLobbyVenue` is always `theaters` or `streaming` (never null) because the diary venue defaults to streaming. The endpoint query's `venue` is therefore always set — that's the intended diary behavior (venue is a hard filter with legacy/unset rows matching both). If you want an "all venues" diary view later, thread a nullable venue through; out of scope here.

- [ ] **Step 5: Delete the obsolete full-fetch helper and grid**

`DiaryLobbyCatalogue` and `DiaryLobbyGrid` (client-side grouping render) and `buildDiaryLobbyGridItems` are no longer used by the page. Verify with a search, then remove the now-dead full-fetch helper:

Run: `git rm apps/web/src/lib/fetch-my-logs-me-server.ts`

Check for stragglers:

Run: `rg "fetchMyLogsMeServer|DiaryLobbyCatalogue|buildDiaryLobbyGridItems|DiaryLobbyGrid" apps/web/src`
Expected: no references outside their own definitions/tests. If `diary-lobby-grouping.test.ts` still covers `buildDiaryLobbyGridItems` and you keep the function, that's fine — leave the module + test. If you remove `DiaryLobbyGrid`/`DiaryLobbyCatalogue`, delete those files too and any imports.

> Decision: keep `diary-lobby-grouping.ts` + its test (the comparator tiebreak lives there and is still unit-tested), but you may delete `diary-lobby-catalogue.tsx` and `diary-lobby-grid.tsx` if nothing else imports them.

- [ ] **Step 6: Full type-check + lint**

Run: `bun run check-types`
Expected: PASS across server + web.

Run: `bun run check`
Expected: Biome clean (or auto-fixes formatting).

- [ ] **Step 7: Manual end-to-end verification**

Start both apps (`bun run dev` from root). Sign in, open `/diary`:
- First paint shows ~36 cells, not the whole library; scrolling fetches more (network tab shows `/api/logs/me/diary?...&page=2`).
- Same-day movie logs appear newest-logged first under "Latest seen".
- Order/venue/tab chips re-seed page 1 (URL changes, grid resets).
- Flipping a TV card shows "Loading entries…" then the full list; re-flipping is instant.
- Empty states render for an empty venue/tab and a brand-new account.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/(app)/diary/page.tsx apps/web/src/components/diary/diary-patron-lobby-shell.tsx apps/web/src/lib/fetch-my-diary-server.ts
git rm apps/web/src/lib/fetch-my-logs-me-server.ts
git commit -m "feat(diary): server-paginated lazy-loading wired into page + shell"
```

---

## Self-Review Notes

- **Spec coverage:** §1 endpoint → Task 3; §2 ordering fix → Task 2 (client) + Task 3 Step 2 (server `/recent`,`/by-user`) + Task 3 order-by tiebreaks; §3 `DiaryLobbyInfinite` → Task 6; §4 lazy TV expand → Task 5; §5 page/shell wiring + remove old fetch → Task 7; page size 36 → Task 1. Tests: comparator (Task 2), query-args (Task 1).
- **Type consistency:** `DiaryResultRow` / `DiaryMovieResultRow` / `DiaryTvGroupResultRow` defined in Task 4 are consumed unchanged in Tasks 6 & 7. `fetchMyDiary` signature (Task 4) matches `FetchMyDiaryOpts` used by `DiaryLobbyInfinite.query` (Task 6) and the server seed helper (Task 7). `DiaryTvGroupCell` new props (Task 5: `logCount`, `primaryLabel`) match the call site in Task 6.
- **Known follow-ups (out of scope):** extracting a shared `useInfinitePager` hook from `PopularMoviesInfinite` + `DiaryLobbyInfinite`; an "all venues" diary view.
