# TV Watching Progress & Scoped Diary Logs

**Status:** Approved (brainstorm 2026-05-20)  
**Date:** 2026-05-20  
**Scope:** Serial TV and anime-style shows on Still — progress tracking separate from diary, flexible log scopes, in-app new-episode notifications  
**Builds on:** TV diary/watchlist parity (`tv_id` on `log` / `watchlist_item`), TMDb TV detail (`/tv/[id]`)

## Summary

Patrons today can log a **whole TV show** once (`tvId` on `log`), which does not express “finished season 1 only,” weekly episode progress, or paused/abandoned series. This design adds a **Watching** layer (progress + status) alongside **scoped diary logs** (whole show / season / episode), inspired by Trakt-style tracking plus Letterboxd-style diary moments.

**No separate “Anime” product surface** — anime is TV on TMDb. Ongoing anime uses **episode-first** defaults and existing curated Anime browse/search tags.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Architecture | **Hybrid (approach 3):** `tv_watch` progress tracker + extended `log` for milestones |
| Progress granularity | **Patron chooses** season mode vs episode mode per show (smart defaults) |
| Watching statuses | `watching` · `paused` · `abandoned` · `finished` · `rewatching` |
| Diary scopes | `show` · `season` · `episode` (optional `season_number`, `episode_number` on `log`) |
| Watchlist | Unchanged intent (“want to watch”); **Start watching** creates `tv_watch` |
| Notifications v1 | **In-app only** when TMDb reports a new episode for shows in `watching` or `rewatching` |
| Anime community | **Not separate** — TV + episode mode + genre/curated defaults |
| Visual chrome | Same as movie/TV detail: `bg-card`, shadow depth, press motion on primaries, `motion/react` |

## Problem

1. **Whole-show logs** cannot represent partial progress (e.g. finished S1, mid-S2).
2. **No lifecycle** for dropped or paused series without fake diary rows.
3. **Weekly serials** need per-episode progress and optional light diary, not one log per series.
4. **Air dates** — patrons want to see “what’s next” and get notified in-app when a new episode exists.

## User stories

1. As a patron watching a limited series, I mark **Season 1 complete** and optionally add a **diary entry** (“Finished season 1”) with date and rating.
2. As a weekly anime viewer, I **check off each episode** after watching and see **Next: S02E04** on the show page.
3. As a patron who lost interest, I set status to **Abandoned** without polluting my diary.
4. As a returning viewer, I set **Rewatching** and can re-check episodes with optional rewatch diary logs.
5. As a patron with a show in **Watching**, I receive an **in-app notification** when a new episode is available.

## Data model

### `tv_watch` (new table)

One row per `(user_id, tv_id)` — the patron’s ongoing relationship with a show.

| Column | Type | Notes |
|--------|------|--------|
| `id` | text PK | |
| `user_id` | text FK | cascade delete |
| `tv_id` | int FK → `tv.tmdb_id` | |
| `status` | enum/text | `watching`, `paused`, `abandoned`, `finished`, `rewatching` |
| `progress_mode` | enum/text | `season` \| `episode` |
| `last_season` | smallint nullable | Last touched season (continue UX) |
| `last_episode` | smallint nullable | Last touched episode |
| `notify_new_episodes` | boolean | default true when status is watching/rewatching |
| `started_at` | timestamp | |
| `status_changed_at` | timestamp | |
| `created_at` / `updated_at` | timestamp | |

**Constraints:** unique `(user_id, tv_id)`.

### Episode progress (episode mode)

Store watched episodes per show — either:

- **Option A (preferred):** `tv_watch_episode` rows `(tv_watch_id, season, episode)` unique, or
- **Option B:** JSON map on `tv_watch` for v1 speed (`{ "1": [1,2,3], "2": [1] }`).

Season mode can derive season completion from episode data when patron switches modes, or maintain `tv_watch_season` completion flags — v1 may use season-level booleans only in season mode without full episode grid until expanded.

### Extend `log` (diary)

When `tv_id` is set:

| Column | Type | Notes |
|--------|------|--------|
| `log_scope` | text | `show` \| `season` \| `episode`; default `show` for backward compatibility |
| `season_number` | smallint nullable | Required for `season` and `episode` scopes |
| `episode_number` | smallint nullable | Required for `episode` scope |

**Validation (API):**

- `episode` → `season_number` + `episode_number` required, valid against TMDb season/episode list when possible.
- `season` → `season_number` required.
- `show` → both null.

Existing `movie_id` XOR `tv_id` check unchanged. Movie logs ignore new columns.

### Notifications

Extend existing notification model (or add kind) for `tv_new_episode`:

- Payload: `tvId`, `season`, `episode`, `showTitle`, optional `air_date`.
- Dedup: one notification per episode per user per show.
- Trigger: background sync compares TMDb `season/episode` metadata vs cached snapshot on `tv` or `tv_watch`.

### TMDb cache

- Cache season/episode lists per `tv_id` (TTL) for pickers and validation.
- Endpoints: `GET /api/tv/:id/seasons`, `GET /api/tv/:id/season/:n` (or combined in detail append).

