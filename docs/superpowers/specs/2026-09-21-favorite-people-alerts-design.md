# Sense — Favorite people (cast & crew) + release/streaming alerts

**Status:** Draft for human review (brainstorm locked 2026-09-21)  
**Date:** 2026-09-21  
**Topic:** Save TMDb people as favorites; profile count + drawer; search boost; release & streaming inbox alerts  
**Related:** [`2026-06-13-letterboxd-pillars-roadmap-design.md`](./2026-06-13-letterboxd-pillars-roadmap-design.md) (watchlist streaming alerts), [`2026-06-30-person-detail-shell-design.md`](./2026-06-30-person-detail-shell-design.md)

## Summary

Patrons can **Favorite** any cast or crew person on `/people/[id]`. Favorites are a first-class taste signal: a **Favorites** count on public profiles opens a drawer of saved people; ⌘K / cast-crew search shows a **star** and ranks favorites first. When a favorited person appears in a **new** film or show, Sense notifies on **theatrical / first-air release** and again when that title **streams** in the patron’s watch region — copy always names the **role** (starring, directed, wrote, …).

This does **not** overload system title Favorites (`log.liked` / Favorites list). People favorites are a separate store.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Save model | **One Favorite per person** — any future credit (cast or crew); no role picker |
| Notification triggers | **Both** — release/first-air **and** streaming flatrate in watch region (separate inbox kinds) |
| Alert copy | Always **specify the role** on the credit (e.g. directed / starring) |
| Browse surface | **Profile stats** — Favorites count beside films/shows → Vaul drawer (no dedicated `/people/favorites` lobby in v1) |
| Visibility | Count + drawer on **public profiles** (same gate as other public profile chrome); private profiles stay hidden |
| Search | Favorited people get a **star** and sort **above** non-favorites for the signed-in viewer |
| Architecture | Approach **A** — `person_favorite` table + jobs mirroring watchlist streaming alerts |

## Problem

Patrons discover people on Sense but cannot “follow” their careers. Watchlist streaming alerts only cover titles already saved. Person detail has no save CTA. There is no public signal of whose work someone cares about, and search does not prefer known favorites.

## Goals / non-goals

**Goals**
- One-tap Favorite on person detail (signed-in)
- Public Favorites count + drawer on profiles
- Search: star + favorites-first ranking (people / cast-crew surfaces)
- Inbox: release + streaming alerts with role-aware copy
- Settings toggles (default on), deduped jobs, product events

**Non-goals (v1)**
- Dedicated favorites lobby route
- Per-role favorite filters (Acting-only, Directing-only)
- Email digests / push beyond existing inbox (+ optional Pro email later)
- Paywall / plan gate
- Favoriting from cast arc without opening person page (nice-to-have later)

## Product UX

### Person detail (`/people/[id]`)

- Signed-in: hero action **Favorite** / **Favorited** pill (optimistic toggle).
- Signed-out: no pill (or soft sign-in affordance — implementation may match watchlist unsigned pattern).
- Failure → toast; success silent or brief confirmation (match existing quiet toggles).

### Profile hero stats

- Left flank today: **films** · **shows** · taste pill. Add **Favorites** pill with `personFavoritesCount`.
- Tap opens **DetailVaulSheet** drawer: scrollable list/grid of favorited people (portrait, name, known-for department).
- **Owner:** can unfavorite from drawer rows.
- **Visitor:** browse only.
- Empty state: owner — “Favorite cast and crew from their pages”; visitor — quiet empty / hide count at 0 (prefer show **0** for owner parity with films/shows — lock: **show 0**).

### Search

- Surfaces: popular people rail, cast-crew search results, any people list in catalog search that returns TMDb people.
- Viewer-scoped `isFavorited`; star mark on row/tile.
- Sort: favorites first, then existing traffic / TMDb order (`rankPeopleBySearchTraffic` stays under favorites band).

### Notifications

| Kind | When | Deep link |
|------|------|-----------|
| `person_favorite_release` | New credit enters release window | `/movies/[id]` or `/tv/[id]` |
| `person_favorite_now_streaming` | Title gains flatrate in patron region | same |

**Copy shape (examples):**
- “Denis Villeneuve directed *Dune: Part Three* — in cinemas 19 Mar”
- “Timothée Chalamet stars in *Title* — now on Netflix”

