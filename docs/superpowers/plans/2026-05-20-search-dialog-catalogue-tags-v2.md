# Search Dialog Catalogue Tags v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `HomeStickySearch` tagged query with multi-genre pills, curated **Anime**, and studio filters on **both Films and TV**, combining filters with TMDb AND semantics.

**Architecture:** Extend `search-query-tags.ts` with `genre` / `curated` kinds and bundle derivation; add `search-curated-tags.ts` + `use-catalogue-tag-search.ts`; server adds TV `with_companies` / `with_keywords` on discover and company-aware TV search mirroring movies. UI changes stay in existing token field + pill components.

**Tech Stack:** Next.js App Router, Elysia, TMDb v3, Bun tests, `motion/react`, Tailwind v4 (`bg-card` / `bg-background`).

**Spec:** `docs/superpowers/specs/2026-05-20-search-dialog-catalogue-tags-v2-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/lib/search-curated-tags.ts` | Create | Curated slug definitions + resolve to genre/keyword ids |
| `apps/web/src/lib/search-query-tags.ts` | Modify | Genre/curated types, rank, upsert, serialize/parse, `deriveCatalogueFilterBundle` |
| `apps/web/src/lib/search-query-tags.test.ts` | Modify | Genre/curated/serialize tests |
| `apps/web/src/lib/use-search-dialog-genres.ts` | Create | Fetch/cache movie + TV genre lists for suggestions |
| `apps/web/src/lib/use-catalogue-tag-search.ts` | Create | Debounced discover/search orchestration (replaces `useStructuredCatalogSearch` usage) |
| `apps/web/src/lib/still-api-fetch.ts` | Modify | `fetchTvGenres`, multi `genre`/`keywords` on discover/search |
| `apps/web/src/components/home/search-tag-pill.tsx` | Modify | Labels for genre/curated |
| `apps/web/src/components/home/search-token-field.tsx` | Modify | Pass genres; render genre suggestions |
| `apps/web/src/components/home/home-sticky-search.tsx` | Modify | Wire genres hook + new search hook; UI copy |
| `apps/server/src/lib/tmdb.ts` | Modify | `genreTvList`, `discoverTv` + `withCompanies` / `withKeywords` |
| `apps/server/src/lib/search-curated-tags.ts` | Create | Shared Anime keyword/genre constants |
| `apps/server/src/lib/tmdb-discover-params.ts` | Create | Parse comma-separated genre/keyword query strings |
| `apps/server/src/routes/tv.ts` | Modify | `/genres`, `/discover` + `/search` filters |
| `apps/server/src/routes/movies.ts` | Modify | Multi-genre + keywords on discover/search |
| `apps/web/src/lib/profile-preferences.ts` | Modify | `catalogTmdbLanguage` pref (V2.5) |
| `apps/web/src/components/profile/settings-form.tsx` | Modify | Language select (V2.5) |
| `apps/server/src/lib/tmdb-poster-language.ts` | Modify | Resolve language from pref (V2.5) |
| `.cursor/scratchpad.md` | Modify | Executor status (per repo workflow) |

---

## Phase V2.1 — Tag model, genres, suggestions

### Task 1: Curated tag constants

**Files:**
- Create: `apps/web/src/lib/search-curated-tags.ts`
- Create: `apps/server/src/lib/search-curated-tags.ts`

- [ ] **Step 1: Add shared curated map (web)**

```ts
// apps/web/src/lib/search-curated-tags.ts
export type CuratedTagSlug = "anime";

export interface CuratedTagDef {
  slug: CuratedTagSlug;
  label: string;
  aliases: string[];
  movie: { genreIds: number[]; keywordIds: number[] };
  tv: { genreIds: number[]; keywordIds: number[] };
}

/** TMDb ids — verify once against /genre/*/list in dev. */
export const SEARCH_CURATED_TAGS: CuratedTagDef[] = [
  {
    slug: "anime",
    label: "Anime",
    aliases: ["anime", "ani"],
    movie: { genreIds: [16], keywordIds: [210024] },
    tv: { genreIds: [16], keywordIds: [210024] },
  },
];

export function findCuratedSuggestions(token: string): CuratedTagDef[] {
  const q = token.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_CURATED_TAGS.filter(
    (c) =>
      c.label.toLowerCase().startsWith(q) ||
      c.aliases.some((a) => a.startsWith(q)),
  );
}
```

- [ ] **Step 2: Mirror constants on server** (same ids in `apps/server/src/lib/search-curated-tags.ts` for discover builders).

- [ ] **Step 3: Run typecheck**

