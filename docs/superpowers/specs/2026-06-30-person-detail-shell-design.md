# Person detail shell (`/people/[id]`)

**Status:** Approved (brainstorm 2026-06-30; approach **A · Detail shell parity**; human **ok**)
**Date:** 2026-06-30
**Scope:** Rebuild the TMDb person page to match film/TV detail visual and interaction patterns: sticky top bar with **About · Filmography** tabs, centered hero, `bg-card` inner shell, share + smart back, biography expand drawer, and filmography grid parity with the cast drawer — without generalizing `MovieDetailViewShell` or adding community/streaming/presence.
**Supersedes:** [2026-06-30-person-page-redesign-design.md](./2026-06-30-person-page-redesign-design.md) (pill + top-align pass; this spec is the movie-detail-parity target).
**Out of scope (YAGNI):** `MovieThemeProvider` / accent theming, listing presence, community/quotes/streaming tabs, role-grouped filmography (acting vs directing), new API fields, cinematic backdrop hero, right-rail section nav.

## Context

`/people/[id]` is reachable from ⌘K **Cast & Crew** search and cast links on film detail. The June 2026 pill + layout pass (`PersonPageBackPill`, top-aligned `article`, `Section` + `MoviePoster`) improved chrome but still reads as a generic profile article: left-aligned small portrait with `border-border`, no `bg-card` shell, no sticky detail top bar, no share, no synopsis drawer, and a filmography grid that does not match `PersonFilmographyGrid` in the cast drawer.

Film/TV detail (`MovieDetailViewShell`) establishes the canonical pattern: `bg-background` canvas, `rounded-[2.5rem] bg-card` content shell, sticky `MovieDetailTopBar` (back · segmented tabs · share), centered hero with large artwork and `ListingDetailHeroSynopsis`, and tab panels below the hero. Person detail should feel like the same product surface with only the tabs and body content that make sense for a person entity.

## Architecture

### New modules

| Module | Kind | Responsibility |
| --- | --- | --- |
| `apps/web/src/lib/person-detail-view.ts` | lib | `PersonDetailView = "about" \| "filmography"`; parse from `?view=`; `buildPersonDetailViewHref(basePath, view)` |
| `apps/web/src/components/people/person-detail-view-shell.tsx` | client | Shell: `LobbyNavigationProvider`, sticky top bar, `bg-card` section, hero slot, tab panels (`hidden` by view) |
| `apps/web/src/components/people/person-detail-top-bar.tsx` | client | Back (`DetailMotionLink` + smart return), **About · Filmography** tab track (sliding pill), Share (`DetailMotionButton` + icon swap) |
| `apps/web/src/components/people/person-detail-hero.tsx` | server or client | Centered portrait + meta + `ListingDetailHeroSynopsis` for biography |

### Page (`apps/web/src/app/(app)/people/[id]/page.tsx`)

Remains a **server component**. Flow unchanged: `serverApi().api.people({ id }).get()` → `PersonPayload`; `sortFilmographyByYearDesc` before render. Restructure JSX:

1. Wrap in `PersonDetailViewShell` with `initialView` from `searchParams.view`.
2. Pass **hero** (portrait, name, department, lifespan, bio synopsis).
3. Pass **about** panel: optional centered **View on TMDb** link below hero content (muted text link to `https://www.themoviedb.org/person/${id}`, `target="_blank" rel="noreferrer"`). No duplicate biography block.
4. Pass **filmography** panel: `MovieDetailBodySection` + `PersonFilmographyGrid` (map API rows to `PersonFilmographyRow` shape if needed).

### Removed / replaced

- **`PersonPageBackPill`** and **`PERSON_PAGE_PILL_CLASS`** — superseded by `PersonDetailTopBar` back pill. Delete file if unused elsewhere.
- Inline `article` layout, `Section` + `MoviePoster` grid, top-row TMDb pill.

### Explicit non-goals

- Do **not** extend `MovieDetailViewShell` or `MovieDetailTopBar` with a `person` listing kind — keep person chrome in `components/people/` to avoid film-specific props (presence, quotes episode picker, watch providers).
- Do **not** add `loading.tsx` in this pass unless trivial; optional follow-up.

## Visual & layout

### Surface stack

```
bg-background (app canvas)
└─ PersonDetailTopBar (sticky, scroll scrim)
└─ section.rounded-[2.5rem].bg-card  ← HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME
   └─ article
      ├─ hero (always visible)
      └─ tab panel (about | filmography)
```

### Hero (always visible, all tabs)

