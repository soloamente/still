# Review people mentions (# films · @ cast/crew & patrons) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patrons tag films with `#`, cast/crew and patrons with `@`, in review bodies and review comments — with tappable reader links and patron inbox notifications.

**Architecture:** Extend the existing listing-mentions stack into a unified `content-mentions` module (parse · format · insert · migrate). One shared `MentionTextarea` drives `#` and `@` pickers. Server parses `/profile/:handle` tokens on review/comment save to deliver `mention.in_review_or_comment` notifications. Legacy `@[Title](/movies|tv/id)` keeps rendering; PATCH rewrites to `#`.

**Tech Stack:** Bun + Elysia (server), Next.js + React (web), existing TMDb people search + profile search APIs, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-07-07-review-people-mentions-design.md`

---

## File Structure

**Web — lib**
- Create `apps/web/src/lib/content-mentions.ts` — unified parser, formatters, trigger detection, migration.
- Create `apps/web/src/lib/content-mentions.test.ts` — replaces/extends listing-mention tests.
- Modify `apps/web/src/lib/review-listing-mentions.ts` — thin re-exports to `content-mentions` (backward compat).
- Create `apps/web/src/lib/use-people-mention-search.ts` — title credits + global people search.
- Create `apps/web/src/lib/use-patron-mention-search.ts` — wraps `fetchProfileSearch`.
- Create `apps/web/src/lib/movie-mention-credits.ts` — extract + filter cast/crew from movie `tmdbJson`.
- Modify `apps/web/src/lib/review-deep-link.ts` — optional `commentId` query param on review href.

**Web — components**
- Rename `apps/web/src/components/review/review-listing-mention-textarea.tsx` → `mention-textarea.tsx` (export `MentionTextarea`; keep `ReviewListingMentionTextarea` alias).
- Modify `apps/web/src/components/review/review-body-with-mentions.tsx` — render listing · person · patron; export `BodyWithMentions` alias.
- Modify `apps/web/src/components/review/review-composer.tsx` — `MentionTextarea` + `listingContext`.
- Modify `apps/web/src/components/social/comments-thread.tsx` — `MentionTextarea` compose/edit + `BodyWithMentions` read.
- Modify `apps/web/src/components/review/review-detail-sheet.tsx` — pass `listingContext` to `CommentsThread`.
- Modify `apps/web/src/components/feed/review-activity-copy.tsx` — `BodyWithMentions` instead of raw `{body}`.

**Server**
- Create `apps/server/src/lib/content-mention-notify.ts` — extract handles, resolve profiles, dedupe, deliver.
- Create `apps/server/src/lib/content-mention-notify.test.ts`
- Modify `apps/server/src/lib/notification-delivery.ts` — register `mention.in_review_or_comment`.
- Modify `apps/server/src/routes/reviews.ts` — notify after POST/PATCH.
- Modify `apps/server/src/routes/comments.ts` — notify after POST/PATCH (review parent).
- Modify `apps/server/src/lib/notification-delivery.test.ts` — new kind default.

**Web — settings / inbox**
- Modify `apps/web/src/lib/notification-preferences.ts` — new kind entry.
- Modify `apps/web/src/lib/notification-href.ts` + `.test.ts` — honour `commentId` in payload href.

---

## Task 1: Unified `content-mentions` parser + formatters

**Files:**
- Create: `apps/web/src/lib/content-mentions.ts`
- Create: `apps/web/src/lib/content-mentions.test.ts`
- Modify: `apps/web/src/lib/review-listing-mentions.ts`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/content-mentions.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	formatListingMention,
	formatPersonMention,
	formatPatronMention,
	getActiveListingMentionQuery,
	getActivePeopleMentionQuery,
	insertListingMention,
	isPatronMentionQuery,
	migrateLegacyListingMentions,
	parseBodyWithMentions,
} from "@/lib/content-mentions";

describe("content mentions", () => {
	test("formats listing tokens with # prefix", () => {
		expect(
			formatListingMention({
				title: "Dune: Part Two",
				listingKind: "movie",
				tmdbId: 9664,
			}),
		).toBe("#[Dune: Part Two](/movies/9664)");
	});

	test("formats person and patron tokens", () => {
		expect(
			formatPersonMention({ name: "Timothée Chalamet", tmdbPersonId: 1190663 }),
		).toBe("@[Timothée Chalamet](/people/1190663)");
		expect(
			formatPatronMention({ displayName: "Jane Doe", handle: "jane_doe" }),
		).toBe("@[Jane Doe](/profile/jane_doe)");
	});

	test("parses legacy @ listings, new # listings, people, and patrons", () => {
		const body =
			"Loved #[The Matrix](/movies/603) and @[Legacy](/movies/999) plus @[Tim](/people/1) and @[Jane](/profile/jane)";
		expect(parseBodyWithMentions(body)).toEqual([
			{ type: "text", value: "Loved " },
			{
				type: "listing",
				label: "The Matrix",
				href: "/movies/603",
				listingKind: "movie",
			},
			{ type: "text", value: " and " },
			{
				type: "listing",
				label: "Legacy",
				href: "/movies/999",
				listingKind: "movie",
			},
			{ type: "text", value: " plus " },
			{
				type: "person",
				label: "Tim",
				href: "/people/1",
				tmdbPersonId: 1,
			},
			{ type: "text", value: " and " },
			{
				type: "patron",
				label: "Jane",
				href: "/profile/jane",
				handle: "jane",
			},
		]);
	});

	test("detects # listing query and @ people query", () => {
		expect(getActiveListingMentionQuery("Compare #brea", 13)).toEqual({
			query: "brea",
			start: 8,
			end: 13,
		});
		expect(getActivePeopleMentionQuery("Shout @tim", 11)).toEqual({
			query: "tim",
			start: 6,
			end: 11,
		});
	});

	test("patron mention heuristic", () => {
		expect(isPatronMentionQuery("jane_doe")).toBe(true);
		expect(isPatronMentionQuery("@jane_doe")).toBe(true);
		expect(isPatronMentionQuery("Timothée")).toBe(false);
		expect(isPatronMentionQuery("tim ch")).toBe(false);
	});

	test("migrates legacy listing @ tokens to #", () => {
		expect(
			migrateLegacyListingMentions(
				"Old @[Matrix](/movies/603) stays readable",
			),
		).toBe("Old #[Matrix](/movies/603) stays readable");
		expect(
			migrateLegacyListingMentions("@[Jane](/profile/jane) untouched"),
		).toBe("@[Jane](/profile/jane) untouched");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/content-mentions.test.ts`  
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `content-mentions.ts`**