```bash
cd apps/web && bun run check-types
cd apps/server && bun run check-types
```

---

### Task 2: Extend `SearchTag` + bundle derivation

**Files:**
- Modify: `apps/web/src/lib/search-query-tags.ts`
- Modify: `apps/web/src/lib/search-query-tags.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// Add to search-query-tags.test.ts
test("deriveCatalogueFilterBundle merges genre and curated AND", () => {
  const bundle = deriveCatalogueFilterBundle([
    { kind: "curated", slug: "anime", label: "Anime" },
    { kind: "genre", id: 27, name: "Horror", listingKind: "movie" },
    { kind: "media", listingKind: "tv" },
  ]);
  expect(bundle.listingKind).toBe("tv");
  expect(bundle.genreIds).toContain(27);
  expect(bundle.keywordIds).toContain(210024);
});

test("upsertTag dedupes same genre id", () => {
  const a = { kind: "genre" as const, id: 27, name: "Horror", listingKind: "movie" as const };
  const next = upsertTag([a], { ...a });
  expect(next).toHaveLength(1);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
bun test apps/web/src/lib/search-query-tags.test.ts
```

- [ ] **Step 3: Implement types + `deriveCatalogueFilterBundle`**

Extend `SearchTag` / `TagSuggestion` with `genre` and `curated`. Update `searchTagKey`, `upsertTag` (lists still clears catalogue tags; genre dedupe by `id`+`listingKind`; curated dedupe by `slug`). Implement:

```ts
export function deriveCatalogueFilterBundle(tags: SearchTag[]) {
  const base = deriveSearchState(tags);
  const genreIds: number[] = [];
  const keywordIds: number[] = [];
  const listingKind = base.listingKind;

  for (const tag of tags) {
    if (tag.kind === "genre") {
      if (!genreIds.includes(tag.id)) genreIds.push(tag.id);
    }
    if (tag.kind === "curated") {
      const def = SEARCH_CURATED_TAGS.find((c) => c.slug === tag.slug);
      if (!def) continue;
      const rules = listingKind === "tv" ? def.tv : def.movie;
      for (const id of rules.genreIds) if (!genreIds.includes(id)) genreIds.push(id);
      for (const id of rules.keywordIds) if (!keywordIds.includes(id)) keywordIds.push(id);
    }
  }

  return { ...base, genreIds, keywordIds };
}
```

