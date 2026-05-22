# Auto Favorites List & Profile Favorites Filter

**Status:** Approved (brainstorm 2026-05-20)  
**Date:** 2026-05-20  
**Scope:** System-owned “Favorites” list synced from diary hearts (`log.liked`); profile Movies/TV ledger gains an optional favorites-only filter  
**Builds on:** Diary logs (`log.liked`), lists (`list` / `list_item`), profile ledger (`/profile/[handle]?tab=movies|tv`)

## Summary

When a patron favorites a film or series (heart on detail / diary), Still maintains **one system list** containing every title they have favorited. The list is **not manually curated** — only `log.liked` drives membership. On profile **Movies** and **TV** tabs, the default view remains **all watched** titles; a new **All · Favorites** filter narrows the grid to hearted logs only.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Favorite source | **`log.liked`** on movie or TV diary logs (existing heart / “Favorite” affordance) |
| List ownership | **One system list per user** — auto-created on first favorite |
| List editability | **System-owned** — items add/remove only via heart toggle; list not deletable |
| List visibility | **Public by default** (`isPublic: true`) unless product revises before build |
| Item ordering | **Most recently favorited first** (use log `updatedAt` when `liked` flips on) |
| TV on lists | **`list_item.tv_id`** added (XOR `movieId`) — parity with `log` / `watchlist_item` |
| Profile default | **All watched** on Movies / TV tabs (unchanged) |
| Profile filter | **URL-backed** `?favorites=1` with **All \| Favorites** chip on ledger rails |
| Filter composition | Favorites filter applies **after** existing **venue** slice (`theaters` / `streaming`) |
| Social “Favorites” tab | **Repoint or hide** — avoid second source (`favoriteMovieIds`); prefer deep-link to `?tab=movies&favorites=1` |
| Profile showcase | **`favoriteMovieIds` on About** may remain for v1 (separate from heart list); no migration in v1 |
| Sync trigger | **`POST` / `PATCH` logs** when `liked` changes (same transaction as log write) |
| Profile filter UX | **Approach 1** — ledger chip + `searchParams`, not client-only toggle |

## Problem

1. Patrons who heart titles have **no single list** aggregating favorites across films and TV.
2. Profile **Favorites** tab today uses **`favoriteMovieIds`** (curated showcase), not diary hearts — inconsistent with detail **Favorite** action.
3. **`list_item` is movie-only**, so series favorites cannot appear on a list without schema work.
4. Patrons want profile to show **full watch history** with an **optional** favorites-only view, not favorites-only by default.

## User stories

1. As a patron, when I favorite a film on its detail page, it appears in my **Favorites** list without manual list editing.
2. As a patron, when I unfavorite a series, it is **removed** from that list.
3. As a patron browsing my profile **Movies** tab, I see **all** films I’ve logged by default, and can switch to **Favorites** to see only hearted logs.
4. As a patron, I can combine **Favorites** with **In cinemas / At home** venue chips on profile.
5. As a visitor, I can open a patron’s public **Favorites** list like any other public list (read-only item management).

## Data model

### Extend `list`

| Column | Type | Notes |
|--------|------|--------|
| `systemKind` | text nullable | e.g. `'favorites'`; null = normal user list |
| Unique partial index | | one row per `(user_id)` where `systemKind = 'favorites'` |

**System list defaults on create:**

- `title`: `"Favorites"`
- `slug`: stable convention e.g. `favorites` (scoped per user via list `id`)
- `isPublic`: `true`
- `isRanked`: `false`
- `description`: optional short system copy (“Titles you’ve favorited.”)

### Extend `list_item`

| Column | Type | Notes |
|--------|------|--------|
| `tvId` | int FK nullable | → `tv.tmdb_id` |
| Check constraint | | XOR `movieId` / `tvId` (same pattern as `log`) |
| Primary key | | migrate from `(listId, movieId)` to `(listId, movieId, tvId)` or use surrogate — implementation plan must pick safe migration |

**Uniqueness:** one item per `(listId, movieId)` or `(listId, tvId)`.

### No new favorite table

`log.liked` remains the source of truth. The system list is a **materialized view** for Lists UI and sharing, kept in sync on write.

## Sync behavior

### Ensure system list

Helper `ensureFavoritesList(userId)`:

- If no list with `systemKind = 'favorites'`, insert list row.
- Return `listId`.

### On `liked: true`

