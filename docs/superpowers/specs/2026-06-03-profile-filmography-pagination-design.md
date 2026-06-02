# Profile filmography — server pagination + infinite scroll

**Date:** 2026-06-03
**Status:** Approved (design)

## Problem

`/profile/:handle` is slow to open because it loads the patron's **entire
filmography in one shot**. `GET /api/profiles/:handle` returns up to
`PROFILE_WATCH_LEDGER_LIMIT = 500` log rows (each joined with its movie/tv),
bundled alongside reviews/lists/badges
([profiles.ts:697-752](../../../apps/server/src/routes/profiles.ts)). The client
([profile-lobby-catalogue.tsx](../../../apps/web/src/components/profile/profile-lobby-catalogue.tsx))
renders all of it at once via `PopularMoviesInfinite` with `staticCatalogue` /
`totalPages={1}`. So both the payload/query and the render are heavy.

Fix: paginate the filmography server-side and load more on scroll, mirroring the
`/watchlist` and `/home` infinite-scroll pattern.

## Goals

- First paint shows only a small first page (~48) of the active view; the rest
  load on scroll.
- Preserve all current filmography behaviour: dedup (one row per title, newest
  log), the movies/tv tabs, order (latest/earliest/title), venue
  (theaters/streaming, legacy logs match all), favorites-only, the title-count
  line, tab availability, and the two empty-state hints
  (`hasLogsOtherVenue`, `hasRowsWhenFavoritesOff`).
