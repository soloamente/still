# TV Title Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive one product-wide Sense title score per patron per TV series from show/season/episode diary ratings so surfaces stop treating each season log as a fake “show rating.”

**Architecture:** Pure `resolveTvTitleScore` (+ season helper) in `apps/server/src/lib/tv-title-score.ts`. Read paths (community stats, following ratings, profile filmography, list owner scores, Shows ledger captions) call the resolver instead of latest raw `log.rating`. No write-side materialization in v1.

**Tech Stack:** TypeScript, Bun test, Drizzle/Neon, Elysia, Next.js web captions.

**Spec:** `docs/superpowers/specs/2026-08-11-tv-title-score-design.md`

## Global Constraints

- Stored ratings are integer **tenths** `0–100`; display = stored / 10.
- Rated **`log_scope = show`** (null scope → show) **wins** — mean of those ratings only.
- Else: season-scoped mean preferred over episode mean per season; then **unweighted** mean of season scores.
- Within a scope unit, **average all** rated logs (rewatches).
- Do **not** invent scores from `liked` alone.
- Do **not** change Episodes rank weights or Quick Log storage.
- Round means to nearest integer tenths via `Math.round`.

---

## File map

| File | Responsibility |
| --- | --- |
| `apps/server/src/lib/tv-title-score.ts` | Pure resolver + season score helper |
| `apps/server/src/lib/tv-title-score.test.ts` | Algorithm fixtures |
| `apps/server/src/lib/fetch-public-diary-community-stats.ts` | TV community: resolve per patron |
| `apps/server/src/lib/listing-community-stats-cache.ts` | Bump TV Redis key to `v2` |
| `apps/server/src/lib/movie-following-ratings.ts` | TV following chips use resolved score |
| `apps/server/src/lib/list-owner-log-scores.ts` | List detail owner TV scores |
| `apps/server/src/routes/profiles.ts` | Filmography TV page: overlay resolved ratings |
| `apps/web/src/lib/patron-watch-ledger-poster-labels.ts` | Season/show tile ratings = scope means / title score |
| `apps/server/src/lib/leaderboard-query.ts` | Ledger payload: optional resolved caption rating fields if needed |

---

### Task 1: Pure `tv-title-score` resolver (TDD)

**Files:**
- Create: `apps/server/src/lib/tv-title-score.ts`
- Create: `apps/server/src/lib/tv-title-score.test.ts`

**Interfaces:**
- Produces:
  - `export type TvTitleScoreLog = { logScope?: string | null; seasonNumber?: number | null; rating: number | null }`
  - `export function resolveTvTitleScore(logs: TvTitleScoreLog[]): number | null`
  - `export function resolveTvSeasonScore(logs: TvTitleScoreLog[], seasonNumber: number): number | null`
  - `export function meanStoredTenths(values: number[]): number | null` (internal or exported for tests)

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "bun:test";
import {
	resolveTvSeasonScore,
	resolveTvTitleScore,
} from "./tv-title-score";

describe("resolveTvTitleScore", () => {
	test("returns null when no rated logs", () => {
		expect(resolveTvTitleScore([])).toBeNull();
		expect(resolveTvTitleScore([{ logScope: "season", seasonNumber: 1, rating: null }])).toBeNull();
	});

	test("show-scoped ratings win over seasons", () => {
		expect(
			resolveTvTitleScore([
				{ logScope: "show", rating: 90 },
				{ logScope: "season", seasonNumber: 1, rating: 50 },
			]),
		).toBe(90);
	});

	test("averages multiple show-scoped rewatches", () => {
		expect(
			resolveTvTitleScore([
				{ logScope: "show", rating: 80 },
				{ logScope: "show", rating: 100 },
			]),
		).toBe(90);
	});

	test("null logScope counts as show", () => {
		expect(resolveTvTitleScore([{ logScope: null, rating: 70 }])).toBe(70);
	});

	test("averages season scores when no show rating", () => {
		// S1 mean 80, S2 mean 100 → title 90
		expect(
			resolveTvTitleScore([
				{ logScope: "season", seasonNumber: 1, rating: 80 },
				{ logScope: "season", seasonNumber: 2, rating: 100 },
			]),
		).toBe(90);
	});

	test("episode ratings fill a season only when no season log", () => {
		expect(
			resolveTvTitleScore([
				{ logScope: "episode", seasonNumber: 1, rating: 60 },
				{ logScope: "episode", seasonNumber: 1, rating: 80 },
			]),
		).toBe(70);
		// Season log preferred over episodes in same season
		expect(
			resolveTvTitleScore([
				{ logScope: "season", seasonNumber: 1, rating: 90 },
				{ logScope: "episode", seasonNumber: 1, rating: 40 },
			]),
		).toBe(90);
	});

	test("ignores season/episode rows without seasonNumber", () => {
		expect(
			resolveTvTitleScore([{ logScope: "season", seasonNumber: null, rating: 99 }]),
		).toBeNull();
	});
});

