# Data settings: export, clear library, delete account — Design

**Date:** 2026-06-09
**Status:** Approved by user (brainstorming session)

## Goal

Give patrons full control of their data from Settings: download everything they have
created (Letterboxd-compatible export), wipe their watch library while keeping their
social identity, and delete the whole account via an email-verified flow.

## Decisions made during brainstorming

| Question | Decision |
| --- | --- |
| Clear-library scope | Watch data only: diary logs, ratings, TV progress, watchlist, streaks. Reviews, lists, follows, comments, profile stay. |
| Gamification on clear | Reset everything diary-derived: earned badges, challenge enrollments/progress, watch streak. |
| Export format | Letterboxd-style ZIP of CSVs (mirrors the real Letterboxd export folder layout). |
| TV in export | Film CSVs stay strictly Letterboxd-compatible; TV ships in separate `tv-diary.csv`, `tv-watchlist.csv`, and `tv-progress.csv`. |
| Account deletion | Better Auth `deleteUser` with email verification link. |
| Email infra | Set up Resend now (also unblocks password reset later). |
| Machinery | Synchronous everything — in-memory ZIP streamed from the API, single-transaction clear, no job system, no soft-delete. |
| Placement | Rename the **Imports** settings section to **Data**: import + export + danger zone in one place. |

## 1. Settings IA & UI

- Rename sidebar item **Imports → Data**; route moves to `/me/settings/data`.
  `resolveMeAccountNavPath` maps `/me/settings/imports` (and subpaths) to the new
  href so existing links and muscle memory keep working.
- Page composition, top to bottom:
  1. **Import** — existing Letterboxd CSV and Anilist JSON panels, unchanged.
  2. **Export** — one panel: short copy ("Download everything you've added to
     Sense as CSV files.") + `Export my data` button. Inline success/error
     feedback on the panel (no toast).
  3. **Danger zone** — visually separated group at the bottom with two
     destructive rows: `Clear library data` and `Delete account`, each with
     explanatory copy of what it does.
- Both destructive actions open centered confirmation dialogs styled like
  `MeAccountLeaveConfirmDialog` (rounded `bg-card` panel, icon circle, stacked
  copy, `motion/react` enter/exit) rendered at the `APP_MODAL_OVERLAY_CLASS`
  z-layer (`z-[250]`).

## 2. Export — `GET /api/me/export`

### Server

- New authed Elysia route on the server app. Builds the ZIP **in memory** with
  `fflate` (small, dependency-free) and returns it with
  `Content-Disposition: attachment; filename="sense-export-<handle>-<YYYY-MM-DD>.zip"`.
- Rate-limited to **3 requests/hour per user**, same pattern as the Letterboxd
  import route.

### ZIP contents

Letterboxd-compatible where films are concerned (so the film CSVs re-import
into Letterboxd or back into Sense):

| File | Contents |
| --- | --- |
| `profile.csv` | Date joined, username (handle), display name, bio, pronouns if present, favorite films (from the system Favorites list). |
| `watched.csv` | One row per watched film — `Date,Name,Year,Letterboxd URI` layout with the URI column left empty (we have no boxd.it IDs); adds a `TMDb ID` column. |
| `diary.csv` | Film diary logs — `Date,Name,Year,…,Rating,Rewatch,Tags,Watched Date` layout. |
| `ratings.csv` | Latest rating per film. `Rating` on Letterboxd's 0.5–5 scale (stored tenths ÷ 20), plus a `Rating10` column with the native 0.0–10.0 score. |
| `watchlist.csv` | Film watchlist only — Letterboxd layout. |
| `reviews.csv` | Published reviews with body markdown, spoiler flag, rating, linked watch date. |
| `tv-diary.csv` | TV logs with `Scope` (`show`/`season`/`episode`), `Season`, `Episode` columns. |
| `tv-watchlist.csv` | TV shows on the watchlist (name, year, TMDb ID, added date). |
| `tv-progress.csv` | `tv_watch` rows: show, status (`watching`/`paused`/`abandoned`/`finished`/`rewatching`), counts, timestamps. |
| `lists/<list-slug>.csv` | One CSV per owned list (including Favorites): position, title, year, TMDb ID, curator note. |
| `comments.csv` | Comments the user has written (review id, body, date). |
| `likes/films.csv`, `likes/reviews.csv`, `likes/lists.csv` | Hearts on films (diary `liked`), liked reviews, liked lists. |

### Web

- The Export panel button `fetch`es the route via `stillApiOrigin()` (cookies
  ride along), reads the blob, and triggers a download with an object URL.
- Button disables while generating; inline checkmark + filename on success,
  inline error message on failure (including the rate-limit case).

## 3. Clear library data — `DELETE /api/me/library`

### Server

One transaction that deletes, for the session user:

- `log` rows — movies and all TV scopes (cascades nothing we keep; `review.logId`
  FK is `set null`, so reviews survive with their mirrored rating).
- `watchlist_item` rows.
- `tv_watch` rows.
- `user_streak` row(s).
- Taste-dismissed rows (`taste_dismissed_movie`).
- Gamification state: earned badges, badge/event progress rows, challenge
  enrollments and their progress.
- System **Favorites** list items (membership derives from `log.liked`); the
  list row itself stays, empty.

Kept untouched: reviews, comments, lists (and their items, except Favorites),
list likes, follows, profile, settings, notifications, product events.

Response returns per-category deleted counts (useful for debugging and the
success message).

### Web dialog

- Warning copy lists exactly what is removed and what is kept.
- Inline **"Export your data first"** link that triggers the same export download.
- Type-to-confirm: the destructive button stays disabled until the patron types
  `clear my library`.
- On success: dialog closes, panel shows inline confirmation, `router.refresh()`
  so diary/profile/home rails reflect the empty library.

## 4. Delete account — Better Auth + Resend

### Email infrastructure

- Add **Resend**: `RESEND_API_KEY` (+ `EMAIL_FROM`) env vars in `@still/env`,
  and a small `sendEmail` helper inside `packages/auth` (it is only needed by
  auth flows today). Plain-text-first template with one button link.

### Better Auth configuration

- Enable `user: { deleteUser: { enabled: true, sendDeleteAccountVerification } }`
  in `packages/auth/src/index.ts`.
- `sendDeleteAccountVerification` sends the Resend email with the verification
  URL; the link expires per Better Auth default (24 h).
- `beforeDelete` hook: delete the user's Vercel Blob assets (profile avatar,
  custom list covers) so no orphaned blobs remain.