## API surface (sketch)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/tv-watch/me` | List active watches (filters: status) |
| GET | `/api/tv-watch/me/by-tv/:tvId` | Watch row + progress for show page |
| POST | `/api/tv-watch` | Start watching (`tvId`, optional `progressMode`) |
| PATCH | `/api/tv-watch/:id` | Status, mode, notify flag |
| POST | `/api/tv-watch/:id/progress` | Mark episode/season watched |
| DELETE | `/api/tv-watch/:id/progress` | Unmark episode (optional v1) |
| POST/PATCH | `/api/logs` | Accept `logScope`, `seasonNumber`, `episodeNumber` for TV |

## UX

### TV detail hero

**No active watch:**

- Watchlist + **Start watching** (creates `tv_watch`, status `watching`, default `progress_mode` from heuristics: Animation/anime curated → `episode`; limited series / few seasons → `season`).

**Active watch:**

- Status control: Watching · Paused · Abandoned · Finished · Rewatching.
- Continue line: “Next: Season 2 · Episode 4” (+ air date if known).
- **Mark next episode watched** (primary in episode mode) — updates progress; optional “Add to diary” (default off).
- **Log to diary** — Quick Log with scope: Episode / Season / Whole show.

**Status side effects:**

- `paused` / `abandoned`: hide from continue-watching rails; show muted status on page.
- `finished`: close tracker; offer “Log series complete” diary CTA.
- `rewatching`: keep progress; optional rewatch diary on re-checked episodes.

### Progress panel

- Location: new subsection on About or dedicated **Progress** tab on TV detail.
- Toggle: **By season** | **By episode** (persisted on `tv_watch`).
- Season mode: season list + “Mark season complete” → optional diary prompt.
- Episode mode: collapsible seasons, per-episode checkboxes.
- Loading: skeleton rows matching layout; no layout shift on checkoff (optimistic UI + stable row height).

### Quick Log (TV)

Extend sheet when `tvId` present:

1. Scope step or segmented control: **Episode** · **Season** · **Show**.
2. Season/episode pickers (TMDb-backed) when scope requires.
3. Existing fields: date, rating, note, venue, liked, rewatch.

Editing existing TV logs: restore scope + numbers from row.

### Diary (`/diary`)

- Display: title + chip `S2E5` / `Season 1` / implicit whole show.
- Filters: TV venue chips unchanged; optional future **Watching** filter.

### Home

- **Continue watching** rail (signed-in): posters for `status in (watching, rewatching)` with next-episode label.
- Anime: no new community mode; use TV catalogue + curated Anime tag + episode default.

### Notifications

- Poll/sync job for watched shows.
- In-app notification in existing bell: “New episode · *Title* · S02E04” → `/tv/[id]` with progress focused.
- No email/push in v1.

## Watchlist vs Watching

| | Watchlist | Watching |
|---|-----------|----------|
| Meaning | Want to watch | Actively following |
| Data | `watchlist_item` | `tv_watch` |
| Progress | None | Seasons/episodes + status |

Starting Watching does **not** auto-create a whole-show diary log.

## Heuristics (progress mode default)

| Signal | Default mode |
|--------|----------------|
| Curated Anime tag / Animation genre | `episode` |
| `number_of_episodes` high + `in_production` | `episode` |
| Limited series / few seasons | `season` |
| Patron override | Always allowed |

## Out of scope (v1)

- Email/push notifications for new episodes.
- Social “friends on same episode.”
- Separate `/anime` community browse (marketing-only later if needed).
- Automatic scoring per episode from external APIs.
- Full calendar “upcoming episodes this week” page.
- Merging watchlist and watching into one list.

## Risks

| Risk | Mitigation |
|------|------------|
| TMDb season/episode drift | Validate on write; soft-fail with manual entry fallback |
| Progress sync vs diary confusion | Clear copy; separate primary buttons |
| Notification noise for binge drops | Dedup per episode; respect `notify_new_episodes` |
| Large episode lists UI cost | Virtualize season accordions; lazy-load season detail |
| Migration of existing TV logs | Leave as `log_scope = show`; no forced backfill |

## Testing (manual)

1. Start watching a show → status Watching, progress panel visible.
2. Episode mode: check E01–E03 → continue shows E04; no diary unless opted in.
3. Season mode: mark Season 1 complete → optional diary “Finished season 1” with chip.
4. Paused → hidden from continue rail; Abandoned → same.
5. Finished → tracker closed; diary optional for whole show.
6. Rewatching → re-check episode → optional rewatch log.
7. Simulate new TMDb episode → in-app notification → tap through to TV page.
8. Existing TV logs without scope still display as whole-show.
9. `prefers-reduced-motion`: status/panel updates without jank.

## Implementation phases (suggested)

**Phase W.1 — Schema + API core**  
`tv_watch`, progress storage, TMDb season/episode cache routes, extend log create/update validation.

**Phase W.2 — TV detail UX**  
Start watching, status control, progress panel (both modes), mark episode/season.

**Phase W.3 — Scoped Quick Log + diary display**  
Scope pickers, chips on diary rows, edit flow.

**Phase W.4 — Notifications + continue rail**  
Sync job, notification rows, home continue-watching strip.

## Approval

- [x] Hybrid architecture (approach 3)
- [x] Season + episode modes (patron choice)
- [x] Status set including Rewatching
- [x] In-app new-episode notifications (v1)
- [x] No separate Anime product surface
- [x] User approved §1–§3 in brainstorm (2026-05-20)

## Next step

Invoke **writing-plans** to produce `docs/superpowers/plans/2026-05-20-tv-watching-progress.md` with task breakdown before implementation.