Remove studio-suggestions block for TV media tag (delete `studioSuggestionsAllowed` gate).

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test apps/web/src/lib/search-query-tags.test.ts
```

---

### Task 3: Genre suggestions + serialize/parse v2

**Files:**
- Modify: `apps/web/src/lib/search-query-tags.ts`
- Modify: `apps/web/src/lib/search-query-tags.test.ts`
- Create: `apps/web/src/lib/use-search-dialog-genres.ts`

- [ ] **Step 1: Failing tests for serialize/parse genre**

```ts
test("serialize includes genre and curated pills", () => {
  const raw = serializeStructuredQuery(
    [
      { kind: "studio", id: 1, name: "A24", logoUrl: null },
      { kind: "genre", id: 27, name: "Horror", listingKind: "movie" },
      { kind: "curated", slug: "anime", label: "Anime" },
    ],
    "marty",
  );
  expect(raw).toBe("A24 · Horror · Anime · marty");
});
```

- [ ] **Step 2: Extend `rankTagSuggestions`**

Add params: `genres: { id: number; name: string }[]`, `listingKind`. After studio loop, prefix-match genres (skip if already committed same id). Add curated via `findCuratedSuggestions`. Return `.slice(0, 8)`.

Update `serializeStructuredQuery` / `parseRecentStructuredQuery` to walk segments: match studio, media labels, genre names (case-insensitive, against both genre lists when parsing), curated labels, else accumulate free text.

- [ ] **Step 3: `useSearchDialogGenres` hook**

```ts
// Fetches GET /api/movies/genres + GET /api/tv/genres when dialog enabled
export function useSearchDialogGenres(enabled: boolean) {
  // state: movieGenres, tvGenres, loading
  // useEffect parallel fetch via still-api-fetch helpers
}
```

- [ ] **Step 4: Run tests PASS**

```bash
bun test apps/web/src/lib/search-query-tags.test.ts
```

---

### Task 4: UI — pill + token field

**Files:**
- Modify: `apps/web/src/components/home/search-tag-pill.tsx`
- Modify: `apps/web/src/components/home/search-token-field.tsx`

- [ ] **Step 1: `SearchTagPill` labels**

```ts
if (tag.kind === "genre") return tag.name;
if (tag.kind === "curated") return tag.label;
```

- [ ] **Step 2: `SearchTokenField` props**

Add `genres: { id: number; name: string }[]`, `listingKind: "movie" | "tv"`. Pass into `rankTagSuggestions`. Handle `suggestion.kind === "genre" | "curated"` in `suggestionToTag`.

- [ ] **Step 3: Manual smoke**

Open `/home` → search dialog → type `hor` → Tab → Horror pill appears.

---

### Task 5: Extract `use-catalogue-tag-search` (genre-only discover path)

**Files:**
- Create: `apps/web/src/lib/use-catalogue-tag-search.ts`
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Modify: `apps/server/src/routes/movies.ts` (multi-genre discover)
- Modify: `apps/server/src/lib/tmdb.ts` (optional `withKeywords` on `discoverMovies`)

- [ ] **Step 1: Server — comma genre + keywords on movie discover**

Add helper `parseCommaIntList(raw?: string): number[]` in `tmdb-discover-params.ts`.

In `GET /api/movies/discover`, accept optional `keywords` query; pass `with_genres` as comma-joined ids, `with_keywords` similarly to `tmdbApi.discoverMovies`.

Extend `discoverMovies` opts: `withGenres?: number | number[]`, `withKeywords?: number | number[]` → stringify with commas.

- [ ] **Step 2: Client fetch**

```ts
// fetchMoviesDiscover init adds:
genreIds?: number[];
keywordIds?: number[];
// url: genre=27,16 & keywords=210024
```

- [ ] **Step 3: Hook skeleton**

Copy logic from `use-structured-catalog-search.ts`; replace `deriveSearchState` with `deriveCatalogueFilterBundle`. When `genreIds.length || keywordIds.length` and no `q`, call discover with ids. Lists branch unchanged.

- [ ] **Step 4: Wire `home-sticky-search.tsx`**

Replace `useStructuredCatalogSearch` import with `useCatalogueTagSearch`; pass `useSearchDialogGenres` into `SearchTokenField`.

**V2.1 exit:** Horror pill + discover with genre only works for movies.

---

## Phase V2.2 — TV studio + company search

### Task 6: TMDb + TV discover company/genre/keywords

**Files:**
- Modify: `apps/server/src/lib/tmdb.ts`
- Modify: `apps/server/src/routes/tv.ts`
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: `tmdbApi.genreTvList()`** — `GET /genre/tv/list`

- [ ] **Step 2: Extend `discoverTv` opts** — `withCompanies?: number`, `withGenres?: number | number[]`, `withKeywords?: number | number[]`

- [ ] **Step 3: `GET /api/tv/genres`** — mirror movies `/genres`

- [ ] **Step 4: `GET /api/tv/discover`** — query `company`, `genre` (comma), `keywords` (comma)

- [ ] **Step 5: Client `fetchTvDiscover`** — add `companyId`, `genreIds`, `keywordIds` params

- [ ] **Step 6: Hook** — pass bundle fields to TV discover when `listingKind === "tv"`

---

### Task 7: TV search with company filter

**Files:**
- Modify: `apps/server/src/routes/tv.ts`
- Modify: `apps/server/src/lib/tmdb.ts` (if `tvProductionCompanies` needed)
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Modify: `apps/web/src/lib/use-catalogue-tag-search.ts`

- [ ] **Step 1: Add `tmdbApi.tvProductionCompanies(tvId)`** — `GET /tv/{id}` → `production_companies`

- [ ] **Step 2: Extend `GET /api/tv/search`****

Query: `company`, `genre`, `keywords` (comma). Filter search results by company membership; if sparse, `discoverTv` + title substring fallback (mirror `discoverCompanyMoviesMatchingTitle` pattern for TV `name`).

- [ ] **Step 3: `fetchTvSearch`** — accept `companyId`, `genreIds`, `keywordIds`

- [ ] **Step 4: Hook text path** — pass company for TV + movies

- [ ] **Step 5: Remove Films-only UI**

Delete block in `home-sticky-search.tsx`:

```tsx
{hasStudioTag && effectiveListingKind === "tv" ? (
  <p>Studios filter Films only.</p>
) : null}
```

Remove TV studio block in `rankTagSuggestions` if any remains.

**V2.2 exit:** `a24` + TV + text returns company-scoped TV rows.

---

## Phase V2.3 — Curated Anime end-to-end

### Task 8: Curated pill + combined AND discover

**Files:**
- Modify: `apps/web/src/lib/use-catalogue-tag-search.ts`
- Modify: `apps/web/src/components/home/search-token-field.tsx`

- [ ] **Step 1: Manual test Anime discover**

`ani` → Tab → Anime → type nothing → discover rows (movie default).

- [ ] **Step 2: Anime + Horror + TV**

Three pills → discover uses merged `genreIds` + `keywordIds` from bundle.

- [ ] **Step 3: Tune TV Animation genre id**

Call `/api/tv/genres` in dev; update `SEARCH_CURATED_TAGS` tv.genreIds if not `16`.

---

## Phase V2.4 — Recents, empty copy, polish

### Task 9: Recents v2 + over-filter empty

**Files:**
- Modify: `apps/web/src/lib/search-query-tags.ts`
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1: Serialize order**

`serializeStructuredQuery`: emit pills in order — studio, media, genre/curated (commit order), free text.

- [ ] **Step 2: Parse genre/curated** against loaded genre lists + `SEARCH_CURATED_TAGS`

- [ ] **Step 3: Empty copy**

When catalogue tags active, not loading, zero results:

```tsx
<p className="text-muted-foreground text-xs leading-relaxed">
  Nothing matched all filters — try removing a tag.