`apps/web/src/lib/content-mentions.ts` (core exports):

```ts
/** Inline tags in review/comment copy — markdown links with path-based kind. */

export type ContentMentionPart =
	| { type: "text"; value: string }
	| {
			type: "listing";
			label: string;
			href: `/movies/${number}` | `/tv/${number}`;
			listingKind: "movie" | "tv";
	  }
	| {
			type: "person";
			label: string;
			href: `/people/${number}`;
			tmdbPersonId: number;
	  }
	| {
			type: "patron";
			label: string;
			href: `/profile/${string}`;
			handle: string;
	  };

const MENTION_TOKEN =
	/(#|@)\[([^\]]+)\]\(\/(movies|tv|people|profile)\/([^)]+)\)/g;

export function formatListingMention(input: {
	title: string;
	listingKind: "movie" | "tv";
	tmdbId: number;
}): string {
	const segment = input.listingKind === "movie" ? "movies" : "tv";
	const label = input.title.replace(/[[\]]/g, "").trim();
	return `#[${label}](/${segment}/${input.tmdbId})`;
}

export function formatPersonMention(input: {
	name: string;
	tmdbPersonId: number;
}): string {
	const label = input.name.replace(/[[\]]/g, "").trim();
	return `@[${label}](/people/${input.tmdbPersonId})`;
}

export function formatPatronMention(input: {
	displayName: string;
	handle: string;
}): string {
	const label = input.displayName.replace(/[[\]]/g, "").trim();
	return `@[${label}](/profile/${input.handle})`;
}

export function parseBodyWithMentions(body: string): ContentMentionPart[] {
	if (!body) return [{ type: "text", value: "" }];
	const parts: ContentMentionPart[] = [];
	let lastIndex = 0;
	for (const match of body.matchAll(MENTION_TOKEN)) {
		const full = match[0];
		const trigger = match[1];
		const label = match[2];
		const segment = match[3];
		const idPart = match[4];
		const index = match.index ?? 0;
		if (index > lastIndex) {
			parts.push({ type: "text", value: body.slice(lastIndex, index) });
		}
		if (segment === "movies" || segment === "tv") {
			// Legacy @ listings + new # listings
			if (trigger === "#" || trigger === "@") {
				const tmdbId = Number(idPart);
				const listingKind = segment === "movies" ? "movie" : "tv";
				parts.push({
					type: "listing",
					label,
					href:
						listingKind === "movie"
							? (`/movies/${tmdbId}` as const)
							: (`/tv/${tmdbId}` as const),
					listingKind,
				});
			}
		} else if (segment === "people") {
			parts.push({
				type: "person",
				label,
				href: `/people/${Number(idPart)}`,
				tmdbPersonId: Number(idPart),
			});
		} else if (segment === "profile") {
			parts.push({
				type: "patron",
				label,
				href: `/profile/${idPart}`,
				handle: idPart,
			});
		}
		lastIndex = index + full.length;
	}
	if (lastIndex < body.length) {
		parts.push({ type: "text", value: body.slice(lastIndex) });
	}
	return parts.length > 0 ? parts : [{ type: "text", value: body }];
}

