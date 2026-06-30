# Search: category pills + auto-switch

**Status:** Approved (brainstorm 2026-06-30; human **ok**)
**Date:** 2026-06-30
**Scope:** Turn the search dialog's Films/TV toggle into a 5-way single-select pill group (Films, TV, Cast & Crew, Lists, Members) for plain free-text queries, where each pill shows a result count, empty pills are dimmed/disabled, and the active category auto-switches to the highest-priority category that has results when the current one is empty.
**Out of scope (YAGNI):** Remembering the last category across sessions; "99+" count capping; category pills inside tag (genre/studio/lists-tag) queries; reordering pills.

## Context

The unified ⌘K dialog ([home-sticky-search.tsx](../../../apps/web/src/components/home/home-sticky-search.tsx)) currently, for a plain free-text query:
- Shows a **Films / TV** toggle (`SearchDialogListingKindChips`) driven by `searchListingKind`; the catalogue text search (`useCatalogTextSearch`) fetches only the active kind (movies **or** TV).
- Renders **Cast & Crew** (`useCastCrewSearch`) and **Members** (`useProfileSearch`) as always-visible stacked sections, independent of the toggle.
- Treats **Lists** as a separate `resultMode` reached only via a lists tag (`useCatalogueTagSearch` → `fetchListsSearch`); there is no plain free-text lists search today.

This spec unifies these five result types into one single-select pill group with counts and auto-switch. It builds directly on the cast & crew search shipped in [2026-06-30-search-cast-crew-people-design.md](2026-06-30-search-cast-crew-people-design.md).

### Decisions (human)
| Topic | Decision |
|---|---|
| Categories as pills | **All five**: Films, TV, Cast & Crew, Lists, Members |
| Fetch strategy | **Parallel** — all enabled categories searched at once so counts are known |
| Auto-switch | **Fixed priority** `films → tv → castcrew → lists → members`, **respecting manual choice** |
| Empty pills | **Count badge + dimmed & non-clickable** when zero |
| Signed-out | Lists & Members pills hidden and excluded from priority |
| DB-cost guard | Lists & Members fire only at **≥ 2 characters**; Films/TV/Cast & Crew at ≥ 1 |
| Applies to | **Plain free-text search only** (no active tags); browse + tag/structured modes unchanged |

## Architecture (isolated units)

The dialog file is already large; to avoid worsening it, orchestration moves into focused, testable units. `home-sticky-search.tsx` only wires them together.

1. **`useListsTextSearch(query, enabled, debounceMs = 240)`** — new hook in `apps/web/src/lib/use-lists-text-search.ts`, mirroring the existing typeahead hooks (debounce, abort, empty-clear), wrapping the existing `fetchListsSearch`. Returns `{ results: ListBoardRow[], loading, needsSignIn }`.
2. **`useSearchCategoryResults(query, { signedIn })`** — new hook in `apps/web/src/lib/use-search-category-results.ts`. Internally calls `useCatalogTextSearch` twice (movie, tv), `useCastCrewSearch`, `useProfileSearch`, and `useListsTextSearch`, gating Lists/Members on `signedIn && query.trim().length >= 2`. Returns a normalized map plus the worst-case loading flag and TMDb setup hint:
   ```ts
   type SearchCategory = "films" | "tv" | "castcrew" | "lists" | "members";
   type CategoryState = { results: unknown[]; loading: boolean; count: number };
   {
     categories: Record<SearchCategory, CategoryState>;
     anyLoading: boolean;
     setupHint: string | null; // from the catalogue/cast hooks
   }
   ```
3. **`resolveActiveCategory(args)`** — **pure** function in `apps/web/src/lib/search-active-category.ts` (unit-tested) implementing the auto-switch state machine (below). No React.
4. **`enabledCategories(signedIn)`** — pure helper returning the ordered list of enabled categories (priority order, Lists/Members dropped when signed out). Lives beside `resolveActiveCategory`.
5. **`SearchDialogCategoryPills`** — new component `apps/web/src/components/home/search-dialog-category-pills.tsx`, replacing `SearchDialogListingKindChips` on the free-text path. Renders one pill per enabled category with label + count; a zero-count pill is dimmed and `aria-disabled` (not clickable); the active pill keeps the existing sliding-fill motion. Calls `onSelect(category)`.
6. **Body switch** — in the dialog, the free-text results body switches on `activeCategory` and renders the matching existing section: Films/TV poster grid, `SearchDialogCastCrewResults`, `SearchDialogListResults`, `SearchDialogPeopleResults`.

## Auto-switch state machine

State in the dialog: `activeCategory: SearchCategory` and `manualCategory: SearchCategory | null`.

- **Priority order:** `["films","tv","castcrew","lists","members"]`, filtered by `enabledCategories(signedIn)`.
- **`resolveActiveCategory({ current, manualCategory, counts, priority, anyLoading })`:**
  1. If `anyLoading` is true → return `current` (don't switch mid-load; avoids flicker).
  2. If `manualCategory` is set → return `manualCategory` (respect the user's choice, even if empty).
  3. If `counts[current] > 0` → return `current`.
  4. Else → return the first category in `priority` with `counts > 0`.
  5. If none have results → return `current` (nothing to switch to).
- **Manual choice:** clicking an enabled pill sets `manualCategory` to it. **Changing the query text resets `manualCategory` to `null`** (new query = fresh auto-switch).
- The dialog applies the resolved value via effect: `setActiveCategory(resolveActiveCategory(...))` when inputs change.

## Data flow

```
type free-text (no tags)
  → useSearchCategoryResults(query, { signedIn })
      runs in parallel: movies, tv, cast&crew, (lists, members if signedIn && len>=2)
      → counts per category
  → resolveActiveCategory(current, manualCategory, counts, priority, anyLoading)
      → activeCategory
  → SearchDialogCategoryPills shows counts; dim empties; highlight active
  → body renders activeCategory's section (reusing existing components)
  → click film/tv → /movies|/tv/[id]; cast&crew → /people/[id];
    list → list route; member → /profile/[handle] (existing handlers)
```

## Error handling / edge cases

- **Missing `TMDB_API_KEY`:** Films/TV/Cast & Crew counts are 0 with a setup hint (existing behavior); Lists/Members unaffected. Auto-switch still works among non-empty categories.
- **Signed-out:** `enabledCategories` returns `["films","tv","castcrew"]`; Lists/Members pills not rendered and never auto-selected. If `manualCategory` somehow references a disabled category (cannot happen via UI), `resolveActiveCategory` treats it as not-present and falls through to priority.
- **Loading flicker:** counts settle before switching (`anyLoading` guard); pills may show a brief skeleton/neutral state while loading.
- **`< 2` chars:** Lists/Members hooks return empty + not-loading, so their pills render dimmed (count 0) without hitting the DB.
- **Active tags present:** the pill group + auto-switch do not render; the existing tag/structured/lists-mode flow is untouched.

## Testing

- **`resolveActiveCategory` (pure, primary coverage):**
  - active category has results → stays.
  - active empty, higher-priority category has results → switches to it (respects order: films before tv before castcrew before lists before members).
  - `manualCategory` set → stays there even when empty and others have results.
  - `anyLoading` true → stays (no mid-load switch).
  - all empty → stays on current.
- **`enabledCategories`** — signed-in returns all five in order; signed-out drops lists & members.
- **`useListsTextSearch`** — debounce/abort/empty-clear + `needsSignIn` passthrough, mirroring existing hook tests.
- **Manual:** type a TV-only title while on Films → auto-jumps to TV; type a director name → jumps to Cast & Crew; tap Films manually on an empty result → stays on Films; edit the query → auto-switch resumes.
```