Settings → Notifications: two toggles, default **on**, same registry pattern as `watchlist_now_streaming`.

## Data model

### `person_favorite`

| Column | Notes |
|--------|--------|
| `user_id` | FK user |
| `tmdb_person_id` | TMDb person id |
| `name` | Snapshot at save / refresh |
| `profile_url` | Snapshot |
| `known_for_department` | Snapshot nullable |
| `created_at` | |

Unique `(user_id, tmdb_person_id)`.

### Credit “seen” store

Track fingerprints so filmography is not re-alerted forever.

**Preferred v1:** table `person_favorite_credit_seen`  
`(user_id, tmdb_person_id, media_kind, tmdb_id, role_key)` unique — `role_key` normalized from cast character or crew job.

On first Favorite, **baseline** current credits into seen **without** notifying (same idea as watchlist streaming first-pass baseline).

### Notification payload

Enough for inbox row + deep link: `personId`, `personName`, `mediaKind`, `tmdbId`, `title`, `roleLabel`, optional `providerName` / `releaseDate`.

## API

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `POST` | `/api/people/:id/favorite` | signed-in | Upsert favorite + snapshot; baseline credits |
| `DELETE` | `/api/people/:id/favorite` | signed-in | Remove favorite (+ optional cleanup of seen rows) |
| `GET` | `/api/people/:id/favorite` | signed-in | `{ favorited: boolean }` for hero hydrate |
| `GET` | `/api/profiles/:handle/person-favorites` | public if profile public | Paginated list for drawer |
| Profile GET | existing | — | Add `personFavoritesCount` |

People search / popular responses: include `isFavorited` for viewer when signed in; server sorts favorites first.

## Jobs

Same scheduler family as `syncWatchlistStreamingAlerts` (opt-in local via `RUN_LOCAL_JOBS` / `dev:jobs`).

### Release scan

1. Load all `person_favorite` rows (batched by person or by user).
2. Fetch TMDb person combined credits (cached / rate-limited).
3. For each credit not in `person_favorite_credit_seen`:
   - If release/first-air date is within **upcoming 30 days** or **past 7 days** (UTC), insert `person_favorite_release` when pref on; mark seen.
   - Else if date is far future / unknown, either skip or mark seen without notify (lock: **mark seen without notify** for dates outside window to avoid surprise storms later).
4. Dedupe key: `(userId, personId, mediaKind, tmdbId, kind=release)`.

### Streaming scan

1. For titles recently released **or** newly seen credits that already have a release date in the past, resolve watch providers for patron `catalogTmdbWatchRegion`.
2. Diff flatrate vs prior snapshot (reuse or mirror watchlist streaming snapshot pattern — may key by `userId+movieId|tvId` shared with watchlist where possible).
3. Insert `person_favorite_now_streaming` when new provider appears; dedupe per title+provider+user.

Jobs are best-effort; failures log and continue. Never block interactive APIs.

## Product events

- `person_favorite.add`
- `person_favorite.remove`
- `person_favorite_alert.sent` (payload includes alert kind)

## Architecture sketch

```text
Person detail → POST/DELETE favorite → person_favorite (+ baseline seen)
Profile stats ← personFavoritesCount
Drawer ← GET .../person-favorites
Search ← isFavorited + favorites-first sort

Daily/nightly jobs
  → TMDb credits diff → person_favorite_release
  → provider flatrate diff → person_favorite_now_streaming
  → notification prefs gate + inbox deep link
```

## Testing

- Unique favorite constraint; baseline does not notify
- Release window include/exclude; outside window marks seen silently
- Streaming dedupe; pref off skips insert
- Profile count public vs private profile access
- Search: favorited rows first + `isFavorited` flag
- Drawer pagination / empty states

## Rollout

1. Migration + CRUD + person hero CTA  
2. Profile count + drawer  
3. Search star + rank  
4. Notification kinds + Settings  
5. Release job  
6. Streaming job  

## Open implementation notes (non-blocking)

- Exact star icon: Nucleo filled star vs heart — **prefer star** so it does not collide with diary Favorite (heart).
- Popular people rail: star when favorited; rank boost only when signed in.
- iOS later: same API; out of scope for this web-first v1.
