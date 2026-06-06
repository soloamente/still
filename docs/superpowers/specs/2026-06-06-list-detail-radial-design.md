# List Detail — Radial Toolkit on Title Tiles

**Status:** Approved (brainstorm 2026-06-06; approach **2** — dedicated tile + spec module)  
**Date:** 2026-06-06  
**Scope:** `/lists/[id]` and public `/l/[id]` title grids (ranked + unranked), including system **Favorites**  
**Out of scope:** `/lists` lobby list cards (already shipped via `ListLobbyPoster`), community feed rows, movie/TV detail Related grid (separate change)

## Summary

Add **RMB hold → aim → release** radial menus to **title poster tiles inside list detail pages**, matching catalogue lobby muscle memory. Signed-in patrons get **direct diary actions** (favorite toggle, add to list) **without opening Edit log**. List **membership** edits (remove from a custom list) stay limited to owners and collaborators.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Architecture | **Approach 2** — `ListDetailPosterTile` + `list-radial-items.ts` (mirrors `CataloguePosterTile` / `catalogue-radial-items.ts`) |
| Interaction | Same as catalogue/lists: **RMB hold → aim → release**; suppress native context menu after release |
| Primary navigation | **Left click unchanged** — `MoviePoster` link to `/movies/[id]` or `/tv/[id]` |
| Touch / long-press | **Not in v1** — desktop-first radial (parity with catalogue v1) |
| Signed-out | **Open** + **Copy link** only; other slots toast sign-in |
| Watchlist toggle | **Not on list-detail tiles** — list context, not watchlist lobby |
| Ranked reorder | **Coexists with radial** — drag = LMB (`PointerSensor`); radial = RMB (`button === 2`) |
| Favorite toggle | **`patchLog(logId, { liked })`** — never routes through Edit log / Quick log rating UI |
| Favorites list sync | Server `syncFavoritesListForUserTitle` after liked patch; client optimistic UI on Favorites grid |
| Remove from custom list | **`DELETE /api/lists/:id/items/:movieId`** or **`.../tv/:tvId`** — owner **or** collaborator (`viewerCanEdit`) |
| Remove from Favorites list row | **Not a list-item DELETE** — only **Remove from favorites** (unheart) for signed-in user with a log |

## Problem

1. List detail grids (`ListDetailFilmsGrid`, `RankedListReorderGrid`) are **link-only** — patrons must open detail or diary to log, favorite, copy a link, or remove a title from a list.
2. `/home`, `/diary`, and `/watchlist` already use **`CataloguePosterTile`**; list detail is the main poster wall still missing radial parity.
3. **Favorites** membership is diary-synced (`log.liked`); patrons expect a fast **heart off** from the Favorites grid without opening Edit log.
4. Duplicating radial wiring in ranked vs unranked grids would drift.

## User stories

1. On **any public list** (signed out), I RMB a title and get **Open** + **Copy link**.
2. On **any list** (signed in, no diary log yet), I RMB and choose **Quick log** to log without navigation.
3. On **any list** (signed in, **has a diary log**), I RMB and choose **Add to list** without opening Edit log.
4. On **any list** (signed in, **has a diary log**), I RMB and choose **Add to favorites** or **Remove from favorites** — heart toggles immediately via `patchLog`; Favorites list row updates on next refresh/sync.
5. On **my Favorites** list, unhearting from radial removes the poster from the grid (optimistic + server sync).
6. On **my custom list** (owner or collaborator), I RMB and **Remove from list** (destructive) without opening detail.
7. On a **ranked** list (including Favorites), I still **drag to reorder** with LMB while RMB radial works on the same tile.
8. **Edit log** remains available as its own radial slot when a log exists — separate from favorite toggle.

## Action matrix

### Everyone

| Action | Condition |
|--------|-----------|
| **Open** | Always |
| **Copy link** | Always |

### Signed in

| Action | Condition |
|--------|-----------|
| **Quick log** / **Rewatch** | Always (Rewatch when prior log exists) |
| **Edit log** | Prior log exists |
| **Add to list** | **Prior log exists** (picker opens; supports movie + TV via existing `useAddToListRadial`) |
| **Add to favorites** | Prior log exists **and** `liked === false` |
| **Remove from favorites** | Prior log exists **and** `liked === true` (destructive wedge) |

Signed-out patrons attempting gated actions: existing catalogue pattern — toast + sign-in nudge (`isCatalogueRadialGatedAction` equivalent for list specs).

### List membership (custom lists only)

| Action | Condition |
|--------|-----------|
| **Remove from list** | `viewerCanEdit === true` **and** `systemKind !== "favorites"` (destructive) |

Collaborators receive **Remove from list**; Favorites list has **no** list-item delete (server 403).

### Shortcut letters

**O** Open, **C** Copy, **L** Log, **R** Rewatch, **E** Edit log, **A** Add to list, **F** Favorite / unfavorite (single slot, label flips), **X** Remove from list (custom lists, editors only).

## Component design

### `list-radial-items.ts` (`apps/web/src/lib/list-radial-items.ts`)

Pure spec builder (unit-tested), analogous to `catalogue-radial-items.ts`.

**Input:** `signedIn`, `listingKind`, `hasPriorLog`, `liked`, `canEditMembership`, `isFavoritesList`.

**Output:** ordered `ListRadialItemSpec[]` with ids: `open`, `copy`, `quick-log`, `edit-log`, `add-to-list`, `toggle-favorite`, `remove-from-list`.

Rules:

- `toggle-favorite` → label **Add to favorites** or **Remove from favorites** based on `liked`; only when `hasPriorLog`.
- `add-to-list` → only when `hasPriorLog`.
- `remove-from-list` → only when `canEditMembership && !isFavoritesList`.
- `quick-log` label **Rewatch** when `hasPriorLog`.

Export `isListRadialGatedAction` mirroring catalogue (gate everything except open/copy).

### `ListDetailPosterTile` (`apps/web/src/components/list/list-detail-poster-tile.tsx`)

**Client component.** Responsibilities:

- Elevation shell + `useRadialToolkitAnchor()` (same z-index stack as `CataloguePosterTile` / `ListLobbyPoster`).
- Render `MoviePoster` with lobby classNames; support `posterCaption` / `posterCaptionSubline`, `linkable` prop for ranked drag overlay.
- On radial **open**, hydrate patron state: latest log id, `liked`, prior log count (`fetchMyLogsForMovie` / `fetchMyLogsForTv` — same as catalogue).
- Handlers:
  - **Open / Copy / Quick log / Edit log** — reuse `useQuickLog`, `diaryLogToQuickLogOpenPayload`, router push.
  - **Add to list** — `useAddToListRadial` (movie + TV).
  - **Toggle favorite** — `patchLog(logId, { liked: !liked })`; toast; `onActionComplete?.()` for parent refresh/optimistic remove on Favorites.
  - **Remove from list** — new `deleteListItem(listId, { movieId | tvId })` client helper; toast; callback to drop row locally or `router.refresh()`.
- Props: `listId`, `listingKind`, `tmdbId`, `title`, `posterUrl`, `itemId?`, `systemKind?`, `viewerCanEdit`, `priority`, classNames, `onActionComplete?`, `linkable?`.

### Grid integration

| Component | Change |
|-----------|--------|
| `ListDetailFilmsGrid` | Replace `MoviePoster` with `ListDetailPosterTile`; pass `listId`, `systemKind`, `viewerCanEdit`, `itemId` |
| `RankedListReorderGrid` | Replace inner `MoviePoster` with `ListDetailPosterTile`; keep sortable wrapper + drag listeners outside tile; pass `linkable={!(isDragging \|\| isActive)}` |
| `lists/[id]/page.tsx` | Pass `viewerCanEdit`, `systemKind`, `listId` into grids |

Public `/l/[id]` route: same tile component; `viewerCanEdit` false for visitors; signed-in viewers still get personal favorite/add-to-list when they have logs.

## Data flow

```
Radial open
  → fetchMyLogsForMovie|Tv(tmdbId)
  → latestLogId, liked, hasPriorLog
  → buildListRadialItemSpecs(...)

Toggle favorite
  → patchLog(latestLogId, { liked: next })
  → server syncFavoritesListForUserTitle (if favorites list affected)
  → onActionComplete (Favorites grid: remove row optimistically when unhearted)

Remove from list (editors, custom lists)
  → DELETE /api/lists/:id/items/:movieId | .../tv/:tvId
  → refreshListAggregates (server)
  → onActionComplete (drop row)
```

**Hydration note:** `ListDetailFilmRow.ownerLog` exposes `rating` / `liked` for poster captions but **not** log id — radial must fetch log id on open (same as catalogue).

## Error handling

| Case | UX |
|------|-----|
| Toggle favorite with no log | Slot hidden; if forced, toast *Log this title first* |
| Add to list with no log | Slot hidden |
| Remove from list on Favorites | Client never shows slot; server 403 if called |
| patchLog / DELETE failure | Toast error; no optimistic update |
| Signed-out gated action | Toast sign-in nudge |

## Testing

### Unit (`list-radial-items.test.ts`)

- Signed-out → open, copy only.
- Signed-in, no log → open, copy, quick-log.
- Signed-in, has log, not liked → includes add-to-list, add-to-favorites; no remove-from-list unless editor.
- Signed-in, has log, liked → remove-from-favorites (destructive).
- Editor on custom list → remove-from-list; not on favorites.
- Collaborator `viewerCanEdit` → remove-from-list on custom list.

### Manual

- Guest on public list: open + copy only.
- Signed-in visitor on someone else's list: favorite toggle affects **own** diary only; no remove-from-list.
- Own Favorites: unheart removes tile; re-heart from radial on another list adds back to Favorites after sync.
- Ranked custom list: drag reorder + RMB radial on same poster.
- TV title: add to list + favorite toggle.

## Files (expected touch set)

| File | Role |
|------|------|
| `apps/web/src/lib/list-radial-items.ts` | Spec builder |
| `apps/web/src/lib/list-radial-items.test.ts` | Unit tests |
| `apps/web/src/lib/still-api-fetch.ts` | `deleteListItem` helper |
| `apps/web/src/components/list/list-detail-poster-tile.tsx` | Tile + radial |
| `apps/web/src/components/list/list-detail-films-grid.tsx` | Wire tile |
| `apps/web/src/components/list/ranked-list-reorder-grid.tsx` | Wire tile |
| `apps/web/src/app/(app)/lists/[id]/page.tsx` | Pass list context |
| `apps/web/src/app/l/[id]/page.tsx` (if separate) | Pass `viewerCanEdit` |

## Relation to existing specs

- Builds on **2026-05-22-radial-toolkit-catalogue-lobbies-design.md** (interaction + auth gates).
- Respects **2026-05-20-auto-favorites-list-design.md** — favorites membership via `log.liked`, not list-item DELETE.
- Coexists with **2026-05-28-ranked-list-drag-reorder-design.md** — LMB drag unchanged.
