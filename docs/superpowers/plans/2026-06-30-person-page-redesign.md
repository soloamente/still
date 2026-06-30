# Person page redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign `/people/[id]` to the site's detail-page patterns: top-aligned layout, back-pill + TMDb chrome, a `rounded-2xl` portrait hero, a newest-first filmography using `Section`/`MoviePoster`, and a site-standard empty state — dropping the ad-hoc centering, bottom link, inline TMDb footer, and dashed empty state.

**Architecture:** A pure `sortFilmographyByYearDesc` helper (tested) and a small `PersonPageBackPill` client component (also exporting the shared pill class) keep the page a server component. The page itself is rewritten to use them. No server/data changes.

**Tech Stack:** Next.js (App Router, RSC), React, Tailwind, `bun:test`, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-30-person-page-redesign-design.md`

---

## File Structure

- **Modify** `apps/web/src/lib/person-filmography.ts` — add `sortFilmographyByYearDesc`.
- **Create** `apps/web/src/lib/person-filmography.test.ts` — sorter tests.
- **Create** `apps/web/src/components/people/person-page-back-pill.tsx` — back-pill client component + exported `PERSON_PAGE_PILL_CLASS`.
- **Modify** `apps/web/src/app/(app)/people/[id]/page.tsx` — rewrite the rendered layout.

---

## Task 1: `sortFilmographyByYearDesc` helper + tests

**Files:**
- Modify: `apps/web/src/lib/person-filmography.ts`
- Test: `apps/web/src/lib/person-filmography.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/person-filmography.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	type PersonFilmographyRow,
	sortFilmographyByYearDesc,
} from "./person-filmography";

function row(releaseDate: string | null, title: string): PersonFilmographyRow {
	return { tmdbId: 0, mediaKind: "movie", title, posterUrl: null, releaseDate, roles: [] };
}

