# Watchlist — stream + infinite scroll

**Date:** 2026-06-02
**Status:** Approved (design)

## Problem

`/watchlist` is slow to load **every time** it is opened. The page is
`force-dynamic` (no caching), so each visit blocks on the full DB fetch before
rendering anything — including the page header — and then renders every saved
poster at once. The list is already capped at 60 items, yet still feels heavy,
because:

1. The page **waits** for the whole watchlist fetch before painting any UI.
2. It renders all posters in one pass.

The fixed Neon round-trip latency (DB in Frankfurt) is paid regardless of page
size, so the biggest perceived win is letting the page shell paint immediately
while the list streams in — combined with fetching a smaller first page and
loading the rest on scroll, mirroring the home page's infinite-scroll feel.

## Goals

- Page shell (sticky chrome + order-chip rail) paints instantly.
- First ~24 saved titles stream in quickly; the rest load on scroll.
- Behaviour matches the home page's infinite scroll, adapted to a personal list.
- Sort chips behave identically to today (no visible change).
- Preserve the "hide watched" behaviour shipped previously (logged titles do not
  appear on the watchlist, non-destructively).

## Non-goals

- No change to the empty-state card.
- No change to the detail-page "Saved" button semantics (a logged title stays
  saved in the DB, just hidden from this lobby).
- No client-side virtualization (render windowing) — out of scope.

## Background

The home page's infinite scroll (`PopularMoviesInfinite`) pages through **TMDb
public catalogs** (`fetchMoviesPopular(page)`, etc.) — fixed, server-paginated
endpoints. The watchlist is a **personal DB list**, so the shared component's
"load more" cannot page it today; that is why watchlist (and diary) run in
`staticCatalogue` mode (fetch everything once, render it all).

Order is URL-driven: the chips call `navigate("/watchlist?order=…")` with
optimistic feedback (`useOptimisticLobbyParam`), so the server can read `order`
from `searchParams` and seed page 1 in the correct order.

## Design

### 1. Server — `GET /api/watchlist` becomes paginated + sorted

New query params:

- `page` — default `1`.
- `limit` — default `24`, max `60`.
- `order` — `latest_added` | `earliest_added` | `title_az`, default
  `latest_added`.

Sorting moves server-side (currently done client-side over all rows):

- `latest_added` → `addedAt DESC`
- `earliest_added` → `addedAt ASC`
- `title_az` → `COALESCE(movie.title, tv.title) ASC`

Each `ORDER BY` ends with a deterministic tiebreaker
(`addedAt DESC, COALESCE(movieId, tvId)`) so pages never overlap or skip.

Pagination: `LIMIT limit OFFSET (page - 1) * limit`.

Response envelope (mirrors the page shape the infinite-scroll component already
understands):

```jsonc
{
  "results": [ /* WatchlistRow: { item, movie, tv } */ ],
  "total_pages": 0,
  "total_results": 0
}
```

`total_pages` / `total_results` come from one `COUNT(*)` with the same filter
(cheap over a personal, bounded, indexed list).

### 2. The "hide watched" filter moves into SQL

The in-app `filterUnseenWatchlistRows` helper cannot paginate correctly —
`OFFSET`/`LIMIT` must apply **after** filtering, at the DB. The seen-filter
becomes a clause in the query:

```sql
NOT EXISTS (
  SELECT 1 FROM log
  WHERE log.user_id = :userId
    AND (
      (wl.movie_id IS NOT NULL AND log.movie_id = wl.movie_id)
      OR (wl.tv_id IS NOT NULL AND log.tv_id = wl.tv_id)
    )
)
```

Consequences:

- **Delete** `apps/server/src/lib/watchlist-seen-filter.ts` and its test —
  SQL becomes the single source of truth.
- This removes the previous task's unit test for the hide rule. The rule is
  simple and now lives in one query; there is no DB harness to re-cover it at the
  route level. The order/offset math (section 6) is unit-tested instead.

