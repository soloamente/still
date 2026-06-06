# Home Catalogue Filters Popover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slider `<Link>` in `HomeCatalogViewModeToolbar` with an in-place filter popover that applies genre, watch type, and sort refinements to the `/home` Movies grid via URL params.

**Architecture:** Pure helpers in `home-catalog-filters.ts` parse/normalize `?genre=` / `?monetization=` / `?discoverSort=` and extend `buildHomeLobbyHref`. The popover reads current `useSearchParams`, builds hrefs, and navigates via `useLobbyNavigation`. `/home` RSC threads filters into seed fetch + `PopularMoviesInfinite` (now-playing switches to discover when `?genre=` is set).

**Tech Stack:** Next.js App Router, React 19, `@still/ui` Popover, Motion, `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-06-06-home-catalog-filters-popover-design.md`](../specs/2026-06-06-home-catalog-filters-popover-design.md)

---

## File structure

**New**
- `apps/web/src/lib/home-catalog-filters.ts` — parse, normalize, active detection, href merge
- `apps/web/src/lib/home-catalog-filters.test.ts` — unit tests
- `apps/web/src/components/home/home-catalog-filters-popover.tsx` — client popover UI

**Modify**
- `apps/web/src/lib/home-lobby-url.ts` — optional filter fields on `buildHomeLobbyHref`
- `apps/web/src/lib/discover-catalog-url.ts` — pass genre/monetization through `discoverPartsToHomeHref`
- `apps/web/src/lib/home-lobby-persist.ts` — include filter params in `homeLobbyHrefFromSearchParams`
- `apps/web/src/lib/home-lobby-cookie.ts` — extend `HomeLobbySearchParams` + cookie parse for filter keys
- `apps/web/src/app/(app)/home/page.tsx` — read filters, adjust seed fetch + infinite props + reset key
- `apps/web/src/components/home/home-catalog-view-mode-toolbar.tsx` — slider → popover trigger (Movies v1)

---

## Task 1: Filter URL helpers (TDD)

**Files:**
- Create: `apps/web/src/lib/home-catalog-filters.ts`
- Create: `apps/web/src/lib/home-catalog-filters.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/src/lib/home-catalog-filters.test.ts
import { describe, expect, test } from "bun:test";

import {
  HOME_CATALOG_FILTER_PARAMS,
  hasActiveHomeCatalogFilters,
  mergeHomeCatalogFiltersIntoHref,
  parseHomeCatalogFilters,
  stripIncompatibleHomeCatalogFilters,
} from "./home-catalog-filters";

describe("parseHomeCatalogFilters", () => {
  test("parses genre and monetization", () => {
    const params = new URLSearchParams(
      "sort=popular&venue=streaming&genre=28&monetization=rent",
    );
    expect(parseHomeCatalogFilters(params, { venue: "streaming", sort: "popular" })).toEqual({
      genreId: 28,
      monetization: "rent",
      discoverSort: null,
    });
  });

  test("strips monetization on theaters venue", () => {
    const params = new URLSearchParams(
      "sort=popular&venue=theaters&genre=28&monetization=rent",
    );
    expect(parseHomeCatalogFilters(params, { venue: "theaters", sort: "popular" })).toEqual({
      genreId: 28,
      monetization: null,
      discoverSort: null,
    });
  });

  test("ignores discoverSort on upcoming sort", () => {
    const params = new URLSearchParams(
      "sort=upcoming&venue=streaming&discoverSort=vote_average.desc",
    );
    expect(parseHomeCatalogFilters(params, { venue: "streaming", sort: "upcoming" })).toEqual({
      genreId: null,
      monetization: null,
      discoverSort: null,
    });
  });
});

describe("hasActiveHomeCatalogFilters", () => {
  test("false when defaults only", () => {
    expect(
      hasActiveHomeCatalogFilters({
        genreId: null,
        monetization: null,
        discoverSort: null,
      }),
    ).toBe(false);
  });

  test("true when genre set", () => {
    expect(
      hasActiveHomeCatalogFilters({
        genreId: 28,
        monetization: null,
        discoverSort: null,
      }),
    ).toBe(true);
  });
});

describe("mergeHomeCatalogFiltersIntoHref", () => {
  test("adds genre to home href", () => {
    const href = mergeHomeCatalogFiltersIntoHref("/home?sort=popular&venue=theaters", {
      genreId: 28,
      monetization: null,
      discoverSort: null,
    });
    expect(href).toContain("genre=28");
  });

  test("clears filters when all null", () => {
    const href = mergeHomeCatalogFiltersIntoHref(
      "/home?sort=popular&venue=theaters&genre=28",
      { genreId: null, monetization: null, discoverSort: null },
    );
    expect(href).not.toContain("genre=");
  });
});

describe("stripIncompatibleHomeCatalogFilters", () => {
  test("drops monetization when switching to theaters", () => {
    expect(
      stripIncompatibleHomeCatalogFilters(
        { genreId: 28, monetization: "rent", discoverSort: "vote_average.desc" },
        { venue: "theaters", sort: "popular" },
      ),
    ).toEqual({
      genreId: 28,
      monetization: null,
      discoverSort: "vote_average.desc",
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/web && bun test src/lib/home-catalog-filters.test.ts
```

