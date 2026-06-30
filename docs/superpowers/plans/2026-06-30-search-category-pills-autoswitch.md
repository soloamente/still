# Search category pills + auto-switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the search dialog's Films/TV toggle (on plain free-text queries) with a 5-way single-select pill group (Films, TV, Cast & Crew, Lists, Members) that shows per-category result counts and auto-switches to the highest-priority category that has results when the active one is empty.

**Architecture:** Pure logic (`resolveActiveCategory`, `enabledCategories`) and search orchestration (`useSearchCategoryResults`, `useListsTextSearch`) live in small testable lib modules. A `SearchDialogCategoryPills` component renders the pills; a `SearchDialogCategoryBody` component renders the active category's results. `home-sticky-search.tsx` only wires them on the no-tag free-text path; tag/structured/browse paths are untouched.

**Tech Stack:** Next.js + React, `bun:test`, existing TMDb proxy + Sense list/profile search endpoints.

**Spec:** `docs/superpowers/specs/2026-06-30-search-category-pills-autoswitch-design.md`

---

## File Structure

**New (web/lib)**
- `apps/web/src/lib/search-active-category.ts` — `SearchCategory` type, `CATEGORY_PRIORITY`, `enabledCategories`, `resolveActiveCategory` (pure).
- `apps/web/src/lib/search-active-category.test.ts` — pure-logic tests.
- `apps/web/src/lib/use-lists-text-search.ts` — debounced plain-text list search hook.
- `apps/web/src/lib/use-search-category-results.ts` — composes the 5 category searches → counts + raw results.

**New (web/components/home)**
- `apps/web/src/components/home/search-dialog-category-pills.tsx` — the pill group.
- `apps/web/src/components/home/search-dialog-category-body.tsx` — renders the active category's section.

**Modify**
- `apps/web/src/components/home/home-sticky-search.tsx` — category state, hook call, auto-switch effect, pill + body wiring on the no-tag free-text path.

---

## Task 1: Pure category logic + tests

**Files:**
- Create: `apps/web/src/lib/search-active-category.ts`
- Test: `apps/web/src/lib/search-active-category.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/search-active-category.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	type SearchCategory,
	enabledCategories,
	resolveActiveCategory,
} from "./search-active-category";

const zero: Record<SearchCategory, number> = {
	films: 0,
	tv: 0,
	castcrew: 0,
	lists: 0,
	members: 0,
};
const signedInPriority = enabledCategories(true);

describe("enabledCategories", () => {
	test("signed in returns all five in priority order", () => {
		expect(enabledCategories(true)).toEqual([
			"films",
			"tv",
			"castcrew",
			"lists",
			"members",
		]);
	});
	test("signed out drops lists and members", () => {
		expect(enabledCategories(false)).toEqual(["films", "tv", "castcrew"]);
	});
});

describe("resolveActiveCategory", () => {
	test("keeps current when it has results", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, films: 3, tv: 5 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("films");
	});

	test("switches to first priority category with results when current is empty", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, tv: 0, castcrew: 2 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("castcrew");
	});

	test("respects priority order (tv before castcrew)", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, tv: 1, castcrew: 9 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("tv");
	});

	test("respects manual choice even when empty and others have results", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: "films",
				counts: { ...zero, tv: 4 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("films");
	});

	test("does not switch while loading", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, tv: 4 },
				priority: signedInPriority,
				anyLoading: true,
			}),
		).toBe("films");
	});

	test("stays on current when nothing has results", () => {
		expect(
			resolveActiveCategory({
				current: "tv",
				manualCategory: null,
				counts: zero,
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("tv");
	});

	test("ignores a manual category that is not enabled", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: "members",
				counts: { ...zero, tv: 2 },
				priority: enabledCategories(false),
				anyLoading: false,
			}),
		).toBe("tv");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/search-active-category.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/search-active-category.ts`:

