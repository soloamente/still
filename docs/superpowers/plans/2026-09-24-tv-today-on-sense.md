# TV Today on Sense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in TV Shows on `/home` gets its own Today pick, week, and circle, remembered separately from Movies.

**Architecture:** One `TodayOnSense` shell takes `media: "movie" | "tv"`. Movie routes stay the calls with no `media` parameter. TV adds `?media=tv` on the existing for-you, week, and circle routes. The TV pick reuses the movie scoring steps with show ids. A Today-only page slide swaps the two blocks; the catalogue and browse pill stay instant.

**Tech Stack:** Next.js App Router, Elysia, Drizzle on Neon, Bun test, existing taste-profile / MMR helpers, transitions.dev page-slide tokens already in `packages/ui/src/styles/globals.css`.

## Global Constraints

- Movie Today reads, week (films and shows still mix), and circle stay unchanged when `media` is omitted.
- `media=tv` is the only accepted filter. Any other value, including `media=movie`, is 400.
- A diary row with a `tvId` counts toward that show at show, season, or episode scope.
- Cold start is 10 distinct shows, not 10 log rows. Fewer than 6 results also returns `coldStart` with no titles.
- Logged show ids, watchlisted show ids, and dismissed show ids are hard-excluded from the TV pick.
- TMDb ids overlap. TV dismissals live in `taste_dismissed_tv`, never in `taste_dismissed_movie`.
- Movie continuity key stays `still:today-pick:v1`. TV key is `still:today-pick:v1:tv`. TTL stays `2 * 60 * 60 * 1000`.
- TV **Watched** opens Quick Log with `logScope: "show"`. It does not instant-save. There is no “how was it” step.
- **Continue watching** stays the next block under TV Today. Do not move `HomeContinueWatchingRail`.
- Community and catalogue search render no Today.
- Do not select whole `tv.tmdb_json` rows.
- Do not replace `.t-page-slide` in `globals.css`. Auth, onboarding, and settings already use it. Today uses `.t-today-slide`.
- Active tab’s three reads start on the server. The other tab is prefetched only after that Today has painted, or when its browse pill is hovered.
- TV pick product events include `media: "tv"`. Movie event payloads stay as they are.
- Both Today pages are in the slide only while browse is Movies or TV Shows. Switching to or from Community does not slide.

---

### Task 1: Media query and TV week filter

**Files:**
- Create: `apps/server/src/lib/today-media.ts`
- Create: `apps/server/src/lib/today-media.test.ts`
- Modify: `apps/server/src/lib/today-week-pulse.ts`
- Modify: `apps/server/src/lib/today-week-pulse.test.ts`
- Modify: `apps/server/src/lib/today-week-pulse-query.ts`
- Modify: `apps/server/src/routes/today.ts`

**Interfaces:**
- Consumes: `TodayWeekLogRow`, `summarizeTodayWeekPulse` in `today-week-pulse.ts`
- Produces: `parseTodayMediaParam(raw: string | undefined): "all" | "tv" | "invalid"`; `filterTodayWeekRows(rows, media: "all" | "tv"): TodayWeekLogRow[]`; `fetchTodayWeekPulse(userId, timeZone, now?, media?: "all" | "tv")`

- [ ] **Step 1: Write the failing test**

Add `apps/server/src/lib/today-media.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { parseTodayMediaParam } from "./today-media";

describe("parseTodayMediaParam", () => {
	test("omitted media is the current mixed movie path", () => {
		expect(parseTodayMediaParam(undefined)).toBe("all");
		expect(parseTodayMediaParam("")).toBe("all");
	});

	test("tv is the only accepted filter", () => {
		expect(parseTodayMediaParam("tv")).toBe("tv");
	});

	test("movie and any other value are invalid", () => {
		expect(parseTodayMediaParam("movie")).toBe("invalid");
		expect(parseTodayMediaParam("shows")).toBe("invalid");
	});
});
```

Append to `apps/server/src/lib/today-week-pulse.test.ts` inside a new `describe("filterTodayWeekRows")`:

```ts
test("tv keeps show, season, and episode rows and drops films", () => {
	const rows = [
		{ watchedAt: "2026-09-23T12:00:00.000Z", rating: 80, movieId: 1, tvId: null },
		{ watchedAt: "2026-09-23T12:00:00.000Z", rating: 70, movieId: null, tvId: 9 },
		{ watchedAt: "2026-09-23T12:00:00.000Z", rating: null, movieId: null, tvId: 9 },
	];
	expect(filterTodayWeekRows(rows, "tv")).toEqual([rows[1], rows[2]]);
});

test("all returns every row", () => {
	const rows = [
		{ watchedAt: "2026-09-23T12:00:00.000Z", rating: 80, movieId: 1, tvId: null },
		{ watchedAt: "2026-09-23T12:00:00.000Z", rating: 70, movieId: null, tvId: 9 },
	];
	expect(filterTodayWeekRows(rows, "all")).toEqual(rows);
});
```

Import `filterTodayWeekRows` from `./today-week-pulse` in that test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/today-media.test.ts apps/server/src/lib/today-week-pulse.test.ts`

Expected: FAIL. `parseTodayMediaParam` and `filterTodayWeekRows` are not exported.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/lib/today-media.ts`:

