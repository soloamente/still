# Taste Rail — “Not Interested” Dismiss

**Status:** Approved (brainstorm 2026-06-06)  
**Date:** 2026-06-06  
**Scope:** Signed-in **taste-based recommendation rails** — v1: `HomeTasteMatchedRail` on `/home?browse=movies` (ST.4)  
**Out of scope (v1):** Main Movies/TV catalogue grids, search results, movie/TV detail, Settings UI to review hidden titles, undo toast, TV taste rail (future), negative taste-model reweighting

## Summary

Let patrons **permanently dismiss** a taste-matched suggestion via the existing **radial toolkit** wedge **Not interested**, instantly swap in the next server-scored candidate, and never see that title in taste rails again.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Trigger | **Approach A** — radial wedge (RMB hold → aim → release) |
| Persistence | **Forever** per patron (`taste_dismissed_movie` table) |
| Replacement UX | **Instant** — fade out dismissed tile; fade in replacement when `POST` returns (~150ms motion) |
| Scope | **Taste rails only** (current + future taste-based rails; **not** main catalogue `surface="home"`) |
| API shape | **Approach 1** — `POST /api/taste/dismiss` returns `{ replacement }`; no client backfill pool in v1 |
| Undo | **None** (user declined undo-toast option) |
| Success feedback | **Silent** on success; toast only on error |
| Settings | **Deferred** — schema supports future “Hidden suggestions” management |

## Problem

1. `GET /api/taste/for-you` excludes **logged** films only — patrons cannot reject suggestions they will never watch.
2. The taste rail re-shows the same TMDb picks on every `/home` visit until the patron logs them.
3. No feedback channel exists for “this match is wrong for me” without polluting the diary.

## User stories

1. On `/home` Movies (signed in, ≥10 movie logs), I RMB a taste-rail poster, release on **Not interested**, and that title disappears immediately.
2. A **new** taste-matched film fades into the same slot without reloading the page.
3. On my next visit to `/home`, the dismissed title does **not** reappear in the taste rail.
4. Main catalogue posters (Popular, Latest, etc.) do **not** show **Not interested** — only taste rails.
5. If dismiss fails (network), the original poster returns and I see **Couldn't update suggestions**.

## Action matrix (taste-rail tiles)

### Signed in (taste rail only)

| Action | Notes |
|--------|--------|
| Open film | Same as catalogue |
| Copy link | Same as catalogue |
| Quick log / Rewatch | Same as catalogue |
| Add to watchlist | Same as catalogue |
| Add to list | Same as catalogue |
| **Not interested** | **New** — muted/destructive wedge; persists dismiss + requests replacement |

Shortcut letter: **N** (Not interested).

Slot order (after existing home slots): … → **Add to list** → **Not interested**.

### Signed out

Taste rail hidden today (`coldStart` / auth). No change.

## Data model

### Table: `taste_dismissed_movie`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `text` PK | `crypto.randomUUID()` |
| `user_id` | `text` FK → `user.id` | `onDelete: cascade` |
| `movie_tmdb_id` | `integer` | TMDb id (matches `movie.tmdb_id`) |
| `dismissed_at` | `timestamp` | `defaultNow()` |

**Unique:** `(user_id, movie_tmdb_id)`  
**Index:** `(user_id)` for exclusion queries

Migration: `0020_taste_dismissed_movie.sql`

## Server behavior

### `buildTasteMatchedDiscovery(userId)`

1. Load dismissed `movie_tmdb_id` set for user.
2. Exclude **logged** + **dismissed** from candidate pool (extend existing `notInArray`).
3. Unchanged scoring, `TASTE_MATCH_MIN_RESULTS`, `TASTE_MATCH_TARGET_RESULTS`.

Extract shared helper `fetchDismissedMovieTmdbIds(userId)` in `apps/server/src/lib/taste-dismissed-movie.ts`.

### `POST /api/taste/dismiss`

**Auth:** signed in  
**Body:** `{ movieTmdbId: number }`  
**Rate limit:** 30/min per user (`taste:dismiss:${userId}`)

**Steps:**

