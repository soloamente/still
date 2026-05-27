# TV on lists — design spec

**Date:** 2026-05-27  
**Status:** Approved (2026-05-27)  
**Approach:** A (extend existing movie add-to-list path; full parity; covers in same pass)

## Problem

Patrons cannot add TV shows to personal lists from the product UI. TV detail shows a toast: *"Lists are for films — open the movie page to add this title to a list."* Catalogue radial menus omit **Add to list** for TV tiles. Films work end-to-end.

The database already supports `list_item.tv_id` (XOR with `movie_id`), list detail renders TV posters, and the system **Favorites** list syncs TV via `tvId`. The gap is API write paths, membership queries, cover aggregation, and UI wiring.

## Goals

1. **Full parity (C):** Every place a signed-in patron can **Add to list** for a film, they can for a TV show.
2. **Mixed lists:** One list may contain both films and shows (already enforced by schema).
3. **Lobby honesty:** `/lists` cards and picker thumbnails show TV artwork when lists include shows.
4. **No Favorites regression:** System favorites list stays read-only in the picker; sync behavior unchanged.

## Non-goals

- `movie-actions.tsx` legacy “List picker coming soon” dropdown (separate stub; not in parity set).
- Collaborative list permissions changes.
- List search tag / community discovery changes.
- Renaming list detail section from “Films” (optional copy pass later).

## Picker “meta line”

When you tap **Add to list**, each row shows the list name and a **secondary line** of metadata (`add-to-list-picker.tsx` → `listMetaLine`).

**Decision: split counts** — show films and shows separately when relevant:

| List contents | Meta line example |
|---------------|-------------------|
| Films only | `12 films · Private` |
| Shows only | `4 shows · Private` |
| Mixed | `8 films · 4 shows · Private` |
| Empty | `0 titles · Private` (both counts zero) |

Rules:

- Use **film** / **films** and **show** / **shows** (singular when count is 1).
- When **both** counts are zero: meta line is **`0 titles · Public|Private`** (not “0 films”).
- When **only films** (`movieItemsCount > 0`, `tvItemsCount === 0`): films segment only, e.g. `12 films · …`.
- When **only shows** (`tvItemsCount > 0`, `movieItemsCount === 0`): shows segment only, e.g. `4 shows · …`.
- When **mixed** (both > 0): `N films · M shows · …`.
- Visibility suffix unchanged: `· Public` / `· Private`.

**Data:** Denormalize on `list`:

- `movieItemsCount` — rows with `movie_id`
- `tvItemsCount` — rows with `tv_id`
- `itemsCount` — `movieItemsCount + tvItemsCount` (keep existing field; all list endpoints continue to expose it)

Updated on every `refreshListAggregates` / add / delete (same pass as cover snapshots).

## Architecture

### API (mirror watchlist / logs)

**`POST /api/lists/:id/items`**

- Body: `{ movieId?: number; tvId?: number; position?: number; note?: string }`.
- Exactly one of `movieId` or `tvId` (400 otherwise).
- Insert with XOR columns; `onConflictDoNothing` on list+movie or list+tv unique indexes.
- Block writes to system **favorites** list (existing).
- Recompute `itemsCount`, `movieItemsCount`, `tvItemsCount`, and cover snapshot (below).

**`GET /api/lists/me`**

- Query: optional `movieId` **or** `tvId` (mutually exclusive; ignore invalid).
- When either is set, attach **`containsTitle: boolean`** per list (whether that title is already on the list).
- Deprecate `containsMovie` in new client code; server may return both during transition for safety.

**`DELETE`**

- Keep `DELETE /api/lists/:id/items/:movieId`.
- Add `DELETE /api/lists/:id/items/tv/:tvId` with same auth / favorites guards.
- Both paths refresh aggregates.

**`GET /api/lists/:id`**

- No contract change; already joins `tv` for items.

### Cover aggregation

Today `list.cover_movie_ids` and `withCoverPosterPaths` only resolve **movie** posters. TV favorites/items can leave lobby tiles blank or wrong.

**`refreshListAggregates(listId)`** (and inline SQL on add/delete):

- Select up to 4 most recent items (by `added_at` / position).
- Build `coverMovieIds` from items with `movie_id` (preserve order among movies).
- Add **`coverTvIds`** `jsonb` on `list` (migration): same for `tv_id`.
- `movieItemsCount` / `tvItemsCount` from conditional counts on `list_item`.
- `itemsCount` = `movieItemsCount + tvItemsCount`.

**`withCoverPosterPaths`:**

- Resolve `coverMovieIds` → `movie.poster_path`.
- Resolve `coverTvIds` → `tv.poster_path`.
- **`coverPosterPaths` for display:** interleave in item order (first four items regardless of kind) so Savee-style strips match list content. Implementation: when building strip, walk recent items and map each to its poster path (movie or tv join), capped at 4.

