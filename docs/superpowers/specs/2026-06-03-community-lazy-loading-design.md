# Community lazy-loading (active-feed-only + infinite scroll)

**Date:** 2026-06-03
**Status:** Approved (design)

## Problem

The Community lobby (`/home?browse=community`, not a separate route) is slow to load
because its RSC (`fetchHomeCommunityCore`) fetches **all four feeds at once** for
`period=all` — 24 lists + 20 reviews + 40 activity items + 6 curator spotlights — in the
critical path, serializes them all into the client payload, then filters by period
client-side. A visitor only ever views one feed (`?sort=`), yet pays for all four on every
load. Each feed is also a fixed batch with no scroll-paging.

Leaderboards (Film/TV ranks) are already deferred to the client and are top-N tables, not
scrollable feeds — they are out of scope.

## Goal

1. **Faster load:** the RSC fetches only the *active* feed (active period), not all four.
2. **Infinite scroll:** Lists, Reviews, and the signed-in Activity feed page on scroll, like
   the diary/watchlist grids.

Non-goals: redesigning feed visuals; paginating leaderboards; paginating the logged-out
`/api/feed/discover` snapshot (a bounded curated highlight set, left as-is).

## Approach

- Pagination on the server is **additive**: new optional query params, unchanged response
  shapes, so the other consumers of these endpoints don't break. Continuation is signalled
  by "got exactly `limit` rows ⇒ there may be more."
- Lists and Reviews use **offset** pagination (single-table queries). The signed-in Activity
  feed merges three time-ordered streams, so it uses a **timestamp cursor** (`before`).