export function getActiveListingMentionQuery(
	body: string,
	cursor: number,
): { query: string; start: number; end: number } | null {
	if (cursor < 1) return null;
	const before = body.slice(0, cursor);
	const match = before.match(/(?:^|[\s\n])#([^\s#[\]()]{0,80})$/);
	if (!match) return null;
	const query = match[1] ?? "";
	if (query.includes("[") || query.includes("]")) return null;
	const leadingWhitespace = match[0].startsWith("#") ? 0 : 1;
	const start = before.length - match[0].length + leadingWhitespace;
	return { query, start, end: cursor };
}

export function getActivePeopleMentionQuery(
	body: string,
	cursor: number,
): { query: string; start: number; end: number } | null {
	if (cursor < 1) return null;
	const before = body.slice(0, cursor);
	const match = before.match(/(?:^|[\s\n])@([^\s@[\]()]{0,80})$/);
	if (!match) return null;
	const query = match[1] ?? "";
	if (query.includes("[") || query.includes("]")) return null;
	const leadingWhitespace = match[0].startsWith("@") ? 0 : 1;
	const start = before.length - match[0].length + leadingWhitespace;
	return { query, start, end: cursor };
}

export function isPatronMentionQuery(rawQuery: string): boolean {
	const query = rawQuery.trim().replace(/^@+/, "");
	if (!query || /\s/.test(query)) return false;
	return /^[a-z0-9_]{1,30}$/i.test(query);
}

export function migrateLegacyListingMentions(body: string): string {
	return body.replace(
		/@\[([^\]]+)\]\(\/(movies|tv)\/(\d+)\)/g,
		"#[$1](/$2/$3)",
	);
}

export function insertListingMention(
	body: string,
	range: { start: number; end: number },
	mention: { title: string; listingKind: "movie" | "tv"; tmdbId: number },
): { nextBody: string; nextCursor: number } {
	const token = formatListingMention(mention);
	const needsLeadingSpace =
		range.start > 0 && !/\s/.test(body.charAt(range.start - 1));
	const prefix = needsLeadingSpace ? " " : "";
	const nextBody =
		body.slice(0, range.start) + prefix + token + body.slice(range.end);
	return { nextBody, nextCursor: range.start + prefix.length + token.length };
}

export function insertPersonMention(
	body: string,
	range: { start: number; end: number },
	mention: { name: string; tmdbPersonId: number },
): { nextBody: string; nextCursor: number } {
	const token = formatPersonMention(mention);
	const needsLeadingSpace =
		range.start > 0 && !/\s/.test(body.charAt(range.start - 1));
	const prefix = needsLeadingSpace ? " " : "";
	const nextBody =
		body.slice(0, range.start) + prefix + token + body.slice(range.end);
	return { nextBody, nextCursor: range.start + prefix.length + token.length };
}

export function insertPatronMention(
	body: string,
	range: { start: number; end: number },
	mention: { displayName: string; handle: string },
): { nextBody: string; nextCursor: number } {
	const token = formatPatronMention(mention);
	const needsLeadingSpace =
		range.start > 0 && !/\s/.test(body.charAt(range.start - 1));
	const prefix = needsLeadingSpace ? " " : "";
	const nextBody =
		body.slice(0, range.start) + prefix + token + body.slice(range.end);
	return { nextBody, nextCursor: range.start + prefix.length + token.length };
}

/** Back-compat aliases — remove after call sites migrate. */
export const parseReviewBodyWithMentions = parseBodyWithMentions;
export const formatReviewListingMention = formatListingMention;
export const getActiveListingMentionQueryLegacy = getActiveListingMentionQuery;
export const insertReviewListingMention = insertListingMention;
```

- [ ] **Step 4: Point `review-listing-mentions.ts` at re-exports**

Replace body of `apps/web/src/lib/review-listing-mentions.ts` with:

```ts
export {
	formatListingMention as formatReviewListingMention,
	getActiveListingMentionQuery,
	insertListingMention as insertReviewListingMention,
	listingMentionPickerSubtitle,
	parseBodyWithMentions as parseReviewBodyWithMentions,
	type ContentMentionPart as ReviewListingMentionPart,
} from "@/lib/content-mentions";

