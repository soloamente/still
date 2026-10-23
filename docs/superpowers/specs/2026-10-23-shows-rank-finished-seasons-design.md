# Shows rank — finished seasons and complete series

Date: 2026-10-23. Status: approved in brainstorming, awaiting spec review.

## Problem

Community **Shows** ranks (`kind=tv`, `GET /api/leaderboard/tv`) counted every TV diary
row as one show, so ten episode logs of one show looked like ten shows. A first fix
(2026-10-23) counted distinct shows, but any episode log still made a show count.

Product decision: **Shows** reflects *finished* viewing only. Episodes are already
ranked on **Episodes** (`log_scope = 'episode'` slice) and must not leak into Shows.

## Rules

- **One point = one show** with at least one *finished season* or a *complete series*
  in the period. A show with three finished seasons is still one point.
- A **finished season** is a public diary log with `log_scope = 'season'`.
  A **complete series** is a public diary log with `log_scope = 'show'`.
  Episode-scoped logs never count toward Shows.
- A season/series counts in the period its log's `watched_at` falls in (the
  moment it was finished), not when its episodes were watched.
- Only `visibility = 'public'` logs count (unchanged community-rank rule); private
  profiles stay excluded.

## Automatic completion (server)

New `syncTvCompletionLogs(userId, tvId, language)` in
`apps/server/src/lib/tv-completion-logs.ts`:

1. Load the patron's `tv_watch_episode` rows (episode check-marks) and the cached
   TMDb catalogue (`listAllCatalogEpisodes` / season detail cache). Specials
   (season 0) are ignored.
2. For each regular season whose every catalogue episode is checked and that has
   **no** non-removed season log: insert a season log — `watched_at = now`,
   `rating = null`, `visibility = profile.default_visibility`,
   `watch_venue = 'streaming'` (same defaults the web used), `rewatch = false`.
3. If every regular season is complete and there is **no** non-removed whole-show
   log: insert a show log with the same defaults.
4. Idempotent: existence checks make repeated calls no-ops. Un-checking an
   episode never deletes an already-created log (avoids silently destroying a
   rating or review; patrons remove via Quick Log **Remove from watched**).
5. Shared pure helpers (`completedSeasonNumbers`, `isSeriesComplete`) are unit
   tested without a database.

Called after every action that changes check-marks, in `routes/tv-watch.ts`
(`POST/DELETE /:id/episodes`, `POST /:id/seasons/:n/complete`, `POST /:id/mark-next`,
`PATCH /:id` when status becomes `finished`) and in
`companion-auto-log.ts` (`markCompanionEpisode`). After inserting, call
`invalidateCommunityStatsForDiaryLog` like other diary writes.

Web: remove the client-side season-log post in `handleMarkSeasonComplete` and the
whole-show effect in `tv-detail-progress-panel.tsx`; both just refresh user state.
Leaving them would race the server and create duplicate logs.

## Shows rank query

In `apps/server/src/lib/leaderboard-query.ts`:

- `publicLogWindowConditions("tv", …)` additionally requires
  `log.log_scope in ('season', 'show')`.
- `leaderboardActivitySubquery("tv", …)` keeps `count(distinct log.tv_id)`.
- The viewer-rank and drawer total use the same conditions.

## Shows drawer

`fetchLeaderboardLogs({ kind: "tv" })` returns one item per finished-season log and
one per whole-series log (no episode rows), each carrying its scope, season number
and `watchedAt` (completion date). Poster captions reuse `tvDiaryScopeCaption`
("Season 2", "Whole series"); the date shows under the tile. This **replaces** the
earlier one-tile-per-show collapse (`collapseTvLogRowsToShows` is removed) so
patrons can see the order they finished seasons and series.

Header summary counts **distinct shows** (not tiles). The payload gains
`showCount: number` (distinct `tvId` across all public rows in the period,
including rows hidden from this viewer); `hiddenCount` for Shows is the number
of public season/series logs the viewer cannot see. The web ledger panel uses
`showCount` for the Shows summary label when present.

Lifetime/period ordinals keep working per scope unit via the existing
`leaderboardLogGroupKey` (season and series units are separate buckets).

## Backfill (separate, run on request)

`apps/server/src/scripts/backfill-tv-completion-logs.ts`: for each `tv_watch`,
run the same sync logic but date each created log from history —
season `watched_at` = max `tv_watch_episode.watched_at` in that season; series
`watched_at` = latest of its season dates. Dry-run flag prints counts only.
Not run as part of the code change; confirm with the owner before executing.

## Testing

- Unit: `completedSeasonNumbers` / `isSeriesComplete` (partial season, specials,
  all done, new season added later).
- Unit: shows rank condition includes season/show scopes only.
- Unit: drawer payload for Shows returns season and series items with correct
  captions and distinct `showCount`.
- Integration-style (mocked DB where the repo already does so): sync is
  idempotent and does not delete logs on un-check.
- Existing leaderboard tests keep passing; Episodes board unchanged (its scope
  predicate already lets episode logs win over a season log, and a season log
  win over a show log).

## Plan-time refinements (2026-10-23)

Settled while reading the code for the implementation plan
(`docs/superpowers/plans/2026-10-23-shows-rank-finished-seasons.md`):

- Auto-created logs use `visibilityForAutoLog` (profile default visibility; an
  unverified email falls back to `private`), extracted from `companion-auto-log.ts`.
- A season that already has a season log counts as finished for the whole-series
  check even without check-marks (a hand-logged season is still a seen season).
- The sync hooks into `reconcileTvWatchProgress` (already called by every
  check-mark route and the Companion) plus an explicit call after
  `PATCH /api/tv-watch/:id` sets `finished`.
- Season tiles on the Shows drawer take their score from the patron's rated
  logs for that show (any scope visible to the viewer), because episode logs are
  excluded from the Shows window query.
- `showCount` = max(public distinct shows, distinct shows visible to the viewer).
- The backfill script lives in `apps/server/scripts/` (repo convention), not `src/scripts/`.
- Tests: pure core rules and Shows board helpers are unit tested; the DB
  orchestration is idempotent by its existence checks and is verified manually
  (no DB mocking harness exists for these libs).

## Out of scope

Deleting auto-created logs on un-check, rating inheritance onto auto logs,
changing the Episodes board, and any change to Films ranks.
