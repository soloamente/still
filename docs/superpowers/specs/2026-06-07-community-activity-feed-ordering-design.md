# Community Activity feed — ordering & timestamps

**Date:** 2026-06-07  
**Status:** Approved (design)  
**Route:** `/home?browse=community&sort=activity`  
**Approach:** A — unified feed timestamp (display + sort from one field), composite cursor, client re-sort

## Problem

The signed-in Community **Activity** tab feels unreliable: rows appear out of order, and
byline times disagree with position (e.g. a watch row shows **today** while a review above
shows **7h ago**, even though the patron logged the watch after writing the review).

Root causes in the current implementation:

1. **Mixed display clocks** — Reviews/lists use relative time from feed `at`; watch rows use
   **watch calendar date** (`today`, `May 20`) from `log.watchedAt`, which is stored as
   local noon on the picked diary date (not the actual watch moment).
2. **Mixed sort clocks** — Logs sort by `createdAt` (recent fix), reviews by `publishedAt`,
   lists by `list.updatedAt` (any edit — cover, description, reorder — bumps the list).
3. **Pagination gaps** — Three parallel queries merge with a single ISO `before` cursor;
   rows sharing the same second can be skipped; appended pages are not re-sorted client-side.
4. **Divergence injection** — Rating-divergence rows splice into slot ~3 on page 1, breaking
   strict chronological order.

## Goal

1. **One comparable clock** on every row byline (`7h ago`, `2d ago`, …).
2. **Feed order matches action sequence** for a patron's own workflow (log → review → add to
   list appears newest-first in that order).
3. **Stable infinite scroll** — no duplicates, gaps, or order inversions across pages.

## Non-goals

- Dedicated `activity_event` table (future option).
- Single SQL `UNION` rewrite (Approach B — defer unless pagination issues remain).
- Logged-out `/api/feed/discover` (bounded snapshot; unchanged).
- Mutations or new notification types.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Approach | A — unified `at` + composite cursor + client re-sort | Fixes user-visible bugs without schema migration. |
| Watch byline | Relative from `item.at` (`log.createdAt`) | Matches reviews/lists; comparable at a glance. |
| Watch meta | Optional `Watched May 20` when calendar day ≠ log day | Preserves diary meaning without polluting the byline. |
| List activity time | `max(list.createdAt, latest list_item.addedAt)` | "Added to list" surfaces on add; metadata edits don't bump. |
| Divergence rows | Page 1 only (`before` absent) | Avoids mid-feed time violations on scroll. |
| Cursor | Composite `(at, kind, id)` | Strict `<` comparison avoids same-second gaps. |

## Timestamp semantics

| Kind | Feed `at` (sort + byline) | Secondary meta |
|------|---------------------------|----------------|
| **log** | `log.createdAt` | `Watched {date}` when `watchedAt` calendar day ≠ `createdAt` calendar day (local) |
| **review** | `review.publishedAt` | — |
| **list** | `max(list.createdAt, max(list_item.addedAt))` | — |
| **divergence** | existing `divergence.at` | unchanged |

**List feed inclusion:** Include a list row when `list.createdAt` or any `list_item.addedAt`
falls in the community period window. Do **not** use `list.updatedAt` for sort or inclusion.

**Watch date storage:** Diary continues to store `watchedAt` as date-only (local noon). Activity
feed never derives relative byline time from `watchedAt`.

## Pagination

### Composite cursor (signed-in `GET /api/feed`)

Replace optional `before` (ISO only) with three query params:

- `before` — ISO timestamp (required when paginating)
- `beforeKind` — `log` \| `review` \| `list` \| `divergence`
- `beforeId` — stable row id for tiebreak

**Comparison rule** when filtering each stream: row is "older than cursor" when:

```
(at < cursorAt) OR (at = cursorAt AND kind/id tiebreak is older)
```

Implement tiebreak order: `at DESC`, then kind order (`log`, `review`, `list`, `divergence`),
then `id DESC`. Shared helper in `apps/server/src/lib/feed-items.ts` (`compareFeedRows`).