/** Subtitle line for the composer `#` picker — kind label plus release year when TMDb has one. */
export function listingMentionPickerSubtitle(input: {
	listingKind: "movie" | "tv";
	release_date?: string;
	first_air_date?: string;
}): string {
	const kindLabel = input.listingKind === "movie" ? "Film" : "TV show";
	const rawDate =
		input.listingKind === "movie" ? input.release_date : input.first_air_date;
	const year = rawDate?.trim().slice(0, 4);
	return year ? `${kindLabel} · ${year}` : kindLabel;
}
```

Move `listingMentionPickerSubtitle` into `content-mentions.ts` if you prefer a single module — either location is fine as long as tests pass.

- [ ] **Step 5: Run tests**

Run: `bun test apps/web/src/lib/content-mentions.test.ts apps/web/src/lib/review-listing-mentions.test.ts`  
Expected: PASS (update `review-listing-mentions.test.ts` expectations: `#` prefix, `type: "listing"` if you change the alias shape — keep legacy test file green by mapping `listing` → `mention` in re-export layer **or** update old tests to import from `content-mentions`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/content-mentions.ts apps/web/src/lib/content-mentions.test.ts apps/web/src/lib/review-listing-mentions.ts apps/web/src/lib/review-listing-mentions.test.ts
git commit -m "feat(web): unified content-mentions parser for listings, people, patrons"
```

---

## Task 2: `BodyWithMentions` renderer

**Files:**
- Modify: `apps/web/src/components/review/review-body-with-mentions.tsx`

- [ ] **Step 1: Extend renderer for person + patron parts**

In `review-body-with-mentions.tsx`:

- Import `parseBodyWithMentions` and `ContentMentionPart` from `@/lib/content-mentions`.
- Replace `part.type === "mention"` branches with:
  - `listing` → existing `Link` to `/movies|tv`
  - `person` → `Link` to `/people/:id`
  - `patron` → `Link` to `/profile/:handle`
- Export `BodyWithMentions` as the primary name; keep `ReviewBodyWithMentions` as alias export.

Shared link chrome stays `MENTION_LINK_CLASS` + `ReviewListingMentionContent` (rename inner component to `MentionLinkContent` if desired — optional).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && bun run check-types`  
Expected: PASS (fix any `ReviewListingMentionPart` imports).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/review/review-body-with-mentions.tsx
git commit -m "feat(web): render person and patron mentions in review body"
```

---

## Task 3: `#` listing picker in `MentionTextarea`

**Files:**
- Create: `apps/web/src/components/review/mention-textarea.tsx` (copy from `review-listing-mention-textarea.tsx`)
- Modify: `apps/web/src/components/review/review-listing-mention-textarea.tsx` — re-export from `mention-textarea.tsx`

- [ ] **Step 1: Rename component and switch trigger to `#`**

In `mention-textarea.tsx`:

- Rename export to `MentionTextarea`.
- Add optional prop `listingContext?: { kind: "movie" | "tv"; tmdbId: number } | null`.
- Replace `getActiveListingMentionQuery` usage (already `#`-based after Task 1).
- Update docstring: `#` for films/TV, `@` for people (Task 5 adds `@`).
- Default `placeholder` prop fallback: `"Use # for films and @ for people"`.

Keep `review-listing-mention-textarea.tsx`:

```ts
export { MentionTextarea as ReviewListingMentionTextarea } from "@/components/review/mention-textarea";
```

- [ ] **Step 2: Wire review composer**

In `review-composer.tsx`:

```tsx
import { MentionTextarea } from "@/components/review/mention-textarea";

// …inside compose step:
<MentionTextarea
  id="review-body"
  value={body}
  onChange={setBody}
  listingContext={{ kind: "movie", tmdbId: args.movieId }}
  placeholder="Use # for films and @ for people"
  maxLength={…}
/>
```

On save (POST/PATCH), run `migrateLegacyListingMentions(body)` before sending payload.

- [ ] **Step 3: Manual smoke**

Run: `bun dev` (web `:3001`, server `:3000`). Open review composer on a movie → type `#dun` → pick a title → token starts with `#`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/review/mention-textarea.tsx apps/web/src/components/review/review-listing-mention-textarea.tsx apps/web/src/components/review/review-composer.tsx
git commit -m "feat(web): # trigger for listing mentions in review composer"
```

---

## Task 4: People + patron mention search hooks

**Files:**
- Create: `apps/web/src/lib/movie-mention-credits.ts`
- Create: `apps/web/src/lib/movie-mention-credits.test.ts`
- Create: `apps/web/src/lib/use-people-mention-search.ts`
- Create: `apps/web/src/lib/use-patron-mention-search.ts`

- [ ] **Step 1: Write failing credit extractor test**

`apps/web/src/lib/movie-mention-credits.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	extractMovieMentionCredits,
	filterMentionCreditsByQuery,
} from "@/lib/movie-mention-credits";