- [ ] **Step 3: Implement helpers**

Key exports for `home-catalog-filters.ts`:

```ts
export const HOME_CATALOG_FILTER_PARAMS = {
  genre: "genre",
  monetization: "monetization",
  discoverSort: "discoverSort",
} as const;

export type HomeCatalogFilters = {
  genreId: number | null;
  monetization: string | null;
  discoverSort: string | null;
};

export function parseHomeCatalogFilters(
  params: URLSearchParams,
  context: { venue: "theaters" | "streaming"; sort: "popular" | "latest" | "upcoming" },
): HomeCatalogFilters;

export function hasActiveHomeCatalogFilters(filters: HomeCatalogFilters): boolean;

export function stripIncompatibleHomeCatalogFilters(
  filters: HomeCatalogFilters,
  context: { venue: "theaters" | "streaming"; sort: "popular" | "latest" | "upcoming" },
): HomeCatalogFilters;

export function mergeHomeCatalogFiltersIntoHref(
  baseHref: string,
  filters: HomeCatalogFilters,
): string;
```

Implementation notes:
- Reuse `normalizeDiscoverMonetization` from `discover-catalog-url.ts`.
- Whitelist `discoverSort`: `vote_average.desc`, `original_title.asc`.
- Invalid `genre` (NaN, ≤0) → `null`.
- Default monetization `flatrate` is **not** active (omit from URL).

- [ ] **Step 4: Run tests — expect PASS**

**Acceptance:** All unit tests green; no React imports.

---

## Task 2: Extend `buildHomeLobbyHref`

**Files:**
- Modify: `apps/web/src/lib/home-lobby-url.ts`
- Modify: `apps/web/src/lib/home-catalog-filters.test.ts` (add href builder tests)

- [ ] **Step 1: Add optional filter fields to `buildHomeLobbyHref` input**

```ts
export function buildHomeLobbyHref(input: {
  browse: HomeBrowseSurface;
  sort: HomeCatalogSort | HomeCommunityFeed;
  venue?: HomeVenue;
  run?: HomeCatalogRun | null;
  animeSeason?: boolean;
  period?: HomeLeaderboardPeriod;
  /** Discover refinements — movies v1 */
  genreId?: number | null;
  monetization?: string | null;
  discoverSort?: string | null;
}): string
```

Serialize when non-default:
- `genre` when `genreId` is finite > 0
- `monetization` when normalized and not `flatrate`, and venue ≠ implicit theaters-only path
- `discoverSort` when whitelisted and sort is `popular` or `latest`

- [ ] **Step 2: Add tests for round-trip**

```ts
import { buildHomeLobbyHref } from "./home-lobby-url";

test("buildHomeLobbyHref serializes genre", () => {
  expect(
    buildHomeLobbyHref({
      browse: "movies",
      sort: "popular",
      venue: "theaters",
      genreId: 28,
    }),
  ).toBe("/home?sort=popular&venue=theaters&genre=28");
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && bun test src/lib/home-catalog-filters.test.ts
```

**Acceptance:** Href builder includes filter params; community browse ignores them.

---

## Task 3: Cookie + persist restore

