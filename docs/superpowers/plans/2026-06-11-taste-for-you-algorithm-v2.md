# Taste For You Algorithm v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Movies For you rail scorer with a social-augmented, rating-weighted, diversity-aware algorithm where **Not interested** downranks similar future picks — not just forever-excludes one title.

**Architecture:** Split pure scoring math into testable modules under `apps/server/src/lib/taste-*`. Extract neighbor discovery into shared `taste-neighbor-discovery.ts`. Refactor `taste-matched-discovery.ts` as orchestrator calling profile build → stratified pool → social fetch → blend → dismiss penalties → MMR. API shape unchanged; server-only v1.

**Tech Stack:** Bun tests, Drizzle/Postgres (`movie`, `log`, `follow`, `taste_dismissed_movie`), existing `computeTasteOverlap` + `contentVisibilityWhere`, Elysia `taste` routes, `recordProductEvent`.

**Spec:** `docs/superpowers/specs/2026-06-11-taste-for-you-algorithm-v2-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/taste-scoring-math.ts` | Pure helpers: rating weight, recency, Jaccard, normalize, MMR, dismiss similarity |
| `apps/server/src/lib/taste-scoring-math.test.ts` | Unit tests for math layer |
| `apps/server/src/lib/taste-profile.ts` | `buildWeightedTasteProfile`, `buildDismissNegativeProfile`, solo score |
| `apps/server/src/lib/taste-profile.test.ts` | Profile + dismiss layer unit tests |
| `apps/server/src/lib/taste-neighbor-discovery.ts` | Shared neighbor resolution (followed + overlap backfill) |
| `apps/server/src/lib/taste-neighbor-discovery.test.ts` | Neighbor tiering unit tests (pure rank helpers) |
| `apps/server/src/lib/taste-social-candidates.ts` | Batch fetch neighbor high-rated unseen movies |
| `apps/server/src/lib/taste-stratified-candidates.ts` | Per-genre candidate SQL pools |
| `apps/server/src/lib/taste-dismissed-movie-store.ts` | Add `fetchDismissedMoviesWithMetadata` |
| `apps/server/src/lib/taste-matched-discovery.ts` | Orchestrator refactor |
| `apps/server/src/lib/taste-matched-discovery.test.ts` | End-to-end pure pipeline tests with fixtures |
| `apps/server/src/lib/suggested-patron-discovery.ts` | Import shared neighbor SQL (thin wrapper) |
| `apps/server/src/lib/product-event-kinds.ts` | Add `taste.for_you.served` |
| `apps/server/src/routes/taste.ts` | Fire analytics event on for-you success |

---

### Task 1: Pure scoring math module

