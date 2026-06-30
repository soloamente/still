# Search: Cast & Crew (directors & actors)

**Status:** Approved (brainstorm 2026-06-30; human **go**)
**Date:** 2026-06-30
**Scope:** Add TMDb person search (directors, actors, and all cast/crew) to the global ⌘K search dialog, landing on the existing `/people/[id]` page. Rename the existing patron section header from "People" to "Members" to remove ambiguity.
**Out of scope (YAGNI):** Filtering the catalogue by a person, following/saving people, caching person search hits, a "department" filter UI.

## Context

The unified search dialog ([home-sticky-search.tsx](../../../apps/web/src/components/home/home-sticky-search.tsx)) currently returns Films, TV, studios, genres, lists, and **patron profiles** (the section labelled "People", fed by `useProfileSearch` → `GET /api/profiles/search`). TMDb cast/crew person search was explicitly deferred in [2026-05-29-unified-search-people-design.md](2026-05-29-unified-search-people-design.md) ("out of scope v1"). This spec delivers that follow-up.

The person **detail page already exists** at [apps/web/src/app/(app)/people/[id]/page.tsx](../../../apps/web/src/app/(app)/people/[id]/page.tsx), backed by `GET /api/people/:id` (detail + merged filmography). The only missing capability is reaching it by **searching a name**.

### Naming collision
"People" in the dialog today means **app users (patrons)**, not film people. We add a distinct **"Cast & Crew"** section for TMDb people and **rename the patron section header "People" → "Members"**.

## Architecture — mirror the existing patron-search pattern

The feature replicates, layer for layer, how patron search already works, for codebase consistency:

| Layer | Existing (patrons) | New (cast & crew) |
|---|---|---|
| TMDb lib | `tmdbApi.searchMovies` / `searchTv` | **`tmdbApi.searchPerson(q, page, opts)`** → `/search/person` |
| Server route | `GET /api/profiles/search` | **`GET /api/people/search`** (added to [people.ts](../../../apps/server/src/routes/people.ts)) |
| Web fetch helper | profile fetch | **`fetchPeopleSearch(q, { signal })`** in `still-api-fetch.ts` |
| Web hook | `useProfileSearch(query, enabled)` | **`useCastCrewSearch(query, enabled)`** (debounced, abortable) |
| Section component | `SearchDialogPeopleResults` | **`SearchDialogCastCrewResults`** + `SearchDialogCastCrewRow` |
| Destination on select | `/profile/[handle]` | `/people/[id]` (already exists) |

## Component 1 — TMDb lib: `searchPerson`

Add to [tmdb.ts](../../../apps/server/src/lib/tmdb.ts), mirroring `searchTv`:

```ts
/** TMDb `/search/person` — rows carry `known_for` (their notable titles) and `known_for_department`. */
searchPerson(query: string, page = 1, fetchOpts: TmdbFetchOptions = {}) {
  return tmdb<TmdbPaged<TmdbPersonSummary>>(
    "/search/person",
    { query, page, include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent) },
    fetchOpts,
  );
}
```

Add a `TmdbPersonSummary` type alongside the existing summary types (`id`, `name`, `profile_path`, `known_for_department`, `known_for: Array<{ title?; name?; media_type }>`, `popularity`).

## Component 2 — Server route: `GET /api/people/search?q=&page=`

Add to [people.ts](../../../apps/server/src/routes/people.ts), following the `/api/movies/search` contract exactly:

- **No `TMDB_API_KEY`** → return the existing `TMDB_UNCONFIGURED` shape so the UI shows the setup hint.
- **Empty `q`** → `{ results: [], page: 1, total_pages: 0, total_results: 0 }`.
- Resolve `language` via `getTmdbLanguageForUser(user?.id)` and `showAdultContent` via `getShowAdultContentForUser(user?.id)` (same as movies search).
- Call `tmdbApi.searchPerson(q, page, { language, showAdultContent })`.
- Map each hit to a slim row:
  ```ts
  {
    id: number,
    name: string,
    profileUrl: string | null,        // tmdbImg.profile(profile_path, "w185") (null when no photo)
    knownForDepartment: string | null, // "Acting" | "Directing" | "Writing" | …
    knownForTitles: string[],          // up to 3 titles/names from known_for
  }
  ```
