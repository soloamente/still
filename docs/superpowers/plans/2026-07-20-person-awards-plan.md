# Person awards on `/people/[id]` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Wikidata awards/nominations on person About as a top-3 wins teaser plus a View-all drawer with work deep links.

**Architecture:** RSC fetches person awards from Wikidata (soft-fail, 24h revalidate), normalizes into `PersonAwardRow`, sorts wins-first, and renders a person-only teaser + Vaul drawer. Reuse `FestivalRecognitionIcon` and export a thin icon resolver from `movie-festival-recognition.ts` — do not overload `MoviePremieresFestivals`.

**Tech Stack:** Next.js App Router (RSC), Wikidata SPARQL, Bun `bun:test`, existing `DetailVaulSheet` / festival icons.

**Spec:** `docs/superpowers/specs/2026-07-20-person-awards-design.md`

## Global Constraints

- About only — no new top-bar Awards tab.
- Teaser: up to **3 wins**; nominations muted in drawer; wins listed first.
- Soft-fail: Wikidata timeout/error → omit awards chrome (hero/stills still render).
- Work links only when TMDb movie (`P4947`) or TV (`P4983`) id exists.
- Drawer hard cap **100** rows after sort/dedupe.
- Prefer surface depth tokens; no decorative borders/rings on award rows.
- Do not put full awards on every `GET /api/people/:id` consumer (optional `imdbId` only).

---

## File Structure

**Web — lib**
- Modify `apps/web/src/lib/movie-festival-recognition.ts` — export `resolveFestivalIconFromAwardLabel` + `festivalIconPrestigeRank`.
- Create `apps/web/src/lib/wikidata-person-awards.ts` — SPARQL fetch + raw normalize.
- Create `apps/web/src/lib/wikidata-person-awards.test.ts`
- Create `apps/web/src/lib/person-awards.ts` — `PersonAwardRow`, sort, teaser, work href, build from Wikidata rows.
- Create `apps/web/src/lib/person-awards.test.ts`

**Web — components**
- Create `apps/web/src/components/people/person-awards-drawer.tsx` — full list drawer.
- Create `apps/web/src/components/people/person-awards-section.tsx` — About teaser + drawer trigger.
- Create `apps/web/src/components/people/person-awards-async.tsx` — RSC async child for Suspense-friendly fetch.

**Web — page**
- Modify `apps/web/src/app/(app)/people/[id]/page.tsx` — mount awards after stills.

**Server (optional but recommended in Task 4)**
- Modify `apps/server/src/lib/tmdb.ts` — append `external_ids` on person fetch.
- Modify `apps/server/src/routes/people.ts` — return `person.imdbId`.

---

### Task 1: Export festival icon helpers

**Files:**
- Modify: `apps/web/src/lib/movie-festival-recognition.ts`
- Test: `apps/web/src/lib/movie-festival-recognition-person.test.ts` (new, focused)

**Interfaces:**
- Produces: `resolveFestivalIconFromAwardLabel(label: string): FestivalIconId`
- Produces: `festivalIconPrestigeRank(icon: FestivalIconId): number` (lower = higher prestige; unknown/`award` last)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "bun:test";

import {
	festivalIconPrestigeRank,
	resolveFestivalIconFromAwardLabel,
} from "./movie-festival-recognition";

describe("resolveFestivalIconFromAwardLabel", () => {
	test("maps Oscars and BAFTA labels", () => {
		expect(resolveFestivalIconFromAwardLabel("Academy Award for Best Actor")).toBe(
			"oscars",
		);
		expect(resolveFestivalIconFromAwardLabel("BAFTA Award for Best Direction")).toBe(
			"bafta",
		);
	});

	test("falls back to generic award", () => {
		expect(resolveFestivalIconFromAwardLabel("Obscure Critics Prize")).toBe(
			"award",
		);
	});
});

