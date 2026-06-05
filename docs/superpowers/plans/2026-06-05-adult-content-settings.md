# Adult Content Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a patron **Show adult content** preference (default off) that hides 18+ films and anime from all catalogue surfaces and gates detail pages behind a centered blocked state until enabled with age verification.

**Architecture:** Shared `adult-content-policy` module classifies titles (TMDb `adult` + cached MAL/Jikan Rx/Hentai). Patron pref lives in `profile.preferences.showAdultContent`. Server routes read pref via `getShowAdultContentForUser(userId)` and filter list responses + return minimal `adultBlocked` payloads on detail. Web Settings adds toggle + enable dialog; detail pages branch on `adultBlocked`.

**Tech Stack:** Drizzle ORM + Postgres (`packages/db`), Elysia API (`apps/server`), Next.js App Router (`apps/web`), Jikan v4, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-05-adult-content-settings-design.md`

---

## Conventions in this repo (read before starting)

- Migrations: hand-written SQL under `packages/db/src/migrations/` + entry in `meta/_journal.json` (next idx **18** → `0018_tv_adult.sql`).
- Tests: `import { describe, expect, it } from "bun:test"`, colocated `*.test.ts`. Run: `bun test <path>`.
- Profile prefs key must match web + server: `showAdultContent` (boolean).
- Modal stacking: `APP_MODAL_OVERLAY_CLASS` from `apps/web/src/lib/app-modal-layer.ts`.
- After code changes, run `graphify update .` per workspace rules.

---

## File structure

**Create:**
- `apps/server/src/lib/adult-content-policy.ts` — pref readers, classify helpers, list filter, detail gate
- `apps/server/src/lib/adult-content-policy.test.ts`
- `apps/server/src/lib/adult-anime-classification.ts` — Jikan Rx/Hentai → `_stillAdult` cache on `tv.tmdbJson`
- `apps/server/src/lib/adult-anime-classification.test.ts`
- `packages/db/src/migrations/0018_tv_adult.sql`
- `apps/web/src/lib/adult-content-age-gate.ts` — DOB ≥18 validation (not persisted)
- `apps/web/src/lib/adult-content-age-gate.test.ts`
- `apps/web/src/components/profile/adult-content-enable-dialog.tsx`
- `apps/web/src/components/detail/adult-content-blocked-state.tsx`

**Modify:**
- `packages/db/src/schema/tv.ts` — add `adult` column
- `packages/db/src/migrations/meta/_journal.json`
- `apps/server/src/lib/tmdb.ts` — `include_adult` param on all list/search endpoints; add `adult?` to summary types
- `apps/server/src/routes/movies.ts` — fix cache, detail gate, discover/search filter
- `apps/server/src/routes/tv.ts` — cache adult, detail gate, discover/search filter
- `apps/server/src/lib/tv-cache.ts` — persist `adult` on insert
- `apps/server/src/routes/logs.ts`, `watchlist.ts`, `lists.ts`, `feed.ts`, `profiles.ts`, `leaderboard.ts`
- `apps/web/src/lib/profile-preferences.ts` + `.test.ts`
- `apps/web/src/components/profile/settings-form-context.tsx`
- `apps/web/src/components/profile/settings-section-panels.tsx`
- `apps/web/src/app/(app)/movies/[id]/page.tsx`
- `apps/web/src/app/(app)/tv/[id]/page.tsx`

---

## Task 1: Adult content policy module

**Files:**
- Create: `apps/server/src/lib/adult-content-policy.ts`
- Create: `apps/server/src/lib/adult-content-policy.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/lib/adult-content-policy.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
	readShowAdultContentPref,
	isMovieAdult,
	isTvAdultFromRow,
	shouldBlockAdultDetail,
	filterOutAdultRows,
} from "./adult-content-policy";

describe("readShowAdultContentPref", () => {
	it("defaults to false when absent", () => {
		expect(readShowAdultContentPref(null)).toBe(false);
		expect(readShowAdultContentPref({})).toBe(false);
	});
	it("reads true when set", () => {
		expect(readShowAdultContentPref({ showAdultContent: true })).toBe(true);
	});
});

describe("isMovieAdult", () => {
	it("true when row.adult", () => {
		expect(isMovieAdult({ adult: true })).toBe(true);
	});
	it("false when row.adult false", () => {
		expect(isMovieAdult({ adult: false })).toBe(false);
	});
});