- A shared **`useInfinitePager`** hook carries the sentinel + IntersectionObserver + loadMore
  + dedupe + footer-state logic for all feeds (extracted from the diary's component).
- Feed/period become URL-driven seeds; the chips already navigate the URL, so a chip tap
  re-runs the RSC and re-seeds — same model as the diary/watchlist chips and the existing
  leaderboard defer. **Trade-off:** switching feed/period becomes a quick server round-trip
  instead of an instant client swap (accepted, consistent with the diary work).

## Design

### 1. Shared client hook — `useInfinitePager`

New file `apps/web/src/lib/use-infinite-pager.ts`. Generic over the item type `T` and an
opaque cursor `C` (a page number for offset feeds, an ISO timestamp for the activity cursor).

```ts
export type LoadMoreResult<T, C> =
  | { items: T[]; nextCursor: C | null } // null = exhausted
  | { error: true };

export function useInfinitePager<T, C>(opts: {
  seeds: T[];
  /** Cursor to fetch page 2; null when the seed is already the whole set. */
  initialCursor: C | null;
  loadMore: (cursor: C, signal: AbortSignal) => Promise<LoadMoreResult<T, C>>;
  getKey: (item: T) => string;
}): {
  items: T[];
  footerState: "idle" | "loading" | "exhausted" | "error";
  sentinelRef: React.RefObject<HTMLDivElement>;
  retry: () => void;
};
```

Responsibilities (ported from `DiaryLobbyInfinite`'s proven loop):
- Seed `items` from `seeds`; **re-seed** when `seeds`/`initialCursor` identity changes (chip
  navigation) — reset cursor, generation, loading.
- IntersectionObserver on `sentinelRef` (re-attaches when the sentinel re-mounts after an
  exhausted→reseed transition) + a geometry "peek" to drain tall viewports.
- A **generation guard + `AbortController`**: a re-seed bumps the generation and aborts the
  in-flight request; stale/aborted results are discarded (never appended to the new feed).
- Cross-page **dedupe by `getKey`** (absorbs the activity merged-cursor boundary overlap).
- `footerState` drives the loading spinner / "try again" / end states.
- Holds `nextCursor`; calls `loadMore(cursor, signal)`; `nextCursor === null` ⇒ exhausted.

`DiaryLobbyInfinite` MAY be retrofitted onto this hook later; that retrofit is **out of scope
here** (leave the diary as-is to avoid regression risk).

### 2. Server — additive pagination

All three changes are backward compatible: when the new param is absent, behavior is
byte-identical to today.

- **`GET /api/lists` `/`** (public community lists): add optional `page`. Compute
  `offset = (max(1,page)-1) * limit`, apply `.offset(offset)`, and append `desc(list.id)` as a
  final tiebreaker to the existing `orderBy(listDiscoverabilityOrder, desc(likesCount),
  desc(updatedAt))` so offset windows are stable. Response unchanged (`withCoverPosterPaths`
  array).
- **`GET /api/reviews/recent`**: add optional `page` → `offset`; append `desc(review.id)` to
  the existing `orderBy(desc(engagement), desc(publishedAt))`. Response unchanged (rows array).
- **`GET /api/feed` `/`** (signed-in activity): add optional `before` (ISO timestamp). Apply
  `time < before` to each of the three stream queries (`log.watchedAt`, `review.publishedAt`,
  `list.updatedAt`). Only compute/inject the synthetic **divergence** row when `before` is
  absent (page 1 only). Response unchanged (`{ items }`).
- **`GET /api/feed/discover`** (logged-out): unchanged — a bounded curated snapshot, not
  paginated.

A small pure helper module `apps/server/src/lib/community-page-args.ts` parses/clamps `page`
and computes `offset` (mirrors `diary-log-query.ts`), unit-tested without a DB.

### 3. RSC — active-feed-only seed

Replace `fetchHomeCommunityCore` with `fetchHomeCommunityFeedSeed({ api, session, feed,
period, signedIn })` that fetches **only** what the active feed needs:
- `lists` → page 1 of `/api/lists` for the period **+** curator spotlights (curators only
  render on the Lists feed).
- `reviews` → page 1 of `/api/reviews/recent` for the period.
- `activity` → page 1 of `/api/feed` (signed-in) or `/api/feed/discover` (logged-out) for the
  period.
- `film-ranks` / `tv-ranks` → nothing (client-deferred leaderboards, unchanged).

It returns the active feed's seed rows **plus the `initialCursor`** computed from the
"exactly `limit`" rule (page `2` for offset feeds; the last item's `at` for the activity
cursor; `null` if fewer than `limit` came back, or for discover).

`HomeCommunityRscPayload` gains `feed`/`period`/`signedIn` (passed from `home/page.tsx`, which
already parses them) and seeds only the active feed.

### 4. Client — per-feed infinite components

Each consumes `useInfinitePager` with a feed-specific `loadMore` that calls a thin
`still-api-fetch` client function.

- **Lists** — replace the static `ListsLobbyCatalogue` render with an infinite variant
  (`loadMore(page)` → `/api/lists?page=&period=`; `nextCursor = items.length === LIMIT ?
  page+1 : null`). Keeps the same `ListLobbyPoster` grid + monochrome hover.
- **Reviews** — new infinite list of `ReviewCard` (`loadMore(page)` →
  `/api/reviews/recent?page=&period=`). Same `<ul>` layout and intro caption.
- **Activity** — new infinite list of `ActivityItem` (`loadMore(before)` →
  `/api/feed?before=&period=&tz=`; `nextCursor = items.length === LIMIT ? lastItem.at : null`).
  Dedupe by the existing `homeCommunityActivityRowKey`. Folds in the current signed-in
  tz/period behavior (the fetch already carries period + viewer tz). The friend-activity rail
  continues to derive from the loaded activity items.
- **Leaderboards** — unchanged (client-deferred top-N).

`LIMIT` constants per feed match today's server defaults (lists 24, reviews 20, activity 40).

### 5. Params-context simplification

`home-community-lobby-params-context.tsx` drops the bundle-everything + client period-filter
logic (`filterListSeedsByCommunityPeriod` / `filterReviewsByCommunityPeriod` /
`filterActivityByCommunityPeriod` are no longer used for the main feeds). The context retains:
- `feed`/`period` from the URL (for chip highlighting) and `selectFeed`/`selectPeriod`
  navigation (unchanged);
- the leaderboard deferral state machine (unchanged).

The active feed's seed + `initialCursor` flow from the RSC to the lobby body as props (not via
the context bundle). `HomeCommunityLobby` keeps its feed switch but renders the infinite feed
components for lists/reviews/activity.

### 6. Testing

- Unit: `community-page-args` (page→offset clamp); the activity `nextCursor` rule
  (exactly-`limit` ⇒ last `at`, else null); `useInfinitePager` dedupe/re-seed if feasible to
  test in isolation.
- Manual: each feed scrolls and loads more; feed + period chips re-seed page 1; first paint
  fetches one feed (verify Network shows a single feed request, not four); logged-out Activity
  still shows the discover snapshot; leaderboards still defer.

## Decomposition (for the plan)

Build in this order, each independently shippable:
1. `useInfinitePager` hook (+ unit test).
2. Server additive pagination + `community-page-args` (+ unit test).
3. `still-api-fetch` client loaders (lists/reviews/activity pages).
4. RSC active-feed-only seed (`fetchHomeCommunityFeedSeed`) + payload wiring.
5. Per-feed infinite client components (lists, reviews, activity).
6. Params-context cleanup + remove dead client period-filter helpers.

## Files touched (anticipated)

- `apps/server/src/routes/lists.ts`, `reviews.ts`, `feed.ts` — additive pagination.
- `apps/server/src/lib/community-page-args.ts` (+ test) — new.
- `apps/web/src/lib/use-infinite-pager.ts` (+ test) — new.
- `apps/web/src/lib/still-api-fetch.ts` — `fetchCommunityLists`, `fetchCommunityReviews`,
  extend `fetchCommunityActivity` with `before`.
- `apps/web/src/lib/home-community-core-fetch.ts` → becomes `fetchHomeCommunityFeedSeed`.
- `apps/web/src/components/home/home-community-rsc-payload.tsx` — seed active feed only.
- `apps/web/src/components/home/home-community-lobby.tsx` — render infinite feed components.
- `apps/web/src/components/home/home-community-lobby-params-context.tsx` — drop bundle/filter.
- New: `apps/web/src/components/home/community-lists-infinite.tsx`,
  `community-reviews-infinite.tsx`, `community-activity-infinite.tsx`.
- `apps/web/src/app/(app)/home/page.tsx` — pass `feed`/`period` into the community payload.
- Likely removable once unused: `apps/web/src/lib/community-period-filter.ts` (verify no other
  callers before deleting).