**Files:**
- Create: `apps/server/src/lib/taste-scoring-math.ts`
- Create: `apps/server/src/lib/taste-scoring-math.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/server/src/lib/taste-scoring-math.test.ts
import { describe, expect, test } from "bun:test";

import {
  applyDismissSimilarityPenalty,
  genreJaccardSimilarity,
  mmrSelectCandidates,
  normalizeScores,
  ratingAffinityWeight,
  recencyDecayByIndex,
} from "./taste-scoring-math";

describe("ratingAffinityWeight", () => {
  test("high ratings weigh more than low ratings", () => {
    expect(ratingAffinityWeight(90)).toBeGreaterThan(ratingAffinityWeight(50));
    expect(ratingAffinityWeight(null)).toBe(0.3);
  });
});

describe("genreJaccardSimilarity", () => {
  test("identical genres score 1", () => {
    expect(genreJaccardSimilarity([18, 53], [18, 53])).toBe(1);
  });
  test("disjoint genres score 0", () => {
    expect(genreJaccardSimilarity([18], [35])).toBe(0);
  });
});

describe("applyDismissSimilarityPenalty", () => {
  test("similar candidate loses score vs unrelated", () => {
    const dismissed = {
      genreIds: [18, 53],
      year: 2015,
      originalLanguage: "en",
    };
    const similar = applyDismissSimilarityPenalty(100, {
      genreIds: [18, 53],
      year: 2014,
      originalLanguage: "en",
    }, [dismissed]);
    const unrelated = applyDismissSimilarityPenalty(100, {
      genreIds: [16],
      year: 1990,
      originalLanguage: "ja",
    }, [dismissed]);
    expect(similar).toBeLessThan(unrelated);
    expect(similar).toBeGreaterThan(0);
  });
});

describe("mmrSelectCandidates", () => {
  test("selects diverse genre clusters when available", () => {
    const pool = [
      { id: 1, score: 100, genreIds: [18], year: 2010 },
      { id: 2, score: 99, genreIds: [18], year: 2011 },
      { id: 3, score: 98, genreIds: [18], year: 2012 },
      { id: 4, score: 90, genreIds: [16], year: 2010 },
    ];
    const selected = mmrSelectCandidates(pool, { limit: 3, lambda: 0.35 });
    const ids = selected.map((row) => row.id);
    expect(ids).toContain(4);
  });
});

describe("normalizeScores", () => {
  test("maps max to 100 and min to 0", () => {
    const out = normalizeScores([
      { key: "a", score: 10 },
      { key: "b", score: 20 },
    ]);
    expect(out.get("b")).toBe(100);
    expect(out.get("a")).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/server && bun test src/lib/taste-scoring-math.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement math module**

```ts
// apps/server/src/lib/taste-scoring-math.ts
import { storedRatingToDisplayTen } from "./sense-taste-overlap";

export function ratingAffinityWeight(storedRating: number | null): number {
  if (storedRating == null) return 0.3;
  const display = storedRatingToDisplayTen(storedRating);
  if (display <= 5) return 0.5;
  if (display >= 9) return 1.4;
  if (display >= 7) return 1.0;
  return 0.5 + (display - 5) * 0.25;
}

/** index 0 = newest log in the batch passed to profile builder */
export function recencyDecayByIndex(index: number, total: number): number {
  if (total <= 1) return 1;
  const t = index / (total - 1);
  return 1 - t * 0.4;
}

export function decadeFromYear(year: number | null | undefined): number | null {
  if (year == null || !Number.isFinite(year)) return null;
  return Math.floor(year / 10) * 10;
}

