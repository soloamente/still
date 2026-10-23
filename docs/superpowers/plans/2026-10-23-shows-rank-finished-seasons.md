# Shows Rank — Finished Seasons & Complete Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Community **Shows** ranks count one point per show that has a finished season or a complete series (season/series diary logs), the server auto-creates those logs when episode check-marks complete a season/series, and the Shows drawer lists finished seasons + completed series with their dates.

**Architecture:** A pure core (`tv-completion-core.ts`) decides which season/show logs are due; a DB module (`tv-completion-logs.ts`) loads catalogue + check-marks and inserts logs; `reconcileTvWatchProgress` (already called by every check-mark route and the Companion) invokes it. The Shows rank restricts to `log_scope in ('season','show')`; the drawer returns those rows plus a distinct `showCount`. The web progress panel stops creating these logs itself.

**Tech Stack:** Bun (`bun test`), Elysia, Drizzle (Neon/Postgres), Next.js App Router, Biome. Spec: `docs/superpowers/specs/2026-10-23-shows-rank-finished-seasons-design.md`.

## Global Constraints

- Ratings are stored as integer **tenths** 0–100; never pass raw stored values to display helpers.
- Imports at the top of the module (no inline imports); in switch-over-union code use a `never` default.
- Neon `neon-http` has **no `db.transaction()`** — use sequential statements.
- Never `.select({ log, tv })` whole rows; select only needed columns (`tv.tmdb_json` is ~85KB/row).
- Import motion from `motion/react`, not `framer-motion` (not used in this plan; do not add motion).
- UI copy: **Shows** = TV-series diary logs; **Episodes** = `log_scope = 'episode'` slice only. Episode logs never count toward Shows.
- Public community ranks count only `visibility = 'public'` logs from public profiles.
- Run server tests from `apps/server` (`bun test <file>`), web tests from `apps/web`.
- Add helpful comments to code; keep existing comments unless obsolete.
- The working tree has unrelated uncommitted changes — **commit only the files each task lists** (`git add <paths>`; `git commit -m ... -- <paths>`).
- PowerShell: do not chain commands with `&&`; use `;` or separate calls.

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/server/src/lib/tv-completion-core.ts` (new) | Pure: which seasons are complete, which logs are due, latest watch date |
| `apps/server/src/lib/tv-completion-core.test.ts` (new) | Unit tests for the core |
| `apps/server/src/lib/auto-log-visibility.ts` (new) | `visibilityForAutoLog` moved out of `companion-auto-log.ts` for reuse |
| `apps/server/src/lib/tv-completion-logs.ts` (new) | DB orchestration: load catalogue + existing logs, insert due logs |
| `apps/server/src/lib/tv-watch-progress-sync.ts` (modify) | Call the sync from `reconcileTvWatchProgress`; export `loadWatchedEpisodeKeys` |
| `apps/server/src/routes/tv-watch.ts` (modify) | Call the sync after `PATCH` → `finished` |
| `apps/server/src/lib/companion-auto-log.ts` (modify) | Import `visibilityForAutoLog` instead of defining it |
| `apps/server/src/lib/leaderboard-query.ts` (modify) | Shows scope filter, drawer rows, `showCount`; remove one-tile-per-show collapse |
| `apps/server/src/lib/leaderboard-query-shows-board.test.ts` (new) | Shows board helpers tests |
| `apps/server/src/lib/leaderboard-query-shows-collapse.test.ts` (delete) | Obsolete collapse test |
| `apps/web/src/lib/home-leaderboard-types.ts` (modify) | `showCount?: number` on payload |
| `apps/web/src/lib/home-leaderboard-period.ts` (+test) | `leaderboardLedgerTitleCount` |
| `apps/web/src/components/home/patron-watch-ledger-panel.tsx` (modify) | Use distinct show count in header |
| `apps/web/src/components/tv/tv-detail-progress-panel.tsx` (modify) | Remove client log creation; refresh after progress changes |
| `apps/server/scripts/backfill-tv-completion-logs.ts` (new) + `apps/server/package.json` | One-off backfill (dry-run default) |

---

### Task 1: Pure completion core

**Files:**
- Create: `apps/server/src/lib/tv-completion-core.ts`
- Test: `apps/server/src/lib/tv-completion-core.test.ts`

**Interfaces:**
- Produces:
  - `type CompletionSeason = { seasonNumber: number; episodeNumbers: readonly number[] }`
  - `type WatchedEpisodeKey = { seasonNumber: number; episodeNumber: number; watchedAt?: Date }`
  - `type CompletionPlan = { seasonLogsToCreate: number[]; showLogToCreate: boolean }`
  - `completedSeasonNumbers(seasons, watched): number[]`
  - `planCompletionLogs(input: { seasons; watched; seasonsWithLog: ReadonlySet<number>; hasShowLog: boolean }): CompletionPlan`
  - `latestWatchedAt(watched, seasonNumber?): Date | null`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/tv-completion-core.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	completedSeasonNumbers,
	latestWatchedAt,
	planCompletionLogs,
} from "./tv-completion-core";

const season = (seasonNumber: number, count: number) => ({
	seasonNumber,
	episodeNumbers: Array.from({ length: count }, (_, i) => i + 1),
});

const watchedAll = (seasonNumber: number, count: number) =>
	Array.from({ length: count }, (_, i) => ({
		seasonNumber,
		episodeNumber: i + 1,
	}));

describe("completedSeasonNumbers", () => {
	test("a partly watched season is not complete", () => {
		expect(
			completedSeasonNumbers([season(1, 3)], watchedAll(1, 2)),
		).toEqual([]);
	});

	test("a fully watched season is complete", () => {
		expect(
			completedSeasonNumbers([season(1, 3), season(2, 2)], watchedAll(1, 3)),
		).toEqual([1]);
	});

	test("a season with no episodes is never complete", () => {
		expect(completedSeasonNumbers([season(1, 0)], [])).toEqual([]);
	});
});

describe("planCompletionLogs", () => {
	test("creates a season log when the last episode completes the season", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2), season(2, 2)],
			watched: watchedAll(1, 2),
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [1], showLogToCreate: false });
	});

	test("does not duplicate an existing season log", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2)],
			watched: watchedAll(1, 2),
			seasonsWithLog: new Set([1]),
			hasShowLog: false,
		});
		expect(plan.seasonLogsToCreate).toEqual([]);
		// Season 1 is the only season and it is done -> series is complete.
		expect(plan.showLogToCreate).toBe(true);
	});

	test("creates the whole-show log once every season is complete", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2), season(2, 1)],
			watched: [...watchedAll(1, 2), ...watchedAll(2, 1)],
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({
			seasonLogsToCreate: [1, 2],
			showLogToCreate: true,
		});
	});

	test("does not recreate an existing whole-show log", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 1)],
			watched: watchedAll(1, 1),
			seasonsWithLog: new Set([1]),
			hasShowLog: true,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [], showLogToCreate: false });
	});

	test("a season finished by a diary log (no check-marks) still counts toward the series", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2), season(2, 2)],
			watched: watchedAll(2, 2),
			seasonsWithLog: new Set([1]),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [2], showLogToCreate: true });
	});

	test("an unwatched later season blocks the whole-show log", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 1), season(2, 1)],
			watched: watchedAll(1, 1),
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan.showLogToCreate).toBe(false);
	});

	test("specials (season 0) never block or trigger completion", () => {
		const plan = planCompletionLogs({
			seasons: [season(0, 3), season(1, 1)],
			watched: watchedAll(1, 1),
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [1], showLogToCreate: true });
	});

	test("no catalogue means nothing to create", () => {
		const plan = planCompletionLogs({
			seasons: [],
			watched: [],
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [], showLogToCreate: false });
	});
});

describe("latestWatchedAt", () => {
	const early = new Date("2026-01-01T00:00:00.000Z");
	const late = new Date("2026-03-01T00:00:00.000Z");
	const rows = [
		{ seasonNumber: 1, episodeNumber: 1, watchedAt: early },
		{ seasonNumber: 1, episodeNumber: 2, watchedAt: late },
		{ seasonNumber: 2, episodeNumber: 1, watchedAt: early },
	];

	test("latest within one season", () => {
		expect(latestWatchedAt(rows, 2)).toEqual(early);
		expect(latestWatchedAt(rows, 1)).toEqual(late);
	});

	test("latest across the whole show", () => {
		expect(latestWatchedAt(rows)).toEqual(late);
	});

	test("null when no row has a date", () => {
		expect(latestWatchedAt([{ seasonNumber: 1, episodeNumber: 1 }])).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/server`): `bun test src/lib/tv-completion-core.test.ts`
