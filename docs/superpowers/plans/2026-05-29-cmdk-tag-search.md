# ⌘K Tag Search (Strict AND + Films/TV) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When ⌘K has committed filter tags (Anime, genre, studio), typed queries and the Films/TV toggle must both affect results — strict AND via TMDb discover + `with_text_query`, not unfiltered `/search`.

**Architecture:** Extend server discover routes and `tmdbApi.discoverMovies` / `discoverTv` with optional `q` → `with_text_query`. Refactor `useCatalogueTagSearch` to always use discover when tag filters exist (with or without free text) and accept `listingKind` from `effectiveListingKind` in `HomeStickySearch`. Plain no-tag search stays on `useCatalogTextSearch`.

**Tech Stack:** Bun tests, Elysia (`apps/server`), TMDb v3 discover, Next.js client hooks, existing `deriveCatalogueFilterBundle` / `search-curated-tags.ts`.

**Spec:** [`docs/superpowers/specs/2026-05-29-cmdk-tag-search-design.md`](../specs/2026-05-29-cmdk-tag-search-design.md)

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/src/lib/tmdb.ts` | Modify | `withTextQuery` on discover helpers |
| `apps/server/src/routes/movies.ts` | Modify | `GET /discover?q=` |
| `apps/server/src/routes/tv.ts` | Modify | `GET /discover?q=` |
| `apps/web/src/lib/still-api-fetch.ts` | Modify | `q` on `fetchMoviesDiscover` / `fetchTvDiscover` |
| `apps/web/src/lib/use-catalogue-tag-search.ts` | Modify | Listing kind arg + unified discover path |
| `apps/web/src/lib/use-catalogue-tag-search.test.ts` | Create | Mock-fetch behavior tests |
| `apps/web/src/components/home/home-sticky-search.tsx` | Modify | Pass `effectiveListingKind` into hook |
| `docs/superpowers/specs/2026-05-29-cmdk-tag-search-design.md` | Modify | Status → Implemented after QA |
| `.cursor/scratchpad.md` | Modify | Executor board item |

---

## Phase 1 — TMDb + API (`with_text_query`)

### Task 1: TMDb discover helpers accept text query

**Files:**
- Modify: `apps/server/src/lib/tmdb.ts`

- [ ] **Step 1: Add `withTextQuery` to `discoverMovies` opts and params**

In `discoverMovies` opts type, add:

```ts
/** TMDb `with_text_query` — AND with other discover filters. */
withTextQuery?: string;
```

After building `params`, before the return:

```ts
const textQ = opts.withTextQuery?.trim();
if (textQ) {
	params.with_text_query = textQ;
}
```

- [ ] **Step 2: Mirror in `discoverTv`**

Same field on `discoverTv` opts + same param assignment.

- [ ] **Step 3: Smoke (optional, requires TMDB key)**

Run dev server and hit discover with `q` after Task 2, or defer to Task 2 manual step.

---

### Task 2: Expose `q` on discover routes

**Files:**
- Modify: `apps/server/src/routes/movies.ts` (~504 discover handler)
- Modify: `apps/server/src/routes/tv.ts` (~240 discover handler)

- [ ] **Step 1: Movies route — parse and forward `q`**

In `GET /discover` handler, after reading genre/keyword/company:

```ts
const textQuery = (query.q ?? "").trim() || undefined;
```

Pass to `tmdbApi.discoverMovies`:

```ts
withTextQuery: textQuery,
```

Add to route query schema:

```ts
q: t.Optional(t.String()),
```

Include in `applied` response object if present: `text_query: textQuery ?? null`.

- [ ] **Step 2: TV route — same**

Mirror in `GET /api/tv/discover`.

- [ ] **Step 3: Manual API check**

With server running and `TMDB_API_KEY` set:

```powershell
Invoke-WebRequest "http://localhost:3000/api/tv/discover?genre=16&keywords=210024&q=naruto" -UseBasicParsing | Select-Object StatusCode
```

Expected: **200**; JSON `results` should not include obvious non-animation live-action-only rows for typical queries.

---

## Phase 2 — Web fetch layer

### Task 3: Client discover fetchers accept `q`

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: Extend `fetchMoviesDiscover` init type**

Add to init object:

```ts
/** TMDb discover `with_text_query` — server `?q=`. */
q?: string;
```

Before fetch, after other params:

```ts
const textQ = init?.q?.trim();
if (textQ) {
	url.searchParams.set("q", textQ);
}
```

- [ ] **Step 2: Extend `fetchTvDiscover` the same way**

Copy pattern from movies discover.

---

## Phase 3 — Hook behavior (TDD)

### Task 4: Tests for structured tag search fetch routing

**Files:**
- Create: `apps/web/src/lib/use-catalogue-tag-search.test.ts`

- [ ] **Step 1: Write failing tests with mocked fetch modules**

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import type { SearchTag } from "./search-query-tags";

const fetchMoviesDiscover = mock(async () => ({
	data: { results: [{ id: 1, title: "A", poster_url: null }] },
	error: null,
	response: { status: 200 },
}));
const fetchTvDiscover = mock(async () => ({
	data: { results: [{ id: 2, title: "B", poster_url: null }] },
	error: null,
	response: { status: 200 },
}));
const fetchMoviesSearch = mock(async () => ({
	data: { results: [{ id: 99, title: "Wrong", poster_url: null }] },
	error: null,
	response: { status: 200 },
}));
const fetchTvSearch = mock(async () => ({
	data: { results: [] },
	error: null,
	response: { status: 200 },
}));
const fetchListsSearch = mock(async () => ({
	data: [],
	error: null,
	response: { status: 200 },
}));

mock.module("./still-api-fetch", () => ({
	fetchMoviesDiscover,
	fetchTvDiscover,
	fetchMoviesSearch,
	fetchTvSearch,
	fetchListsSearch,
}));

// Import AFTER mocks
const { useCatalogueTagSearch } = await import("./use-catalogue-tag-search");

const animeTag: SearchTag = { kind: "curated", slug: "anime", label: "Anime" };

describe("useCatalogueTagSearch", () => {
	beforeEach(() => {
		fetchMoviesDiscover.mockClear();
		fetchTvDiscover.mockClear();
		fetchMoviesSearch.mockClear();
		fetchTvSearch.mockClear();
	});

	test("anime tag + query uses tv discover with genre, keywords, and q", async () => {
		renderHook(() =>
			useCatalogueTagSearch([animeTag], "naruto", true, "tv", 0),
		);
		await waitFor(() => expect(fetchTvDiscover).toHaveBeenCalled());
		expect(fetchTvSearch).not.toHaveBeenCalled();
		const call = fetchTvDiscover.mock.calls[0];
		expect(call?.[1]?.genreIds).toEqual([16]);
		expect(call?.[1]?.keywordIds).toEqual([210024]);
		expect(call?.[1]?.q).toBe("naruto");
	});

	test("anime tag + query + listingKind movie uses movie discover", async () => {
		renderHook(() =>
			useCatalogueTagSearch([animeTag], "spirited", true, "movie", 0),
		);
		await waitFor(() => expect(fetchMoviesDiscover).toHaveBeenCalled());
		expect(fetchMoviesSearch).not.toHaveBeenCalled();
		expect(fetchMoviesDiscover.mock.calls[0]?.[1]?.q).toBe("spirited");
	});

	test("anime tag without query uses discover without q", async () => {
		renderHook(() =>
			useCatalogueTagSearch([animeTag], "", true, "tv", 0),
		);
		await waitFor(() => expect(fetchTvDiscover).toHaveBeenCalled());
		expect(fetchTvDiscover.mock.calls[0]?.[1]?.q).toBeUndefined();
	});
});
```

