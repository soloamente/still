# Watchlist decision engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Watch tonight · Now available · Continue watching modes to `/watchlist`, plus per-title Attuned streaming alerts with a free preview.

**Architecture:** `GET /api/watchlist` gains `order=tonight` (server-ranked by a pure scorer over ≤500 rows, 60s per-user cache) and `order=available` (region flatrate filter before paging). Continue watching reuses the existing `GET /api/tv-watch/me` (already returns `nextEpisode`). Alerts add a `watchlist_item.streaming_alert` flag, `PATCH /api/watchlist/alert`, and a job eligibility change; the 403 body carries the preview so the web needs no entitlement plumbing.

**Tech Stack:** Bun + Elysia + Drizzle (Neon `neon-http`, no transactions), Next.js 16 App Router, `motion/react`, Biome, `bun test`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-23-watchlist-decision-engine-design.md`.
- `?order=` values: `tonight` · `available` · `continue` · `latest_added` · `earliest_added` · `title_az`; unknown → `latest_added` (default unchanged).
- Chip labels (left → right): **Watch tonight** · **Now available** · **Continue watching** · **Recently added** · **Oldest saves** · **By title**.
- Scores: availability 40; friend rec 30 (+5 per extra sender, cap 40); own-list 20; taste 0–20; recency 0–10 (linear over 30 days). One reason pill = strongest signal; ties break in that order.
- Never `.select()` whole `movie`/`tv` rows or full `tmdb_json` (project only `watch/providers`).
- Watch tonight + Now available free. Enabling alerts requires plan feature `watchlist_alerts` (403 `planFeatureRequiredBody`).
- `sensitiveScrub` recommendations count toward score but never name the sender or title in a pill.
- New client kinds: `watchlist.mode_viewed`, `watchlist.tile_action`, `upgrade.prompt_viewed`. Server-only: `watchlist.alert_requested`.
- Server tests needing env: `bun test --env-file=../../apps/server/.env <file>` from `apps/server` (or `--env-file=.env`).
- Run Biome only on touched files. Import motion from `motion/react`. Exhaustive `switch` with `never` default. No inline imports.
- Migrations must be registered in `packages/db/src/migrations/meta/_journal.json` (next idx **46**).

---

### Task 1: Pure Watch tonight scorer

**Files:**
- Create: `apps/server/src/lib/watchlist-tonight-score.ts`
- Test: `apps/server/src/lib/watchlist-tonight-score.test.ts`

**Interfaces:**
- Produces:
  - `type WatchlistTonightSignals = { providerName: string | null; recommenders: { name: string; scrubbed: boolean }[]; ownListTitle: string | null; tasteAffinity: number; addedAt: Date; now: Date }`
  - `type WatchlistTonightReason = { kind: "available" | "friend" | "list" | "taste" | "recent"; label: string }`
  - `scoreWatchlistTonight(signals: WatchlistTonightSignals): { score: number; reason: WatchlistTonightReason | null }`
  - `rankWatchlistTonight<T extends { key: string; signals: WatchlistTonightSignals }>(rows: T[]): (T & { score: number; reason: WatchlistTonightReason | null })[]` — score desc, then `addedAt` desc, then `key` asc.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import {
	rankWatchlistTonight,
	scoreWatchlistTonight,
	type WatchlistTonightSignals,
} from "./watchlist-tonight-score";

const NOW = new Date("2026-09-23T12:00:00Z");
function signals(over: Partial<WatchlistTonightSignals> = {}): WatchlistTonightSignals {
	return {
		providerName: null,
		recommenders: [],
		ownListTitle: null,
		tasteAffinity: 0,
		addedAt: new Date("2026-01-01T00:00:00Z"),
		now: NOW,
		...over,
	};
}

describe("scoreWatchlistTonight", () => {
	test("no signals → score 0, no pill", () => {
		expect(scoreWatchlistTonight(signals())).toEqual({ score: 0, reason: null });
	});
	test("availability is the strongest signal", () => {
		const r = scoreWatchlistTonight(
			signals({ providerName: "Netflix", recommenders: [{ name: "Maya", scrubbed: false }] }),
		);
		expect(r.score).toBe(70);
		expect(r.reason).toEqual({ kind: "available", label: "Now on Netflix" });
	});
	test("friend recs: +5 per extra sender, capped at 40", () => {
		const many = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, scrubbed: false }));
		const r = scoreWatchlistTonight(signals({ recommenders: many }));
		expect(r.score).toBe(40);
		expect(r.reason).toEqual({ kind: "friend", label: "P0 + 4 recommended" });
	});
	test("single friend label", () => {
		const r = scoreWatchlistTonight(signals({ recommenders: [{ name: "Maya", scrubbed: false }] }));
		expect(r.reason?.label).toBe("Maya recommended");
	});
	test("scrubbed recs count but never name anyone", () => {
		const r = scoreWatchlistTonight(signals({ recommenders: [{ name: "Maya", scrubbed: true }] }));
		expect(r.score).toBe(30);
		expect(r.reason).toEqual({ kind: "friend", label: "Recommended to you" });
	});
	test("own list reason", () => {
		const r = scoreWatchlistTonight(signals({ ownListTitle: "Heist nights" }));
		expect(r).toEqual({ score: 20, reason: { kind: "list", label: "Finishes Heist nights" } });
	});
	test("taste affinity scales 0–20 and clamps", () => {
		expect(scoreWatchlistTonight(signals({ tasteAffinity: 0.5 })).score).toBe(10);
		expect(scoreWatchlistTonight(signals({ tasteAffinity: 3 })).reason).toEqual({
			kind: "taste",
			label: "Matches your taste",
		});
	});
	test("recency: full 10 today, 0 after 30 days", () => {
		expect(scoreWatchlistTonight(signals({ addedAt: NOW })).score).toBe(10);
		expect(scoreWatchlistTonight(signals({ addedAt: NOW })).reason?.label).toBe("Added recently");
		const old = new Date(NOW.getTime() - 31 * 86_400_000);
		expect(scoreWatchlistTonight(signals({ addedAt: old })).score).toBe(0);
	});
	test("tie in contribution breaks in table order (list beats taste)", () => {
		const r = scoreWatchlistTonight(signals({ ownListTitle: "X", tasteAffinity: 1 }));
		expect(r.reason?.kind).toBe("list");
	});
});

describe("rankWatchlistTonight", () => {
	test("orders by score, then newest save, then key", () => {
		const rows = [
			{ key: "movie:2", signals: signals({ addedAt: new Date("2026-01-02T00:00:00Z") }) },
			{ key: "movie:1", signals: signals({ providerName: "Max" }) },
			{ key: "movie:3", signals: signals({ addedAt: new Date("2026-01-02T00:00:00Z") }) },
		];
		expect(rankWatchlistTonight(rows).map((r) => r.key)).toEqual(["movie:1", "movie:2", "movie:3"]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server; bun test src/lib/watchlist-tonight-score.test.ts`
Expected: FAIL — cannot find module `./watchlist-tonight-score`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Watch tonight ranking for `/watchlist` — pure, no I/O. The route loads
 * signals per watchlist row; this module turns them into a score + one pill.
 */