```ts
/** The five result categories the search dialog can show, in auto-switch priority order. */
export type SearchCategory = "films" | "tv" | "castcrew" | "lists" | "members";

/** Fixed auto-switch priority: films → tv → castcrew → lists → members. */
export const CATEGORY_PRIORITY: SearchCategory[] = [
	"films",
	"tv",
	"castcrew",
	"lists",
	"members",
];

/** Lists & Members require sign-in; everything else is always available. */
export function enabledCategories(signedIn: boolean): SearchCategory[] {
	return CATEGORY_PRIORITY.filter(
		(c) => signedIn || (c !== "lists" && c !== "members"),
	);
}

export type ResolveActiveCategoryArgs = {
	current: SearchCategory;
	manualCategory: SearchCategory | null;
	counts: Record<SearchCategory, number>;
	priority: SearchCategory[];
	anyLoading: boolean;
};

/**
 * Decide which category to show. While loading, hold steady (avoid flicker).
 * A manual pick (within enabled categories) always wins. Otherwise keep the
 * current category if it has results, else jump to the first priority category
 * that does; if none have results, stay put.
 */
export function resolveActiveCategory({
	current,
	manualCategory,
	counts,
	priority,
	anyLoading,
}: ResolveActiveCategoryArgs): SearchCategory {
	if (anyLoading) return current;
	if (manualCategory && priority.includes(manualCategory)) {
		return manualCategory;
	}
	if ((counts[current] ?? 0) > 0) return current;
	const firstWithResults = priority.find((c) => (counts[c] ?? 0) > 0);
	return firstWithResults ?? current;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/search-active-category.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/search-active-category.ts apps/web/src/lib/search-active-category.test.ts
git commit -m "feat(web): pure category priority + auto-switch resolver"
```

---

## Task 2: `useListsTextSearch` hook

**Files:**
- Create: `apps/web/src/lib/use-lists-text-search.ts`

- [ ] **Step 1: Write the hook**

`apps/web/src/lib/use-lists-text-search.ts` (mirrors the lists branch of `use-catalogue-tag-search.ts`, including 401 → `needsSignIn`):

```ts
"use client";

import { useEffect, useState } from "react";

import { type ListBoardRow, toListBoardRow } from "@/lib/list-board-row";
import { fetchListsSearch } from "@/lib/still-api-fetch";

/** Debounced plain-text search over the patron's lists for the catalog dialog. */
export function useListsTextSearch(
	query: string,
	enabled: boolean,
	debounceMs = 240,
) {
	const [results, setResults] = useState<ListBoardRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [needsSignIn, setNeedsSignIn] = useState(false);

	useEffect(() => {
		const q = query.trim();
		if (!enabled || !q) {
			setResults([]);
			setNeedsSignIn(false);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchListsSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.response.status === 401) {
					setResults([]);
					setNeedsSignIn(true);
					return;
				}
				setNeedsSignIn(false);
				if (res.error) {
					setResults([]);
					return;
				}
				const rows = Array.isArray(res.data)
					? res.data.map((row) => toListBoardRow(row))
					: [];
				setResults(rows);
			} catch {
				if (!ctrl.signal.aborted) setResults([]);
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, debounceMs);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query, enabled, debounceMs]);

	return { results, loading, needsSignIn };
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `use-lists-text-search.ts` (grep the output for that filename).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/use-lists-text-search.ts
git commit -m "feat(web): useListsTextSearch debounced hook"
```

---

## Task 3: `useSearchCategoryResults` composing hook

**Files:**
- Create: `apps/web/src/lib/use-search-category-results.ts`

- [ ] **Step 1: Write the hook**

`apps/web/src/lib/use-search-category-results.ts`:

```ts
"use client";

import type { SearchCategory } from "@/lib/search-active-category";
import { useCastCrewSearch } from "@/lib/use-cast-crew-search";
import { useCatalogTextSearch } from "@/lib/use-catalog-text-search";
import { useListsTextSearch } from "@/lib/use-lists-text-search";
import { useProfileSearch } from "@/lib/use-profile-search";

export type CategoryCount = { count: number; loading: boolean };

/**
 * Runs all enabled category searches in parallel for a plain free-text query.
 * Films/TV/Cast&Crew (TMDb proxy) fire at >=1 char; Lists/Members (Neon) only
 * when signed in and >=2 chars, to limit DB load. Returns per-category counts
 * plus the raw hook results for rendering.
 */
export function useSearchCategoryResults(query: string, signedIn: boolean) {
	const trimmed = query.trim();
	const dbEligible = signedIn && trimmed.length >= 2;

	const films = useCatalogTextSearch(query, "movie");
	const tv = useCatalogTextSearch(query, "tv");
	const castcrew = useCastCrewSearch(query, trimmed.length >= 1);
	const lists = useListsTextSearch(query, dbEligible);
	const members = useProfileSearch(query, dbEligible);

	const categories: Record<SearchCategory, CategoryCount> = {
		films: { count: films.results.length, loading: films.loading },
		tv: { count: tv.results.length, loading: tv.loading },
		castcrew: { count: castcrew.results.length, loading: castcrew.loading },
		lists: { count: lists.results.length, loading: lists.loading },
		members: { count: members.hits.length, loading: members.loading },
	};

	const anyLoading =
		films.loading ||
		tv.loading ||
		castcrew.loading ||
		lists.loading ||
		members.loading;

	const setupHint = films.setupHint ?? tv.setupHint ?? castcrew.setupHint ?? null;

	return { categories, anyLoading, setupHint, films, tv, castcrew, lists, members };
}
```

> Verified return shapes: `useCatalogTextSearch` → `{ results, loading, setupHint }`; `useCastCrewSearch` → `{ results, loading, setupHint }`; `useListsTextSearch` → `{ results, loading, needsSignIn }`; `useProfileSearch` → `{ hits, loading }`.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `use-search-category-results.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/use-search-category-results.ts
git commit -m "feat(web): useSearchCategoryResults parallel category search"
```

---

## Task 4: `SearchDialogCategoryPills` component

**Files:**
- Create: `apps/web/src/components/home/search-dialog-category-pills.tsx`

- [ ] **Step 1: Write the component**

`apps/web/src/components/home/search-dialog-category-pills.tsx` (motion pill mirrors `SearchDialogListingKindChips`):

```tsx
"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";

import { cn } from "@still/ui/lib/utils";

import type { CategoryCount } from "@/lib/use-search-category-results";
import type { SearchCategory } from "@/lib/search-active-category";

const CATEGORY_LABEL: Record<SearchCategory, string> = {
	films: "Films",
	tv: "TV shows",
	castcrew: "Cast & Crew",
	lists: "Lists",
	members: "Members",
};

/** Single-select category pills with result counts; empty categories are dimmed and inert. */
export function SearchDialogCategoryPills({
	enabled,
	active,
	categories,
	onSelect,
}: {
	enabled: SearchCategory[];
	active: SearchCategory;
	categories: Record<SearchCategory, CategoryCount>;
	onSelect: (category: SearchCategory) => void;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	return (
		<LayoutGroup id="search-dialog-category-pill-group">
			<div className="flex flex-wrap gap-2" role="toolbar" aria-label="Show">
				{enabled.map((category) => {
					const isActive = category === active;
					const count = categories[category].count;
					const empty = count === 0;
					return (
						<button
							key={category}
							type="button"
							aria-pressed={isActive}
							aria-disabled={empty}
							disabled={empty}
							className={cn(
								"relative inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
								isActive
									? "text-foreground"
									: empty
										? "cursor-default text-muted-foreground/40"
										: "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/45 [@media(hover:hover)]:hover:text-foreground",
							)}
							onClick={() => {
								if (!empty) onSelect(category);
							}}
						>
							{isActive ? (
								<motion.span
									layoutId="search-dialog-category-pill"
									className="absolute inset-0 z-0 rounded-full bg-background"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10 inline-flex items-center gap-2">
								{CATEGORY_LABEL[category]}
								<span className="tabular-nums opacity-70">{count}</span>
							</span>
						</button>
					);
				})}
			</div>
		</LayoutGroup>
	);
}
```

