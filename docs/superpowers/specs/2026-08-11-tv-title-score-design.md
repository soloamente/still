# TV title score — derived from season / episode diary ratings

**Date:** 2026-08-11  
**Status:** Approved for implementation planning (brainstorm Approach 1)  
**Product:** Sense  
**Related:** `2026-05-27-tv-log-rewatch-scope-design.md` (scoped diary rows); Community Film/TV ranks ledger UX (season labels)

## Problem

Patrons rate TV at **show**, **season**, and **episode** diary scopes. Surfaces that need “this patron’s score for the series” often use a **raw log rating** (latest row, or one row per season). On the Shows watch ledger and similar grids, that paints **multiple posters of the same series each with a different score**, which reads as several fake “show ratings” instead of one title score.

Community score for TV today only counts `log_scope = show`, so season-only diaries never contribute.

## Goals

1. One **derived title score** per patron per series, used product-wide wherever we mean “their score for this show.”
2. Respect diary truth: keep scoped log rows; **do not** rewrite Quick Log storage in v1.
3. Prefer an explicit whole-series rating when present; otherwise roll up from seasons / episodes.

## Non-goals (v1)

- Materializing a cached score on write / synthetic show log rows.
- Changing Episodes rank weighting.
- Weighting seasons by episode count (unweighted mean of season scores).
- Changing how diary lists or Quick Log edit individual season/episode rows.
- Inventing scores from favorites (`liked`) alone.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Product-wide title score (not ledger-only) |
| Whole-series rated logs | **Win** — mean of show-scoped ratings is the title score; no season roll-up |
| Otherwise | Episode ratings → season score → mean of season scores → title score |
| Rewatches within a unit | **Mean** of all rated logs for that unit |
| Architecture | Shared **pure resolver** on read (`tv-title-score.ts`) |
| Rounding | Mean in stored **tenths**, round to nearest integer tenths |

## Score algorithm

Input: diary logs for one `(userId, tvId)` that are not removed and have `rating != null` (caller applies visibility).

Stored ratings are integer tenths `0–100` (`log.rating`).

1. Normalize each log: missing/`null` `logScope` → treat as `"show"` (matches diary default).
2. Let `showRated` = rated logs with `logScope === "show"`.
3. If `showRated` is non-empty → return `round(mean(showRated.rating))`.
4. Else group remaining rated logs by season:
   - `season` scope with a valid `seasonNumber` → bucket that season.
   - `episode` scope with a valid `seasonNumber` → same season bucket.
   - Season or episode rows missing `seasonNumber` → **ignore**.
5. For each season bucket with any ratings:
   - If any **season**-scoped rated logs exist in the bucket → season score = mean of those season-scoped ratings only.
   - Else → season score = mean of **episode**-scoped ratings in the bucket.
6. If no season scores → return `null`.
7. Else return `round(mean(seasonScores))`.

A patron contributes to community `ratingsCount` only when the resolved score is non-null.

## Architecture

### Module

`apps/server/src/lib/tv-title-score.ts`

- `resolveTvTitleScore(logs: TvTitleScoreLog[]): number | null`
- Pure; unit-tested; no DB.

Optional small helpers for mean/round stay in the same file.

### v1 read surfaces

| Surface | Behavior |
| --- | --- |
| `fetchPublicDiaryCommunityStats` (TV) | Stop filtering to show-scope only. Per patron, resolve from their public rated TV logs; aggregate mean of resolved scores + count |
| `fetchFollowingRatingsForTv` | Per followed patron, resolve from visible rated TV logs (not latest raw season/episode row). `liked` may still come from latest/any favorite signal with `rating: null` when resolve is null |
| Profile filmography / list poster captions for TV | Use resolved title score when the UI means “score for this show” |
| Shows watch ledger | Keep one tile per diary row with **Whole series / Season N / S#E#** labels. Season tile caption rating = that season’s mean (or episode mean). Do **not** present each season’s raw log rating as if it were the series title score. Series-level score uses the resolver when a series score is shown |

### Visibility & cache

- Community: public, non-removed only (unchanged gates aside from scope expansion).
- Following / private: existing `contentVisibilityWhere`.
- Bump or invalidate listing community Redis cache so pre-change show-only averages do not linger.

## Testing

1. **Pure fixtures** (`tv-title-score.test.ts`): show wins; season mean; episode→season→show; rewatch mean within unit; empty → null; invalid seasonNumber ignored; season-scoped preferred over episodes in the same season.
2. **Community TV**: season-only patron contributes; show-scoped rating wins for that patron over their seasons.
3. **Following TV**: chip shows resolved score, not a misleading latest season row.

## Rollout

1. Land helper + tests.
2. Wire community + following (highest “title score” confusion).
3. Wire profile / list captions.
4. Adjust Shows ledger caption rules if any path still paints season ratings as series scores.
5. Manual QA on a series with multiple rated seasons and one with a show-scoped rating.

## Open follow-ups (not v1)

- Write-side materialization if resolver cost shows up on hot paths.
- Episode-count-weighted season averages.
- Patron-facing breakdown UI (“8.2 from Seasons 1–3”).
