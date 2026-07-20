# Person awards on `/people/[id]`

**Status:** Approved (brainstorm 2026-07-20; approach **2 · Person strip + drawer**; human **yes** / **looks good**)
**Date:** 2026-07-20
**Scope:** Show awards and nominations for actors, directors, and other crew on person About — compact **top 3 wins** teaser plus **View all** drawer — sourced from Wikidata, with optional Sense deep links to the related film/TV title.
**Related:** [2026-06-30-person-detail-shell-design.md](./2026-06-30-person-detail-shell-design.md) (shell; awards were out of scope there). Film parity: `MoviePremieresFestivals` + `wikidata-movie-awards.ts` (do **not** overload those components).
**Out of scope (YAGNI):** New top-bar **Awards** tab; editing or patron-submitted awards; non-Wikidata sources; putting the full awards payload on every `GET /api/people/:id` consumer; caching beyond Next `revalidate`; presence/community on person pages.

## Context

Patrons open `/people/[id]` from ⌘K Cast & Crew and cast links. About already has hero, TMDb link, and a tagged-image stills rail. Film/TV detail shows **Awards & festivals** via TMDb keywords + Wikidata (`P166` / `P1411`). Person pages have no equivalent, even when the person has a rich Wikidata award graph.

## Locked product choices

| Choice | Decision |
| --- | --- |
| Placement | **About** only — compact summary + **View all** drawer (not a new tab) |
| Content | **Wins + nominations**; wins first; nominations muted in the drawer |
| Row fields | Award label · year · won/nominated · **work title** when known; work **links** to `/movies|tv/[id]` when TMDb id resolves |
| Teaser | **Top 3 wins** only; full list in drawer |
| Empty / soft-fail | Omit awards chrome when Wikidata returns nothing or times out |

### About order

1. Hero (always)
2. TMDb text control
3. Stills rail (when `screenshots` exist)
4. **Awards** teaser / View all (when any awards exist)
5. End of About

### Teaser vs drawer when wins are sparse

- **≥1 win:** show up to **3** win tiles in the teaser; **View all** opens the drawer with wins then nominations.
- **0 wins, ≥1 nomination:** no win tiles; show a muted **View all awards** control so nominations are reachable.
- **0 awards:** omit the section entirely.

## Architecture

### Approach

**Person-specific strip + drawer, shared festival icons.** RSC fetches Wikidata (same soft-fail pattern as movie awards). Reuse `FestivalRecognitionIcon` and award-name → icon rules from `movie-festival-recognition.ts`. Do **not** reuse `MoviePremieresFestivals` or force person rows into the film 12-column festival grid.

### New modules

| Module | Kind | Responsibility |
| --- | --- | --- |
| `apps/web/src/lib/wikidata-person-awards.ts` | lib | SPARQL for person awards; normalize rows; timeout + empty on error; `revalidate` 24h |
| `apps/web/src/lib/person-awards.ts` | lib | Sort (wins first, prestige tier, year desc); teaser pick (top 3 wins); work href helper; icon resolution via existing festival rules |
| `apps/web/src/components/people/person-awards-section.tsx` | UI | About teaser (≤3 win tiles + View all) |
| `apps/web/src/components/people/person-awards-drawer.tsx` | client | Full list in `DetailVaulSheet` / awards-drawer pattern; wins then muted nominations; work links |

### Row shape (normalized)

```ts
type PersonAwardRow = {
  id: string;
  awardLabel: string;
  status: "won" | "nominated";
  year: number | null;
  workTitle: string | null;
  workTmdbId: number | null;
  workMediaKind: "movie" | "tv" | null;
  icon: FestivalIconId; // from existing festival rules
};
```

### Data resolution

1. Resolve Wikidata person from TMDb person id (**P4985**). Prefer also IMDb `nm…` (**P345**) when available — expose `imdbId` from person detail if cheap (append `external_ids` on server person fetch, or a small external_ids read on the RSC path only for awards).
2. Statements: **P166** (won) and **P1411** (nominated); year **P585**; work qualifier **P1686** (label + optional TMDb/IMDb on the work entity).
3. Work → Sense: Wikidata TMDb movie **P4947** → `/movies/[id]`; TV **P4983** → `/tv/[id]`. If only IMDb exists and no TMDb id, show the work label **without** a link.
4. Soft-fail: 5s timeout, empty array on error (hero and stills still render).
5. Hard cap drawer list at **100** deduped rows after sort.

### Sort

1. Status: `won` before `nominated`
2. Within status: known festival/award icon prestige (Oscars → BAFTA → … → generic `award`), matching the spirit of film recognition ranking
3. Then **year descending** (null years last)
4. Stable tie-break on `awardLabel` + `workTitle`

### Wiring

- `apps/web/src/app/(app)/people/[id]/page.tsx` About slot: after stills, render `PersonAwardsSection` fed by RSC `fetchWikidataPersonAwards` + `buildPersonAwardRows` (Suspense optional so hero is not blocked).
- Awards fetch stays on the **web RSC** path — not required on every API client of `GET /api/people/:id`.
- Optional: person JSON may include `imdbId` for Wikidata disambiguation; that is the only allowed API field addition if needed.

## Visual & interaction

### Teaser

- Section title: **Awards** (or **Awards & festivals** if copy should match film detail — prefer **Awards** for people).
- Up to three win tiles: festival/award icon + award name; year and work title as secondary lines (`text-balance`); work title links when `workTmdbId` is set.
- **View all** centered below when there are more rows than the teaser shows, or when nominations-only (control-only teaser).

### Drawer

- Same overlay stacking as `MovieAwardsViewAllDrawer` / `DetailVaulSheet` (`APP_MODAL_OVERLAY_CLASS` / detail-vaul patterns).
- Header: person name + Awards.
- Wins list first (normal emphasis); nominations below with muted foreground.
- Each row: icon, award label, year, status, work (link or plain text).
- Surface depth tokens; no decorative borders/rings on rows.

## Error handling

| Case | Behavior |
| --- | --- |
| Wikidata timeout / error | Omit awards section |
| Person not on Wikidata | Omit awards section |
| Wins only | Teaser + drawer without nominations block |
| Nominations only | Muted View all control; drawer lists nominations |
| Work without TMDb id | Show work title, no link |

## Testing

### Unit

- Normalize SPARQL bindings → `PersonAwardRow`
- Sort: wins before nominations; year desc within tier
- Teaser: top 3 wins only; ignores nominations
- `personAwardWorkHref(row)` → `/movies/…`, `/tv/…`, or `null`

### Manual

1. Person with major wins (e.g. `/people/1892` or another richly awarded person) — teaser shows ≤3 wins; View all lists wins then muted noms; work links open Sense titles when resolvable.
2. Person with nominations only — no win tiles; View all still available.
3. Person with no Wikidata awards — no awards chrome.
4. Soft-fail: blocked Wikidata still leaves hero + stills intact.

## Implementation notes

- Mirror `fetchWikidataMovieAwards` User-Agent and SPARQL endpoint conventions.
- Extract shared “award label → `FestivalIconId`” if needed so person and film stay in sync — prefer importing existing helpers over duplicating `FESTIVAL_RULES`.
- After code changes: `graphify update .` when available.
- Update person shell mental model in AGENTS.md only if the shipped behavior becomes a durable preference (About awards teaser + drawer).
