# Home catalogue search commit (Enter → grid)

**Status:** Approved (brainstorm 2026-06-04) · Plan: [`2026-06-04-home-search-commit.md`](../plans/2026-06-04-home-search-commit.md)  
**Date:** 2026-06-04  
**Scope:** `/home` **Movies & TV** lobby only — `HomeStickySearch`, `CatalogSearchDialogRoot`, catalogue grid  
**Related:** [2026-05-20-search-dialog-catalogue-tags-v2-design.md](./2026-05-20-search-dialog-catalogue-tags-v2-design.md) · [2026-05-29-cmdk-tag-search-design.md](./2026-05-29-cmdk-tag-search-design.md) · `use-catalogue-tag-search.ts` · `planCatalogueTagSearch`

## Summary

When a patron presses **Enter** in the ⌘K catalog search dialog with a **catalogue-eligible** query (free text and/or committed tags that drive Films/TV results — studio, genre, media, curated, etc.), Sense should:

1. **Close** the dialog (exit animation preserved).
2. Show a **truncated summary** on the sticky headbar pill (e.g. `Pixar · Horror · neon`).
3. Replace the **browse catalogue grid** with **paginated search results** (same fetch semantics as the dialog, without the ~20-row cap).
4. Persist the committed query in the **URL** so refresh, back/forward, and share links keep state.

**People** and **Lists** modes stay dialog-only — Enter does not commit those (unchanged pick-to-navigate behavior).

**Community** browse is unchanged — `search` param is ignored when `browse=community`.

---

## Locked decisions (brainstorm)

| Topic | Decision |
|--------|----------|
| Surface | `/home` **Movies & TV** only |
| Headbar | **Summary label** on pill; click reopens dialog with full tokens |
| Catalogue interaction | **Search replaces** browse grid; sort / venue / TV run chips **hidden** while search active |
| Persistence | **URL is source of truth** |
| Enter eligibility | Commits when the draft would show **catalogue** results in the dialog — free text and/or tags except **Lists**; **not** People-only |
| Clear search | × on pill, clear tokens + Enter in dialog, or tap **Movies/TV** browse rail (restores last browse chips from `home-lobby-persist`) |

---

## Problem

| Symptom | Cause |
|---------|--------|
| Dialog caps at ~20 rows | `SEARCH_DIALOG_MAX_RESULTS = 20` in `home-sticky-search.tsx` |
| Enter only saves recents | `handleFormSubmit` → `submitQuery()` — no URL write, no grid swap, no close |
| Pill never shows active query | `HomeStickySearch` always renders placeholder `Films, TV, @people, lists…` |
| Grid ignores dialog filters | `PopularMoviesInfinite` on `/home` reads sort/venue/run URL params only — no wired `q` / tag bundle |

---

## User flow

### Commit (Enter)

1. Patron on `/home?browse=movies` or `browse=tv` opens ⌘K.
2. Commits tags and/or types free text (same token field as today).
3. Presses **Enter** when `canCommitCatalogueSearch(draft)` is true (see below).
4. System:
   - Records recents (existing `recordHomeSearchRecent`).
   - Writes URL via `router.replace` (no scroll jump): drops browse-chip params (`sort`, `venue`, `run`, `animeSeason`), sets `search` + correct `browse`.
   - Closes dialog (`beginClose`).
5. Pill shows truncated summary via `formatCommittedSearchSummary(tags, freeText)`.
6. Catalogue body renders **search grid** (infinite scroll).

### Re-open / edit

- Click pill → dialog opens with tokens restored from URL (`parseHomeCatalogueSearchParam`).
- Patron edits; **Enter** re-commits (updates URL).

### Clear

- **×** on pill (when summary visible) → remove `search` from URL, restore browse params from `readHomeLobbyPersist()` for active `browse`.
- **Movies / TV** browse rail tap → same as × (search cleared before or as part of browse navigation — prefer clearing `search` when leaving search mode via rail).
- Empty draft + Enter → no-op (stay in dialog).

### Enter no-op cases

