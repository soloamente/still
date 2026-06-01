# Review & Diary Log Visibility

**Status:** Design approved, ready for planning
**Date:** 2026-06-01
**Topic:** Per-item visibility tiers for reviews and diary logs

## Problem

Today a review's visibility is a binary `review.isPublic` boolean (default `true`) with
**no UI control** to set it. Diary logs (`log`) have **no** visibility concept at all — they
are implicitly public everywhere (movie-detail "people you follow" rows, profile filmography
scores, the activity feed, Film/TV rank ledgers).

Patrons want to choose who can see each review and each diary log. We are upgrading the binary
flag into a four-level visibility model applied to both `review` and `log`, with an
account-level default.

## Visibility levels

A single enum, most-open to most-closed:

| Level       | Who can see it                                    |
|-------------|---------------------------------------------------|
| `public`    | Anyone (including signed-out / SEO)               |
| `followers` | People who follow the author (one-directional)    |
| `friends`   | Mutual follows only (`follow.isMutual = true`)    |
| `private`   | The author only                                   |

The tiers **nest**: `friends ⊆ followers ⊆ public`. A mutual follower is also a follower row,
so a `followers`-tier item is visible to friends without special-casing.

## Data model

Graph facts (unchanged): `follow` is a directed table keyed `(followerId, followingId)` with a
denormalized `isMutual` boolean (`packages/db/src/schema/profile.ts`). "A follows B" = a row
`follow(followerId=A, followingId=B)`.

Changes:

- New Postgres enum `content_visibility` = `('public','followers','friends','private')`.
- `review.visibility` (`content_visibility`, not null) — **replaces** `review.isPublic`.
  Backfill: `isPublic = true → 'public'`, `isPublic = false → 'private'`. Then drop `isPublic`.
- `log.visibility` (`content_visibility`, not null, default `'public'`) — new column; backfill
  all existing rows to `'public'` (matches today's implicit-public behavior).
- `profile.default_visibility` (`content_visibility`, not null, default `'public'`) — the
  account-level default applied to new logs/reviews.
- Indexes on `(visibility)` (and composite with existing author/movie indexes where the read
  filters benefit) to keep the filtered reads fast.

### Log ↔ review link

`review.logId` may link a review to a diary log. The two `visibility` columns are
**independent**. The review composer **pre-fills** the review's visibility from the linked
log's visibility (falling back to the account default), but the patron may set them
differently — same pattern as the existing rating backfill from log to review.

### Account default

New logs and new reviews inherit `profile.default_visibility`. The default's own seed value is
`'public'`, so existing users see **no behavior change** until they opt in. A per-item override
is always available in the composer.

## Access predicate (single source of truth)

One shared helper builds a Drizzle SQL condition reused by **every** attributed read path. No
per-route reimplementation — one source of truth prevents drift.

For viewer `V` and author column `A`, visibility column `vis`:

```
vis = 'public'
OR A = V                                                  -- always see your own
OR (vis = 'followers' AND EXISTS follow(followerId=V, followingId=A))
OR (vis = 'friends'   AND EXISTS follow(followerId=V, followingId=A, isMutual=true))
```

- Anonymous viewer (no `V`): only `vis = 'public'`.
- Provide both a **SQL-fragment** form (for list/feed queries, as an `and(...)` condition) and an
  **app-level** form `canViewContent({ viewerId, authorId, visibility, follows?, isMutual? })`
  for single-row fetches (e.g. `GET /reviews/:id` → 404 when not allowed).
- Unit-tested against the matrix {public, followers, friends, private} × {self, one-way
  follower, mutual, stranger, anonymous}.

## The attributed/aggregate rule

**Visibility governs *attributed* surfaces, not anonymous *aggregates*.** "Friends-only" means
*"don't show my name/opinion to strangers,"* not *"erase my activity from existence."* This
also avoids dual-count bugs (e.g. your "100 films logged" badge counting private logs while a
public leaderboard excludes them — two counts for the same rows).

**Attributed (MUST apply the predicate):**

Reviews
- `apps/server/src/routes/reviews.ts` — `GET /recent`, `GET /popular`, `GET /:id`
  (single fetch → app-level `canViewContent`, return 404 when not allowed).
- `apps/server/src/routes/movies.ts` (~`:753`, `:785`) — movie-detail review list + count.
- `apps/server/src/routes/profiles.ts` (~`:744`) — a profile's reviews (viewer-aware: owner
  sees all, visitor sees only what the predicate allows).