export type WatchlistTonightSignals = {
	/** First flatrate provider in the patron's region, or null. */
	providerName: string | null;
	/** Senders the viewer can still see; `scrubbed` = sensitive send (never named). */
	recommenders: { name: string; scrubbed: boolean }[];
	/** Title of one of the viewer's own lists containing this title. */
	ownListTitle: string | null;
	/** 0–1 genre affinity from the viewer's diary taste profile. */
	tasteAffinity: number;
	addedAt: Date;
	now: Date;
};

export type WatchlistTonightReasonKind =
	| "available"
	| "friend"
	| "list"
	| "taste"
	| "recent";

export type WatchlistTonightReason = {
	kind: WatchlistTonightReasonKind;
	label: string;
};

const AVAILABLE_POINTS = 40;
const FRIEND_BASE_POINTS = 30;
const FRIEND_EXTRA_POINTS = 5;
const FRIEND_CAP = 40;
const LIST_POINTS = 20;
const TASTE_MAX = 20;
const RECENT_MAX = 10;
const RECENT_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

function friendLabel(recommenders: WatchlistTonightSignals["recommenders"]): string {
	const named = recommenders.filter((r) => !r.scrubbed);
	const first = named[0];
	if (!first) return "Recommended to you";
	const others = recommenders.length - 1;
	return others > 0 ? `${first.name} + ${others} recommended` : `${first.name} recommended`;
}

export function scoreWatchlistTonight(signals: WatchlistTonightSignals): {
	score: number;
	reason: WatchlistTonightReason | null;
} {
	// Table order doubles as the tie-break order for the reason pill.
	const parts: { kind: WatchlistTonightReasonKind; points: number; label: string }[] = [];

	if (signals.providerName?.trim()) {
		parts.push({
			kind: "available",
			points: AVAILABLE_POINTS,
			label: `Now on ${signals.providerName.trim()}`,
		});
	}
	if (signals.recommenders.length > 0) {
		const points = Math.min(
			FRIEND_CAP,
			FRIEND_BASE_POINTS + FRIEND_EXTRA_POINTS * (signals.recommenders.length - 1),
		);
		parts.push({ kind: "friend", points, label: friendLabel(signals.recommenders) });
	}
	if (signals.ownListTitle?.trim()) {
		parts.push({
			kind: "list",
			points: LIST_POINTS,
			label: `Finishes ${signals.ownListTitle.trim()}`,
		});
	}
	const affinity = Math.min(1, Math.max(0, signals.tasteAffinity));
	if (affinity > 0) {
		parts.push({ kind: "taste", points: Math.round(affinity * TASTE_MAX), label: "Matches your taste" });
	}
	const ageDays = (signals.now.getTime() - signals.addedAt.getTime()) / DAY_MS;
	const recent = Math.round(
		Math.max(0, Math.min(1, 1 - ageDays / RECENT_WINDOW_DAYS)) * RECENT_MAX,
	);
	if (recent > 0) {
		parts.push({ kind: "recent", points: recent, label: "Added recently" });
	}

	const score = parts.reduce((sum, p) => sum + p.points, 0);
	let best: (typeof parts)[number] | null = null;
	for (const part of parts) {
		if (part.points > 0 && (best == null || part.points > best.points)) best = part;
	}
	return { score, reason: best ? { kind: best.kind, label: best.label } : null };
}

export function rankWatchlistTonight<
	T extends { key: string; signals: WatchlistTonightSignals },
>(rows: T[]): (T & { score: number; reason: WatchlistTonightReason | null })[] {
	return rows
		.map((row) => ({ ...row, ...scoreWatchlistTonight(row.signals) }))
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			const added = b.signals.addedAt.getTime() - a.signals.addedAt.getTime();
			if (added !== 0) return added;
			return a.key.localeCompare(b.key);
		});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server; bun test src/lib/watchlist-tonight-score.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/watchlist-tonight-score.ts apps/server/src/lib/watchlist-tonight-score.test.ts
git commit -m "feat(watchlist): pure Watch tonight scorer"
```

---

### Task 2: Order + region parsing (server and web)

**Files:**
- Modify: `apps/server/src/lib/watchlist-query-args.ts` (`WatchlistOrder`, `parseWatchlistOrder`)
- Modify: `apps/server/src/lib/watchlist-query-args.test.ts`
- Modify: `apps/server/src/lib/watchlist-streaming-alerts.ts` (add `readCatalogWatchRegionPrefOrNull`)
- Modify: `apps/server/src/lib/watchlist-streaming-alerts.test.ts`
- Modify: `apps/web/src/lib/watchlist-lobby-order.ts` (`WatchlistLobbyOrder`, `parseWatchlistLobbyOrder`)
- Modify: `apps/web/src/lib/watchlist-lobby-order.test.ts`

**Interfaces:**
- Produces: server `type WatchlistOrder = "tonight" | "available" | "latest_added" | "earliest_added" | "title_az"` (`continue` is web-only — served by `/api/tv-watch/me`); `readCatalogWatchRegionPrefOrNull(prefs): string | null`; web `type WatchlistLobbyOrder = "tonight" | "available" | "continue" | "latest_added" | "earliest_added" | "title_az"`.

- [ ] **Step 1: Write failing tests**

Append to `apps/server/src/lib/watchlist-query-args.test.ts`:

```ts
describe("parseWatchlistOrder decision modes", () => {
	test("accepts tonight + available, keeps legacy, rejects continue/garbage", () => {
		expect(parseWatchlistOrder("tonight")).toBe("tonight");
		expect(parseWatchlistOrder("available")).toBe("available");
		expect(parseWatchlistOrder("title_az")).toBe("title_az");
		expect(parseWatchlistOrder("continue")).toBe("latest_added");
		expect(parseWatchlistOrder("nope")).toBe("latest_added");
	});
});
```

Append to `apps/server/src/lib/watchlist-streaming-alerts.test.ts`:

```ts
describe("readCatalogWatchRegionPrefOrNull", () => {
	test("null when unset or world-ish; region when valid", () => {
		expect(readCatalogWatchRegionPrefOrNull(null)).toBeNull();
		expect(readCatalogWatchRegionPrefOrNull({ catalogTmdbWatchRegion: "ALL" })).toBeNull();
		expect(readCatalogWatchRegionPrefOrNull({ catalogTmdbWatchRegion: "it" })).toBe("IT");
		expect(readCatalogWatchRegionPrefOrNull({ catalogTmdbWatchRegion: "xyz" })).toBeNull();
	});
});
```

(add `readCatalogWatchRegionPrefOrNull` to that test file's import list)

Append to `apps/web/src/lib/watchlist-lobby-order.test.ts`:

```ts
describe("parseWatchlistLobbyOrder decision modes", () => {
	test("accepts the three new modes and keeps the default", () => {
		expect(parseWatchlistLobbyOrder("tonight")).toBe("tonight");
		expect(parseWatchlistLobbyOrder("available")).toBe("available");
		expect(parseWatchlistLobbyOrder("continue")).toBe("continue");
		expect(parseWatchlistLobbyOrder(undefined)).toBe("latest_added");
		expect(buildWatchlistLobbyHref({ order: "tonight" })).toBe("/watchlist?order=tonight");
	});
});
```

(ensure `buildWatchlistLobbyHref` is imported in that test file)

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/server; bun test src/lib/watchlist-query-args.test.ts src/lib/watchlist-streaming-alerts.test.ts` then `cd ../web; bun test src/lib/watchlist-lobby-order.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement**

`apps/server/src/lib/watchlist-query-args.ts`:

```ts
export type WatchlistOrder =
	| "tonight"
	| "available"
	| "latest_added"
	| "earliest_added"
	| "title_az";

