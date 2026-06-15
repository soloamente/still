# Taste Rail — Watchlist Exclusion

**Status:** Approved (brainstorm 2026-06-13)  
**Date:** 2026-06-13  
**Scope:** Signed-in **Movies For you rail** on `/home?browse=movies` (`HomeTasteMatchedRail`, `GET /api/taste/for-you`)  
**Out of scope:** TV taste rail, main catalogue grid (`surface="home"`), treating watchlist add as permanent dismiss, Settings UI, cross-tab live sync when watchlist changes elsewhere

## Summary

Hard-exclude **watchlisted movies** from taste-matched suggestions (same class as diary logs and dismissed titles). When a patron **adds to watchlist** from the taste rail, remove the tile immediately and backfill a replacement — matching Quick Log and Not interested UX.

## Problem

1. `GET /api/taste/for-you` excludes **logged** and **dismissed** films only — watchlisted titles still appear in the rail.
2. Adding a film to watchlist from the taste rail leaves the poster visible until a full navigation refresh.
3. The rail is meant for **discovery**; titles the patron already saved to watch belong in `/watchlist`, not repeated in For you.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Exclusion mode | **Hard exclude** — watchlisted movies never scored or served while on watchlist |
| vs dismiss | Watchlist exclusion is ** reversible** — removing from watchlist restores eligibility on next fetch |
| vs logged | Same exclusion pool as logs for candidate scoring; watchlist is independent of dismiss table |
| In-session add | **Optimistic remove + backfill** via shared client handler (Approach 1) |
| Backfill API | Reuse `GET /api/taste/for-you` (no new endpoint) |
| TV watchlist | **Out of scope** — Movies rail only (`movieId` rows) |
| Success feedback | **Silent** on success; toast only on backfill failure (tile already removed) |

## User stories

1. On `/home` Movies, films already on my watchlist do **not** appear in **Films matched to your taste**.
2. When I RMB a taste-rail poster and **Add to watchlist**, that tile disappears immediately and a new suggestion fades in.
3. On my next visit to `/home`, titles I watchlisted from the rail still do **not** reappear.
4. If I remove a film from my watchlist elsewhere, it may appear again in the taste rail on a subsequent `for-you` fetch.
5. **Not interested** behavior is unchanged — permanent dismiss, unrelated to watchlist.

## Server behavior

### `scoreTasteMatchCandidatesForUser(userId)`

Extend the existing exclusion set:

```ts
const excludeIds = [
  ...new Set([
    ...profile.loggedMovieIds,
    ...dismissedIds,
    ...watchlistMovieIds,
  ]),
];
```

Pass `excludeIds` to `fetchStratifiedCandidates` and `fetchSocialCandidates` (unchanged call sites).

### Helper: `fetchWatchlistMovieTmdbIds(userId)`

New module `apps/server/src/lib/taste-watchlist-exclusion.ts`:

- Query `watchlist_item` where `user_id = userId` and `movie_id IS NOT NULL`.
- Return `number[]` of TMDb movie ids (no pagination cap needed for exclusion — typical watchlists are small; cap at 2000 if defensive).
- No “hide watched” filter here — taste rail already excludes logged titles separately; a watchlisted+loggged title stays excluded via both paths.

### API shape

**Unchanged** — `{ coldStart, genrePhrase, movies }` on `GET /api/taste/for-you`.

### Tests (server)

Add to `apps/server/src/lib/taste-matched-discovery.test.ts` or dedicated `taste-watchlist-exclusion.test.ts`:

- Watchlisted movie id is merged into `excludeIds` during scoring (mock DB or inject helper).
- Integration-style test: user with watchlisted candidate never receives that id in `buildTasteMatchedDiscovery` output.

## Client architecture

### `HomeTasteMatchedRail`

- Rename `handleLogged` → `handleTitleConsumed(tmdbId)` — shared path for Quick Log success **and** watchlist add from taste rail.
- Behavior unchanged:
  1. Optimistic: filter title from `movies` state.
  2. `GET /api/taste/for-you`.
  3. Pick first result not already on screen; insert at prior index with enter animation.
  4. On fetch failure: silent (title stays removed).
- Keep `onActionComplete={() => handleTitleConsumed(film.tmdbId)}` on `CataloguePosterTile`.

### `CataloguePosterTile`

- On successful **Add to watchlist** when `surface === "taste-rail"`, call `onActionComplete()` explicitly after closing the radial.
- Do **not** call `onActionComplete` on watchlist **remove** from taste rail (title was not on rail).
- Main catalogue (`surface="home"`) unchanged — watchlist toggle does not refresh grid or call `onActionComplete`.

### Motion

Reuse existing `AnimatePresence` exit/enter (~150ms, `scale 0.96` / `opacity`). Respect `useReducedMotion`.

## Action matrix update (taste-rail)

| Action | Behavior |
|--------|----------|
| Quick log / Rewatch | Remove tile + backfill (`handleTitleConsumed`) |
| Add to watchlist | **Remove tile + backfill** (`handleTitleConsumed`) |
| Remove from watchlist | No rail change (N/A — tile not shown if watchlisted) |
| Not interested | Unchanged — `POST /api/taste/dismiss` + replacement |

## Edge cases

| Case | Behavior |
|------|----------|
| Watchlist add fails (network) | Tile stays; error toast from existing watchlist handler |
| Backfill returns only watchlisted titles | Server exclusion prevents this once deployed; client may insert nothing |
| Rail drops below 6 titles after remove | Hide entire section (`tasteRailIsEmpty`) |
| Title on watchlist and dismissed | Both excluded; dismiss row persists if patron later removes from watchlist |
| Title logged and watchlisted | Excluded via logged id |
| Empty watchlist | No change to current behavior |

## Verification

1. Sign in with ≥10 movie logs; ensure at least one taste-rail pick is on your watchlist — it must **not** appear in the rail.
2. RMB a taste-rail poster → **Add to watchlist** → tile exits, replacement fades in.
3. Hard refresh `/home` — watchlisted title still absent from rail.
4. Remove that title from `/watchlist`; revisit `/home` — title may reappear if scorer ranks it.
5. Main catalogue **Add to watchlist** — poster stays (grid unchanged).
6. `bun test` — server exclusion tests pass.

## References

- `apps/server/src/lib/taste-matched-discovery.ts` — `excludeIds` orchestration
- `apps/server/src/lib/taste-dismissed-movie-store.ts` — pattern for user-scoped id fetch
- `packages/db/src/schema/activity.ts` — `watchlistItem`
- `apps/web/src/components/home/home-taste-matched-rail.tsx` — rail state + backfill
- `apps/web/src/components/catalogue/catalogue-poster-tile.tsx` — watchlist toggle
- `docs/superpowers/specs/2026-06-06-taste-rail-not-interested-design.md` — dismiss + replacement patterns
- `docs/superpowers/specs/2026-06-11-taste-for-you-algorithm-v2-design.md` — scoring model