**Files:**
- Modify: `apps/web/src/lib/home-lobby-cookie.ts`
- Modify: `apps/web/src/lib/home-lobby-persist.ts`
- Modify: `apps/web/src/lib/discover-catalog-url.ts`

- [ ] **Step 1: Extend `HomeLobbySearchParams`**

Add optional `genre`, `monetization`, `discoverSort` to type and `parseHomeLobbyHrefCookie`.

Update `isBareHomeLobbySearchParams` — filter-only URLs are **not** bare (treat presence of filter params like sort).

- [ ] **Step 2: Update `homeLobbyHrefFromSearchParams`**

After building base href via `buildHomeLobbyHref`, merge filter params from `URLSearchParams` using `parseHomeCatalogFilters` + extended builder (or append via `mergeHomeCatalogFiltersIntoHref`).

- [ ] **Step 3: Fix `discoverPartsToHomeHref`**

Remove `void parts.genreId` / `void parts.monetization`; pass into `buildHomeLobbyHref`.

- [ ] **Step 4: Manual smoke**

Navigate to `/home?sort=popular&genre=28`, reload bare `/home` — cookie restore should include `genre=28`.

**Acceptance:** Filter params survive cookie mirror used on bare `/home` visits.

---

## Task 4: Wire filters on `/home` page (RSC + grid)

**Files:**
- Modify: `apps/web/src/app/(app)/home/page.tsx`

- [ ] **Step 1: Extend `searchParams` type**

Add optional `genre`, `monetization`, `discoverSort`.

- [ ] **Step 2: Parse filters after venue/sort**

```ts
const catalogFilters = parseHomeCatalogFilters(
  new URLSearchParams(/* merged sp */),
  { venue: movieVenue ?? "theaters", sort },
);
```

- [ ] **Step 3: Adjust seed fetch when `genreId` set**

For `movieLobbyUsesNowPlaying && catalogFilters.genreId`:
- Use `fetchMoviesDiscover` instead of `fetchMoviesNowPlaying`
- Pass `genreId`, `sortBy: catalogFilters.discoverSort ?? "popularity.desc"`, `venue: "theaters"`

For other movie discover paths, pass `genreId: catalogFilters.genreId ?? undefined` and override `sortBy` when `discoverSort` set.

Override `discoverMonetizationForInfinite` when `catalogFilters.monetization` is non-null.

- [ ] **Step 4: Thread to `PopularMoviesInfinite`**

Set `discoverGenreId`, `discoverMonetization`, `discoverSortBy` from parsed filters.

Extend `lobbyCatalogueResetKey`:

```ts
const lobbyCatalogueResetKey = [
  browse,
  sort,
  catalogRun ?? "",
  animeSeasonActive ? "animeSeason" : "",
  movieVenue ?? tvVenue ?? "",
  discoverSortForLobby,
  catalogKindForInfinite,
  catalogFilters.genreId ?? "",
  catalogFilters.monetization ?? "",
  catalogFilters.discoverSort ?? "",
].join("|");
```

- [ ] **Step 5: When genre forces discover on now-playing, set `catalogKindForInfinite` to `"discover"`**

**Acceptance:** `/home?sort=popular&venue=theaters&genre=28` loads filtered grid; infinite scroll pages with same filters.

---

## Task 5: Filter popover component

**Files:**
- Create: `apps/web/src/components/home/home-catalog-filters-popover.tsx`

- [ ] **Step 1: Scaffold client component**

Props:

```ts
export type HomeCatalogFiltersPopoverProps = {
  browse: "movies" | "tv";
  sort: "popular" | "latest" | "upcoming";
  venue: "theaters" | "streaming";
  filters: HomeCatalogFilters;
  summaryLabel: string; // e.g. "Popular · In cinemas"
  onNavigate: (href: string) => void;
  onPrefetch?: (href: string) => void;
};
```

Use `@still/ui/components/popover` (same as `StillPopoverSelect`). Trigger is passed as `children` via render prop or wrap externally.

- [ ] **Step 2: Genre section**

- `useSearchDialogGenres(true, catalogLanguage)` — pass language from `useCatalogTmdbLanguage(true)` or prop from parent.
- Wrap grid of genre pills; tap → `onNavigate(mergeHomeCatalogFiltersIntoHref(currentHref, { ...filters, genreId }))`.
- “All genres” clears `genreId`.

