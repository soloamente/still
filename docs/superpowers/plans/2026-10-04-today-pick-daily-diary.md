# Daily pick, whole-diary taste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Movies Today, TV Today, and Watch tonight one hero per calendar day, ranked from the full diary instead of the latest logs.

**Architecture:** Stop decaying older logs and stop capping the diary profile at 400 rows. A pure helper picks one id from the top 12 with a day hash. The browser pins that id until the date changes. Home and Watch tonight call the helper for the hero index. The existing poster rail and refetch stay.

**Tech Stack:** Bun test, TypeScript, Drizzle queries in `apps/server`, Next.js client components in `apps/web`, existing `t-text-swap` classes.

## Global Constraints

- No new database table. The day's pin lives in the browser.
- Surfaces are separate: `movie`, `tv`, `watchlist`.
- `dayKey` is `YYYY-MM-DD` from `readViewerTimeZone()` (`Intl` on the device; UTC if `Intl` is missing).
- Pool size is **12**.
- Hash is unsigned 32-bit `djb2` of `userId + ":" + dayKey + ":" + surface`.
- Rating weights stay (`ratingAffinityWeight`). `recencyDecayByIndex` is not applied to the profile.
- Movie and TV profile queries select the same scalar columns they select today. Never select whole-row `tmdb_json`.
- TV still collapses to one slice per show via `newestTvLogPerShow` after the full log load.
- Logging the hero keeps the in-place rating step (`just_logged`). When that step settles, the title is skipped for the rest of the day and the hero advances. Undo puts that title back.
- **Pick another** and **Not interested** skip the current hero until `dayKey` changes.
- A pin for a previous `dayKey`, or a pin whose id is no longer in the pool, is dropped.
- Reduced motion: title and reason change with no `t-text-swap` travel.
- Cold start under the existing minimum log count is unchanged.

---

### Task 1: Whole-diary profile weights

**Files:**
- Modify: `apps/server/src/lib/taste-profile.ts`
- Modify: `apps/server/src/lib/taste-profile.test.ts`
- Test: `apps/server/src/lib/taste-profile.test.ts`

**Interfaces:**
- Consumes: `ratingAffinityWeight` from `apps/server/src/lib/taste-scoring-math.ts`
- Produces: `buildWeightedTasteProfile(slices)` weights each slice by rating only. `recencyDecayByIndex` stays exported for its own unit test and is not called here.

- [ ] **Step 1: Write the failing test**

Add this test inside `describe("buildWeightedTasteProfile")` in `apps/server/src/lib/taste-profile.test.ts`:

```ts
test("same rating and genre weigh the same at both ends of the diary", () => {
	const older = buildWeightedTasteProfile([
		{
			genreIds: [18],
			rating: 80,
			year: 1990,
			originalLanguage: "en",
			popularity: 10,
			index: 400,
			total: 401,
		},
	]);
	const newer = buildWeightedTasteProfile([
		{
			genreIds: [18],
			rating: 80,
			year: 2024,
			originalLanguage: "en",
			popularity: 10,
			index: 0,
			total: 401,
		},
	]);
	expect(older.genreWeights.get(18)).toBe(newer.genreWeights.get(18));
});

test("a diary longer than 400 still counts the oldest log", () => {
	const slices = Array.from({ length: 401 }, (_, index) => ({
		genreIds: index === 400 ? [27] : [35],
		rating: 80,
		year: 2000,
		originalLanguage: "en",
		popularity: 10,
		index,
		total: 401,
	}));
	const profile = buildWeightedTasteProfile(slices);
	expect(profile.genreWeights.get(27) ?? 0).toBeGreaterThan(0);
	expect(profile.genreWeights.get(35) ?? 0).toBeGreaterThan(
		profile.genreWeights.get(27) ?? 0,
	);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/taste-profile.test.ts`

Expected: FAIL. The first new test fails because `recencyDecayByIndex(400, 401)` is `0.6`, so the older weight is smaller. The second test can already pass; that is fine.

- [ ] **Step 3: Write minimal implementation**

In `apps/server/src/lib/taste-profile.ts`:

- Remove `recencyDecayByIndex` from the import.
- Replace the affinity lines:

```ts
const affinity = ratingAffinityWeight(slice.rating);
```

- Replace the function comment with: `Build rating-weighted genre/decade/language affinities from the whole diary. Log order does not change the weight.`

