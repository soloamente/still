# Profile Filmography Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/profile/:handle`'s all-at-once 500-row filmography load with a server-paginated, infinite-scroll grid (one row per title, filtered by media/order/venue/favorites), mirroring the watchlist pattern.

**Architecture:** A new `GET /api/profiles/:handle/filmography` endpoint dedups logs to the newest per title (`DISTINCT ON`), applies venue/favorites filters + order + pagination, and returns rows + totals + per-venue counts. The main profile payload drops the 500-row ledger in favor of four aggregate counts. The web profile page seeds page 1 server-side and the grid loads more on scroll via `PopularMoviesInfinite`'s `loadPage` injection (already built for watchlist).

**Tech Stack:** Elysia + Drizzle (Postgres `DISTINCT ON`), Next.js 16 / React 19, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-03-profile-filmography-pagination-design.md`

**Branch:** `profile-filmography-pagination` (already created).

---

## Conventions for every task

- **Web typecheck (the real one — `npx tsc` in `apps/web` is a decoy):**
  ```
  ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false 2>&1 | grep -iE "error TS"
  ```
  Known PRE-EXISTING baseline errors to ignore: `list-meta-line.test.ts` and `tv-log-scope-prior.test.ts` ("Cannot find module 'vitest'").
- **Server typecheck:** `cd apps/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iv "TS5055" | grep -i error` (the `TS5055` lines are pre-existing stale-`dist` noise).
- **Tests:** `bun test <path>`.
- Repo uses tabs + Biome. End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Server**
- `apps/server/src/lib/profile-filmography-query.ts` (new) — pure query-arg parse/clamp/offset/total-pages helpers.
- `apps/server/src/lib/profile-filmography-query.test.ts` (new) — unit tests.
- `apps/server/src/routes/profiles.ts` (modify) — new `/:handle/filmography` route; swap `recentlyWatched` → `filmographyCounts` in `GET /:handle`.

**Web**
- `apps/web/src/lib/profile-filmography-fetch.ts` (new) — client `fetchProfileFilmography` + shared row→seed mapper.
- `apps/web/src/lib/fetch-profile-filmography-server.ts` (new) — RSC page-1 + counts helper.
- `apps/web/src/app/(app)/profile/[handle]/page.tsx` (modify) — seed page 1 + counts.
- `apps/web/src/components/profile/profile-lobby-catalogue.tsx` (modify) — `loadPage` + `getDedupeKey`, drop `staticCatalogue`.
- `apps/web/src/components/profile/profile-patron-lobby-shell.tsx` (modify) — consume seeds + counts.
- `apps/web/src/components/profile/profile-tab-panels.tsx` (modify) — hints + grid from counts/seeds.
- `apps/web/src/components/profile/profile-lobby-params-context.tsx` (modify) — tab resolution from counts.
- `apps/web/src/lib/profile-lobby-derive.ts` (modify) — counts-based tab resolution helper.

**Shared types**
- `ProfileFilmographyCounts = { movies: number; tv: number; likedMovies: number; likedTv: number }`
- Endpoint response: `{ results: ProfileFilmographyRow[]; total_pages: number; total_results: number; venueCounts: { movies: number; tv: number } }`

---

## Task 1: Server — pure filmography query-arg helpers (TDD)

**Files:**
- Create: `apps/server/src/lib/profile-filmography-query.ts`
- Test: `apps/server/src/lib/profile-filmography-query.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/profile-filmography-query.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	FILMOGRAPHY_DEFAULT_LIMIT,
	FILMOGRAPHY_MAX_LIMIT,
	filmographyOffset,
	filmographyTotalPages,
	parseFilmographyFavorites,
	parseFilmographyLimit,
	parseFilmographyMedia,
	parseFilmographyOrder,
	parseFilmographyPage,
	parseFilmographyVenue,
} from "./profile-filmography-query";

describe("parseFilmographyMedia", () => {
	test("defaults to movie; accepts tv", () => {
		expect(parseFilmographyMedia(undefined)).toBe("movie");
		expect(parseFilmographyMedia("tv")).toBe("tv");
		expect(parseFilmographyMedia("movie")).toBe("movie");
		expect(parseFilmographyMedia("junk")).toBe("movie");
	});
});

describe("parseFilmographyOrder", () => {
	test("accepts latest/earliest/title; defaults latest", () => {
		expect(parseFilmographyOrder("earliest")).toBe("earliest");
		expect(parseFilmographyOrder("title")).toBe("title");
		expect(parseFilmographyOrder(undefined)).toBe("latest");
		expect(parseFilmographyOrder("nope")).toBe("latest");
	});
});

describe("parseFilmographyVenue", () => {
	test("theaters/streaming pass; everything else is null (all venues)", () => {
		expect(parseFilmographyVenue("theaters")).toBe("theaters");
		expect(parseFilmographyVenue("streaming")).toBe("streaming");
		expect(parseFilmographyVenue(undefined)).toBe(null);
		expect(parseFilmographyVenue("all")).toBe(null);
	});
});

describe("parseFilmographyFavorites", () => {
	test("1/true/yes → true; else false", () => {
		expect(parseFilmographyFavorites("1")).toBe(true);
		expect(parseFilmographyFavorites("true")).toBe(true);
		expect(parseFilmographyFavorites("yes")).toBe(true);
		expect(parseFilmographyFavorites(undefined)).toBe(false);
		expect(parseFilmographyFavorites("0")).toBe(false);
	});
});

describe("parseFilmographyPage", () => {
	test("defaults/floors", () => {
		expect(parseFilmographyPage(undefined)).toBe(1);
		expect(parseFilmographyPage("0")).toBe(1);
		expect(parseFilmographyPage("4.8")).toBe(4);
	});
});

describe("parseFilmographyLimit", () => {
	test("default + clamp", () => {
		expect(parseFilmographyLimit(undefined)).toBe(FILMOGRAPHY_DEFAULT_LIMIT);
		expect(parseFilmographyLimit("0")).toBe(FILMOGRAPHY_DEFAULT_LIMIT);
		expect(parseFilmographyLimit("9999")).toBe(FILMOGRAPHY_MAX_LIMIT);
		expect(parseFilmographyLimit("20")).toBe(20);
	});
});