Expected: FAIL — cannot find module `./tv-completion-core`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/server/src/lib/tv-completion-core.ts`:

```ts
/**
 * Pure rules for "is this season / series finished?" — no database access so
 * the logic stays unit-testable. `tv-completion-logs.ts` feeds it real data.
 */

/** One catalogue season and the episode numbers TMDb lists for it. */
export type CompletionSeason = {
	seasonNumber: number;
	episodeNumbers: readonly number[];
};

/** A checked-off episode; `watchedAt` is only needed for backfill dating. */
export type WatchedEpisodeKey = {
	seasonNumber: number;
	episodeNumber: number;
	watchedAt?: Date;
};

/** Logs that should exist but do not yet. */
export type CompletionPlan = {
	seasonLogsToCreate: number[];
	showLogToCreate: boolean;
};

function episodeKey(seasonNumber: number, episodeNumber: number): string {
	return `${seasonNumber}:${episodeNumber}`;
}

/** Seasons (regular, > 0) whose every catalogue episode is checked off. */
export function completedSeasonNumbers(
	seasons: readonly CompletionSeason[],
	watched: ReadonlyArray<WatchedEpisodeKey>,
): number[] {
	const checked = new Set(
		watched.map((w) => episodeKey(w.seasonNumber, w.episodeNumber)),
	);
	return seasons
		.filter(
			(s) =>
				s.seasonNumber > 0 &&
				s.episodeNumbers.length > 0 &&
				s.episodeNumbers.every((n) => checked.has(episodeKey(s.seasonNumber, n))),
		)
		.map((s) => s.seasonNumber);
}

/**
 * Which season / whole-show diary logs are now due.
 * - A season is due when it is fully checked off and has no season log yet.
 * - A season that already has a season log (e.g. logged by hand) counts as
 *   finished for the series check even without check-marks.
 * - The whole-show log is due when every regular season is finished and no
 *   whole-show log exists.
 */
export function planCompletionLogs(input: {
	seasons: readonly CompletionSeason[];
	watched: ReadonlyArray<WatchedEpisodeKey>;
	seasonsWithLog: ReadonlySet<number>;
	hasShowLog: boolean;
}): CompletionPlan {
	const checkComplete = completedSeasonNumbers(input.seasons, input.watched);
	const seasonLogsToCreate = checkComplete.filter(
		(n) => !input.seasonsWithLog.has(n),
	);

	const finished = new Set<number>([...checkComplete, ...input.seasonsWithLog]);
	const regular = input.seasons.filter(
		(s) => s.seasonNumber > 0 && s.episodeNumbers.length > 0,
	);
	const allFinished =
		regular.length > 0 && regular.every((s) => finished.has(s.seasonNumber));

	return {
		seasonLogsToCreate,
		showLogToCreate: allFinished && !input.hasShowLog,
	};
}

/**
 * Newest `watchedAt` among checked episodes — one season when `seasonNumber`
 * is given, the whole show otherwise. Used to date backfilled logs.
 */
