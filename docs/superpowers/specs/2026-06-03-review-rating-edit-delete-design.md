# Review rating precision, log sync, and owner edit/delete

**Date:** 2026-06-03  
**Status:** Approved (design)

## Summary

Two patron-facing problems:

1. **Score mismatch** — Diary logs use **0.0–10.0** (stored as tenths, e.g. `87` = 8.7). Publishing a review from that log rounds to a **whole 1–10** integer (`8.7` → `9`), so the review reader shows **9.0** while the composer showed **8.7**.
2. **No review management UI** — `PATCH` and `DELETE` on `/api/reviews/:id` exist, but the review detail sheet only offers **Pin to profile** and **Done**.

**Decisions from product interview:**

- **Edit/delete entry points:** Review detail sheet only (not feed cards, profile list, or movie hero).
- **Linked review scores:** Always follow the diary log; when the log rating changes, the review score updates (no independent review rating when `log_id` is set).

---

## Root cause (rating)

| Layer | Current behavior |
|--------|------------------|
| `log.rating` | Tenths `0–100` |
| `review.rating` | Written via `diaryStoredToReviewApiRating` → `Math.round(display)` → whole `1–10` |
| API validation | `t.Integer({ minimum: 1, maximum: 10 })` on POST/PATCH |
| Review reader | `formatLogRatingDisplay(review.rating)` — treats `9` as legacy whole score → **9.0** |

`AGENTS.md` already documents tenths for both `log.rating` and `review.rating`; server and composer were not fully migrated.

---

## Approach: tenths + sync on log write

**Chosen over** read-time-only joins (every feed must join `log`) or dropping `review.rating` when linked (larger refactor).

### Rating rules

| Event | Behavior |
|--------|----------|
| Publish review (linked `logId`) | `review.rating = log.rating` (exact tenths, no rounding) |
| Publish review (no log) | Slider → `logRatingToStored` → tenths on `review.rating` |
| `PATCH /api/logs/:id` (`rating` changed) | `UPDATE review SET rating = :new WHERE log_id = :id AND user_id = :owner` |
| Log rating cleared (`null`) | Set linked `review.rating` to `NULL` |
| `PATCH /api/reviews/:id` | Ignore/reject `rating` when `review.logId` is not null |
| Display | `formatStoredLogRatingDisplay` everywhere for review scores (fix `review-detail-sheet.tsx`) |

### API contract

- POST/PATCH body: `rating` optional integer **`0–100`** (tenths), same as logs.
- Remove `diaryStoredToReviewApiRating` rounding helpers from publish path; copy `log.rating` verbatim when linking.
- Deprecate whole-number-only validation (`1–10`).

### Migration / backfill

One SQL migration:

1. Rows with `log_id`: `UPDATE review SET rating = log.rating FROM log WHERE review.log_id = log.id`.
2. Orphan rows where `rating` is `1..10` (legacy whole): `rating = rating * 10`.
3. Leave values already `11..100` unchanged.

### Aggregates

`avg(review.rating)` on movies (and any leaderboard SQL) must normalize tenths to display scale, e.g. `avg(CASE WHEN rating > 10 THEN rating / 10.0 ELSE rating END)` or shared server helper — audit all `review.rating` aggregates in `apps/server`.

---

## Edit & delete (review detail sheet only)

### Owner footer (`ReviewDetailRoot`)

When `session.user.id === review.userId`, footer layout:

```
[ Delete ]     [ Pin to profile ]     [ Edit ]     [ Done ]
```

- **Delete** — destructive text control (not radial toolkit). Confirm via dialog aligned with `QuickLogRemoveConfirmDialog` (`APP_MODAL_OVERLAY_CLASS`, `z-[250]`). Title/copy: “Delete this review?” / “This can’t be undone.” → `DELETE /api/reviews/:id` → success toast → close sheet → `router.refresh()`.
- **Edit** — `useReviewComposer().open({ reviewId, … })` in **edit mode** (see below).
- **Pin** / **Done** — unchanged.

### Review composer edit mode

- `reviewId` in composer args → fetch review (or seed from detail payload) on open.
- Prefill: title, body, spoilers, visibility.
- Submit: `PATCH /api/reviews/:id` (not POST).
- Copy: “Edit your review” / toast “Review updated”.
- **Rating UI (decision C):**
  - If `logId` present: read-only score from linked log (live tenths); no slider; PATCH omits `rating`.
  - If no `logId`: tenths slider; PATCH may include `rating` as tenths.

### Server: delete side effects

On `DELETE /api/reviews/:id`:

1. Delete row (existing).
2. Remove `params.id` from owner `profile.pinned_review_ids` JSON array if present (max 3 pins — avoid stale pin IDs).

Reactions/comments: confirm FK cascade or explicit cleanup; document in implementation plan.

---

## Files (expected touch)

| Area | Files |
|------|--------|
| Migration | `packages/db/src/migrations/00xx_review_rating_tenths.sql`, `meta/_journal.json` |
| Server | `apps/server/src/routes/reviews.ts`, `apps/server/src/routes/logs.ts` |
| Shared rating | `apps/web/src/lib/log-rating.ts` (remove/replace `diaryStoredToReviewApiRating` for API), mirror in server if duplicated |
| Web UI | `review-detail-sheet.tsx`, `review-composer.tsx`, new `review-delete-confirm-dialog.tsx` (or reuse pattern from quick-log) |
| Display fixes | Any review list still using wrong formatter |
| Tests | `log-rating` unit tests; server integration for log PATCH → review sync |

**Out of scope:** Edit/delete on `ReviewCard`, profile reviews panel, Community feed rows, movie detail hero.

---

## Testing

### Automated

- `logRatingToStored(8.7)` → `87`; publish payload sends `87`, not `9`.
- Log PATCH `rating: 92` updates linked review to `92`.
- PATCH review with `logId` + `rating` in body → rating unchanged (ignored).

### Manual

1. Log film at **8.7** → Add review → composer shows **8.7** → publish → reader shows **8.7** (not 9.0).
2. Edit log to **9.2** → reopen review → **9.2**.
3. Open own review → **Edit** → change body → save → **Delete** with confirm → review gone; pin strip updated if pinned.

---

## Self-review (spec QA)

- [x] No TBD sections; scope bounded to sheet-only edit/delete.
- [x] Rating approach consistent with log tenths and decision C (sync on log write + locked composer).
- [x] Pin cleanup on delete called out explicitly.
- [x] Single implementation plan sized for one PR/track.