```ts
/** Omitted `media` keeps today's movie routes. `tv` is the only filter. */
export type TodayMediaParam = "all" | "tv" | "invalid";

export function parseTodayMediaParam(raw: string | undefined): TodayMediaParam {
	const value = raw?.trim() ?? "";
	if (value === "") return "all";
	if (value === "tv") return "tv";
	return "invalid";
}
```

In `today-week-pulse.ts`, after `TodayWeekLogRow`:

```ts
export function filterTodayWeekRows(
	rows: readonly TodayWeekLogRow[],
	media: "all" | "tv",
): TodayWeekLogRow[] {
	if (media === "all") return [...rows];
	return rows.filter((row) => row.tvId != null);
}
```

`fetchTodayWeekPulse` gains a last argument `media: "all" | "tv" = "all"` and returns `summarizeTodayWeekPulse(filterTodayWeekRows(rows, media), timeZone, now)`.

`apps/server/src/routes/today.ts` week handler:

```ts
const media = parseTodayMediaParam(query.media);
if (media === "invalid") return status(400, "Invalid media");
return fetchTodayWeekPulse(
	user.id,
	normalizeLeaderboardTimeZone(query.tz),
	new Date(),
	media,
);
```

Query schema adds `media: t.Optional(t.String())`. Import `parseTodayMediaParam`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/today-media.test.ts apps/server/src/lib/today-week-pulse.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/today-media.ts apps/server/src/lib/today-media.test.ts apps/server/src/lib/today-week-pulse.ts apps/server/src/lib/today-week-pulse.test.ts apps/server/src/lib/today-week-pulse-query.ts apps/server/src/routes/today.ts
git commit -m "feat(today): filter the TV week without changing the movie week"
```

---

### Task 2: Circle filter

**Files:**
- Modify: `apps/server/src/lib/today-circle-activity.ts`
- Modify: `apps/server/src/lib/today-circle-activity.test.ts`
- Modify: `apps/server/src/lib/today-circle-activity-query.ts`
- Modify: `apps/server/src/routes/today.ts`

**Interfaces:**
- Consumes: `parseTodayMediaParam` from Task 1; `TodayCircleRow`
- Produces: `circleRowMatchesMedia(row, media: "all" | "tv"): boolean`. The SQL query adds `isNotNull(log.tvId)` only when `media === "tv"`.

- [ ] **Step 1: Write the failing test**

In `today-circle-activity.test.ts`:

```ts
test("tv circle ignores a film row", () => {
	expect(
		circleRowMatchesMedia({ movieId: 438631, tvId: null }, "tv"),
	).toBe(false);
	expect(
		circleRowMatchesMedia({ movieId: null, tvId: 1399 }, "tv"),
	).toBe(true);
});

test("omitted media still accepts a film row", () => {
	expect(
		circleRowMatchesMedia({ movieId: 438631, tvId: null }, "all"),
	).toBe(true);
});
```

Import `circleRowMatchesMedia` from `./today-circle-activity`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/today-circle-activity.test.ts`

Expected: FAIL. `circleRowMatchesMedia` is not defined.

- [ ] **Step 3: Write minimal implementation**

In `today-circle-activity.ts`:

```ts
export function circleRowMatchesMedia(
	row: { movieId: number | null; tvId: number | null },
	media: "all" | "tv",
): boolean {
	if (media === "tv") return row.tvId != null;
	return true;
}
```

`fetchTodayCircleActivity(viewerId, now = new Date(), media: "all" | "tv" = "all")` adds this to the existing `and(...)` where:

```ts
media === "tv" ? isNotNull(log.tvId) : undefined,
```

Import `isNotNull` from `drizzle-orm`. The `limit(1)` stays, so the latest visible row is the latest **show** when `media` is `tv`, not “latest log, then drop it if it is a film”.

Circle route:

```ts
.get(
	"/circle",
	async ({ query, user, status }) => {
		if (!user) return status(401, "Unauthorized");
		const media = parseTodayMediaParam(query.media);
		if (media === "invalid") return status(400, "Invalid media");
		return fetchTodayCircleActivity(user.id, new Date(), media);
	},
	{ query: t.Object({ media: t.Optional(t.String()) }) },
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/today-circle-activity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/today-circle-activity.ts apps/server/src/lib/today-circle-activity.test.ts apps/server/src/lib/today-circle-activity-query.ts apps/server/src/routes/today.ts
git commit -m "feat(today): scope the circle card to shows when media is tv"
```

---

### Task 3: Distinct-show cold start