Leave `apps/server/src/lib/taste-scoring-math.ts` and `taste-scoring-math.test.ts` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/taste-profile.test.ts apps/server/src/lib/taste-scoring-math.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/taste-profile.ts apps/server/src/lib/taste-profile.test.ts
git commit -m "fix: score taste from the whole diary, not recent logs"
```

---

### Task 2: Load every diary row into the profile

**Files:**
- Modify: `apps/server/src/lib/taste-matched-discovery.ts` (the `viewerDiaryRows` query around the `.limit(400)`)
- Modify: `apps/server/src/lib/taste-matched-discovery-tv.ts` (the `viewerShowLogs` query around the `.limit(400)`)
- Modify: `apps/server/src/lib/watchlist-tonight-signals.ts` (the diary `log` query around the `.limit(400)`)

**Interfaces:**
- Consumes: `buildWeightedTasteProfile` from Task 1
- Produces: those three queries return every matching non-removed row, still column-scoped

- [ ] **Step 1: Write the failing test**

This cap is a query clause, not a pure function. Add a guard test at `apps/server/src/lib/taste-profile-diary-cap.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const files = [
	"apps/server/src/lib/taste-matched-discovery.ts",
	"apps/server/src/lib/taste-matched-discovery-tv.ts",
	"apps/server/src/lib/watchlist-tonight-signals.ts",
];