export function parseWatchlistOrder(raw: string | undefined): WatchlistOrder {
	if (
		raw === "tonight" ||
		raw === "available" ||
		raw === "earliest_added" ||
		raw === "title_az" ||
		raw === "latest_added"
	) {
		return raw;
	}
	return "latest_added";
}
```

`apps/server/src/lib/watchlist-streaming-alerts.ts` — add below `readCatalogWatchRegionPref`:

```ts
/**
 * Region the patron actually chose, or `null` — Now available must not guess
 * (the alerts job keeps the US fallback via `readCatalogWatchRegionPref`).
 */
export function readCatalogWatchRegionPrefOrNull(
	preferences: Record<string, unknown> | null | undefined,
): string | null {
	const raw = preferences?.[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION];
	if (typeof raw !== "string") return null;
	const region = raw.trim().toUpperCase();
	return /^[A-Z]{2}$/.test(region) ? region : null;
}
```

`apps/web/src/lib/watchlist-lobby-order.ts`:

```ts
export type WatchlistLobbyOrder =
	| "tonight"
	| "available"
	| "continue"
	| "latest_added"
	| "earliest_added"
	| "title_az";

const WATCHLIST_LOBBY_ORDERS: readonly WatchlistLobbyOrder[] = [
	"tonight",
	"available",
	"continue",
	"latest_added",
	"earliest_added",
	"title_az",
];

export function parseWatchlistLobbyOrder(
	raw: string | null | undefined,
): WatchlistLobbyOrder {
	return WATCHLIST_LOBBY_ORDERS.find((order) => order === raw) ?? DEFAULT_ORDER;
}
```

- [ ] **Step 4: Run tests — PASS** (same commands as Step 2).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/watchlist-query-args.ts apps/server/src/lib/watchlist-query-args.test.ts apps/server/src/lib/watchlist-streaming-alerts.ts apps/server/src/lib/watchlist-streaming-alerts.test.ts apps/web/src/lib/watchlist-lobby-order.ts apps/web/src/lib/watchlist-lobby-order.test.ts
git commit -m "feat(watchlist): parse tonight/available/continue orders"
```

---

### Task 3: Server — `order=available` + `order=tonight` in `GET /api/watchlist`

**Files:**
- Create: `apps/server/src/lib/watchlist-tonight-signals.ts` (DB loaders + 60s cache)
- Create: `apps/server/src/lib/watchlist-tonight-signals.test.ts` (pure helpers only)
- Modify: `apps/server/src/routes/watchlist.ts`

**Interfaces:**
- Consumes: `rankWatchlistTonight`, `WatchlistTonightSignals` (Task 1); `parseWatchlistOrder`, `readCatalogWatchRegionPrefOrNull` (Task 2); `primaryFlatrateProviderName`, `WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION`; `loadRecommendationGate`; `buildWeightedTasteProfile`.
- Produces: row fields `tonight_reason: string | null`, `streaming_alert: boolean` (Task 5 reads both); response field `needs_region?: true` when `order=available` and region unset. Pure helpers `listingKey(movieId, tvId): string` and `normalizedGenreAffinity(genreIds: number[], weights: Map<number, number>): number`.

- [ ] **Step 1: Write failing test for pure helpers**

```ts
import { describe, expect, test } from "bun:test";
import { listingKey, normalizedGenreAffinity } from "./watchlist-tonight-signals";

describe("watchlist tonight signal helpers", () => {
	test("listingKey is media-aware", () => {
		expect(listingKey(10, null)).toBe("movie:10");
		expect(listingKey(null, 10)).toBe("tv:10");
	});
	test("genre affinity = best matching genre weight / top weight", () => {
		const weights = new Map([[18, 4], [878, 2]]);
		expect(normalizedGenreAffinity([878], weights)).toBe(0.5);
		expect(normalizedGenreAffinity([18, 878], weights)).toBe(1);
		expect(normalizedGenreAffinity([27], weights)).toBe(0);
		expect(normalizedGenreAffinity([18], new Map())).toBe(0);
	});
});
```

- [ ] **Step 2: Run — FAIL** (`cd apps/server; bun test src/lib/watchlist-tonight-signals.test.ts`).

- [ ] **Step 3: Implement `watchlist-tonight-signals.ts`**

```ts
import { db, list, listItem, log, movie, profile, titleRecommendation, user } from "@still/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { loadRecommendationGate } from "./title-recommendation-query";
import { buildWeightedTasteProfile, type TasteProfileSlice } from "./taste-profile";

export function listingKey(movieId: number | null, tvId: number | null): string {
	return movieId != null ? `movie:${movieId}` : `tv:${tvId}`;
}

/** 0–1: the strongest of this title's genres relative to the viewer's top genre. */
export function normalizedGenreAffinity(
	genreIds: number[],
	weights: Map<number, number>,
): number {
	let top = 0;
	for (const w of weights.values()) top = Math.max(top, w);
	if (top <= 0) return 0;
	let best = 0;
	for (const id of genreIds) best = Math.max(best, weights.get(id) ?? 0);
	return best / top;
}

export type WatchlistTonightSocial = {
	recommenders: Map<string, { name: string; scrubbed: boolean }[]>;
	ownListTitles: Map<string, string>;
	genreWeights: Map<number, number>;
};

type CacheEntry = { at: number; value: WatchlistTonightSocial };
const CACHE_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/** Received recs (visible senders only), own-list membership, and diary genre weights. */
export async function loadWatchlistTonightSocial(
	userId: string,
): Promise<WatchlistTonightSocial> {
	const hit = cache.get(userId);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

	const [recRows, listRows, diaryRows] = await Promise.all([
		db
			.select({
				senderId: titleRecommendation.senderUserId,
				movieId: titleRecommendation.movieId,
				tvId: titleRecommendation.tvId,
				scrubbed: titleRecommendation.sensitiveScrub,
				displayName: profile.displayName,
				userName: user.name,
			})
			.from(titleRecommendation)
			.leftJoin(profile, eq(profile.userId, titleRecommendation.senderUserId))
			.leftJoin(user, eq(user.id, titleRecommendation.senderUserId))
			.where(eq(titleRecommendation.recipientUserId, userId))
			.orderBy(desc(titleRecommendation.createdAt))
			.limit(200),
		db
			.select({ title: list.title, movieId: listItem.movieId, tvId: listItem.tvId })
			.from(listItem)
			.innerJoin(list, eq(list.id, listItem.listId))
			.where(eq(list.userId, userId))
			.limit(2000),
		db
			.select({ rating: log.rating, genreIds: movie.genreIds })
			.from(log)
			.innerJoin(movie, eq(log.movieId, movie.tmdbId))
			.where(and(eq(log.userId, userId), isNull(log.removedAt)))
			.orderBy(desc(log.watchedAt))
			.limit(400),
	]);

	// Recommendation visibility — the sender must still pass the same gate as sending.
	const senderIds = [...new Set(recRows.map((r) => r.senderId))].slice(0, 25);
	const gates = await Promise.all(
		senderIds.map(async (id) => [id, (await loadRecommendationGate(id, userId)).ok] as const),
	);
	const visible = new Set(gates.filter(([, ok]) => ok).map(([id]) => id));

	const recommenders = new Map<string, { name: string; scrubbed: boolean }[]>();
	for (const row of recRows) {
		if (!visible.has(row.senderId)) continue;
		const key = listingKey(row.movieId, row.tvId);
		const bucket = recommenders.get(key) ?? [];
		if (bucket.some((r) => r.name === (row.displayName ?? row.userName))) continue;
		bucket.push({
			name: row.displayName?.trim() || row.userName?.trim() || "Someone",
			scrubbed: row.scrubbed,
		});
		recommenders.set(key, bucket);
	}

	const ownListTitles = new Map<string, string>();
	for (const row of listRows) {
		const key = listingKey(row.movieId, row.tvId);
		if (!ownListTitles.has(key)) ownListTitles.set(key, row.title);
	}

	const total = diaryRows.length;
	const slices: TasteProfileSlice[] = diaryRows.map((row, index) => ({
		genreIds: row.genreIds ?? [],
		rating: row.rating,
		year: null,
		originalLanguage: null,
		popularity: null,
		index,
		total,
	}));
	const genreWeights = buildWeightedTasteProfile(slices).genreWeights;

	const value = { recommenders, ownListTitles, genreWeights };
	cache.set(userId, { at: Date.now(), value });
	return value;
}

/** Drop a patron's cached signals after a watchlist mutation. */
export function invalidateWatchlistTonightSocial(userId: string): void {
	cache.delete(userId);
}
```