- `apps/server/src/routes/feed.ts` (×2) — activity-feed review rows.

Logs (new enforcement — none today)
- `apps/server/src/lib/movie-following-ratings.ts` / `friends-ratings.ts` — "people you follow"
  rating rows on movie/TV detail.
- Profile filmography scores (`patronLogPosterCaption` path in the profiles route) on **other**
  users' profiles and list detail.
- `apps/server/src/lib/feed-rating-divergence.ts` — feed divergence rows.
- The `PatronWatchLedgerDrawer` data source (the "who logged this" drawer behind Film/TV rank
  counts) — attributed, so it respects visibility.
- List-owner log scores / another user's diary surfaced anywhere.

**Aggregates (always count everything — untouched):**
- A title's total log count and average score.
- Film/TV rank **ordering** (the numeric ranking), distinct from the attributed ledger drawer.
- Your own badges, goals, challenges, watch streak, taste signature, activity-signature heatmap
  (you are always the author of your own data).

### Special cases (decided)

- **Creator recognition / Community spotlights** (`apps/server/src/lib/creator-recognition.ts`)
  stay **public-only**. Restricted reviews never feed Community ranking or curator spotlights.
- **Pinned reviews** (`profile-pinned-reviews.ts`) **must be public**. You cannot pin a
  restricted review to a public profile strip. Enforce at pin-time (`PATCH /profiles/me/pins`)
  and at read-time.
- **Blocks** are out of scope and unchanged. This spec adds visibility tiers only; it does not
  modify existing block enforcement.

## UI

- **Review composer** (`apps/web/src/components/review/review-composer.tsx`): add a visibility
  picker using the existing `StillPopoverSelect` (matches the scope/season pickers already in
  the composer). Four options with plain-language labels + a one-line descriptor each, e.g.
  *Friends — only people you follow back*. Pre-filled per the link rule above.
- **Quick Log** composer: same `StillPopoverSelect`, placed near the venue/rewatch
  `SegmentedPillToolbar`.
- **Settings**: a "Default visibility for new posts" row bound to `profile.default_visibility`,
  styled like existing settings rows.
- **Author reader affordance**: when the author views their own restricted review/log, show a
  small lock/people glyph chip indicating who can see it (reuses existing icon-chip styling in
  the detail UI).

## API changes

- `apps/server/src/routes/reviews.ts`: rename body field `isPublic → visibility`
  (`content_visibility` literal union) in create + patch schemas; create defaults to the
  author's `profile.default_visibility` when omitted.
- Log create/edit routes (`apps/server/src/routes/logs.ts` + quick-log/tv-watch paths) gain an
  optional `visibility` field, defaulting to the account default.
- All affected list/detail GETs accept the (already-available) session user and thread it into
  the predicate.

## Migration & rollout

1. Migration `0016_content_visibility`:
   - `CREATE TYPE content_visibility AS ENUM (...)`.
   - `ALTER TABLE review ADD COLUMN visibility content_visibility`; backfill from `is_public`;
     set `NOT NULL`; `DROP COLUMN is_public`.
   - `ALTER TABLE log ADD COLUMN visibility content_visibility NOT NULL DEFAULT 'public'`.
   - `ALTER TABLE profile ADD COLUMN default_visibility content_visibility NOT NULL
     DEFAULT 'public'`.
   - Add supporting indexes.
2. Ship the backend predicate, read-path swaps, API rename, and UI **together**. Because all
   existing data backfills to `public`, behavior is identical until a patron opts in — no
   feature flag needed.

## Testing

- Unit-test the predicate builder against the full {visibility} × {viewer relationship} matrix,
  mirroring the existing `*.test.ts` style next to `movie-following-ratings.test.ts`.
- A test asserting a title's aggregate log count is **unchanged** when a contributing log flips
  to `private`.
- A test asserting `GET /reviews/:id` returns 404 for a stranger on a `friends` review and 200
  for a mutual follower.
- A test asserting pinning a non-public review is rejected.

## Out of scope

- Block-relationship enforcement (unchanged).
- A dedicated "friends" product distinct from mutual-follow (graph stays mutual-follow).
- Per-recipient / custom audience lists.
- Retroactive bulk visibility editing UI (single-item edits only for now).