**Files:**
- Create: `apps/server/src/lib/taste-tv-shows.ts`
- Create: `apps/server/src/lib/taste-tv-shows.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `TV_TASTE_MIN_SHOWS = 10`
  - `distinctTvShowIds(rows: readonly { tvId: number | null }[]): number[]`
  - `newestTvLogPerShow<T extends { tvId: number | null; watchedAt: Date | string }>(rows: readonly T[]): T[]`
  - `tvTasteIsColdStart(distinctShowCount: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

import {
	distinctTvShowIds,
	newestTvLogPerShow,
	tvTasteIsColdStart,
} from "./taste-tv-shows";

describe("distinctTvShowIds", () => {
	test("show, season, and episode logs of one show count once", () => {
		expect(
			distinctTvShowIds([
				{ tvId: 9 },
				{ tvId: 9 },
				{ tvId: null },
				{ tvId: 10 },
			]),
		).toEqual([9, 10]);
	});
});

describe("newestTvLogPerShow", () => {
	test("keeps the latest log for each show", () => {
		const older = { tvId: 9, watchedAt: "2026-09-01T00:00:00.000Z", rating: 40 };
		const newer = { tvId: 9, watchedAt: "2026-09-20T00:00:00.000Z", rating: 90 };
		expect(newestTvLogPerShow([older, newer])).toEqual([newer]);
	});
});

describe("tvTasteIsColdStart", () => {
	test("ten episodes of one show stay cold", () => {
		const rows = Array.from({ length: 10 }, () => ({ tvId: 9 }));
		expect(tvTasteIsColdStart(distinctTvShowIds(rows).length)).toBe(true);
	});

	test("ten distinct shows are enough", () => {
		const rows = Array.from({ length: 10 }, (_, i) => ({ tvId: i + 1 }));
		expect(tvTasteIsColdStart(distinctTvShowIds(rows).length)).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/taste-tv-shows.test.ts`

Expected: FAIL. Module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/lib/taste-tv-shows.ts`:

```ts
export const TV_TASTE_MIN_SHOWS = 10;

export function distinctTvShowIds(
	rows: readonly { tvId: number | null }[],
): number[] {
	const ids = new Set<number>();
	for (const row of rows) {
		if (row.tvId != null) ids.add(row.tvId);
	}
	return [...ids];
}

export function newestTvLogPerShow<
	T extends { tvId: number | null; watchedAt: Date | string },
>(rows: readonly T[]): T[] {
	const best = new Map<number, T>();
	for (const row of rows) {
		if (row.tvId == null) continue;
		const prev = best.get(row.tvId);
		if (!prev) {
			best.set(row.tvId, row);
			continue;
		}
		const prevAt = new Date(prev.watchedAt).getTime();
		const nextAt = new Date(row.watchedAt).getTime();
		if (nextAt >= prevAt) best.set(row.tvId, row);
	}
	return [...best.values()];
}

export function tvTasteIsColdStart(distinctShowCount: number): boolean {
	return distinctShowCount < TV_TASTE_MIN_SHOWS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/taste-tv-shows.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/taste-tv-shows.ts apps/server/src/lib/taste-tv-shows.test.ts
git commit -m "feat(taste): count TV cold start by distinct shows"
```

---

### Task 4: TV dismissals, separate from movies

**Files:**
- Create: `packages/db/src/schema/taste-dismissed-tv.ts`
- Create: `packages/db/src/migrations/0047_taste_dismissed_tv.sql`
- Modify: `packages/db/src/schema/index.ts` (add `export * from "./taste-dismissed-tv";`)
- Modify: `packages/db/src/migrations/meta/_journal.json` (append idx 47, tag `0047_taste_dismissed_tv`, `when` greater than `1779204200000`)
- Create: `apps/server/src/lib/taste-dismissed-tv-store.ts`
- Modify: `apps/server/src/routes/taste.ts`
- Modify: `apps/server/src/lib/taste-dismissed-movie.ts` only if the handler must branch; prefer a new `dismissTasteTv` in `apps/server/src/lib/taste-dismissed-tv.ts`

**Interfaces:**
- Consumes: `makeId` from `apps/server/src/lib/cuid.ts`; `buildTasteMatchExcludeIds`
- Produces: `persistTasteDismissedTv({ userId, tvTmdbId })`; `fetchDismissedTvTmdbIds(userId): Promise<number[]>`; `fetchWatchlistTvTmdbIds(userId): Promise<number[]>` in `taste-watchlist-exclusion.ts` (same cap 2000, `isNotNull(watchlistItem.tvId)`). Dismiss body accepts exactly one of `movieTmdbId` or `tvTmdbId`.

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/taste-dismiss-body.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { parseTasteDismissBody } from "./taste-dismiss-body";

describe("parseTasteDismissBody", () => {
	test("a movie id stays on the movie path", () => {
		expect(parseTasteDismissBody({ movieTmdbId: 603 })).toEqual({
			media: "movie",
			tmdbId: 603,
		});
	});

	test("a show id stays on the tv path", () => {
		expect(parseTasteDismissBody({ tvTmdbId: 1399 })).toEqual({
			media: "tv",
			tmdbId: 1399,
		});
	});

	test("both ids, neither id, and non-positive ids are invalid", () => {
		expect(parseTasteDismissBody({ movieTmdbId: 1, tvTmdbId: 2 })).toBeNull();
		expect(parseTasteDismissBody({})).toBeNull();
		expect(parseTasteDismissBody({ tvTmdbId: 0 })).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/taste-dismiss-body.test.ts`

Expected: FAIL. Module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/lib/taste-dismiss-body.ts`:

```ts
export type TasteDismissTarget =
	| { media: "movie"; tmdbId: number }
	| { media: "tv"; tmdbId: number };

function positiveId(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: null;
}

export function parseTasteDismissBody(body: {
	movieTmdbId?: unknown;
	tvTmdbId?: unknown;
}): TasteDismissTarget | null {
	const movieTmdbId = positiveId(body.movieTmdbId);
	const tvTmdbId = positiveId(body.tvTmdbId);
	if (movieTmdbId != null && tvTmdbId != null) return null;
	if (movieTmdbId != null) return { media: "movie", tmdbId: movieTmdbId };
	if (tvTmdbId != null) return { media: "tv", tmdbId: tvTmdbId };
	return null;
}
```

Schema `packages/db/src/schema/taste-dismissed-tv.ts` copies `taste-dismissed-movie.ts` with table `taste_dismissed_tv`, column `tvTmdbId` / `tv_tmdb_id`, index names `taste_dismissed_tv_user_tv_uk` and `taste_dismissed_tv_user_idx`.

SQL `0047_taste_dismissed_tv.sql` copies `0020_taste_dismissed_movie.sql` with those names. Register it in `_journal.json` and `export *` from `packages/db/src/schema/index.ts`.

`taste-dismissed-tv-store.ts` copies `persistTasteDismissedMovie` / `fetchDismissedMovieTmdbIds` against `tasteDismissedTv` and `tvTmdbId`. Id prefix `tdt` via `makeId("tdt")`. `onConflictDoNothing()`.

`fetchWatchlistTvTmdbIds` in `taste-watchlist-exclusion.ts` copies `fetchWatchlistMovieTmdbIds` with `watchlistItem.tvId`.

Dismiss route body becomes:

```ts
body: t.Object({
	movieTmdbId: t.Optional(t.Number()),
	tvTmdbId: t.Optional(t.Number()),
	excludeTmdbIds: t.Optional(t.Array(t.Number())),
}),
```

Handler: `const target = parseTasteDismissBody(body)`; `null` returns 400 `"Invalid title id"`. `media === "movie"` calls the existing `dismissTasteMovie`. `media === "tv"` calls `dismissTasteTv`, which persists the TV row and returns `{ dismissedTmdbId, replacement: null }` until Task 5 fills `replacement` from the TV scorer. A TV dismiss must not call `persistTasteDismissedMovie`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/taste-dismiss-body.test.ts`

Expected: PASS

Run: `bun run db:migrate`

Expected: migration `0047_taste_dismissed_tv` applies. If the local database is unavailable, leave the SQL and journal registered and say so in the commit body. Do not skip the journal entry.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/taste-dismissed-tv.ts packages/db/src/schema/index.ts packages/db/src/migrations/0047_taste_dismissed_tv.sql packages/db/src/migrations/meta/_journal.json apps/server/src/lib/taste-dismiss-body.ts apps/server/src/lib/taste-dismiss-body.test.ts apps/server/src/lib/taste-dismissed-tv-store.ts apps/server/src/lib/taste-dismissed-tv.ts apps/server/src/lib/taste-watchlist-exclusion.ts apps/server/src/routes/taste.ts
git commit -m "feat(taste): store TV dismissals apart from movie dismissals"
```

---

### Task 5: TV for-you

**Files:**
- Create: `apps/server/src/lib/taste-stratified-candidates-tv.ts`
- Create: `apps/server/src/lib/taste-social-candidates-tv.ts`
- Create: `apps/server/src/lib/taste-matched-discovery-tv.ts`
- Create: `apps/server/src/lib/tv-trailer-resolve.ts`
- Create: `apps/server/src/lib/tv-title-logo-resolve.ts`
- Modify: `apps/server/src/lib/tmdb.ts` (add `tvVideos`, same shape as `movieVideos` at `/tv/${id}/videos`)
- Modify: `apps/server/src/routes/tv.ts` (`GET /:id/trailer`, `GET /:id/title-logo`)
- Modify: `apps/server/src/lib/taste-matched-discovery.ts` (export `topGenreIdsFromProfile` and `toTasteMatchedDiscoveryPayload` — rename is not required; export the existing `payloadFromScoredResult` as `toTasteMatchedDiscoveryPayload`)
- Modify: `apps/server/src/routes/taste.ts`
- Modify: `apps/server/src/lib/taste-dismissed-tv.ts` (replacement from the TV scorer)
- Create: `apps/server/src/lib/taste-matched-discovery-tv.test.ts`

**Interfaces:**
- Consumes: `distinctTvShowIds`, `newestTvLogPerShow`, `tvTasteIsColdStart` from Task 3; `buildTasteMatchExcludeIds`; `fetchDismissedTvTmdbIds`; `fetchWatchlistTvTmdbIds`; `buildWeightedTasteProfile`, `genrePhraseFromWeights` from `taste-profile.ts`; `mergeBlendAndPenalizeCandidates`; `mmrSelectCandidates` from `taste-scoring-math.ts`; `resolveTasteNeighbors` from `taste-neighbor-discovery.ts`; `TASTE_MATCH_MIN_RESULTS`, `TASTE_MATCH_TARGET_RESULTS`
- Produces: `buildTasteMatchedDiscoveryForTv(userId): Promise<TasteMatchedDiscoveryPayload>`. Each returned title includes `mediaKind: "tv"`. `GET /api/taste/for-you?media=tv` returns that payload. Omitted `media` still calls `buildTasteMatchedDiscoveryWithMeta`. Invalid `media` is 400.

- [ ] **Step 1: Write the failing test**

`taste-matched-discovery-tv.test.ts` tests the pure payload stamp, not the database:

```ts
import { describe, expect, test } from "bun:test";

import { stampTvTastePayload } from "./taste-matched-discovery-tv";

describe("stampTvTastePayload", () => {
	test("cold start has no titles", () => {
		expect(
			stampTvTastePayload({ coldStart: true, genrePhrase: null, movies: [] }),
		).toEqual({ coldStart: true, genrePhrase: null, movies: [] });
	});

	test("each title is marked tv", () => {
		const payload = stampTvTastePayload({
			coldStart: false,
			genrePhrase: "drama",
			movies: [
				{
					tmdbId: 1399,
					title: "Game of Thrones",
					posterPath: "/a.jpg",
					year: 2011,
				},
			],
		});
		expect(payload.movies[0]).toMatchObject({
			tmdbId: 1399,
			mediaKind: "tv",
		});
	});
});
```

Add `mediaKind?: "movie" | "tv"` to `TasteMatchMovie` in both `apps/server/src/lib/taste-matched-discovery.ts` and `apps/web/src/lib/taste-matched-discovery.ts`. Movie payloads omit it.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/taste-matched-discovery-tv.test.ts`

Expected: FAIL. `stampTvTastePayload` is not defined.

- [ ] **Step 3: Write minimal implementation**

`stampTvTastePayload` maps `movies` to `{ ...movie, mediaKind: "tv" as const }` and returns cold-start payloads unchanged.

`taste-stratified-candidates-tv.ts` is `taste-stratified-candidates.ts` with `movie` replaced by `tv` and the export named `fetchStratifiedTvCandidates`. Same limits. Select `tmdbId`, `title`, `posterPath`, `backdropPath`, `year`, `genreIds`, `originalLanguage`, `popularity`. Never select `tmdbJson`.

After MMR, enrich the chosen shows the way `enrichTasteMatchMovies` enriches films: project `videos`, `images.logos`, and `keywords` out of `tv.tmdbJson` with `jsonb_build_object` (do not select the whole column). Reuse `pickTrailerFromTmdbJson` and `pickTitleLogoFromTmdbJson`. Add `resolveTvTrailer` and `resolveTvTitleLogoPath` beside the movie resolvers, reading that same projection from `tv`, then `tmdbApi` TV videos/images when the cache has none. Add `tvVideos` next to `movieVideos`, calling `/tv/${id}/videos`. `tvImages` already exists. Register `GET /api/tv/:id/trailer` and `GET /api/tv/:id/title-logo` on the TV route, same JSON shape as the movie routes.

`taste-social-candidates-tv.ts` is `fetchSocialCandidates` joined to `tv` on `log.tvId`, with `isNotNull(log.tvId)`. Export `fetchSocialTvCandidates`. Neighbors still come from `resolveTasteNeighbors` (existing movie-overlap neighbors). Their candidate rows are TV logs. Keep the strongest `socialScore` per show id. Same rating floor (`SOCIAL_MIN_RATING_DISPLAY = 7`) and batch limit 400.

`buildTasteMatchedDiscoveryForTv`:

1. Select the viewer’s last 400 non-removed logs that have `tvId`, column-scoped: `rating`, `tvId`, `watchedAt`, plus `tv.genreIds`, `tv.year`, `tv.originalLanguage`, `tv.popularity`. Join `tv` on `tv.tmdbId = log.tvId`. Do not select `tmdbJson`.
2. `const shows = newestTvLogPerShow(rows)`. If `tvTasteIsColdStart(distinctTvShowIds(shows).length)`, return `{ coldStart: true, genrePhrase: null, movies: [] }`.
3. Build `TasteProfileSlice[]` from those shows (one slice per show). `buildWeightedTasteProfile`, then `genrePhraseFromWeights`.
4. Exclude `distinctTvShowIds(shows)`, `fetchDismissedTvTmdbIds`, and `fetchWatchlistTvTmdbIds` via `buildTasteMatchExcludeIds` (pass show ids as `loggedMovieIds`; the helper is an id set, not a movie table).
5. `topGenreIdsFromProfile(profile.genreWeights, 3)`. Export that function from `taste-matched-discovery.ts` without changing its body.
6. Load stratified TV candidates, TV dismiss metadata (join `taste_dismissed_tv` to `tv` for genre/year/language/popularity, limit 50), and social TV candidates. On neighbor failure, log `[taste-match-tv] neighbor/social fetch failed; solo-only` and continue with stratified candidates only, matching the movie `catch`.
7. Reuse `mergeBlendAndPenalizeCandidates` and `toTasteMatchedDiscoveryPayload` (export of today’s `payloadFromScoredResult`). That helper already returns `coldStart` when fewer than `TASTE_MATCH_MIN_RESULTS` (6) titles survive MMR.
8. Return `stampTvTastePayload(payload)`. Set `consumedTmdbIds` to the excluded show ids.

`GET /for-you` reads `query.media` through `parseTodayMediaParam`. `"invalid"` → 400 `"Invalid media"`. `"tv"` → `buildTasteMatchedDiscoveryForTv`. `"all"` → existing `buildTasteMatchedDiscoveryWithMeta`. Add `query: t.Object({ media: t.Optional(t.String()) })`.

`dismissTasteTv` after persist: score again with `buildTasteMatchedDiscoveryForTv`, skip ids in `excludeTmdbIds` plus the dismissed id, and return the first remaining title as `replacement`. If the payload is `coldStart` or empty, `replacement` is `null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/taste-matched-discovery-tv.test.ts apps/server/src/lib/taste-tv-shows.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/taste-stratified-candidates-tv.ts apps/server/src/lib/taste-social-candidates-tv.ts apps/server/src/lib/taste-matched-discovery-tv.ts apps/server/src/lib/taste-matched-discovery-tv.test.ts apps/server/src/lib/taste-matched-discovery.ts apps/server/src/lib/taste-dismissed-tv.ts apps/server/src/lib/tv-trailer-resolve.ts apps/server/src/lib/tv-title-logo-resolve.ts apps/server/src/lib/tmdb.ts apps/server/src/routes/taste.ts apps/server/src/routes/tv.ts apps/web/src/lib/taste-matched-discovery.ts
git commit -m "feat(taste): score a TV for-you pick from distinct shows"
```

---

### Task 6: Separate pick memory

**Files:**
- Modify: `apps/web/src/lib/today-pick-continuity.ts`
- Modify: `apps/web/src/lib/today-pick-continuity.test.ts`
- Modify: `apps/web/src/lib/taste-title-consumed-events.ts`
- Modify: `apps/web/src/components/movie/today-pick-detail-cue.tsx`
- Modify: `apps/web/src/components/log/quick-log-sheet.tsx`
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Modify: `apps/web/src/app/(app)/tv/[id]/page.tsx`

**Interfaces:**
- Consumes: existing `TodayPickContinuity`, `todayPickDetailCue`
- Produces: `todayPickContinuityKey(media: "movie" | "tv"): string`. `read` / `write` / `clear` / `markTodayPickContinuityCompleted` take `media?: "movie" | "tv"` defaulting to `"movie"`. `TasteTitleConsumedDetail` gains optional `media?: "movie" | "tv"`.

- [ ] **Step 1: Write the failing test**

Add to `today-pick-continuity.test.ts`:

```ts
test("tv and movie picks do not overwrite each other", () => {
	const storage = memoryStorage();
	const film = { tmdbId: 603, title: "The Matrix", posterPath: null, year: 1999 };
	const show = { tmdbId: 1399, title: "Game of Thrones", posterPath: null, year: 2011 };
	writeTodayPickContinuity({ film, reason: "films" }, { storage, now: 0 });
	writeTodayPickContinuity(
		{ film: show, reason: "shows", media: "tv" },
		{ storage, now: 0 },
	);
	expect(readTodayPickContinuity({ storage, now: 0 })?.tmdbId).toBe(603);
	expect(readTodayPickContinuity({ storage, now: 0, media: "tv" })?.tmdbId).toBe(
		1399,
	);
	expect(storage.map.has("still:today-pick:v1")).toBe(true);
	expect(storage.map.has("still:today-pick:v1:tv")).toBe(true);
	expect(storage.map.has("still:today-pick:v1:movie")).toBe(false);
});

test("completing a show does not complete the film pick", () => {
	const storage = memoryStorage();
	const film = { tmdbId: 1399, title: "A film", posterPath: null, year: 2011 };
	const show = { tmdbId: 1399, title: "A show", posterPath: null, year: 2011 };
	writeTodayPickContinuity({ film, reason: "films" }, { storage, now: 0 });
	writeTodayPickContinuity(
		{ film: show, reason: "shows", media: "tv" },
		{ storage, now: 0 },
	);
	markTodayPickContinuityCompleted(1399, "diary", {
		storage,
		now: 0,
		media: "tv",
	});
	expect(readTodayPickContinuity({ storage, now: 0 })?.completedVia).toBeNull();
	expect(
		readTodayPickContinuity({ storage, now: 0, media: "tv" })?.completedVia,
	).toBe("diary");
});
```

`StorageOpts` gains optional `media`. `writeTodayPickContinuity` input gains optional `media`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/today-pick-continuity.test.ts`

Expected: FAIL. The second write replaces the movie entry, or `media` is ignored.

- [ ] **Step 3: Write minimal implementation**

```ts
export function todayPickContinuityKey(media: "movie" | "tv" = "movie"): string {
	return media === "tv" ? "still:today-pick:v1:tv" : TODAY_PICK_CONTINUITY_KEY;
}
```

`readRaw` / `writeEntry` / `safeRemove` take the key. `parseEntry` accepts `mediaKind: "tv"` when the key is the TV key, and still requires `mediaKind: "movie"` on the movie key. Existing movie tests must stay green.

`TodayPickDetailCue` calls `readTodayPickContinuity({ media: mediaKind })`.

`dispatchTasteTitleConsumed` calls `markTodayPickContinuityCompleted(detail.tmdbId, detail.via, { media: detail.media ?? "movie" })`.

In `quick-log-sheet.tsx`, after the movie dispatch, add:

```ts
if (tvId != null) {
	dispatchTasteTitleConsumed({ tmdbId: tvId, via: "diary", media: "tv" });
}
```

In `postWatchlistAdd`, when the payload has `tvId`:

```ts
dispatchTasteTitleConsumed({ tmdbId: payload.tvId, via: "watchlist", media: "tv" });
```

On `apps/web/src/app/(app)/tv/[id]/page.tsx`, directly under the `h1`, same position as the movie page:

```tsx
<TodayPickDetailCue mediaKind="tv" tmdbId={data.tmdbId} />
```

Import `TodayPickDetailCue` from `@/components/movie/today-pick-detail-cue`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/today-pick-continuity.test.ts`

Expected: PASS, including the existing movie-key tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/today-pick-continuity.ts apps/web/src/lib/today-pick-continuity.test.ts apps/web/src/lib/taste-title-consumed-events.ts apps/web/src/components/movie/today-pick-detail-cue.tsx apps/web/src/components/log/quick-log-sheet.tsx apps/web/src/lib/still-api-fetch.ts apps/web/src/app/(app)/tv/[id]/page.tsx
git commit -m "feat(today): remember movie and TV picks in separate session keys"
```

---

### Task 7: Home shell, prefetch, and TV Watched

**Files:**
- Modify: `apps/web/src/lib/today-on-sense-reads.ts`
- Modify: `apps/web/src/app/(app)/home/page.tsx`
- Modify: `apps/web/src/components/home/home-today-browse-gate.tsx`
- Modify: `apps/web/src/components/home/today-on-sense.tsx`
- Modify: `apps/web/src/components/home/home-taste-matched-hero.tsx`
- Modify: `apps/web/src/components/home/home-taste-matched-hero-rsc.tsx`
- Create: `apps/web/src/components/home/home-today-prefetch.tsx`
- Create: `apps/web/src/lib/home-today-prefetch.test.ts`

**Interfaces:**
- Consumes: `parseTodayMediaParam` is server-only. Client uses `TodayMedia = "movie" | "tv"`. `startTodayOnSenseReads(media: TodayMedia)`.
- Produces: `shouldPrefetchInactiveToday({ active, inactiveRequested }): boolean` — true only when `inactiveRequested` is false and this call is the paint-or-hover trigger. `HomeTasteMatchedHero` prop `media?: "movie" | "tv"` default `"movie"`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/home-today-prefetch.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { shouldPrefetchInactiveToday } from "./home-today-prefetch";

describe("shouldPrefetchInactiveToday", () => {
	test("does not request the other tab before paint or hover", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: false,
				trigger: "mount",
			}),
		).toBe(false);
	});

	test("requests once after the active Today paints", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: false,
				trigger: "painted",
			}),
		).toBe(true);
	});

	test("requests when the other pill is hovered", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: false,
				trigger: "hover",
			}),
		).toBe(true);
	});

	test("does not request twice", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: true,
				trigger: "hover",
			}),
		).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/home-today-prefetch.test.ts`

Expected: FAIL. Module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/home-today-prefetch.ts`:

```ts
export type TodayPrefetchTrigger = "mount" | "painted" | "hover";

export function shouldPrefetchInactiveToday(input: {
	inactiveRequested: boolean;
	trigger: TodayPrefetchTrigger;
}): boolean {
	if (input.inactiveRequested) return false;
	return input.trigger === "painted" || input.trigger === "hover";
}
```

`startTodayOnSenseReads(media: "movie" | "tv" = "movie")` passes `media=tv` on the three Eden calls only when `media === "tv"`. Movie calls stay parameter-free.

`apps/web/src/app/(app)/home/page.tsx` replaces the movies-only guard:

```ts
const todayMedia = browse === "tv" ? "tv" : browse === "movies" ? "movie" : null;
const todayReads =
	params.catalogueSearchActive || todayMedia == null
		? null
		: startTodayOnSenseReads(todayMedia);
```

`TodayOnSense` accepts `media: "movie" | "tv"` and passes it to `HomeTasteMatchedHeroRsc`. Week and circle RSC components take the same `read` they do now; the read is already filtered by the page.

`HomeTasteMatchedHero` when `media === "tv"`:

- Spotlight link is `/tv/${spotlight.tmdbId}`. Movie stays `/movies/${id}`.
- Logo and trailer fallbacks call `GET /api/tv/:id/title-logo` and `GET /api/tv/:id/trailer` from Task 5. Do not call the movie endpoints for a TV spotlight. Backdrop still uses `spotlight.backdropPath`.
- `readTodayPickContinuity({ media: "tv" })` and writes use `media: "tv"`.
- **Watched** calls the existing `openQuickLog` with `tvId: spotlight.tmdbId`, `movieTitle: spotlight.title`, `logScope: "show"`, poster, and `onSuccess` dispatching `{ type: "logged", tmdbId }`. Do not call `handleInstantWatched` or `buildTodayInstantLogPayload`.
- Watchlist calls `postWatchlistAdd({ tvId: spotlight.tmdbId })`.
- `trackTodayPickAction` payloads include `media: "tv"`.
- Movie `media` omits that field and still uses instant Watched.

