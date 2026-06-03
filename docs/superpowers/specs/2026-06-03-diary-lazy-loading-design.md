# Diary lazy-loading + latest-seen ordering fix

**Date:** 2026-06-03
**Status:** Approved (design)

## Problem

The `/diary` page loads everything at once and some entries appear out of order:

1. **Slow load.** `diary/page.tsx` calls `fetchMyLogsMeServer` → `GET /api/logs/me`, which
   pulls **up to 500 logs in a single query**, serializes them all into the RSC payload, and
   hands the full set to the client. The client (`DiaryPatronLobbyShell`) then filters,
   sorts, groups, and renders **every cell at once** via `DiaryLobbyGrid` (with a staggered
   mount animation). Both the payload and the all-at-once mount make the page feel heavy.

2. **Wrong "latest seen" order.** Every diary query orders by `desc(log.watchedAt)` **only**.
   Date-only diary entries all land at midnight, so logs sharing a `watched_at` come back in
   arbitrary database order. The client comparators (`compareDiaryLobbyRows`,
   `compareGridItems`) also return `0` on those ties, so a stable sort just preserves the
   arbitrary server order — "Latest seen" looks scrambled among same-day entries.

## Goal

Make `/diary` lazy-load page-by-page on scroll, exactly like `/watchlist` and the profile
filmography grid, and give "Latest seen" (and the other orders) a deterministic order.

Non-goals: redesigning the diary grid visuals, the flip-card interaction, or the chip set.

## Precedent

The **profile filmography** endpoint (`GET /api/profiles/:handle/filmography`, see
`apps/server/src/routes/profiles.ts`) is the model: a personal ledger that dedupes,
venue-filters, orders, paginates, and returns counts **server-side**, fed into
`PopularMoviesInfinite` via a `loadPage` callback (`profile-lobby-catalogue.tsx`,
`profile-filmography-fetch.ts`). `/watchlist` follows the same shape
(`watchlist-lobby-catalogue.tsx`, `fetchMyWatchlist`).

The diary maps onto this cleanly because each diary tab is already **single-media** (Movies
*or* TV, via `?tab=`), just like profile's `?media=`. The diary chips already drive the URL
(`useLobbyTransition` → `router.replace` inside a transition) and the page is
`force-dynamic`, so changing a chip already re-runs the server component — today the server
ignores `order`/`venue`/`tab` and ships all 500 rows. This design makes the server honor
them.

## Design

### 1. Server — `GET /api/logs/me/diary` (new, paginated, grid-shaped)

New endpoint in `apps/server/src/routes/logs.ts`, modeled on the filmography handler.

**Query params:** `media` (`movie` | `tv`), `order` (`latest` | `earliest` | `title`),
`venue` (`theaters` | `streaming`, optional), `page`, `limit` (default/clamped to **36**).

**Movies (`media=movie`):** one row **per log** — rewatches stay separate cells (diary
behavior; *not* deduped the way filmography is). Join `movie`, filter by venue, order, and
paginate with offset.

**TV (`media=tv`):** `DISTINCT ON (tv_id)` newest log per show (filmography pattern), joined
to `tv`. Additionally return:
- `logCount` per show (for the "N diary entries" caption), and
- the **primary scope label fields** (most-specific scope across the show's logs:
  episode → season → show) so the front-face caption matches today's
  `pickPrimaryTvScopeLabel` output without shipping every log. Computed via aggregate over
  the show's logs.

**Venue filter:** rows whose `watch_venue` is legacy/unset match **both** slices (preserves
`diaryLogMatchesDiaryLobbyVenue`). Filter applied on the kept row.

**Ordering (with deterministic tiebreak — see §2):**
- `latest`  → `desc(watchedAt), desc(createdAt), desc(id)`
- `earliest`→ `asc(watchedAt), asc(createdAt), asc(id)`
- `title`   → `asc(title), desc(watchedAt), desc(id)`

For TV, the order key is the show's anchor log (newest for `latest`/`title`, oldest for
`earliest`).

**Response:**
```jsonc
{
  "results": [ /* grid-ready rows: { log, movie|tv, logCount?, primaryScope? } */ ],
  "total_pages": 7,
  "total_results": 241,
  "tabCounts": { "movies": 180, "tv": 61 } // venue-independent; drives tab defaults + empty states
}
```

`tabCounts` is independent of the active venue so `resolveDiaryLedgerTab` defaults and the
"your films are on the other tab" empty state keep working.

**Cleanup:** the old `GET /api/logs/me` route and `fetchMyLogsMeServer` are removed — the
diary page is their only caller. `GET /api/logs/me/by-tv/:tvId` and `.../by-movie/:movieId`
stay (used by detail pages and the new lazy TV expand).

### 2. Ordering bug fix

Add a deterministic tiebreaker so equal `watched_at` values resolve consistently:

- **Server:** append `desc(createdAt), desc(id)` (asc variants for `earliest`) to the diary
  endpoint's `orderBy`. Also patch the existing `/recent` and `/by-user/:userId` queries for
  consistency (same scrambled-order symptom on shared profiles/community).
