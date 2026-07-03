# Taste Queue — Non-Interrupting Backfill

**Status:** Approved (brainstorm 2026-07-03, human `go`)  
**Date:** 2026-07-03  
**Scope:** Signed-in **Movies** taste surfaces on `/home?browse=movies` — `HomeTasteMatchedHero` and `HomeTasteMatchedRail` (ST.4)  
**Out of scope:** TV taste surfaces, main catalogue grids, server scoring changes, Settings “hidden suggestions” UI, undo toast

## Summary

When a patron logs, watchlists, or dismisses a taste suggestion, the title must leave the queue and the UI must advance to the **next** item without interruption. Replacements must **append to the tail** of the in-memory queue (target depth **24**) and appear via poster **enter** motion — never splice back into the slot that was just consumed.

Today both hero and rail insert replacements at the removed index (`splice(index, 0, replacement)`), which hijacks the spotlight or visible rail cell after the patron has already moved on. The hero also decrements `activeIndex` when dismissing the current title, showing the **previous** film instead of the next.

## Problem

| Symptom | Root cause |
|---------|------------|
| After log/watchlist/dismiss, spotlight jumps to a different title than expected | Replacement inserted at old index; async dismiss response arrives after index advance |
| “Not interested” shows prior film | `handleNotInterested` decrements `activeIndex` when `removedIndex === activeIndex` |
| Queue feels short during heavy dismiss sessions | Hero only backfills when count &lt; 6; rail adds one in-slot replacement per dismiss |
| Hero and rail behave differently | Duplicated handlers with the same splice bug |

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Surfaces | **Hero + rail** — shared queue logic |
| Replacement placement | **Append to tail only** — never `splice` at removed index |
| Queue depth | Maintain **`TASTE_MATCH_TARGET_RESULTS` (24)** titles in client state after every remove |
| Backfill trigger | **Debounced** `GET /api/taste/for-you` (~150ms after last queue mutation) |
| Dismiss API | Keep `POST /api/taste/dismiss` for persistence; **ignore** `replacement` for placement (may still use response as a candidate during merge) |
| Hero focus | Unified index math: removing active title **keeps** `activeIndex` so the next row slides in |
| Rail window | State holds 24; UI still renders `movies.slice(0, visibleCount)` — tail buffer off-screen |
| Min visible | Hide surface when `movies.length < TASTE_MATCH_MIN_RESULTS` (6) — unchanged |
| Animation | **Tail enter only** — opacity + scale (~150ms, `motion/react`); respect `useReducedMotion` |
| transitions.dev | Import semantic duration/ease tokens into `:root` if missing; poster enter aligns with `--dropdown-open-dur` / `--dropdown-ease` (250ms / standard ease-out) — no new transition type required |
| Cross-surface sync | Keep `still:taste-title-consumed` — hero listener unchanged; rail should subscribe too |

## Architecture

### Shared client module

New `apps/web/src/lib/taste-match-queue.ts` (pure helpers + debounced backfill orchestrator):

```ts
export const TASTE_MATCH_TARGET_RESULTS = 24; // mirrors server

/** Index after removing `removedIndex` from the queue. */
export function activeIndexAfterRemoval(
  removedIndex: number,
  activeIndex: number,
  remainingLength: number,
): number;

/** Append unseen candidates to tail until length === target or candidates exhausted. */
export function mergeTailBackfill(
  current: TasteMatchMovie[],
  candidates: TasteMatchMovie[],
  targetLength?: number,
): TasteMatchMovie[];

/** Debounced backfill — coalesces rapid dismiss/log bursts into one for-you fetch. */
export function scheduleTasteQueueBackfill(
  getMovies: () => TasteMatchMovie[],
  applyMovies: (next: TasteMatchMovie[]) => void,
): { schedule(): void; cancel(): void };
```

Optional thin hook `useTasteMatchQueue` if it reduces duplication; otherwise hero/rail call the helpers from existing components.

### Queue mutation flow

```
Patron action (log / watchlist / not interested / taste-title-consumed)
  → remove tmdbId from movies[]
  → adjust hero activeIndex (if hero)
  → scheduleTasteQueueBackfill()
       → debounce 150ms
       → GET /api/taste/for-you
       → reconcileTasteMatchMovies(data.movies, data.consumedTmdbIds)
       → mergeTailBackfill(current, candidates, 24)
       → setMovies(result)
```

**Dismiss path:**

1. Optimistic remove from queue + hero index fix.
2. `POST /api/taste/dismiss` with `excludeTmdbIds: movies.map(m => m.tmdbId)` (pre-remove snapshot).
3. On dismiss failure: restore snapshot + toast (`Couldn't update suggestions`).
4. On success: `scheduleTasteQueueBackfill()` (do not insert `replacement` at index).