describe("taste profile diary load", () => {
	test("profile queries do not cap the diary at 400", () => {
		for (const file of files) {
			const source = readFileSync(file, "utf8");
			expect(source.includes(".limit(400)")).toBe(false);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/taste-profile-diary-cap.test.ts`

Expected: FAIL because each file still contains `.limit(400)`.

- [ ] **Step 3: Write minimal implementation**

Delete the `.limit(400)` call on each of those three diary selects. Keep `.orderBy(desc(log.watchedAt))` so TV's `newestTvLogPerShow` still sees newest-first rows.

In `taste-matched-discovery.ts`, replace the comment that says the query is for up to 400 diary rows with: `Column-scoped on purpose: never select whole movie rows (tmdb_json). Every non-removed movie log feeds the profile.`

In `taste-matched-discovery-tv.ts`, replace the "last 400" comment with: `Every non-removed TV log, scalars only. newestTvLogPerShow still collapses to one slice per show.`

Do not remove `.limit(200)` or `.limit(2000)` in `watchlist-tonight-signals.ts`. Those are recommendations and list rows, not the diary profile.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/taste-profile-diary-cap.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/taste-matched-discovery.ts apps/server/src/lib/taste-matched-discovery-tv.ts apps/server/src/lib/watchlist-tonight-signals.ts apps/server/src/lib/taste-profile-diary-cap.test.ts
git commit -m "fix: include the full diary in taste profiles"
```

---

### Task 3: Day-seeded hero picker

**Files:**
- Create: `apps/web/src/lib/daily-pick.ts`
- Create: `apps/web/src/lib/daily-pick.test.ts`
- Test: `apps/web/src/lib/daily-pick.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:

```ts
export const DAILY_PICK_POOL = 12;
export type DailyPickSurface = "movie" | "tv" | "watchlist";
export function djb2(input: string): number;
export function formatDayKey(timeZone: string, now?: Date): string;
export function pickDailySpotlight(input: {
	rankedIds: number[];
	dayKey: string;
	userId: string;
	surface: DailyPickSurface;
	skippedIds: number[];
	pinnedId: number | null;
}): number | null;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/daily-pick.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	DAILY_PICK_POOL,
	djb2,
	formatDayKey,
	pickDailySpotlight,
} from "./daily-pick";

const rankedIds = Array.from({ length: 20 }, (_, index) => index + 1);

describe("pickDailySpotlight", () => {
	test("same inputs return the same id inside the top 12", () => {
		const input = {
			rankedIds,
			dayKey: "2026-10-04",
			userId: "user-1",
			surface: "movie" as const,
			skippedIds: [],
			pinnedId: null,
		};
		const id = pickDailySpotlight(input);
		expect(id).toBe(pickDailySpotlight(input));
		expect(rankedIds.slice(0, DAILY_PICK_POOL)).toContain(id);
	});

	test("a different dayKey can choose a different id", () => {
		const base = {
			rankedIds,
			userId: "user-1",
			surface: "movie" as const,
			skippedIds: [],
			pinnedId: null,
		};
		const ids = new Set(
			["2026-10-04", "2026-10-05", "2026-11-01", "2027-01-01"].map((dayKey) =>
				pickDailySpotlight({ ...base, dayKey }),
			),
		);
		expect(ids.size).toBeGreaterThan(1);
	});

	test("skipped ids are walked past and a pin wins while eligible", () => {
		const first = pickDailySpotlight({
			rankedIds,
			dayKey: "2026-10-04",
			userId: "user-1",
			surface: "tv",
			skippedIds: [],
			pinnedId: null,
		});
		expect(first).not.toBeNull();
		const next = pickDailySpotlight({
			rankedIds,
			dayKey: "2026-10-04",
			userId: "user-1",
			surface: "tv",
			skippedIds: [first ?? 0],
			pinnedId: null,
		});
		expect(next).not.toBe(first);
		expect(
			pickDailySpotlight({
				rankedIds,
				dayKey: "2026-10-04",
				userId: "user-1",
				surface: "tv",
				skippedIds: [],
				pinnedId: 3,
			}),
		).toBe(3);
	});

	test("a pin absent from the pool does not return", () => {
		expect(
			pickDailySpotlight({
				rankedIds,
				dayKey: "2026-10-04",
				userId: "user-1",
				surface: "watchlist",
				skippedIds: [],
				pinnedId: 99,
			}),
		).not.toBe(99);
	});

	test("djb2 is an unsigned 32-bit integer", () => {
		expect(djb2("user-1:2026-10-04:movie")).toBeGreaterThanOrEqual(0);
		expect(djb2("user-1:2026-10-04:movie")).toBeLessThan(2 ** 32);
	});

	test("formatDayKey uses the timezone calendar date", () => {
		const instant = new Date("2026-10-04T23:30:00.000Z");
		expect(formatDayKey("UTC", instant)).toBe("2026-10-04");
		expect(formatDayKey("Pacific/Kiritimati", instant)).toBe("2026-10-05");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/daily-pick.test.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/daily-pick.ts`:

```ts
export const DAILY_PICK_POOL = 12;

export type DailyPickSurface = "movie" | "tv" | "watchlist";

/** Unsigned 32-bit djb2. Client and tests share this. */
export function djb2(input: string): number {
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
	}
	return hash >>> 0;
}

/** `YYYY-MM-DD` in `timeZone`. Invalid zones fall back to UTC. */
export function formatDayKey(timeZone: string, now: Date = new Date()): string {
	try {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(now);
	} catch {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone: "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(now);
	}
}

export function pickDailySpotlight(input: {
	rankedIds: number[];
	dayKey: string;
	userId: string;
	surface: DailyPickSurface;
	skippedIds: number[];
	pinnedId: number | null;
}): number | null {
	const seen = new Set<number>();
	const unique: number[] = [];
	for (const id of input.rankedIds) {
		if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
		seen.add(id);
		unique.push(id);
	}
	const pool = unique.slice(0, DAILY_PICK_POOL);
	if (pool.length === 0) return null;
	const skipped = new Set(input.skippedIds);
	if (
		input.pinnedId != null &&
		pool.includes(input.pinnedId) &&
		!skipped.has(input.pinnedId)
	) {
		return input.pinnedId;
	}
	const start =
		djb2(`${input.userId}:${input.dayKey}:${input.surface}`) % pool.length;
	for (let step = 0; step < pool.length; step++) {
		const id = pool[(start + step) % pool.length] ?? null;
		if (id != null && !skipped.has(id)) return id;
	}
	return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/daily-pick.test.ts`

Expected: PASS. If "a different dayKey can choose a different id" fails for this user id, add two more dates to the list in the test (`2026-12-31`, `2028-02-29`) and rerun. Do not special-case the hash.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/daily-pick.ts apps/web/src/lib/daily-pick.test.ts
git commit -m "feat: pick one hero from the top matches for the day"
```

---

### Task 4: Pin the hero until the calendar day changes

**Files:**
- Modify: `apps/web/src/lib/today-pick-continuity.ts`
- Modify: `apps/web/src/lib/today-pick-continuity.test.ts`
- Test: `apps/web/src/lib/today-pick-continuity.test.ts`

**Interfaces:**
- Consumes: `formatDayKey` is not required here. Callers pass `dayKey`.
- Produces: continuity entries gain `dayKey: string` and `skippedIds: number[]`. `readTodayPickContinuity` takes `dayKey` in `StorageOpts`. A missing `dayKey` option keeps the old two-hour TTL so detail pages that have not been updated still compile. When `dayKey` is passed, a stored entry with a different or missing `dayKey` is removed. `skipTodayPickContinuity(tmdbId, opts)` appends that id. `TODAY_PICK_CONTINUITY_TTL_MS` stays exported.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/today-pick-continuity.test.ts`:

```ts
test("a stored dayKey from yesterday is dropped", () => {
	const storage = memoryStorage();
	writeTodayPickContinuity(
		{ film, reason, dayKey: "2026-10-03", skippedIds: [1] },
		{ storage, now: 1_000 },
	);
	expect(
		readTodayPickContinuity({
			storage,
			now: 2_000,
			dayKey: "2026-10-04",
		}),
	).toBeNull();
	expect(storage.map.has(TODAY_PICK_CONTINUITY_KEY)).toBe(false);
});

test("today's pin survives well past the old two-hour TTL", () => {
	const storage = memoryStorage();
	writeTodayPickContinuity(
		{ film, reason, dayKey: "2026-10-04", skippedIds: [] },
		{ storage, now: 0 },
	);
	expect(
		readTodayPickContinuity({
			storage,
			now: TODAY_PICK_CONTINUITY_TTL_MS + 1,
			dayKey: "2026-10-04",
		})?.tmdbId,
	).toBe(603);
});
```

Update `writeTodayPickContinuity` calls in the new tests only. Leave existing tests on the TTL path until Step 3 forces the type change; then add `dayKey: "2026-10-04"` to every existing `writeTodayPickContinuity({ film, reason })` call that should round-trip, and pass the same `dayKey` into those reads. The existing "expired" test stays on the no-`dayKey` path and must still delete after `TODAY_PICK_CONTINUITY_TTL_MS`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/today-pick-continuity.test.ts`

Expected: FAIL to typecheck or fail the yesterday assertion.

- [ ] **Step 3: Write minimal implementation**

Extend `TodayPickContinuity` with `dayKey: string` and `skippedIds: number[]`.

Extend `StorageOpts` with optional `dayKey?: string`.

In `parseEntry`, require `dayKey` to be a non-empty string when present in JSON. Missing `dayKey` in old JSON parses as `dayKey: ""` and `skippedIds: []` so the TTL path still reads it. `skippedIds` must be an array of positive finite numbers; anything else becomes `[]`.

In `readTodayPickContinuity`:

```ts
if (opts?.dayKey) {
	if (!entry || entry.dayKey !== opts.dayKey) {
		if (raw != null) safeRemove(storage, key);
		return null;
	}
	return entry;
}
```

Keep the existing TTL check for the branch where `opts.dayKey` is absent.

Add:

```ts
export function skipTodayPickContinuity(
	tmdbId: number,
	opts?: StorageOpts,
): void {
	const storage = resolveStorage(opts);
	if (!storage) return;
	const media = opts?.media ?? "movie";
	const entry = readTodayPickContinuity({
		storage,
		now: opts?.now,
		media,
		dayKey: opts?.dayKey,
	});
	if (!entry || entry.skippedIds.includes(tmdbId)) return;
	writeEntry(storage, todayPickContinuityKey(media), {
		...entry,
		skippedIds: [...entry.skippedIds, tmdbId],
	});
}
```

Use the existing private `writeEntry` argument order. Do not invent a second writer.

`writeTodayPickContinuity` accepts optional `dayKey` and `skippedIds` and stores them (`dayKey` default `""`, `skippedIds` default `[]`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/today-pick-continuity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/today-pick-continuity.ts apps/web/src/lib/today-pick-continuity.test.ts
git commit -m "feat: keep today's pick until the calendar day changes"
```

---

### Task 5: Use the daily hero on Movies and TV Today

**Files:**
- Modify: `apps/web/src/components/home/home-taste-matched-hero.tsx`
- Test: `apps/web/src/lib/daily-pick.test.ts` (no new cases unless Task 3 failed)

**Interfaces:**
- Consumes: `pickDailySpotlight`, `formatDayKey` from `apps/web/src/lib/daily-pick.ts`; `readTodayPickContinuity`, `writeTodayPickContinuity`, `skipTodayPickContinuity` from `apps/web/src/lib/today-pick-continuity.ts`; `readViewerTimeZone` from `apps/web/src/lib/home-leaderboard-period.ts`
- Produces: the Today hero index follows `pickDailySpotlight`. The poster rail is `movies` with that index. Refetch after a log stays as it is.

- [ ] **Step 1: Write the failing test**

No component render harness exists for this hero. The pure tests from Task 3 and Task 4 are the contract. This task is wiring. Before editing, run:

Run: `bun test apps/web/src/lib/daily-pick.test.ts apps/web/src/lib/today-pick-continuity.test.ts`

Expected: PASS. If either fails, stop and fix that task.

- [ ] **Step 2: Run test to verify it fails**

Skip. Wiring is verified by the helper tests plus a manual check in Step 4.

- [ ] **Step 3: Write minimal implementation**

Inside `HomeTasteMatchedHero`, add a helper used wherever `setActiveIndex` chooses the Today spotlight (`isTodayShell`):

```ts
function resolveTodayHeroIndex(films: { tmdbId: number }[]): number {
	const dayKey = formatDayKey(readViewerTimeZone());
	const pin = readTodayPickContinuity({ media, dayKey });
	const heroId = pickDailySpotlight({
		rankedIds: films.map((film) => film.tmdbId),
		dayKey,
		userId: sessionUserId,
		surface: media,
		skippedIds: pin?.skippedIds ?? [],
		pinnedId: pin?.tmdbId ?? null,
	});
	if (heroId == null) return 0;
	const index = films.findIndex((film) => film.tmdbId === heroId);
	return index >= 0 ? index : 0;
}
```

`sessionUserId` is `authClient.useSession().data?.user.id ?? ""`. `media` is already `"movie" | "tv"`.

When films load or refetch and `isTodayShell` is true, call `setActiveIndex(resolveTodayHeroIndex(films))` instead of `setActiveIndex(0)`. If the resolved id differs from `pin?.tmdbId`, call `writeTodayPickContinuity` with that film, its reason, `dayKey`, and `skippedIds: pin?.skippedIds ?? []`.

`handlePickAnother`:

```ts
const dayKey = formatDayKey(readViewerTimeZone());
if (spotlight) skipTodayPickContinuity(spotlight.tmdbId, { media, dayKey });
```

Then remove that id from the queue as it does today, and set the index from `resolveTodayHeroIndex` on the remaining films. Do not call `clearTodayPickContinuity` on **Pick another**. Clearing deletes the day's skipped ids.

`not_interested` already removes a title. Also call `skipTodayPickContinuity` for that id before resolving the next index.

When pick state enters `complete` (rating settled, watchlisted, or consumed elsewhere), call the same skip + `resolveTodayHeroIndex` once, then `dispatchPick({ type: "pick_another" })` so the shell returns to `active` on the next title. Guard with a ref of the completed `tmdbId` so the effect does not loop.

`undo` removes that id from `skippedIds` by writing the pin back without it, and `setActiveIndex` to that film again.

Do not change the for-you fetch URL or the rail backfill.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/daily-pick.test.ts apps/web/src/lib/today-pick-continuity.test.ts apps/web/src/lib/today-pick-state.test.ts`

Expected: PASS

Manual: signed-in `/home` Movies. Note the hero. Reload. The same title stays. **Pick another** changes it and reload keeps the new one.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/home/home-taste-matched-hero.tsx
git commit -m "feat: lock Today's Pick to the calendar day"
```

---

### Task 6: Use the daily hero on Watch tonight

**Files:**
- Modify: `apps/web/src/components/watchlist/watchlist-tonight-hero.tsx`
- Create: `apps/web/src/lib/watch-tonight-day-pin.ts`
- Create: `apps/web/src/lib/watch-tonight-day-pin.test.ts`

**Interfaces:**
- Consumes: `pickDailySpotlight`, `formatDayKey`, `DailyPickSurface` (`"watchlist"`)
- Produces:

```ts
export const WATCH_TONIGHT_DAY_KEY = "still:watch-tonight:day:v1";
export type WatchTonightDayPin = {
	dayKey: string;
	tmdbId: number;
	skippedIds: number[];
};
export function readWatchTonightDayPin(
	storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
	dayKey: string,
): WatchTonightDayPin | null;
export function writeWatchTonightDayPin(
	storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
	pin: WatchTonightDayPin,
): void;
```

A pin whose `dayKey` does not match is removed and returns null.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/watch-tonight-day-pin.test.ts` using the same `memoryStorage` shape as `today-pick-continuity.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	readWatchTonightDayPin,
	WATCH_TONIGHT_DAY_KEY,
	writeWatchTonightDayPin,
} from "./watch-tonight-day-pin";

function memoryStorage() {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => {
			map.set(key, value);
		},
		removeItem: (key: string) => {
			map.delete(key);
		},
	};
}

describe("watch tonight day pin", () => {
	test("yesterday's pin is removed", () => {
		const storage = memoryStorage();
		writeWatchTonightDayPin(storage, {
			dayKey: "2026-10-03",
			tmdbId: 11,
			skippedIds: [],
		});
		expect(readWatchTonightDayPin(storage, "2026-10-04")).toBeNull();
		expect(storage.map.has(WATCH_TONIGHT_DAY_KEY)).toBe(false);
	});

	test("today's pin round-trips", () => {
		const storage = memoryStorage();
		writeWatchTonightDayPin(storage, {
			dayKey: "2026-10-04",
			tmdbId: 11,
			skippedIds: [4],
		});
		expect(readWatchTonightDayPin(storage, "2026-10-04")).toEqual({
			dayKey: "2026-10-04",
			tmdbId: 11,
			skippedIds: [4],
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/watch-tonight-day-pin.test.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

Implement the two functions with `JSON.parse` inside try/catch. Malformed JSON is removed and returns null. `skippedIds` that are not an array of positive numbers become `[]`.

In `WatchlistTonightHero`, replace the initial `useState(0)` index with a lazy init:

```ts
const dayKey = formatDayKey(readViewerTimeZone());
const pin =
	typeof window === "undefined"
		? null
		: readWatchTonightDayPin(window.localStorage, dayKey);
const heroId = pickDailySpotlight({
	rankedIds: initial.pool.map((row) => row.tmdbId),
	dayKey,
	userId,
	surface: "watchlist",
	skippedIds: pin?.skippedIds ?? [],
	pinnedId: pin?.tmdbId ?? null,
});
const initialIndex = Math.max(
	0,
	initial.pool.findIndex((row) => row.tmdbId === heroId),
);
```

`userId` comes from `authClient.useSession().data?.user.id ?? ""`.

On **Pick another** and after a successful quick log of the spotlight, append that `tmdbId` to `skippedIds`, write the pin, and set the index to the next `pickDailySpotlight` result. Writing the pin uses `window.localStorage` and ignores storage exceptions.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/watch-tonight-day-pin.test.ts apps/web/src/lib/daily-pick.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/watch-tonight-day-pin.ts apps/web/src/lib/watch-tonight-day-pin.test.ts apps/web/src/components/watchlist/watchlist-tonight-hero.tsx
git commit -m "feat: lock Watch tonight to the calendar day"
```

---

### Task 7: Swap the hero title and reason in place

**Files:**
- Modify: `apps/web/src/components/home/home-taste-matched-hero.tsx`
- Modify: `apps/web/src/components/watchlist/watchlist-tonight-hero.tsx`

**Interfaces:**
- Consumes: existing `.t-text-swap`, `.is-exit`, `.is-enter-start`, and `--text-swap-dur` (already in the global stylesheet)
- Produces: when the spotlight `tmdbId` changes and `prefers-reduced-motion` is not reduce, the title node and the reason node run the same swap as `runTextStateSwap` in `apps/web/src/components/profile/letterboxd-import-panel.tsx`

- [ ] **Step 1: Write the failing test**

There is no DOM test runner for this class toggle. Copy the helper into `apps/web/src/lib/run-text-state-swap.ts` and test the duration reader with a stubbed element only if `document` exists. Under `bun test`, `document` is absent, so the test is:

```ts
import { describe, expect, test } from "bun:test";

import { readTextSwapDurationMs } from "./run-text-state-swap";

describe("readTextSwapDurationMs", () => {
	test("falls back to 150 when there is no document", () => {
		expect(readTextSwapDurationMs()).toBe(150);
	});
});
```

Put `readTextSwapDurationMs` and `runTextStateSwap(el, next)` in that module. `runTextStateSwap` matches `letterboxd-import-panel.tsx`: add `is-exit`, wait the duration, set `textContent`, remove `is-exit`, add `is-enter-start`, read `offsetHeight`, remove `is-enter-start`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/run-text-state-swap.test.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

Create the module and the test file from Step 1.

On both heroes, put `t-text-swap` on the title element and the reason element. When `spotlight.tmdbId` changes, if `useReducedMotion()` is true, set the text directly. Otherwise call `runTextStateSwap` on each node. Skip the swap on the first paint (a ref starts true and flips after mount).

Do not add another `:root` transitions block. `--text-swap-dur` is already defined.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/run-text-state-swap.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/run-text-state-swap.ts apps/web/src/lib/run-text-state-swap.test.ts apps/web/src/components/home/home-taste-matched-hero.tsx apps/web/src/components/watchlist/watchlist-tonight-hero.tsx
git commit -m "feat: swap the daily hero title in place"
```