### 3. Client — extend the shared `PopularMoviesInfinite`

Two optional, additive props (home is unaffected — it passes neither):

- `loadPage?: (page: number) => Promise<{ results: PopularMovieSeed[]; total_pages: number } | { error: true }>`
  — when provided, `loadMore` calls this instead of the TMDb `switch`. All other
  behaviour (IntersectionObserver, sentinel, stagger, footer states) is reused
  untouched.
- `getDedupeKey?: (m: PopularMovieSeed) => string` (default `String(m.id)`). The
  current merge dedupes by raw `id`, which would wrongly collapse a film and a
  show that share a TMDb id (the watchlist is a mixed movie+tv grid). Watchlist
  passes `` (m) => `${m.listingKind ?? "movie"}:${m.id}` ``.

### 4. Client — watchlist shell + page

- **New fetcher** `fetchMyWatchlist(page, { order })` in `still-api-fetch.ts`,
  returning `{ results: PopularMovieSeed[]; total_pages: number }` (maps rows →
  `PopularMovieSeed` via the existing `watchlistRowToPopularSeed`).
- **Cell keys**: today they are a precomputed index array
  (`posterCellKeys[index]`) that does not extend past the seeded first page.
  Derive the key from the seed itself (`${listingKind}:${id}`) so appended pages
  stay stable and unique. This drops the `posterCellKeys` prop plumbing.
- **`WatchlistLobbyCatalogue`** stops passing `staticCatalogue`; instead passes
  `seedPage={1}`, `totalPages`/`totalResults` from the SSR envelope, `loadPage`,
  and `getDedupeKey`.
- **Streaming**: in `watchlist/page.tsx`, the data fetch moves into an async
  child rendered inside `<Suspense fallback={skeleton}>`. The sticky chrome and
  order-chip rail render instantly; only the poster grid streams in. The page
  reads `searchParams.order` to fetch page 1 in the correct order. Changing a
  chip → URL change → RSC re-seeds page 1 → client resets (the component's
  `waveKey` already includes `order` via `catalogueWaveKeyOverride`).

### 5. Semantics & edge cases

- **Order changes** reset to page 1 (server-seeded); the client pages forward.
- **Exhaustion**: a short page (`results.length < limit`) or `page > total_pages`
  flips the footer to "exhausted" — the component's existing logic.
- **Empty watchlist**: unchanged empty-state card.
- **Detail-page "Saved" button**: unchanged — logged items stay saved, just
  hidden from this lobby.

### 6. Testing

- Extract pure helpers and cover with `bun:test`:
  - order → `ORDER BY` mapping (sort column + direction + tiebreaker).
  - page → offset and exhaustion math (`offset`, short-page detection).
- The raw SQL is not unit-testable here (no DB harness), consistent with the rest
  of the route layer.
- Manual verification: open `/watchlist` (header paints immediately, first ~24
  stream in), scroll (more load), switch each sort chip, confirm a logged title
  is absent.

## Files touched (anticipated)

- `apps/server/src/routes/watchlist.ts` — paginated/sorted GET + SQL seen-filter.
- `apps/server/src/lib/watchlist-seen-filter.ts` + `.test.ts` — **deleted**.
- New: small pure query-args/order helper + test (server or shared lib).
- `apps/web/src/lib/still-api-fetch.ts` — `fetchMyWatchlist`.
- `apps/web/src/components/movie/popular-movies-infinite.tsx` — `loadPage` +
  `getDedupeKey` injections.
- `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx` — wire
  pager, drop `staticCatalogue` + `posterCellKeys`.
- `apps/web/src/components/watchlist/watchlist-patron-lobby-shell.tsx` — derive
  cell keys from seeds; pass envelope meta.
- `apps/web/src/app/(app)/watchlist/page.tsx` — Suspense streaming, read
  `searchParams.order`, fetch page 1 only.
- `apps/web/src/lib/watchlist-lobby-order.ts` — server-side ordering may make
  some client sort code redundant; prune as appropriate.
```