> Import paths verified against `SearchDialogListingKindChips` in `home-sticky-search.tsx` (`motion/react`, `@still/ui/lib/utils`).

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `search-dialog-category-pills.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/search-dialog-category-pills.tsx
git commit -m "feat(web): SearchDialogCategoryPills with counts"
```

---

## Task 5: `SearchDialogCategoryBody` component

**Files:**
- Create: `apps/web/src/components/home/search-dialog-category-body.tsx`

- [ ] **Step 1: Write the component**

`apps/web/src/components/home/search-dialog-category-body.tsx`. Renders only the active category, reusing existing section components and the films/TV poster grid markup from the dialog:

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";

import { MoviePoster } from "@/components/movie/movie-poster";
import { SearchDialogCastCrewResults } from "@/components/home/search-dialog-cast-crew-results";
import { SearchDialogListResults } from "@/components/home/search-dialog-list-results";
import { SearchDialogPeopleResults } from "@/components/home/search-dialog-people-results";
import { SearchDialogPosterSkeletonGrid } from "@/components/home/search-dialog-result-skeletons";
import type { SearchCategory } from "@/lib/search-active-category";
import type { useSearchCategoryResults } from "@/lib/use-search-category-results";

type CategorySearch = ReturnType<typeof useSearchCategoryResults>;

/** Poster grid shared by the Films and TV categories. */
function CatalogGrid({
	hits,
	listingKind,
	loading,
	onPick,
}: {
	hits: CategorySearch["films"]["results"];
	listingKind: "movie" | "tv";
	loading: boolean;
	onPick: (id: number, kind: "movie" | "tv") => void;
}) {
	if (loading && hits.length === 0) return <SearchDialogPosterSkeletonGrid />;
	if (hits.length === 0) return null;
	return (
		<div
			className={cn(
				"mt-2 grid auto-rows-min grid-cols-3 gap-3 pb-1 sm:grid-cols-4",
				loading && "opacity-55",
			)}
		>
			{hits.map((hit) => (
				<button
					key={`${listingKind}-${hit.id}`}
					type="button"
					className="min-w-0 cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
					onClick={() => onPick(hit.id, listingKind)}
				>
					<MoviePoster
						movieId={hit.id}
						title={hit.title}
						posterUrl={hit.poster_url}
						size="md"
						showTitle
						titleLines={1}
						linkable={false}
						listingKind={listingKind}
						frameClassName="rounded-2xl"
					/>
				</button>
			))}
		</div>
	);
}