</p>
```

- [ ] **Step 4: Optional 3+ tag hint**

```tsx
{genreCuratedCount >= 3 ? (
  <p className="px-4 pb-1 text-muted-foreground text-xs">All tags must match.</p>
) : null}
```

---

### Task 10: Delete legacy hook + scratchpad

**Files:**
- Delete or re-export: `apps/web/src/lib/use-structured-catalog-search.ts`
- Modify: `.cursor/scratchpad.md`

- [ ] **Step 1:** If nothing imports `useStructuredCatalogSearch`, delete file; else thin re-export from `use-catalogue-tag-search.ts`.

- [ ] **Step 2:** Document V2.1–V2.4 in scratchpad Executor section.

---

## Manual test checklist (full v2)

- [ ] `hor` → Tab → Horror → `mov` → Tab → Films → filtered films
- [ ] `ani` → Tab → Anime → `hor` → Tab → Horror → `tv` → Tab → TV → text → results or over-filter empty
- [ ] `a24` → Tab → A24 → TV → `marty` → studio-scoped TV (not all marty)
- [ ] Lists tag exclusive; signed-out lists message
- [ ] Recent chip restores studio + genres + curated + media + text
- [ ] Dialog open: no horizontal scrollbar; content-fit height
- [ ] `prefers-reduced-motion`: acceptable pill behavior

---

## Phase V2.5 — Patron locale (TMDb language + localized search tags)

**Goal:** Patrons pick a **catalogue language** in Settings; genre pills, Tab suggestions, and recent-query parse use **localized TMDb genre names** (e.g. Spanish **Terror** for `ter` / `terror`, not forced English **Horror** / `hor`). Replaces the interim **`en-US`-only** genre fetch in `use-search-dialog-genres.ts`.

**Prerequisite:** V2.1–V2.4 functionally complete (or V2.1 + hotfixes shipped).

### Task 11: Catalogue language preference (Settings + server)

**Files:**
- Modify: `apps/web/src/lib/profile-preferences.ts`
- Modify: `apps/web/src/components/profile/settings-form.tsx`
- Modify: `apps/server/src/lib/tmdb-poster-language.ts`
- Modify: `apps/server/src/routes/movies.ts` + `tv.ts` (genre routes already accept `?language=`)

- [x] **Step 1: Add pref key** — e.g. `PROFILE_PREF_CATALOG_TMDB_LANGUAGE` (`catalogTmdbLanguage`) storing TMDb `language` values (`en-US`, `es-ES`, `fr-FR`, …). Document in `profile-preferences.ts` with read/write helpers and validation whitelist (same set as `WATCH_REGION_ISO2_TO_TMDB_LANGUAGE` values + common extras).

- [x] **Step 2: Settings UI** — new control on **`/me/settings`** (Catalogue section, near watch region):
  - Label: e.g. “Catalogue language” / short helper: “Titles, genres, and search tags use this language.”
  - Select: curated list (English, Español, Français, Deutsch, Italiano, …) mapping to TMDb codes.
  - **Default:** derive from existing `catalogTmdbWatchRegion` via `catalogWatchRegionIsoToTmdbLanguage` when pref unset (no breaking change for current users).
  - PATCH merges into `preferences` like other catalogue prefs.

- [x] **Step 3: Server resolution** — update `getTmdbLanguageForUser`:
  1. Explicit `catalogTmdbLanguage` pref if valid
  2. Else watch-region → language map (today’s behavior)
  3. Else `en-US`
  - Use resolved language for **all** TMDb copy/poster/genre routes that already call `getTmdbLanguageForUser` (discover, search, detail, genre lists).

- [ ] **Step 4: Optional query override** — keep `GET /api/movies|tv/genres?language=` for debugging; default to resolved patron language when omitted.

**Success criteria:** Change language to Español in Settings → `GET /api/movies/genres` returns **Terror** (id 27), not Horror.

---

### Task 12: Localized genre autocomplete + recents

**Files:**
- Modify: `apps/web/src/lib/use-search-dialog-genres.ts`
- Modify: `apps/web/src/lib/search-query-tags.ts` (+ tests)
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`
- Create (optional): `apps/web/src/lib/use-catalog-tmdb-language.ts` — client read of patron language (profile/me or shared React context)