describe("festivalIconPrestigeRank", () => {
	test("oscars rank above generic award", () => {
		expect(festivalIconPrestigeRank("oscars")).toBeLessThan(
			festivalIconPrestigeRank("award"),
		);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun test src/lib/movie-festival-recognition-person.test.ts`

Expected: FAIL — exports missing

- [ ] **Step 3: Export helpers**

In `movie-festival-recognition.ts`, after `matchRule`:

```ts
/** Map a free-text award label to a festival/award icon id (person + film). */
export function resolveFestivalIconFromAwardLabel(
	label: string,
): FestivalIconId {
	return matchRule(label)?.id ?? "award";
}

/**
 * Lower rank = higher prestige. Uses `FESTIVAL_RULES` order; generic
 * `award` / `premiere` sort after every named festival.
 */
export function festivalIconPrestigeRank(icon: FestivalIconId): number {
	const index = FESTIVAL_RULES.findIndex((rule) => rule.id === icon);
	if (index >= 0) return index;
	if (icon === "premiere") return FESTIVAL_RULES.length;
	return FESTIVAL_RULES.length + 1; // award / unknown
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && bun test src/lib/movie-festival-recognition-person.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/movie-festival-recognition.ts apps/web/src/lib/movie-festival-recognition-person.test.ts
git commit -m "feat: export festival icon helpers for person awards"
```

---

### Task 2: Wikidata person awards fetch + normalize

**Files:**
- Create: `apps/web/src/lib/wikidata-person-awards.ts`
- Create: `apps/web/src/lib/wikidata-person-awards.test.ts`

**Interfaces:**
- Consumes: none from Task 1 (raw rows only)
- Produces:
  - `WikidataPersonAwardRaw` type
  - `normalizeWikidataPersonAwardBindings(bindings): WikidataPersonAwardRaw[]` (pure, tested)
  - `fetchWikidataPersonAwards({ tmdbPersonId, imdbId? }): Promise<WikidataPersonAwardRaw[]>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "bun:test";

import { normalizeWikidataPersonAwardBindings } from "./wikidata-person-awards";

describe("normalizeWikidataPersonAwardBindings", () => {
	test("maps won row with movie work + year", () => {
		const rows = normalizeWikidataPersonAwardBindings([
			{
				awardLabel: { value: "Academy Award for Best Actor" },
				status: { value: "won" },
				year: { value: "1995-01-01T00:00:00Z" },
				workLabel: { value: "Forrest Gump" },
				workTmdbMovie: { value: "13" },
			},
		]);
		expect(rows).toEqual([
			{
				awardLabel: "Academy Award for Best Actor",
				status: "won",
				year: 1995,
				workTitle: "Forrest Gump",
				workTmdbId: 13,
				workMediaKind: "movie",
			},
		]);
	});

	test("prefers TV TMDb id and skips invalid status", () => {
		const rows = normalizeWikidataPersonAwardBindings([
			{
				awardLabel: { value: "Emmy Award" },
				status: { value: "nominated" },
				workLabel: { value: "Chernobyl" },
				workTmdbTv: { value: "87108" },
			},
			{
				awardLabel: { value: "Junk" },
				status: { value: "maybe" },
			},
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			status: "nominated",
			workTmdbId: 87108,
			workMediaKind: "tv",
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun test src/lib/wikidata-person-awards.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Implement fetch + normalize**

Create `wikidata-person-awards.ts` mirroring `wikidata-movie-awards.ts`:

- `USER_AGENT = "Sense/1.0 (person detail; +https://github.com)"`
- SPARQL resolve person: `{ ?person wdt:P4985 "${tmdbPersonId}" . }` plus optional `UNION { ?person wdt:P345 "${imdbId}" . }`
- Won: `p:P166` / nominated: `p:P1411`
- Optional `pq:P585 ?year`, `pq:P1686 ?work`, `?work wdt:P4947 ?workTmdbMovie`, `?work wdt:P4983 ?workTmdbTv`
- Labels via `SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }` selecting `?awardLabel` `?workLabel`
- `fetch`: 5s timeout, `next: { revalidate: 60 * 60 * 24 }`, return `[]` on error
- Export pure `normalizeWikidataPersonAwardBindings` used by fetch
- Dedupe key: `${status}|${awardLabel}|${year}|${workTitle}|${workTmdbId}` — keep `won` over `nominated` when otherwise equal

Example query builder (include in file):

```ts
function buildPersonAwardsQuery(
	tmdbPersonId: number,
	imdbId: string | null,
): string {
	const imdbFilter = imdbId
		? `UNION { ?person wdt:P345 "${imdbId}" . }`
		: "";
	return `
SELECT ?awardLabel ?status ?year ?workLabel ?workTmdbMovie ?workTmdbTv WHERE {
  { ?person wdt:P4985 "${tmdbPersonId}" . }
  ${imdbFilter}
  {
    ?person p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    BIND("won" AS ?status)
    OPTIONAL { ?stmt pq:P585 ?year }
    OPTIONAL {
      ?stmt pq:P1686 ?work .
      OPTIONAL { ?work wdt:P4947 ?workTmdbMovie }
      OPTIONAL { ?work wdt:P4983 ?workTmdbTv }
    }
  } UNION {
    ?person p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    BIND("nominated" AS ?status)
    OPTIONAL { ?stmt pq:P585 ?year }
    OPTIONAL {
      ?stmt pq:P1686 ?work .
      OPTIONAL { ?work wdt:P4947 ?workTmdbMovie }
      OPTIONAL { ?work wdt:P4983 ?workTmdbTv }
    }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`.trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && bun test src/lib/wikidata-person-awards.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/wikidata-person-awards.ts apps/web/src/lib/wikidata-person-awards.test.ts
git commit -m "feat: fetch Wikidata awards for TMDb people"
```

---

### Task 3: `person-awards` sort, teaser, work href

**Files:**
- Create: `apps/web/src/lib/person-awards.ts`
- Create: `apps/web/src/lib/person-awards.test.ts`

**Interfaces:**
- Consumes: `WikidataPersonAwardRaw` from Task 2; icon helpers from Task 1
- Produces:
  - `PersonAwardRow` type (as in spec)
  - `PERSON_AWARDS_TEASER_MAX = 3`
  - `PERSON_AWARDS_DRAWER_MAX = 100`
  - `buildPersonAwardRows(raw: WikidataPersonAwardRaw[]): PersonAwardRow[]`
  - `pickPersonAwardTeaserWins(rows: PersonAwardRow[]): PersonAwardRow[]`
  - `personAwardWorkHref(row: PersonAwardRow): string | null`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "bun:test";

import {
	buildPersonAwardRows,
	personAwardWorkHref,
	pickPersonAwardTeaserWins,
} from "./person-awards";

describe("buildPersonAwardRows", () => {
	test("sorts wins before nominations, prestige then year desc", () => {
		const rows = buildPersonAwardRows([
			{
				awardLabel: "Critics Choice",
				status: "won",
				year: 2020,
				workTitle: null,
				workTmdbId: null,
				workMediaKind: null,
			},
			{
				awardLabel: "Academy Award for Best Actor",
				status: "won",
				year: 1995,
				workTitle: "Forrest Gump",
				workTmdbId: 13,
				workMediaKind: "movie",
			},
			{
				awardLabel: "Academy Award for Best Actor",
				status: "nominated",
				year: 2001,
				workTitle: "Cast Away",
				workTmdbId: 8358,
				workMediaKind: "movie",
			},
		]);
		expect(rows.map((r) => r.status)).toEqual(["won", "won", "nominated"]);
		expect(rows[0]?.icon).toBe("oscars");
		expect(rows[0]?.year).toBe(1995);
	});
});

describe("pickPersonAwardTeaserWins", () => {
	test("returns at most three wins and ignores nominations", () => {
		const rows = buildPersonAwardRows([
			{
				awardLabel: "Academy Award for Best Actor",
				status: "won",
				year: 1995,
				workTitle: "A",
				workTmdbId: 1,
				workMediaKind: "movie",
			},
			{
				awardLabel: "BAFTA Award",
				status: "won",
				year: 1995,
				workTitle: "B",
				workTmdbId: 2,
				workMediaKind: "movie",
			},
			{
				awardLabel: "Golden Globe",
				status: "won",
				year: 1995,
				workTitle: "C",
				workTmdbId: 3,
				workMediaKind: "movie",
			},
			{
				awardLabel: "SAG Award",
				status: "won",
				year: 1994,
				workTitle: "D",
				workTmdbId: 4,
				workMediaKind: "movie",
			},
			{
				awardLabel: "Oscar",
				status: "nominated",
				year: 2001,
				workTitle: "E",
				workTmdbId: 5,
				workMediaKind: "movie",
			},
		]);
		const teaser = pickPersonAwardTeaserWins(rows);
		expect(teaser).toHaveLength(3);
		expect(teaser.every((r) => r.status === "won")).toBe(true);
	});
});

describe("personAwardWorkHref", () => {
	test("builds movie and tv hrefs", () => {
		expect(
			personAwardWorkHref({
				id: "1",
				awardLabel: "x",
				status: "won",
				year: 2000,
				workTitle: "Film",
				workTmdbId: 13,
				workMediaKind: "movie",
				icon: "oscars",
			}),
		).toBe("/movies/13");
		expect(
			personAwardWorkHref({
				id: "2",
				awardLabel: "x",
				status: "won",
				year: 2000,
				workTitle: "Show",
				workTmdbId: 87108,
				workMediaKind: "tv",
				icon: "award",
			}),
		).toBe("/tv/87108");
		expect(
			personAwardWorkHref({
				id: "3",
				awardLabel: "x",
				status: "won",
				year: null,
				workTitle: "Unknown",
				workTmdbId: null,
				workMediaKind: null,
				icon: "award",
			}),
		).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun test src/lib/person-awards.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Implement `person-awards.ts`**

```ts
import type { FestivalIconId } from "@/lib/movie-festival-recognition";
import {
	festivalIconPrestigeRank,
	resolveFestivalIconFromAwardLabel,
} from "@/lib/movie-festival-recognition";
import type { WikidataPersonAwardRaw } from "@/lib/wikidata-person-awards";

export const PERSON_AWARDS_TEASER_MAX = 3;
export const PERSON_AWARDS_DRAWER_MAX = 100;

export type PersonAwardRow = {
	id: string;
	awardLabel: string;
	status: "won" | "nominated";
	year: number | null;
	workTitle: string | null;
	workTmdbId: number | null;
	workMediaKind: "movie" | "tv" | null;
	icon: FestivalIconId;
};

export function buildPersonAwardRows(
	raw: WikidataPersonAwardRaw[],
): PersonAwardRow[] {
	const rows: PersonAwardRow[] = raw.map((item, index) => ({
		id: [
			item.status,
			item.awardLabel,
			item.year ?? "na",
			item.workTitle ?? "na",
			item.workTmdbId ?? "na",
			index,
		].join("|"),
		awardLabel: item.awardLabel,
		status: item.status,
		year: item.year,
		workTitle: item.workTitle,
		workTmdbId: item.workTmdbId,
		workMediaKind: item.workMediaKind,
		icon: resolveFestivalIconFromAwardLabel(item.awardLabel),
	}));

	rows.sort((a, b) => {
		if (a.status !== b.status) return a.status === "won" ? -1 : 1;
		const prestige =
			festivalIconPrestigeRank(a.icon) - festivalIconPrestigeRank(b.icon);
		if (prestige !== 0) return prestige;
		const ay = a.year ?? -1;
		const by = b.year ?? -1;
		if (ay !== by) return by - ay;
		const labelCmp = a.awardLabel.localeCompare(b.awardLabel);
		if (labelCmp !== 0) return labelCmp;
		return (a.workTitle ?? "").localeCompare(b.workTitle ?? "");
	});

	return rows.slice(0, PERSON_AWARDS_DRAWER_MAX);
}

export function pickPersonAwardTeaserWins(
	rows: PersonAwardRow[],
): PersonAwardRow[] {
	return rows
		.filter((row) => row.status === "won")
		.slice(0, PERSON_AWARDS_TEASER_MAX);
}

export function personAwardWorkHref(row: PersonAwardRow): string | null {
	if (row.workTmdbId == null || row.workMediaKind == null) return null;
	if (row.workMediaKind === "movie") return `/movies/${row.workTmdbId}`;
	if (row.workMediaKind === "tv") return `/tv/${row.workTmdbId}`;
	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && bun test src/lib/person-awards.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/person-awards.ts apps/web/src/lib/person-awards.test.ts
git commit -m "feat: sort and teaser helpers for person awards"
```

---

### Task 4: Optional `imdbId` on person API

**Files:**
- Modify: `apps/server/src/lib/tmdb.ts` (`TmdbPersonDetail` + `person()` append)
- Modify: `apps/server/src/routes/people.ts`

**Interfaces:**
- Produces: `person.imdbId: string | null` on `GET /api/people/:id`

- [ ] **Step 1: Extend TMDb person type + append**

In `TmdbPersonDetail` add:

```ts
external_ids?: {
	imdb_id?: string | null;
};
```

Change `append_to_response` to include `external_ids` (keep existing `movie_credits,tv_credits,images,tagged_images`).

- [ ] **Step 2: Return imdbId from people route**

In the `person` object of the `/:id` handler:

```ts
imdbId: p.external_ids?.imdb_id?.trim() || null,
```

- [ ] **Step 3: Smoke-check types**

Run: `cd apps/server && bun test src/lib/person-gallery-slides.test.ts`

Expected: PASS (no regressions). Manually confirm person JSON includes `imdbId` when restarting API if convenient.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/tmdb.ts apps/server/src/routes/people.ts
git commit -m "feat: expose person imdbId for Wikidata award lookup"
```

---

### Task 5: `PersonAwardsDrawer`

**Files:**
- Create: `apps/web/src/components/people/person-awards-drawer.tsx`

**Interfaces:**
- Consumes: `PersonAwardRow`, `personAwardWorkHref`
- Produces: `PersonAwardsDrawer` client component with trigger slot or built-in trigger button

- [ ] **Step 1: Implement drawer**

Mirror `MovieAwardsViewAllDrawer` structure (`DetailVaulSheet`, `DetailDrawerScrollBody`, `SheetScrollScrims`, `useSheetScrollFades`).

Props:

```ts
{
  personName: string;
  rows: PersonAwardRow[];
  /** When true, trigger uses muted “View all awards” (noms-only teaser). */
  mutedTrigger?: boolean;
}
```

Body layout:

1. Split `wins = rows.filter(r => r.status === "won")`, `noms = rows.filter(r => r.status === "nominated")`
2. Render wins list with normal `text-foreground`
3. Nominations in a second block with `text-muted-foreground`
4. Each row: `FestivalRecognitionIcon` + award label + year line + status word + work (`Link` if `personAwardWorkHref` else plain span)
5. No borders/rings; `rounded-2xl bg-background` row tiles on `bg-card` sheet if grouping needed — prefer flat stacked rows with generous gap (match community feed flat tiles)

Trigger button copy: **View all awards**; apply muted styles when `mutedTrigger`.

- [ ] **Step 2: Manual lint check**

Run: open file in IDE / `ReadLints` on the new file — fix issues.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/people/person-awards-drawer.tsx
git commit -m "feat: person awards view-all drawer"
```

---

### Task 6: `PersonAwardsSection` teaser

**Files:**
- Create: `apps/web/src/components/people/person-awards-section.tsx`

**Interfaces:**
- Consumes: `PersonAwardRow`, `pickPersonAwardTeaserWins`, `personAwardWorkHref`, `PersonAwardsDrawer`
- Produces: `PersonAwardsSection({ personName, rows })` — returns `null` if `rows.length === 0`

- [ ] **Step 1: Implement section**

```tsx
// Pseudocode structure — implement fully in TSX
export function PersonAwardsSection({
  personName,
  rows,
}: {
  personName: string;
  rows: PersonAwardRow[];
}) {
  if (rows.length === 0) return null;
  const teaserWins = pickPersonAwardTeaserWins(rows);
  const nominationsOnly = teaserWins.length === 0;
  const showViewAll =
    nominationsOnly || rows.length > teaserWins.length || rows.some((r) => r.status === "nominated");

  return (
    <section aria-label="Awards" className="…">
      <h2>Awards</h2>
      {teaserWins.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-…">
          {teaserWins.map((row) => (
            <li key={row.id}>
              <FestivalRecognitionIcon id={row.icon} />
              <p>{row.awardLabel}</p>
              {/* year + work link lines, text-balance */}
            </li>
          ))}
        </ul>
      ) : null}
      {showViewAll ? (
        <div className="mt-… flex justify-center">
          <PersonAwardsDrawer
            personName={personName}
            rows={rows}
            mutedTrigger={nominationsOnly}
          />
        </div>
      ) : null}
    </section>
  );
}
```

Use `MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME` or matching centered spacing. Title **Awards** (not “Awards & festivals”).

When there is exactly one win and zero nominations, still show the single tile; View all only if `rows.length > teaserWins.length` or nominations exist — for a single win with no noms, View all may be omitted (drawer redundant). Spec: “View all when there are more rows than the teaser shows, or nominations-only” — honour that.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/people/person-awards-section.tsx
git commit -m "feat: person awards About teaser section"
```

---

### Task 7: RSC async fetch + wire person page

**Files:**
- Create: `apps/web/src/components/people/person-awards-async.tsx`
- Modify: `apps/web/src/app/(app)/people/[id]/page.tsx`

**Interfaces:**
- Consumes: `fetchWikidataPersonAwards`, `buildPersonAwardRows`, `PersonAwardsSection`
- Produces: `PersonAwardsAsync({ tmdbPersonId, imdbId, personName })` async server component

- [ ] **Step 1: Create async child**

```tsx
import { PersonAwardsSection } from "@/components/people/person-awards-section";
import { buildPersonAwardRows } from "@/lib/person-awards";
import { MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME } from "@/lib/movie-detail-sections";
import { fetchWikidataPersonAwards } from "@/lib/wikidata-person-awards";

export async function PersonAwardsAsync({
	tmdbPersonId,
	imdbId,
	personName,
}: {
	tmdbPersonId: number;
	imdbId: string | null;
	personName: string;
}) {
	const raw = await fetchWikidataPersonAwards({
		tmdbPersonId,
		imdbId,
	});
	const rows = buildPersonAwardRows(raw);
	if (rows.length === 0) return null;
	return (
		<div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>
			<PersonAwardsSection personName={personName} rows={rows} />
		</div>
	);
}
```

- [ ] **Step 2: Wire page About**

In `people/[id]/page.tsx`:

1. Extend `PersonPayload.person` with optional `imdbId?: string | null`
2. After stills block inside `about={<>…</>}`:

```tsx
<Suspense fallback={null}>
  <PersonAwardsAsync
    tmdbPersonId={person.id}
    imdbId={person.imdbId ?? null}
    personName={person.name}
  />
</Suspense>
```

Import `Suspense` from `react`.

- [ ] **Step 3: Focused tests still pass**

Run:

```bash
cd apps/web && bun test src/lib/person-awards.test.ts src/lib/wikidata-person-awards.test.ts src/lib/movie-festival-recognition-person.test.ts
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/people/person-awards-async.tsx apps/web/src/app/(app)/people/[id]/page.tsx
git commit -m "feat: show Wikidata awards on person About"
```

---

### Task 8: Manual verification + scratchpad

**Files:**
- Modify: `.cursor/scratchpad.md` (Executor status)

- [ ] **Step 1: Manual QA checklist**

1. `/people/1892` (or another richly awarded person) About — teaser ≤3 wins after stills; View all lists wins then muted noms; work links open Sense titles when resolvable.
2. Person with nominations only — muted View all, no win tiles.
3. Person with no Wikidata awards — no awards chrome.
4. With network blocked / Wikidata fail — hero + stills still render.

- [ ] **Step 2: Update scratchpad**

Mark person awards plan Tasks 1–7 done; note manual QA awaiting human `ok`.

- [ ] **Step 3: Commit scratchpad only if the team usually commits it; otherwise leave unstaged**

Prefer not committing scratchpad unless already tracked as part of the workflow.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| About placement after stills | 7 |
| Top 3 wins teaser | 3, 6 |
| View all drawer | 5, 6 |
| Wins + noms, noms muted | 3, 5 |
| Work title + Sense link | 2, 3, 5, 6 |
| Wikidata P166/P1411/P1686 + soft-fail | 2 |
| Optional imdbId | 4 |
| No new tab / no MoviePremieresFestivals reuse | 5–7 |
| Drawer cap 100 | 3 |
| Unit tests sort/teaser/href/normalize | 1–3 |
| Manual QA | 8 |

## Placeholder / consistency self-review

- No TBD steps; types `PersonAwardRow` / `WikidataPersonAwardRaw` named consistently across tasks.
- Prestige uses exported `festivalIconPrestigeRank` (Task 1) in Task 3 sort.
- `imdbId` optional — awards still work with TMDb person id alone via P4985.
