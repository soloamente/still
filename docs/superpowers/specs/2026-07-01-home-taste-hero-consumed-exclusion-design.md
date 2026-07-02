# Home Taste Hero — Consumed Title Exclusion

**Status:** Approved (brainstorm 2026-07-01, human `go`)  
**Date:** 2026-07-01  
**Scope:** Signed-in **Movies** taste spotlight on `/home?browse=movies` (`HomeTasteMatchedHero`, `GET /api/taste/for-you`, dismiss replacement, client sync after watchlist/diary mutations)  
**Out of scope:** TV taste surface, personal lists membership, saved quotes, favorites as a separate rule (diary logs already cover favorited titles)

## Summary

The home taste hero must **never** spotlight a film the viewer has already **watchlisted** or **logged in diary**. Today the server intends this via `buildTasteMatchExcludeIds`, but patrons can still see a title with an **On watchlist** button — meaning the client knows the title is consumed while the hero still shows it (stale RSC payload, missing client purge, or an unguarded server path).

This spec locks a **defense-in-depth** fix: hard server filter on every `for-you` response, client reconciliation on mount, and a lightweight browser event so watchlist/diary actions anywhere in the app evict the title from the hero immediately.

## Problem

| Symptom | Likely cause |
|---------|----------------|
| Hero shows film with **On watchlist** | Client `fetchWatchlistCheck` is true but list was not purged |
| Film reappears after dismiss replacement | Replacement pick not re-validated against consumed set |
| Film stays after add from catalogue grid | No cross-surface sync to hero; RSC `initial` payload stale |
| Film in hero despite diary log | Server exclude gap or client never reconciled `initial` |

Product intent (ST.4 + AGENTS): For you is for **unseen** discovery. Watchlisted and watched titles are not discovery.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Consumed definition | **Watchlist** ∪ **any diary log** on the film (`log.movieId`) |
| Favorites | No separate rule — favoriting requires a diary log |
| Dismissed | Unchanged — forever excluded via `taste_dismissed_movie` |
| Remove from watchlist | Title becomes eligible again on next `for-you` scoring |
| New diary log | Title excluded immediately (client event + server on next fetch) |
| Below min results after filter | Hide hero (`coldStart: true`) — same as today (&lt;6 titles) |
| Sync latency | **Immediate** client purge when mutation is detectable; server filter on every API response |
| API shape | Add optional `consumedTmdbIds: number[]` on `for-you` for client reconciliation (watchlist ∪ diary ids used for filtering) |

## Architecture

### Server — final guard

After MMR selection and enrichment in `buildTasteMatchedDiscoveryWithMeta`:

1. Load `watchlistMovieTmdbIds` + `loggedMovieTmdbIds` (distinct `log.movieId` for user).
2. `filterConsumedTasteMovies(movies, consumedSet)` — drop any row whose `tmdbId` is in the set.
3. If `movies.length < TASTE_MATCH_MIN_RESULTS` → return cold start.
4. Apply the same single-movie guard when returning **dismiss replacements** (`dismissTasteMovie`).

Scoring-time exclusion (`buildTasteMatchExcludeIds`) stays — the final guard catches drift, enrichment races, and future regressions.

### Client — hero reconciliation

`HomeTasteMatchedHero`:

1. On payload apply (RSC `initial` or client fetch), filter `movies` against `consumedTmdbIds` from API.
2. On spotlight hydrate: if `fetchWatchlistCheck` is true **or** diary check finds logs → call existing `handleTitleConsumed` (remove + backfill) — **do not** render persistent **On watchlist** on a consumed spotlight.
3. Subscribe to `still:taste-title-consumed` (`CustomEvent<{ tmdbId: number }>`).

### Client — event dispatch

New `apps/web/src/lib/taste-title-consumed-events.ts` (mirror `listing-engagement-invalidate.ts`):

- `dispatchTasteTitleConsumed({ tmdbId })` on successful **movie** watchlist add and **movie** diary log create (Quick Log, catalogue radial, movie detail).

Call sites (minimal):

- `postWatchlistAdd` success path in `still-api-fetch.ts` or catalogue tile / detail hooks
- Quick Log sheet success for `listingKind === "movie"`

Removing from watchlist does **not** dispatch consumed (title may re-enter pool on refetch).

## UI copy

| State | Behavior |
|-------|----------|
| Unseen title | **Add to watchlist** + **Not interested** |
| Consumed title | Must not appear in hero stack |
| Race (consumed after paint) | Auto-remove; no **On watchlist** stuck state |

## Testing

**Server (`bun test`):**

- `filterConsumedTasteMovies` unit tests
- Integration-style test: mocked watchlist + log rows → `for-you` payload contains zero consumed ids
- Dismiss replacement never returns a watchlisted/logged id

**Web:**

- Event helper dispatches on `window` in jsdom or manual test note
- Optional: filter helper unit test mirroring server set logic

**Manual QA:**

1. Film on watchlist → not in hero on `/home?browse=movies`
2. Add from catalogue grid below → hero drops title without full page reload
3. Quick Log from hero → title removed (existing) + stays removed on revisit
4. Remove from watchlist → title may return on navigation/refetch (not required instantly)

## Success criteria

- Zero hero spotlights where `fetchWatchlistCheck` is true
- Zero hero spotlights for films with any diary log
- No regression to dismiss / not-interested / watchlist-add-from-hero flows

## Related docs

- `docs/superpowers/specs/2026-06-11-taste-for-you-algorithm-v2-design.md` — scorer (logged + dismissed exclusion at pool time)
- `apps/server/src/lib/taste-watchlist-exclusion.ts` — existing watchlist merge into exclude ids