describe("isTvAdultFromRow", () => {
	it("true when tv.adult", () => {
		expect(isTvAdultFromRow({ adult: true, tmdbJson: null })).toBe(true);
	});
	it("true when _stillAdult cache says adult", () => {
		expect(
			isTvAdultFromRow({
				adult: false,
				tmdbJson: {
					_stillAdult: { isAdult: true, sources: ["mal_rating"], fetchedAt: "" },
				},
			}),
		).toBe(true);
	});
});

describe("shouldBlockAdultDetail", () => {
	it("blocks when adult and pref off", () => {
		expect(shouldBlockAdultDetail(false, true)).toBe(true);
	});
	it("does not block when pref on", () => {
		expect(shouldBlockAdultDetail(true, true)).toBe(false);
	});
});

describe("filterOutAdultRows", () => {
	it("removes adult rows when pref off", () => {
		const rows = [{ id: 1 }, { id: 2 }];
		const out = filterOutAdultRows(rows, false, (r) => r.id === 2);
		expect(out).toEqual([{ id: 1 }]);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun test apps/server/src/lib/adult-content-policy.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement policy module**

Create `apps/server/src/lib/adult-content-policy.ts`:

```ts
import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

/** Must match `PROFILE_PREF_SHOW_ADULT_CONTENT` in apps/web. */
export const PROFILE_PREF_SHOW_ADULT_CONTENT = "showAdultContent" as const;

export type StillAdultJson = {
	isAdult: boolean;
	sources: ("tmdb" | "mal_rating" | "mal_genre")[];
	fetchedAt: string;
};

export const STILL_ADULT_JSON_KEY = "_stillAdult" as const;

export function readShowAdultContentPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_SHOW_ADULT_CONTENT] === true;
}

export async function getShowAdultContentForUser(
	userId: string | null | undefined,
): Promise<boolean> {
	if (!userId) return false;
	try {
		const [row] = await db
			.select({ preferences: profile.preferences })
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);
		return readShowAdultContentPref(
			(row?.preferences as Record<string, unknown>) ?? null,
		);
	} catch (err) {
		console.error("[adult-content-policy] prefs unavailable, default off", err);
		return false;
	}
}

export function readStillAdultCache(
	tmdbJson: Record<string, unknown> | null | undefined,
): StillAdultJson | null {
	const block = tmdbJson?.[STILL_ADULT_JSON_KEY] as StillAdultJson | undefined;
	if (!block || typeof block.isAdult !== "boolean") return null;
	return block;
}

export function isMovieAdult(row: { adult?: boolean | null }): boolean {
	return row.adult === true;
}

export function isTvAdultFromRow(row: {
	adult?: boolean | null;
	tmdbJson?: Record<string, unknown> | null;
}): boolean {
	if (row.adult === true) return true;
	return readStillAdultCache(row.tmdbJson ?? null)?.isAdult === true;
}

export function isTmdbSummaryAdult(summary: { adult?: boolean | null }): boolean {
	return summary.adult === true;
}

export function shouldBlockAdultDetail(
	showAdultContent: boolean,
	isAdult: boolean,
): boolean {
	return isAdult && !showAdultContent;
}

export function filterOutAdultRows<T>(
	rows: T[],
	showAdultContent: boolean,
	isAdultFn: (row: T) => boolean,
): T[] {
	if (showAdultContent) return rows;
	return rows.filter((row) => !isAdultFn(row));
}

/** Minimal detail payload when patron has adult content disabled. */
export function buildAdultBlockedMoviePayload(id: number, title?: string | null) {
	return {
		adultBlocked: true as const,
		kind: "movie" as const,
		tmdbId: id,
		title: title ?? null,
	};
}

export function buildAdultBlockedTvPayload(id: number, title?: string | null) {
	return {
		adultBlocked: true as const,
		kind: "tv" as const,
		tmdbId: id,
		title: title ?? null,
	};
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun test apps/server/src/lib/adult-content-policy.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/adult-content-policy.ts apps/server/src/lib/adult-content-policy.test.ts
git commit -m "feat(server): add adult content policy helpers"
```

---

## Task 2: Web profile preference helpers

**Files:**
- Modify: `apps/web/src/lib/profile-preferences.ts`
- Modify: `apps/web/src/lib/profile-preferences.test.ts`

- [ ] **Step 1: Add failing test**

In `profile-preferences.test.ts`:

```ts
import {
	PROFILE_PREF_SHOW_ADULT_CONTENT,
	readShowAdultContentPref,
} from "./profile-preferences";

// inside describe block:
it("readShowAdultContentPref defaults off", () => {
	expect(readShowAdultContentPref(null)).toBe(false);
	expect(readShowAdultContentPref({ [PROFILE_PREF_SHOW_ADULT_CONTENT]: true })).toBe(
		true,
	);
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun test apps/web/src/lib/profile-preferences.test.ts`

- [ ] **Step 3: Add exports**

In `profile-preferences.ts`:

```ts
export const PROFILE_PREF_SHOW_ADULT_CONTENT = "showAdultContent" as const;

export function readShowAdultContentPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_SHOW_ADULT_CONTENT] === true;
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

---

## Task 3: DB migration — `tv.adult`

**Files:**
- Modify: `packages/db/src/schema/tv.ts`
- Create: `packages/db/src/migrations/0018_tv_adult.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Add column to schema**

In `packages/db/src/schema/tv.ts`, import `boolean` and add after `voteCount`:

```ts
adult: boolean("adult").default(false).notNull(),
```

- [ ] **Step 2: Write migration**

Create `packages/db/src/migrations/0018_tv_adult.sql`:

```sql
ALTER TABLE "tv" ADD COLUMN "adult" boolean DEFAULT false NOT NULL;
```

- [ ] **Step 3: Append journal entry** (idx 18, tag `0018_tv_adult`)

- [ ] **Step 4: Commit**

---

## Task 4: Fix movie/TV cache adult persistence

**Files:**
- Modify: `apps/server/src/routes/movies.ts` (`cacheDetail`)
- Modify: `apps/server/src/lib/tv-cache.ts`
- Modify: `apps/server/src/routes/tv.ts` (any TV upsert paths)

- [ ] **Step 1: Fix movie cache**

In `cacheDetail`, replace `adult: false` with:

```ts
adult: detail.adult === true,
```

Also add `adult: detail.adult === true` to the `onConflictDoUpdate` `set` block.

- [ ] **Step 2: Fix tv-cache insert**

In `ensureTvCached` insert values, add:

```ts
adult: (detail as { adult?: boolean }).adult === true,
```

Search `apps/server/src/routes/tv.ts` for other TV upserts and mirror the same field.

- [ ] **Step 3: Commit**

---

## Task 5: MAL/Jikan adult anime classification

**Files:**
- Create: `apps/server/src/lib/adult-anime-classification.ts`
- Create: `apps/server/src/lib/adult-anime-classification.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "bun:test";
import { classifyJikanAnimeAdult } from "./adult-anime-classification";

describe("classifyJikanAnimeAdult", () => {
	it("Rx rating is adult", () => {
		expect(
			classifyJikanAnimeAdult({ rating: "Rx - Hentai", genres: [] }),
		).toEqual({ isAdult: true, sources: ["mal_rating"] });
	});
	it("Hentai genre is adult", () => {
		expect(
			classifyJikanAnimeAdult({
				rating: "R - 17+",
				genres: [{ name: "Hentai" }],
			}),
		).toEqual({ isAdult: true, sources: ["mal_genre"] });
	});
	it("PG anime is not adult", () => {
		expect(
			classifyJikanAnimeAdult({
				rating: "PG-13 - Teens 13 or older",
				genres: [{ name: "Action" }],
			}),
		).toEqual({ isAdult: false, sources: [] });
	});
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Create `apps/server/src/lib/adult-anime-classification.ts`:

```ts
import { db, tv } from "@still/db";
import { eq } from "drizzle-orm";
import {
	STILL_ADULT_JSON_KEY,
	type StillAdultJson,
} from "./adult-content-policy";
import { MAL_ENRICHMENT_CACHE_TTL_MS } from "./mal-anime-enrichment";
import {
	readMalIdFromTmdbJson,
	readMalIdFromTmdbDetail,
} from "./tv-mal-id";

const JIKAN_ANIME_BASE = "https://api.jikan.moe/v4/anime";
const RX_RATING = "Rx - Hentai";

export function classifyJikanAnimeAdult(data: {
	rating?: string | null;
	genres?: { name?: string | null }[] | null;
}): { isAdult: boolean; sources: StillAdultJson["sources"] } {
	const sources: StillAdultJson["sources"] = [];
	if (data.rating === RX_RATING) sources.push("mal_rating");
	const hentai = (data.genres ?? []).some(
		(g) => g.name?.trim().toLowerCase() === "hentai",
	);
	if (hentai) sources.push("mal_genre");
	return { isAdult: sources.length > 0, sources };
}

function isStillAdultCacheFresh(block: StillAdultJson | undefined, nowMs = Date.now()) {
	if (!block?.fetchedAt) return false;
	const fetched = Date.parse(block.fetchedAt);
	if (!Number.isFinite(fetched)) return false;
	return nowMs - fetched < MAL_ENRICHMENT_CACHE_TTL_MS;
}

async function fetchJikanAdultSignals(malId: number) {
	try {
		const res = await fetch(`${JIKAN_ANIME_BASE}/${malId}`, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: { rating?: string | null; genres?: { name?: string | null }[] };
		};
		if (!json.data) return null;
		return classifyJikanAnimeAdult(json.data);
	} catch (err) {
		console.warn("[adult-anime-classification] Jikan fetch failed", malId, err);
		return null;
	}
}

async function persistStillAdultBlock(tmdbTvId: number, block: StillAdultJson) {
	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson, adult: tv.adult })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return;

	const mergedJson = {
		...(row.tmdbJson ?? {}),
		[STILL_ADULT_JSON_KEY]: block,
	};
	const nextAdult = row.adult || block.isAdult;
	await db
		.update(tv)
		.set({ tmdbJson: mergedJson, adult: nextAdult })
		.where(eq(tv.tmdbId, tmdbTvId));
}

/** Read-through adult classification for one TV row; warms `_stillAdult` via Jikan when needed. */
export async function ensureTvAdultClassification(
	tmdbTvId: number,
): Promise<StillAdultJson | null> {
	const [row] = await db
		.select({ adult: tv.adult, tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return null;

	const cached = row.tmdbJson?.[STILL_ADULT_JSON_KEY] as StillAdultJson | undefined;
	if (cached && isStillAdultCacheFresh(cached)) return cached;

	if (row.adult) {
		const block: StillAdultJson = {
			isAdult: true,
			sources: ["tmdb"],
			fetchedAt: new Date().toISOString(),
		};
		await persistStillAdultBlock(tmdbTvId, block);
		return block;
	}

	const malId =
		readMalIdFromTmdbJson(row.tmdbJson) ??
		readMalIdFromTmdbDetail(row.tmdbJson ?? {});
	if (malId == null) {
		const block: StillAdultJson = {
			isAdult: false,
			sources: [],
			fetchedAt: new Date().toISOString(),
		};
		await persistStillAdultBlock(tmdbTvId, block);
		return block;
	}

	const signals = await fetchJikanAdultSignals(malId);
	const block: StillAdultJson = {
		isAdult: signals?.isAdult ?? false,
		sources: signals?.sources ?? [],
		fetchedAt: new Date().toISOString(),
	};
	await persistStillAdultBlock(tmdbTvId, block);
	return block;
}

/** Warm adult flags for discover/search page (sequential — Jikan rate limits). */
export async function warmTvAdultClassificationBatch(
	tmdbIds: number[],
): Promise<void> {
	for (const id of tmdbIds) {
		await ensureTvAdultClassification(id);
	}
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

---

## Task 6: TMDb client — parametrize `include_adult`

**Files:**
- Modify: `apps/server/src/lib/tmdb.ts`

- [ ] **Step 1: Extend summary types**

Add optional `adult?: boolean` to `TmdbMovieSummary` and `TmdbTvSummary`.

- [ ] **Step 2: Add helper**

```ts
function includeAdultParam(showAdult: boolean): "true" | "false" {
	return showAdult ? "true" : "false";
}
```

- [ ] **Step 3: Thread `showAdultContent?: boolean` through:**

- `searchMovies(query, page, { language, showAdultContent })`
- `searchTv(...)`
- `discoverMovies(page, opts & { showAdultContent })`
- `discoverTv(...)`
- `popularTv(page, { language, showAdultContent })`
- `onTheAirTv(...)`
- Any other movie list helpers missing the param (`popularMovies`, `upcomingMovies`, etc. — grep `tmdbApi.` in routes)

Replace hardcoded `include_adult: "false"` with `include_adult: includeAdultParam(opts.showAdultContent === true)`.

- [ ] **Step 4: Commit**

---

## Task 7: Movie/TV detail gate

**Files:**
- Modify: `apps/server/src/routes/movies.ts` — `GET /:id`
- Modify: `apps/server/src/routes/tv.ts` — `GET /:id`

- [ ] **Step 1: Movie detail**

After loading `row`, before building full response:

```ts
const showAdult = await getShowAdultContentForUser(user?.id);
const adult = isMovieAdult(row);
if (shouldBlockAdultDetail(showAdult, adult)) {
	return buildAdultBlockedMoviePayload(id, row.title);
}
```

- [ ] **Step 2: TV detail**

After `ensureTvCached` + load row:

```ts
const showAdult = await getShowAdultContentForUser(user?.id);
await ensureTvAdultClassification(id);
const [fresh] = await db.select().from(tv).where(eq(tv.tmdbId, id)).limit(1);
if (!fresh) return status(404, "TV not found");
if (shouldBlockAdultDetail(showAdult, isTvAdultFromRow(fresh))) {
	return buildAdultBlockedTvPayload(id, fresh.title);
}
```

- [ ] **Step 3: Manual check**

With pref off, hit adult title URL — response JSON must have `adultBlocked: true` and **no** `overview` / `poster_url`.

- [ ] **Step 4: Commit**

---

## Task 8: Discover & search filtering

**Files:**
- Modify: `apps/server/src/routes/movies.ts` — search + discover handlers
- Modify: `apps/server/src/routes/tv.ts` — search + discover + popular/on-the-air

- [ ] **Step 1: Read pref once per handler**

```ts
const showAdult = await getShowAdultContentForUser(user?.id);
```

Pass `showAdultContent: showAdult` into `tmdbApi.*` calls.

- [ ] **Step 2: Post-filter movie results**

```ts
results: filterOutAdultRows(data.results, showAdult, (m) =>
	isTmdbSummaryAdult(m) || false,
).map(/* existing map */),
```

For cached movies, optionally batch-load `movie.adult` for result ids when TMDb summary omits flag.

- [ ] **Step 3: Post-filter TV results**

After TMDb fetch, when `!showAdult`:

1. Filter `isTmdbSummaryAdult(show)`.
2. Batch-load `tv` rows for remaining ids; filter `isTvAdultFromRow(row)`.
3. When query includes anime keyword (`210024`) or animation genre discover, call `warmTvAdultClassificationBatch(ids.slice(0, 20))` then re-load rows and filter again.

- [ ] **Step 4: Commit**

---

## Task 9: Diary, watchlist, lists, community

**Files:**
- Modify: `apps/server/src/routes/logs.ts`
- Modify: `apps/server/src/routes/watchlist.ts`
- Modify: `apps/server/src/routes/lists.ts`
- Modify: `apps/server/src/routes/profiles.ts` (filmography)
- Modify: `apps/server/src/routes/feed.ts`
- Modify: `apps/server/src/routes/leaderboard.ts`

- [ ] **Step 1: Add shared helper** (in `adult-content-policy.ts` or new `adult-content-filter-rows.ts`):

```ts
export async function isLogEntryAdult(entry: {
	movieId: number | null;
	tvId: number | null;
}): Promise<boolean> {
	// load movie.adult or tv row + isTvAdultFromRow
}
```

- [ ] **Step 2: Filter list endpoints**

In each handler, after fetching rows and `const showAdult = await getShowAdultContentForUser(user.id)`:

```ts
if (!showAdult) {
	rows = [];
	for (const row of originalRows) {
		if (!(await isLogEntryAdult(row))) rows.push(row);
	}
}
```

Prefer batch SQL where performance matters (profile filmography): join `movie`/`tv` and filter `(movie.adult = false OR movie.id IS NULL) AND (tv.adult = false AND coalesce(tv.tmdb_json->'_stillAdult'->>'isAdult','false') <> 'true' OR tv.id IS NULL)` — or filter in application code for v1 if filmography query is already complex.

- [ ] **Step 3: Commit**

---

## Task 10: Settings UI + enable dialog

**Files:**
- Create: `apps/web/src/lib/adult-content-age-gate.ts`
- Create: `apps/web/src/lib/adult-content-age-gate.test.ts`
- Create: `apps/web/src/components/profile/adult-content-enable-dialog.tsx`
- Modify: `apps/web/src/components/profile/settings-form-context.tsx`
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`

- [ ] **Step 1: Age gate util + tests**

`adult-content-age-gate.ts`:

```ts
export function patronMeetsAdultAgeGate(
	birthDateIso: string,
	now = new Date(),
): boolean {
	const dob = new Date(birthDateIso);
	if (Number.isNaN(dob.getTime())) return false;
	const cutoff = new Date(now);
	cutoff.setFullYear(cutoff.getFullYear() - 18);
	return dob <= cutoff;
}
```

Test with fixed dates.

- [ ] **Step 2: Wire settings form context**

Add state:

```ts
showAdultContent: boolean;
setShowAdultContent: (v: boolean) => void;
pendingAdultEnable: boolean;
setPendingAdultEnable: (v: boolean) => void;
```

Initialize from `readShowAdultContentPref(profile.preferences)`.

On submit, persist `[PROFILE_PREF_SHOW_ADULT_CONTENT]: showAdultContent` in prefs patch.

- [ ] **Step 3: Toggle handler in Catalogue section**

When turning **on**, open `AdultContentEnableDialog` instead of calling `setShowAdultContent(true)` immediately.

When turning **off**, call `setShowAdultContent(false)` directly.

Dialog on confirm → `setShowAdultContent(true)`.

Use `MePreferenceToggle` with controlled `checked={showAdultContent}` and custom `onChange`.

- [ ] **Step 4: Implement dialog**

`AdultContentEnableDialog`:
- `Dialog` + `APP_MODAL_OVERLAY_CLASS`
- `<input type="date" />` for DOB
- Checkbox with spec copy
- Enable button disabled until `patronMeetsAdultAgeGate(dob) && checkbox`
- Cancel closes without enabling

- [ ] **Step 5: Commit**

---

## Task 11: Blocked detail UI (web)

**Files:**
- Create: `apps/web/src/components/detail/adult-content-blocked-state.tsx`
- Modify: `apps/web/src/app/(app)/movies/[id]/page.tsx`
- Modify: `apps/web/src/app/(app)/tv/[id]/page.tsx`

- [ ] **Step 1: Blocked state component**

```tsx
export function AdultContentBlockedState() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
			<h1 className="font-semibold text-xl text-balance">Adult content is hidden</h1>
			<p className="max-w-md text-muted-foreground text-sm text-balance">
				Turn on adult content in Settings → Catalogue if you are 18 or older.
			</p>
			<Button asChild>
				<Link href="/me/settings/catalogue">Open Settings</Link>
			</Button>
		</div>
	);
}
```

- [ ] **Step 2: Branch in movie page**

After fetch, if `(data as { adultBlocked?: boolean }).adultBlocked`:

```tsx
return (
	<MovieDetailViewShell /* minimal — back only */>
		<div className="bg-card ...">
			<AdultContentBlockedState />
		</div>
	</MovieDetailViewShell>
);
```

Skip hero, community, tabs. Keep existing back/share shell if minimal.

- [ ] **Step 3: Mirror on TV page**

- [ ] **Step 4: Commit**

---

## Task 12: Verification

- [ ] **Run unit tests**

```bash
bun test apps/server/src/lib/adult-content-policy.test.ts
bun test apps/server/src/lib/adult-anime-classification.test.ts
bun test apps/web/src/lib/profile-preferences.test.ts
bun test apps/web/src/lib/adult-content-age-gate.test.ts
```

- [ ] **Typecheck web**

```bash
cd apps/web && bun run check-types
```

- [ ] **Manual QA checklist**

1. Default patron: Anime ⌘K discover — no Rx/Hentai titles on first page.
2. `/tv/[adult-id]` — blocked centered message, no poster in DOM/network payload.
3. Settings → enable with DOB under 18 — Enable stays disabled.
4. Enable with valid DOB + checkbox → save → adult titles appear in search + diary.
5. Disable toggle → titles hidden again everywhere.

- [ ] **Update spec status** to `Implemented` when done.

- [ ] **Run graphify**

```bash
graphify update .
```

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| TMDb + MAL classification | 1, 5 |
| `showAdultContent` pref default off | 1, 2 |
| Fix movie.adult cache | 4 |
| tv.adult column | 3, 4 |
| include_adult param everywhere | 6, 8 |
| Filter all list surfaces | 8, 9 |
| Detail adultBlocked payload | 7, 11 |
| Settings Catalogue toggle | 10 |
| Enable dialog DOB + checkbox | 10 |
| Imports stay in DB, hidden in UI | 9 (diary filter) |
| English copy | 10, 11 |

No TBD placeholders remain.