export function genreJaccardSimilarity(a: number[], b: number[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const id of setA) if (setB.has(id)) intersection += 1;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export type DismissMetadata = {
  genreIds: number[];
  year: number | null;
  originalLanguage: string | null;
};

export type CandidateMetadata = DismissMetadata;

export function dismissSimilarity(
  candidate: CandidateMetadata,
  dismissed: DismissMetadata,
): number {
  const decadeA = decadeFromYear(candidate.year);
  const decadeB = decadeFromYear(dismissed.year);
  const langA = candidate.originalLanguage?.trim().toLowerCase() ?? "";
  const langB = dismissed.originalLanguage?.trim().toLowerCase() ?? "";
  return (
    genreJaccardSimilarity(candidate.genreIds, dismissed.genreIds) * 0.7 +
    (decadeA != null && decadeA === decadeB ? 0.2 : 0) +
    (langA.length > 0 && langA === langB ? 0.1 : 0)
  );
}

export function applyDismissSimilarityPenalty(
  blendedScore: number,
  candidate: CandidateMetadata,
  dismissedRows: DismissMetadata[],
): number {
  if (dismissedRows.length === 0) return blendedScore;
  let maxSim = 0;
  for (const dismissed of dismissedRows) {
    maxSim = Math.max(maxSim, dismissSimilarity(candidate, dismissed));
  }
  const rawPenalty = maxSim * 45;
  const cappedPenalty = Math.min(rawPenalty, blendedScore * 0.55);
  return Math.max(0, blendedScore - cappedPenalty);
}

export function normalizeScores(
  rows: Array<{ key: number; score: number }>,
): Map<number, number> {
  const map = new Map<number, number>();
  if (rows.length === 0) return map;
  const min = Math.min(...rows.map((r) => r.score));
  const max = Math.max(...rows.map((r) => r.score));
  if (max === min) {
    for (const row of rows) map.set(row.key, 100);
    return map;
  }
  for (const row of rows) {
    map.set(row.key, ((row.score - min) / (max - min)) * 100);
  }
  return map;
}

export type MmrCandidate = {
  id: number;
  score: number;
  genreIds: number[];
  year: number | null;
};

function mmrSimilarity(a: MmrCandidate, b: MmrCandidate): number {
  const genreSim = genreJaccardSimilarity(a.genreIds, b.genreIds);
  const decadeA = decadeFromYear(a.year);
  const decadeB = decadeFromYear(b.year);
  const decadeBonus = decadeA != null && decadeA === decadeB ? 0.25 : 0;
  return Math.min(1, genreSim + decadeBonus);
}

export function mmrSelectCandidates(
  pool: MmrCandidate[],
  options: { limit: number; lambda: number },
): MmrCandidate[] {
  const selected: MmrCandidate[] = [];
  const remaining = [...pool].sort((a, b) => b.score - a.score);
  while (selected.length < options.limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      if (!candidate) continue;
      const maxSim =
        selected.length === 0
          ? 0
          : Math.max(...selected.map((s) => mmrSimilarity(candidate, s)));
      const mmr = candidate.score - options.lambda * maxSim * 100;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }
    const [picked] = remaining.splice(bestIdx, 1);
    if (picked) selected.push(picked);
  }
  return selected;
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/server && bun test src/lib/taste-scoring-math.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/taste-scoring-math.ts apps/server/src/lib/taste-scoring-math.test.ts
git commit -m "feat(server): add pure taste scoring math helpers"
```

---

### Task 2: Weighted taste profile + dismiss negative profile

**Files:**
- Create: `apps/server/src/lib/taste-profile.ts`
- Create: `apps/server/src/lib/taste-profile.test.ts`
- Modify: `apps/server/src/lib/taste-dismissed-movie-store.ts`

- [ ] **Step 1: Extend dismiss store with metadata fetch**

Add to `taste-dismissed-movie-store.ts`:

```ts
import { db, movie, tasteDismissedMovie } from "@still/db";
import { desc, eq } from "drizzle-orm";

export type DismissedMovieMetadata = {
  movieTmdbId: number;
  genreIds: number[];
  year: number | null;
  originalLanguage: string | null;
  popularity: number | null;
};

/** Last N dismissals with movie metadata for negative scoring. */
export async function fetchDismissedMoviesWithMetadata(
  userId: string,
  limit = 50,
): Promise<DismissedMovieMetadata[]> {
  const rows = await db
    .select({
      movieTmdbId: tasteDismissedMovie.movieTmdbId,
      genreIds: movie.genreIds,
      year: movie.year,
      originalLanguage: movie.originalLanguage,
      popularity: movie.popularity,
    })
    .from(tasteDismissedMovie)
    .leftJoin(movie, eq(tasteDismissedMovie.movieTmdbId, movie.tmdbId))
    .where(eq(tasteDismissedMovie.userId, userId))
    .orderBy(desc(tasteDismissedMovie.dismissedAt))
    .limit(limit);

  return rows.map((row) => ({
    movieTmdbId: row.movieTmdbId,
    genreIds: (row.genreIds as number[] | undefined) ?? [],
    year: row.year,
    originalLanguage: row.originalLanguage,
    popularity: row.popularity,
  }));
}
```

Keep existing `fetchDismissedMovieTmdbIds` — orchestrator uses both.

- [ ] **Step 2: Write failing profile tests**

```ts
// apps/server/src/lib/taste-profile.test.ts
import { describe, expect, test } from "bun:test";

import {
  applyRepeatGenreDownweight,
  buildDismissNegativeProfile,
  buildWeightedTasteProfile,
  scoreSoloCandidate,
} from "./taste-profile";

describe("buildWeightedTasteProfile", () => {
  test("high-rated horror outweighs low-rated comedy frequency", () => {
    const profile = buildWeightedTasteProfile([
      { genreIds: [27], rating: 95, year: 2010, originalLanguage: "en", popularity: 5, index: 0, total: 2 },
      { genreIds: [27], rating: 90, year: 2011, originalLanguage: "en", popularity: 6, index: 1, total: 2 },
      { genreIds: [35], rating: 40, year: 2012, originalLanguage: "en", popularity: 80, index: 2, total: 3 },
      { genreIds: [35], rating: 45, year: 2013, originalLanguage: "en", popularity: 90, index: 3, total: 4 },
      { genreIds: [35], rating: 50, year: 2014, originalLanguage: "en", popularity: 100, index: 4, total: 5 },
    ]);
    expect(profile.genreWeights.get(27) ?? 0).toBeGreaterThan(
      profile.genreWeights.get(35) ?? 0,
    );
  });
});

describe("buildDismissNegativeProfile", () => {
  test("repeat genre triggers negative weight", () => {
    const negative = buildDismissNegativeProfile([
      { genreIds: [53], year: 2010, originalLanguage: "en", popularity: 10 },
      { genreIds: [53, 18], year: 2012, originalLanguage: "en", popularity: 12 },
    ]);
    expect(negative.repeatGenreCounts.get(53)).toBe(2);
  });
});

describe("applyRepeatGenreDownweight", () => {
  test("two dismissals in same genre reduce solo score", () => {
    const profile = buildWeightedTasteProfile([
      { genreIds: [53], rating: 80, year: 2010, originalLanguage: "en", popularity: 10, index: 0, total: 1 },
    ]);
    const negative = buildDismissNegativeProfile([
      { genreIds: [53], year: 2010, originalLanguage: "en", popularity: 10 },
      { genreIds: [53], year: 2012, originalLanguage: "en", popularity: 12 },
    ]);
    const base = scoreSoloCandidate(
      { genreIds: [53], year: 2015, originalLanguage: "en", popularity: 20 },
      profile,
      { nicheBoost: false, viewerPopularityP75: 50 },
    );
    const penalized = applyRepeatGenreDownweight(base, { genreIds: [53], year: 2015, originalLanguage: "en", popularity: 20 }, profile, negative);
    expect(penalized).toBeLessThan(base);
  });
});
```

- [ ] **Step 3: Implement taste-profile.ts**

Implement `TasteProfileSlice`, `WeightedTasteProfile`, `buildWeightedTasteProfile`, `buildDismissNegativeProfile`, `scoreSoloCandidate` (genre×8, decade×6, language×4, popularity cap +4, niche boost per spec), `applyRepeatGenreDownweight` (layer 2 formula).

Export types for orchestrator reuse.

- [ ] **Step 4: Run tests**

Run: `cd apps/server && bun test src/lib/taste-profile.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/taste-profile.ts apps/server/src/lib/taste-profile.test.ts apps/server/src/lib/taste-dismissed-movie-store.ts
git commit -m "feat(server): add rating-weighted taste profile and dismiss negative weights"
```

---

### Task 3: Taste neighbor discovery (shared module)

**Files:**
- Create: `apps/server/src/lib/taste-neighbor-discovery.ts`
- Create: `apps/server/src/lib/taste-neighbor-discovery.test.ts`
- Modify: `apps/server/src/lib/suggested-patron-discovery.ts`

- [ ] **Step 1: Write failing rank test**

```ts
// apps/server/src/lib/taste-neighbor-discovery.test.ts
import { describe, expect, test } from "bun:test";

import { rankTasteNeighbors } from "./taste-neighbor-discovery";

describe("rankTasteNeighbors", () => {
  test("followed tier ranks above stranger at equal compatibility", () => {
    const ranked = rankTasteNeighbors([
      { userId: "a", compatibilityPercent: 70, tier: 2 },
      { userId: "b", compatibilityPercent: 70, tier: 1 },
    ]);
    expect(ranked[0]?.userId).toBe("b");
  });
});
```

- [ ] **Step 2: Extract from suggested-patron-discovery**

Move `fetchOverlapCandidateUserIds`, `collectMediaIdsFromMap`, overlap candidate SQL into `taste-neighbor-discovery.ts`.

Add:

```ts
export type TasteNeighbor = {
  userId: string;
  compatibilityPercent: number;
  tier: 1 | 2; // 1 = followed, 2 = overlap stranger
};

export function rankTasteNeighbors(rows: TasteNeighbor[]): TasteNeighbor[] {
  return [...rows].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.compatibilityPercent - a.compatibilityPercent;
  });
}