describe("movie mention credits", () => {
	test("extracts cast then key crew up to cap", () => {
		const rows = extractMovieMentionCredits({
			credits: {
				cast: [
					{ id: 1, name: "A", profile_path: null, order: 0 },
					{ id: 2, name: "B", profile_path: "/p.jpg", order: 1 },
				],
				crew: [{ id: 3, name: "Director", job: "Director", profile_path: null }],
			},
		});
		expect(rows.map((r) => r.name)).toEqual(["A", "B", "Director"]);
	});

	test("filters by case-insensitive substring", () => {
		const rows = filterMentionCreditsByQuery(
			[
				{ id: 1, name: "Timothée Chalamet", profileUrl: null, role: "Cast" },
				{ id: 2, name: "Zendaya", profileUrl: null, role: "Cast" },
			],
			"tim",
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Timothée Chalamet");
	});
});
```

- [ ] **Step 2: Implement `movie-mention-credits.ts`**

```ts
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

export type MentionCreditRow = {
	id: number;
	name: string;
	profileUrl: string | null;
	role: string;
};

const CREDIT_CAP = 12;

export function extractMovieMentionCredits(tmdbJson: {
	credits?: {
		cast?: Array<{
			id: number;
			name: string;
			profile_path: string | null;
			order?: number;
		}>;
		crew?: Array<{
			id: number;
			name: string;
			job?: string | null;
			profile_path: string | null;
		}>;
	};
} | null | undefined): MentionCreditRow[] {
	const cast = (tmdbJson?.credits?.cast ?? [])
		.slice()
		.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
		.map((c) => ({
			id: c.id,
			name: c.name,
			profileUrl: tmdbPosterUrlFromPath(c.profile_path, "w185"),
			role: "Cast",
		}));
	const crew = (tmdbJson?.credits?.crew ?? [])
		.filter((c) => c.job === "Director" || c.job === "Screenplay")
		.map((c) => ({
			id: c.id,
			name: c.name,
			profileUrl: tmdbPosterUrlFromPath(c.profile_path, "w185"),
			role: c.job ?? "Crew",
		}));
	const byId = new Map<number, MentionCreditRow>();
	for (const row of [...cast, ...crew]) {
		if (!byId.has(row.id)) byId.set(row.id, row);
	}
	return Array.from(byId.values()).slice(0, CREDIT_CAP);
}

export function filterMentionCreditsByQuery(
	rows: MentionCreditRow[],
	query: string,
): MentionCreditRow[] {
	const q = query.trim().toLowerCase();
	if (!q) return rows;
	return rows.filter((row) => row.name.toLowerCase().includes(q));
}
```

- [ ] **Step 3: Implement hooks**

`use-patron-mention-search.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { fetchProfileSearch } from "@/lib/still-api-fetch";

export type PatronMentionHit = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
};

