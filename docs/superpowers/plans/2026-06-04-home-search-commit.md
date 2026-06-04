# Home Catalogue Search Commit — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pressing **Enter** in ⌘K on `/home` Movies/TV commits the catalogue query to the URL, closes the dialog, shows a summary on the sticky pill, and replaces the browse grid with paginated search results (same AND semantics as the dialog, no 20-row cap).

**Architecture:** URL (`?browse` + `?search`) is the single source of truth. New pure helpers in `home-catalogue-search-param.ts` serialize/parse using existing `serializeStructuredQuery` / `parseRecentStructuredQuery`. Dialog writes URL on commit; pill reads URL for summary/clear; lobby body branches to a search grid that pages via `PopularMoviesInfinite` + `loadPage` (watchlist pattern) calling `planCatalogueTagSearch` + discover/search fetchers.

**Tech Stack:** Next.js App Router, React 19, Motion, Zustand (dialog open only), `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-06-04-home-search-commit-design.md`](../specs/2026-06-04-home-search-commit-design.md)

---

## File structure

**New**
- `apps/web/src/lib/home-catalogue-search-param.ts` — parse, serialize, `canCommitCatalogueSearch`, summary, build/clear hrefs
- `apps/web/src/lib/home-catalogue-search-param.test.ts` — unit tests
- `apps/web/src/components/home/home-catalogue-search-infinite.tsx` — client grid wrapper + empty state
- `apps/web/src/lib/home-catalogue-search-load-page.ts` — pure `loadCatalogueSearchPage(plan, page)` for tests + grid

**Modify**
- `apps/web/src/lib/still-api-fetch.ts` — add optional `page` to `fetchMoviesSearch` / `fetchTvSearch`
- `apps/web/src/components/home/home-sticky-search.tsx` — Enter commit, pill summary, × clear, hydrate dialog from URL
- `apps/web/src/components/home/home-catalog-sort-chips.tsx` — hide when `search` active
- `apps/web/src/components/home/home-catalog-view-mode-toolbar.tsx` — hide when `search` active
- `apps/web/src/app/(app)/home/page.tsx` — branch grid: search vs browse
- `apps/web/src/lib/home-browse-surface-nav.ts` — strip `search` on Movies/TV/Community rail navigation
- `apps/web/src/lib/home-lobby-url.ts` (if needed) — ensure `search` param passes through `buildHomeLobbyHref` where appropriate

---

## Task 1: URL + commit helpers (TDD)

**Files:**
- Create: `apps/web/src/lib/home-catalogue-search-param.ts`
- Create: `apps/web/src/lib/home-catalogue-search-param.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:
- `canCommitCatalogueSearch` — `lists` tag → false; empty → false; plain text → true; studio/genre/media/curated tag → true
- `serializeHomeCatalogueSearchParam` / `parseHomeCatalogueSearchParam` round-trip (mock studio + genre options)
- `formatCommittedSearchSummary` truncates long queries (~40 chars)
- `buildHomeCatalogueSearchCommitHref({ browse, tags, freeText })` — sets `search`, strips `sort`/`venue`/`run`/`animeSeason`
- `buildHomeCatalogueSearchClearHref(browse, persisted)` — removes `search`, restores movies/tv slot from persist

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/web && bun test src/lib/home-catalogue-search-param.test.ts
```

- [ ] **Step 3: Implement helpers**

Key exports:
```ts
export const HOME_CATALOGUE_SEARCH_PARAM = "search";

export function canCommitCatalogueSearch(tags: SearchTag[], freeText: string): boolean;

export function serializeHomeCatalogueSearchParam(tags: SearchTag[], freeText: string): string;

export function parseHomeCatalogueSearchParam(
  raw: string | null | undefined,
  studios: SearchDialogStudio[],
  options: ParseRecentOptions,
): { tags: SearchTag[]; freeText: string };

export function formatCommittedSearchSummary(tags: SearchTag[], freeText: string, maxLen?: number): string;

export function buildHomeCatalogueSearchCommitHref(input: {
  pathname?: string;
  browse: "movies" | "tv";
  tags: SearchTag[];
  freeText: string;
  currentParams?: URLSearchParams;
}): string;

export function buildHomeCatalogueSearchClearHref(
  browse: "movies" | "tv",
  persisted?: HomeLobbyPersisted | null,
): string;

export function resolveCommitBrowseFromDraft(
  tags: SearchTag[],
  listingKind: "movie" | "tv",
): "movies" | "tv";
```