- DB cascades handle row cleanup. An audit pass during implementation confirms
  **every** table with a `user.id` FK uses `onDelete: "cascade"` (most already
  do); any stragglers get a migration registered in
  `packages/db/src/migrations/meta/_journal.json`.

### Web flow

1. Danger-zone row opens the confirm dialog; type-to-confirm `delete my account`.
2. Dialog calls `authClient.deleteUser({ callbackURL: "/" })`.
3. Panel switches to a pending state: "Check your inbox — the link expires in
   24 hours."
4. Patron clicks the email link → Better Auth verifies, deletes the user,
   cascades wipe all rows, session ends, redirect to the landing page.

## Error handling

- Export: rate-limit returns 429 with a friendly message surfaced inline;
  generation failures return 500 and an inline retry affordance.
- Clear library: transaction is all-or-nothing; failure surfaces an inline
  dialog error and nothing is deleted.
- Delete account: email-send failure surfaces in the dialog (the account is not
  scheduled for deletion until the email goes out); clicking an expired link
  shows Better Auth's error, and the patron can restart from Settings.

## Testing

- **Server route tests** (Bun test, `staff.test.ts` style):
  - Export: authed-only, ZIP unpacks, expected files present, film CSV headers
    match Letterboxd layout, ratings scale conversion correct, rate limit fires
    on the 4th call.
  - Clear library: watch rows + gamification gone, reviews/lists/follows/profile
    intact, Favorites list emptied but present, per-category counts returned.
  - Delete account: verification email content contains the link (mocked
    sender); completing verification removes the user row and cascades.
- **Round-trip sanity (manual):** export, then re-import `diary.csv` through the
  existing Letterboxd importer.

## Out of scope

- Async/job-based export delivery, soft-delete recovery windows, grace-period
  account deactivation, password-reset emails (Resend setup unblocks this
  later, but it is not part of this work).