describe("filmographyOffset / filmographyTotalPages", () => {
	test("offset + ceil", () => {
		expect(filmographyOffset(1, 48)).toBe(0);
		expect(filmographyOffset(3, 48)).toBe(96);
		expect(filmographyTotalPages(0, 48)).toBe(0);
		expect(filmographyTotalPages(48, 48)).toBe(1);
		expect(filmographyTotalPages(49, 48)).toBe(2);
	});
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `bun test apps/server/src/lib/profile-filmography-query.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

Create `apps/server/src/lib/profile-filmography-query.ts`:

```ts
/**
 * Pure query-arg helpers for `GET /api/profiles/:handle/filmography`. Kept separate
 * from the route so parsing/clamp/offset math is unit-testable without a DB.
 */
export type FilmographyMedia = "movie" | "tv";
export type FilmographyOrder = "latest" | "earliest" | "title";
export type FilmographyVenue = "theaters" | "streaming";

export const FILMOGRAPHY_DEFAULT_LIMIT = 48;
export const FILMOGRAPHY_MAX_LIMIT = 96;

export function parseFilmographyMedia(raw: string | undefined): FilmographyMedia {
	return raw === "tv" ? "tv" : "movie";
}

export function parseFilmographyOrder(raw: string | undefined): FilmographyOrder {
	if (raw === "earliest" || raw === "title" || raw === "latest") return raw;
	return "latest";
}

/** `null` means "all venues" (no filter). */
export function parseFilmographyVenue(
	raw: string | undefined,
): FilmographyVenue | null {
	if (raw === "theaters" || raw === "streaming") return raw;
	return null;
}

export function parseFilmographyFavorites(raw: string | undefined): boolean {
	if (!raw) return false;
	const v = raw.trim().toLowerCase();
	return v === "1" || v === "true" || v === "yes";
}

export function parseFilmographyPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function parseFilmographyLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return FILMOGRAPHY_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), FILMOGRAPHY_MAX_LIMIT);
}

export function filmographyOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}