Reuse `serializeStructuredQuery`, `parseRecentStructuredQuery`, `buildHomeHrefFromPersisted`.

- [ ] **Step 4: Run tests — expect PASS**

**Acceptance:** All unit tests green; no React imports in param module.

---

## Task 2: Search API pagination (fetch layer)

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: Add optional `page` to `fetchMoviesSearch` and `fetchTvSearch`**

Mirror `fetchMoviesDiscover` — `url.searchParams.set("page", String(page))` when `page >= 1`.

- [ ] **Step 2: Smoke test manually or add a tiny fetch test stub if repo pattern exists**

Server already supports `?page=` on `/api/movies/search` and `/api/tv/search`.

**Acceptance:** Client can request page 2+ for text search mode.

---

## Task 3: Paginated search loader (TDD)

**Files:**
- Create: `apps/web/src/lib/home-catalogue-search-load-page.ts`
- Create: `apps/web/src/lib/home-catalogue-search-load-page.test.ts` (mock fetch or plan-only tests)

- [ ] **Step 1: Implement `loadCatalogueSearchPage(plan, page, signal)`**

Input: output of `planCatalogueTagSearch` + 1-based page.

Branches:
- `discover` → `fetchMoviesDiscover(page, opts)` / `fetchTvDiscover(page, opts)`
- `search` → `fetchMoviesSearch(q, { page, companyId })` / `fetchTvSearch(...)`
- `none` → empty page

Map rows to `PopularMovieSeed` shape (id, title, poster_url, release_date / first_air_date).

- [ ] **Step 2: Unit test plan routing** (discover vs search vs none) with mocked fetch or by testing a thin `catalogueSearchPlanKey` + exported branch labels.

**Acceptance:** Page loader returns `{ results, total_pages }` compatible with `PopularMoviesInfinite` `loadPage` contract.

---

## Task 4: Search results grid component

**Files:**
- Create: `apps/web/src/components/home/home-catalogue-search-infinite.tsx`

- [ ] **Step 1: Client component reads URL**

`useSearchParams` → `parseHomeCatalogueSearchParam` (needs genres/studios — use `useSearchDialogStudios` + `useSearchDialogGenres` like dialog).

- [ ] **Step 2: Build plan via `deriveCatalogueFilterBundle` + `planCatalogueTagSearch`**

- [ ] **Step 3: Render `PopularMoviesInfinite` with `loadPage`**

Reuse lobby grid class names from `HOME_LOBBY_CATALOGUE_*` constants; `catalogueRadialSurface="home"`; `staggerPosterEntrance`; signed-in radial actions parity.

- [ ] **Step 4: Empty + error states**

Centered empty: “No films found for {summary}” + button calling clear href (`router.replace`).

Optional muted row: “Search results” + text link “Clear search”.

- [ ] **Step 5: `key` on grid** — `${browse}:${serializedSearch}` so URL changes reset scroll/items.

**Acceptance:** With `?browse=movies&search=interstellar`, grid loads and scroll-loads more pages.

---

## Task 5: Home page branch + hide browse chips

**Files:**
- Modify: `apps/web/src/app/(app)/home/page.tsx`
- Modify: `apps/web/src/components/home/home-catalog-sort-chips.tsx`
- Modify: `apps/web/src/components/home/home-catalog-view-mode-toolbar.tsx`

- [ ] **Step 1: Shared hook or inline check**

`const catalogueSearchRaw = searchParams.get("search")` — active when non-empty AND `browse` is `movies` | `tv` (default movies).

- [ ] **Step 2: In TMDB lobby branch, swap grid**

```tsx
{catalogueSearchActive ? (
  <HomeCatalogueSearchInfinite ... />
) : (
  <PopularMoviesInfinite ...existing props... />
)}
```

- [ ] **Step 3: Sort chips + venue/run toolbar return `null` when search active**

Guard at top of component: read `useSearchParams().get("search")` + browse surface.

**Acceptance:** Active search hides Latest/Popular/venue chips; browse grid returns when `search` removed.

---

## Task 6: Dialog Enter → commit URL + close

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1: Replace `handleFormSubmit` body**