- Empty draft.
- **`lists`** tag present (list search stays in dialog).
- People-only draft (profile suggestions visible, no catalogue tags/text that would hit TMDb catalogue).
- Already on `browse=community` (dialog may still open from ⌘K elsewhere, but commit target is movies/tv — if patron commits from community context, navigate to `/home?browse=movies|tv&search=…`).

---

## Enter eligibility (`canCommitCatalogueSearch`)

Mirror dialog result routing:

```ts
// Pseudocode — implement beside deriveCatalogueFilterBundle / deriveSearchState
function canCommitCatalogueSearch(tags: SearchTag[], freeText: string): boolean {
  if (tags.some((t) => t.kind === "lists")) return false;
  const q = freeText.trim();
  if (tags.some((t) => t.kind !== "lists")) {
    // Any committed catalogue tag (studio, media, genre, curated)
    return true;
  }
  return q.length > 0; // plain text → movie/TV search
}
```

People rows may still show while typing `@…`, but Enter commits only when the above is true (typically `@` alone with no catalogue tags does not commit).

---

## URL contract

### Params

| Param | When set | Notes |
|-------|----------|-------|
| `browse` | Always on commit | `movies` or `tv` from media tag, else dialog Films/TV toggle / current lobby |
| `search` | Committed catalogue query | `encodeURIComponent(serializeStructuredQuery(tags, freeText))` — middle-dot segments per v2 recents |

### While `search` is present (and `browse` is `movies` or `tv`)

- **Strip / ignore:** `sort`, `venue`, `run`, `animeSeason`.
- **Do not set** on commit — browse chips are inactive until search cleared.
- **Community:** if URL somehow has `search` + `browse=community`, ignore `search` for Community body (no grid change).

### Examples

```
/home?browse=movies&search=Pixar+%C2%B7+Horror+%C2%B7+neon
/home?browse=tv&search=Anime+%C2%B7+TV+shows
/home?browse=movies&search=interstellar
```

After clear:

```
/home?browse=movies&sort=popular&venue=theaters
```

(restored from `home-lobby-persist` slot for movies)

### Parsing

- Client: `parseRecentStructuredQuery(decodeURIComponent(search), browseStudios, { movieGenres, tvGenres })` — **reuse existing** parser from recents.
- Server RSC: optional lightweight read for metadata only; grid fetch stays client-side to match infinite scroll pattern.

---

## Headbar pill (summary label)

| State | Pill content |
|-------|----------------|
| No `search` param | Placeholder `Films, TV, @people, lists…` (unchanged) |
| `search` active | Truncated summary, e.g. `Pixar · Horror · neon` — `truncate`, semibold or default foreground |
| Hover/focus | Same click target; optional subtle **×** clear control at trailing edge (`aria-label="Clear search"`) |

**Summary formatter:** reuse `serializeStructuredQuery` then truncate (~40 chars) with ellipsis; do not show raw URL encoding.

Click pill → `requestOpen()`; dialog hydrates `searchTags` + `freeText` from URL, not empty draft.

---

## Catalogue grid (search mode)

### Behavior

When `/home` has valid `search` + `browse` in `{movies, tv}`:

1. **Hide** `HomeCatalogSortChips` and `HomeCatalogViewModeToolbar` (and TV run rail) — single row optional: muted “Search results” + clear link.
2. Replace `PopularMoviesInfinite` lobby props with **search-driven discover/search** using shared plan logic:

```
planCatalogueTagSearch({
  q: freeText,
  listingKind: browse === "tv" ? "tv" : "movie",
  studioId, genreIds, keywordIds from deriveCatalogueFilterBundle(tags, listingKind),
})
```

3. **Infinite scroll:** extend `PopularMoviesInfinite` **or** add `HomeCatalogueSearchInfinite` that:
   - Calls `fetchMoviesDiscover` / `fetchTvDiscover` with page increment when `plan.mode === "discover"`.
   - Calls `fetchMoviesSearch` / `fetchTvSearch` with page when `plan.mode === "search"`.
   - Reuses poster tile + radial toolkit parity with lobby grid (`catalogueRadialSurface="home"`).
4. **No 20-row cap** — standard TMDb pagination until `totalPages` exhausted.
5. **Empty:** centered full-height state — “No films found for …” + **Clear search** button.
6. **Loading:** existing catalogue skeleton (`tmdb-lobby-skeleton` / grid shimmer).

