# Home catalogue filters popover

**Status:** Approved (brainstorm 2026-06-06) · Plan: [`2026-06-06-home-catalog-filters-popover.md`](../plans/2026-06-06-home-catalog-filters-popover.md)  
**Date:** 2026-06-06  
**Scope:** `/home` **Movies** lobby (v1); `/diary` + `/watchlist` shells that reuse `HomeCatalogViewModeToolbar`; TV browse (v1.1 follow-up)  
**Related:** `home-catalog-view-mode-toolbar.tsx` · `discover-catalog-url.ts` · `home-lobby-url.ts` · `popular-movies-infinite.tsx` · [2026-05-27-instant-lobby-navigation-design.md](./2026-05-27-instant-lobby-navigation-design.md)

## Summary

On `/home` Movies browse, the **slider icon** in `HomeCatalogViewModeToolbar` becomes an **in-place filter popover** — not a link to another route. **In cinemas · At home** venue pills stay as instant toggles on the right rail; the popover holds secondary catalogue refinements that update the grid on `/home` and serialize to the URL for share/back.

**v1 filters:** single **genre**, **watch type** (At home only), **Top rated / A–Z** sort refinements (Popular & Latest only).

---

## Locked decisions (brainstorm)

| Topic | Decision |
|--------|----------|
| Venue pills | **Keep** — In cinemas / At home remain quick toggles outside the popover |
| Filter entry | **Slider icon only** opens the popover (`button`, not `Link`) |
| Apply model | **Immediate** — each pill tap navigates via `useLobbyNavigation` (same as venue chips) |
| Persistence | **URL is source of truth** — new query params on `/home` |
| Navigation | **In place on `/home`** — no dedicated discover route |
| Mobile | Same popover in v1 (bottom sheet deferred) |
| Studio / company | **Out of scope** — ⌘K search tags cover this |
| Multi-genre | **Out of scope** — single `?genre=` only |

---

## Problem

| Symptom | Cause |
|---------|--------|
| Slider icon feels like a dead end on Popular + In cinemas | `filtersHref` often equals the current URL — link does nothing useful |
| No way to narrow lobby by genre without ⌘K search | Discover filter params exist in API/infinite scroll but not on `/home` URL |
| `discoverPartsToHomeHref` drops genre/monetization | Params are explicitly `void`ed today |
| Filter control navigates away conceptually | `<Link href={filtersHref}>` implies leaving the lobby slice |

---

## User flow

### Open filters

1. Patron on e.g. `/home?sort=popular&venue=theaters` (Movies · Popular · In cinemas).
2. Taps **slider icon** on the right toolbar.
3. Popover opens anchored to the trigger (`aria-haspopup="dialog"`, `aria-expanded`).

### Apply a filter

1. Patron taps e.g. **Action** under Genre.
2. URL updates immediately: `/home?sort=popular&venue=theaters&genre=28`.
3. Grid remounts and refetches with `discoverGenreId=28`.
4. Slider shows a subtle **active dot**; popover header summary reads `Popular · In cinemas · Action`.
5. Popover stays open for further tweaks; closes on outside click or Escape.

### Clear filters

- **Clear filters** ghost action in popover footer (visible when any non-default filter param is set).
- Clears `genre`, `monetization` (if non-default), `discoverSort` while preserving `sort`, `venue`, `browse`.

### Venue interaction

- Switching **In cinemas ↔ At home** preserves `genre` and `discoverSort`.
- Switching to **In cinemas** strips `monetization` from URL.
- Switching left-rail **Popular · Latest · Upcoming** preserves compatible filters; **Upcoming** ignores `discoverSort`.

### Committed search

When `?search=` is active on Movies/TV, toolbar shows **Clear search** only — filter popover hidden (unchanged).

---

## Interaction & layout

### Trigger

- Replace slider `<Link>` with `<button type="button">`.
- Same icon (`IconSlider`), same `size-10` circular hit target in the `bg-background` pill track.
- **Active indicator:** small accent dot on the icon when any filter param is non-default.

### Panel

- **Surface:** `bg-popover` / elevation overlay tokens — no border ring, no box shadow spam (Sense overlay depth).
- **Width:** ~320px max; vertical scroll with hidden scrollbar + bottom gradient scrim (parity with `review-composer.tsx` / `StillPopoverSelect` scroll caps).
- **Anchor:** below-end of trigger; collision padding from viewport.

### Sections (top → bottom)

1. **Header** — title “Filters” + muted one-line summary of current lobby slice (read-only).
2. **Genre** — single-select pill grid; “All genres” clears `?genre=`.
3. **Watch type** — segmented pills: Subscription · Rent · Buy · Free · Ads — **hidden when venue = theaters**.
4. **Sort** — Top rated · A–Z — **only when left rail is Popular or Latest**; hidden on Upcoming.
5. **Footer** — “Clear filters” when active.

### Motion

- Popover enter/exit: opacity + slight scale (~0.96), ≤200ms.
- Filter pills reuse `SegmentedPillToolbar` sliding `bg-card` pill where segments are mutually exclusive.

---

## URL model

### New query params

| Param | Example | Meaning |
|-------|---------|---------|
| `genre` | `28` | Single TMDb genre id (movies or TV) |
| `monetization` | `rent` | TMDb `with_watch_monetization_types` — **At home** only |
| `discoverSort` | `vote_average.desc` | Overrides TMDb `sort_by` for Popular/Latest discover slices |

### Whitelists

- `monetization`: `flatrate` · `rent` · `buy` · `free` · `ads` (sync with `DISCOVER_MONETIZATION_WHITELIST` in `discover-catalog-url.ts`).
- `discoverSort`: `vote_average.desc` · `original_title.asc` (movies); TV equivalents from `tv-discover-catalog-url.ts` when v1.1 ships.

