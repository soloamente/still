# ⌘K structured tag search — strict AND + Films/TV fix

**Status:** Implemented (2026-05-29)  
**Parent:** Track B sticky search / `HomeStickySearch` · `CatalogSearchDialogRoot`  
**Related:** [2026-05-29-sense-product-roadmap-design.md](./2026-05-29-sense-product-roadmap-design.md) · `apps/web/src/lib/search-curated-tags.ts` · `apps/web/src/lib/use-catalogue-tag-search.ts`

## Summary

Fix **⌘K** catalogue search when **committed filter tags** (Anime, genres, studio) are active:

1. **Strict AND** — typed query + tags must both apply (user chose **Option A**).
2. **Films / TV shows** toggle must change which TMDb catalogue runs, even when tags are present.
3. **Anime** quick chip keeps default **TV shows**, but **Films** must switch to movie discover when tapped.

Technical ids, pill shapes, and “All tags must match” copy are unchanged.

## Problem

| Symptom | Root cause |
|---------|------------|
| **Anime** + query returns non-anime titles | `useCatalogueTagSearch` calls plain `/search` when `q` is non-empty; genre/keyword from tags are dropped |
| **Films / TV** toggle has no effect with tags | Toggle updates `searchListingKind` only; hook reads `listingKind` from **committed tags** via `deriveCatalogueFilterBundle` (defaults to **Films**) |
| **Anime** chip implies TV but results are films | Chip sets `searchListingKind` to `tv` without a `media` tag or hook override |

Plain text search (no tags) via `useCatalogTextSearch` is unaffected.

## Locked behavior

### Tag + text (strict AND)

When `deriveCatalogueFilterBundle(tags)` yields **any** discover filter (`studioId`, `genreIds`, or `keywordIds`) **and** free text `q` is non-empty:

- Fetch **discover** (movie or TV per listing kind below), not `/search`.
- Pass `q` to server as TMDb **`with_text_query`** alongside existing `genre`, `keywords`, and `company` params.
- A row appears only if TMDb returns it under **all** active discover filters **and** the text query.

When tags yield discover filters and **`q` is empty**:

- Keep current behavior: popular discover for that filter bundle (no text param).

When **no** discover filters (e.g. only a `lists` tag):

- Unchanged list search path.

### Listing kind (Films vs TV)

**Effective listing kind** for structured search:

```
effectiveListingKind =
  committed media tag?.listingKind
  ?? searchListingKind   // Films / TV row under the query field
  ?? "movie"
```

`useCatalogueTagSearch` must accept `listingKind: "movie" | "tv"` from the dialog and use it **instead of** `deriveSearchState(tags).listingKind` when no `media` tag is committed.

UI links, empty-state copy, and result row hrefs already use `effectiveListingKind` — fetch must match.

### Anime chip

- Turning **Anime** on: add curated tag `{ slug: "anime" }` and set `searchListingKind` to **`tv`** (unchanged UX default).
- **Films** / **TV shows** buttons remain visible when `!hasMediaTag` (no explicit `media` pill from Tab completion).
- Tapping **Films** while Anime is on: `searchListingKind = "movie"` → movie discover + anime rules + optional `q`.
- Tapping **TV shows**: `searchListingKind = "tv"`.

Do **not** auto-insert a `media` tag from the Show row (avoids duplicate pills); pass `effectiveListingKind` into the hook.

### Plain search (no tags)

- `searchTags.length === 0` → `useCatalogTextSearch(freeText, effectiveListingKind)` — no change.

## Architecture

```
HomeStickySearch
  searchTags, freeText, searchListingKind
  effectiveListingKind = mediaTag ?? searchListingKind
       │
       ├─ tags.length === 0 ──► useCatalogTextSearch(q, effectiveListingKind)
       │
       └─ tags.length > 0 ──► useCatalogueTagSearch(tags, q, listingKind: effectiveListingKind)
                                    │
                                    deriveCatalogueFilterBundle(tags) → genreIds, keywordIds, studioId
                                    │
                                    hasDiscoverFilters?
                                      yes + q ──► GET /api/{movies|tv}/discover?q=…&genre=…&keywords=…&company=…
                                      yes, !q ──► GET /api/{movies|tv}/discover (sort popularity.desc)
                                      no + q ──► GET /api/{movies|tv}/search?q=…  (studio-only edge: company on search)
                                      lists ──► GET /api/lists/search
```

### Server

| Route | Change |
|-------|--------|
| `GET /api/movies/discover` | Optional query `q` (min 1 char trimmed) → TMDb `with_text_query` |
| `GET /api/tv/discover` | Same |
| `tmdbApi.discoverMovies` / `discoverTv` | Optional `withTextQuery?: string` → param `with_text_query` |

No change to `/search` routes for v1 (studio + text on tagged search stays discover-first when genre/keyword present; studio-only tag without genre may still use search + company filter as today).

### Client

| File | Change |
|------|--------|
| `apps/web/src/lib/use-catalogue-tag-search.ts` | Add `listingKind` arg; unified discover path when `hasDiscoverFilters`; pass `q` to discover fetchers |
| `apps/web/src/lib/still-api-fetch.ts` | `fetchMoviesDiscover` / `fetchTvDiscover` accept optional `q` |
| `apps/web/src/components/home/home-sticky-search.tsx` | Pass `effectiveListingKind` into `useCatalogueTagSearch` |

## Curated Anime rules (unchanged ids)

From `search-curated-tags.ts`:

- Movie: `genreIds: [16]`, `keywordIds: [210024]`
- TV: same

Applied via `deriveCatalogueFilterBundle` based on **effective listing kind**.

## Error handling & empty states

| Case | UX |
|------|-----|
| TMDb unconfigured | Existing `setupHint` / TMDB setup message |
| Tag + `q`, zero rows | Status: “No {films|TV shows} found for {q}” (existing pattern) |
| Rate / abort | AbortController unchanged; no duplicate requests |
| Invalid empty `q` on discover | Server ignores `q` when blank (same as omitting param) |

## Testing

| Layer | Check |
|-------|--------|
| Unit | `use-catalogue-tag-search` (mock fetch): with anime tag + `q`, assert discover called with genre/keyword + `q`, not search |
| Unit | `deriveCatalogueFilterBundle` + listing kind override behavior (hook test or small helper test) |
| Server | Route test or manual: `GET /api/tv/discover?genre=16&keywords=210024&q=naruto` returns only matching rows |
| Manual | ⌘K → **Anime** → type query → no live-action-only hits |
| Manual | **Anime** + **Films** vs **TV shows** → different result sets / endpoints |
| Manual | No tags → Films/TV toggle still works |

## Out of scope

- Client-side post-filter of `/search` results
- New curated tags beyond fixing the shared pipeline
- Changing Tab-completion `media` pill behavior
- `/home` catalogue grids (only ⌘K structured search)
- TMDb search ranking tweaks when no discover filters

## Success criteria

1. **Anime** + **TV shows** + query → only anime TV matching query (strict AND).
2. Same query + **Films** → anime **movies** matching query.
3. **Films / TV** toggle changes results when any genre/curated/studio tag is active.
4. Plain query without tags → unchanged behavior.

## Implementation note

After spec approval, use **writing-plans** for task breakdown (Executor). Do not ship until plan is reviewed if following Planner/Executor scratchpad workflow.