Each of the three queries applies the cursor on its own `at` column with the same tiebreak
logic (using the cursor row's kind/id only when `at` matches).

**Response:** unchanged shape `{ items: [{ kind, at, payload }] }`.  
**Next cursor (client):** last item in the **sorted** page after merge + slice.

### Client re-sort

After `useInfinitePager` merges a new page (`mergeDedupe`), run `sortActivityItems(items)`
in `apps/web/src/lib/home-community-activity.ts` using the same `(at, kind, id)` ordering as
the server.

### Divergence

Call `findFeedRatingDivergence` and splice only when `before` is absent. Paginated requests
skip divergence entirely.

## UI

### `ActivityItem` / `ActivityByline`

- **All kinds:** `timeLabel = formatTimeAgoLabel(item.at)`; `dateTime = item.at`.
- **Log rows only:** If watch calendar day ≠ log calendar day, show muted meta under title:
  `Watched {formatActivityWatchTimestamp(watchedAt)}` (reuse existing helper for calendar
  labels only — not in byline).
- **Remove** watch calendar date from the byline (`formatActivityWatchTimestamp` there today).

Pass `item` into `LogActivity` (parity with review/list).

### Native app

`apps/native` activity cards already use `item.at` for logs — no byline change required.
Verify list payload after server list-`at` change.

## Server changes

| File | Change |
|------|--------|
| `apps/server/src/routes/feed.ts` | Composite cursor parsing; list `at` from createdAt/latest addedAt; list query join/subquery for latest `list_item.addedAt`; divergence page-1 only; period filter aligned to new list rule |
| `apps/server/src/lib/feed-items.ts` | `compareFeedRows`, cursor filter helper, export kind order |
| `apps/server/src/lib/feed-items.test.ts` | Sort order, cursor tiebreak, list-at vs updatedAt |

## Web changes

| File | Change |
|------|--------|
| `apps/web/src/components/feed/activity-item.tsx` | Unified byline from `item.at`; watch meta line |
| `apps/web/src/lib/home-community-activity.ts` | `sortActivityItems`, cursor encode/decode for fetch |
| `apps/web/src/components/home/community-activity-infinite.tsx` | Re-sort after load; composite next cursor |
| `apps/web/src/lib/still-api-fetch.ts` | Pass `beforeKind`, `beforeId` |
| `apps/web/src/lib/home-community-core-fetch.ts` | Composite initial cursor from last seed item |
| `apps/web/src/lib/activity-feed-timestamp.test.ts` | Keep calendar helper tests; add sort tests |

## Testing

### Automated

- Server: merge puts log with newer `createdAt` above review with older `publishedAt` when
  watch was backdated.
- Server: list metadata-only edit does not change feed `at`.
- Server: adding `list_item` moves list row above older review.
- Server: cursor at `(T, review, id)` does not skip log at `(T, log, id)`.
- Web: `sortActivityItems` orders two pages correctly when page 2 would append out of order.
- Web: log byline shows relative time from `item.at`, not `today`.

### Manual (signed-in Activity tab)

1. Log a film (backdated watch date optional) → review → add same title to a list.
2. Confirm order: **list**, **review**, **log** (newest first).
3. Confirm bylines: all relative (`Nm ago`), descending; watch meta shows calendar date if
   backdated.
4. Scroll past first page — no duplicates, order stays monotonic.
5. Toggle Community period chip — feed re-seeds cleanly.

## Rollout

1. Ship server + web together (cursor params are additive; old clients sending ISO-only
   `before` still work if server accepts ISO-only as legacy fallback for one release — optional).
2. No migration required.
3. Monitor for list feed volume change (fewer spurious bumps from description edits).

## Future (out of scope)

- **Approach B:** Single `UNION ALL` timeline query.
- **Approach C:** `activity_event` table on mutations.
- Per-event list rows (`list_add` vs `list_created`) instead of one row per list.