export async function resolveTasteNeighbors(args: {
  viewerId: string;
  viewerMap: Map<string, OverlapDiarySlice>;
  minSharedTitles: number;
  minCompatibility: number;
  limit: number;
}): Promise<TasteNeighbor[]>
```

Implementation steps inside `resolveTasteNeighbors`:

1. Fetch following ids → tier 1 stubs with compatibility from `computeTasteOverlap` when slices available.
2. Fetch overlap candidates via shared SQL (reuse `fetchOverlapDiarySlices` per candidate).
3. Filter strangers: `sharedWatches >= 3`, `compatibilityPercent >= 40`, public profile (already in SQL).
4. `rankTasteNeighbors` → slice to 20.

- [ ] **Step 3: Thin suggested-patron-discovery wrapper**

Replace inlined overlap candidate fetch with imports from `taste-neighbor-discovery.ts`. Run existing suggested patron tests if any; else smoke `bun test apps/server/src/lib/suggested-patron-discovery.ts` paths.

- [ ] **Step 4: Run tests**

Run: `cd apps/server && bun test src/lib/taste-neighbor-discovery.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/taste-neighbor-discovery.ts apps/server/src/lib/taste-neighbor-discovery.test.ts apps/server/src/lib/suggested-patron-discovery.ts
git commit -m "refactor(server): extract shared taste neighbor discovery"
```

---

### Task 4: Stratified + social candidate fetchers

**Files:**
- Create: `apps/server/src/lib/taste-stratified-candidates.ts`
- Create: `apps/server/src/lib/taste-social-candidates.ts`

- [ ] **Step 1: Implement stratified fetch**

```ts
// apps/server/src/lib/taste-stratified-candidates.ts
import { db, movie } from "@still/db";
import { and, asc, isNotNull, notInArray, sql } from "drizzle-orm";