/** Renders the active search category's results inside the dialog body. */
export function SearchDialogCategoryBody({
	active,
	search,
	query,
	onPickCatalog,
	onSelectPerson,
	onSelectProfile,
	onPickList,
}: {
	active: SearchCategory;
	search: CategorySearch;
	query: string;
	onPickCatalog: (id: number, kind: "movie" | "tv") => void;
	onSelectPerson: (id: number) => void;
	onSelectProfile: (handle: string) => void;
	onPickList: () => void;
}) {
	const trimmed = query.trim();
	const emptyHint = (label: string) =>
		trimmed ? `No ${label} for “${trimmed}”.` : `No ${label} found.`;

	if (active === "films") {
		const hasRows = search.films.results.length > 0 || search.films.loading;
		return (
			<div className="flex flex-col px-4 pb-4">
				<CatalogGrid
					hits={search.films.results}
					listingKind="movie"
					loading={search.films.loading}
					onPick={onPickCatalog}
				/>
				{!hasRows ? (
					<p className="text-muted-foreground text-xs leading-relaxed">
						{search.setupHint ?? emptyHint("films")}
					</p>
				) : null}
			</div>
		);
	}

	if (active === "tv") {
		const hasRows = search.tv.results.length > 0 || search.tv.loading;
		return (
			<div className="flex flex-col px-4 pb-4">
				<CatalogGrid
					hits={search.tv.results}
					listingKind="tv"
					loading={search.tv.loading}
					onPick={onPickCatalog}
				/>
				{!hasRows ? (
					<p className="text-muted-foreground text-xs leading-relaxed">
						{search.setupHint ?? emptyHint("TV shows")}
					</p>
				) : null}
			</div>
		);
	}

	if (active === "castcrew") {
		return (
			<SearchDialogCastCrewResults
				results={search.castcrew.results}
				loading={search.castcrew.loading}
				onSelect={onSelectPerson}
			/>
		);
	}

	if (active === "lists") {
		if (search.lists.needsSignIn) {
			return (
				<p className="px-4 pb-4 text-muted-foreground text-xs leading-relaxed">
					Sign in to search your lists.
				</p>
			);
		}
		if (search.lists.results.length === 0 && !search.lists.loading) {
			return (
				<p className="px-4 pb-4 text-muted-foreground text-xs leading-relaxed">
					{emptyHint("lists")}
				</p>
			);
		}
		return (
			<div className={cn("px-4 pb-2", search.lists.loading && "opacity-55")}>
				<SearchDialogListResults
					lists={search.lists.results}
					onPick={onPickList}
				/>
			</div>
		);
	}

	// members
	return (
		<SearchDialogPeopleResults
			hits={search.members.hits}
			loading={search.members.loading}
			onSelect={onSelectProfile}
		/>
	);
}
```

> `SearchDialogPosterSkeletonGrid` is exported from `search-dialog-result-skeletons` (same module used elsewhere in the dialog). `MoviePoster` props mirror the existing grid in `home-sticky-search.tsx`.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `search-dialog-category-body.tsx`. If `SearchDialogPosterSkeletonGrid` is not an export of `search-dialog-result-skeletons`, grep the dialog imports for its real module and fix the import.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/search-dialog-category-body.tsx
git commit -m "feat(web): SearchDialogCategoryBody renders active category"
```

---

## Task 6: Wire into `home-sticky-search.tsx`

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

Locate every anchor by SEARCHING for the quoted code (line numbers drift).

- [ ] **Step 1: Add imports**

Beside the other `search-dialog-*` imports add:

```tsx
import { SearchDialogCategoryBody } from "@/components/home/search-dialog-category-body";
import { SearchDialogCategoryPills } from "@/components/home/search-dialog-category-pills";
```

Beside the other `@/lib` hook/util imports add:

```tsx
import {
	type SearchCategory,
	enabledCategories,
	resolveActiveCategory,
} from "@/lib/search-active-category";
import { useSearchCategoryResults } from "@/lib/use-search-category-results";
```

- [ ] **Step 2: Add category state + parallel search + auto-switch**

Find the existing patron hook call:

```tsx
	const { hits: profileSearchHits, loading: profileSearchLoading } =
		useProfileSearch(trimmedDraft, peopleSearchEnabled);
```

Immediately after it, add:

```tsx
	const signedIn = Boolean(viewer);
	const categoryEnabled = useMemo(
		() => enabledCategories(signedIn),
		[signedIn],
	);
	/** Free text only drives categories when there are no tags. */
	const categoryQuery = searchTags.length === 0 ? freeText : "";
	const categorySearch = useSearchCategoryResults(categoryQuery, signedIn);
	const [activeCategory, setActiveCategory] = useState<SearchCategory>("films");
	const [manualCategory, setManualCategory] = useState<SearchCategory | null>(
		null,
	);
	// New query text = fresh auto-switch (drop the manual pin).
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the typed text changes
	useEffect(() => {
		setManualCategory(null);
	}, [categoryQuery]);
	useEffect(() => {
		setActiveCategory((current) =>
			resolveActiveCategory({
				current,
				manualCategory,
				counts: {
					films: categorySearch.categories.films.count,
					tv: categorySearch.categories.tv.count,
					castcrew: categorySearch.categories.castcrew.count,
					lists: categorySearch.categories.lists.count,
					members: categorySearch.categories.members.count,
				},
				priority: categoryEnabled,
				anyLoading: categorySearch.anyLoading,
			}),
		);
	}, [categorySearch, manualCategory, categoryEnabled]);
	const handleCategorySelect = useCallback((category: SearchCategory) => {
		setManualCategory(category);
		setActiveCategory(category);
	}, []);
```