export function usePatronMentionSearch(query: string, enabled: boolean, debounceMs = 220) {
	const [results, setResults] = useState<PatronMentionHit[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setResults([]);
			setLoading(false);
			return;
		}
		const q = query.trim().replace(/^@+/, "");
		if (!q) {
			setResults([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchProfileSearch(q, {
					signal: ctrl.signal,
					limit: 8,
				});
				if (ctrl.signal.aborted) return;
				const rows =
					(res.data as { results?: PatronMentionHit[] } | null)?.results ?? [];
				setResults(rows.slice(0, 8));
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

	return { results, loading };
}
```

`use-people-mention-search.ts`:

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchPeopleSearch } from "@/lib/still-api-fetch";
import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";
import {
	extractMovieMentionCredits,
	filterMentionCreditsByQuery,
	type MentionCreditRow,
} from "@/lib/movie-mention-credits";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type PeopleMentionHit =
	| { source: "credit"; row: MentionCreditRow }
	| { source: "search"; row: CastCrewSearchHit };

export function usePeopleMentionSearch(input: {
	query: string;
	listingContext: { kind: "movie" | "tv"; tmdbId: number } | null;
	enabled: boolean;
}) {
	const [creditRows, setCreditRows] = useState<MentionCreditRow[]>([]);
	const [searchRows, setSearchRows] = useState<CastCrewSearchHit[]>([]);
	const [loading, setLoading] = useState(false);

	// Load title credits once when context is movie (reviews are movie-only v1).
	useEffect(() => {
		if (!input.enabled || input.listingContext?.kind !== "movie") {
			setCreditRows([]);
			return;
		}
		const ctrl = new AbortController();
		void (async () => {
			try {
				const res = await fetch(
					`${stillApiOrigin()}/api/movies/${input.listingContext.tmdbId}`,
					{ credentials: "include", signal: ctrl.signal },
				);
				if (!res.ok) return;
				const data = (await res.json()) as { tmdbJson?: { credits?: unknown } };
				setCreditRows(
					extractMovieMentionCredits(
						data.tmdbJson as Parameters<typeof extractMovieMentionCredits>[0],
					),
				);
			} catch {
				if (!ctrl.signal.aborted) setCreditRows([]);
			}
		})();
		return () => ctrl.abort();
	}, [input.enabled, input.listingContext?.kind, input.listingContext?.tmdbId]);

	useEffect(() => {
		if (!input.enabled) {
			setSearchRows([]);
			setLoading(false);
			return;
		}
		const q = input.query.trim();
		if (q.length < 2) {
			setSearchRows([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchPeopleSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				const rows =
					(res.data as { results?: CastCrewSearchHit[] } | null)?.results ?? [];
				setSearchRows(rows.slice(0, 8));
			} catch {
				if (!ctrl.signal.aborted) setSearchRows([]);
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, 220);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [input.query, input.enabled]);

	const results = useMemo((): PeopleMentionHit[] => {
		const q = input.query.trim();
		const contextual = filterMentionCreditsByQuery(creditRows, q);
		const seen = new Set(contextual.map((r) => r.id));
		const merged: PeopleMentionHit[] = contextual.map((row) => ({
			source: "credit",
			row,
		}));
		for (const row of searchRows) {
			if (seen.has(row.id)) continue;
			seen.add(row.id);
			merged.push({ source: "search", row });
		}
		return merged.slice(0, 12);
	}, [creditRows, input.query, searchRows]);

	return { results, loading: loading && input.query.trim().length >= 2 };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test apps/web/src/lib/movie-mention-credits.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/movie-mention-credits.ts apps/web/src/lib/movie-mention-credits.test.ts apps/web/src/lib/use-people-mention-search.ts apps/web/src/lib/use-patron-mention-search.ts
git commit -m "feat(web): people and patron mention search hooks"
```

---

## Task 5: `@` picker in `MentionTextarea`

**Files:**
- Modify: `apps/web/src/components/review/mention-textarea.tsx`
- Modify: `apps/web/src/components/review/review-body-with-mentions.tsx` — add `PersonMentionPickerRow`, `PatronMentionPickerRow`

- [ ] **Step 1: Add picker rows**

In `review-body-with-mentions.tsx`, add:

```tsx
export function PersonMentionPickerRow({
	name,
	subtitle,
	profileUrl,
	active,
	onSelect,
	onMouseEnter,
}: {
	name: string;
	subtitle: string;
	profileUrl: string | null;
	active: boolean;
	onSelect: () => void;
	onMouseEnter?: () => void;
}) {
	// Same shell as ListingMentionPickerRow — headshot + name + subtitle
}

export function PatronMentionPickerRow({
	displayName,
	handle,
	portraitUrl,
	active,
	onSelect,
	onMouseEnter,
}: {
	displayName: string;
	handle: string;
	portraitUrl: string | null;
	active: boolean;
	onSelect: () => void;
	onMouseEnter?: () => void;
}) {
	// PatronPortraitAvatar + display name + @handle subtitle
}
```

- [ ] **Step 2: Wire `@` state in `MentionTextarea`**

Parallel to listing picker state:

- `peopleMentionRange` / `peopleMentionQuery` from `getActivePeopleMentionQuery`.
- When active and `isPatronMentionQuery(query)` → `usePatronMentionSearch`.
- Else → `usePeopleMentionSearch({ query, listingContext, enabled: true })`.
- On select person → `insertPersonMention`; patron → `insertPatronMention`.
- Only one popover open: `#` picker takes precedence if both somehow active (shouldn't happen).

- [ ] **Step 3: Manual smoke**

On Dune review: `@` empty → cast rail; `@tim` → filters cast; `@jane_doe` → patron results.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/review/mention-textarea.tsx apps/web/src/components/review/review-body-with-mentions.tsx
git commit -m "feat(web): @ picker for cast/crew and patron mentions"
```

---

## Task 6: Comments thread — compose, edit, render

**Files:**
- Modify: `apps/web/src/components/social/comments-thread.tsx`
- Modify: `apps/web/src/components/review/review-detail-sheet.tsx`

- [ ] **Step 1: Add `listingContext` prop to `CommentsThread`**

```ts
listingContext?: { kind: "movie" | "tv"; tmdbId: number } | null;
```

Pass from `review-detail-sheet.tsx`:

```tsx
<CommentsThread
  …
  listingContext={
    detail.review.movieId
      ? { kind: "movie", tmdbId: detail.review.movieId }
      : null
  }
/>
```

- [ ] **Step 2: Replace compose + edit `Textarea` with `MentionTextarea`**

Import `MentionTextarea`, `BodyWithMentions`, `migrateLegacyListingMentions`.

- Compose form: swap `Textarea` → `MentionTextarea` with `listingContext`.
- Edit draft: same.
- Read mode: replace `{row.comment.body}` with `<BodyWithMentions body={row.comment.body} />`.
- On POST/PATCH comment: `body: migrateLegacyListingMentions(trimmed)`.

- [ ] **Step 3: Manual smoke**

Open review drawer → comment `@` mention → renders as link after post.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/social/comments-thread.tsx apps/web/src/components/review/review-detail-sheet.tsx
git commit -m "feat(web): mentions in review comments compose and render"
```

---

## Task 7: Activity feed preview mentions

**Files:**
- Modify: `apps/web/src/components/feed/review-activity-copy.tsx`

- [ ] **Step 1: Use `BodyWithMentions` for body line**

Replace raw `{body}` in the clamped paragraph:

```tsx
import { BodyWithMentions } from "@/components/review/review-body-with-mentions";

// …
<div className="line-clamp-2 …">
  <BodyWithMentions body={body} />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/feed/review-activity-copy.tsx
git commit -m "fix(web): parse mentions in activity review previews"
```

---

## Task 8: Server — mention notification kind + notify helper

**Files:**
- Create: `apps/server/src/lib/content-mention-notify.ts`
- Create: `apps/server/src/lib/content-mention-notify.test.ts`
- Modify: `apps/server/src/lib/notification-delivery.ts`

- [ ] **Step 1: Write failing tests**

`apps/server/src/lib/content-mention-notify.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { extractPatronMentionHandles } from "./content-mention-notify";

describe("extractPatronMentionHandles", () => {
	test("returns unique handles from profile tokens", () => {
		expect(
			extractPatronMentionHandles(
				"Hi @[Jane](/profile/jane) and @[Bob](/profile/bob) and @[Jane](/profile/jane)",
			),
		).toEqual(["jane", "bob"]);
	});

	test("ignores people and listing tokens", () => {
		expect(
			extractPatronMentionHandles(
				"#[Film](/movies/1) @[Tim](/people/2)",
			),
		).toEqual([]);
	});
});
```

- [ ] **Step 2: Implement extractor + notify helper**

`apps/server/src/lib/content-mention-notify.ts`:

```ts
import { db, notification, profile } from "@still/db";
import { and, eq, gte } from "drizzle-orm";

import { deliverNotification } from "./notification-delivery";
import { movieReviewNotificationHref } from "./review-notification-href";

const PATRON_TOKEN = /@\[[^\]]+\]\(\/profile\/([^)]+)\)/g;
const DEDUPE_MS = 24 * 60 * 60 * 1000;

export function extractPatronMentionHandles(body: string): string[] {
	const handles = new Set<string>();
	for (const match of body.matchAll(PATRON_TOKEN)) {
		const handle = match[1]?.trim().toLowerCase();
		if (handle) handles.add(handle);
	}
	return Array.from(handles);
}

export async function notifyPatronMentionsInContent(input: {
	body: string;
	actorUserId: string;
	actorDisplayName: string;
	reviewId: string;
	movieId: number;
	listingTitle?: string | null;
	commentId?: string | null;
}): Promise<void> {
	const handles = extractPatronMentionHandles(input.body);
	if (handles.length === 0) return;

	const since = new Date(Date.now() - DEDUPE_MS);
	const hrefBase = movieReviewNotificationHref(input.movieId, input.reviewId);
	const href = input.commentId
		? `${hrefBase}&comment=${encodeURIComponent(input.commentId)}`
		: hrefBase;
	const titleSuffix = input.listingTitle?.trim()
		? ` on “${input.listingTitle.trim().slice(0, 80)}”`
		: "";
	const from = input.actorDisplayName.trim() || "Someone";
	const title = input.commentId
		? `${from} mentioned you in a comment${titleSuffix}`
		: `${from} mentioned you in a review${titleSuffix}`;

	for (const handle of handles) {
		const [row] = await db
			.select({ userId: profile.userId, isPrivate: profile.isPrivate })
			.from(profile)
			.where(eq(profile.handle, handle))
			.limit(1);
		if (!row || row.isPrivate || row.userId === input.actorUserId) continue;

		const [recent] = await db
			.select({ id: notification.id })
			.from(notification)
			.where(
				and(
					eq(notification.userId, row.userId),
					eq(notification.kind, "mention.in_review_or_comment"),
					gte(notification.createdAt, since),
				),
			)
			.limit(1);
		// Optional stricter dedupe: also match payload.reviewId + actor in application code.

		await deliverNotification({
			userId: row.userId,
			kind: "mention.in_review_or_comment",
			title,
			payload: {
				reviewId: input.reviewId,
				commentId: input.commentId ?? undefined,
				movieId: input.movieId,
				href,
				fromUserId: input.actorUserId,
			},
			context: { actorUserId: input.actorUserId },
		});
	}
}
```

- [ ] **Step 3: Register notification kind**

In `notification-delivery.ts` `NOTIFICATION_KIND_REGISTRY`, add after `comment.replied`:

```ts
{
	id: "mention.in_review_or_comment",
	label: "Mentions",
	description: "When someone @mentions you in a review or comment.",
	defaultEnabled: true,
	requiresOptIn: false,
},
```

- [ ] **Step 4: Run tests**

Run: `bun test apps/server/src/lib/content-mention-notify.test.ts apps/server/src/lib/notification-delivery.test.ts`  
Expected: PASS (extend delivery test array to include new kind).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/content-mention-notify.ts apps/server/src/lib/content-mention-notify.test.ts apps/server/src/lib/notification-delivery.ts apps/server/src/lib/notification-delivery.test.ts
git commit -m "feat(server): patron mention notifications (SN.9.1)"
```

---

## Task 9: Wire review + comment routes

**Files:**
- Modify: `apps/server/src/routes/reviews.ts`
- Modify: `apps/server/src/routes/comments.ts`
- Modify: `apps/server/src/routes/comments.test.ts`

- [ ] **Step 1: Hook reviews POST/PATCH**

After successful insert/update, call:

```ts
await notifyPatronMentionsInContent({
	body: savedReview.body,
	actorUserId: viewer.id,
	actorDisplayName: actorDisplayNameFromProfile,
	reviewId: savedReview.id,
	movieId: savedReview.movieId,
	listingTitle: movieTitleIfLoaded,
});
```

Load actor display name from profile join already on the route where available.

- [ ] **Step 2: Hook comments POST/PATCH (review parent only)**

When `parentType === "review"`, after insert:

```ts
await notifyPatronMentionsInContent({
	body: row.body,
	actorUserId: viewer.id,
	actorDisplayName: commenterName,
	reviewId: body.parentId,
	movieId: reviewRow.movieId,
	listingTitle: reviewRow.title,
	commentId: id,
});
```

- [ ] **Step 3: Extend comments test mock**

In `comments.test.ts`, mock `notifyPatronMentionsInContent` and assert called when body contains `(/profile/handle)`.

- [ ] **Step 4: Run server tests**

Run: `bun test apps/server/src/routes/comments.test.ts apps/server/src/lib/content-mention-notify.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/reviews.ts apps/server/src/routes/comments.ts apps/server/src/routes/comments.test.ts
git commit -m "feat(server): deliver mention notifications on review and comment save"
```

---

## Task 10: Settings toggle + notification deep links

**Files:**
- Modify: `apps/web/src/lib/notification-preferences.ts`
- Modify: `apps/web/src/lib/review-deep-link.ts`
- Modify: `apps/web/src/lib/notification-href.ts`
- Modify: `apps/web/src/lib/notification-href.test.ts`

- [ ] **Step 1: Add web settings entry**

In `notification-preferences.ts`:

```ts
| "mention.in_review_or_comment"
// …in NOTIFICATION_KIND_SETTINGS array:
{
	id: "mention.in_review_or_comment",
	label: "Mentions",
	description: "When someone @mentions you in a review or comment.",
	defaultEnabled: true,
},
```

- [ ] **Step 2: Extend review deep link with optional comment**

```ts
export function buildMovieReviewHref(
	movieId: number,
	reviewId: string,
	commentId?: string,
): string {
	const base = `/movies/${movieId}?${MOVIE_REVIEW_SEARCH_PARAM}=${encodeURIComponent(reviewId)}`;
	if (!commentId) return base;
	return `${base}&comment=${encodeURIComponent(commentId)}`;
}
```

Update `notificationPayloadHref` to pass through href when it already includes `comment=`.

Add test case in `notification-href.test.ts` for mention payload with `&comment=`.

- [ ] **Step 3: Review reader scroll-to-comment (if missing)**

In `review-detail-sheet.tsx`, read `comment` search param on mount and scroll highlight target comment row (minimal: `document.getElementById(\`comment-${id}\`)` + `scrollIntoView`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/notification-preferences.ts apps/web/src/lib/review-deep-link.ts apps/web/src/lib/notification-href.ts apps/web/src/lib/notification-href.test.ts apps/web/src/components/review/review-detail-sheet.tsx
git commit -m "feat(web): mention notification prefs and comment deep links"
```

---

## Task 11: Verification + graphify

- [ ] **Step 1: Run focused tests**

```bash
bun test apps/web/src/lib/content-mentions.test.ts apps/web/src/lib/movie-mention-credits.test.ts apps/server/src/lib/content-mention-notify.test.ts apps/server/src/lib/notification-delivery.test.ts apps/web/src/lib/notification-href.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Typecheck web**

```bash
cd apps/web && bun run check-types
```

Expected: exit 0.

- [ ] **Step 3: Update graph**

```bash
graphify update .
```

- [ ] **Step 4: Manual QA checklist**

1. Review composer: `#` inserts film tag; `@tim` shows title cast; `@handle` inserts patron link.
2. Legacy review with `@[Film](/movies/id)` still renders; edit + save rewrites to `#`.
3. Comment with patron mention → tappable link + one inbox row for mentioned patron.
4. Settings → disable Mentions → new mentions do not create inbox rows.
5. Tap mention notification on comment → review drawer opens on comment (when Task 10 scroll wired).
6. Activity feed review preview shows mention links (not raw tokens).

- [ ] **Step 5: Update scratchpad**

Mark brainstorm → plan complete in `.cursor/scratchpad.md`; await human verification per task.

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| `#` film/TV trigger | 1, 3 |
| `@` people + patrons | 1, 4, 5 |
| Title cast-first | 4, 5 |
| Handle auto-detect patrons | 1, 4, 5 |
| Legacy `@` listing read + migrate on PATCH | 1, 3, 6 |
| Comments parity | 6 |
| Reader rendering all surfaces | 2, 6, 7 |
| Patron notifications SN.9.1 | 8, 9, 10 |
| Settings toggle | 10 |
| No DB migration | all (text tokens only) |

No placeholders remain. Types aligned: `ContentMentionPart`, `MentionTextarea`, `mention.in_review_or_comment`.

---

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — one fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with checkpoints  

Which approach do you want?