`HomeTodayPrefetch` is a client component. It renders nothing until `shouldPrefetchInactiveToday` is true, then fetches the inactive media’s three endpoints with credentials and renders `TodayOnSense`’s client cards (hero, week, circle) inside the inactive page. Until then that page is the existing skeletons. A failed fetch uses the existing empty/error tiles from Task 1’s card components (pass `null` payloads).

`HomeTodayBrowseGate` renders children only when `activeBrowse` is `"movies"` or `"tv"`. Catalogue search still passes `todayReads === null`, so the gate’s parent renders nothing, same as today.

Do not change the JSX position of `HomeContinueWatchingRail`. It stays after the Today block.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/home-today-prefetch.test.ts apps/web/src/lib/today-pick-continuity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/today-on-sense-reads.ts apps/web/src/lib/home-today-prefetch.ts apps/web/src/lib/home-today-prefetch.test.ts apps/web/src/app/(app)/home/page.tsx apps/web/src/components/home/home-today-browse-gate.tsx apps/web/src/components/home/today-on-sense.tsx apps/web/src/components/home/home-taste-matched-hero.tsx apps/web/src/components/home/home-taste-matched-hero-rsc.tsx apps/web/src/components/home/home-today-prefetch.tsx
git commit -m "feat(home): show a show-scoped Today block on TV browse"
```

---

### Task 8: Today page slide

**Files:**
- Modify: `packages/ui/src/styles/globals.css` (append a `.t-today-slide` block; do not edit `.t-page-slide`)
- Modify: `apps/web/src/components/home/home-today-browse-gate.tsx`
- Create: `apps/web/src/lib/home-today-slide.test.ts`

**Interfaces:**
- Consumes: `--page-slide-dur` (200ms) and the other `--page-*` tokens already on `:root` in `globals.css`
- Produces: `todaySlidePage(browse: "movies" | "tv"): "1" | "2"`; `todaySlideExitEnabled(hasShownOnce: boolean): "0" | "1"`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

import { todaySlideExitEnabled, todaySlidePage } from "./home-today-slide";

describe("todaySlidePage", () => {
	test("movies is page 1 and tv is page 2", () => {
		expect(todaySlidePage("movies")).toBe("1");
		expect(todaySlidePage("tv")).toBe("2");
	});
});

describe("todaySlideExitEnabled", () => {
	test("first paint does not slide in from an empty side", () => {
		expect(todaySlideExitEnabled(false)).toBe("0");
		expect(todaySlideExitEnabled(true)).toBe("1");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/home-today-slide.test.ts`