1. Validate `movieTmdbId` is positive integer.
2. Upsert dismiss row (idempotent).
3. Optionally log `product_event` kind `taste.dismissed` with `{ movieTmdbId }` (analytics only).
4. Compute next replacement:
   - Reuse taste profile + candidate scoring from `buildTasteMatchedDiscovery` internals.
   - Exclude: logged, dismissed (including new), and **currently visible rail ids** passed optionally via body `excludeTmdbIds?: number[]` so replacement is not a duplicate on-screen title.
5. Return:

```ts
{
  dismissedTmdbId: number;
  replacement: TasteMatchMovie | null;
}
```

**Replacement null:** pool exhausted for current scoring — client removes cell; hide entire rail if remaining count &lt; `TASTE_MATCH_MIN_RESULTS` (6).

### Tests (server)

- Dismissed id excluded from `buildTasteMatchedDiscovery` results.
- `POST` idempotent on duplicate dismiss.
- `POST` returns highest-scored unseen replacement not in `excludeTmdbIds`.

## Client architecture

### Surface type

Extend `CatalogueRadialSurface`:

```ts
type CatalogueRadialSurface = "home" | "diary" | "watchlist" | "taste-rail";
```

`"taste-rail"` inherits home signed-in actions **plus** `not-interested`. Main catalogue keeps `"home"` without the extra slot.

### `catalogue-radial-items.ts`

- `buildCatalogueRadialItemSpecs({ surface: "taste-rail", ... })` appends `{ id: "not-interested", label: "Not interested", shortcut: "N", variant: "destructive" }`.
- Unit tests mirror existing `catalogue-radial-items.test.ts` patterns.

### `CataloguePosterTile`

- New optional prop: `onNotInterested?: (tmdbId: number) => void | Promise<void>`.
- When `surface === "taste-rail"` and `onNotInterested` provided, wire handler + icon (`IconTrashXmarkFill` or thumb-down Nucleo if available).
- Handler closes radial, calls parent callback.

### `HomeTasteMatchedRail`

- Maintain `movies` in state (seed from `initial` prop).
- `handleDismiss(tmdbId)`:
  1. Optimistic: mark cell exiting (motion `opacity` 0, ~150ms).
  2. `POST /api/taste/dismiss` with `excludeTmdbIds: movies.map(m => m.tmdbId)`.
  3. On success: remove dismissed; if `replacement`, insert at same index with enter animation.
  4. On failure: restore tile; `toast.error("Couldn't update suggestions")`.
- If `movies.length < TASTE_MATCH_MIN_RESULTS` after dismiss, return `null` (hide section).
- Pass `surface="taste-rail"` and `onNotInterested` to each `CataloguePosterTile`.

### Motion

- `motion/react` `AnimatePresence` + `layout` on rail cells.
- Respect `useReducedMotion` — skip layout animation, instant swap.

## Edge cases

| Case | Behavior |
|------|----------|
| No replacement | Remove cell; hide rail if &lt; 6 titles |
| Duplicate dismiss | Idempotent API; client no-op if already removed |
| Network error | Restore poster + error toast |
| Dismiss then log same film elsewhere | Log unaffected; dismiss row harmless (both excluded) |
| Cold start (&lt; 10 logs) | Rail hidden — no dismiss surface |

## Future rails

Any new taste-based rail (e.g. TV “For you”) should:

1. Use `surface="taste-rail"` on `CataloguePosterTile`.
2. Wire the same `onNotInterested` + dismiss API (extend to `tvTmdbId` in a follow-up migration if needed).
3. Reuse `buildTasteMatchedDiscovery` exclusion pattern.

## Verification

1. Sign in with ≥10 movie logs; open `/home?browse=movies&sort=latest`.
2. RMB taste-rail poster → **Not interested** → tile swaps.
3. Hard refresh `/home` — dismissed title absent.
4. Main catalogue poster radial — **no** Not interested slot.
5. `bun test` for radial specs + taste dismiss server tests.

## References

- `apps/server/src/lib/taste-matched-discovery.ts` — scoring + exclusions
- `apps/web/src/components/home/home-taste-matched-rail.tsx` — rail UI
- `apps/web/src/lib/catalogue-radial-items.ts` — radial spec builder
- `docs/superpowers/specs/2026-05-22-radial-toolkit-catalogue-lobbies-design.md` — radial patterns