1. Resolve `movieId` or `tvId` from log.
2. Ensure favorites list exists.
3. Upsert `list_item` (ignore if already present).
4. Update `itemsCount`, `coverMovieIds` / cover snapshot per existing list helpers.
5. Bump `list.updatedAt` (activity feed may surface list updates — acceptable).

### On `liked: false`

1. Delete matching `list_item` for that title.
2. Refresh counts and cover snapshot.
3. List row remains (may be empty).

### Idempotency

- Multiple logs for same title: **one** list entry per `movieId` / `tvId` (dedupe by title id, not log id).
- First heart may create minimal log (existing detail behavior) — sync runs after log persist.

### API guardrails

- Reject **delete list** when `systemKind = 'favorites'`.
- Reject **add/remove/reorder items** on system favorites list via public list mutation routes (or no-op with 403).
- Allow **read** and **cover** endpoints as today.

## Profile filter

### Query param

- `?favorites=1` (or `favorites=true`) on profile Movies / TV URLs.
- Omit param = **All** (default).

### Chip UI

- Add **All \| Favorites** control on profile ledger chrome when `activeTab` is `movies` or `tv`.
- Placement: left rail with order chips, or compact group — must not crowd center tabs; follow `ProfileLobbyChrome` grid.
- Persist in `buildProfileLobbyHref` / `profile-lobby-order.ts`.

### Server / client filter

Filter `ProfileFilmographyRow[]` where `row.log.liked === true` when `favorites=1`.

Apply **after** `profileLogMatchesProfileLobbyVenue`.

### Empty states

- Favorites + venue with no rows: venue-aware copy + suggest clearing favorites filter or switching venue.
- Favorites with zero liked logs ever: “No favorites yet” + hint to heart titles from detail.

### Social “Favorites” tab

- Stop using `favoriteMovieIds` batch for tab grid in v1 of this feature.
- Options (implementation plan picks one):
  - **A)** Remove tab when no liked logs; link from About copy to filtered Movies tab.
  - **B)** Tab redirects to `?tab=movies&favorites=1` (TV accessible via tab toolbar).

## Web UI

### Lists lobby & detail

- Show system **Favorites** list in personal lists lobby like other lists (badge optional: “Auto” or no badge).
- List detail: items read-only; no add-title UI; footer note: synced from favorited titles.
- **Add to list** from movie/TV detail must **exclude** system favorites list from picker (or show disabled with explanation).

### Detail heart

- Keep **Favorite** label and `IconHeartFilled` when liked (AGENTS.md).
- No change to heart semantics — sync is server-side.

### List item picker / community

- Community activity for list updates may include favorites list — acceptable for v1.

## Out of scope (v1)

- Migrating `profile.favoriteMovieIds` into `log.liked` or list items.
- Ranked favorites list.
- Manual reorder on system favorites list.
- Collaborative favorites list.
- Email/push for new favorites.
- Backfill job for existing `liked` logs (recommended as **follow-up migration** script, not blocking MVP).

## Follow-up (post-v1)

- One-time backfill: for each user, `ensureFavoritesList` + insert items for all `log` where `liked = true`.
- Revisit **About showcase** (`favoriteMovieIds`) vs heart-only branding.
- Optional `list_item.addedAt` from first `liked` timestamp for sort accuracy.

## Testing

| Case | Expected |
|------|----------|
| First heart on movie | Minimal log if needed; list created; movie in list |
| Heart on TV show | `list_item.tv_id` set |
| Unfavorite | Item removed; list empty allowed |
| Duplicate logs same title | Single list item |
| Delete system list API | 403 |
| Add item to system list API | 403 |
| Profile Movies default | All movie logs |
| Profile `?favorites=1` | Only `liked` movie logs |
| Favorites + `?venue=theaters` | Intersection |
| Public profile visitor | Sees filtered grid when param present |
| List detail | No manual add/remove controls |

## Open questions (none blocking — defaults above)

- **Private favorites list:** default public; change requires explicit product ask.
- **Tab repoint vs remove:** executor chooses B unless design review prefers removing duplicate tab.

## References

- `packages/db/src/schema/list.ts`, `activity.ts` (`log.liked`)
- `apps/server/src/routes/logs.ts` — sync hook point
- `apps/web/src/components/profile/profile-lobby-chrome.tsx`, `profile-lobby-order.ts`
- `apps/web/src/components/movie/use-movie-detail-user-state.ts` — `toggleHeart`