(Unused import guard: drop `inArray` if Biome flags it.)

- [ ] **Step 4: Wire the route** (`apps/server/src/routes/watchlist.ts` GET `/`)

1. Import `readCatalogWatchRegionPrefOrNull`, `rankWatchlistTonight`, `listingKey`, `loadWatchlistTonightSocial`, `normalizedGenreAffinity`, `invalidateWatchlistTonightSocial`.
2. After computing `prefs`, add `const chosenRegion = readCatalogWatchRegionPrefOrNull(prefs);`.
3. Add `movieGenreIds: movie.genreIds, tvGenreIds: tv.genreIds, streamingAlert: watchlistItem.streamingAlert` to the select (the `streamingAlert` column lands in Task 4 — until then select `sql<boolean>\`false\`` and replace in Task 4).
4. Branch before the existing paged query:

```ts
if (order === "available" && chosenRegion == null) {
	return { results: [], total_pages: 0, total_results: 0, needs_region: true as const };
}
if (order === "available" || order === "tonight") {
	// Bounded candidate pool — rank/filter in TS, then page.
	const pool = await traceTiming("db", `watchlist.${order}.pool`, () =>
		db
			.select(selectShape)
			.from(watchlistItem)
			.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
			.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
			.where(whereClause)
			.orderBy(desc(watchlistItem.addedAt), tiebreak)
			.limit(500),
	);
	const region = chosenRegion ?? watchRegion;
	const withProvider = pool.map((row) => ({
		row,
		providerName: chosenRegion ? primaryFlatrateProviderName(row.tmdbJson, region) : null,
	}));
	let ordered: { row: (typeof pool)[number]; providerName: string | null; reason: string | null }[];
	if (order === "available") {
		ordered = withProvider
			.filter((r) => r.providerName != null)
			.map((r) => ({ ...r, reason: `Now on ${r.providerName}` }));
	} else {
		const social = await loadWatchlistTonightSocial(user.id);
		const now = new Date();
		ordered = rankWatchlistTonight(
			withProvider.map((r) => {
				const key = listingKey(r.row.item.movieId, r.row.item.tvId);
				return {
					key,
					r,
					signals: {
						providerName: r.providerName,
						recommenders: social.recommenders.get(key) ?? [],
						ownListTitle: social.ownListTitles.get(key) ?? null,
						tasteAffinity: normalizedGenreAffinity(
							r.row.movieGenreIds ?? r.row.tvGenreIds ?? [],
							social.genreWeights,
						),
						addedAt: new Date(r.row.item.addedAt),
						now,
					},
				};
			}),
		).map((ranked) => ({ ...ranked.r, reason: ranked.reason?.label ?? null }));
	}
	const pageRows = ordered.slice(offset, offset + limit + 1);
	const meta = watchlistLookaheadPageMeta({ page, limit, fetchedCount: pageRows.length });
	return {
		results: pageRows.slice(0, meta.visibleCount).map((r) => toWatchlistRow(r.row, r.providerName, r.reason)),
		total_pages: meta.totalPages,
		total_results: offset + meta.visibleCount,
	};
}
```

5. Extract the existing `rows.map(...)` body into `function toWatchlistRow(row, providerName: string | null, reason: string | null)` returning the current shape plus `tonight_reason: reason` and `streaming_alert: Boolean(row.streamingAlert)`; reuse it for the legacy path with `primaryFlatrateProviderName(row.tmdbJson, watchRegion)` and `reason = null`. Hoist the select object into `const selectShape = { … }` so both queries share it.
6. In `POST /` and both `DELETE` handlers call `invalidateWatchlistTonightSocial(user.id)`.

- [ ] **Step 5: Run tests + typecheck**

Run: `cd apps/server; bun test src/lib/watchlist-tonight-signals.test.ts src/lib/watchlist-tonight-score.test.ts src/lib/watchlist-query-args.test.ts; bunx tsc --noEmit -p . 2>&1 | Select-String watchlist`
Expected: tests PASS; no `watchlist` type errors.

- [ ] **Step 6: Manual API check**

With `bun dev` running and a signed-in cookie in the browser: open `http://localhost:3001/api/watchlist?order=tonight` → rows ordered, `tonight_reason` populated; `?order=available` → only streaming rows, or `needs_region: true` when region unset.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/lib/watchlist-tonight-signals.ts apps/server/src/lib/watchlist-tonight-signals.test.ts apps/server/src/routes/watchlist.ts
git commit -m "feat(watchlist): tonight ranking and now-available filter"
```

---

### Task 4: Per-title streaming alerts (migration + PATCH + job)

**Files:**
- Create: `packages/db/src/migrations/0046_watchlist_item_streaming_alert.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json` (idx 46)
- Modify: `packages/db/src/schema/activity.ts` (`watchlistItem.streamingAlert`)
- Modify: `apps/server/src/lib/watchlist-streaming-alerts.ts` (eligibility)
- Modify: `apps/server/src/lib/watchlist-streaming-alerts.test.ts`
- Modify: `apps/server/src/routes/watchlist.ts` (`PATCH /alert`, replace `sql\`false\`` from Task 3)
- Modify: `apps/server/src/lib/product-event-kinds.ts` + `apps/web/src/lib/product-event-kinds.ts` (+ server test)

**Interfaces:**
- Produces: `watchlistItemAlertEligible(args: { globalPref: boolean; itemFlag: boolean; hasFeature: boolean }): boolean`; `PATCH /api/watchlist/alert` body `{ movieId?: number; tvId?: number; enabled: boolean }` → `{ ok: true, enabled }` or 403 `{ error, code: "PLAN_FEATURE_REQUIRED", featureKey: "watchlist_alerts", preview: { notStreamingCount: number; sample: { listingKind: "movie" | "tv"; tmdbId: number; title: string; posterPath: string | null }[] } }`.