export function latestWatchedAt(
	watched: ReadonlyArray<WatchedEpisodeKey>,
	seasonNumber?: number,
): Date | null {
	let latest: Date | null = null;
	for (const row of watched) {
		if (seasonNumber != null && row.seasonNumber !== seasonNumber) continue;
		if (!row.watchedAt) continue;
		if (latest == null || row.watchedAt.getTime() > latest.getTime()) {
			latest = row.watchedAt;
		}
	}
	return latest;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/tv-completion-core.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/lib/tv-completion-core.ts apps/server/src/lib/tv-completion-core.test.ts
git commit -m "feat(tv): pure rules for finished seasons and complete series" -- apps/server/src/lib/tv-completion-core.ts apps/server/src/lib/tv-completion-core.test.ts
```

---

### Task 2: Auto-log visibility extraction + DB sync module

**Files:**
- Create: `apps/server/src/lib/auto-log-visibility.ts`
- Create: `apps/server/src/lib/tv-completion-logs.ts`
- Modify: `apps/server/src/lib/companion-auto-log.ts` (remove local `visibilityForAutoLog`, import it)

**Interfaces:**
- Consumes: `planCompletionLogs`, `latestWatchedAt`, `CompletionSeason`, `WatchedEpisodeKey` (Task 1); `getTvSeasonsCached`, `getTvSeasonDetailCached` (`./tv-season-cache`).
- Produces:
  - `visibilityForAutoLog(userId: string): Promise<"public" | "followers" | "friends" | "private">`
  - `syncTvCompletionLogs(opts: SyncTvCompletionOptions): Promise<SyncTvCompletionResult | null>` — never throws (logs and returns `null` on failure).
  - `type SyncTvCompletionOptions = { userId: string; tvId: number; language: string; watched: ReadonlyArray<WatchedEpisodeKey>; dating?: "now" | "history"; dryRun?: boolean }`
  - `type SyncTvCompletionResult = { seasonLogsCreated: number[]; showLogCreated: boolean }`

- [ ] **Step 1: Extract `visibilityForAutoLog`**

Create `apps/server/src/lib/auto-log-visibility.ts`:

```ts
import { db, profile, user } from "@still/db";
import { eq } from "drizzle-orm";

/**
 * Public logs require a verified email. An unverified account still gets the
 * diary row, saved as private, so the heartbeat is never rejected.
 * Shared by Companion auto-log and TV season/series auto-completion logs.
 */
export async function visibilityForAutoLog(
	userId: string,
): Promise<"public" | "followers" | "friends" | "private"> {
	const [own] = await db
		.select({ visibility: profile.defaultVisibility })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	const visibility = own?.visibility ?? "public";
	if (visibility !== "public") return visibility;
	if (process.env.NODE_ENV === "development") return visibility;
	const [account] = await db
		.select({ emailVerified: user.emailVerified })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (account?.emailVerified === true) return visibility;
	return "private";
}
```

In `apps/server/src/lib/companion-auto-log.ts`: delete the local `async function visibilityForAutoLog(...)` block (the doc comment starting `Public logs require a verified email…` through its closing `}`), add `import { visibilityForAutoLog } from "./auto-log-visibility";` next to the other `./` imports (alphabetical, before `./companion-now-watching`), and remove `profile` and `user` from the `@still/db` import **only if** nothing else in the file uses them (`rg "\bprofile\b|\buser\b" apps/server/src/lib/companion-auto-log.ts` — note `user` may match words in comments; check code usages).

- [ ] **Step 2: Write the DB sync module**

Create `apps/server/src/lib/tv-completion-logs.ts`:

```ts
import { db, eventLog, log } from "@still/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { visibilityForAutoLog } from "./auto-log-visibility";
import { makeId } from "./cuid";
import { invalidateCommunityStatsForDiaryLog } from "./listing-community-stats-cache";
import {
	type CompletionSeason,
	latestWatchedAt,
	planCompletionLogs,
	type WatchedEpisodeKey,
} from "./tv-completion-core";
import { getTvSeasonDetailCached, getTvSeasonsCached } from "./tv-season-cache";

export type SyncTvCompletionOptions = {
	userId: string;
	tvId: number;
	language: string;
	/** Checked-off episodes (`watchedAt` only matters for `dating: "history"`). */
	watched: ReadonlyArray<WatchedEpisodeKey>;
	/** `now` = date logs today (live use); `history` = date from check-marks (backfill). */
	dating?: "now" | "history";
	/** Report what would be created without writing. */
	dryRun?: boolean;
};

export type SyncTvCompletionResult = {
	seasonLogsCreated: number[];
	showLogCreated: boolean;
};

/**
 * Catalogue seasons with their episode numbers. Seasons with nothing checked
 * cannot be complete, so they skip the season-detail fetch and get a synthetic
 * 1..N list from the summary episode_count.
 */
async function loadCompletionSeasons(
	tvId: number,
	language: string,
	watched: ReadonlyArray<WatchedEpisodeKey>,
): Promise<CompletionSeason[]> {
	const summaries = await getTvSeasonsCached(tvId, language);
	const watchedSeasons = new Set(watched.map((w) => w.seasonNumber));
	const seasons: CompletionSeason[] = [];
	for (const summary of summaries) {
		if (!watchedSeasons.has(summary.season_number)) {
			seasons.push({
				seasonNumber: summary.season_number,
				episodeNumbers: Array.from(
					{ length: summary.episode_count },
					(_, i) => i + 1,
				),
			});
			continue;
		}
		const detail = await getTvSeasonDetailCached(
			tvId,
			summary.season_number,
			language,
		);
		seasons.push({
			seasonNumber: summary.season_number,
			episodeNumbers: (detail.episodes ?? []).map((ep) => ep.episode_number),
		});
	}
	return seasons;
}

async function insertCompletionLog(args: {
	userId: string;
	tvId: number;
	scope: "season" | "show";
	seasonNumber: number | null;
	watchedAt: Date;
	visibility: "public" | "followers" | "friends" | "private";
}): Promise<void> {
	const id = makeId("log");
	await db.insert(log).values({
		id,
		userId: args.userId,
		movieId: null,
		tvId: args.tvId,
		watchedAt: args.watchedAt,
		rating: null,
		liked: false,
		rewatch: false,
		note: null,
		containsSpoilers: false,
		watchVenue: "streaming",
		logScope: args.scope,
		seasonNumber: args.seasonNumber,
		episodeNumber: null,
		visibility: args.visibility,
	});
	await db.insert(eventLog).values({
		id: makeId("evt"),
		userId: args.userId,
		kind: "log.created",
		payload: { logId: id, tvId: args.tvId, source: "tv-completion" },
	});
}