### Serialization rules (`buildHomeLobbyHref`)

- Add optional `genre`, `monetization`, `discoverSort` to href builder input.
- Omit `monetization` when `venue=theaters` or when value is default `flatrate`.
- Omit `discoverSort` when it would match the implicit sort for the current left-rail chip.
- Lobby cookie (`still.home-lobby-href-v1`) must include filter params so bare `/home` restore keeps filters.

### Parsing (`home-catalog-filters.ts` — new)

- `parseHomeCatalogFilters(searchParams, context)` → `{ genreId, monetization, discoverSort }` normalized + stripped when incompatible with venue/sort.
- `hasActiveHomeCatalogFilters(filters)` → boolean for slider dot + Clear visibility.
- `buildHomeLobbyHrefWithFilters(base, filters)` — thin wrapper over extended `buildHomeLobbyHref`.

---

## Data flow

```
Filter popover pill tap
  → buildHomeLobbyHref({ browse, sort, venue, run?, genre, monetization, discoverSort })
  → useLobbyNavigation.navigate(href)
  → /home RSC parses filter params
  → lobby seed fetch uses genre/monetization/discoverSort
  → PopularMoviesInfinite receives discoverGenreId, discoverMonetization, discoverSortBy
  → lobbyCatalogueResetKey includes filter dimensions → grid remounts
  → infinite scroll pages with same bundle (existing catalogueWaveKey)
```

### Seed fetch adjustments

| Lobby slice | Without `?genre=` | With `?genre=` |
|-------------|-------------------|----------------|
| Popular + In cinemas (now playing) | `fetchMoviesNowPlaying` | Switch to **discover** with `venue=theaters`, `popularity.desc`, `with_genres` |
| Popular + At home | discover + `flatrate` | discover + genre + monetization |
| Latest + In cinemas | discover theatrical | discover theatrical + genre |
| Latest + At home | discover streaming | discover streaming + genre + monetization |
| Upcoming (either venue) | existing upcoming discover | upcoming discover + genre (date sort locked) |

`discoverPartsToHomeHref` and `discoverCatalogUrl` must pass `genreId` / `monetization` into href builder instead of voiding them.

---

## Scope

### v1 (Movies)

- `/home` Movies: all sort × venue combinations above.
- `/diary` + `/watchlist`: slider opens same popover; filters apply to the href the toolbar would have opened (diary branch unchanged for venue pills).

### v1.1 (TV — follow-up)

- Genre on TV Popular/Latest/Ongoing/Completed/Upcoming.
- Watch type on TV **Upcoming + At home** only.
- Hide monetization on Ongoing/Completed runs.

### Out of scope

- Studio/company (`?company=`) — use ⌘K studio tags.
- Multi-genre AND.
- Watch region picker in popover (existing first-use prompt stays).
- Reviving `/movies/discover` route.

---

## Edge cases

| Case | Behavior |
|------|----------|
| Now playing + genre | Use discover theatrical seed instead of now-playing API |
| In cinemas + monetization in URL | Strip on parse and on venue navigate |
| Upcoming + discoverSort in URL | Ignore param; hide sort section in popover |
| Empty results | Existing catalogue empty state; popover remains open |
| Invalid genre id | Treat as unset (drop param) |
| Anime season TV slice | Popover hidden or genre locked — follow existing `animeSeason` discover params |

---

## Components & files

| File | Change |
|------|--------|
| `apps/web/src/lib/home-catalog-filters.ts` | **New** — parse, normalize, active detection, href helpers |
| `apps/web/src/lib/home-catalog-filters.test.ts` | **New** — URL round-trip + incompatibility stripping |
| `apps/web/src/lib/home-lobby-url.ts` | Extend `buildHomeLobbyHref` with filter params |
| `apps/web/src/lib/discover-catalog-url.ts` | Wire genre/monetization through `discoverPartsToHomeHref` |
| `apps/web/src/components/home/home-catalog-filters-popover.tsx` | **New** — client popover UI |
| `apps/web/src/components/home/home-catalog-view-mode-toolbar.tsx` | Slider → popover trigger; pass lobby context |
| `apps/web/src/app/(app)/home/page.tsx` | Parse filters; thread to seed fetch + infinite props; extend reset key |
| `apps/web/src/lib/home-lobby-persist.ts` | Persist filter params in cookie restore (if not already via full href) |

Genre list: reuse `useSearchDialogGenres` or shared genre fetch hook with patron catalogue locale.

---

## Testing

### Unit

- `parseHomeCatalogFilters` — valid/invalid genre, monetization whitelist, discoverSort gating on Upcoming.
- `buildHomeLobbyHref` — preserves filters across venue toggle; strips monetization on theaters.
- `hasActiveHomeCatalogFilters` — dot + Clear visibility.

### Manual

1. `/home?sort=popular&venue=theaters` → open popover → Action → URL `&genre=28`, grid updates, back restores.
2. At home → Rent → grid refetches; switch In cinemas → `monetization` removed.
3. Popular → Top rated → `discoverSort=vote_average.desc`; switch to Upcoming → sort section hidden.
4. Active dot on slider; Clear filters resets URL.
5. With `?search=` committed — slider hidden, Clear search shown.

---

## Success criteria

- Slider opens a popover (no full-page navigation) on Movies `/home`.
- Genre filter updates the grid in place with shareable URL.
- Venue pills unchanged and instant.
- Filter state survives refresh and bare `/home` cookie restore.
- No regression to instant lobby navigation or TV run chips.