- [ ] **Step 1: Migration + schema**

`0046_watchlist_item_streaming_alert.sql`:

```sql
ALTER TABLE "watchlist_item" ADD COLUMN IF NOT EXISTS "streaming_alert" boolean DEFAULT false NOT NULL;
```

`_journal.json` — append after idx 45:

```json
{
	"idx": 46,
	"version": "7",
	"when": 1779204200000,
	"tag": "0046_watchlist_item_streaming_alert",
	"breakpoints": true
}
```

`activity.ts` `watchlistItem` columns — after `note`:

```ts
		/** Per-title Attuned alert request — job alerts when this OR the global pref is on. */
		streamingAlert: boolean("streaming_alert").default(false).notNull(),
```

(ensure `boolean` is imported from `drizzle-orm/pg-core` in that file)

- [ ] **Step 2: Failing eligibility test** (append to `watchlist-streaming-alerts.test.ts`)

```ts
describe("watchlistItemAlertEligible", () => {
	test("needs the feature, then either the global pref or the item flag", () => {
		expect(watchlistItemAlertEligible({ globalPref: true, itemFlag: false, hasFeature: false })).toBe(false);
		expect(watchlistItemAlertEligible({ globalPref: true, itemFlag: false, hasFeature: true })).toBe(true);
		expect(watchlistItemAlertEligible({ globalPref: false, itemFlag: true, hasFeature: true })).toBe(true);
		expect(watchlistItemAlertEligible({ globalPref: false, itemFlag: false, hasFeature: true })).toBe(false);
	});
});
```

Run: `cd apps/server; bun test src/lib/watchlist-streaming-alerts.test.ts` → FAIL.

- [ ] **Step 3: Implement eligibility + job change**

```ts
/** Per-item alert gate: Attuned feature, then global opt-in or this title's flag. */
export function watchlistItemAlertEligible(args: {
	globalPref: boolean;
	itemFlag: boolean;
	hasFeature: boolean;
}): boolean {
	if (!args.hasFeature) return false;
	return args.globalPref || args.itemFlag;
}
```

In the job loop that iterates a patron's watchlist items (the function using `shouldProcessWatchlistStreamingAlerts`): stop skipping the whole patron when the global pref is off — instead compute `hasFeature = patronHasPlanFeature(entitlements, "watchlist_alerts")`, `globalPref = readWatchlistStreamingAlertsPref(prefs)`, select `watchlistItem.streamingAlert` with each item, and skip items where `!watchlistItemAlertEligible({ globalPref, itemFlag: item.streamingAlert, hasFeature })`. Keep `shouldProcessWatchlistStreamingAlerts` exported (existing tests) but no longer used as the early-return gate. Snapshots still update for all items so first-notify baselines stay correct.

Run the test file → PASS.

- [ ] **Step 4: Event kind**

Add `"watchlist.alert_requested"` to `PRODUCT_EVENT_KINDS` (server + web, **not** client list), plus `"watchlist.mode_viewed"`, `"watchlist.tile_action"`, `"upgrade.prompt_viewed"` to both `PRODUCT_EVENT_KINDS` **and** `CLIENT_PRODUCT_EVENT_KINDS`. Extend `apps/server/src/lib/product-event-kinds.test.ts`:

```ts
describe("watchlist decision kinds", () => {
	test("mode/tile/upgrade are client kinds; alert_requested is server-only", () => {
		for (const kind of ["watchlist.mode_viewed", "watchlist.tile_action", "upgrade.prompt_viewed"]) {
			expect(isClientProductEventKind(kind)).toBe(true);
		}
		expect(isProductEventKind("watchlist.alert_requested")).toBe(true);
		expect(isClientProductEventKind("watchlist.alert_requested")).toBe(false);
	});
});
```

- [ ] **Step 5: `PATCH /api/watchlist/alert`** (add to `watchlistRoute`)

```ts
.patch(
	"/alert",
	async ({ body: rawBody, user, status }) => {
		if (!user) return status(401, "Sign in");
		if (!hit(`wl:alert:${user.id}`, { limit: 30, windowMs: 60_000 }).ok)
			return status(429, "Slow down");
		const body = routeBody<{ movieId?: number; tvId?: number; enabled: boolean }>(rawBody);
		if ((body.movieId == null) === (body.tvId == null)) {
			return status(400, "Send exactly one of movieId or tvId");
		}
		const itemWhere = and(
			eq(watchlistItem.userId, user.id),
			body.movieId != null
				? eq(watchlistItem.movieId, body.movieId)
				: eq(watchlistItem.tvId, body.tvId as number),
		);
		if (body.enabled) {
			const entitlements = await loadPatronEntitlements(user.id);
			if (!patronHasPlanFeature(entitlements, "watchlist_alerts")) {
				return status(403, {
					...planFeatureRequiredBody(
						"watchlist_alerts",
						"Streaming alerts are part of Attuned",
					),
					preview: await loadWatchlistAlertPreview(user.id),
				});
			}
		}
		const updated = await db
			.update(watchlistItem)
			.set({ streamingAlert: body.enabled })
			.where(itemWhere)
			.returning({ movieId: watchlistItem.movieId });
		if (updated.length === 0) return status(404, "Not on your watchlist");
		await recordProductEvent(user.id, "watchlist.alert_requested", {
			enabled: body.enabled,
			listingKind: body.movieId != null ? "movie" : "tv",
		});
		return { ok: true as const, enabled: body.enabled };
	},
	{
		body: t.Object({
			movieId: t.Optional(t.Number()),
			tvId: t.Optional(t.Number()),
			enabled: t.Boolean(),
		}),
	},
)
```

`loadWatchlistAlertPreview` (same file, module-level): selects the patron's watchlist rows (hide-watched `whereClause` rebuilt with the same helpers, limit 200, narrow `WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION`), keeps those with `primaryFlatrateProviderName(tmdbJson, readCatalogWatchRegionPref(prefs)) == null`, returns `{ notStreamingCount, sample: first 3 as { listingKind, tmdbId, title, posterPath } }`. Imports: `loadPatronEntitlements` from `../lib/patron-entitlements`, `patronHasPlanFeature` + `planFeatureRequiredBody` from `../lib/plan-feature-access`, `recordProductEvent` from `../lib/record-product-event`.

Replace Task 3's placeholder select with `streamingAlert: watchlistItem.streamingAlert`.

- [ ] **Step 6: Migrate + verify**