When `canCommitCatalogueSearch(searchTags, freeText)`:
1. `submitQuery()` (recents — existing)
2. `browse = resolveCommitBrowseFromDraft(searchTags, effectiveListingKind)`
3. `href = buildHomeCatalogueSearchCommitHref({ browse, tags, freeText, currentParams })`
4. If pathname !== `/home` or needs browse fix → `router.push(href)` else `router.replace(href, { scroll: false })`
5. `beginClose()`

Else: keep existing `submitQuery()` only (lists, empty, people-only).

- [ ] **Step 2: On dialog open, hydrate from URL**

In `openDialogFromRect` / `requestOpen` path: if URL has `search` and patron didn't pass explicit anchor click payload, parse URL into `searchTags` + `freeText` before showing sheet.

- [ ] **Step 3: Do not clear tags on `onClose` before navigation completes** — ensure committed state lives in URL; dialog ephemeral state reset on close is OK because pill/grid read URL.

**Acceptance:** Enter with `A24 · horror · neon` closes dialog and updates address bar; grid switches without full reload.

---

## Task 7: Pill summary + clear control

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-search.tsx` (`HomeStickySearch`)

- [ ] **Step 1: Read `search` param on `/home`**

When active: show `formatCommittedSearchSummary(...)` in foreground; hide placeholder.

- [ ] **Step 2: Trailing × button**

`stopPropagation` on mousedown/click; `router.replace(buildHomeCatalogueSearchClearHref(...))`; `aria-label="Clear search"`.

- [ ] **Step 3: Pill click still opens dialog** — dialog hydrates from URL (Task 6).

**Acceptance:** Committed query visible on pill; × restores browse chips and placeholder.

---

## Task 8: Browse rail clears search

**Files:**
- Modify: `apps/web/src/lib/home-browse-surface-nav.ts`
- Modify: `apps/web/src/components/home/home-browse-surface-context.tsx` (if href built there too)

- [ ] **Step 1: When building Movies/TV/Community href from `/home`, delete `search` param**

Community: always strip `search`. Movies/TV: strip `search` and restore persist sort/venue/run for target surface (reuse `buildHomeHrefFromPersisted` when switching from community or when clearing search).

- [ ] **Step 2: Add test in `home-browse-surface-nav.test.ts`**

Navigating movies → tv removes `search` if present (or only when changing rail — spec says clear on Movies/TV tap).

**Acceptance:** Tapping Movies or TV browse pill exits search mode.

---

## Checkpoint: Integration (after Tasks 1–8)

- [ ] `cd apps/web && bun test src/lib/home-catalogue-search-param.test.ts src/lib/home-catalogue-search-load-page.test.ts`
- [ ] `cd apps/web && bun run build` (or `check-types`)
- [ ] Manual smoke (spec checklist):
  1. Enter commits tags + text, dialog closes, pill summary, chips hidden
  2. Refresh preserves state
  3. Share URL works in new tab
  4. Back button restores browse grid
  5. × clear works
  6. Lists tag + Enter does not commit
  7. `@handle` only + Enter does not commit
  8. TV Anime commit → `browse=tv`
  9. Community ignores `search`

**Human verification:** Patron confirms on `/home` before marking complete.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Genre/studio parse needs live TMDb lists | Same hooks as dialog; show skeleton until genres/studios ready |
| `fetchMoviesSearch` without page broke infinite text search | Task 2 adds page param |
| Dialog closes before URL updates | Use `flushSync` + `router.replace` before `beginClose`, or pass pending commit ref |
| Company + text search pagination odd (server merges/slices) | Accept v1 behavior; document if page 2 duplicates — match dialog semantics first |
| Commit from `/diary` etc. | Spec: navigate to `/home?browse=…&search=…` |

---

## Out of scope (do not implement)

- Diary / watchlist / lists commit
- Inline editable headbar tokens
- Community search grid
- SEO for search URLs

---

## Success criteria (from spec)

- [ ] Enter commits catalogue drafts on `/home` movies/tv, closes dialog, updates pill summary
- [ ] Grid paginates beyond 20 results with same AND semantics as dialog
- [ ] URL encodes full commit; refresh and share work
- [ ] Sort/venue/run hidden while search active; restored on clear
- [ ] Lists and People-only drafts do not commit on Enter