Expected: FAIL. Module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/home-today-slide.ts`:

```ts
export function todaySlidePage(browse: "movies" | "tv"): "1" | "2" {
	return browse === "tv" ? "2" : "1";
}

export function todaySlideExitEnabled(hasShownOnce: boolean): "0" | "1" {
	return hasShownOnce ? "1" : "0";
}
```

Append to `globals.css`. The active page stays in normal flow so the block keeps its height. The inactive page is absolutely positioned and fades/slides 8px. This is the transitions.dev page side-by-side timing, scoped so it does not override auth’s `.t-page-slide`.

```css
.t-today-slide {
	position: relative;
}
.t-today-slide .t-page[data-page-id="1"] {
	--t-page-from-x: calc(var(--page-slide-distance) * -1);
}
.t-today-slide .t-page[data-page-id="2"] {
	--t-page-from-x: var(--page-slide-distance);
}
.t-today-slide .t-page {
	opacity: 0;
	pointer-events: none;
	position: absolute;
	inset-inline: 0;
	top: 0;
	transform: translateX(calc(var(--t-page-from-x, 0px) * var(--page-exit-enabled)));
	filter: blur(calc(var(--page-blur) * var(--page-exit-enabled)));
	transition:
		opacity var(--page-fade-dur) var(--page-fade-ease),
		transform var(--page-slide-dur) var(--page-slide-ease),
		filter var(--page-slide-dur) var(--page-slide-ease);
	will-change: opacity, transform, filter;
}
.t-today-slide[data-page="1"] .t-page[data-page-id="1"],
.t-today-slide[data-page="2"] .t-page[data-page-id="2"] {
	opacity: 1;
	pointer-events: auto;
	position: relative;
	transform: translateX(0);
	filter: blur(0);
	transition-delay: var(--page-stagger);
}
@media (prefers-reduced-motion: reduce) {
	.t-today-slide .t-page {
		transition: none !important;
	}
}
```

`HomeTodayBrowseGate` takes `movie` and `tv` nodes. When `activeBrowse` is `"community"`, return `null`. Otherwise:

```tsx
const page = todaySlidePage(activeBrowse === "tv" ? "tv" : "movies");
<div
	className="t-today-slide"
	data-page={page}
	style={{ ["--page-exit-enabled" as string]: todaySlideExitEnabled(hasShownOnce) }}