describe("sortFilmographyByYearDesc", () => {
	test("orders newest year first", () => {
		const out = sortFilmographyByYearDesc([
			row("2010-07-16", "Inception"),
			row("2023-07-21", "Oppenheimer"),
			row("2014-11-07", "Interstellar"),
		]);
		expect(out.map((r) => r.title)).toEqual([
			"Oppenheimer",
			"Interstellar",
			"Inception",
		]);
	});

	test("puts entries without a parseable year last", () => {
		const out = sortFilmographyByYearDesc([
			row(null, "Untitled"),
			row("2020-01-01", "Tenet"),
		]);
		expect(out.map((r) => r.title)).toEqual(["Tenet", "Untitled"]);
	});

	test("is stable for equal years (keeps input order)", () => {
		const out = sortFilmographyByYearDesc([
			row("2010-12-01", "B"),
			row("2010-01-01", "A"),
		]);
		expect(out.map((r) => r.title)).toEqual(["B", "A"]);
	});

	test("does not mutate the input array", () => {
		const input = [row("2001-01-01", "X"), row("2009-01-01", "Y")];
		const snapshot = input.map((r) => r.title);
		sortFilmographyByYearDesc(input);
		expect(input.map((r) => r.title)).toEqual(snapshot);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/person-filmography.test.ts`
Expected: FAIL — `sortFilmographyByYearDesc` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/src/lib/person-filmography.ts` (after `filmographyReleaseYear`):

```ts
/**
 * Returns a new array sorted by release year descending (newest first).
 * Entries with no parseable year sort last; equal years keep input order.
 */
export function sortFilmographyByYearDesc<T extends { releaseDate: string | null }>(
	items: T[],
): T[] {
	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => {
			const ya = Number(
				filmographyReleaseYear(a.item.releaseDate) ?? Number.NEGATIVE_INFINITY,
			);
			const yb = Number(
				filmographyReleaseYear(b.item.releaseDate) ?? Number.NEGATIVE_INFINITY,
			);
			if (yb !== ya) return yb - ya;
			return a.index - b.index;
		})
		.map(({ item }) => item);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/person-filmography.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/person-filmography.ts apps/web/src/lib/person-filmography.test.ts
git commit -m "feat(web): sortFilmographyByYearDesc helper"
```

---

## Task 2: `PersonPageBackPill` client component

**Files:**
- Create: `apps/web/src/components/people/person-page-back-pill.tsx`

- [ ] **Step 1: Write the component**

`apps/web/src/components/people/person-page-back-pill.tsx`:

```tsx
"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** Shared rounded-full bg-card pill language used by the person page chrome (back + TMDb). */
export const PERSON_PAGE_PILL_CLASS =
	"inline-flex min-h-10 items-center gap-2 rounded-full bg-card px-4 py-2 font-medium text-foreground text-sm transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Back-pill for the person detail page — returns to the previous view, /home as fallback. */
export function PersonPageBackPill() {
	const router = useRouter();
	return (
		<button
			type="button"
			className={PERSON_PAGE_PILL_CLASS}
			onClick={() => {
				if (typeof window !== "undefined" && window.history.length > 1) {
					router.back();
				} else {
					router.push("/home");
				}
			}}
		>
			<ChevronLeft className="size-4 shrink-0" aria-hidden />
			Back
		</button>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `person-page-back-pill.tsx` (grep the output for that filename).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/people/person-page-back-pill.tsx
git commit -m "feat(web): PersonPageBackPill chrome component"
```

---

## Task 3: Rewrite `/people/[id]/page.tsx`

**Files:**
- Modify: `apps/web/src/app/(app)/people/[id]/page.tsx`

- [ ] **Step 1: Replace the file contents**

Write `apps/web/src/app/(app)/people/[id]/page.tsx` with exactly:

```tsx
import { Calendar, Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { MoviePoster } from "@/components/movie/movie-poster";
import {
	PERSON_PAGE_PILL_CLASS,
	PersonPageBackPill,
} from "@/components/people/person-page-back-pill";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";
import {
	filmographyReleaseYear,
	sortFilmographyByYearDesc,
} from "@/lib/person-filmography";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type PersonPayload = {
	code?: "TMDB_UNCONFIGURED";
	hint?: string;
	person: {
		id: number;
		name: string;
		biography: string;
		birthday: string | null;
		deathday: string | null;
		knownForDepartment?: string;
		profilePath: string | null;
		profileUrl: string | null;
	} | null;
	filmography: {
		tmdbId: number;
		mediaKind: "movie" | "tv";
		title: string;
		posterUrl: string | null;
		/** ISO date string from the API; may deserialize oddly on the client in some stacks. */
		releaseDate: string | null;
		roles: string[];
	}[];
};

type Params = { id: string };

export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}): Promise<Metadata> {
	const { id } = await params;
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) return { title: "Person" };

	const api = await serverApi();
	const res = await api.api
		.people({ id })
		.get()
		.catch(() => ({ data: null as PersonPayload | null }));
	const data = res.data as PersonPayload | null;
	const name = data?.person?.name;
	return { title: name ? `${name} · Filmography` : "Person" };
}

export default async function PersonPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { id } = await params;
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) notFound();

	const api = await serverApi();
	const res = await api.api
		.people({ id })
		.get()
		.catch(() => ({ data: null as PersonPayload | null }));
	const data = res.data as PersonPayload | null;

	if (!data) notFound();

	if (data.code === "TMDB_UNCONFIGURED") {
		return (
			<div className="mx-auto w-full max-w-5xl px-1 pt-6 pb-12">
				<PersonPageBackPill />
				<p className="mx-auto mt-16 max-w-lg text-center text-muted-foreground text-sm">
					{data.hint}
				</p>
			</div>
		);
	}

	const person = data.person;
	if (!person) notFound();

	const lifeSpan =
		person.birthday || person.deathday
			? [
					person.birthday ? formatDate(new Date(person.birthday)) : "?",
					person.deathday ? formatDate(new Date(person.deathday)) : null,
				]
					.filter(Boolean)
					.join(" — ")
			: null;

	const filmography = sortFilmographyByYearDesc(data.filmography);

	return (
		<article className="mx-auto w-full max-w-5xl space-y-8 pt-6 pb-12">
			<div className="flex items-center justify-between gap-3 px-1">
				<PersonPageBackPill />
				<a
					href={`https://www.themoviedb.org/person/${person.id}`}
					className={PERSON_PAGE_PILL_CLASS}
					target="_blank"
					rel="noreferrer"
				>
					View on TMDb
				</a>
			</div>

			<header className="flex flex-col gap-6 sm:flex-row sm:items-start">
				<div className="relative mx-auto aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:mx-0 sm:w-40 md:w-44">
					{person.profileUrl ? (
						<Image
							src={person.profileUrl}
							alt={person.name}
							fill
							className="object-cover"
							sizes="176px"
							priority
						/>
					) : (
						<div className="grid size-full place-items-center text-muted-foreground">
							<Clapperboard className="size-10" aria-hidden />
						</div>
					)}
				</div>
				<div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
					{person.knownForDepartment ? (
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
							{person.knownForDepartment}
						</p>
					) : null}
					<h1 className="font-editorial font-medium text-3xl text-foreground tracking-tight md:text-4xl">
						{person.name}
					</h1>
					{lifeSpan ? (
						<p className="flex items-center justify-center gap-2 text-muted-foreground text-sm sm:justify-start">
							<Calendar className="size-4 shrink-0" aria-hidden />
							{lifeSpan}
						</p>
					) : null}
					{person.biography?.trim() ? (
						<p className="line-clamp-6 max-w-3xl text-pretty text-foreground/85 text-sm leading-relaxed">
							{person.biography.trim()}
						</p>
					) : null}
				</div>
			</header>

			<Section
				title="Filmography"
				subtitle={`${filmography.length} film and TV title${filmography.length === 1 ? "" : "s"} with this person in cast or crew.`}
			>
				{filmography.length === 0 ? (
					<p className="rounded-2xl bg-card/40 p-10 text-center text-muted-foreground text-sm">
						No film credits loaded yet. Try again after the API syncs with TMDb.
					</p>
				) : (
					<div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
						{filmography.map((m) => {
							const yearLabel = filmographyReleaseYear(m.releaseDate);
							return (
								<div key={`${m.mediaKind}-${m.tmdbId}`} className="min-w-0">
									<MoviePoster
										movieId={m.tmdbId}
										title={m.title}
										posterUrl={m.posterUrl}
										listingKind={m.mediaKind === "tv" ? "tv" : "movie"}
										showTitle
									/>
									<p className="mt-1 line-clamp-3 text-[10px] text-muted-foreground leading-snug">
										{m.roles.join(" · ")}
									</p>
									{yearLabel ? (
										<p className="mt-0.5 text-[10px] text-muted-foreground/80 tabular-nums">
											{yearLabel}
										</p>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</Section>
		</article>
	);
}
```

> Changes vs the old file: removed the `appShellMainContentMinHeightStyle` wrapper + `justify-center` (top-aligned now); removed the `Link` import and the bottom "Search films" block; removed the inline "Credits from TMDb" paragraph (now the "View on TMDb" chrome pill); portrait `rounded-md` → `rounded-2xl`; bio `line-clamp-6` fixed (dropped `sm:line-clamp-none`); filmography sorted via `sortFilmographyByYearDesc`; empty state no longer `border-dashed`.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `people/[id]/page.tsx`. Confirm no "declared but never read" for removed imports (`Link`, `appShellMainContentMinHeightStyle` must be gone).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/people/[id]/page.tsx"
git commit -m "feat(web): redesign person page to match site detail patterns"
```

---

## Task 4: Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit test**

Run: `bun test apps/web/src/lib/person-filmography.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 2: Type-check touched files**

Run: `cd apps/web && bunx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `person-filmography.ts`, `person-page-back-pill.tsx`, or `people/[id]/page.tsx` (pre-existing unrelated `.test.ts` errors are out of scope).

- [ ] **Step 3: Manual walkthrough (full stack)**

Start the stack (`bun run dev`), open a person via search (e.g. a director). Confirm:
1. Page content is top-aligned (not floating mid-viewport).
2. A **Back** pill (chevron) sits top-left; **View on TMDb** pill top-right; both use the rounded `bg-card` pill look.
3. Clicking **Back** returns to the previous view.
4. Portrait corners are `rounded-2xl`; name renders in the editorial face.
5. Filmography is newest-first.
6. A person with no credits shows the empty state without a dashed border.
7. No "Search films" link at the bottom.

---

## Self-Review Notes

- **Spec coverage:** top-aligned layout + chrome (T3 Step 1), back-pill with /home fallback (T2), TMDb chrome pill replacing inline footer (T2 class + T3), `rounded-2xl` portrait + clean bio clamp (T3), newest-first filmography via tested helper (T1 + T3), site-standard empty state (T3), removed ad-hoc bits (T3 note), `TMDB_UNCONFIGURED` top-aligned (T3). All spec sections mapped.
- **Type consistency:** `sortFilmographyByYearDesc` generic over `{ releaseDate: string | null }` matches `PersonPayload.filmography` rows; `PERSON_PAGE_PILL_CLASS`/`PersonPageBackPill` imported from the same module and used in T3.
- **No placeholders:** every code step is complete; the page is a full-file replacement.
```
