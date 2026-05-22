# RadialToolkit — Catalogue Lobbies (Scope A)

**Status:** Approved (brainstorm 2026-05-22; approach **1** — shared wrapper)  
**Date:** 2026-05-22  
**Scope:** `/home` Movies + TV catalogue grids, `/diary` lobby grid, `/watchlist` lobby grid  
**Out of scope (v1):** `/lists` (already shipped), community feed rows, movie/TV detail pages, search dialog results, friend rail

## Summary

Bring the existing **`RadialToolkit`** + **`useRadialToolkitAnchor`** interaction from `/lists` to **catalogue poster lobbies** so patrons can aim-release contextual actions without leaving the grid. Left click still navigates to detail. A single **`CataloguePosterTile`** wrapper owns pointer handlers, toolkit portal, and z-index stacking; per-surface **recipe builders** return `RadialToolkitItem[]` so home, diary, and watchlist menus stay explicit and testable.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Architecture | **Approach 1** — `CataloguePosterTile` wraps `MoviePoster` (or diary shell); recipes in `catalogue-radial-items.ts` |
| Interaction | Same as lists: **RMB hold → aim → release**; suppress native context menu after release |
| Primary navigation | **Left click unchanged** — `MoviePoster` `Link` to `/movies/[id]` or `/tv/[id]` |
| Touch / long-press | **Not in v1** — parity with lists (desktop-first radial); document limitation |
| Auth | Signed-in: full surface menu; signed-out: **Open** + **Copy link** only; other slots toast sign-in |
| Destructive styling | **`variant: "destructive"`** only on **Remove from watchlist** (watchlist lobby) |
| z-index | Toolkit **`z-[200]`**; quick log / list picker / confirm **`APP_MODAL_OVERLAY_CLASS` `z-[250]`** |
| Home grid integration | `PopularMoviesInfinite` accepts optional **`renderPoster`** (default: plain `MoviePoster`) |
| Diary TV | Radial on **film tiles** and **TV group poster** (`DiaryTvGroupCell`); not on nested episode chips in expand panel (v1) |
| Add to list | **Movie tiles only** in v1 (`AddToListControl` / picker are `movieId`-scoped today); TV tiles omit slot until picker supports `tvId` |
| Motion | Reuse `RadialToolkit` springs; respect `useReducedMotion`; no new animation primitives |

## Problem

1. Catalogue lobbies are **link-only** — patrons must open detail to log, copy a link, or manage watchlist.
2. `/lists` already proves the radial pattern; behaviour diverges if catalogue grids never get the same muscle memory.
3. Duplicating list-poster wiring in three grids would drift (handlers, z-index, auth gates).

## User stories

1. On `/home` Movies, I RMB a poster, release on **Quick log**, and the sheet opens without navigation.
2. On `/home` TV, I copy a show link from the radial menu.
3. On `/diary`, I RMB my film log tile and choose **Edit log** (PATCH quick log).
4. On `/diary`, I RMB a grouped TV series poster and **Edit log** opens the most recent log in that group (same as group cell edit affordance today).
5. On `/watchlist`, I RMB a title and **Remove from watchlist** (destructive wedge) then confirm via toast feedback.
6. Signed out, I still get **Open** and **Copy link**; other actions nudge me to sign in.

## Information architecture

### Surfaces

| Route | Grid component | Tile types |
|-------|----------------|------------|
| `/home?browse=movies\|tv` | `PopularMoviesInfinite` via home catalogue | TMDb catalogue seeds (movie / tv) |
| `/diary` | `DiaryLobbyGrid` | Single film log tile; TV **group** cell |
| `/watchlist` | `WatchlistLobbyCatalogue` → `PopularMoviesInfinite` | Watchlist seeds (mixed movie / tv) |

### Action matrix (signed-in)

| Action | Home | Diary | Watchlist |
|--------|------|-------|-----------|
| **Open** | ✓ detail | ✓ detail | ✓ detail |
| **Copy link** | ✓ | ✓ | ✓ |
| **Quick log** | ✓ new log | — | ✓ new log |
| **Edit log** | — | ✓ (PATCH) | — |
| **Watchlist** | Add / Remove toggle | — | **Remove only** (destructive) |
| **Add to list** | ✓ movies only | ✓ movies only | ✓ movies only |

**Signed-out:** Open, Copy link; Quick log / Watchlist / Add to list → `toast` + optional `/sign-in` link (no destructive styling).

### Shortcut letters (tentative)

Align with list lobby where possible: **O** Open, **C** Copy, **L** Log, **E** Edit, **W** Watchlist, **A** Add to list. Omit shortcuts for disabled slots.

## Component design

### `CataloguePosterTile` (`apps/web/src/components/catalogue/catalogue-poster-tile.tsx`)

**Client component.** Responsibilities:

- Apply **same elevation shell** as `ListLobbyPoster` (`focus-within:z-[100]`, hover shadow stack) so toolkit aim does not clip under neighbors.
- Wire `useRadialToolkitAnchor()` on the shell (`onPointerDown`, `onContextMenu`).
- Render `MoviePoster` with existing lobby classNames passed through.
- Portal `RadialToolkit` when `open`, `items` from recipe.
- On `onSelect` for modal actions: close toolkit first, then open quick log / list picker.

**Props (conceptual):**

```ts
type CatalogueRadialSurface = "home" | "diary" | "watchlist";

type CataloguePosterTileProps = {
  surface: CatalogueRadialSurface;
  listingKind: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  priority?: boolean;
  className?: string;
  frameClassName?: string;
  hoverEffect?: MoviePosterHoverEffect;
  /** Diary only — row for Edit log payload */
  diaryRow?: DiaryLogRow;
  /** Diary TV group — use latest log in group for edit */
  diaryTvLogs?: DiaryLogRow[];
  /** Home/watchlist — optional hydrated watchlist state */
  inWatchlist?: boolean;
  onWatchlistChange?: () => void;
  onRadialActionComplete?: () => void;
};
```

### `buildCatalogueRadialItems` (`apps/web/src/lib/catalogue-radial-items.ts`)

Pure function (+ small hooks file if session needed):

- Input: surface, listing, auth, callbacks (`openQuickLog`, `router.push`, `copyUrl`, watchlist mutators, open list picker).
- Output: `RadialToolkitItem[]` ordered consistently (Open first, destructive last).
- Unit-test: signed-out menu length, watchlist-only destructive, diary includes Edit when `logId` present.

### List picker from radial

Extract minimal **headless opener** from `AddToListControl` (or new `useAddToListPicker(movieId, title)`) so radial **Add to list** opens the same `AddToListPicker` sheet without rendering the hero circle button. Popover/sheet z-index ≥ modal overlay class.

### `PopularMoviesInfinite`

- Add optional `renderPoster?: (seed, index) => ReactNode`.
- Default implementation remains current `MoviePoster` map (no behaviour change when prop omitted).
- Home + watchlist pass `renderPoster` that returns `<CataloguePosterTile … />`.

### `DiaryLobbyGrid`

- Film branch: replace bare `MoviePoster` with `CataloguePosterTile` (`surface="diary"`, `diaryRow`).
- `DiaryTvGroupCell`: wrap group poster trigger with `CataloguePosterTile` or pass radial handlers into group cell (prefer single wrapper on poster trigger only).

## Data & mutations

| Action | API / store |
|--------|-------------|
| Quick log (new) | `useQuickLog().open({ movieId \| tvId, … })` |
| Edit log | `diaryLogToQuickLogOpenPayload` + `useQuickLog().open` |
| Watchlist toggle (home) | Same as `use-movie-detail-user-state` / `use-tv-detail-user-state` watchlist PATCH |
| Remove (watchlist) | DELETE watchlist entry; `router.refresh()` |
| Copy link | `origin + /movies|tv/[tmdbId]` |
| Add to list | `fetchListsMe(movieId)` + picker select → existing list item POST |

**Watchlist hydration (home):** v1 may **optimistic toggle** on radial select without per-tile prefetch; optional follow-up: batch check endpoint. Spec minimum: home **Add** calls POST; **Remove** calls DELETE; show toast on error.

## Accessibility

- Toolkit hub/items keep `aria-label` from `RadialToolkit` (lists pattern).
- Poster `Link` remains tabbable; radial is pointer-secondary (document in QA).
- Destructive slot: label **Remove from watchlist** (not generic Delete).

## Testing

| File | Covers |
|------|--------|
| `catalogue-radial-items.test.ts` | Menu composition per surface + auth |
| Manual QA matrix | `/home` movies/tv, `/diary` film + TV group, `/watchlist`, signed out |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `AnimatePresence` + wrapper breaks exit keys | Wrapper is **inside** `motion.div` child, same as list lobby |
| RMB vs grid monochrome `:has()` | Shell uses same `data-` attributes / classes as lobby links |
| Invalid button inside link | Radial handlers on **wrapper**, not inside `<Link>` — mirror `ListLobbyPoster` |
| TV add-to-list gap | Omit slot on TV tiles v1; comment in recipe builder |

## Success criteria

1. All three lobbies expose radial on poster tiles with list-parity interaction.
2. Signed-in menus match action matrix; signed-out restricted.
3. Left click navigation unchanged; no regression on stagger / wave keys.
4. `bun run build` + unit tests for recipe builder pass.
5. `graphify update .` after implementation.

## References

- `packages/ui/src/components/radial-toolkit.tsx`
- `apps/web/src/components/list/list-lobby-poster.tsx`
- `apps/web/src/components/movie/popular-movies-infinite.tsx`
- `apps/web/src/components/diary/diary-lobby-grid.tsx`
- `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx`
- `apps/web/src/lib/diary-open-log.ts`
