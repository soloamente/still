# Community Patron Score From Diary Logs

**Status:** Implemented (2026-06-03)  
**Date:** 2026-06-03  
**Scope:** Film and TV detail **Sense community rating** hero and related aggregates use **public diary log scores**, not published reviews  
**Builds on:** `log` ratings (`apps/server/src/routes/movies.ts`, `tv.ts`), `MovieDetailCommunityRatingHero`, `MovieDetailExploreTabs`, `review` table (unchanged for Reviews tab)

## Summary

The large **patron community score** on movie/TV detail (Reviews section hero, compact score under the title, Quick Log community ghost bar) today averages **`review.rating`** for **public published reviews**. Patrons expect a **Letterboxd-style community average** from **diary scores** — one current rating per patron per title (rewatch updates the same log). Published **reviews** remain in the **Reviews** tab only and do **not** feed the hero average.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Data source | **`log.rating`** on diary rows, not `review.rating` |
| Patron dedupe | **One score per patron** — rewatch edits the existing log; no stacked rewatches in the average |
| Visibility | **`visibility = 'public'`** only (same bar as today’s public review aggregate) |
| Rated only | **`rating IS NOT NULL`** — heart-only logs (`liked` without score) excluded |
| Movies | All qualifying public rated logs for `movieId` |
| TV | Public rated logs for `tvId` with **`logScope = 'show'`** only (series-level score; exclude season/episode diary rows) |
| Scope | **Movies + TV** in one pass |
| API approach | **Replace** `community` aggregate on `GET /api/movies/:id` and `GET /api/tv/:id` (not dual review + log fields) |
| Reviews tab | **Unchanged** — still lists published reviews; separate from community hero |
| Empty hero | **No fallback** to review average when no public rated logs |
| Count label (UI) | **“rating” / “ratings”** (patron diary scores), not “review(s)” |

## Problem

1. **Sense community rating** copy and math describe **reviews** (`communityReviewsCount`, “Publish a review…”), while patrons rate titles primarily via **diary logs**.
2. TV detail returns a **stub** `community: { averageRating: null, reviewsCount: 0 }` — no real community score despite TV diary usage.
3. Headline tiers (“Patron favorite”, “Well rated”) use **review count** thresholds — misleading once the metric is diary-based.

## User stories

1. As a visitor on `/movies/[id]`, I see the **community score** reflect the average of patrons’ **public diary ratings** for that film.
2. As a patron who rewatches and **edits my score**, my contribution to the average is my **current** score, not duplicate rows.
3. As a visitor on `/tv/[id]`, I see the same patron-score hero when patrons have **series-level** public ratings.
4. As a patron writing a **review**, the Reviews tab still shows reviews; the hero does not require a review to exist.
5. As a patron opening **Quick Log**, the ghost/community hint uses the same **diary-based** average as the hero.

## Non-goals

- Changing how **reviews** are written, ranked, or displayed in the Reviews tab.
- Including **private** or **followers-only** logs in the public community number.
- Episode- or season-level TV logs in the **show-level** community average.
- Blending review and log averages into one hybrid score.
- Community aggregates on **home**, **Community**, or **leaderboards** (detail-only unless noted in implementation plan).

## Technical design

### Shared server helper

Add e.g. `fetchPublicDiaryCommunityStats` in `apps/server/src/lib/` (name at implementer’s discretion):

**Input:** `{ movieId?: number; tvId?: number }` — exactly one set.

**Query rules:**

- Table: `log`
- Filters:
  - `movieId` or `tvId` match
  - `visibility = 'public'`
  - `rating IS NOT NULL`
  - TV: `logScope = 'show'`
- **Average:** `reviewRatingDisplayAvgSql('log.rating')` (existing tenths + legacy 1–10 handling via `apps/server/src/lib/review-rating.ts`)
- **Count:** `COUNT(DISTINCT log.user_id)` — patron count, not log row count