Run: `bun run db:migrate` (repo root) → `0046` applied. Then `cd apps/server; bun test --env-file=.env src/lib/watchlist-streaming-alerts.test.ts src/lib/product-event-kinds.test.ts` → PASS; `bunx tsc --noEmit -p . 2>&1 | Select-String watchlist` → empty.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/migrations/0046_watchlist_item_streaming_alert.sql packages/db/src/migrations/meta/_journal.json packages/db/src/schema/activity.ts apps/server/src/lib/watchlist-streaming-alerts.ts apps/server/src/lib/watchlist-streaming-alerts.test.ts apps/server/src/routes/watchlist.ts apps/server/src/lib/product-event-kinds.ts apps/server/src/lib/product-event-kinds.test.ts apps/web/src/lib/product-event-kinds.ts
git commit -m "feat(watchlist): per-title streaming alerts with Attuned preview"
```

---

### Task 5: Web — six modes, reason pills, Continue watching, states

**Files:**
- Modify: `apps/web/src/lib/watchlist-lobby-order.ts` (row type + seed mapping + continue mapping)
- Modify: `apps/web/src/lib/watchlist-lobby-order.test.ts`
- Modify: `apps/web/src/components/watchlist/watchlist-catalog-order-chips.tsx`
- Modify: `apps/web/src/lib/fetch-my-watchlist-server.ts`
- Modify: `apps/web/src/lib/still-api-fetch.ts` (`fetchMyWatchlist` passes `needsRegion`)
- Modify: `apps/web/src/app/(app)/watchlist/page.tsx`
- Modify: `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx`
- Create: `apps/web/src/components/watchlist/watchlist-mode-empty.tsx`

**Interfaces:**
- Consumes: server row fields `tonight_reason`, `streaming_alert`, `needs_region` (Tasks 3–4); `fetchTvWatchMeServer(api?, { status: "watching,rewatching", limit: 60 })`.
- Produces: `PopularMovieSeed.watchlistStreamingAlert?: boolean` and `watchlistIsStreaming?: boolean` (Task 6 reads); `tvWatchBundleToContinueSeed(bundle: TvWatchBundle, todayYmd: string): PopularMovieSeed | null`; `sortContinueSeeds`.

- [ ] **Step 1: Failing tests** (append to `watchlist-lobby-order.test.ts`)

```ts
describe("watchlist decision seeds", () => {
	const base = {
		item: { addedAt: "2026-09-01T00:00:00Z", movieId: 5, tvId: null },
		movie: { tmdbId: 5, title: "Heat", posterPath: null },
		tv: null,
	};
	test("tonight reason wins the pill slot over the streaming pill", () => {
		const seed = watchlistRowToPopularSeed({
			...base,
			streaming_provider_name: "Netflix",
			tonight_reason: "Maya recommended",
			streaming_alert: true,
		});
		expect(seed.watchlistStreamingLabel).toBe("Maya recommended");
		expect(seed.watchlistStreamingAlert).toBe(true);
		expect(seed.watchlistIsStreaming).toBe(true);
	});
	test("continue seed shows next episode and flags aired ones", () => {
		const seed = tvWatchBundleToContinueSeed(
			{
				watch: {
					id: "w", userId: "u", tvId: 9, status: "watching", progressMode: "episode",
					lastSeason: 2, lastEpisode: 4, notifyNewEpisodes: true,
					startedAt: "2026-01-01", statusChangedAt: "2026-09-01",
				},
				show: { tmdbId: 9, title: "Severance", posterPath: null },
				watchedEpisodes: [],
				nextEpisode: { seasonNumber: 2, episodeNumber: 5, airDate: "2026-09-20" },
			},
			"2026-09-23",
		);
		expect(seed?.listingKind).toBe("tv");
		expect(seed?.watchlistStreamingLabel).toBe("S2 · E5 next");
	});
	test("continue seed without next episode data", () => {
		const seed = tvWatchBundleToContinueSeed(
			{ watch: null, show: { tmdbId: 9, title: "X", posterPath: null }, watchedEpisodes: [], nextEpisode: null },
			"2026-09-23",
		);
		expect(seed?.watchlistStreamingLabel).toBe("Continue");
	});
});
```

(import `tvWatchBundleToContinueSeed` in that file)

Run: `cd apps/web; bun test src/lib/watchlist-lobby-order.test.ts` → FAIL.

- [ ] **Step 2: Implement mapping** (`watchlist-lobby-order.ts`)

Extend `WatchlistLobbyRow` with `tonight_reason?: string | null; streaming_alert?: boolean;`. In `watchlistRowToPopularSeed`:

```ts
		// Watch tonight's reason pill owns the caption slot; streaming pill otherwise.
		watchlistStreamingLabel:
			row.tonight_reason ??
			(row.streaming_provider_name
				? formatWatchlistStreamingPill(row.streaming_provider_name)
				: null),
		watchlistStreamingAlert: row.streaming_alert === true,
		watchlistIsStreaming: Boolean(row.streaming_provider_name),
```

Add `watchlistStreamingAlert?: boolean; watchlistIsStreaming?: boolean;` to `PopularMovieSeed` in `popular-movies-infinite.tsx` (next to `watchlistStreamingLabel`).

Add (import `TvWatchBundle` type from `@/lib/tv-watch-types`):

```ts
/** Continue watching tile — pill names the next episode; aired ones sort first. */
export function tvWatchBundleToContinueSeed(
	bundle: TvWatchBundle,
	todayYmd: string,
): (PopularMovieSeed & { hasNewEpisode: boolean; changedAt: string }) | null {
	const show = bundle.show;
	if (!show) return null;
	const next = bundle.nextEpisode;
	const posterPath = show.posterPath;
	return {
		id: show.tmdbId,
		title: show.title,
		poster_url:
			posterPath && !posterPath.startsWith("http")
				? tmdbPosterUrlFromPath(posterPath, "w342")
				: posterPath,
		listingKind: "tv",
		watchlistStreamingLabel: next
			? `S${next.seasonNumber} · E${next.episodeNumber} next`
			: "Continue",
		hasNewEpisode: Boolean(next?.airDate && next.airDate.slice(0, 10) <= todayYmd),
		changedAt: bundle.watch?.statusChangedAt ?? "",
	};
}

export function sortContinueSeeds<
	T extends { hasNewEpisode: boolean; changedAt: string },
>(seeds: T[]): T[] {
	return [...seeds].sort((a, b) => {
		if (a.hasNewEpisode !== b.hasNewEpisode) return a.hasNewEpisode ? -1 : 1;
		return b.changedAt.localeCompare(a.changedAt);
	});
}
```

Run tests → PASS.

- [ ] **Step 3: Chips** — replace `CHIPS` in `watchlist-catalog-order-chips.tsx`:

```ts
const CHIPS: readonly { id: WatchlistLobbyOrder; label: string; title: string }[] = [
	{ id: "tonight", label: "Watch tonight", title: "Ranked for tonight — streaming, friends, lists, taste" },
	{ id: "available", label: "Now available", title: "Streaming on your services in your region" },
	{ id: "continue", label: "Continue watching", title: "Shows you're in the middle of" },
	{ id: "latest_added", label: "Recently added", title: "Newest saves first — when you clipped each title" },
	{ id: "earliest_added", label: "Oldest saves", title: "Oldest clips first — chronological from your first save" },
	{ id: "title_az", label: "By title", title: "Alphabetical by title (A–Z), then newest save" },
] as const;
```

Update the sr-only description to: "Choose how your watchlist is shown — ranked for tonight, streaming now, shows in progress, or by save date and title." Wrap the toolbar in `HOME_LOBBY_CHIP_TRACK` horizontal scroll if it overflows on mobile (reuse the existing `max-w-full flex-nowrap` + parent `overflow-x-auto` pattern from `HomeLobbyFilterRow` leading rail).

- [ ] **Step 4: Data fetch**

`fetch-my-watchlist-server.ts` returns `{ seeds, totalPages, totalResults, needsRegion: boolean, failed: boolean }` (`needsRegion = data?.needs_region === true`; `failed = true` in the error/catch branches). `fetchMyWatchlist` in `still-api-fetch.ts` keeps its signature (paging never needs region). In `page.tsx` `WatchlistLobbyData`:

```ts
	if (order === "continue") {
		const bundles = await fetchTvWatchMeServer(undefined, {
			status: "watching,rewatching",
			limit: 60,
		});
		const todayYmd = new Date().toISOString().slice(0, 10);
		const seeds = sortContinueSeeds(
			bundles
				.map((b) => tvWatchBundleToContinueSeed(b, todayYmd))
				.filter((s): s is NonNullable<typeof s> => s != null),
		);
		return (
			<WatchlistLobbyCatalogue order={order} seeds={seeds} totalPages={1} totalResults={seeds.length} needsRegion={false} failed={false} />
		);
	}