Pinned `coverMovieId` / custom `coverImageUrl` behavior unchanged.

### Favorites sync

`favorites-list-sync.ts` already inserts/deletes `tvId` rows. After aggregate fix, Favorites list lobby cover includes TV posters without further sync logic.

## UI

### Shared add-to-list module

Refactor to a single media shape:

```ts
type AddToListMedia = {
  listingKind: "movie" | "tv";
  tmdbId: number;
  title: string;
};
```

- **`AddToListControl`** — accepts `AddToListMedia`; used on movie and TV detail heroes.
- **`useAddToListRadial(media)`** — same; used from `CataloguePosterTile`.
- **`fetchListsMe`** — `movieId` or `tvId` query param from `listingKind`.
- POST body sends `movieId` or `tvId` accordingly.
- Toasts: entity label **Film** vs **Show**; use `containsTitle` for “already in list”.

### TV detail

- Remove `handleAddToList` toast in `tv-detail-primary-actions.tsx`.
- Render `AddToListControl` (or shared hook + button chrome matching movie hero).

### Catalogue radial

- `buildCatalogueRadialItemSpecs`: enable **Add to list** for `listingKind === "tv"` on `home`, `diary`, `watchlist` (same rules as movies; watchlist keeps order: add-to-list before destructive remove).
- Tests in `catalogue-radial-items.test.ts` updated for TV slots.

### Picker copy

- Meta line: **`listMetaLine(list)`** implements split rules above (`movieItemsCount`, `tvItemsCount` from API).
- Optimistic add: bump the count for the kind being added (`movie` → `movieItemsCount`, `tv` → `tvItemsCount`) plus `itemsCount`.
- Selection checkmark aria: “Already in {listTitle}” (unchanged).
- Empty list detail: optional copy tweak (“films and shows”) on `list-detail-films-grid.tsx` — not required for v1.

### Types

- `ListBoardRow.containsTitle?: boolean` (replace `containsMovie` in web types).
- `ListBoardRow.movieItemsCount: number` and `tvItemsCount: number` (default `0` when absent in legacy payloads).
- `ListBoardRow.coverTvIds?: number[]` if exposed to client (optional; display uses `coverPosterPaths`).

## Entry-point checklist (acceptance)

| # | Surface | Signed-in behavior |
|---|---------|-------------------|
| 1 | `/movies/[id]` hero | Add to list works (unchanged) |
| 2 | `/tv/[id]` hero | Opens same picker; adds `tvId` |
| 3 | `/home` TV grid radial | **Add to list** slot + picker |
| 4 | `/diary` TV tile radial | **Add to list** |
| 5 | `/watchlist` TV tile radial | **Add to list** |
| 6 | `/lists` lobby | List with only TV items shows TV posters on card |
| 7 | `/lists/[id]` | TV posters in grid; ranked order preserved |
| 8 | Favorites system list | Still hidden from picker; TV hearts still sync |

## Error handling

- 401: sign-in (existing).
- 403: favorites list or non-editable list (existing).
- 400: both/neither `movieId` and `tvId`.
- Duplicate add: client checks `containsTitle`; server `onConflictDoNothing` + optimistic UI refresh.
- TV not cached: `ensureTvCached(tvId)` on POST (same as watchlist/logs) before insert.

## Testing

**Server**

- POST item with `tvId`; GET list detail includes tv join.
- POST duplicate tv on same list → no duplicate row.
- GET `/me?tvId=` → `containsTitle` true/false.
- DELETE tv item.
- Mixed list: one movie + one show; `itemsCount === 2`, `movieItemsCount === 1`, `tvItemsCount === 1`; cover paths include both posters.

**Web**

- `catalogue-radial-items.test.ts` TV cases include `add-to-list`.
- Unit tests for `listMetaLine`: films-only, shows-only, mixed, empty (`0 titles`), singular plural.

**Manual**

- TV detail → add to new list → open list → poster visible.
- `/lists` card shows TV stills for TV-only list.
- Heart TV → Favorites list cover updates.

## Migration

- Add `cover_tv_ids jsonb NOT NULL DEFAULT '[]'`.
- Add `movie_items_count integer NOT NULL DEFAULT 0` and `tv_items_count integer NOT NULL DEFAULT 0`.
- Backfill: run `refreshListAggregates` for all lists (or on-next-write); ensures split counts and TV covers match `list_item` rows.

## Risks / notes

- `coverMovieIds` name is historical; TV ids live in `coverTvIds`. Display logic merges by item order.
- TMDb movie and TV ids can numerically collide; never store both in one array without kind — XOR columns prevent that on items.
- Ranked lists: TV items participate in position ordering like films (no separate mode).

## Implementation plan

After spec approval, invoke **writing-plans** skill → `docs/superpowers/plans/2026-05-27-tv-on-lists.md` with ordered tasks: migration → server routes → aggregates → web shared control → TV hero → radial → tests → manual QA.