export function filmographyTotalPages(total: number, limit: number): number {
	if (total <= 0 || limit <= 0) return 0;
	return Math.ceil(total / limit);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun test apps/server/src/lib/profile-filmography-query.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add apps/server/src/lib/profile-filmography-query.ts apps/server/src/lib/profile-filmography-query.test.ts
git commit -m "feat(profile): pure filmography query-arg helpers"
```

---

## Task 2: Server — `GET /:handle/filmography` endpoint

**Files:**
- Modify: `apps/server/src/routes/profiles.ts`

**Context:** The catch-all `GET /:handle` must stay last, so register this new route **immediately before it** (right after the existing `GET /:handle/activity-signature` route ends, near line 677). Access mirrors `activity-signature`: look up the profile by handle; if `isPrivate && viewer is not owner` → 404. Apply `contentVisibilityWhere(viewerId, log.userId, log.visibility)` on logs. The dedup keeps the **newest log per title**, then venue/favorites filters apply to that kept row (legacy/unset venue matches all venues; favorite = kept log liked).

- [ ] **Step 1: Add imports**

Confirm these are already imported at the top of `profiles.ts` (most are): `db`, `log`, `movie`, `tv`, `profile`, `user`, `eq`, `and`, `or`, `desc`, `asc`, `isNotNull`, `sql`, `count`, `t`, `contentVisibilityWhere`. Add any missing ones to the existing import groups. Add:

```ts
import {
	FILMOGRAPHY_DEFAULT_LIMIT,
	FILMOGRAPHY_MAX_LIMIT,
	filmographyOffset,
	filmographyTotalPages,
	parseFilmographyFavorites,
	parseFilmographyLimit,
	parseFilmographyMedia,
	parseFilmographyOrder,
	parseFilmographyPage,
	parseFilmographyVenue,
} from "../lib/profile-filmography-query";
```

(`FILMOGRAPHY_DEFAULT_LIMIT` / `FILMOGRAPHY_MAX_LIMIT` may be unused in the route — drop them from this import if Biome flags them; they're used by the web side.)

- [ ] **Step 2: Insert the route before `GET /:handle`**

Insert this chained `.get(...)` immediately before the `// Public profile by handle (case-insensitive) — must stay last (catch-all).` comment / the `.get("/:handle", ...)` handler:

```ts
	/**
	 * Paginated filmography for the Movies / TV profile grids. Dedups to the newest
	 * log per title, then filters venue/favorites, orders, and paginates — matching
	 * the web app's prior client-side derivation.
	 */
	.get(
		"/:handle/filmography",
		async ({ params, query, user: viewer, status }) => {
			const handle = params.handle.toLowerCase();
			const [row] = await db
				.select({ userId: profile.userId, isPrivate: profile.isPrivate })
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!row) return status(404, "Not found");
			const viewerId = viewer?.id ?? null;
			const isOwner = viewerId === row.userId;
			if (row.isPrivate && !isOwner) return status(404, "Not found");

			const media = parseFilmographyMedia(query.media);
			const order = parseFilmographyOrder(query.order);
			const venue = parseFilmographyVenue(query.venue);
			const favorites = parseFilmographyFavorites(query.favorites);
			const page = parseFilmographyPage(query.page);
			const limit = parseFilmographyLimit(query.limit);
			const offset = filmographyOffset(page, limit);

			const isTv = media === "tv";
			const idCol = isTv ? log.tvId : log.movieId;
			const listing = isTv ? tv : movie;

			// Newest log per title (DISTINCT ON the media id, ordered by watchedAt desc).
			const deduped = db
				.selectDistinctOn([idCol], {
					logId: log.id,
					watchedAt: log.watchedAt,
					rating: log.rating,
					liked: log.liked,
					watchVenue: log.watchVenue,
					movieId: log.movieId,
					tvId: log.tvId,
					tmdbId: listing.tmdbId,
					title: listing.title,
					posterPath: listing.posterPath,
				})
				.from(log)
				.innerJoin(listing, eq(idCol, listing.tmdbId))
				.where(
					and(
						eq(log.userId, row.userId),
						isNotNull(idCol),
						contentVisibilityWhere(viewerId, log.userId, log.visibility),
					),
				)
				.orderBy(idCol, desc(log.watchedAt))
				.as("dedup");

			// Venue filter on the kept row: legacy/unset venue matches all venues.
			const venueWhere = venue
				? or(
						eq(deduped.watchVenue, venue),
						sql`${deduped.watchVenue} not in ('theaters','streaming')`,
					)
				: undefined;
			const favWhere = favorites ? eq(deduped.liked, true) : undefined;
			const outerWhere = and(venueWhere, favWhere);

			const orderBy =
				order === "earliest"
					? [asc(deduped.watchedAt), asc(deduped.tmdbId)]
					: order === "title"
						? [asc(deduped.title), asc(deduped.tmdbId)]
						: [desc(deduped.watchedAt), asc(deduped.tmdbId)];

			const [rows, totalRow, venueCountRow] = await Promise.all([
				db
					.select({
						logId: deduped.logId,
						watchedAt: deduped.watchedAt,
						rating: deduped.rating,
						liked: deduped.liked,
						watchVenue: deduped.watchVenue,
						movieId: deduped.movieId,
						tvId: deduped.tvId,
						tmdbId: deduped.tmdbId,
						title: deduped.title,
						posterPath: deduped.posterPath,
					})
					.from(deduped)
					.where(outerWhere)
					.orderBy(...orderBy)
					.limit(limit)
					.offset(offset),
				db
					.select({ total: count() })
					.from(deduped)
					.where(outerWhere),
				// venueCount for THIS media = distinct titles in this venue, favorites-off.
				db
					.select({ total: count() })
					.from(deduped)
					.where(venueWhere),
			]);

			const total = Number(totalRow[0]?.total ?? 0);
			const results = rows.map((r) => ({
				log: {
					id: r.logId,
					watchedAt: r.watchedAt,
					rating: r.rating,
					liked: r.liked,
					watchVenue: r.watchVenue,
				},
				movie: isTv
					? null
					: { tmdbId: r.tmdbId, title: r.title, posterPath: r.posterPath },
				tv: isTv
					? { tmdbId: r.tmdbId, title: r.title, posterPath: r.posterPath }
					: null,
			}));

			const venueCountForMedia = Number(venueCountRow[0]?.total ?? 0);
			return {
				results,
				total_pages: filmographyTotalPages(total, limit),
				total_results: total,
				venueCounts: {
					movies: isTv ? 0 : venueCountForMedia,
					tv: isTv ? venueCountForMedia : 0,
				},
			};
		},
		{
			params: t.Object({ handle: t.String() }),
			query: t.Object({
				media: t.Optional(t.String()),
				order: t.Optional(t.String()),
				venue: t.Optional(t.String()),
				favorites: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
```

**Drizzle note:** `selectDistinctOn` + `.as()` subquery, then `db.select().from(subquery)` is supported in Drizzle (`selectDistinctOn` is Postgres-only). If the typed `.from(deduped)` re-select gives trouble, fall back to a raw `sql` subquery wrapped with `db.execute(sql\`…\`)`, but prefer the query-builder form above. `venueCounts` only carries a meaningful number for the requested `media` (the other is 0) — that's intentional; the web side reads only the active media's value.

- [ ] **Step 3: Server typecheck**

Run: `cd apps/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iv "TS5055" | grep -i error`
Expected: no output. Fix any real (non-TS5055) error — most likely a Drizzle typing nuance on the subquery; resolve per the Drizzle note.

- [ ] **Step 4: Smoke the query shape (no DB harness — sanity only)**

Run: `bun test apps/server/src/lib/profile-filmography-query.test.ts apps/server/src/routes/lists.test.ts`
Expected: PASS (confirms nothing else broke at import/build time).

- [ ] **Step 5: Commit**

```
git add apps/server/src/routes/profiles.ts
git commit -m "feat(profile): paginated /:handle/filmography endpoint (dedup + filters)"
```

---

## Task 3: Server — swap `recentlyWatched` → `filmographyCounts` in `GET /:handle`

**Files:**
- Modify: `apps/server/src/routes/profiles.ts` (the `GET /:handle` handler, ~lines 679-830)

**Context:** Remove the 500-row ledger query (`recent`) and the `recentlyWatched` response field. Add four aggregate counts computed from the dedup subquery. Counts are venue-independent; `likedMovies`/`likedTv` count titles whose **newest** log is liked.

- [ ] **Step 1: Replace the `recent` ledger query inside the `Promise.all([...])`**

Find the `Promise.all` array member that builds `recent` (the `db.select({ log, movie, tv }).from(log)...orderBy(desc(log.watchedAt)).limit(PROFILE_WATCH_LEDGER_LIMIT)` block). Replace that single array element with a helper-built counts object. First, delete the `const PROFILE_WATCH_LEDGER_LIMIT = 500;` line.

Replace the `recent` array element with `filmographyCountsPromise`, and define it just above the `Promise.all` call:

```ts
			// Distinct-title counts for tab availability + count lines (replaces the
			// old 500-row ledger). Newest-log-per-title dedup, viewer visibility applied.
			const dedupMovies = db
				.selectDistinctOn([log.movieId], { liked: log.liked })
				.from(log)
				.where(
					and(
						eq(log.userId, targetUserId),
						isNotNull(log.movieId),
						contentVisibilityWhere(viewerId, log.userId, log.visibility),
					),
				)
				.orderBy(log.movieId, desc(log.watchedAt))
				.as("dedup_movies");
			const dedupTv = db
				.selectDistinctOn([log.tvId], { liked: log.liked })
				.from(log)
				.where(
					and(
						eq(log.userId, targetUserId),
						isNotNull(log.tvId),
						contentVisibilityWhere(viewerId, log.userId, log.visibility),
					),
				)
				.orderBy(log.tvId, desc(log.watchedAt))
				.as("dedup_tv");

			const filmographyCountsPromise = Promise.all([
				db.select({ c: count() }).from(dedupMovies),
				db.select({ c: count() }).from(dedupTv),
				db.select({ c: count() }).from(dedupMovies).where(eq(dedupMovies.liked, true)),
				db.select({ c: count() }).from(dedupTv).where(eq(dedupTv.liked, true)),
			]).then(([m, tvc, lm, ltv]) => ({
				movies: Number(m[0]?.c ?? 0),
				tv: Number(tvc[0]?.c ?? 0),
				likedMovies: Number(lm[0]?.c ?? 0),
				likedTv: Number(ltv[0]?.c ?? 0),
			}));
```

Then in the `Promise.all([...])`, replace the `recent` element with `filmographyCountsPromise`, and rename the destructured binding from `recent` to `filmographyCounts`:

```ts
			const [
				followCount,
				followingCount,
				isFollowing,
				filmographyCounts,   // was: recent
				recentReviews,
				pinnedReviews,
				lists,
				pinned,
				curator,
				earnedBadges,
				unlockedAchievements,
			] = await Promise.all([
				/* followCount */ ...,
				/* followingCount */ ...,
				/* isFollowing */ ...,
				filmographyCountsPromise,   // replaces the old `recent` ledger query
				/* recentReviews */ ...,
				...
			]);
```

(Keep all other `Promise.all` members exactly as they are — only the 4th element changes.)

- [ ] **Step 2: Replace the response field**

In the returned object, replace `recentlyWatched: recent,` with:

```ts
				filmographyCounts,
```

- [ ] **Step 3: Server typecheck**

Run: `cd apps/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iv "TS5055" | grep -i error`
Expected: no output.

- [ ] **Step 4: Commit**

```
git add apps/server/src/routes/profiles.ts
git commit -m "feat(profile): replace 500-row ledger with filmographyCounts in payload"
```

---

## Task 4: Web — client + server filmography fetchers + row→seed mapper

**Files:**
- Create: `apps/web/src/lib/profile-filmography-fetch.ts`
- Create: `apps/web/src/lib/fetch-profile-filmography-server.ts`

**Context:** Map endpoint rows (`{ log, movie, tv }`) to `PopularMovieSeed` reusing the existing poster-url + caption logic. The seed needs `id`, `title`, `poster_url`, `listingKind`, and `scopeLabel` (the rating/like caption). Reuse `profileWatchedRowToPersonFilmography` then `personRowToSeed`-style mapping, or map directly.

- [ ] **Step 1: Create the client fetcher + mapper**

Create `apps/web/src/lib/profile-filmography-fetch.ts`:

```ts
import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { profileWatchedRowToPersonFilmography } from "@/lib/profile-filmography-map";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type ProfileFilmographyVenueCounts = { movies: number; tv: number };

export type FilmographyQueryOpts = {
	media: "movie" | "tv";
	order: "latest" | "earliest" | "title";
	/** Omit / null = all venues. */
	venue?: "theaters" | "streaming" | null;
	favorites?: boolean;
	signal?: AbortSignal;
};

/** Endpoint row → poster seed (carries the rating/like caption as scopeLabel). */
export function profileFilmographyRowToSeed(
	row: ProfileFilmographyRow,
): PopularMovieSeed | null {
	const person = profileWatchedRowToPersonFilmography(row);
	if (!person) return null;
	return {
		id: person.tmdbId,
		title: person.title,
		poster_url: person.posterUrl,
		listingKind: person.mediaKind === "tv" ? "tv" : "movie",
		scopeLabel: person.posterCaption ?? null,
	};
}

function buildFilmographyUrl(
	handle: string,
	page: number,
	opts: FilmographyQueryOpts,
): URL {
	const url = new URL(
		`/api/profiles/${encodeURIComponent(handle)}/filmography`,
		stillApiOrigin(),
	);
	url.searchParams.set("media", opts.media);
	url.searchParams.set("order", opts.order);
	if (opts.venue) url.searchParams.set("venue", opts.venue);
	if (opts.favorites) url.searchParams.set("favorites", "1");
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	return url;
}

/** Client load-more for the profile grid (PopularMoviesInfinite `loadPage`). */
export async function fetchProfileFilmography(
	handle: string,
	page: number,
	opts: FilmographyQueryOpts,
): Promise<{ results: PopularMovieSeed[]; total_pages: number } | { error: true }> {
	const url = buildFilmographyUrl(handle, page, opts);
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts.signal,
	});
	if (!response.ok) return { error: true };
	const raw = (await response.json().catch(() => null)) as
		| { results?: ProfileFilmographyRow[]; total_pages?: number }
		| null;
	if (!raw || !Array.isArray(raw.results)) return { error: true };
	const results = raw.results
		.map(profileFilmographyRowToSeed)
		.filter((s): s is PopularMovieSeed => s != null);
	return {
		results,
		total_pages: typeof raw.total_pages === "number" ? raw.total_pages : page,
	};
}
```

- [ ] **Step 2: Create the RSC page-1 helper**

Create `apps/web/src/lib/fetch-profile-filmography-server.ts`:

```ts
import "server-only";

import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import {
	type FilmographyQueryOpts,
	profileFilmographyRowToSeed,
	type ProfileFilmographyVenueCounts,
} from "@/lib/profile-filmography-fetch";
import { serverApi } from "@/lib/server-api";
import { FILMOGRAPHY_DEFAULT_LIMIT } from "@/lib/profile-filmography-page-size";

/**
 * RSC page-1 fetch for the profile filmography grid — forwards cookies via Eden,
 * returns poster seeds + pagination meta + the active-media venue count.
 */
export async function fetchProfileFilmographyServer(
	handle: string,
	opts: Omit<FilmographyQueryOpts, "signal">,
): Promise<{
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	venueCounts: ProfileFilmographyVenueCounts;
}> {
	const empty = {
		seeds: [] as PopularMovieSeed[],
		totalPages: 0,
		totalResults: 0,
		venueCounts: { movies: 0, tv: 0 },
	};
	try {
		const client = await serverApi();
		const res = await client.api
			.profiles({ handle })
			.filmography.get({
				query: {
					media: opts.media,
					order: opts.order,
					...(opts.venue ? { venue: opts.venue } : {}),
					...(opts.favorites ? { favorites: "1" } : {}),
					page: "1",
					limit: String(FILMOGRAPHY_DEFAULT_LIMIT),
				},
			});
		if (res.error != null) {
			console.error("[fetchProfileFilmographyServer] failed:", res.error);
			return empty;
		}
		const data = res.data as unknown as {
			results?: ProfileFilmographyRow[];
			total_pages?: number;
			total_results?: number;
			venueCounts?: ProfileFilmographyVenueCounts;
		} | null;
		const rows = Array.isArray(data?.results) ? data.results : [];
		const seeds = rows
			.map(profileFilmographyRowToSeed)
			.filter((s): s is PopularMovieSeed => s != null);
		return {
			seeds,
			totalPages: typeof data?.total_pages === "number" ? data.total_pages : 1,
			totalResults:
				typeof data?.total_results === "number"
					? data.total_results
					: seeds.length,
			venueCounts: data?.venueCounts ?? { movies: 0, tv: 0 },
		};
	} catch (err) {
		console.error("[fetchProfileFilmographyServer] threw:", err);
		return empty;
	}
}
```

- [ ] **Step 3: Create the shared page-size constant**

The server constant lives in `@still`-server space; the web side needs its own. Create `apps/web/src/lib/profile-filmography-page-size.ts`:

```ts
/** First-page size for the profile filmography grid; mirrors the server default. */
export const FILMOGRAPHY_DEFAULT_LIMIT = 48;
```

- [ ] **Step 4: Typecheck (web)**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false 2>&1 | grep -iE "error TS" | grep -ivE "list-meta-line|tv-log-scope-prior"`
Expected: no output **except** errors in files not yet updated (page/shell still reference `recentlyWatched`). Confirm there are NO errors inside `profile-filmography-fetch.ts`, `fetch-profile-filmography-server.ts`, or `profile-filmography-page-size.ts`. (If the Eden call `.profiles({handle}).filmography.get` mis-types, cast via `client.api.profiles({ handle }) as any` is acceptable as a last resort — note it.)

- [ ] **Step 5: Commit**

```
git add apps/web/src/lib/profile-filmography-fetch.ts apps/web/src/lib/fetch-profile-filmography-server.ts apps/web/src/lib/profile-filmography-page-size.ts
git commit -m "feat(profile): client + server filmography fetchers"
```

---

## Task 5: Web — counts-based tab resolution helper (TDD)

**Files:**
- Modify: `apps/web/src/lib/profile-lobby-derive.ts`
- Test: `apps/web/src/lib/profile-lobby-derive.test.ts` (create)

**Context:** `resolveProfileTab` currently takes `movieRows`/`tvRows` arrays. Add a counts-based variant so the page/params context can resolve the default tab without the full ledger.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/profile-lobby-derive.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { resolveProfileTabFromCounts } from "./profile-lobby-derive";

describe("resolveProfileTabFromCounts", () => {
	const counts = { movies: 3, tv: 2 };
	test("honors explicit valid tab", () => {
		expect(resolveProfileTabFromCounts("tv", ["lists"], counts)).toBe("tv");
		expect(resolveProfileTabFromCounts("lists", ["lists"], counts)).toBe("lists");
	});
	test("'filmography' maps to movies when present, else tv", () => {
		expect(resolveProfileTabFromCounts("filmography", [], counts)).toBe("movies");
		expect(
			resolveProfileTabFromCounts("filmography", [], { movies: 0, tv: 5 }),
		).toBe("tv");
	});
	test("falls back to movies, then tv, then first social tab", () => {
		expect(resolveProfileTabFromCounts(undefined, [], counts)).toBe("movies");
		expect(
			resolveProfileTabFromCounts(undefined, [], { movies: 0, tv: 4 }),
		).toBe("tv");
		expect(
			resolveProfileTabFromCounts(undefined, ["reviews"], { movies: 0, tv: 0 }),
		).toBe("reviews");
	});
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun test apps/web/src/lib/profile-lobby-derive.test.ts`
Expected: FAIL — `resolveProfileTabFromCounts` not exported.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/profile-lobby-derive.ts`, add (keep existing exports):

```ts
/** Counts-based default-tab resolution — mirrors `resolveProfileTab` without rows. */
export function resolveProfileTabFromCounts(
	raw: string | undefined | null,
	socialTabs: readonly ProfileSocialTabId[],
	counts: { movies: number; tv: number },
): ProfileTabId {
	let v = raw?.toLowerCase();
	if (v === "filmography") {
		v = counts.movies > 0 ? "movies" : counts.tv > 0 ? "tv" : "movies";
	}
	const available: ProfileTabId[] = ["movies", "tv", ...socialTabs];
	if (v && (available as readonly string[]).includes(v)) {
		return v as ProfileTabId;
	}
	if (counts.movies > 0) return "movies";
	if (counts.tv > 0) return "tv";
	return socialTabs[0] ?? "movies";
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun test apps/web/src/lib/profile-lobby-derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add apps/web/src/lib/profile-lobby-derive.ts apps/web/src/lib/profile-lobby-derive.test.ts
git commit -m "feat(profile): counts-based default-tab resolver"
```

---

## Task 6: Web — params context consumes counts (not rows)

**Files:**
- Modify: `apps/web/src/components/profile/profile-lobby-params-context.tsx`

**Context:** The provider currently takes `moviesAll`/`tvAll: ProfileFilmographyRow[]` to resolve the content tab. Switch it to `counts: { movies: number; tv: number; likedMovies: number; likedTv: number }`. The favorites→content-tab branch (`movieRows.some(liked) || tvAll.length === 0`) becomes `counts.likedMovies > 0 || counts.tv === 0`.

- [ ] **Step 1: Change the provider props + internal logic**

Edit `profile-lobby-params-context.tsx`:

1. Replace the import of `resolveProfileTab` + `splitProfileFilmographyLedger` usage with `resolveProfileTabFromCounts` (keep `profileLedgerTabFromContent`). Update the import:

```ts
import {
	profileLedgerTabFromContent,
	resolveProfileTabFromCounts,
} from "@/lib/profile-lobby-derive";
```

2. Change `snapshotFromSearchParams` signature + body to use counts:

```ts
function snapshotFromSearchParams(
	searchParams: URLSearchParams,
	socialTabs: readonly ProfileSocialTabId[],
	counts: { movies: number; tv: number; likedMovies: number; likedTv: number },
): ProfileLobbySnapshot & {
	contentTab: ProfileTabId;
	ledgerTab: ProfileLedgerTabId;
} {
	const order = parseProfileLobbyOrder(searchParams.get("order"));
	const venue = parseProfileLobbyVenue(searchParams.get("venue"));
	const favoritesOnly = parseProfileLobbyFavorites(searchParams.get("favorites"));
	const contentTab = resolveProfileTabFromCounts(
		searchParams.get("tab"),
		socialTabs,
		counts,
	);
	const toolbarActiveTab: ProfileTabId =
		favoritesOnly && socialTabs.includes("favorites") ? "favorites" : contentTab;
	const ledgerTab = profileLedgerTabFromContent(contentTab);
	return { order, venue, favoritesOnly, toolbarActiveTab, contentTab, ledgerTab };
}
```

3. Change the provider component props from `moviesAll`/`tvAll` to `counts`:

```ts
export function ProfileLobbyParamsProvider({
	handle,
	socialTabs,
	counts,
	children,
}: {
	handle: string;
	socialTabs: readonly ProfileSocialTabId[];
	counts: { movies: number; tv: number; likedMovies: number; likedTv: number };
	children: ReactNode;
}) {
```

4. Update `urlState` memo deps + call to pass `counts`:

```ts
	const urlState = useMemo(
		() =>
			snapshotFromSearchParams(
				new URLSearchParams(searchParams.toString()),
				socialTabs,
				counts,
			),
		[searchParams, socialTabs, counts],
	);
```

5. Replace the `contentTab` memo's favorites branch and the trailing `resolveProfileTab` fallback to use counts:

```ts
	const contentTab = useMemo(() => {
		if (
			active.toolbarActiveTab === "lists" ||
			active.toolbarActiveTab === "reviews"
		) {
			return active.toolbarActiveTab;
		}
		if (active.toolbarActiveTab === "favorites") {
			return counts.likedMovies > 0 || counts.tv === 0 ? "movies" : "tv";
		}
		if (
			active.toolbarActiveTab === "movies" ||
			active.toolbarActiveTab === "tv"
		) {
			return active.toolbarActiveTab;
		}
		return resolveProfileTabFromCounts(
			searchParams.get("tab"),
			socialTabs,
			counts,
		);
	}, [active.toolbarActiveTab, counts, socialTabs, searchParams]);
```

Remove the now-unused `import type { ProfileFilmographyRow }` and `splitProfileFilmographyLedger` import.

- [ ] **Step 2: Typecheck (expect errors only in shell, fixed in Task 7)**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false 2>&1 | grep -iE "profile-lobby-params-context"`
Expected: no errors in `profile-lobby-params-context.tsx` itself. (The shell still passes `moviesAll`/`tvAll` → that error is fixed in Task 7.)

- [ ] **Step 3: Commit**

```
git add apps/web/src/components/profile/profile-lobby-params-context.tsx
git commit -m "refactor(profile): params context resolves tab from counts"
```

---

## Task 7: Web — shell + catalogue + panels consume seeds & counts

**Files:**
- Modify: `apps/web/src/components/profile/profile-lobby-catalogue.tsx`
- Modify: `apps/web/src/components/profile/profile-tab-panels.tsx`
- Modify: `apps/web/src/components/profile/profile-patron-lobby-shell.tsx`

**Context:** The shell stops deriving the ledger client-side. It receives `seeds`, `totalPages`, `totalResults`, `venueCounts`, `filmographyCounts`, plus the active `media`/`order`/`venue`/`favorites` (from the params context) and renders the grid via `PopularMoviesInfinite` with `loadPage`. The grid only shows the **active** tab (movies or tv); switching tabs/order/venue/favorites navigates → RSC reseeds.

- [ ] **Step 1: Rewrite `profile-lobby-catalogue.tsx` to paginate**

Replace the whole file with:

```tsx
"use client";

import { useCallback } from "react";

import {
	type PopularMovieSeed,
	PopularMoviesInfinite,
} from "@/components/movie/popular-movies-infinite";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	type FilmographyQueryOpts,
	fetchProfileFilmography,
} from "@/lib/profile-filmography-fetch";

/**
 * Patron filmography grid — seeds page 1 (server-rendered) and pages the personal
 * ledger on scroll via `fetchProfileFilmography` (see `loadPage`).
 */
export function ProfileLobbyCatalogue({
	handle,
	seeds,
	totalPages,
	totalResults,
	query,
	catalogueWaveKeyOverride,
	monochromePeersOnHover = true,
}: {
	handle: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	query: Omit<FilmographyQueryOpts, "signal">;
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover?: boolean;
}) {
	const cellKey = useCallback(
		(m: PopularMovieSeed) => `${m.listingKind ?? "movie"}:${m.id}`,
		[],
	);
	const loadPage = useCallback(
		(page: number) => fetchProfileFilmography(handle, page, query),
		[handle, query],
	);

	return (
		<PopularMoviesInfinite
			blockedReason={null}
			catalogMedia="movie"
			catalogLabel="profile"
			catalogueWaveKeyOverride={catalogueWaveKeyOverride}
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

Note: `query` must be referentially stable across renders or `loadPage`/effects churn — the shell builds it with `useMemo` (Step 3).

- [ ] **Step 2: Update `profile-tab-panels.tsx`**

The filmography panels now take seeds + counts instead of row arrays. Replace `ProfileFilmographyPanel` usage with a seed-driven panel. Rewrite `profile-tab-panels.tsx`:

```tsx
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { ProfileFilmographyPanel } from "@/components/profile/profile-filmography-panel";
import { ProfileListsPanel } from "@/components/profile/profile-lists-panel";
import {
	type ProfileReviewRow,
	ProfileReviewsPanel,
} from "@/components/profile/profile-reviews-panel";
import type { ProfileTabId } from "@/components/profile/profile-tab-toolbar";
import type { FilmographyQueryOpts } from "@/lib/profile-filmography-fetch";
import type { HomeVenue } from "@/lib/home-venue";
import type { ListBoardRow } from "@/lib/list-board-row";

export function ProfileTabPanels({
	activeTab,
	handle,
	seeds,
	totalPages,
	totalResults,
	query,
	moviesAllCount,
	tvAllCount,
	venueCountForMedia,
	favoritesOnly,
	showAllLedgerHref,
	lobbyVenue,
	switchVenueHref,
	reviews,
	lists,
	catalogueWaveKey,
	monochromePeersOnHover,
	isMe = false,
}: {
	activeTab: ProfileTabId;
	handle: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	query: Omit<FilmographyQueryOpts, "signal">;
	moviesAllCount: number;
	tvAllCount: number;
	venueCountForMedia: number;
	favoritesOnly: boolean;
	showAllLedgerHref: string;
	lobbyVenue: HomeVenue;
	switchVenueHref: string;
	reviews: ProfileReviewRow[];
	lists: ListBoardRow[];
	catalogueWaveKey: string;
	monochromePeersOnHover: boolean;
	isMe?: boolean;
}) {
	if (activeTab === "movies" || activeTab === "tv") {
		const kind = activeTab;
		const allCount = kind === "tv" ? tvAllCount : moviesAllCount;
		return (
			<ProfileFilmographyPanel
				handle={handle}
				seeds={seeds}
				totalPages={totalPages}
				totalResults={totalResults}
				query={query}
				kind={kind}
				catalogueWaveKey={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
				hasLogsOtherVenue={allCount > 0 && totalResults === 0}
				hasRowsWhenFavoritesOff={
					favoritesOnly && venueCountForMedia > 0 && totalResults === 0
				}
				favoritesOnly={favoritesOnly}
				showAllLedgerHref={showAllLedgerHref}
				switchVenueHref={switchVenueHref}
				lobbyVenue={lobbyVenue}
			/>
		);
	}
	if (activeTab === "reviews") {
		return <ProfileReviewsPanel rows={reviews} isMe={isMe} />;
	}
	if (activeTab === "lists") {
		return (
			<ProfileListsPanel
				lists={lists}
				catalogueWaveKey={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
			/>
		);
	}
	return null;
}
```

- [ ] **Step 3: Update `profile-filmography-panel.tsx`**

Change the panel to take seeds + render `ProfileLobbyCatalogue` (seed-driven). Replace the props block + the non-empty render; KEEP the entire empty-state JSX exactly as-is (it only depends on `kind`, `hasLogsOtherVenue`, `hasRowsWhenFavoritesOff`, `favoritesOnly`, `showAllLedgerHref`, `switchVenueHref`, `lobbyVenue`). Replace the top of the file (imports + signature + the empty check + the final return):

```tsx
"use client";

import Link from "next/link";

import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { ProfileLobbyCatalogue } from "@/components/profile/profile-lobby-catalogue";
import type { FilmographyQueryOpts } from "@/lib/profile-filmography-fetch";

/** Public row shape kept for the server payload + seed mapping. */
export type ProfileFilmographyRow = {
	log: {
		id: string;
		watchedAt: string | Date;
		rating: number | null;
		liked: boolean;
		watchVenue?: "theaters" | "streaming";
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	tv: { tmdbId: number; title: string; posterPath: string | null } | null;
};

type ProfileFilmographyPanelProps = {
	handle: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	query: Omit<FilmographyQueryOpts, "signal">;
	kind: "movies" | "tv";
	catalogueWaveKey: string;
	monochromePeersOnHover?: boolean;
	hasLogsOtherVenue?: boolean;
	hasRowsWhenFavoritesOff?: boolean;
	favoritesOnly?: boolean;
	showAllLedgerHref?: string;
	switchVenueHref?: string;
	lobbyVenue?: "theaters" | "streaming";
};

export function ProfileFilmographyPanel({
	handle,
	seeds,
	totalPages,
	totalResults,
	query,
	kind,
	catalogueWaveKey,
	monochromePeersOnHover = true,
	hasLogsOtherVenue = false,
	hasRowsWhenFavoritesOff = false,
	favoritesOnly = false,
	showAllLedgerHref,
	switchVenueHref,
	lobbyVenue = "streaming",
}: ProfileFilmographyPanelProps) {
	const { navigate } = useLobbyNavigation();

	if (seeds.length === 0) {
		const label = kind === "tv" ? "TV shows" : "films";
		const venueLabel = lobbyVenue === "theaters" ? "in cinemas" : "at home";
		return (
			/* ====> KEEP THE EXISTING EMPTY-STATE JSX VERBATIM (the whole
			   `<div role="status">…</div>` block from the current file) <==== */
		);
	}

	return (
		<ProfileLobbyCatalogue
			handle={handle}
			seeds={seeds}
			totalPages={totalPages}
			totalResults={totalResults}
			query={query}
			catalogueWaveKeyOverride={catalogueWaveKey}
			monochromePeersOnHover={monochromePeersOnHover}
		/>
	);
}
```

(`profileWatchedRowsToPersonFilmography` import is no longer used here — remove it. The empty-state block references `navigate`, `label`, `venueLabel`, `showAllLedgerHref`, `switchVenueHref`, `hasRowsWhenFavoritesOff`, `hasLogsOtherVenue`, `favoritesOnly`, `kind`, `lobbyVenue` — all still in scope.)

- [ ] **Step 4: Rewrite `profile-patron-lobby-shell.tsx`**

The shell now receives seeds + counts (from props) and reads the active query from the params context. Replace the file's body — props interface gains `seeds`, `totalPages`, `totalResults`, `venueCounts`, `filmographyCounts`; drop `recentlyWatched`. The `ProfilePatronLobbyBody` drops all `useMemo` ledger derivation and builds a stable `query` object instead.

Key changes:
1. Props interface: replace `recentlyWatched: ProfileFilmographyRow[];` with:

```ts
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	venueCounts: { movies: number; tv: number };
	filmographyCounts: { movies: number; tv: number; likedMovies: number; likedTv: number };
```

(Add `import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";`.)

2. In `ProfilePatronLobbyBody`, remove the `allFilmographyRows` / `venueFilteredRows` / `filmographyRows` / `movieRows` / `tvRows` / `moviesVenueAll` / `tvVenueAll` memos. Replace with:

```ts
	const { order, venue, favoritesOnly, toolbarActiveTab, contentTab, ledgerTab } =
		useProfileLobbyParams();

	const media: "movie" | "tv" = ledgerTab === "tv" ? "tv" : "movie";
	const orderToken =
		order === "earliest_seen"
			? "earliest"
			: order === "title_az"
				? "title"
				: "latest";
	const query = useMemo(
		() => ({
			media,
			order: orderToken as "latest" | "earliest" | "title",
			venue: venue as "theaters" | "streaming",
			favorites: favoritesOnly,
		}),
		[media, orderToken, venue, favoritesOnly],
	);

	const moviesAllCount = filmographyCounts.movies;
	const tvAllCount = filmographyCounts.tv;
	const venueCountForMedia = media === "tv" ? venueCounts.tv : venueCounts.movies;

	const catalogueWaveKey =
		contentTab === "lists"
			? `lists:${lists.map((l) => l.id).join("|")}`
			: `${contentTab}:${order}:${venue}:${favoritesOnly ? "fav" : "all"}`;

	const titleCountLine = titleCountLineForProfileTab(
		toolbarActiveTab,
		media === "movie" ? totalResults : 0,
		media === "tv" ? totalResults : 0,
		favoritesOnly,
		recentReviews.length,
		lists.length,
	);
```

Note on `query.venue`: the params context `venue` is always `theaters` or `streaming` (never null — it has a default). The profile filmography "all venues" case does not exist in the current UI (venue is always one of the two, toggled), so passing the concrete venue is correct and matches today's behaviour.

3. Pass the new props to `ProfileTabPanels`:

```tsx
					<ProfileTabPanels
						activeTab={contentTab}
						handle={handle}
						seeds={seeds}
						totalPages={totalPages}
						totalResults={totalResults}
						query={query}
						moviesAllCount={moviesAllCount}
						tvAllCount={tvAllCount}
						venueCountForMedia={venueCountForMedia}
						favoritesOnly={favoritesOnly}
						showAllLedgerHref={showAllLedgerHref}
						lobbyVenue={venue}
						switchVenueHref={switchVenueHref}
						reviews={recentReviews}
						lists={lists}
						catalogueWaveKey={catalogueWaveKey}
						monochromePeersOnHover={monochromePeersOnHover}
						isMe={isMe}
					/>
```

4. In `ProfilePatronLobbyShell` (outer), replace the `filmographyFromRecentlyWatched`/`splitProfileFilmographyLedger` memo with passing `counts` to the provider:

```tsx
export function ProfilePatronLobbyShell(props: ProfilePatronLobbyShellProps) {
	const { handle, socialTabs, filmographyCounts } = props;
	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<LobbyNavigationProvider>
				<ProfileLobbyParamsProvider
					handle={handle}
					socialTabs={socialTabs}
					counts={filmographyCounts}
				>
					<ProfilePatronLobbyBody {...props} />
				</ProfileLobbyParamsProvider>
			</LobbyNavigationProvider>
		</div>
	);
}
```

Remove now-unused imports: `filmographyFromRecentlyWatched`, `prepareProfileFilmography`, `splitProfileFilmographyLedger`, `profileLogMatchesProfileLobbyVenue`, and the `ProfileFilmographyRow` type import if no longer referenced. Keep `titleCountLineForProfileTab`, `profileInitials`, `buildProfileLobbyHref`.

- [ ] **Step 5: Typecheck (expect only page.tsx errors, fixed in Task 8)**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false 2>&1 | grep -iE "error TS" | grep -ivE "list-meta-line|tv-log-scope-prior"`
Expected: errors ONLY in `profile/[handle]/page.tsx` (still passes `recentlyWatched`). No errors in the shell/catalogue/panels you just edited. Fix any that are in your edited files.

- [ ] **Step 6: Commit**

```
git add apps/web/src/components/profile/profile-lobby-catalogue.tsx apps/web/src/components/profile/profile-tab-panels.tsx apps/web/src/components/profile/profile-filmography-panel.tsx apps/web/src/components/profile/profile-patron-lobby-shell.tsx
git commit -m "refactor(profile): grid paginates via loadPage; shell consumes seeds + counts"
```

---

## Task 8: Web — profile page seeds page 1; prune; verify

**Files:**
- Modify: `apps/web/src/app/(app)/profile/[handle]/page.tsx`
- Modify (prune): `apps/web/src/lib/profile-lobby-order.ts`, `apps/web/src/lib/profile-lobby-derive.ts`

- [ ] **Step 1: Update `page.tsx` data flow**

In `profile/[handle]/page.tsx`:

1. Update the `ProfileData` type: replace `recentlyWatched: ProfileFilmographyRow[];` with:

```ts
	filmographyCounts: {
		movies: number;
		tv: number;
		likedMovies: number;
		likedTv: number;
	};
```

2. Replace the filmography-deriving block (`allFilmographyRows` / `splitProfileFilmographyLedger` / `moviesAll` / `tvAll`) and the `likedFilmographyCount` with counts, and resolve the active media to fetch page 1. After `const data = res.data as ProfileData | null; if (!data) notFound();` and the existing `lobbyOrder`/`lobbyVenue` parsing, add:

```ts
	const counts = data.filmographyCounts;

	// favorites tab → ledger redirect (unchanged behaviour, now off counts).
	if (sp.tab?.toLowerCase() === "favorites") {
		const ledgerTab = counts.likedMovies > 0 || counts.tv === 0 ? "movies" : "tv";
		redirect(
			buildProfileLobbyHref({
				handle: profile.handle,
				tab: ledgerTab,
				order: lobbyOrder,
				venue: lobbyVenue,
				favoritesOnly: true,
			}),
		);
	}

	const favoritesOnly = parseProfileLobbyFavorites(sp.favorites);
	const activeMedia: "movie" | "tv" =
		(sp.tab?.toLowerCase() === "tv"
			? "tv"
			: sp.tab?.toLowerCase() === "movies"
				? "movie"
				: counts.movies > 0
					? "movie"
					: counts.tv > 0
						? "tv"
						: "movie");
	const orderToken =
		lobbyOrder === "earliest_seen"
			? "earliest"
			: lobbyOrder === "title_az"
				? "title"
				: "latest";

	const filmographyPage1 = await fetchProfileFilmographyServer(profile.handle, {
		media: activeMedia,
		order: orderToken,
		venue: lobbyVenue,
		favorites: favoritesOnly,
	});
```

Add imports:

```ts
import { fetchProfileFilmographyServer } from "@/lib/fetch-profile-filmography-server";
import { parseProfileLobbyFavorites } from "@/lib/profile-lobby-order";
```

Remove the imports of `filmographyFromRecentlyWatched` / `splitProfileFilmographyLedger` and the `ProfileFilmographyRow` type if no longer used.

3. `socialTabs` favorites availability uses counts:

```ts
	const socialTabs = PROFILE_TOOLBAR_SOCIAL_ORDER.filter((sec) => {
		if (sec === "favorites")
			return counts.likedMovies + counts.likedTv > 0;
		if (sec === "reviews")
			return (
				data.recentReviews.length > 0 || (data.pinnedReviews?.length ?? 0) > 0
			);
		if (sec === "lists") return data.lists.length > 0;
		return false;
	});
```

4. Pass the new props to `ProfilePatronLobbyShell` — replace `recentlyWatched={data.recentlyWatched}` with:

```tsx
			seeds={filmographyPage1.seeds}
			totalPages={filmographyPage1.totalPages}
			totalResults={filmographyPage1.totalResults}
			venueCounts={filmographyPage1.venueCounts}
			filmographyCounts={counts}
```

- [ ] **Step 2: Prune unused client helpers**

Now that the server filters/sorts, these client helpers are unused. Remove from `apps/web/src/lib/profile-lobby-order.ts`: `compareProfileFilmographyRows`, `sortProfileFilmographyRows`, `profileLogMatchesProfileLobbyVenue`, `listingTitle`. Keep: `buildProfileTabHref`, `buildProfileLobbyHref`, `parseProfileLobbyVenue`, `parseProfileLobbyOrder`, `parseProfileLobbyFavorites`, `orderToParam`, the types. From `apps/web/src/lib/profile-lobby-derive.ts`: remove `prepareProfileFilmography` and `resolveProfileTab` (row-based) if no remaining importers; keep `filmographyFromRecentlyWatched` only if still imported elsewhere (check with grep), else remove. Run a grep first:

```
./node_modules/.bin/biome check apps/web/src 2>&1 | grep -iE "noUnused|is unused" | head
```

and `grep -rn "prepareProfileFilmography\|sortProfileFilmographyRows\|resolveProfileTab\b\|profileLogMatchesProfileLobbyVenue\|filmographyFromRecentlyWatched" apps/web/src` — only delete a function when grep shows no remaining references.

- [ ] **Step 3: Full web typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false 2>&1 | grep -iE "error TS" | grep -ivE "list-meta-line|tv-log-scope-prior"`
Expected: NO output (only the two vitest baseline errors remain, which are filtered out).

- [ ] **Step 4: Lint**

Run: `./node_modules/.bin/biome check apps/web/src/components/profile apps/web/src/lib/profile-filmography-fetch.ts apps/web/src/lib/fetch-profile-filmography-server.ts "apps/web/src/app/(app)/profile/[handle]/page.tsx"`
Fix/format until clean.

- [ ] **Step 5: Tests**

Run: `bun test apps/server/src/lib/profile-filmography-query.test.ts apps/web/src/lib/profile-lobby-derive.test.ts apps/server/src/routes/lists.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```
git add apps/web/src/app/\(app\)/profile apps/web/src/lib/profile-lobby-order.ts apps/web/src/lib/profile-lobby-derive.ts
git commit -m "feat(profile): page seeds filmography page 1 + counts; prune client derivation"
```

---

## Task 9: Manual verification

- [ ] **Step 1: Boot + smoke**

Start the app (preview/dev). Sign in. Open a profile with a large filmography and confirm:
- First paint shows ~48 posters fast; scrolling loads more (`GET /api/profiles/:handle/filmography?...&page=2`).
- Switching Movies ↔ TV tabs reseeds correctly.
- Order chip (latest/earliest/title) reorders from page 1.
- Venue toggle (in cinemas / at home) reseeds; legacy logs appear under both.
- Favorites filter shows only hearted titles; the two empty-state hints still trigger (e.g. favorites-on with none in this venue → "No favorited … " with Show-all; logs only in other venue → "Show … instead").
- Title-count line reflects the current view.
- A signed-out / restricted viewer on a private profile gets 404; visibility-limited logs are excluded.

- [ ] **Step 2: Final review + finish**

Use `superpowers:finishing-a-development-branch`.

---

## Self-Review Notes

- **Spec §1 (endpoint):** Task 2. Dedup-then-filter order, venue legacy-match, favorites=newest-liked, deterministic tiebreak, `venueCounts` — all covered. ✓
- **Spec §2 (payload swap):** Task 3 (`filmographyCounts`, removes 500-row ledger). ✓
- **Spec §3 (page seeds + counts):** Task 8. ✓
- **Spec §4 (shell/panels/catalogue/params rewire):** Tasks 6, 7. ✓
- **Spec §5 (fetchers):** Task 4. ✓
- **Spec §6 (pure helper tests):** Tasks 1, 5. ✓
- **Spec §7 (verification):** Tasks 8, 9. ✓
- **Type consistency:** `filmographyCounts {movies,tv,likedMovies,likedTv}` (Tasks 3/6/7/8); endpoint `{results,total_pages,total_results,venueCounts{movies,tv}}` (Tasks 2/4); `FilmographyQueryOpts {media,order,venue,favorites,signal?}` (Tasks 4/7); `query` prop is `Omit<…,"signal">` everywhere it's passed (Tasks 7). ✓
- **Known risk:** the Drizzle `selectDistinctOn` subquery re-select (Task 2) may need an API tweak or raw-`sql` fallback — flagged in-task. The `query` object must be memoized (Task 7 Step 4) so `loadPage` is stable.
```