const PER_GENRE_LIMIT = 150;
const FALLBACK_LIMIT = 100;

export async function fetchStratifiedCandidates(args: {
  topGenreIds: number[];
  excludeTmdbIds: number[];
}): Promise<Array<{
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
  genreIds: number[];
  originalLanguage: string | null;
  popularity: number | null;
}>> {
  const seen = new Set<number>();
  const rows: Array<...> = [];

  for (const genreId of args.topGenreIds.slice(0, 3)) {
    const genreRows = await db
      .select({ ...movie fields })
      .from(movie)
      .where(
        and(
          isNotNull(movie.popularity),
          sql`${movie.genreIds} @> ${JSON.stringify([genreId])}::jsonb`,
          args.excludeTmdbIds.length
            ? notInArray(movie.tmdbId, args.excludeTmdbIds)
            : undefined,
        ),
      )
      .orderBy(asc(movie.popularity))
      .limit(PER_GENRE_LIMIT);
    for (const row of genreRows) {
      if (seen.has(row.tmdbId)) continue;
      seen.add(row.tmdbId);
      rows.push(row);
    }
  }

  if (rows.length < 150) {
    // mid-popularity fallback slice
    ...
  }

  return rows.slice(0, 450);
}
```

- [ ] **Step 2: Implement social candidate fetch**

```ts
// apps/server/src/lib/taste-social-candidates.ts
import { db, log, movie } from "@still/db";
import { and, desc, eq, inArray, isNotNull, isNull, gte } from "drizzle-orm";

