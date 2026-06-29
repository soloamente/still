# Onboarding log visibility + drawer private reconciliation

**Date:** 2026-06-30
**Status:** Approved design — pending implementation plan

## Problem

Titles a user rates during onboarding are counted by the leaderboard ranking but
are invisible everywhere else (profile, community, the leaderboard "drawer"). The
ranking shows "N titles logged" while the drawer shows fewer posters, with no
explanation for the gap.

### Root cause (verified)

- Onboarding writes each taste rating as a log with a **hardcoded
  `visibility: "private"`** — `apps/web/src/components/onboarding/onboarding-wizard.tsx`
  (~line 278, the `postLog` dep in `runOnboardingFinish`).
- The leaderboard **ranking count** (`fetchLeaderboard` → `baseLogConditions` in
  `apps/server/src/lib/leaderboard-query.ts`) counts **every** in-window log. It
  does **not** apply `contentVisibilityWhere`, so private logs are counted.
- Every **viewer-scoped read** *does* apply `contentVisibilityWhere`
  (`apps/server/src/lib/content-visibility.ts`): profile filmography
  (`profiles.ts`), community/activity feeds, and the leaderboard drawer
  (`fetchLeaderboardLogs`, the `contentVisibilityWhere(...)` calls). These hide
  `private` from anyone who is not the owner.

Investigation findings that shaped the design:

- **0 orphaned logs** in the DB — `ensureMovieCached` (`logs.ts` POST) works, so
  the diary/profile inner joins on `movie`/`tv` are fine. The earlier
  "un-enriched catalogue" hypothesis was disproven by querying the DB.
- The owner's **own `/diary`** (`GET /api/logs/me/diary`) applies **no** visibility
  filter and returns the owner's private logs. Verified against the DB: for the
  user with 24 private movie logs, the diary query returns all 24. **No diary fix
  is needed.**
- New profiles default to `defaultVisibility = "public"`
  (`packages/db/src/schema/profile.ts`), and the log POST resolves
  `body.visibility ?? profile.defaultVisibility ?? "public"`
  (`apps/server/src/routes/logs.ts` ~184–192).
- The public-visibility email-verification gate (`isPublicContentVisibility` →
  `assertEmailVerified`, `logs.ts` ~194) is **not** tripped by the change, because
  the full onboarding flow routes unverified users through the **verify** step
  before "taste" (`stepAfterBio`, `onboarding-wizard.tsx` ~67), so email is
  verified by the time `finishFull` posts the logs. The abbreviated finish path
  posts no logs.

## Decisions

1. Onboarding-rated titles should inherit the user's **profile default**
   visibility (effectively `public` for new accounts), not be forced private.
2. Also run a **targeted backfill** for users whose onboarding titles are already
   stuck private.
3. When a **non-owner** opens the leaderboard drawer, the hidden private titles
   are represented with **lock placeholder tiles** (count reconciles to the
   ranking number); no title/poster data is sent for them.

## Design

### Part 1 — Forward fix

Remove the hardcoded `visibility: "private"` from the onboarding `postLog` payload
in `onboarding-wizard.tsx`. Keep `movieId`, `rating`, `watchedAt`, `watchVenue`.
The server then resolves visibility from `profile.defaultVisibility`. Onboarding
titles become ordinary logs and appear on all viewer-scoped surfaces.

The existing `isEmailVerificationRequiredError` handling in the onboarding
`postLog` stays as a defensive guard.

### Part 2 — Targeted backfill

A one-off script (mirroring the existing `palette:backfill` script pattern under
`apps/server/scripts/`), runnable via `bun run`, that:

1. Prints a **dry-run count** of the rows it would change.
2. Only performs the `UPDATE` when invoked with an explicit `--apply` flag.

Scope (AND-ed for precision), joined to `profile` by `user_id`:

```sql
UPDATE "log" l
SET visibility = p.default_visibility
FROM "profile" p
WHERE l.user_id = p.user_id
  AND p.onboarded_at IS NOT NULL
  AND p.default_visibility <> 'private'     -- skip pointless updates
  AND l.visibility = 'private'
  AND l.movie_id IS NOT NULL                -- onboarding only rates movies
  AND l.note IS NULL                        -- onboarding logs are rating-only
  AND l.rating IS NOT NULL
  AND l.removed_at IS NULL
  AND l.created_at <= p.onboarded_at
  AND l.created_at >= p.onboarded_at - interval '15 minutes';
```

Rationale: onboarding logs are written immediately **before** `markOnboarded`
sets `onboarded_at`, so they land in a tight window just before it. Intentional
private logs happen *after* onboarding completes and fall outside the window. The
15-minute window absorbs slow connections. Conservative by design — better to
miss a few than to expose an intentionally-private log.

### Part 3 — Drawer private reconciliation

**Server** (`apps/server/src/lib/leaderboard-query.ts`, `fetchLeaderboardLogs`):
add `hiddenCount: number` to the returned payload (and its type), for both
`films` and `tv`. Computed as:

```
hiddenCount = (in-window qualifying logs for this patron, same window/media/
               removedAt/isNotNull conditions, WITHOUT contentVisibilityWhere)
            - (visible log rows returned)
```

For the owner viewing themselves, `contentVisibilityWhere` returns all rows, so
`hiddenCount = 0`. No data about the hidden titles (no poster, title, id) is
included in the payload — only the integer.

**Client** (`apps/web/src/components/home/patron-watch-ledger-grid.tsx` /
`patron-watch-ledger-panel.tsx`): when `hiddenCount > 0`, render the visible
posters followed by `hiddenCount` **lock placeholder tiles** (no poster, no
title, `aria-label="Private title"`). The grid then fills to match the ranking
number, making the private slots explicit to a non-owner.

## Testing

- **Forward:** assert onboarding logs resolve to `public` from the profile default
  (no forced `private`).
- **Backfill:** verify the window heuristic flips an onboarding-era private log
  but leaves a post-onboarding intentional private log untouched.
- **Drawer:** unit-test `hiddenCount` — non-owner sees the gap, owner sees `0`;
  confirm no title/poster fields are present in the payload for hidden logs.

## Risks & rollback

- Low and contained. No schema change.
- The only information about private logs that reaches a non-owner is an integer
  count (already implied by the ranking number).
- Rollback: revert the onboarding one-line change; the backfill is window-scoped
  and dry-run-previewed, and a corrective `UPDATE` can reverse a mistaken flip.

## Out of scope

- Changing whether the leaderboard ranking counts private logs (kept as total
  activity).
- Per-user opt-in tooling to re-publish early logs.
- Onboarding `watchVenue` semantics.
