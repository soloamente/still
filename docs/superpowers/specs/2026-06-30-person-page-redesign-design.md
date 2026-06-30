# Person page redesign (`/people/[id]`)

**Status:** Superseded by [2026-06-30-person-detail-shell-design.md](./2026-06-30-person-detail-shell-design.md) (movie-detail shell parity)
**Date:** 2026-06-30
**Scope:** Realign the actor/crew detail page to the site's detail-page design patterns: top-aligned layout with a back-pill chrome (same pill language as the film detail top bar), a hero (portrait + key info) using site tokens, and a filmography section sorted newest-first using the standard `Section`/`MoviePoster` components. Remove the ad-hoc bits (vertical centering, bottom "Search films" link, inline TMDb footer, dashed empty state).
**Out of scope (YAGNI):** Cinematic backdrop hero, sticky section-nav tabs, accent theming, grouping filmography by role (acting vs directing), any new data from the server.

## Context

`apps/web/src/app/(app)/people/[id]/page.tsx` currently renders a generic centered `article` (`flex … justify-center` + `appShellMainContentMinHeightStyle`) that floats mid-viewport, with a small `rounded-md` portrait, an inline "Credits from TMDb" sentence, a dashed-border empty state, and a bottom "Search films" link. None of these match the site's detail pages (e.g. `/movies/[id]`), which top-align content and use a rounded-full `bg-card` pill chrome.

The page already uses good site primitives — `Section` (font-display heading), `MoviePoster`, `font-editorial` for the name. This redesign keeps those and fixes the layout/chrome/ad-hoc pieces. The film detail shell (`MovieDetailViewShell`/`MovieDetailTopBar`) is film-specific (tabs, share, lobby nav, watch providers) and is NOT reused; only its visual pill language is matched.

The page stays a server component; the only interactive piece (back) is a small client component.

## Components

### 1. `PersonPageBackPill` (new client component)
`apps/web/src/components/people/person-page-back-pill.tsx`. A rounded-full `bg-card` pill with a left chevron, matching the film top-bar pill language:
- `"use client"`; `useRouter` from `next/navigation`.
- On click: `router.back()`, with a fallback to `router.push("/home")` when there is no history (guard on `window.history.length <= 1`).
- Styling mirrors the film top-bar `pill` class: `inline-flex min-h-10 items-center gap-2 rounded-full bg-card px-4 py-2 font-medium text-sm text-foreground [@media(hover:hover)]:hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
- Label: chevron + "Back".

### 2. `sortFilmographyByYearDesc` (new pure helper + test)
`apps/web/src/lib/person-filmography.ts` already exports `filmographyReleaseYear`. Add a pure `sortFilmographyByYearDesc<T extends { releaseDate: string | null }>(items: T[]): T[]` that returns a new array sorted by release year descending, with year-less entries last (stable for equal years). Unit-tested.

### 3. Page rewrite (`/people/[id]/page.tsx`)
Restructure the rendered layout (no data/fetch changes):

- **Container:** drop `justify-center` + `appShellMainContentMinHeightStyle`; top-align. Keep `mx-auto w-full max-w-5xl` content column with top/bottom padding (`pt-6 pb-12`) and `space-y-8`.
- **Chrome row** (above the hero): `<PersonPageBackPill />` on the left; on the right, a secondary "View on TMDb" pill-style link (same pill class, `target="_blank" rel="noreferrer"`, to `https://www.themoviedb.org/person/${person.id}`). This replaces the inline "Credits from TMDb" sentence.
- **Hero** (`<header>`): keep two-column on `sm+` (portrait left, info right). Portrait: `rounded-2xl` (was `rounded-md`) with the existing border/bg and `Clapperboard` fallback. Info column: department eyebrow (existing style), `<h1>` name in `font-editorial` (unchanged), lifespan line with `Calendar` icon, biography paragraph with a clean fixed `line-clamp-6` (drop the mobile-only `sm:line-clamp-none` asymmetry).
- **Filmography:** keep `<Section title="Filmography" subtitle=…>` and the `MoviePoster` grid. Feed it `sortFilmographyByYearDesc(data.filmography)`. Each card unchanged (poster + roles line + year). Replace the dashed empty state with a site-consistent empty state: `rounded-2xl bg-card/40 p-10 text-center text-muted-foreground text-sm` (no `border-dashed`).
- **Remove:** the trailing "Search films" `<Link>` block (back-pill replaces it) and the inline TMDb footer paragraph (moved to chrome).
- **`TMDB_UNCONFIGURED` branch:** also top-align (drop `justify-center`/min-height) for consistency; copy unchanged.

## Data flow

Unchanged. `serverApi().api.people({ id }).get()` → `PersonPayload`; the page sorts `filmography` client-of-server-side via the pure helper before rendering. No new endpoints, no new fields.

## Error handling / edge cases

- Invalid id → `notFound()` (unchanged).
- `data` null / `person` null → `notFound()` (unchanged).
- `TMDB_UNCONFIGURED` → hint message, now top-aligned.
- No profile image → `Clapperboard` fallback (unchanged).
- Empty filmography → restyled empty state.
- Back with no history → fallback to `/home`.

## Testing

- **`sortFilmographyByYearDesc` (unit):** newest year first; entries with `null`/unparseable `releaseDate` sort last; equal years keep input order (stable); does not mutate the input array.
- **Manual:** open a person page from search → back-pill returns to the previous view; layout is top-aligned with the back pill + TMDb pill chrome; portrait is `rounded-2xl`; filmography is newest-first; an unknown person id with no credits shows the restyled empty state (not dashed).
```