import { contentVisibilityWhere } from "./content-visibility";
import { storedRatingToDisplayTen } from "./sense-taste-overlap";
import type { TasteNeighbor } from "./taste-neighbor-discovery";

const SOCIAL_MIN_RATING_DISPLAY = 7;

export async function fetchSocialCandidates(args: {
  viewerId: string;
  neighbors: TasteNeighbor[];
  excludeTmdbIds: number[];
}): Promise<Map<number, { score: number; row: TasteMatchMovieRow }>> {
  if (args.neighbors.length === 0) return new Map();
  const neighborIds = args.neighbors.map((n) => n.userId);
  const compatById = new Map(args.neighbors.map((n) => [n.userId, n.compatibilityPercent]));

  const rows = await db
    .select({ log, movie })
    .from(log)
    .innerJoin(movie, eq(log.movieId, movie.tmdbId))
    .where(
      and(
        inArray(log.userId, neighborIds),
        isNull(log.removedAt),
        isNotNull(log.movieId),
        args.excludeTmdbIds.length
          ? notInArray(log.movieId, args.excludeTmdbIds)
          : undefined,
        contentVisibilityWhere(args.viewerId, log.userId, log.visibility),
      ),
    )
    .orderBy(desc(log.watchedAt))
    .limit(400);

  const best = new Map<number, { score: number; row: ... }>();
  for (const row of rows) {
    if (row.log.rating == null) continue;
    if (storedRatingToDisplayTen(row.log.rating) < SOCIAL_MIN_RATING_DISPLAY) continue;
    const tmdbId = row.log.movieId!;
    const compat = compatById.get(row.log.userId) ?? 0;
    const socialScore = compat * ratingAffinityWeight(row.log.rating);
    const existing = best.get(tmdbId);
    if (!existing || socialScore > existing.score) {
      best.set(tmdbId, { score: socialScore, row: { tmdbId, title: row.movie!.title, ... } });
    }
  }
  return best;
}
```

Import `ratingAffinityWeight` from `taste-scoring-math.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/lib/taste-stratified-candidates.ts apps/server/src/lib/taste-social-candidates.ts
git commit -m "feat(server): add stratified and social taste candidate fetchers"
```

---

### Task 5: Orchestrator refactor (`taste-matched-discovery.ts`)

**Files:**
- Modify: `apps/server/src/lib/taste-matched-discovery.ts`
- Modify: `apps/server/src/lib/taste-matched-discovery.test.ts`

- [ ] **Step 1: Write pipeline fixture test (pure merge path)**

Add test file section that imports exported pure helper `mergeBlendAndPenalize` (export for testing) with fixture maps — no DB.

Cases:

- Social blend activates at ≥5 social candidates
- Dismiss penalty reorders candidates
- MMR output length ≤ 24

- [ ] **Step 2: Rewrite `scoreTasteMatchCandidatesForUser`**

Replace body with orchestration:

1. Load diary rows (existing query).
2. Cold start gate `< TASTE_MATCH_MIN_LOGS`.
3. `buildWeightedTasteProfile` from slices.
4. Parallel: `fetchDismissedMoviesWithMetadata`, `fetchStratifiedCandidates`, `resolveTasteNeighbors`, `fetchSocialCandidates`.
5. Score solo candidates via `scoreSoloCandidate` + `applyRepeatGenreDownweight`.
6. Normalize solo + social maps; blend 60/40 when social count ≥ 5.
7. `applyDismissSimilarityPenalty` per candidate.
8. Return `{ coldStart: false, genrePhrase, scored: full pool sorted by finalScore }` — **before MMR**.

- [ ] **Step 3: Update `buildTasteMatchedDiscovery`**

Apply `mmrSelectCandidates` on scored pool → slice 24 → min results gate.

- [ ] **Step 4: Verify dismiss path**

`pickNextTasteMatchCandidate` in `taste-dismissed-movie.ts` already uses full `scored` list — no change needed except scores now include dismiss penalties automatically.

- [ ] **Step 5: Run all server taste tests**

Run: `cd apps/server && bun test src/lib/taste-scoring-math.test.ts src/lib/taste-profile.test.ts src/lib/taste-neighbor-discovery.test.ts src/lib/taste-matched-discovery.test.ts src/lib/taste-dismissed-movie.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/lib/taste-matched-discovery.ts apps/server/src/lib/taste-matched-discovery.test.ts
git commit -m "feat(server): social-augmented taste for-you scorer with dismiss learning"
```

---

### Task 6: Analytics instrumentation

**Files:**
- Modify: `apps/server/src/lib/product-event-kinds.ts`
- Modify: `apps/server/src/routes/taste.ts`

- [ ] **Step 1: Register event kind**

```ts
// product-event-kinds.ts — add to PRODUCT_EVENT_KINDS array
"taste.for_you.served",
```

- [ ] **Step 2: Record on successful for-you**

In `taste.ts` `GET /for-you` handler after `buildTasteMatchedDiscovery`:

```ts
const payload = await buildTasteMatchedDiscovery(user.id);
if (!payload.coldStart && payload.movies.length >= TASTE_MATCH_MIN_RESULTS) {
  void recordProductEvent(user.id, "taste.for_you.served", {
    movieCount: payload.movies.length,
    // optional: pass debug counts from buildTasteMatchedDiscovery meta if exported
  });
}
```

Extend `buildTasteMatchedDiscovery` to return internal debug counts via optional second return or `_debug` field stripped before JSON — **prefer private helper return type** `TasteMatchedDiscoveryResult { payload, meta }` where route destructures meta for analytics only.

Meta shape:

```ts
type TasteMatchServeMeta = {
  socialCount: number;
  soloCount: number;
  neighborCount: number;
  nicheBoostApplied: boolean;
  dismissCount: number;
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/lib/product-event-kinds.ts apps/server/src/routes/taste.ts apps/server/src/lib/taste-matched-discovery.ts
git commit -m "feat(server): instrument taste for-you served product event"
```

---

### Task 7: Manual verification + graphify

- [ ] **Step 1: Run full server test suite**

Run: `cd apps/server && bun test`  
Expected: all pass (or no new failures in taste modules)

- [ ] **Step 2: Manual smoke (dev)**

1. Sign in with ≥10 movie logs on `/home?browse=movies`.
2. Confirm For you rail populates.
3. Dismiss one title → replacement differs in genre/decade when possible.
4. Dismiss two titles in same genre cluster → refresh → cluster less dominant in rail.
5. Check server logs / DB `product_event` for `taste.for_you.served`.

- [ ] **Step 3: Update knowledge graph**

Run: `graphify update .` (if CLI available in environment)

- [ ] **Step 4: Final commit if any fixups**

```bash
git commit -m "fix(server): taste v2 scorer fixups from manual verification"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Rating-weighted solo profile | Task 2 |
| Stratified candidate pool | Task 4, 5 |
| Social blend 60/40 | Task 4, 5 |
| Followed → neighbor tiering | Task 3 |
| MMR diversity | Task 1, 5 |
| Dismiss similarity penalty | Task 1, 5 |
| Repeat-genre downweight | Task 2, 5 |
| Dismiss replacement uses full scorer | Task 5 |
| Visibility-safe social logs | Task 4 |
| `taste.for_you.served` event | Task 6 |
| API shape unchanged | Task 5 (no route contract change) |
| Server-only v1 | No web tasks |

## Out of scope (do not implement in this plan)

- TV For you rail
- Per-title patron attribution in UI
- Precomputed neighbor cache
- Settings page for dismissed titles
- Negative reweight beyond spec formulas

---

## Executor notes

- **One task at a time** per scratchpad workflow; human verifies manual smoke after Task 7.
- If stratified SQL `@>` on `genre_ids` is slow in staging, add GIN index follow-up (not v1 unless measured).
- On neighbor fetch failure, catch in orchestrator and continue solo-only — log `[taste-match] neighbor fetch failed`.