**Consume path (log / watchlist / event):**

1. Remove from queue + hero index fix.
2. `scheduleTasteQueueBackfill()` — no per-action dismiss POST.

### Backfill merge rules

1. Build `onScreenIds = Set(current.map(m => m.tmdbId))`.
2. From `for-you` candidates in server order, take rows where `!onScreenIds.has(tmdbId)`.
3. Append until `current.length === 24` or candidates exhausted.
4. Dedupe by `tmdbId` — first wins.

If after backfill `length < 6`, hide hero/rail (existing cold-start guard).

### Hero spotlight index (locked)

| Case | `activeIndex` after remove |
|------|----------------------------|
| `removedIndex < activeIndex` | `activeIndex - 1` |
| `removedIndex === activeIndex` | **unchanged** (next title occupies same index) |
| `removedIndex > activeIndex` | unchanged |

Clamp: `Math.min(activeIndex, movies.length - 1)` after state commit.

## UI & motion

### Hero poster rail

- Wrap poster cells in `AnimatePresence` + `motion` (parity with rail).
- **Exit:** removed poster fades/scales out (~150ms).
- **Enter:** only for **newly appended** tail ids (track `enteringTmdbIds` ref set on backfill commit; clear after animation).
- Do **not** animate spotlight trailer/logo swap on backfill — only the tail poster chip.
- Existing `scrollIntoView` for `safeActiveIndex` unchanged.

### Taste matched rail

- Keep current `AnimatePresence mode="popLayout"`.
- Remove in-slot splice — append backfill at tail.
- Visible window (`slice(0, visibleCount)`) shows queue head; tail buffer fills off-screen until head items are consumed.

### Reduced motion

- `useReducedMotion()` → instant remove/append, no enter/exit tweens.

## Error handling

| Case | Behavior |
|------|----------|
| Dismiss POST fails | Restore pre-mutation snapshot; error toast |
| Backfill GET fails | Silent — queue stays at reduced length until next mutation retries |
| Duplicate `tmdbId` in candidates | Skip duplicate |
| `for-you` cold start during backfill | No append; hide if &lt; 6 |
| Double consume (event + callback) | Second call no-ops (`findIndex < 0`) — unchanged |
| Rapid 5× dismiss | One debounced backfill tops up toward 24 |

## Edge cases

| Case | Behavior |
|------|----------|
| Pool exhausted before 24 | Queue stops at available count; hide if &lt; 6 |
| User manually picks poster then acts on spotlight | Remove spotlight title only; manual selection preserved via index rules |
| Remove from watchlist elsewhere | Title eligible again on next full `for-you` — not automatic re-insert |
| RSC `initial` refresh | Resets queue (existing `useEffect` on `initial`) — acceptable |
| Hero + rail both mounted | **Independent** queue state per component (same as today); both use shared helpers |

## Files (implementation)

| File | Change |
|------|--------|
| `apps/web/src/lib/taste-match-queue.ts` | **New** — index math, merge, debounced backfill |
| `apps/web/src/lib/taste-match-queue.test.ts` | **New** — index math + merge unit tests |
| `apps/web/src/lib/taste-matched-discovery.ts` | Export `TASTE_MATCH_TARGET_RESULTS` |
| `apps/web/src/components/home/home-taste-matched-hero.tsx` | Use shared queue; fix index; tail append; poster `AnimatePresence` |
| `apps/web/src/components/home/home-taste-matched-rail.tsx` | Use shared queue; tail append; subscribe `taste-title-consumed` |
| `packages/ui/src/styles/globals.css` | Add transitions.dev `:root` tokens once if absent |

**No server changes required** — existing `for-you` + `dismiss` sufficient.

## Verification

1. Hero: log spotlight → next trailer plays; no flash of dismissed title; new poster pops in at rail tail.
2. Hero: dismiss → same; no jump to previous film.
3. Hero: rapid 3× dismiss → one backfill burst; queue approaches 24; spotlight never replaced by async response.
4. Rail: dismiss visible tile → tile exits; no replacement in same cell; tail grows.
5. Quick log from rail tile → tile removed; backfill at tail.
6. `bun test apps/web/src/lib/taste-match-queue.test.ts`
7. Reduced motion: instant swaps, no layout animation.

## References

- `apps/web/src/components/home/home-taste-matched-hero.tsx` — current splice bug
- `docs/superpowers/specs/2026-06-06-taste-rail-not-interested-design.md` — in-slot replacement (superseded for hero + rail queue behavior)
- `docs/superpowers/specs/2026-07-01-home-taste-hero-consumed-exclusion-design.md` — consumed eviction
- `apps/server/src/lib/taste-matched-discovery.ts` — `TASTE_MATCH_TARGET_RESULTS = 24`