> `viewer`, `trimmedDraft`, `freeText`, `searchTags`, `useMemo`, `useState`, `useEffect`, `useCallback` are all already in scope/imported in this component.

- [ ] **Step 3: Add a person→profile-handle adapter for the body**

The body's Members section calls `onSelectProfile(handle)`. `handleProfileSelect` already exists with that signature — reuse it directly (no new code). Confirm it is defined as `handleProfileSelect(handle: string)`.

- [ ] **Step 4: Render category pills on the no-tag path**

Find the Films/TV chips block:

```tsx
						{/* Films vs TV — only while searching; empty-state browse rail already implies the next query’s catalogue. */}
						{!isEmptyDraft && !hasMediaTag ? (
							<fieldset className="min-w-0 shrink-0 border-0 px-4 pb-2">
								<legend className="sr-only">Show</legend>
								<SearchDialogListingKindChips
									searchListingKind={searchListingKind}
									onSelectMovie={() => setSearchListingKind("movie")}
									onSelectTv={() => setSearchListingKind("tv")}
								/>
							</fieldset>
						) : null}
```

Replace the whole block with a branch: category pills when there are no tags, the existing chips otherwise:

```tsx
						{!isEmptyDraft && searchTags.length === 0 ? (
							<fieldset className="min-w-0 shrink-0 border-0 px-4 pb-2">
								<legend className="sr-only">Show</legend>
								<SearchDialogCategoryPills
									enabled={categoryEnabled}
									active={activeCategory}
									categories={categorySearch.categories}
									onSelect={handleCategorySelect}
								/>
							</fieldset>
						) : !isEmptyDraft && !hasMediaTag ? (
							<fieldset className="min-w-0 shrink-0 border-0 px-4 pb-2">
								<legend className="sr-only">Show</legend>
								<SearchDialogListingKindChips
									searchListingKind={searchListingKind}
									onSelectMovie={() => setSearchListingKind("movie")}
									onSelectTv={() => setSearchListingKind("tv")}
								/>
							</fieldset>
						) : null}
```

- [ ] **Step 5: Remove the always-on Members + Cast & Crew sections**

Find and DELETE these two adjacent blocks (they move into the category body):

```tsx
								{!isEmptyDraft && viewer ? (
									<SearchDialogPeopleResults
										hits={profileSearchHits}
										loading={profileSearchLoading}
										onSelect={handleProfileSelect}
									/>
								) : null}
								{!isEmptyDraft ? (
									<SearchDialogCastCrewResults
										results={castCrewHits}
										loading={castCrewLoading}
										onSelect={handlePersonSelect}
									/>
								) : null}
```

> This also retires the now-unused `castCrewHits`/`castCrewLoading` from the earlier `useCastCrewSearch` wiring and the `profileSearchHits` stacked render — the category body now owns these via `categorySearch`. Leave the `useProfileSearch`/`useCastCrewSearch` calls in place only if still referenced elsewhere; if the type-checker flags them as unused after this task, delete those two hook calls too.

- [ ] **Step 6: Render the category body on the no-tag free-text path**

Find the top of the main results conditional — the branch that begins the browse/lists/catalog tree (the `isEmptyDraft ? (browse…)` region inside the scroll body). Insert, as the FIRST child of the scroll body (right where the deleted sections were), a no-tag free-text branch that renders the category body and short-circuits the legacy catalog grid:

```tsx
								{!isEmptyDraft && searchTags.length === 0 ? (
									<div aria-live="polite" aria-busy={categorySearch.anyLoading}>
										<SearchDialogCategoryBody
											active={activeCategory}
											search={categorySearch}
											query={trimmedDraft}
											onPickCatalog={(id) => handleCatalogSearchPick(id)}
											onSelectPerson={handlePersonSelect}
											onSelectProfile={handleProfileSelect}
											onPickList={() => beginClose()}
										/>
									</div>
								) : null}
```

Then guard the legacy catalog/browse/lists conditional so it only runs for the tag path or empty draft. Find its outer opening (the `isEmptyDraft ? (` … browse … `) : tagState.resultMode === "lists" ? (` … `) : (` … catalog grid … `)` tree) and wrap it so it renders only when `isEmptyDraft || searchTags.length > 0`:

```tsx
								{isEmptyDraft || searchTags.length > 0 ? (
									/* existing browse / lists-mode / catalog-grid tree, unchanged */
								) : null}
```

> Net effect: no-tag free text → category pills + `SearchDialogCategoryBody`; empty draft → browse (unchanged); tags present → existing structured/lists/catalog tree (unchanged).

- [ ] **Step 7: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `home-sticky-search.tsx`. Resolve any "declared but never read" by deleting the now-dead `useCastCrewSearch`/`useProfileSearch` wiring noted in Step 5.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/home/home-sticky-search.tsx
git commit -m "feat(web): 5-way category pills + auto-switch in search dialog"
```

---

## Task 7: Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

Run: `bun test apps/web/src/lib/search-active-category.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 2: Type-check the whole web app**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing any file created/modified in this plan (pre-existing unrelated `.test.ts` errors are out of scope).

- [ ] **Step 3: Manual walkthrough (full stack)**

Start the stack (`bun run dev`), open the ⌘K dialog signed in, then:
1. Type a film title (e.g. `inception`) → **Films** pill active with a count; other pills show their counts; results are the films grid.
2. Type a TV-only title (e.g. `severance`) while Films is active → auto-switches to **TV shows** (Films count 0, dimmed).
3. Type a director/actor (e.g. `nolan`) → results include **Cast & Crew**; if Films/TV are empty it auto-switches there.
4. Tap **Films** when it shows 0 → stays on Films (manual pin), shows the empty hint; edit the query → auto-switch resumes.
5. Type the name of one of your lists (≥2 chars) → **Lists** pill populates; signed out, Lists/Members pills are absent.
6. Select results: film → `/movies/[id]`, TV → `/tv/[id]`, person → `/people/[id]`, list → `/lists/[id]`, member → `/profile/[handle]`.

- [ ] **Step 4: Confirm tag path untouched**

Add a genre or studio tag → the legacy structured/lists/catalog behavior and the Films/TV chips still work exactly as before (no category pills on the tag path).

---

## Self-Review Notes

- **Spec coverage:** five pills (T4), parallel fetch (T3), priority + manual auto-switch (T1 + T6), counts + dim/disable empties (T4), signed-out drops lists/members (T1 `enabledCategories` + T6 `categoryEnabled`), DB guard ≥2 chars (T3 `dbEligible`), free-text-only / tag path untouched (T6 Steps 4 & 6), body switch reusing existing sections (T5). Tests: resolver + enabledCategories (T1), lists hook behavior covered structurally (mirrors tested tag-hook lists branch). Manual walkthrough (T7).
- **Type consistency:** `SearchCategory`, `CATEGORY_PRIORITY`, `resolveActiveCategory`, `enabledCategories`, `CategoryCount`, `useSearchCategoryResults` return fields (`categories`, `anyLoading`, `setupHint`, `films/tv/castcrew/lists/members`) are used identically across T3–T6. `onSelectProfile(handle)`/`handleProfileSelect`, `onSelectPerson(id)`/`handlePersonSelect`, `onPickCatalog(id)`/`handleCatalogSearchPick` signatures line up.
- **No placeholders:** all code blocks complete; the only prose-described edit (T6 Step 6 legacy tree wrap) references existing code left verbatim, with the exact guard condition given.
```