describe("resolveTvSeasonScore", () => {
	test("means season-scoped ratings for one season", () => {
		expect(
			resolveTvSeasonScore(
				[
					{ logScope: "season", seasonNumber: 2, rating: 70 },
					{ logScope: "season", seasonNumber: 2, rating: 90 },
					{ logScope: "season", seasonNumber: 1, rating: 10 },
				],
				2,
			),
		).toBe(80);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/server && bun test src/lib/tv-title-score.test.ts`  
Expected: FAIL (module / exports missing)

- [ ] **Step 3: Implement minimal resolver**

```typescript
export type TvTitleScoreLog = {
	logScope?: string | null;
	seasonNumber?: number | null;
	rating: number | null;
};

function normalizeScope(scope: string | null | undefined): "show" | "season" | "episode" | "other" {
	if (scope == null || scope === "show") return "show";
	if (scope === "season") return "season";
	if (scope === "episode") return "episode";
	return "other";
}

export function meanStoredTenths(values: number[]): number | null {
	if (values.length === 0) return null;
	const sum = values.reduce((a, b) => a + b, 0);
	return Math.round(sum / values.length);
}

export function resolveTvSeasonScore(
	logs: TvTitleScoreLog[],
	seasonNumber: number,
): number | null {
	const seasonScoped: number[] = [];
	const episodeScoped: number[] = [];
	for (const log of logs) {
		if (log.rating == null || log.seasonNumber !== seasonNumber) continue;
		const scope = normalizeScope(log.logScope);
		if (scope === "season") seasonScoped.push(log.rating);
		else if (scope === "episode") episodeScoped.push(log.rating);
	}
	if (seasonScoped.length > 0) return meanStoredTenths(seasonScoped);
	return meanStoredTenths(episodeScoped);
}

export function resolveTvTitleScore(logs: TvTitleScoreLog[]): number | null {
	const rated = logs.filter((l) => l.rating != null) as Array<
		TvTitleScoreLog & { rating: number }
	>;
	const showRated = rated
		.filter((l) => normalizeScope(l.logScope) === "show")
		.map((l) => l.rating);
	if (showRated.length > 0) return meanStoredTenths(showRated);

	const seasons = new Set<number>();
	for (const l of rated) {
		const scope = normalizeScope(l.logScope);
		if ((scope === "season" || scope === "episode") && l.seasonNumber != null) {
			seasons.add(l.seasonNumber);
		}
	}
	const seasonScores: number[] = [];
	for (const sn of seasons) {
		const score = resolveTvSeasonScore(rated, sn);
		if (score != null) seasonScores.push(score);
	}
	return meanStoredTenths(seasonScores);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/server && bun test src/lib/tv-title-score.test.ts`  
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/tv-title-score.ts apps/server/src/lib/tv-title-score.test.ts
git commit -m "feat(server): add resolveTvTitleScore for derived series ratings"
```

---

### Task 2: Community stats (TV) + cache key bump

**Files:**
- Modify: `apps/server/src/lib/fetch-public-diary-community-stats.ts`
- Modify: `apps/server/src/lib/listing-community-stats-cache.ts` (TV key → `sense:community:tv:v2:`)
- Modify: `apps/server/src/lib/fetch-public-diary-community-stats.test.ts` (add pure helper test if extracting group logic; keep coerce tests)

**Interfaces:**
- Consumes: `resolveTvTitleScore` from Task 1
- Produces: same `PublicDiaryCommunityStats` shape (`averageRating` already **0–10 display**)

- [ ] **Step 1: Write a focused unit test for TV aggregation helper**

Extract (same file or tiny export) something like:

```typescript
export function aggregateResolvedTvPatronScores(
	rows: { userId: string; logScope: string | null; seasonNumber: number | null; rating: number }[],
): { averageRating: number | null; ratingsCount: number }
```

Test: two patrons — A has show 90; B has seasons 80+100 → resolved 90 each → community avg 9.0 display, count 2. Season-only patron alone contributes.

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/server && bun test src/lib/fetch-public-diary-community-stats.test.ts`

- [ ] **Step 3: Implement TV path**

For `tvId` input:
1. Query all public, non-removed, rated logs for that `tvId` selecting `userId`, `logScope`, `seasonNumber`, `rating` (no show-scope filter).
2. Group by `userId` → `resolveTvTitleScore` → collect non-null tenths.
3. `ratingsCount = scores.length`; `averageRating = mean(scores)/10` (display), or reuse `reviewRatingToDisplay` + coerce.

Movies path unchanged (DISTINCT ON latest).

Bump cache key:

```typescript
? `sense:community:tv:v2:${ref.tvId}`
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/server && bun test src/lib/fetch-public-diary-community-stats.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/fetch-public-diary-community-stats.ts apps/server/src/lib/fetch-public-diary-community-stats.test.ts apps/server/src/lib/listing-community-stats-cache.ts
git commit -m "feat(server): community TV score uses resolveTvTitleScore"
```

---

### Task 3: Following ratings (TV)

**Files:**
- Modify: `apps/server/src/lib/movie-following-ratings.ts`
- Modify: `apps/server/src/lib/movie-following-ratings.test.ts`

**Interfaces:**
- Consumes: `resolveTvTitleScore`
- Produces: same `MovieFollowingRatingEntry[]` with `rating` = resolved tenths (or null)

- [ ] **Step 1: Extend unit tests**

Add `pickResolvedFollowingRatingsForTv` (or branch) test:
- Patron has season logs 60 + 80 and a later unrated favorite → rating resolves to 70, liked true from favorite/latest liked.
- Patron with show 90 and season 50 → rating 90.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/server && bun test src/lib/movie-following-ratings.test.ts`

- [ ] **Step 3: Implement TV path**

Keep `fetchFollowingRatingsForMovie` on latest-row pick.
For `fetchFollowingRatingsForTv`:
- Select needed log fields including `logScope`, `seasonNumber`, `rating`, `liked`, `watchedAt`.
- Group rows by `userId`; `rating = resolveTvTitleScore(group)`; `liked = any liked in group`; `watchedAt = max watchedAt`.
- Sort by watchedAt desc; slice to `MOVIE_FOLLOWING_RATINGS_VISIBLE`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/movie-following-ratings.ts apps/server/src/lib/movie-following-ratings.test.ts
git commit -m "feat(server): following TV ratings use resolveTvTitleScore"
```

---

### Task 4: Profile filmography + list owner scores

**Files:**
- Modify: `apps/server/src/lib/list-owner-log-scores.ts`
- Modify: `apps/server/src/routes/profiles.ts` (filmography GET ~1273–1370)
- Add tests: `apps/server/src/lib/list-owner-log-scores.test.ts` (new) if none exist

**Interfaces:**
- Consumes: `resolveTvTitleScore`
- Produces: owner/filmography `rating` fields as resolved tenths for TV

- [ ] **Step 1: Update `fetchOwnerLogScoresForListItems`**

Select `logScope`, `seasonNumber` too. For each `tv:` key, collect all rows then set `rating: resolveTvTitleScore(...)`. Movies stay latest-row. `liked` = any liked among that title’s logs (or latest — prefer **any** liked so heart survives).

- [ ] **Step 2: Filmography TV overlay**

After the page of TV `rows` is selected, batch-fetch all rated logs for `userId` + those `tvId`s (visibility already applied on page; for scores use same visibility as filmography query). Group by `tvId`, resolve, replace each row’s `rating` with resolved score before response mapping.

Do **not** change movie filmography.

- [ ] **Step 3: Tests**

- list-owner: two season ratings → one map entry with mean  
- Optional: small pure helper test for “overlay ratings onto filmography rows”

- [ ] **Step 4: Run**

```bash
cd apps/server && bun test src/lib/list-owner-log-scores.test.ts src/lib/tv-title-score.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/list-owner-log-scores.ts apps/server/src/lib/list-owner-log-scores.test.ts apps/server/src/routes/profiles.ts
git commit -m "feat(server): profile and list TV scores use resolveTvTitleScore"
```

---

### Task 5: Shows ledger captions — season mean / series score

**Files:**
- Modify: `apps/server/src/lib/leaderboard-query.ts` (`fetchLeaderboardLogs` TV branch)
- Modify: `apps/web/src/lib/patron-watch-ledger-poster-labels.ts`
- Modify: `apps/web/src/lib/home-leaderboard-types.ts` (if new field)
- Modify: `apps/web/src/lib/patron-watch-ledger-poster-labels.test.ts`

**Interfaces:**
- Consumes: `resolveTvSeasonScore`, `resolveTvTitleScore`
- Produces: ledger item `rating` for display = scope-appropriate derived score (not raw row)

- [ ] **Step 1: Failing web tests**

When `logScope === "season"` and `rating` is already the season mean from API, caption shows that score (existing). Add case: caption prefers provided rating as season score with scope label on subline when both present (already covered). Add server-side comment/test that ledger maps:
- show row → `resolveTvTitleScore(allPatronTvLogsInWindow for that tvId)` or only show-scoped mean — **use title resolver on all that patron’s logs for that tvId in the ledger payload set**
- season row → `resolveTvSeasonScore(..., seasonNumber)`
- episode row → keep episode row rating (single episode)

Simplest approach matching spec: when building ledger items for `kind === "tv" | "episodes"`, for each item set `rating` to:
- `show` → `resolveTvTitleScore(all logs for that tvId in the fetched set)`  
- `season` → `resolveTvSeasonScore(all logs for that tvId in set, seasonNumber)`  
- `episode` → that row’s own rating  

Pass the full `logs` array for that patron into a small map helper.

- [ ] **Step 2: Implement map helper + wire fetchLeaderboardLogs**

- [ ] **Step 3: Run**

```bash
cd apps/server && bun test src/lib/tv-title-score.test.ts src/lib/leaderboard-query-annotate.test.ts
cd apps/web && bun test src/lib/patron-watch-ledger-poster-labels.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/leaderboard-query.ts apps/web/src/lib/patron-watch-ledger-poster-labels.ts apps/web/src/lib/patron-watch-ledger-poster-labels.test.ts apps/web/src/lib/home-leaderboard-types.ts
git commit -m "fix(web): ledger TV ratings use season/series derived scores"
```

---

### Task 6: Manual QA checklist (human)

- [ ] **Step 1:** On a series with rated Season 1 + Season 2 only (no show log): TV detail Community score includes you; score ≈ mean of seasons (display).
- [ ] **Step 2:** Add a rated whole-series log → your community contribution becomes that show rating (seasons ignored for title score).
- [ ] **Step 3:** Profile TV filmography poster shows derived title score, not whichever season was “latest.”
- [ ] **Step 4:** Shows ranks ledger: Season 1 / Season 2 tiles labeled; scores are season means; not three conflicting “show” scores.
- [ ] **Step 5:** Reply **ok** / issues in scratchpad.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Pure resolver + algorithm | Task 1 |
| Community TV aggregate + cache bump | Task 2 |
| Following ratings TV | Task 3 |
| Profile / list captions | Task 4 |
| Shows ledger season vs series scores | Task 5 |
| Manual QA | Task 6 |
| No write materialize / no Episodes weight change | Global constraints |

**Out of plan (spec follow-ups):** taste-overlap / feed divergence TV (can reuse resolver later); write-side cache; weighted seasons.