Note: If `@testing-library/react` is unavailable in web package, use a thin test helper that invokes the hook’s effect logic via extracted pure function `resolveCatalogueTagSearchRequest` — prefer extracting fetch orchestration to `catalogue-tag-search-fetch.ts` if hook testing is awkward.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/web && bun test src/lib/use-catalogue-tag-search.test.ts
```

Expected: FAIL (signature / routing not implemented).

---

### Task 5: Implement hook + listing kind override

**Files:**
- Modify: `apps/web/src/lib/use-catalogue-tag-search.ts`
- Optional create: `apps/web/src/lib/catalogue-tag-search-fetch.ts` (if extracting for tests)

- [ ] **Step 1: Extend hook signature**

```ts
export function useCatalogueTagSearch(
	tags: SearchTag[],
	freeText: string,
	enabled: boolean,
	listingKindOverride: CatalogTextSearchListingKind,
	debounceMs = 240,
) {
```

Import `CatalogTextSearchListingKind` from `./use-catalog-text-search`.

- [ ] **Step 2: Build bundle with overridden listing kind**

Replace:

```ts
const bundle = useMemo(() => deriveCatalogueFilterBundle(tags), [tags]);
const { studioId, listingKind, resultMode, genreIds, keywordIds } = bundle;
```

With:

```ts
const bundle = useMemo(() => {
	const base = deriveCatalogueFilterBundle(tags);
	const hasMediaTag = tags.some((t) => t.kind === "media");
	const listingKind = hasMediaTag
		? base.listingKind
		: listingKindOverride;
	// Re-apply curated rules when listing kind differs from tag-derived default
	const genreIds = [...base.genreIds];
	const keywordIds = [...base.keywordIds];
	if (!hasMediaTag && listingKind !== base.listingKind) {
		for (const tag of tags) {
			if (tag.kind !== "curated") continue;
			const def = curatedTagBySlug(tag.slug);
			if (!def) continue;
			const rules = listingKind === "tv" ? def.tv : def.movie;
			for (const id of rules.genreIds) {
				if (!genreIds.includes(id)) genreIds.push(id);
			}
			for (const id of rules.keywordIds) {
				if (!keywordIds.includes(id)) keywordIds.push(id);
			}
		}
	}
	return { ...base, listingKind, genreIds, keywordIds };
}, [tags, listingKindOverride]);
```

Import `curatedTagBySlug` from `./search-curated-tags`.

Alternatively, add optional `listingKind` param to `deriveCatalogueFilterBundle` in `search-query-tags.ts` — prefer single place if cleaner; update `search-query-tags.test.ts` with one case.

- [ ] **Step 3: Unify discover path when `hasDiscoverFilters`**

Replace the block:

```ts
if (!q && hasDiscoverFilters) { ... discover ... return; }
if (!q) { empty; return; }
// search path
```

With:

```ts
if (hasDiscoverFilters) {
	const discoverOpts = {
		signal: ctrl.signal,
		companyId: studioId ?? undefined,
		genreIds: genreIds.length > 0 ? genreIds : undefined,
		keywordIds: keywordIds.length > 0 ? keywordIds : undefined,
		sortBy: "popularity.desc",
		q: q || undefined,
	};
	const res =
		listingKind === "tv"
			? await fetchTvDiscover(1, discoverOpts)
			: await fetchMoviesDiscover(1, discoverOpts);
	// ... map results, return
}

if (!q) {
	setCatalogueResults([]);
	setSetupHint(null);
	return;
}

// Studio-only (no genre/keyword): keep legacy search + company
const res =
	listingKind === "tv"
		? await fetchTvSearch(q, { signal: ctrl.signal, companyId: studioId ?? undefined })
		: await fetchMoviesSearch(q, { signal: ctrl.signal, companyId: studioId ?? undefined });
```

- [ ] **Step 4: Add `listingKindOverride` to effect deps**

Include in the `useEffect` dependency array.

- [ ] **Step 5: Run tests**

```bash
cd apps/web && bun test src/lib/use-catalogue-tag-search.test.ts
```

Expected: PASS.

---

### Task 6: Wire `HomeStickySearch`

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1: Pass `effectiveListingKind` into hook**

Change:

```ts
const structuredSearch = useCatalogueTagSearch(
	searchTags,
	freeText,
	showSheet && searchTags.length > 0,
);
```

To:

```ts
const structuredSearch = useCatalogueTagSearch(
	searchTags,
	freeText,
	showSheet && searchTags.length > 0,
	effectiveListingKind,
);
```

- [ ] **Step 2: Manual ⌘K QA**

| Step | Expected |
|------|----------|
| ⌘K → **Anime** → type `one piece` | TV anime rows only |
| Toggle **Films** (same query) | Different set (movie animation) |
| Toggle **TV shows** | Back to TV discover |
| Clear tags → type query | Unchanged plain search |
| **Anime** only, no query | Popular anime TV discover |

- [ ] **Step 3: Update spec status**

In `2026-05-29-cmdk-tag-search-design.md`, set **Status:** Implemented (YYYY-MM-DD).

- [ ] **Step 4: Scratchpad**

Add Executor note under Track B / search polish; mark complete after human **`ok`**.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Strict AND tag + text via discover | Task 2, 5 |
| Films/TV drives fetch with tags | Task 5, 6 |
| Anime defaults TV, Films switches endpoint | Task 5, 6 (listing kind override) |
| Plain search unchanged | No change to `useCatalogTextSearch` |
| Server `with_text_query` | Task 1, 2 |
| Client discover `q` param | Task 3 |
| Unit tests | Task 4, 5 |
| Manual success criteria | Task 6 |

---

## Out of scope (do not implement)

- Post-filtering `/search` results client-side
- New curated tags
- `/home` catalogue grid changes
- Commit unless user requests
