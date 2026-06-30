# Search: Cast & Crew (directors & actors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TMDb person (directors, actors, all cast/crew) search to the unified ⌘K dialog, landing on the existing `/people/[id]` page; rename the patron section header "People" → "Members".

**Architecture:** Mirror the existing patron-search vertical slice end to end. Server: a pure mapper (`people-search-row.ts`) + a `tmdbApi.searchPerson` method + a `GET /api/people/search` route. Web: `fetchPeopleSearch` helper + a `castCrewMetaLine` helper/type module + a debounced `useCastCrewSearch` hook + a `SearchDialogCastCrewResults`/`-Row` section, wired into `home-sticky-search.tsx`.

**Tech Stack:** Bun + Elysia (server), Next.js + React (web), TMDb v3 API, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-30-search-cast-crew-people-design.md`

---

## File Structure

**Server**
- Create `apps/server/src/lib/people-search-row.ts` — pure `mapTmdbPersonToSearchRow()` + `PeopleSearchRow` type (testable without Elysia).
- Create `apps/server/src/lib/people-search-row.test.ts` — mapper unit tests.
- Modify `apps/server/src/lib/tmdb.ts` — add `TmdbPersonSummary` type + `searchPerson()` method.
- Modify `apps/server/src/routes/people.ts` — add `GET /search`.

**Web**
- Create `apps/web/src/lib/cast-crew-search-query.ts` — `CastCrewSearchHit` type + `castCrewMetaLine()` helper.
- Create `apps/web/src/lib/cast-crew-search-query.test.ts` — meta-line unit tests.
- Modify `apps/web/src/lib/still-api-fetch.ts` — add `fetchPeopleSearch()`.
- Create `apps/web/src/lib/use-cast-crew-search.ts` — debounced hook.
- Create `apps/web/src/components/home/search-dialog-cast-crew-row.tsx` — one person row.
- Create `apps/web/src/components/home/search-dialog-cast-crew-results.tsx` — "Cast & Crew" section.
- Modify `apps/web/src/components/home/search-dialog-people-results.tsx` — header "People" → "Members".
- Modify `apps/web/src/components/home/home-sticky-search.tsx` — call hook, render section, add `handlePersonSelect`.

---

## Task 1: Server — person search row mapper

**Files:**
- Create: `apps/server/src/lib/people-search-row.ts`
- Test: `apps/server/src/lib/people-search-row.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/server/src/lib/people-search-row.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { mapTmdbPersonToSearchRow } from "./people-search-row";