/**
 * After check-marks change: create the season diary log for every fully checked
 * season, and the whole-show log once every season is finished. Idempotent;
 * never deletes anything (un-checking leaves existing logs alone).
 * Never throws — a failure here must not break check-off.
 */
export async function syncTvCompletionLogs(
	opts: SyncTvCompletionOptions,
): Promise<SyncTvCompletionResult | null> {
	try {
		const empty: SyncTvCompletionResult = {
			seasonLogsCreated: [],
			showLogCreated: false,
		};
		if (opts.watched.length === 0) return empty;

		const seasons = await loadCompletionSeasons(
			opts.tvId,
			opts.language,
			opts.watched,
		);

		const existing = await db
			.select({ logScope: log.logScope, seasonNumber: log.seasonNumber })
			.from(log)
			.where(
				and(
					eq(log.userId, opts.userId),
					eq(log.tvId, opts.tvId),
					isNull(log.removedAt),
					inArray(log.logScope, ["season", "show"]),
				),
			);
		const seasonsWithLog = new Set<number>();
		let hasShowLog = false;
		for (const row of existing) {
			if (row.logScope === "show") hasShowLog = true;
			if (row.logScope === "season" && row.seasonNumber != null) {
				seasonsWithLog.add(row.seasonNumber);
			}
		}

		const plan = planCompletionLogs({
			seasons,
			watched: opts.watched,
			seasonsWithLog,
			hasShowLog,
		});
		const result: SyncTvCompletionResult = {
			seasonLogsCreated: plan.seasonLogsToCreate,
			showLogCreated: plan.showLogToCreate,
		};
		if (
			opts.dryRun ||
			(plan.seasonLogsToCreate.length === 0 && !plan.showLogToCreate)
		) {
			return result;
		}

		const visibility = await visibilityForAutoLog(opts.userId);
		const now = new Date();
		const history = opts.dating === "history";

		for (const seasonNumber of plan.seasonLogsToCreate) {
			await insertCompletionLog({
				userId: opts.userId,
				tvId: opts.tvId,
				scope: "season",
				seasonNumber,
				watchedAt: history
					? (latestWatchedAt(opts.watched, seasonNumber) ?? now)
					: now,
				visibility,
			});
		}
		if (plan.showLogToCreate) {
			await insertCompletionLog({
				userId: opts.userId,
				tvId: opts.tvId,
				scope: "show",
				seasonNumber: null,
				watchedAt: history ? (latestWatchedAt(opts.watched) ?? now) : now,
				visibility,
			});
		}

		// Community score / ranks read cached snapshots — drop them after diary writes.
		void invalidateCommunityStatsForDiaryLog({
			movieId: null,
			tvId: opts.tvId,
		}).catch(() => {});

		return result;
	} catch (error) {
		console.error("[tv-completion] sync failed", error);
		return null;
	}
}
```

- [ ] **Step 3: Type-check**

Run (in `apps/server`): `bunx tsc --noEmit -p . 2>&1 | Select-String "tv-completion|auto-log-visibility|companion-auto-log"`
Expected: no output (no errors in these files). Fix any (e.g. `payload` typing on `eventLog` — mirror what `companion-auto-log.ts` passes).

- [ ] **Step 4: Run existing companion tests**

Run: `bun test src/lib/companion-auto-log.test.ts` (skip if the file does not exist; then `bun test src/lib/companion`)
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/lib/auto-log-visibility.ts apps/server/src/lib/tv-completion-logs.ts apps/server/src/lib/companion-auto-log.ts
git commit -m "feat(tv): server sync creates season and whole-show logs on completion" -- apps/server/src/lib/auto-log-visibility.ts apps/server/src/lib/tv-completion-logs.ts apps/server/src/lib/companion-auto-log.ts
```

---

### Task 3: Wire the sync into every check-mark path

**Files:**
- Modify: `apps/server/src/lib/tv-watch-progress-sync.ts` (`loadWatchedEpisodeKeys` export; call in `reconcileTvWatchProgress`)
- Modify: `apps/server/src/routes/tv-watch.ts` (PATCH → `finished`)

**Interfaces:**
- Consumes: `syncTvCompletionLogs` (Task 2).
- Produces: exported `loadWatchedEpisodeKeys(tvWatchId: string): Promise<TvEpisodeKey[]>`.

`reconcileTvWatchProgress` is already called by: `POST /:id/episodes`, `DELETE /:id/episodes`, `POST /:id/seasons/:n/complete`, `POST /:id/mark-next`, and `markCompanionEpisode` (Companion). Only `PATCH → finished` skips it, so it gets an explicit call.

- [ ] **Step 1: Export `loadWatchedEpisodeKeys` and call the sync in `reconcileTvWatchProgress`**

In `apps/server/src/lib/tv-watch-progress-sync.ts`:

1. Change `async function loadWatchedEpisodeKeys(` to `export async function loadWatchedEpisodeKeys(`.
2. Add import `import { syncTvCompletionLogs } from "./tv-completion-logs";` (keep imports sorted; run `bunx biome check --write` on the file if flagged).
3. In `reconcileTvWatchProgress`, directly after `const watched = await loadWatchedEpisodeKeys(watchRow.id);` add:

```ts
	// Check-marks may have just finished a season or the whole series — the
	// server (not the browser) adds the season / whole-show diary rows.
	await syncTvCompletionLogs({
		userId: watchRow.userId,
		tvId: watchRow.tvId,
		language,
		watched,
	});
```

- [ ] **Step 2: Call the sync after `PATCH → finished`**

In `apps/server/src/routes/tv-watch.ts`: add `loadWatchedEpisodeKeys` to the existing `../lib/tv-watch-progress-sync` import and add `import { syncTvCompletionLogs } from "../lib/tv-completion-logs";` (sorted). In the `if (nextStatus === "finished") { … }` block, after the `const [updated] = await db.update(tvWatch)…returning();` statement and before `return buildWatchDto(updated, language);` add:

```ts
				// Every episode is now checked: add the season rows and the whole-show row.
				await syncTvCompletionLogs({
					userId: user.id,
					tvId: existing.tvId,
					language,
					watched: await loadWatchedEpisodeKeys(existing.id),
				});
```