```

and pass `needsRegion` / `failed` from `fetchMyWatchlistServer` for other orders.

- [ ] **Step 5: Mode empty / error states** — `watchlist-mode-empty.tsx`:

```tsx
"use client";

import { buttonVariants } from "@still/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

const COPY: Record<WatchlistLobbyOrder, { title: string; body: string; href: string; cta: string }> = {
	tonight: { title: "Nothing lined up yet", body: "Save a few titles and we'll line up tonight's.", href: "/home", cta: "Browse films" },
	available: { title: "Nothing on your services yet", body: "We'll show titles here as they land on your streaming services.", href: "/home", cta: "Browse films" },
	continue: { title: "No shows in progress", body: "Start a show and it'll wait for you here.", href: "/home?browse=tv", cta: "Browse TV" },
	latest_added: { title: "Your watchlist is empty", body: "When something catches your eye, tap Watchlist on its page.", href: "/home", cta: "Search films and shows" },
	earliest_added: { title: "Your watchlist is empty", body: "When something catches your eye, tap Watchlist on its page.", href: "/home", cta: "Search films and shows" },
	title_az: { title: "Your watchlist is empty", body: "When something catches your eye, tap Watchlist on its page.", href: "/home", cta: "Search films and shows" },
};

/** Per-mode empty, region-missing, and error states for `/watchlist`. */
export function WatchlistModeEmpty({
	order,
	needsRegion,
	failed,
}: {
	order: WatchlistLobbyOrder;
	needsRegion: boolean;
	failed: boolean;
}) {
	const router = useRouter();
	const copy = needsRegion
		? { title: "Pick your streaming region", body: "Now available needs to know which country's services to check.", href: "/me/settings/catalogue", cta: "Choose region" }
		: COPY[order];
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
			<div role="status" className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-background px-6 py-12 text-center sm:px-10 sm:py-14">
				<div className="space-y-2">
					<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
						{failed ? "Couldn't load your watchlist" : copy.title}
					</p>
					<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
						{failed ? "Something went wrong on our side." : copy.body}
					</p>
				</div>
				{failed ? (
					<button type="button" className={buttonVariants({ variant: "outline", size: "pill" })} onClick={() => router.refresh()}>
						Try again
					</button>
				) : (
					<Link href={copy.href} className={buttonVariants({ variant: "outline", size: "pill" })}>
						{copy.cta}
					</Link>
				)}
			</div>
		</div>
	);
}
```

Verify the settings route before shipping: `Glob apps/web/src/app/**/me/settings/**/page.tsx` — use the page that hosts the catalogue watch-region control (adjust `href`).

In `WatchlistLobbyCatalogue`, add props `needsRegion: boolean; failed: boolean` and replace the inline empty block with `if (seeds.length === 0 || failed) return <WatchlistModeEmpty order={order} needsRegion={needsRegion} failed={failed} />;`. For `order === "continue"`, pass `loadPage={async () => ({ results: [], total_pages: 1 })}` (single page).

- [ ] **Step 6: Mode impression** — in `WatchlistLobbyCatalogue`: `useTrackImpressionOnce("watchlist.mode_viewed", { mode: order, count: seeds.length });` (fires once per mount; the component remounts per order via its parent `key`). Requires Task 4 registry.

- [ ] **Step 7: Verify**

Run: `cd apps/web; bun test src/lib/watchlist-lobby-order.test.ts; bunx tsc --noEmit -p . 2>&1 | Select-String watchlist`; Biome on touched files. Browser: `/watchlist` — each chip loads its mode without flashing the previous one; mobile chip row scrolls on one line.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/watchlist-lobby-order.ts apps/web/src/lib/watchlist-lobby-order.test.ts apps/web/src/components/watchlist apps/web/src/lib/fetch-my-watchlist-server.ts apps/web/src/lib/still-api-fetch.ts "apps/web/src/app/(app)/watchlist/page.tsx" apps/web/src/components/movie/popular-movies-infinite.tsx
git commit -m "feat(watchlist): watch tonight, now available, continue watching modes"
```

---

### Task 6: Web — Alert me toolkit action + free preview dialog

**Files:**
- Modify: `apps/web/src/lib/catalogue-radial-items.ts` (+ test)
- Modify: `apps/web/src/components/catalogue/catalogue-poster-tile.tsx`
- Modify: `apps/web/src/components/movie/popular-movies-infinite.tsx` (pass alert props)
- Modify: `apps/web/src/lib/still-api-fetch.ts` (`patchWatchlistAlert`)
- Create: `apps/web/src/components/watchlist/watchlist-alert-preview-dialog.tsx`

**Interfaces:**
- Consumes: seed `watchlistStreamingAlert`, `watchlistIsStreaming` (Task 5); `PATCH /api/watchlist/alert` (Task 4).
- Produces: `patchWatchlistAlert(args: { listingKind: "movie" | "tv"; tmdbId: number; enabled: boolean }): Promise<{ ok: true; enabled: boolean } | { ok: false; planRequired: true; preview: WatchlistAlertPreview } | { ok: false; planRequired: false }>`; radial spec id `"streaming-alert"`.

- [ ] **Step 1: Failing radial test** (append to `catalogue-radial-items.test.ts`)

```ts
describe("watchlist streaming alert slot", () => {
	test("shown on watchlist when not streaming; label flips with state", () => {
		const off = buildCatalogueRadialItemSpecs({ surface: "watchlist", listingKind: "movie", signedIn: true, streamingAlert: false, isStreaming: false });
		expect(off.find((s) => s.id === "streaming-alert")?.label).toBe("Alert me when it streams");
		const on = buildCatalogueRadialItemSpecs({ surface: "watchlist", listingKind: "movie", signedIn: true, streamingAlert: true, isStreaming: false });
		expect(on.find((s) => s.id === "streaming-alert")?.label).toBe("Stop streaming alert");
	});
	test("hidden when already streaming or off the watchlist surface", () => {
		expect(buildCatalogueRadialItemSpecs({ surface: "watchlist", listingKind: "movie", signedIn: true, isStreaming: true }).some((s) => s.id === "streaming-alert")).toBe(false);
		expect(buildCatalogueRadialItemSpecs({ surface: "home", listingKind: "movie", signedIn: true }).some((s) => s.id === "streaming-alert")).toBe(false);
	});
});
```

Update the existing watchlist-order expectation (line ~163) to include `"streaming-alert"` after `"add-to-list"` only if that test passes `isStreaming: false`; if it omits the new inputs, `isStreaming` defaults to `undefined` → treat undefined as "unknown → hide" so the old test stays green.

Run: `cd apps/web; bun test src/lib/catalogue-radial-items.test.ts` → FAIL.