- **Client:** `compareDiaryLobbyRows` and `compareGridItems` (in `diary-lobby-order.ts` /
  `diary-lobby-grouping.ts`) gain the same `createdAt` then `id` tiebreak, so any residual
  client-side sorting agrees with the server. (`DiaryLogRow.log` must surface `createdAt`;
  add it to the row type / endpoint projection.)

`log.createdAt` already exists (`packages/db/src/schema/activity.ts`); `id` is a time-ordered
cuid, a safe final tiebreak.

### 3. Client — `DiaryLobbyInfinite`

A diary counterpart to `WatchlistLobbyCatalogue` / `ProfileLobbyCatalogue`.

- Owns the infinite-scroll mechanics: seed page 1 from RSC, IntersectionObserver sentinel
  (~280px rootMargin), `loadPage` on scroll, cross-page dedupe by stable cell key, footer
  states (`idle`/`loading`/`exhausted`/`error`) — the same proven pattern as
  `PopularMoviesInfinite`.
- Renders **diary cells**, not flat posters: movie tiles (`CataloguePosterTile`,
  `surface="diary"`) and `DiaryTvGroupCell`, preserving expand state, the
  monochrome-peers-on-hover grid, and `priority` on the first row.
- Each fetched row → exactly one cell. No cross-page grouping is needed because the server
  already returns one row per TV show globally.

**Pager reuse decision:** keep `DiaryLobbyInfinite` self-contained (copy the small, proven
sentinel/observer loop) rather than refactoring the shared `PopularMoviesInfinite`, to avoid
regressions on home/watchlist/profile. Extracting a shared `useInfinitePager` hook is a
reasonable later cleanup — flagged, not done here.

**`loadPage`:** new `fetchMyDiary(page, { media, order, venue })` in `still-api-fetch.ts`,
mirroring `fetchMyWatchlist` / `fetchProfileFilmography` (returns
`{ results, total_pages } | { error: true }`, maps endpoint rows → diary grid rows).

### 4. TV expand — lazy on flip

`DiaryTvGroupCell` changes from "receives all `logs`" to "receives the newest log +
`logCount` + `primaryScope`":

- Front face renders the poster, primary scope caption, and "N diary entries" from the
  passed-in summary — no behavior change visible.
- On the **first flip** to the back face, fetch the show's full entry list via the existing
  `GET /api/logs/me/by-tv/:tvId` (`fetchMyTvLogs`), show a small loading state, then render
  the entry rows. Cache the result on the cell so re-flips are instant.
- The "Add diary entry" / "Open series" footer actions are unchanged.

### 5. Page + shell wiring

- `diary/page.tsx` becomes a streamed RSC like `watchlist/page.tsx`: read `searchParams`
  (`tab`/`order`/`venue`), seed page 1 via the new endpoint for that media/order/venue,
  render `DiaryLobbyInfinite` inside `<Suspense>` with a poster-grid fallback. Sticky chrome
  streams separately (reuse the `cache()`d chrome-context pattern).
- `DiaryPatronLobbyShell` keeps `LobbyNavigationProvider` + `DiaryLobbyParamsProvider` and
  the chrome/empty-state logic, but is fed by server `tabCounts` and the seeded page instead
  of the full `rawRows`. Empty states (`No films logged yet`, venue-empty, other-tab hints)
  switch on `tabCounts` + `total_results` for the active media/venue.
- Chips: no change to the chip components — they already `router.replace` the URL; the
  `force-dynamic` server re-seeds page 1 for the new params.

## Testing

- **Unit:** comparator tiebreak — two rows, equal `watchedAt`, different `createdAt` →
  newest-`createdAt` first under `latest`, oldest-first under `earliest`; falls through to
  `id` when `createdAt` ties.
- **Endpoint:** order correctness with tied `watched_at`; venue filter incl. legacy/unset
  matches both; TV dedupe returns one row per show with correct `logCount` and
  `primaryScope`; `tabCounts` venue-independent; `total_pages` math.
- **Manual:** scrolling fetches the next page; a chip change re-seeds page 1 in the new
  order/venue/tab; flipping a TV card lazy-loads its entries and caches them; first paint is
  noticeably lighter than the old all-at-once render.

## Files touched (anticipated)

- `apps/server/src/routes/logs.ts` — new `me/diary` endpoint; tiebreak on `/recent`,
  `/by-user`; remove old `me`.
- `apps/server/src/lib/` — small query-args helper (parse media/order/venue/page/limit),
  mirroring `profile-filmography-query` / `watchlist-query-args`.
- `apps/web/src/lib/still-api-fetch.ts` — `fetchMyDiary`.
- `apps/web/src/lib/diary-lobby-order.ts`, `diary-lobby-grouping.ts` — comparator tiebreak;
  `DiaryLogRow` gains `createdAt`.
- `apps/web/src/components/diary/diary-lobby-infinite.tsx` — new.
- `apps/web/src/components/diary/diary-tv-group-cell.tsx` — lazy-load logs on flip.
- `apps/web/src/components/diary/diary-patron-lobby-shell.tsx`,
  `diary-lobby-catalogue.tsx` — wire to paged data + `tabCounts`.
- `apps/web/src/app/(app)/diary/page.tsx` — streamed RSC seeding page 1.
- Remove `apps/web/src/lib/fetch-my-logs-me-server.ts`.
- Tests: `diary-lobby-order.test.ts` (comparator), endpoint test.