- Return `{ results, page, total_pages, total_results }`.
- **All** people are returned — no department filtering. `knownForDepartment` is surfaced as the per-row role label.

## Component 3 — Web data layer

- `fetchPeopleSearch(q, { signal })` in [still-api-fetch.ts](../../../apps/web/src/lib/still-api-fetch.ts) — mirrors `fetchMoviesSearch`/`fetchTvSearch` (returns `{ data, error }`, supports `AbortSignal`).
- `useCastCrewSearch(query, enabled, debounceMs = 240)` — mirrors `useProfileSearch`/`useCatalogTextSearch`: debounce, abort in-flight on query change, empty query clears, surfaces `setupHint` via `tmdbSetupHint(data)`. Exposes `{ results, loading, setupHint }` where `results: CastCrewSearchHit[]`.
- `CastCrewSearchHit` type mirrors the server row shape.

## Component 4 — UI

- **`SearchDialogCastCrewResults`** (+ `SearchDialogCastCrewRow`), modelled on `SearchDialogPeopleResults`/`-row`:
  - Section header: **"Cast & Crew"**.
  - Row: circular profile image (`profileUrl`) or initial fallback; primary line = `name`; secondary line = `knownForDepartment` + " · " + `knownForTitles.join(", ")` (e.g. *Director · Inception, Oppenheimer*).
  - Select → `router.push(/people/${id})` and close dialog.
  - Loading skeleton reuses `SearchDialogListSkeleton`.
- Wire into [home-sticky-search.tsx](../../../apps/web/src/components/home/home-sticky-search.tsx):
  - Call `useCastCrewSearch(trimmedDraft, peopleSearchEnabled)` next to `useProfileSearch`.
  - Render `<SearchDialogCastCrewResults>` in the results body, **independent of the Films/TV chip** (people are not a media kind), placed adjacent to the patron section.
- **Rename** the patron section header in `SearchDialogPeopleResults` from **"People" → "Members"**. (Internal code keeps `Patron`/profile naming; only the visible label changes. "Patrons" is the alternative if preferred — trivial swap.)

## Data flow

```
type in ⌘K dialog
  → useCastCrewSearch(query) [debounced, abortable]
    → fetchPeopleSearch(q) → GET /api/people/search?q=
      → tmdbApi.searchPerson → TMDb /search/person
      → map to slim rows {id,name,profileUrl,knownForDepartment,knownForTitles}
  → SearchDialogCastCrewResults renders "Cast & Crew" section
  → select row → /people/[id] (existing detail + filmography page)
```

## Error handling

- Missing `TMDB_API_KEY` → `TMDB_UNCONFIGURED` from server; UI shows the existing setup hint (same as movies/TV search), no crash, empty section.
- Network/abort → hook clears results silently (mirrors `useCatalogTextSearch` catch).
- TMDb error/empty → empty `results`; section renders nothing (returns `null` when no hits and not loading).

## Testing

- **Server:** unit-test the row mapper (TMDb person → slim row): picks up to 3 `known_for` titles (handles `title` vs `name`), maps `profile_path` → URL, passes through `known_for_department`; empty `q` short-circuits; `TMDB_UNCONFIGURED` when key absent. Follow the style of existing route/lib tests (e.g. `profile-search.test.ts`).
- **Web:** test `useCastCrewSearch` debounce/abort/clear-on-empty like existing hook tests; test the row's secondary-line composition.
- **Manual:** with the now-configured `TMDB_API_KEY`, search "Nolan" → Christopher Nolan appears under Cast & Crew with role "Directing" and known-for titles; selecting opens `/people/[id]`.
```