- [ ] **Step 3: Type-check + lint**

Run (in `apps/server`): `bunx tsc --noEmit -p . 2>&1 | Select-String "tv-watch|tv-completion"`
Expected: no output.
Run (repo root): `bunx biome check apps/server/src/lib/tv-watch-progress-sync.ts apps/server/src/routes/tv-watch.ts`
Expected: no errors (use `--write` for import ordering/format only).

- [ ] **Step 4: Run server tests that touch these modules**

Run (in `apps/server`): `bun test src/lib/tv-watch-progress-sync.test.ts src/lib/tv-completion-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/lib/tv-watch-progress-sync.ts apps/server/src/routes/tv-watch.ts
git commit -m "feat(tv): auto-create season and series diary logs from check-marks" -- apps/server/src/lib/tv-watch-progress-sync.ts apps/server/src/routes/tv-watch.ts
```

---

### Task 4: Shows rank query + drawer (replace the one-tile-per-show collapse)

**Files:**
- Modify: `apps/server/src/lib/leaderboard-query.ts`
- Create: `apps/server/src/lib/leaderboard-query-shows-board.test.ts`
- Delete: `apps/server/src/lib/leaderboard-query-shows-collapse.test.ts`

**Interfaces:**
- Produces:
  - `export const SHOWS_RANK_LOG_SCOPES = ["season", "show"] as const`
  - `export function resolveShowsLedgerShowCount(publicDistinctShows: number, visibleTvIds: ReadonlyArray<number | null>): number` — `max(publicDistinctShows, distinct non-null visibleTvIds)`
  - `fetchLeaderboardLogs` result gains optional `showCount?: number` (set only for `kind: "tv"`).

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/leaderboard-query-shows-board.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	resolveShowsLedgerShowCount,
	SHOWS_RANK_LOG_SCOPES,
} from "./leaderboard-query";

describe("SHOWS_RANK_LOG_SCOPES", () => {
	test("counts finished seasons and whole series, never episodes", () => {
		expect([...SHOWS_RANK_LOG_SCOPES]).toEqual(["season", "show"]);
	});
});