- [x] **Step 1: Remove hardcoded `SEARCH_GENRE_SUGGESTION_LANGUAGE = "en-US"`** — fetch genres with patron’s resolved `language` (from profile preferences on the client, or a thin `GET /api/profiles/me` field / dedicated `GET /api/profiles/me/catalogue-locale`).

- [x] **Step 2: Client fetch** — `fetchMovieGenres` / `fetchTvGenres` pass `language` from pref; invalidate module cache when language changes (cache key = language string).

- [x] **Step 3: Matching** — keep `genreNameMatchesToken` (prefix, substring ≥2 chars, word-start). Add tests:
  - Spanish list: `ter` → Terror
  - English list: `hor` → Horror
  - Curated pills stay **patron-facing** labels (Anime, etc.) — may add localized curated labels in a follow-up table.

- [ ] **Step 4: Recents parse** — `parseRecentStructuredQuery` matches genre segments against **localized** names from the same language used at serialize time (store language in recent row metadata **or** re-parse using current Settings language with best-effort name match).

- [ ] **Step 5: Serialize** — pill labels use localized genre names from committed tags (already stored on tag); recent string shows **Terror · …** when locale is Spanish.

**V2.5 exit:** Settings → Español → search `ter` → Tab → **Terror** pill → discover works; English user still gets **Horror** for `hor`.

---

### Task 13: UI copy i18n (stretch, same milestone or V2.6)

**Scope:** App chrome strings (Settings labels, search hints, empty states) — **not** TMDb catalogue rows.

**Files:**
- TBD: `next-intl` or lightweight message dictionaries under `apps/web/messages/`

- [ ] **Step 1:** Pick minimal i18n stack aligned with Next.js App Router.
- [ ] **Step 2:** Wire Settings + `HomeStickySearch` helper lines (“All tags must match”, over-filter empty) to message keys.
- [ ] **Step 3:** Sync active UI locale with `catalogTmdbLanguage` where sensible (or separate “Interface language” pref if product wants UI ≠ catalogue).

**Note:** V2.5 **must** ship Task 11–12 even if Task 13 slips; catalogue language alone fixes Terror/Horror search tags.

---

## Manual test checklist (V2.5 — append to full v2)

- [ ] Settings → **Español** → save → reload → `/api/movies/genres` shows Spanish names
- [ ] Search: `ter` or `terror` → Tab → **Terror** (not English Horror ghost)
- [ ] Settings → **English** → `hor` → Tab → **Horror**
- [ ] Recent chip **`A24 · Terror · …`** round-trips after locale change (best-effort or documented limitation)
- [ ] Watch region **US** + language **Español** — streaming region unchanged; genre tags Spanish

---

## Plan self-review (coverage)

| Spec requirement | Task |
|------------------|------|
| Hybrid genre + curated | 1–4, 8 |
| Multiple genre AND | 2, 5, 6 |
| Anime stacks AND | 2, 8 |
| Studio on TV | 6–7 |
| Remove Films-only copy | 7 |
| Recents v2 | 9 |
| Over-filter empty + hint | 9 |
| Extract search hook | 5, 10 |
| `/api/tv/genres` | 6 |
| Lists unchanged | 5 |
| Patron catalogue language in Settings | 11 |
| Localized genre Tab + recents | 12 |
| UI chrome i18n (stretch) | 13 |

No TBD steps on V2.1–V2.4. V2.5 Task 13 stack choice is intentionally open until spike. Commit only when user requests.

---

## Executor notes

- Import **`motion/react`**, not `framer-motion`.
- One phase milestone per repo Planner/Executor workflow; human **`ok`** between phases.
- Restart API after server route changes before manual QA.
