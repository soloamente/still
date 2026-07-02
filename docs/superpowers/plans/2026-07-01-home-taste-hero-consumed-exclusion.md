# Home Taste Hero — Consumed Title Exclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven execution (one task per subagent; human `go` between tasks) or executing-plans for batch runs.

**Goal:** Ensure the Movies taste hero never shows watchlisted or diary-logged films, with server hard filter + client reconciliation + live eviction on mutations.

**Architecture:** Add `filterConsumedTasteMovies` server guard after enrichment; extend `for-you` payload with `consumedTmdbIds`; add `taste-title-consumed-events.ts` and wire hero listener + mutation dispatch sites.

**Tech Stack:** Bun tests, Drizzle (`watchlist_item`, `log`), Elysia `taste` routes, React client hero (`HomeTasteMatchedHero`).

**Spec:** `docs/superpowers/specs/2026-07-01-home-taste-hero-consumed-exclusion-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/taste-consumed-movies.ts` | `fetchConsumedMovieTmdbIds`, `filterConsumedTasteMovies` |
| `apps/server/src/lib/taste-consumed-movies.test.ts` | Unit tests |
| `apps/server/src/lib/taste-matched-discovery.ts` | Call final filter before return; export consumed ids helper usage |
| `apps/server/src/lib/taste-dismissed-movie.ts` | Guard replacement pick |
| `apps/server/src/routes/taste.ts` | Return `consumedTmdbIds` on `GET /for-you` |
| `apps/web/src/lib/taste-matched-discovery.ts` | Extend payload type |
| `apps/web/src/lib/taste-title-consumed-events.ts` | Dispatch + event name |
| `apps/web/src/components/home/home-taste-matched-hero.tsx` | Reconcile, listener, auto-purge on hydrate |
| `apps/web/src/lib/still-api-fetch.ts` | Dispatch on `postWatchlistAdd` success (movie) |
| `apps/web/src/components/log/quick-log-sheet.tsx` | Dispatch on movie log success |

---

### Task 1: Server consumed filter module

**Files:**
- Create: `apps/server/src/lib/taste-consumed-movies.ts`
- Create: `apps/server/src/lib/taste-consumed-movies.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import { filterConsumedTasteMovies } from "./taste-consumed-movies";

describe("filterConsumedTasteMovies", () => {
  test("removes watchlisted and logged ids", () => {
    const movies = [
      { tmdbId: 1, title: "A", posterPath: null, year: 2020 },
      { tmdbId: 2, title: "B", posterPath: null, year: 2021 },
    ];
    const out = filterConsumedTasteMovies(movies, new Set([2]));
    expect(out.map((m) => m.tmdbId)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/server && bun test src/lib/taste-consumed-movies.test.ts`

- [ ] **Step 3: Implement**

`fetchConsumedMovieTmdbIds(userId)` — parallel `fetchWatchlistMovieTmdbIds` + `SELECT DISTINCT movie_id FROM log WHERE user_id = ? AND movie_id IS NOT NULL`.

`filterConsumedTasteMovies(movies, consumedSet)` — simple filter.

- [ ] **Step 4: Run test — expect PASS**

---

### Task 2: Wire final guard into for-you pipeline

**Files:**
- Modify: `apps/server/src/lib/taste-matched-discovery.ts`
- Modify: `apps/server/src/lib/taste-match-enrichment.ts` (no change if filter is after enrichment in orchestrator)

- [ ] **Step 1: In `buildTasteMatchedDiscoveryWithMeta`**, after `enrichTasteMatchMovies`:

```ts
const consumedSet = new Set(await fetchConsumedMovieTmdbIds(userId));
const filtered = filterConsumedTasteMovies(payload.movies, consumedSet);
if (filtered.length < TASTE_MATCH_MIN_RESULTS) {
  payload = { coldStart: true, genrePhrase: null, movies: [], consumedTmdbIds: [...consumedSet] };
} else {
  payload = { ...payload, movies: filtered, consumedTmdbIds: [...consumedSet] };
}
```

- [ ] **Step 2: Extend `TasteMatchedDiscoveryPayload`** with `consumedTmdbIds?: number[]`

- [ ] **Step 3: Run** `cd apps/server && bun test src/lib/taste-matched-discovery.test.ts src/lib/taste-consumed-movies.test.ts`

---

### Task 3: Guard dismiss replacement

**Files:**
- Modify: `apps/server/src/lib/taste-dismissed-movie.ts`

- [ ] **Step 1: After `pickNextTasteMatchCandidate`**, if replacement non-null, verify `!consumedSet.has(replacement.tmdbId)`; else scan next or return null.

- [ ] **Step 2: Test** in `taste-dismissed-movie.test.ts` if file exists, or extend consumed filter test with pick loop mock.

---

### Task 4: Web types + event bus

**Files:**
- Create: `apps/web/src/lib/taste-title-consumed-events.ts`
- Modify: `apps/web/src/lib/taste-matched-discovery.ts`

- [ ] **Step 1: Event module** (mirror `listing-engagement-invalidate.ts`):

```ts
export const TASTE_TITLE_CONSUMED_EVENT = "still:taste-title-consumed";
export type TasteTitleConsumedDetail = { tmdbId: number };
export function dispatchTasteTitleConsumed(detail: TasteTitleConsumedDetail) { ... }
```

- [ ] **Step 2: Add `consumedTmdbIds?: number[]` to web payload type**

---

### Task 5: Hero reconciliation + listener

**Files:**
- Modify: `apps/web/src/components/home/home-taste-matched-hero.tsx`

- [ ] **Step 1: Filter initial/fetched movies** against `payload.consumedTmdbIds` before `setMovies`.

- [ ] **Step 2: `useEffect` subscribe** to `TASTE_TITLE_CONSUMED_EVENT` → `handleTitleConsumed(tmdbId)`.

- [ ] **Step 3: Spotlight hydrate** — if `inWatchlist` after check, call `handleTitleConsumed` instead of showing **On watchlist** (optional: skip diary fetch if `consumedTmdbIds` already includes id).

- [ ] **Step 4: Remove or narrow** **On watchlist** UI — button is add-only; consumed titles should not remain visible.

---

### Task 6: Dispatch from mutation sites

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts` (`postWatchlistAdd` — movie branch only)
- Modify: `apps/web/src/components/log/quick-log-sheet.tsx` (movie log success)

- [ ] **Step 1: `postWatchlistAdd`** — on success for movie tmdb id, `dispatchTasteTitleConsumed({ tmdbId })`.

- [ ] **Step 2: Quick Log** — after successful movie log POST, dispatch same event.

- [ ] **Step 3: Manual QA** per spec checklist.

---

### Task 7: Verification

- [ ] `cd apps/server && bun test src/lib/taste-consumed-movies.test.ts src/lib/taste-matched-discovery.test.ts src/lib/taste-dismissed-movie.test.ts`
- [ ] Human verify on `/home?browse=movies` with watchlisted Evangelion (or any on-list title) — absent from hero
- [ ] Human verify add-from-grid evicts without reload

---

## Execution handoff

Plan saved. Prefer **subagent-driven execution** (Task 1 → human `go` → Task 2 …) per project convention.