describe("mapTmdbPersonToSearchRow", () => {
	test("maps id, name, role and up to 3 known-for titles (movie title or tv name)", () => {
		const row = mapTmdbPersonToSearchRow({
			id: 525,
			name: "Christopher Nolan",
			profile_path: "/abc.jpg",
			known_for_department: "Directing",
			known_for: [
				{ title: "Inception" },
				{ name: "Some Show" },
				{ title: "Oppenheimer" },
				{ title: "Dunkirk" },
			],
		});
		expect(row).toEqual({
			id: 525,
			name: "Christopher Nolan",
			profileUrl: "https://image.tmdb.org/t/p/w185/abc.jpg",
			knownForDepartment: "Directing",
			knownForTitles: ["Inception", "Some Show", "Oppenheimer"],
		});
	});

	test("null profileUrl when no photo, null department when absent, empty titles when no known_for", () => {
		const row = mapTmdbPersonToSearchRow({
			id: 1,
			name: "Nobody",
			profile_path: null,
		});
		expect(row.profileUrl).toBeNull();
		expect(row.knownForDepartment).toBeNull();
		expect(row.knownForTitles).toEqual([]);
	});

	test("skips known_for entries that have neither title nor name", () => {
		const row = mapTmdbPersonToSearchRow({
			id: 2,
			name: "X",
			profile_path: null,
			known_for: [{}, { title: "Real" }, { name: "" }],
		});
		expect(row.knownForTitles).toEqual(["Real"]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/people-search-row.test.ts`
Expected: FAIL — `mapTmdbPersonToSearchRow` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/lib/people-search-row.ts`:

```ts
import { tmdbImg } from "./tmdb";
import type { TmdbPersonSummary } from "./tmdb";

/** Slim person row returned by `GET /api/people/search` — drives the dialog "Cast & Crew" section. */
export type PeopleSearchRow = {
	id: number;
	name: string;
	profileUrl: string | null;
	knownForDepartment: string | null;
	knownForTitles: string[];
};

/** TMDb `/search/person` row → slim search row. Picks up to 3 known-for titles (movie `title` or TV `name`). */
export function mapTmdbPersonToSearchRow(
	person: TmdbPersonSummary,
): PeopleSearchRow {
	const knownForTitles = (person.known_for ?? [])
		.map((entry) => entry.title ?? entry.name ?? "")
		.filter((t): t is string => t.length > 0)
		.slice(0, 3);
	return {
		id: person.id,
		name: person.name,
		profileUrl: tmdbImg.profile(person.profile_path, "w185"),
		knownForDepartment: person.known_for_department ?? null,
		knownForTitles,
	};
}
```

> Note: `TmdbPersonSummary` is added in Task 2. If executing strictly in order, this import will not type-check until Task 2 lands; that is expected. The test exercises runtime behaviour and passes regardless. (Subagent runners: do Task 2 immediately after.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/people-search-row.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/people-search-row.ts apps/server/src/lib/people-search-row.test.ts
git commit -m "feat(server): person search row mapper for cast & crew search"
```

---

## Task 2: Server — `TmdbPersonSummary` type + `searchPerson` method

**Files:**
- Modify: `apps/server/src/lib/tmdb.ts` (add type near other summary types ~line 45; add method near `searchTv` ~line 327)

- [ ] **Step 1: Add the `TmdbPersonSummary` type**

In `apps/server/src/lib/tmdb.ts`, immediately after the `TmdbTvSummary` type block (around line 45), add:

```ts
/** TMDb `/search/person` row — `known_for` mixes movie (`title`) and TV (`name`) entries. */
export type TmdbPersonSummary = {
	id: number;
	name: string;
	profile_path: string | null;
	known_for_department?: string;
	popularity?: number;
	known_for?: Array<{
		id?: number;
		title?: string;
		name?: string;
		media_type?: "movie" | "tv";
	}>;
};
```

- [ ] **Step 2: Add the `searchPerson` method**

In the `tmdbApi` object, immediately after the `searchTv` method (ends ~line 336), add:

```ts
	/** TMDb `/search/person` — rows carry `known_for` (notable titles) and `known_for_department`. */
	searchPerson(query: string, page = 1, fetchOpts: TmdbFetchOptions = {}) {
		return tmdb<TmdbPaged<TmdbPersonSummary>>(
			"/search/person",
			{
				query,
				page,
				include_adult: tmdbIncludeAdult(fetchOpts.showAdultContent),
			},
			fetchOpts,
		);
	},
```

- [ ] **Step 3: Type-check**

Run: `bun test apps/server/src/lib/people-search-row.test.ts`
Expected: PASS (the Task 1 mapper now resolves `TmdbPersonSummary` cleanly).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/tmdb.ts
git commit -m "feat(server): tmdbApi.searchPerson + TmdbPersonSummary"
```

---

## Task 3: Server — `GET /api/people/search` route

**Files:**
- Modify: `apps/server/src/routes/people.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/server/src/routes/people.ts`, alongside existing imports, add:

```ts
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import { mapTmdbPersonToSearchRow } from "../lib/people-search-row";
```

- [ ] **Step 2: Add the `/search` route**

Chain a `.get("/search", …)` onto the `peopleRoute` Elysia instance (place it before the existing `.get("/:id", …)` so the static path wins over the param route):

```ts
	.get(
		"/search",
		async ({ query, user }) => {
			const q = (query.q ?? "").trim();
			if (!q) return { results: [], page: 1, total_pages: 0, total_results: 0 };
			if (!env.TMDB_API_KEY) {
				return {
					...TMDB_UNCONFIGURED,
					results: [],
					page: 1,
					total_pages: 0,
					total_results: 0,
				};
			}
			const language = await getTmdbLanguageForUser(user?.id);
			const showAdultContent = await getShowAdultContentForUser(user?.id);
			const page = Number(query.page ?? 1) || 1;
			const data = await tmdbApi.searchPerson(q, page, {
				language,
				showAdultContent,
			});
			return {
				results: data.results.map(mapTmdbPersonToSearchRow),
				page: data.page,
				total_pages: data.total_pages,
				total_results: data.total_results,
			};
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				page: t.Optional(t.String()),
			}),
		},
	)
```

> The `/:id` route already exists below; ensure `/search` is registered first. `TMDB_UNCONFIGURED`, `tmdbApi`, `getTmdbLanguageForUser`, `env`, and `t` are already imported in this file.

- [ ] **Step 3: Boot the server and verify the endpoint live**

Start the server, then query it (the dev TMDb key is configured in `apps/server/.env`):

```bash
cd apps/server && bun run --hot src/local.ts &
sleep 4
curl -s "http://127.0.0.1:3000/api/people/search?q=nolan" | head -c 400
```

Expected: JSON with a `results` array; the first row is Christopher Nolan with `"knownForDepartment":"Directing"` and a populated `knownForTitles`. Stop the server afterward (`kill %1`).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/people.ts
git commit -m "feat(server): GET /api/people/search (TMDb person passthrough)"
```

---

## Task 4: Web — `CastCrewSearchHit` type + `castCrewMetaLine` helper

**Files:**
- Create: `apps/web/src/lib/cast-crew-search-query.ts`
- Test: `apps/web/src/lib/cast-crew-search-query.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/cast-crew-search-query.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { castCrewMetaLine } from "./cast-crew-search-query";

describe("castCrewMetaLine", () => {
	test("joins department and known-for titles", () => {
		expect(
			castCrewMetaLine({
				id: 1,
				name: "Christopher Nolan",
				profileUrl: null,
				knownForDepartment: "Directing",
				knownForTitles: ["Inception", "Oppenheimer"],
			}),
		).toBe("Directing · Inception, Oppenheimer");
	});

	test("department only when no titles", () => {
		expect(
			castCrewMetaLine({
				id: 2,
				name: "X",
				profileUrl: null,
				knownForDepartment: "Acting",
				knownForTitles: [],
			}),
		).toBe("Acting");
	});

	test("titles only when no department", () => {
		expect(
			castCrewMetaLine({
				id: 3,
				name: "Y",
				profileUrl: null,
				knownForDepartment: null,
				knownForTitles: ["Heat"],
			}),
		).toBe("Heat");
	});

	test("empty string when nothing to show", () => {
		expect(
			castCrewMetaLine({
				id: 4,
				name: "Z",
				profileUrl: null,
				knownForDepartment: null,
				knownForTitles: [],
			}),
		).toBe("");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/cast-crew-search-query.test.ts`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/cast-crew-search-query.ts`:

```ts
/** Person row from `GET /api/people/search` — mirrors the server `PeopleSearchRow`. */
export interface CastCrewSearchHit {
	id: number;
	name: string;
	profileUrl: string | null;
	knownForDepartment: string | null;
	knownForTitles: string[];
}

/** Secondary line for a cast/crew row, e.g. "Director · Inception, Oppenheimer". */
export function castCrewMetaLine(hit: CastCrewSearchHit): string {
	const parts: string[] = [];
	if (hit.knownForDepartment) parts.push(hit.knownForDepartment);
	if (hit.knownForTitles.length > 0) parts.push(hit.knownForTitles.join(", "));
	return parts.join(" · ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/cast-crew-search-query.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cast-crew-search-query.ts apps/web/src/lib/cast-crew-search-query.test.ts
git commit -m "feat(web): CastCrewSearchHit type + castCrewMetaLine helper"
```

---

## Task 5: Web — `fetchPeopleSearch` helper

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts` (add after `fetchTvSearch`, ~line 238)

- [ ] **Step 1: Add the fetch helper**

In `apps/web/src/lib/still-api-fetch.ts`, after the `fetchTvSearch` function, add:

```ts
/** TMDb person search proxy — rows are slim `PeopleSearchRow`s ({id,name,profileUrl,knownForDepartment,knownForTitles}). */
export async function fetchPeopleSearch(
	qRaw: string,
	init?: Pick<RequestInit, "signal"> & { page?: number; cookieHeader?: string },
) {
	const url = new URL("/api/people/search", stillApiOrigin());
	url.searchParams.set("q", qRaw.trim());
	const page = init?.page;
	if (page !== undefined && Number.isFinite(page) && page >= 1) {
		url.searchParams.set("page", String(Math.floor(page)));
	}
	const { cookieHeader, signal } = init ?? {};
	const response = await fetch(url, {
		credentials: "include",
		signal,
		headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
	});
	const data = (await response.json()) as unknown;
	return {
		data: response.ok ? data : null,
		error: response.ok ? null : { status: response.status, raw: data },
		response,
	};
}
```

- [ ] **Step 2: Type-check the file compiles**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `still-api-fetch.ts`. (Pre-existing unrelated errors, if any, are out of scope — confirm none mention this file.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/still-api-fetch.ts
git commit -m "feat(web): fetchPeopleSearch helper"
```

---

## Task 6: Web — `useCastCrewSearch` hook

**Files:**
- Create: `apps/web/src/lib/use-cast-crew-search.ts`

- [ ] **Step 1: Write the hook**

`apps/web/src/lib/use-cast-crew-search.ts` (mirrors `use-catalog-text-search.ts`: debounce, abort, empty-clear, setup hint):

```ts
"use client";

import { useEffect, useState } from "react";

import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";
import { fetchPeopleSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

/** Debounced TMDb person (cast & crew) typeahead for the catalog search dialog. */
export function useCastCrewSearch(
	query: string,
	enabled: boolean,
	debounceMs = 240,
) {
	const [results, setResults] = useState<CastCrewSearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [setupHint, setSetupHint] = useState<string | null>(null);

	useEffect(() => {
		const q = query.trim();
		if (!enabled || !q) {
			setResults([]);
			setSetupHint(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchPeopleSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setResults([]);
					setSetupHint(null);
					return;
				}
				const data = res.data as {
					results?: CastCrewSearchHit[];
				} | null;
				setSetupHint(tmdbSetupHint(data));
				setResults((data?.results ?? []) as CastCrewSearchHit[]);
			} catch {
				if (!ctrl.signal.aborted) {
					setResults([]);
					setSetupHint(null);
				}
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, debounceMs);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query, enabled, debounceMs]);

	return { results, loading, setupHint };
}
```

> `tmdbSetupHint` and its import path `@/lib/tmdb-config` are already used by `use-catalog-text-search.ts` — reuse the same import.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `use-cast-crew-search.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/use-cast-crew-search.ts
git commit -m "feat(web): useCastCrewSearch debounced hook"
```

---

## Task 7: Web — `SearchDialogCastCrewRow` component

**Files:**
- Create: `apps/web/src/components/home/search-dialog-cast-crew-row.tsx`

- [ ] **Step 1: Write the row component**

`apps/web/src/components/home/search-dialog-cast-crew-row.tsx`:

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";

import { castCrewMetaLine } from "@/lib/cast-crew-search-query";
import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";

/** One TMDb person row in the unified search dialog "Cast & Crew" section. */
export function SearchDialogCastCrewRow({
	hit,
	onSelect,
}: {
	hit: CastCrewSearchHit;
	onSelect: () => void;
}) {
	const meta = castCrewMetaLine(hit);
	const initial = hit.name.trim().charAt(0).toUpperCase() || "?";
	return (
		<li>
			<button
				type="button"
				onClick={onSelect}
				className={cn(
					"flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
					"[@media(hover:hover)]:hover:bg-background",
					"focus-visible:bg-background focus-visible:outline-none",
				)}
			>
				{hit.profileUrl ? (
					// biome-ignore lint/performance/noImgElement: remote TMDb host, small avatar
					<img
						src={hit.profileUrl}
						alt=""
						width={44}
						height={44}
						className="size-11 shrink-0 rounded-full object-cover"
						loading="lazy"
					/>
				) : (
					<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground text-sm">
						{initial}
					</span>
				)}
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-foreground text-sm leading-snug">
						{hit.name}
					</p>
					{meta ? (
						<p className="truncate text-muted-foreground text-xs leading-snug">
							{meta}
						</p>
					) : null}
				</div>
			</button>
		</li>
	);
}
```

> If Biome rejects the `<img>` rule name, run `cd apps/web && bunx @biomejs/biome check --write src/components/home/search-dialog-cast-crew-row.tsx` and accept its suggested ignore directive, or follow the project's existing avatar-image pattern.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `search-dialog-cast-crew-row.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/search-dialog-cast-crew-row.tsx
git commit -m "feat(web): SearchDialogCastCrewRow"
```

---

## Task 8: Web — `SearchDialogCastCrewResults` section

**Files:**
- Create: `apps/web/src/components/home/search-dialog-cast-crew-results.tsx`

- [ ] **Step 1: Write the section component**

`apps/web/src/components/home/search-dialog-cast-crew-results.tsx` (mirrors `search-dialog-people-results.tsx`):

```tsx
"use client";

import { SearchDialogCastCrewRow } from "@/components/home/search-dialog-cast-crew-row";
import { SearchDialogListSkeleton } from "@/components/home/search-dialog-result-skeletons";
import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";

export function SearchDialogCastCrewResults({
	results,
	loading,
	onSelect,
}: {
	results: CastCrewSearchHit[];
	loading: boolean;
	onSelect: (id: number) => void;
}) {
	if (loading && results.length === 0) {
		return (
			<div className="px-4 pb-2">
				<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
					Cast & Crew
				</div>
				<SearchDialogListSkeleton />
			</div>
		);
	}

	if (results.length === 0) return null;

	return (
		<div className="px-4 pb-2">
			<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
				Cast & Crew
			</div>
			<ul className="space-y-0.5">
				{results.map((hit) => (
					<SearchDialogCastCrewRow
						key={hit.id}
						hit={hit}
						onSelect={() => onSelect(hit.id)}
					/>
				))}
			</ul>
		</div>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `search-dialog-cast-crew-results.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/search-dialog-cast-crew-results.tsx
git commit -m "feat(web): SearchDialogCastCrewResults section"
```

---

## Task 9: Web — rename patron section header "People" → "Members"

**Files:**
- Modify: `apps/web/src/components/home/search-dialog-people-results.tsx`

- [ ] **Step 1: Replace both header strings**

In `apps/web/src/components/home/search-dialog-people-results.tsx` there are two identical header `<div>`s containing the text `People` (one in the loading branch, one in the results branch). Change both occurrences of:

```tsx
					People
```

to:

```tsx
					Members
```

(Both are inside `className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider"` divs.)

- [ ] **Step 2: Verify no stray "People" header remains in that file**

Run: `grep -n ">[[:space:]]*People[[:space:]]*<" apps/web/src/components/home/search-dialog-people-results.tsx`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/search-dialog-people-results.tsx
git commit -m "refactor(web): rename patron search section People → Members"
```

---

## Task 10: Web — wire Cast & Crew into the search dialog

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1: Add imports**

Near the other `search-dialog-*` imports (~line 29-30), add:

```tsx
import { SearchDialogCastCrewResults } from "@/components/home/search-dialog-cast-crew-results";
```

Near the other hook imports (~line 81-85), add:

```tsx
import { useCastCrewSearch } from "@/lib/use-cast-crew-search";
```

- [ ] **Step 2: Call the hook**

Immediately after the existing `useProfileSearch` call (~line 691-692):

```tsx
	const { hits: profileSearchHits, loading: profileSearchLoading } =
		useProfileSearch(trimmedDraft, peopleSearchEnabled);
```

add:

```tsx
	const castCrewSearchEnabled = trimmedDraft.length >= 1 && showSheet;
	const { results: castCrewHits, loading: castCrewLoading } = useCastCrewSearch(
		trimmedDraft,
		castCrewSearchEnabled,
	);
```

> `trimmedDraft` and `showSheet` are already in scope at this point. Unlike patron search, cast/crew search does not require a signed-in viewer.

- [ ] **Step 3: Add the select handler**

Immediately after the `handleProfileSelect` `useCallback` (~line 522-528), add:

```tsx
	const handlePersonSelect = useCallback(
		(id: number) => {
			pendingNavigationRef.current = `/people/${id}`;
			beginClose();
		},
		[beginClose],
	);
```

- [ ] **Step 4: Render the section**

In the results body, directly after the existing `SearchDialogPeopleResults` block (~line 1101-1108):

```tsx
								{!isEmptyDraft && viewer ? (
									<SearchDialogPeopleResults
										hits={profileSearchHits}
										loading={profileSearchLoading}
										onSelect={handleProfileSelect}
									/>
								) : null}
```

add:

```tsx
								{!isEmptyDraft ? (
									<SearchDialogCastCrewResults
										results={castCrewHits}
										loading={castCrewLoading}
										onSelect={handlePersonSelect}
									/>
								) : null}
```

> No `viewer` guard — cast/crew search works signed-out too.

- [ ] **Step 5: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `home-sticky-search.tsx`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/home/home-sticky-search.tsx
git commit -m "feat(web): render Cast & Crew results in unified search dialog"
```

---

## Task 11: Full verification (manual, in the running app)

**Files:** none (verification only)

- [ ] **Step 1: Start the stack**

Run: `bun run dev` (from repo root). Wait for server on :3000 and web on :3001.

- [ ] **Step 2: Verify search end to end**

1. Open `http://localhost:3001`, open the ⌘K search dialog.
2. Type `nolan`. Expect a **"Cast & Crew"** section listing Christopher Nolan with meta line `Directing · …`.
3. Type `pacino`. Expect Al Pacino with `Acting · …`.
4. Confirm the patron section header now reads **"Members"** (sign in if needed and search a known handle to surface it).
5. Click a Cast & Crew row → navigates to `/people/[id]` and the existing person page renders with filmography.

- [ ] **Step 3: Run the full test suite for touched packages**

Run: `bun test apps/server/src/lib/people-search-row.test.ts apps/web/src/lib/cast-crew-search-query.test.ts`
Expected: PASS (all tests).

- [ ] **Step 4: Final type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json` and `cd apps/server && bun run check-types`
Expected: no new errors in the files this plan touched.

---

## Self-Review Notes

- **Spec coverage:** lib `searchPerson` (T2), route `/api/people/search` with `TMDB_UNCONFIGURED` + empty-q + adult/language handling (T3), slim row mapping incl. all departments (T1), web fetch (T5), hook (T6), "Cast & Crew" section + row with role + known-for line (T7/T8), rename People→Members (T9), wiring + `/people/[id]` navigation independent of Films/TV chip (T10), tests + manual verify (T1/T4/T11). All spec sections mapped.
- **Type consistency:** server `PeopleSearchRow` and web `CastCrewSearchHit` share field names (`id`, `name`, `profileUrl`, `knownForDepartment`, `knownForTitles`); `mapTmdbPersonToSearchRow`, `castCrewMetaLine`, `searchPerson`, `fetchPeopleSearch`, `useCastCrewSearch`, `handlePersonSelect` used consistently across tasks.
- **No placeholders:** every code step contains full code; commands have expected output.