- Works for any profile (not just the viewer's own), with content-visibility and
  private-profile access applied.

## Non-goals

- No change to reviews/lists/badges/achievements panels (already small).
- No change to the profile header, taste, or milestones.
- No streaming refactor of the non-filmography parts of the page.

## Background / current behaviour

- **Dedup:** `filmographyFromRecentlyWatched` keeps the newest log per title
  (key `m:<tmdbId>` / `t:<tmdbId>`), then sorts.
- **Order tokens** (`profile-lobby-order.ts`, reuse diary): `latest_seen`,
  `earliest_seen`, `title_az`; URL param `order=latest|earliest|title`.
- **Venue** (`?venue=theaters|streaming`): a kept log matches when its
  `watchVenue` equals the venue **or** is legacy/unset (matches both).
- **Favorites** (`?favorites=1`): kept log `liked === true`.
- **Media tabs** (`?tab=movies|tv`): `movie != null` / `tv != null`.
- Order/venue/favorites/tab are **URL-driven** (`buildProfileLobbyHref`), so
  changing any of them already navigates — same model as watchlist's chips.
- The shell derives, client-side from the 500 rows: the deduped+sorted ledger,
  venue-filtered rows, favorites-filtered rows, movies/tv splits, and counts:
  - `moviesAll`/`tvAll` (venue-independent distinct) → tab availability +
    `hasLogsOtherVenue`.
  - `moviesVenueAll`/`tvVenueAll` (current venue, favorites-off) →
    `hasRowsWhenFavoritesOff`.
  - `movieRows.length`/`tvRows.length` (current view) → title-count line.
  - `likedFilmographyCount` (page.tsx) → favorites tab availability.

## Design

### 1. New endpoint — `GET /api/profiles/:handle/filmography`

Query params:
- `media` — `movie` | `tv` (default `movie`).
- `order` — `latest` | `earliest` | `title` (default `latest`).
- `venue` — `theaters` | `streaming` (optional; omitted = all venues).
- `favorites` — `1` (optional).
- `page` — default `1`.
- `limit` — default `48`, max `96`.

Access/visibility: resolve `handle → targetUserId`; apply the **same access rule
as `GET /:handle`** (private profile → 404 for non-permitted viewers) and
`contentVisibilityWhere(viewerId, log.userId, log.visibility)` on logs.

Query shape (movies example; tv symmetric on `tv_id`/`tv`):

```sql
SELECT * FROM (
  SELECT DISTINCT ON (l.movie_id) l.*, m.tmdb_id, m.title, m.poster_path
  FROM log l
  JOIN movie m ON l.movie_id = m.tmdb_id
  WHERE l.user_id = :target AND l.movie_id IS NOT NULL AND <visibility>
  ORDER BY l.movie_id, l.watched_at DESC          -- newest log per title
) t
WHERE (:venue IS NULL OR t.watch_venue = :venue OR t.watch_venue NOT IN ('theaters','streaming'))
  AND (:favorites = false OR t.liked = true)
ORDER BY <order>                                   -- watched_at desc|asc | title
LIMIT :limit OFFSET :offset
```

- `<order>`: `latest` → `watched_at DESC`; `earliest` → `watched_at ASC`;
  `title` → `title ASC`. All end with a deterministic tiebreaker (`tmdb_id`).
- `total_results` = `COUNT(*)` over the same filtered/deduped set (no limit).
- `total_pages` = `ceil(total_results / limit)`.

Response:

```jsonc
{
  "results": [ /* ProfileFilmographyRow: { log, movie, tv } */ ],
  "total_pages": 0,
  "total_results": 0,
  "venueCounts": { "movies": 0, "tv": 0 }  // distinct titles in the requested venue, favorites-off, per media
}
```

`venueCounts` powers `hasRowsWhenFavoritesOff` (the active media's value vs the
current-view length) without shipping rows. It is computed from the same dedup
subquery with the venue filter applied and favorites off.

Implementation notes:
- Use Drizzle `selectDistinctOn` (or a `sql` subquery) for `DISTINCT ON`.
- The favorites/venue filters and the outer ORDER BY operate on the deduped
  subquery, matching the client's dedup-then-filter order exactly.

### 2. Profile payload swap — `GET /api/profiles/:handle`

Replace `recentlyWatched: recent` (the 500-row join) with:

```jsonc
"filmographyCounts": { "movies": 0, "tv": 0, "likedMovies": 0, "likedTv": 0 }
```

- `movies`/`tv` = distinct titles logged (venue-independent, visibility applied)
  → tab availability + `hasLogsOtherVenue` (`moviesAll`/`tvAll`).
- `likedMovies`/`likedTv` = distinct titles whose **newest** log is liked →
  favorites tab availability + the page.tsx favorites redirect logic.
- Computed via `COUNT(*)` over the dedup subquery with the relevant filter
  (4 cheap aggregates). The heavy 500-row join is removed.

### 3. Profile page (`page.tsx`)

- Read `tab`/`order`/`venue`/`favorites` from `searchParams`; derive the active
  media (`movies`|`tv`) from tab + `filmographyCounts` (same logic as today, but
  off counts instead of row arrays).
- Fetch **page 1 of the active view** server-side via the new endpoint, in
  parallel with the profile payload.
- Pass to the shell: `seeds` (page 1), `totalPages`, `totalResults`,
  `venueCounts`, `filmographyCounts`, plus existing meta.
- Keep the existing `favorites` → ledger-tab redirect, driven by
  `filmographyCounts` (liked > 0).

### 4. Shell + panels rewire

- `ProfilePatronLobbyShell` / `ProfilePatronLobbyBody`: remove the client-side
  `prepareProfileFilmography` / venue filter / favorites filter / split. Consume
  `seeds` + counts instead.
- Grid: `ProfileLobbyCatalogue` renders `PopularMoviesInfinite` **without**
  `staticCatalogue`; pass `seedMovies={seeds}`, `totalPages`, `totalResults`,
  `loadPage`, and a `getDedupeKey` of `` `${listingKind}:${id}` ``. `loadPage`
  calls a new `fetchProfileFilmography(handle, page, {media,order,venue,favorites})`.
- Cell keys: derive from the seed (`${listingKind}:${id}`), not a precomputed
  index array (so appended pages stay stable) — same change watchlist made.
- `ProfileTabPanels` empty-state hints:
  - `hasLogsOtherVenue` = `filmographyCounts[media] > 0 && total_results === 0`.
  - `hasRowsWhenFavoritesOff` = `favoritesOnly && venueCounts[media] > 0 && total_results === 0`.
- `ProfileLobbyParamsProvider` / `resolveProfileTab`: pick the default tab from
  `filmographyCounts` (movies>0 ? movies : tv>0 ? tv : first social tab) instead
  of row arrays.
- Order/venue/favorites/tab changes navigate (existing `buildProfileLobbyHref`),
  so the RSC reseeds page 1 in the new view; `PopularMoviesInfinite` resets via a
  `catalogueWaveKeyOverride` that includes `tab:order:venue:favorites`.

### 5. Client + server fetchers

- `fetchProfileFilmography(handle, page, opts)` in `still-api-fetch.ts` (client
  load-more) → `{ results: PopularMovieSeed[]; total_pages } | { error: true }`,
  mapping rows → seeds (reuse `profileWatchedRowsToPersonFilmography` →
  `personRowToSeed`, or a row→seed mapper).
- `fetchProfileFilmographyServer(handle, opts)` (RSC, page 1) →
  `{ seeds, totalPages, totalResults, venueCounts }`.

### 6. Pure helpers + tests

- Parsing/clamping is unit-tested (`bun:test`): page/limit/offset/total_pages
  (reuse or generalize the watchlist `*-query-args` helpers) and
  media/order/venue/favorites parsing.
- The dedup/order SQL is not unit-testable here (no DB harness) → covered by
  typecheck + manual verification.

### 7. Verification

- Server + web typecheck clean; pure-helper tests pass.
- Manual: open a profile with a large filmography — first page paints fast,
  scrolling loads more; switch movies/tv tabs, order, venue, and favorites and
  confirm each reseeds correctly; confirm tab availability, title-count line,
  and both empty-state hints still behave; confirm another user's private/
  visibility-limited profile shows only permitted logs.

## Files touched (anticipated)

**Server**
- `apps/server/src/routes/profiles.ts` — new `/:handle/filmography` route;
  swap `recentlyWatched` → `filmographyCounts` in `GET /:handle`.
- `apps/server/src/lib/profile-filmography-query.ts` (new) — pure query-arg
  helpers (+ test) and the dedup/order/count query builders.

**Web**
- `apps/web/src/lib/still-api-fetch.ts` — `fetchProfileFilmography`.
- `apps/web/src/lib/fetch-profile-filmography-server.ts` (new) — RSC page-1 +
  counts helper.
- `apps/web/src/app/(app)/profile/[handle]/page.tsx` — seed page 1 + counts.
- `apps/web/src/components/profile/profile-patron-lobby-shell.tsx` — consume
  seeds + counts; drop client derivation.
- `apps/web/src/components/profile/profile-lobby-catalogue.tsx` — `loadPage` +
  `getDedupeKey`, drop `staticCatalogue`.
- `apps/web/src/components/profile/profile-tab-panels.tsx` — hints from counts.
- `apps/web/src/components/profile/profile-lobby-params-context.tsx` +
  `apps/web/src/lib/profile-lobby-derive.ts` — tab resolution from counts.
- `apps/web/src/lib/profile-lobby-order.ts` — keep parsing helpers; client-side
  sort/filter helpers become unused → prune what's no longer referenced.

## Risks / trade-offs

- The shell currently does heavy client derivation; moving it server-side is the
  bulk of the work and touches several profile components. Mitigated by mirroring
  the proven watchlist pattern and keeping `ProfileFilmographyRow` shape stable.
- `DISTINCT ON` + outer filter/order/paginate must exactly match the client's
  dedup-then-filter semantics (newest log per title; legacy venue matches all;
  favorite = newest log liked). Captured in §1.
- Counts add a few aggregate queries to the profile payload, but remove the
  500-row join — net lighter.