>
	<section className="t-page" data-page-id="1">{movie}</section>
	<section className="t-page" data-page-id="2">{tv}</section>
</div>
```

Set `hasShownOnce` true after the first commit so the first paint uses `--page-exit-enabled: 0`. Reduced motion is also handled by the CSS guard.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/home-today-slide.test.ts apps/web/src/lib/home-today-prefetch.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/styles/globals.css apps/web/src/components/home/home-today-browse-gate.tsx apps/web/src/lib/home-today-slide.ts apps/web/src/lib/home-today-slide.test.ts
git commit -m "feat(home): slide Today between movies and TV shows"
```

---

## Self-review

Spec coverage:

- Full TV Today (pick, week, circle): Tasks 1, 2, 5, 7
- Movies unchanged when `media` is omitted: Tasks 1, 2, 5
- Separate session keys: Task 6
- Quick Log Watched, no instant save, no second rating step: Task 7
- Any log scope removes the show; watchlist excluded; dismissals separate: Tasks 3, 4, 5
- Cold start at 10 distinct shows and at fewer than 6 results: Tasks 3 and 5 (`toTasteMatchedDiscoveryPayload`)
- Continue watching stays put: Task 7
- Page slide on Today only, reduced motion, first paint does not slide: Task 8
- Community and catalogue search hide Today: Task 7
- Prefetch after paint or hover: Task 7
- Detail cue and detail log/watchlist complete only the TV pick: Task 6
- Column-scoped TV selects, plus trailer/logo from a `tmdb_json` projection and TV fallback routes: Task 5. Hero calls those TV routes: Task 7
- Invalid `media` is 400: Tasks 1, 2, 5

Placeholder scan: no TBD, TODO, or “similar to Task N” without the code the step needs. The TV stratified and social modules are specified as copies of the named movie files with the table and id column swapped, and the selects listed.

Type consistency: `parseTodayMediaParam` returns `"all" | "tv" | "invalid"` in every task. Continuity media is `"movie" | "tv"`. Slide pages are `"1"` and `"2"`. `mediaKind: "tv"` is stamped only by `stampTvTastePayload`.