describe("resolveShowsLedgerShowCount", () => {
	test("uses the public distinct-show count when it is larger", () => {
		expect(resolveShowsLedgerShowCount(5, [1, 2, 2])).toBe(5);
	});

	test("never reports fewer shows than the viewer can see", () => {
		// e.g. followers-only logs are visible to this viewer but not public.
		expect(resolveShowsLedgerShowCount(1, [1, 2, 3, 3])).toBe(3);
	});

	test("ignores null show ids", () => {
		expect(resolveShowsLedgerShowCount(0, [null, 4, null])).toBe(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/server`): `bun test src/lib/leaderboard-query-shows-board.test.ts`
Expected: FAIL — `resolveShowsLedgerShowCount` / `SHOWS_RANK_LOG_SCOPES` not exported.

- [ ] **Step 3: Remove the collapse code and its test**

```powershell
git rm apps/server/src/lib/leaderboard-query-shows-collapse.test.ts
```
(If the file is untracked, delete it with `Remove-Item`.)

In `apps/server/src/lib/leaderboard-query.ts` delete:
- the whole `collapseTvLogRowsToShows` function with its doc comment (starts `Shows ledger: fold every episode / season / whole-series diary row…`),
- the whole `withLedgerLifetimeCounts` function with its doc comment (starts `Lifetime ordinals are keyed per scope unit…`),
- `resolveTvTitleScore` from the `./tv-title-score` import (leave `ledgerDisplayRatingForTvLog`; collapse it back to a single-line import).

- [ ] **Step 4: Add the scope constant, helpers, and Shows scope filter**

In `leaderboard-query.ts`, replace the doc comment + body of `logScopeFilter` with:

```ts
/** TV diary scopes that count toward the Shows board — never `episode`. */
export const SHOWS_RANK_LOG_SCOPES = ["season", "show"] as const;

/**
 * Header count for the Shows drawer: distinct shows. Rows visible only to this
 * viewer (e.g. followers-only) can exceed the public count, so take the max.
 */
export function resolveShowsLedgerShowCount(
	publicDistinctShows: number,
	visibleTvIds: ReadonlyArray<number | null>,
): number {
	const visible = new Set<number>();
	for (const id of visibleTvIds) {
		if (id != null) visible.add(id);
	}
	return Math.max(publicDistinctShows, visible.size);
}

/**
 * Scope predicate per board.
 * - Episodes: weighted episode + season + show diary scopes (with dedupe).
 * - Shows: only finished seasons (`season`) and complete series (`show`); the
 *   count is DISTINCT shows (see `leaderboardActivitySubquery`). Episode logs
 *   are ranked on Episodes, so they never count here.
 * - Films: no scope filter.
 */
function logScopeFilter(kind: LeaderboardKind, start: Date, end: Date) {
	if (kind === "episodes") return sqlEpisodesRankScopePredicate(start, end);
	if (kind === "tv") return inArray(log.logScope, [...SHOWS_RANK_LOG_SCOPES]);
	return undefined;
}
```
(Remove the old comment block above `logScopeFilter` that began `Episodes ranks: weighted episode + season + show…`.) `leaderboardActivitySubquery`'s existing `kind === "tv"` branch (`count(distinct tv_id)`) already uses `publicLogWindowConditions`, so it now picks up the scope filter — no change there.

- [ ] **Step 5: Add `fetchTvScoreInputs` above `fetchLeaderboardLogs`**

```ts
/**
 * Rated TV logs (any scope) for the given shows, visible to the viewer. Season
 * tiles on the Shows drawer show the season score, which may come from rated
 * episode logs that the Shows window query deliberately excludes.
 */
async function fetchTvScoreInputs(
	userId: string,
	tvIds: number[],
	viewerId: string | null,
) {
	if (tvIds.length === 0) return [];
	return db
		.select({
			tvId: log.tvId,
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			rating: log.rating,
		})
		.from(log)
		.where(
			and(
				eq(log.userId, userId),
				isNull(log.removedAt),
				inArray(log.tvId, tvIds),
				isNotNull(log.rating),
				contentVisibilityWhere(viewerId, log.userId, log.visibility),
			),
		);
}
```

- [ ] **Step 6: Replace the TV tail of `fetchLeaderboardLogs`**

First add `showCount?: number;` after `hiddenCount: number;` in the function's declared return type. Then replace everything from `const tvKind = opts.kind;` to the closing `}` of `fetchLeaderboardLogs` with:

```ts
	const tvKind = opts.kind;
	const scopeFilter = logScopeFilter(tvKind, start, end);
	const isEpisodesBoard = tvKind === "episodes";
	// Shows lists finished seasons + complete series only (never episode rows).
	const isShowsBoard = tvKind === "tv";

	const logs = await db
		.select({
			logId: log.id,
			watchedAt: log.watchedAt,
			tvId: log.tvId,
			rating: log.rating,
			rewatch: log.rewatch,
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			episodeNumber: log.episodeNumber,
			title: tv.title,
			posterPath: tv.posterPath,
			tmdbJson: tv.tmdbJson,
		})
		.from(log)
		.innerJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(
			and(
				eq(log.userId, opts.userId),
				isNull(log.removedAt),
				isNotNull(log.tvId),
				gte(log.watchedAt, start),
				lt(log.watchedAt, end),
				...(scopeFilter ? [scopeFilter] : []),
				contentVisibilityWhere(
					opts.viewerId ?? null,
					log.userId,
					log.visibility,
				),
			),
		)
		.orderBy(desc(log.watchedAt));

	const [tvTotalRow] = await db
		.select({
			total: isEpisodesBoard
				? sql<number>`coalesce(sum(${sqlEpisodeRankWeight()}), 0)::int`
				: count(),
			// Distinct shows among public rows — the Shows header counts shows, not tiles.
			shows: sql<number>`count(distinct ${log.tvId})::int`,
		})
		.from(log)
		.leftJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(
			and(
				eq(log.userId, opts.userId),
				publicLogWindowConditions(tvKind, start, end),
			),
		);

	// Hidden gap: public weighted (or row) total minus rows visible to this viewer.
	const visibleWeight = isEpisodesBoard
		? logs.reduce(
				(sum, l) =>
					sum +
					weightForEpisodeRankLog(
						l.logScope,
						l.seasonNumber,
						(l.tmdbJson as Record<string, unknown> | null) ?? null,
					),
				0,
			)
		: logs.length;
	const tvHiddenCount = clampHiddenCount(
		Number(tvTotalRow?.total ?? 0),
		visibleWeight,
	);

	// Shows season tiles need episode ratings the window query excludes.
	const scoreInputs = isShowsBoard
		? await fetchTvScoreInputs(
				opts.userId,
				[
					...new Set(
						logs.map((l) => l.tvId).filter((id): id is number => id != null),
					),
				],
				opts.viewerId ?? null,
			)
		: logs.map((l) => ({
				tvId: l.tvId,
				logScope: l.logScope,
				seasonNumber: l.seasonNumber,
				rating: l.rating,
			}));

	return {
		user: {
			handle: row.handle,
			displayName: row.displayName,
			image: row.image ?? null,
			avatarIsAnimated: readAvatarIsAnimatedPref(
				row.preferences as Record<string, unknown> | null,
			),
			diaryMetalTier,
			planTier,
			staffRole,
		},
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		hiddenCount: tvHiddenCount,
		...(isShowsBoard
			? {
					showCount: resolveShowsLedgerShowCount(
						Number(tvTotalRow?.shows ?? 0),
						logs.map((l) => l.tvId),
					),
				}
			: {}),
		items: await annotateLeaderboardLogsWithLifetimeCounts(
			opts.userId,
			annotateLeaderboardLogItems(
				logs.map((l) => {
					const tmdbJson = (l.tmdbJson as Record<string, unknown> | null) ?? null;
					return {
						logId: l.logId,
						watchedAt: l.watchedAt.toISOString(),
						movieId: null,
						tvId: l.tvId,
						title: l.title,
						posterPath: l.posterPath,
						rating: ledgerDisplayRatingForTvLog(
							{
								tvId: l.tvId,
								logScope: l.logScope,
								seasonNumber: l.seasonNumber,
								rating: l.rating,
							},
							scoreInputs,
						),
						rewatch: l.rewatch,
						logScope: l.logScope,
						seasonNumber: l.seasonNumber,
						episodeNumber: l.episodeNumber,
						...(isEpisodesBoard
							? {
									episodeWeight: weightForEpisodeRankLog(
										l.logScope,
										l.seasonNumber,
										tmdbJson,
									),
								}
							: {}),
					};
				}),
			),
		),
	};
}
```

- [ ] **Step 7: Run tests + type-check**

Run (in `apps/server`): `bun test src/lib/leaderboard-query-shows-board.test.ts src/lib/leaderboard-query-annotate.test.ts src/lib/leaderboard-query-lifetime.test.ts`
Expected: PASS.
Run: `bunx tsc --noEmit -p . 2>&1 | Select-String "leaderboard"`
Expected: no output.
Run (repo root): `bunx biome check apps/server/src/lib/leaderboard-query.ts apps/server/src/lib/leaderboard-query-shows-board.test.ts`
Expected: no errors.

- [ ] **Step 8: Commit**

```powershell
git add apps/server/src/lib/leaderboard-query.ts apps/server/src/lib/leaderboard-query-shows-board.test.ts
git commit -m "feat(ranks): Shows counts finished seasons and complete series" -- apps/server/src/lib/leaderboard-query.ts apps/server/src/lib/leaderboard-query-shows-board.test.ts apps/server/src/lib/leaderboard-query-shows-collapse.test.ts
```

---

### Task 5: Web — header count and no client-side log creation

**Files:**
- Modify: `apps/web/src/lib/home-leaderboard-types.ts`
- Modify: `apps/web/src/lib/home-leaderboard-period.ts`
- Test: `apps/web/src/lib/home-leaderboard-period.test.ts`
- Modify: `apps/web/src/components/home/patron-watch-ledger-panel.tsx`
- Modify: `apps/web/src/components/tv/tv-detail-progress-panel.tsx`

**Interfaces:**
- Consumes: payload `showCount` (Task 4).
- Produces: `leaderboardLedgerTitleCount(input: { kind: LeaderboardKind; itemCount: number; hiddenCount: number; showCount?: number | null }): number`.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/lib/home-leaderboard-period.test.ts`, add `leaderboardLedgerTitleCount` to the import list from `./home-leaderboard-period` and append:

```ts
describe("leaderboardLedgerTitleCount", () => {
	test("Shows uses the distinct show count, not the tile count", () => {
		expect(
			leaderboardLedgerTitleCount({
				kind: "tv",
				itemCount: 5,
				hiddenCount: 1,
				showCount: 2,
			}),
		).toBe(2);
	});

	test("falls back to tiles + hidden when no show count is sent", () => {
		expect(
			leaderboardLedgerTitleCount({
				kind: "tv",
				itemCount: 3,
				hiddenCount: 1,
			}),
		).toBe(4);
	});

	test("Films and Episodes ignore showCount", () => {
		expect(
			leaderboardLedgerTitleCount({
				kind: "films",
				itemCount: 3,
				hiddenCount: 2,
				showCount: 99,
			}),
		).toBe(5);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/web`): `bun test src/lib/home-leaderboard-period.test.ts`
Expected: FAIL — `leaderboardLedgerTitleCount` is not exported.

- [ ] **Step 3: Implement the helper and type**

In `apps/web/src/lib/home-leaderboard-period.ts`, directly after `leaderboardWatchLedgerSummaryLabel`, add (using the same `LeaderboardKind` type that function already uses):

```ts
/**
 * Number shown in the ledger drawer header. Shows lists several tiles per show
 * (one per finished season + the whole series), so it reports distinct shows.
 */
export function leaderboardLedgerTitleCount(input: {
	kind: LeaderboardKind;
	itemCount: number;
	hiddenCount: number;
	showCount?: number | null;
}): number {
	if (input.kind === "tv" && input.showCount != null) return input.showCount;
	return input.itemCount + input.hiddenCount;
}
```

In `apps/web/src/lib/home-leaderboard-types.ts`, in `LeaderboardLogsPayload`, add after `hiddenCount: number;`:

```ts
	/** Shows ranks only — distinct shows across the tiles (seasons + series). */
	showCount?: number;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/home-leaderboard-period.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the ledger panel**

In `apps/web/src/components/home/patron-watch-ledger-panel.tsx`: add `leaderboardLedgerTitleCount` to the existing import from `@/lib/home-leaderboard-period`, and replace

```ts
	const titleCount = items.length + hiddenCount;
```
with
```ts
	// Shows tiles are per season / series; the header still counts distinct shows.
	const titleCount = leaderboardLedgerTitleCount({
		kind: seed.kind,
		itemCount: items.length,
		hiddenCount,
		showCount: payload?.showCount,
	});
```

- [ ] **Step 6: Stop the browser from creating season / whole-show logs**

In `apps/web/src/components/tv/tv-detail-progress-panel.tsx`:

1. Delete `const showDiaryAttempt = useRef(false);` and the whole `// Once every season is in the diary…` `useEffect` (the one that calls `seriesReadyForShowDiary` and `postLog({ logScope: "show" … })`).
2. Add, in their place (after the `loadSeasons` effect):

```tsx
	// The server now creates season / whole-show diary rows when check-marks
	// finish a season or the series — pull fresh rows after progress changes.
	const refreshUserStateRef = useRef(refreshUserState);
	refreshUserStateRef.current = refreshUserState;
	const progressSignature = `${watchedKeySet.size}:${watch?.status ?? ""}`;
	const lastProgressSignature = useRef<string | null>(null);
	useEffect(() => {
		if (!logsHydrated) return;
		if (lastProgressSignature.current === null) {
			lastProgressSignature.current = progressSignature;
			return;
		}
		if (lastProgressSignature.current === progressSignature) return;
		lastProgressSignature.current = progressSignature;
		void refreshUserStateRef.current();
	}, [logsHydrated, progressSignature]);
```
3. Replace `handleMarkSeasonComplete` with:

```tsx
	async function handleMarkSeasonComplete(seasonNumber: number) {
		if (!watch) return;
		setCompletingSeason(seasonNumber);
		const seasonLabel =
			seasons.find((s) => s.season_number === seasonNumber)?.name ??
			`Season ${seasonNumber}`;
		try {
			const updated = await markSeasonComplete(seasonNumber);
			if (!updated) return;

			// The server already added the season (and, when this was the last
			// one, whole-show) diary row — just reload the diary state.
			await refreshUserState();
			toast.success(`${seasonLabel} marked complete`, {
				description: "Added to your diary.",
			});
		} finally {
			setCompletingSeason(null);
		}
	}
```
4. Remove now-unused imports: `postLog` (from `@/lib/still-api-fetch`), `formatTodayYmd`/`ymdToLocalDate` (if no other use: `rg "formatTodayYmd|ymdToLocalDate" apps/web/src/components/tv/tv-detail-progress-panel.tsx`), `seriesReadyForShowDiary`. Keep `countTvLogsInScope` (still used for per-season log counts) and `useRef`. Leave `seriesReadyForShowDiary` itself and its tests in `tv-log-scope-prior.ts` (unused by the panel now; out of scope to delete).

- [ ] **Step 7: Lint + type-check + tests**

Run (repo root): `bunx biome check apps/web/src/components/tv/tv-detail-progress-panel.tsx apps/web/src/components/home/patron-watch-ledger-panel.tsx apps/web/src/lib/home-leaderboard-period.ts apps/web/src/lib/home-leaderboard-types.ts`
Expected: no errors (fix unused imports / import order).
Run (in `apps/web`): `bunx tsc --noEmit -p . 2>&1 | Select-String "tv-detail-progress-panel|patron-watch-ledger-panel|home-leaderboard"`
Expected: no output.
Run: `bun test src/lib/home-leaderboard-period.test.ts src/lib/tv-log-scope-prior.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/src/lib/home-leaderboard-types.ts apps/web/src/lib/home-leaderboard-period.ts apps/web/src/lib/home-leaderboard-period.test.ts apps/web/src/components/home/patron-watch-ledger-panel.tsx apps/web/src/components/tv/tv-detail-progress-panel.tsx
git commit -m "feat(web): Shows drawer counts shows; server owns season/series logs" -- apps/web/src/lib/home-leaderboard-types.ts apps/web/src/lib/home-leaderboard-period.ts apps/web/src/lib/home-leaderboard-period.test.ts apps/web/src/components/home/patron-watch-ledger-panel.tsx apps/web/src/components/tv/tv-detail-progress-panel.tsx
```

---

### Task 6: Backfill script (dry-run by default)

**Files:**
- Create: `apps/server/scripts/backfill-tv-completion-logs.ts`
- Modify: `apps/server/package.json` (script entry)

**Interfaces:**
- Consumes: `syncTvCompletionLogs` with `dating: "history"` and `dryRun` (Task 2).

- [ ] **Step 1: Write the script**

Create `apps/server/scripts/backfill-tv-completion-logs.ts`:

```ts
import { db, tvWatch, tvWatchEpisode } from "@still/db";
import { eq } from "drizzle-orm";

import { getTmdbLanguageForUser } from "../src/lib/tmdb-poster-language";
import { syncTvCompletionLogs } from "../src/lib/tv-completion-logs";

/**
 * One-off: create the season / whole-show diary logs that check-marks already
 * earned before the server started doing it automatically. Season logs are
 * dated by the newest check-mark in that season; the whole-show log by the
 * newest check-mark of the show. Hits TMDb season caches (24h) per show.
 *
 * Usage:
 *   bun run tv:backfill-completion-logs            # dry run (counts only)
 *   bun run tv:backfill-completion-logs --apply    # write
 */
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
	const watches = await db
		.select({ id: tvWatch.id, userId: tvWatch.userId, tvId: tvWatch.tvId })
		.from(tvWatch);

	let watchesWithWork = 0;
	let seasonLogs = 0;
	let showLogs = 0;

	for (const watch of watches) {
		const watched = await db
			.select({
				seasonNumber: tvWatchEpisode.seasonNumber,
				episodeNumber: tvWatchEpisode.episodeNumber,
				watchedAt: tvWatchEpisode.watchedAt,
			})
			.from(tvWatchEpisode)
			.where(eq(tvWatchEpisode.tvWatchId, watch.id));
		if (watched.length === 0) continue;

		const language = await getTmdbLanguageForUser(watch.userId);
		const result = await syncTvCompletionLogs({
			userId: watch.userId,
			tvId: watch.tvId,
			language,
			watched,
			dating: "history",
			dryRun: !APPLY,
		});
		if (!result) continue;
		if (result.seasonLogsCreated.length === 0 && !result.showLogCreated) {
			continue;
		}

		watchesWithWork += 1;
		seasonLogs += result.seasonLogsCreated.length;
		if (result.showLogCreated) showLogs += 1;
	}

	console.log(
		`[tv-completion-backfill] ${watches.length} watch row(s) scanned, ${watchesWithWork} need logs`,
	);
	console.log(
		`[tv-completion-backfill] ${seasonLogs} season log(s), ${showLogs} whole-show log(s) ${APPLY ? "created" : "would be created"}`,
	);
	if (!APPLY) {
		console.log("[tv-completion-backfill] dry run — re-run with --apply to write");
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[tv-completion-backfill] failed", err);
		process.exit(1);
	});
```

- [ ] **Step 2: Add the package script**

In `apps/server/package.json` `scripts`, add (alphabetical neighbour to the other backfills):

```json
		"tv:backfill-completion-logs": "bun run ./scripts/backfill-tv-completion-logs.ts",
```

- [ ] **Step 3: Type-check and lint**

Run (in `apps/server`): `bunx tsc --noEmit -p . 2>&1 | Select-String "backfill-tv-completion"`
Expected: no output.
Run (repo root): `bunx biome check apps/server/scripts/backfill-tv-completion-logs.ts apps/server/package.json`
Expected: no errors.

- [ ] **Step 4: Dry-run against the dev database (read-only)**

Run (in `apps/server`): `bun run tv:backfill-completion-logs`
Expected: prints the `scanned` / `would be created` counts and the dry-run notice; writes nothing. **Do not pass `--apply`** — ask the owner first.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/scripts/backfill-tv-completion-logs.ts apps/server/package.json
git commit -m "chore(tv): backfill script for season and series completion logs" -- apps/server/scripts/backfill-tv-completion-logs.ts apps/server/package.json
```

---

### Task 7: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Server tests**

Run (in `apps/server`): `bun test src/lib/tv-completion-core.test.ts src/lib/leaderboard-query-shows-board.test.ts src/lib/leaderboard-query-annotate.test.ts src/lib/leaderboard-query-lifetime.test.ts src/lib/tv-watch-progress-sync.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full type-check**

Run (in `apps/server`): `bunx tsc --noEmit -p .` and (in `apps/web`): `bunx tsc --noEmit -p .`
Expected: no new errors in files touched by this plan (pre-existing unrelated errors may remain — filter with `Select-String` on the touched file names).

- [ ] **Step 3: Manual check (local `bun dev`)**

1. On a TV page, check off every episode of one season → a **Season N** diary entry appears (diary + Quick Log counts), Companion/toggles do not show duplicate rows.
2. Check off the last episode of the last season → the **whole-show** entry appears once.
3. `/home?browse=community&sort=ranks&rank=tv`: a patron with only episode logs is **0**; after a season completes → **1**; open their drawer → **Season N** tile(s) with completion date; header says **N shows** (distinct), not N tiles.
4. Un-check an episode → no log is deleted.

- [ ] **Step 4: Update the graph (if available)**

Run (repo root): `graphify update .` — if `graphify` is not installed in this shell, skip and say so.

- [ ] **Step 5: Report**

Summarise commits and note the backfill has **not** been run with `--apply`.