### Strict AND

Same as ⌘K structured search ([cmdk-tag-search spec](./2026-05-29-cmdk-tag-search-design.md)): tags + text → discover with `with_text_query`, not plain `/search` alone.

---

## Architecture (recommended: URL + thin helpers)

```
URL (?browse & ?search)
  ↓
home-catalogue-search-param.ts   parse / serialize / canCommit / summary label
  ↓
HomeStickySearch pill            read URL → summary; clear → router.replace
CatalogSearchDialogRoot          Enter → write URL + beginClose
HomeTmdbLobbyBody (or gate)      search ? SearchInfinite : PopularMoviesInfinite
HomeCatalogSortChips / Toolbar   hidden when search active
```

No separate Zustand store for committed query — **URL only**. Dialog ephemeral state clears on close as today; reopen reads URL.

Optional: `useHomeCatalogueSearchParams()` hook wrapping `useSearchParams` + parse/cache genre labels.

---

## Component / file touch list

| File | Change |
|------|--------|
| `apps/web/src/lib/home-catalogue-search-param.ts` | **New** — URL parse/serialize, `canCommitCatalogueSearch`, summary formatter, clear/build href helpers |
| `apps/web/src/lib/home-catalogue-search-param.test.ts` | **New** — round-trip, eligibility, clear href |
| `apps/web/src/components/home/home-sticky-search.tsx` | Enter commit path; pill summary + clear; dialog hydrate from URL on open |
| `apps/web/src/components/home/home-catalog-sort-chips.tsx` | Return null when search active |
| `apps/web/src/components/home/home-catalog-view-mode-toolbar.tsx` | Return null when search active |
| `apps/web/src/components/home/home-tmdb-lobby-chrome.tsx` or `home/page.tsx` | Branch grid on search param |
| `apps/web/src/components/home/home-catalogue-search-infinite.tsx` | **New** — paginated grid using `planCatalogueTagSearch` |
| `apps/web/src/lib/catalogue-tag-search-plan.ts` | Optional: export page-aware helper if needed |
| `apps/web/src/lib/home-browse-surface-nav.ts` | Clear `search` when navigating browse surfaces |

---

## Error handling

| Case | Behavior |
|------|----------|
| Malformed `search` param | Treat as plain free-text only if no separator; else ignore invalid segments; fallback empty → redirect strip `search` |
| TMDb setup missing | Same `tmdbSetupHint` inline status as dialog |
| Commit on community | `router.replace` to `/home?browse=movies|tv&search=…` (prefer last movies/tv from persist) |
| Browser back | URL removes `search` → browse grid + chips restore from URL/persist |

---

## Testing

### Unit

- `canCommitCatalogueSearch` — lists false, text true, studio tag true, people-only false.
- URL round-trip: tags + freeText → serialize → parse → equal bundle.
- Clear href drops `search`, restores persist sort/venue.

### Manual

1. `/home` scroll down → ⌘K → `A24` Tab → `horror` Tab → `neon` → Enter → dialog closes, pill summary, grid filtered, chips hidden.
2. Refresh → state preserved.
3. Copy URL → new tab → same grid.
4. Back → returns to browse grid.
5. × clear → chips return, placeholder pill.
6. Lists tag + Enter → no commit.
7. `@handle` people only + Enter → no commit.
8. TV: `Anime` chip + Enter → `browse=tv`, grid anime discover.
9. Community tab → search param ignored; community feed normal.

---

## Out of scope

- `/diary`, `/watchlist`, `/lists` commit (future).
- Inline editable token field in headbar (summary-only per brainstorm).
- SEO indexing of search URLs.
- Community / People / Lists grid replacement.

---

## Success criteria

- [ ] Enter commits catalogue drafts on `/home` movies/tv, closes dialog, updates pill summary.
- [ ] Grid paginates beyond 20 results with same AND semantics as dialog.
- [ ] URL encodes full commit; refresh and share work.
- [ ] Sort/venue/run hidden while search active; restored on clear.
- [ ] Lists and People-only drafts do not commit on Enter.