- [ ] **Step 3: Watch type section**

Only when `venue === "streaming"`. Segmented pills: Subscription (`flatrate`), Rent, Buy, Free, Ads.

Omit `monetization` param when Subscription selected (default).

- [ ] **Step 4: Sort refinements**

Only when `sort === "popular" || sort === "latest"`. Pills: Top rated (`vote_average.desc`), A–Z (`original_title.asc`), plus “Default” clears `discoverSort`.

- [ ] **Step 5: Footer**

“Clear filters” when `hasActiveHomeCatalogFilters(filters)` — navigates with all filter fields null.

Panel classes: `bg-popover rounded-xl p-4 w-[min(320px,calc(100vw-2rem))]`, scroll area `max-h-[min(calc(92svh-11rem),640px)] scrollbar-none`, bottom gradient scrim optional.

**Acceptance:** Popover renders three sections per spec; each tap calls `onNavigate` without closing on outside rules from Popover.

---

## Task 6: Integrate into toolbar

**Files:**
- Modify: `apps/web/src/components/home/home-catalog-view-mode-toolbar.tsx`

- [ ] **Step 1: Extract shared filter trigger**

Replace every slider `<Link href={filtersHref}>` (Movies branch + fallback branches that show slider for movies) with:

```tsx
<HomeCatalogFiltersPopover
  browse="movies"
  sort={activeCatalogSort}
  venue={effectiveVenue}
  filters={parsedFiltersFromSearchParams}
  summaryLabel={…}
  onNavigate={(href) => tmdbLobby?.navigate(href) ?? router.push(href)}
  onPrefetch={(href) => tmdbLobby?.prefetchLobby(href)}
>
  <button type="button" aria-label="Catalogue filters" …>
    <IconSlider … />
    {hasActiveHomeCatalogFilters(filters) ? <span className="…accent dot…" /> : null}
  </button>
</HomeCatalogFiltersPopover>
```

Parse filters with `parseHomeCatalogFilters` from current `searchParams` + venue/sort context.

- [ ] **Step 2: TV + diary branches**

**v1:** Keep TV slider as existing `<Link>` (TV filters = v1.1). Diary/watchlist movies path gets popover when on movies context.

- [ ] **Step 3: Strip monetization on venue chip navigate**

When `tmdbLobby.selectVenue("theaters")` or Link to theaters, merge href through `stripIncompatibleHomeCatalogFilters` so rent/buy drops.

Apply in `selectVenue` handler or href builder at call site.

**Acceptance:** On `/home?sort=popular&venue=theaters`, slider opens popover; venue pills still toggle instantly; no navigation to external discover route.

---

## Task 7: Manual QA + typecheck

- [ ] **Step 1: Run tests**

```bash
cd apps/web && bun test src/lib/home-catalog-filters.test.ts
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && bun run check-types
```

- [ ] **Step 3: Manual checklist**

1. Popular · In cinemas → open popover → Action → grid filters, URL `genre=28`, slider dot visible.
2. Clear filters → URL clean, dot gone.
3. At home → Rent → monetization applied; switch In cinemas → monetization stripped.
4. Popular → Top rated → `discoverSort=vote_average.desc`.
5. Upcoming → sort section hidden in popover.
6. `?search=` active → still shows Clear search only (no popover).

- [ ] **Step 4: Update spec status line**

In `2026-06-06-home-catalog-filters-popover-design.md`, add plan link under **Status**.

**Acceptance:** Tests pass; manual flows match spec success criteria.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Slider → popover, venue pills unchanged | 5, 6 |
| URL params genre/monetization/discoverSort | 1, 2 |
| In-place grid update | 4 |
| Now playing + genre → discover | 4 |
| Cookie restore | 3 |
| Clear filters | 5 |
| Committed search hides popover | 6 (existing branch) |
| TV v1.1 deferred | 6 (TV keeps Link) |

---

## Out of scope (do not implement in this plan)

- TV filter popover (v1.1)
- Studio/company filter
- Multi-genre AND
- Bottom sheet mobile variant