**Output:**

```ts
{ averageRating: number | null; ratingsCount: number }
```

`averageRating` is null when `ratingsCount === 0`.

### API changes

#### `GET /api/movies/:id`

Replace the current `review` aggregate block (lines ~749–780 in `movies.ts`) with the diary helper for `movieId`.

Return:

```ts
community: {
  averageRating: number | null;
  ratingsCount: number;
}
```

**Breaking rename:** `reviewsCount` → **`ratingsCount`**. Update Eden/`api-client` consumers and web types in the same change.

#### `GET /api/tv/:id`

Replace stub `community: { averageRating: null, reviewsCount: 0 }` with the diary helper for `tvId` (show scope).

### Web UI

| Surface | Change |
|---------|--------|
| `MovieDetailCommunityRatingHero` | Props: `communityRatingsCount` (or generic `patronRatingsCount`); copy: “X ratings”, empty: “Log with a score…”; headlines reference **diary ratings**, not reviews |
| `movie-detail-explore-tabs.tsx` | Pass renamed count prop |
| `movie-detail-about-async.tsx` | Same |
| `apps/web/src/app/(app)/movies/[id]/page.tsx` | Read `community.ratingsCount`; hero subline “ratings” not “reviews” |
| `apps/web/src/app/(app)/tv/[id]/page.tsx` | Wire real `community` from API; align hero with film detail (consider `MovieDetailCommunityRatingHero` in explore stack vs legacy `StarRating` block — implementation plan picks minimal diff for parity) |
| `tv-detail-community-async.tsx` | Pass `communityAverage` + `ratingsCount` into `MovieDetailExploreTabs` |
| `use-movie-detail-user-state` / Quick Log | Continue using `community.averageRating` (now log-sourced) |

**Headline tiers** (`patronScoreHeadline` in `movie-detail-community-rating-hero.tsx`):

- Keep numeric thresholds (e.g. ≥8 reviews → ≥8 **ratings**) but rename variables and description strings.
- Remove “published reviews” wording; e.g. “member diary ratings on Sense’s 0–10 scale”.

### Edge cases

| Case | Behavior |
|------|----------|
| No public rated logs | Hero shows em dash; empty copy prompts logging with a score |
| Log exists, no numeric rating | Excluded from average and count |
| Private rated log | Excluded |
| Multiple logs same user same movie | Should not happen for normal flows; SQL `DISTINCT user_id` still safe |
| TV episode log with score | Excluded from show community average |
| Review exists, no public rated log | Hero empty; reviews still visible in tab |

## Testing

| Case | Expected |
|------|----------|
| Two patrons, public rated movie logs | `averageRating` = mean of display-scale scores; `ratingsCount` = 2 |
| Same patron, two log rows (data anomaly) | `ratingsCount` = 1 |
| Private rated log only | `ratingsCount` = 0, `averageRating` null |
| Public review, no public rated log | Hero empty; reviews tab still has review |
| TV show-scope public rating | Non-null community on `GET /api/tv/:id` |
| TV episode-scope public rating | Does not affect show community stats |
| Web hero copy | Shows “N ratings” when N > 0 |

## Migration / compatibility

- **API:** Rename `community.reviewsCount` → `community.ratingsCount` on movie and TV detail payloads. Grep monorepo for `reviewsCount` on `community` objects only (badge evaluator uses a different `reviewsCount` — do not change).
- **No DB migration** — read-only aggregate change.

## References

- `apps/server/src/routes/movies.ts` — current review aggregate
- `apps/server/src/routes/tv.ts` — stub community
- `apps/web/src/components/movie/movie-detail-community-rating-hero.tsx`
- `apps/server/src/lib/review-rating.ts` — `reviewRatingDisplayAvgSql`
- `packages/db/src/schema/activity.ts` — `log.rating`, `visibility`, `logScope`

## Open questions

None blocking — all product choices locked in brainstorm.