- [ ] **Step 2: Implement spec**

In `BuildCatalogueRadialSpecsInput` add `streamingAlert?: boolean; isStreaming?: boolean;`. Insert `"streaming-alert"` into `SLOT_ORDER` after `"add-to-list"`. In the watchlist branch:

```ts
	// Hidden when streaming state is unknown (undefined) or already streaming.
	if (catalogueSurface === "watchlist" && isStreaming === false) {
		specs.push({
			id: "streaming-alert",
			label: streamingAlert ? "Stop streaming alert" : "Alert me when it streams",
			shortcut: "S",
		});
	}
```

Run test → PASS.

- [ ] **Step 3: Fetch helper** (`still-api-fetch.ts`)

```ts
export type WatchlistAlertPreview = {
	notStreamingCount: number;
	sample: { listingKind: "movie" | "tv"; tmdbId: number; title: string; posterPath: string | null }[];
};

/** Toggle a per-title streaming alert; free patrons get the Attuned preview back. */
export async function patchWatchlistAlert(args: {
	listingKind: "movie" | "tv";
	tmdbId: number;
	enabled: boolean;
}): Promise<
	| { ok: true; enabled: boolean }
	| { ok: false; planRequired: true; preview: WatchlistAlertPreview }
	| { ok: false; planRequired: false }
> {
	const response = await fetch(new URL("/api/watchlist/alert", stillApiOrigin()), {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			...(args.listingKind === "movie" ? { movieId: args.tmdbId } : { tvId: args.tmdbId }),
			enabled: args.enabled,
		}),
	}).catch(() => null);
	if (!response) return { ok: false, planRequired: false };
	const data = (await response.json().catch(() => null)) as
		| { enabled?: boolean; code?: string; preview?: WatchlistAlertPreview }
		| null;
	if (response.ok) return { ok: true, enabled: data?.enabled === true };
	if (response.status === 403 && data?.code === "PLAN_FEATURE_REQUIRED" && data.preview) {
		return { ok: false, planRequired: true, preview: data.preview };
	}
	return { ok: false, planRequired: false };
}
```

- [ ] **Step 4: Preview dialog** — `watchlist-alert-preview-dialog.tsx`: a Base UI / shadcn `Dialog` (match `ListLobbyDeleteConfirmDialog` shell: `max-w-lg`, `APP_MODAL_OVERLAY_CLASS`, `z-[250]`, portal to body, no borders). Content:
  - Title: "Get told the day it streams"
  - Body: `${preview.notStreamingCount} of your saved titles aren't streaming yet — Attuned tells you the day they land.` (when count is 1: "1 of your saved titles isn't…")
  - Up to 3 `MoviePoster` thumbs (`aspect-2/3 w-20 rounded-xl`, alt = title; `tmdbPosterUrlFromPath(path, "w185")`).
  - Actions: primary `<Link href="/pricing">See Attuned</Link>`, quiet "Not now" closes.
  - On open: `trackSenseProductEvent("upgrade.prompt_viewed", { trigger: "watchlist_alerts" })` once (ref guard).

- [ ] **Step 5: Wire the tile**

`CataloguePosterTile` props: `watchlistStreamingAlert?: boolean; watchlistIsStreaming?: boolean;`. Local state `const [alertOn, setAlertOn] = useState(Boolean(watchlistStreamingAlert));` and `const [alertPreview, setAlertPreview] = useState<WatchlistAlertPreview | null>(null);`. Pass `streamingAlert: alertOn, isStreaming: watchlistIsStreaming` into `buildCatalogueRadialItemSpecs`. Handler:

```ts
			"streaming-alert": () => {
				onOpenChange(false);
				const next = !alertOn;
				setAlertOn(next); // optimistic
				void patchWatchlistAlert({ listingKind, tmdbId, enabled: next }).then((result) => {
					if (result.ok) {
						toast.success(next ? "We'll tell you when it streams" : "Streaming alert off");
						trackSenseProductEvent("watchlist.tile_action", { mode: "watchlist", action: next ? "alert_on" : "alert_off", reason: null });
						return;
					}
					setAlertOn(!next); // roll back
					if (result.planRequired) setAlertPreview(result.preview);
					else toast.error("Couldn't update the alert");
				});
			},
```

Icon: reuse `IconClockRotateClockwise` (or pick a Nucleo bell via the nucleo-icons skill if one exists in `@still/ui/icons`). Render `<WatchlistAlertPreviewDialog preview={alertPreview} onClose={() => setAlertPreview(null)} />` next to the toolkit. In `popular-movies-infinite.tsx` pass `watchlistStreamingAlert={m.watchlistStreamingAlert}` and `watchlistIsStreaming={m.watchlistIsStreaming}` to `CataloguePosterTile`.

Also fire `watchlist.tile_action` for existing `open` / `quick-log` / `remove-watchlist` / `add-to-list` when `surface === "watchlist"` (`{ mode, action, reason: posterCaption ?? null }`) — `mode` comes from a new optional `watchlistMode?: string` prop threaded from `WatchlistLobbyCatalogue` → `PopularMoviesInfinite` (`catalogueTrackingMode`) → tile.

- [ ] **Step 6: Verify**

Run: `cd apps/web; bun test src/lib/catalogue-radial-items.test.ts; bunx tsc --noEmit -p . 2>&1 | Select-String "catalogue-poster-tile|watchlist|popular-movies"`; Biome on touched files. Browser (free account): right-click a non-streaming watchlist poster → **Alert me when it streams** → dialog with count + posters → **See Attuned** opens `/pricing`; nothing saved (re-open toolkit still says Alert me). Attuned/staff override account: toggle persists across reload.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/catalogue-radial-items.ts apps/web/src/lib/catalogue-radial-items.test.ts apps/web/src/components/catalogue/catalogue-poster-tile.tsx apps/web/src/components/movie/popular-movies-infinite.tsx apps/web/src/lib/still-api-fetch.ts apps/web/src/components/watchlist
git commit -m "feat(watchlist): alert me when it streams with Attuned preview"
```

---

### Task 7: QA pass + docs

**Files:**
- Modify: `.cursor/scratchpad.md` (status + Please verify)
- Modify: `docs/superpowers/specs/2026-09-23-watchlist-decision-engine-design.md` (Continue watching → reuses `GET /api/tv-watch/me`; like the Home TV rail it lists the patron's own tracked shows without an extra adult filter — note this under Privacy)

- [ ] **Step 1:** Run all touched suites: `cd apps/server; bun test --env-file=.env src/lib/watchlist-*.test.ts src/lib/product-event-kinds.test.ts` and `cd ../web; bun test src/lib/watchlist-lobby-order.test.ts src/lib/catalogue-radial-items.test.ts` → all PASS.
- [ ] **Step 2:** `bunx tsc --noEmit -p .` in `apps/web` (covers server via imports) — no new errors in touched files.
- [ ] **Step 3:** Manual matrix — desktop + mobile width: each of 6 chips; region unset → Now available region prompt; empty watchlist per mode; offline (DevTools) → error + Try again; keyboard: chips reachable with Tab/arrow, toolkit actions have labels; reason pill truncates on one line.
- [ ] **Step 4:** Update spec note + scratchpad "Please verify" checklist; commit `docs(watchlist): decision engine QA notes`.