Mirror film detail hero spacing (`max-w-lg` … `lg:max-w-2xl`, centered, `pt-12` … `lg:pt-20`):

| Element | Treatment |
| --- | --- |
| Portrait | `aspect-2/3`, `max-w-[min(100%,22rem)]`, `rounded-[1.25rem] sm:rounded-[1.5rem]`, `shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)]`, **no** `border-border`. Subtle image outline per globals (`rgba(255,255,255,0.1)` on dark). `Clapperboard` fallback when no `profileUrl`. |
| Department | `text-xs uppercase tracking-wider text-muted-foreground` when `knownForDepartment` set |
| Name | `font-sans font-semibold text-3xl sm:text-4xl text-balance tracking-[-0.02em]` |
| Lifespan | `Calendar` icon + formatted dates when `birthday` / `deathday` present |
| Biography | `ListingDetailHeroSynopsis` with `title={person.name}` and `overview={person.biography}` — long bios use tap drawer (same as film plot) |

### About tab

Hero content only. Below synopsis (inside about panel or hero footer): muted **View on TMDb** text link — not a competing top-bar pill.

### Filmography tab

- `MovieDetailBodySection` title **Filmography**, subtitle count (`N film and TV title(s)…`).
- `PersonFilmographyGrid` with `sortFilmographyByYearDesc` rows.
- Empty state: `rounded-2xl bg-card/40 p-10 text-center text-muted-foreground text-sm` (match prior person page empty copy intent).

### Chrome & motion

- **Back:** Reuse `useMovieDetailReturn` / `resolveMovieDetailReturn` — label reflects referrer (e.g. search, film detail, `/home`).
- **Share:** Copy `window.location.href`; toast success; `Share` → `Copied` icon swap via `DetailMotionButton`.
- **Tabs:** `motion` `layoutId="person-detail-view-pill"` sliding `bg-background` pill inside `rounded-full bg-card p-1` track — same language as `MovieDetailTopBar`.
- **Navigation:** `LobbyNavigationProvider` + `router.prefetch` on tab hrefs for instant switches; panels toggled with `hidden={view !== "…"}` (hero stays mounted).
- **Press:** `DetailMotionLink` / `DetailMotionButton` scale `0.96` on press.
- **Sticky scrim:** Top bar `after:` gradient when `scrollY > 2` (copy film detail pattern).
- **`prefers-reduced-motion`:** Honor via existing motion helpers and transitions-dev guards where CSS snippets are added.

## Data flow

Unchanged. `GET /api/people/:id` → `{ person, filmography, code? }`. Map filmography rows to `PersonFilmographyRow` if field names differ (`posterUrl`, `mediaKind`, `roles`, `releaseDate`). Sort server-side in the page via `sortFilmographyByYearDesc` before passing to the grid.

`?view=filmography` deep-links directly to the filmography tab (shareable).

## Error handling

| Case | Behavior |
| --- | --- |
| Invalid id | `notFound()` |
| `data` null / `person` null | `notFound()` |
| `TMDB_UNCONFIGURED` | Top-aligned message inside shell (back pill still works); no hero |
| No profile image | `Clapperboard` fallback in hero |
| Empty filmography | Restyled empty state in filmography tab |

## Testing

### Unit

- `person-detail-view.ts`: `parsePersonDetailView` defaults to `about`; accepts `filmography`; `buildPersonDetailViewHref` omits query for `about`, sets `?view=filmography` otherwise.

### Manual

1. Search Cast & Crew → open person → layout matches film detail shell (`bg-card`, centered hero, sticky top bar).
2. Back returns to prior route (search or film detail); no history → `/home`.
3. **About · Filmography** tabs switch without full-page freeze; URL updates `?view=`.
4. Share copies URL; icon swaps to Copied briefly.
5. Long biography truncates; tap opens full-description drawer.
6. Filmography tab: `CataloguePosterTile` grid with roles + year; newest first.
7. Person with no credits: empty state in filmography tab; about tab still shows hero.
8. Mobile: back + share icon-only below `sm` (match film detail `pillIconOnlyMobile`).

## Implementation notes

- Reuse `PersonCreditPortrait` inside hero if it already handles grayscale/outline; otherwise inline `Image` with same sizing as `MovieDetailHeroMedia`.
- Ensure `PersonFilmographyGrid` import path is shared with drawer — single grid component, no duplicate markup in the page.
- After code changes: `graphify update .`
- Mark [2026-06-30-person-page-redesign-design.md](./2026-06-30-person-page-redesign-design.md) status **Superseded** in its header if not already.
