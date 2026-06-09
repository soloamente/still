# Letterboxd Extended Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `POST /api/import/letterboxd` so one multi-file upload imports diary, watchlist, reviews, and liked films with merge-on-reimport rules and per-category counts in the API + Settings UI.

**Architecture:** New CSV parsers per file type, shared parse helpers, and a `letterboxd-import-apply.ts` orchestrator (mirrors `anilist-import-apply.ts`) that runs phases in order: diary → reviews → likes → watchlist. `import.ts` keeps auth, rate limit, multipart validation, and side effects (notification, badge, product event, taste recompute).

**Tech Stack:** Bun, Elysia, Drizzle (Neon HTTP — no transactions), `bun:test`, Next.js client component `me-letterboxd-import.tsx`, existing `syncFavoritesListForUserTitle`, `ensureMovieCached`, `tmdbApi`.

**Spec:** `docs/superpowers/specs/2026-06-09-letterboxd-extended-import-design.md`

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `apps/server/src/lib/letterboxd-csv-parse.ts` | Create | Shared `parseCsvLine`, `headerIndex`, `parseRating`, `parseDate` |
| `apps/server/src/lib/letterboxd-csv.ts` | Modify | Re-export shared parse helpers; diary/ratings unchanged API |
| `apps/server/src/lib/letterboxd-file-classifier.ts` | Create | `classifyLetterboxdFileName`, `hasRecognizedLetterboxdFile` |
| `apps/server/src/lib/letterboxd-watchlist-csv.ts` | Create | Parse `watchlist.csv` rows |
| `apps/server/src/lib/letterboxd-reviews-csv.ts` | Create | Parse `reviews.csv` + `stripLetterboxdReviewHtml` |
| `apps/server/src/lib/letterboxd-likes-csv.ts` | Create | Parse `films.csv` (likes) rows |
| `apps/server/src/lib/letterboxd-tmdb-resolve.ts` | Create | `resolveLetterboxdMovieTmdbId(name, year)` — DB cache + TMDb search |
| `apps/server/src/lib/letterboxd-import-log-resolve.ts` | Create | Title match key, find/create minimal log, rating fill |
| `apps/server/src/lib/letterboxd-import-apply.ts` | Create | Orchestrator + result types |
| `apps/server/src/routes/import.ts` | Modify | Thin delegate to apply + extended response |
| `apps/web/src/components/profile/me-letterboxd-import.tsx` | Modify | Five-file checklist, gate, result panel |

---

### Task 1: Shared CSV parse helpers + filename classifier

**Files:**
- Create: `apps/server/src/lib/letterboxd-csv-parse.ts`
- Create: `apps/server/src/lib/letterboxd-file-classifier.ts`
- Create: `apps/server/src/lib/letterboxd-file-classifier.test.ts`
- Modify: `apps/server/src/lib/letterboxd-csv.ts`

- [ ] **Step 1: Write failing classifier tests**

Create `apps/server/src/lib/letterboxd-file-classifier.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
	classifyLetterboxdFileName,
	hasRecognizedLetterboxdFile,
} from "./letterboxd-file-classifier";

describe("classifyLetterboxdFileName", () => {
	test("maps known export filenames case-insensitively", () => {
		expect(classifyLetterboxdFileName("diary.csv")).toBe("diary");
		expect(classifyLetterboxdFileName("DIARY.CSV")).toBe("diary");
		expect(classifyLetterboxdFileName("watchlist.csv")).toBe("watchlist");
		expect(classifyLetterboxdFileName("reviews.csv")).toBe("reviews");
		expect(classifyLetterboxdFileName("films.csv")).toBe("likes");
		expect(classifyLetterboxdFileName("ratings.csv")).toBe("ratings");
	});

	test("ignores unknown csv", () => {
		expect(classifyLetterboxdFileName("comments.csv")).toBe("unknown");
	});

	test("hasRecognizedLetterboxdFile allows watchlist-only", () => {
		expect(hasRecognizedLetterboxdFile(["watchlist.csv"])).toBe(true);
		expect(hasRecognizedLetterboxdFile(["comments.csv"])).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/server && bun test src/lib/letterboxd-file-classifier.test.ts`  
Expected: module not found

- [ ] **Step 3: Implement classifier + shared parse module**

`letterboxd-file-classifier.ts`:

```ts
export type LetterboxdCsvKind =
	| "diary"
	| "ratings"
	| "watchlist"
	| "reviews"
	| "likes"
	| "unknown";

export function classifyLetterboxdFileName(fileName: string): LetterboxdCsvKind {
	const base = fileName.toLowerCase().replace(/^.*[/\\]/, "");
	switch (base) {
		case "diary.csv":
			return "diary";
		case "ratings.csv":
			return "ratings";
		case "watchlist.csv":
			return "watchlist";
		case "reviews.csv":
			return "reviews";
		case "films.csv":
			return "likes";
		default:
			return "unknown";
	}
}

export function hasRecognizedLetterboxdFile(fileNames: string[]): boolean {
	return fileNames.some((n) => classifyLetterboxdFileName(n) !== "unknown");
}
```

Move `parseCsvLine`, `headerIndex`, `parseRating`, `parseDate` from `letterboxd-csv.ts` into `letterboxd-csv-parse.ts` and re-import in `letterboxd-csv.ts`. No behavior change to diary parser.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/server && bun test src/lib/letterboxd-file-classifier.test.ts src/lib/letterboxd-csv.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/letterboxd-csv-parse.ts apps/server/src/lib/letterboxd-file-classifier.ts apps/server/src/lib/letterboxd-file-classifier.test.ts apps/server/src/lib/letterboxd-csv.ts
git commit -m "feat(import): shared Letterboxd CSV helpers and filename classifier"
```

---

### Task 2: Watchlist CSV parser

**Files:**
- Create: `apps/server/src/lib/letterboxd-watchlist-csv.ts`
- Create: `apps/server/src/lib/letterboxd-watchlist-csv.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from "bun:test";
import { parseLetterboxdWatchlistCsv } from "./letterboxd-watchlist-csv";

describe("parseLetterboxdWatchlistCsv", () => {
	test("parses watchlist export", () => {
		const csv = `Date,Name,Year,Letterboxd URI
2024-03-01,Dune,2021,https://boxd.it/aBcD`;
		const rows = parseLetterboxdWatchlistCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Dune");
		expect(rows[0]?.addedAt?.toISOString().slice(0, 10)).toBe("2024-03-01");
	});
});
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Implement parser**

```ts
import { headerIndex, parseCsvLine, parseDate } from "./letterboxd-csv-parse";

export interface LetterboxdWatchlistRow {
	name: string;
	year: number | null;
	letterboxdUri: string | null;
	addedAt: Date | null;
}

export function parseLetterboxdWatchlistCsv(text: string): LetterboxdWatchlistRow[] {
	// Same line-split/header pattern as diary; columns Name, Year, Letterboxd URI, Date
}
```

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

---

### Task 3: Reviews CSV parser + HTML strip

**Files:**
- Create: `apps/server/src/lib/letterboxd-reviews-csv.ts`
- Create: `apps/server/src/lib/letterboxd-reviews-csv.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import {
	parseLetterboxdReviewsCsv,
	stripLetterboxdReviewHtml,
} from "./letterboxd-reviews-csv";

describe("stripLetterboxdReviewHtml", () => {
	test("converts paragraphs and strips tags", () => {
		const html = "<p>First</p><p>Second</p>";
		expect(stripLetterboxdReviewHtml(html)).toBe("First\n\nSecond");
	});

	test("returns empty for whitespace-only", () => {
		expect(stripLetterboxdReviewHtml("<p>  </p>")).toBe("");
	});
});

describe("parseLetterboxdReviewsCsv", () => {
	test("parses review body and rating", () => {
		const csv = `Name,Year,Letterboxd URI,Rating,Rewatch,Watched Date,Review
Inception,2010,https://boxd.it/abc,4.5,No,2024-01-15,"<p>Mind-bending</p>"`;
		const rows = parseLetterboxdReviewsCsv(csv);
		expect(rows[0]?.body).toBe("Mind-bending");
		expect(rows[0]?.ratingStars).toBe(4.5);
	});
});
```

- [ ] **Step 2–5:** Implement `stripLetterboxdReviewHtml` (regex tag strip + `</p>` → `\n\n`, decode `&amp;` `&lt;` `&gt;` `&quot;`), implement parser with `Review` column, run tests, commit.

---

### Task 4: Likes (`films.csv`) parser

**Files:**
- Create: `apps/server/src/lib/letterboxd-likes-csv.ts`
- Create: `apps/server/src/lib/letterboxd-likes-csv.test.ts`

- [ ] **Step 1: Write failing test** — likes export has Name, Year, Letterboxd URI, optional Date

- [ ] **Step 2–5:** Implement (reuse watchlist-shaped row type `LetterboxdLikesRow`), test, commit.

---

### Task 5: TMDb resolve helper

**Files:**
- Create: `apps/server/src/lib/letterboxd-tmdb-resolve.ts`
- Modify: `apps/server/src/routes/import.ts` (temporary — will delete inline fn in Task 8)

- [ ] **Step 1: Extract `resolveLetterboxdMovieTmdbId` from `import.ts`**

Move `resolveMovieTmdbId` logic into `letterboxd-tmdb-resolve.ts` as exported function. Accept injectable `searchMovies` for tests:

```ts
export async function resolveLetterboxdMovieTmdbId(
	name: string,
	year: number | null,
	deps?: { searchMovies?: typeof tmdbApi.searchMovies },
): Promise<number | null>
```

- [ ] **Step 2: Commit** — no behavior change yet; `import.ts` still uses old inline function until Task 8.

---

### Task 6: Log resolution helper

**Files:**
- Create: `apps/server/src/lib/letterboxd-import-log-resolve.ts`
- Create: `apps/server/src/lib/letterboxd-import-log-resolve.test.ts`

- [ ] **Step 1: Export pure helpers (testable without DB)**

```ts
export function letterboxdTitleMatchKey(input: {
	letterboxdUri: string | null;
	name: string;
	year: number | null;
}): string {
	const uri = input.letterboxdUri?.trim().toLowerCase();
	if (uri) return `lburi:${uri}`;
	return `lb:${input.name.trim().toLowerCase()}:${input.year ?? 0}`;
}

export function defaultMinimalLogWatchedAt(
	watchedAt: Date | null,
	fallbackDate: Date | null,
	importDay: Date,
): Date {
	return watchedAt ?? fallbackDate ?? utcNoon(importDay);
}
```

- [ ] **Step 2: DB helpers** (not unit-tested with real DB in v1 — covered by orchestrator mocks):

`findLatestLogForMovie(userId, movieId)`  
`findSameDayLog(userId, movieId, watchedAt)`  
`createMinimalLetterboxdLog(...)`  
`fillLogRatingIfNull(logId, ratingTenths)`

- [ ] **Step 3: Commit**

---

### Task 7: Diary phase in orchestrator (with rating merge)

**Files:**
- Create: `apps/server/src/lib/letterboxd-import-apply.ts`
- Create: `apps/server/src/lib/letterboxd-import-apply.test.ts`

- [ ] **Step 1: Define result types**

```ts
export interface LetterboxdImportApplyResult {
	diary: { imported: number; skipped: number; unmatched: number };
	watchlist: { imported: number; skipped: number; unmatched: number };
	reviews: {
		imported: number;
		updated: number;
		skipped: number;
		unmatched: number;
	};
	likes: {
		favorited: number;
		logsCreated: number;
		skipped: number;
		unmatched: number;
	};
	imported: number;
	skipped: number;
	unmatched: number;
}
```

- [ ] **Step 2: Write failing orchestrator test — diary only**

Mock `deps.resolveTmdbId`, `deps.ensureMovie`, `deps.db` with in-memory stubs or `mock.module` pattern used elsewhere in server tests.

Assert:
- New row → `diary.imported++`
- Same calendar day exists → `diary.skipped++`
- Same day + null rating on existing → rating filled, counts as `skipped` (no duplicate insert) per spec

- [ ] **Step 3: Implement `applyLetterboxdDiaryPhase`**

Port loop from `import.ts` lines 106–172 with rating-fill branch:

```ts
if (existing) {
	if (row.ratingStars != null) {
		const tenths = letterboxdStarsToStoredTenths(row.ratingStars);
		await fillLogRatingIfNull(existing.id, tenths);
	}
	skipped++;
	continue;
}
```

- [ ] **Step 4: Run tests + regression `letterboxd-csv.test.ts`**

- [ ] **Step 5: Commit**

---

### Task 8: Reviews, likes, watchlist phases

**Files:**
- Modify: `apps/server/src/lib/letterboxd-import-apply.ts`
- Modify: `apps/server/src/lib/letterboxd-import-apply.test.ts`

- [ ] **Step 1: Reviews phase test**

- Skip row when body empty after HTML strip
- Create review + minimal log when needed
- Update existing review body/rating when different

- [ ] **Step 2: Likes phase test**

- Create minimal log when missing; set `liked: true`; call `syncFavoritesListForUserTitle`
- Skip when already liked

- [ ] **Step 3: Watchlist phase test**

- Skip when any log exists for title
- Skip duplicate watchlist_item
- Import when no log

- [ ] **Step 4: Implement phases + `applyLetterboxdImport` orchestrator**

Processing order: diary → reviews → likes → watchlist.

Load `profile.defaultVisibility` once for reviews.

- [ ] **Step 5: Commit**

---

### Task 9: Thin route + side effects

**Files:**
- Modify: `apps/server/src/routes/import.ts`

- [ ] **Step 1: Replace inline diary loop**

```ts
const classified = classifyUploadedFiles(csvFiles);
if (!hasRecognizedLetterboxdFile(classified.map((f) => f.name))) {
	return status(400, "No recognized Letterboxd CSV files");
}
const result = await applyLetterboxdImport({ userId: user.id, files: classified });
```

- [ ] **Step 2: Update gate message** — allow watchlist-only (no diary rows)

- [ ] **Step 3: Side effects when any category touched**

```ts
const touched =
	result.diary.imported +
	result.watchlist.imported +
	result.reviews.imported +
	result.reviews.updated +
	result.likes.favorited;
```

Notification body: `Letterboxd import complete — X diary · Y watchlist · Z reviews · W favorites`

`recordProductEvent` payload includes all count objects.

Badge when `result.diary.imported > 0`.

`recomputeUserTasteSignature` when diary imported or review rating changed.

- [ ] **Step 4: Return extended JSON + legacy top-level fields**

- [ ] **Step 5: Run full server tests**

Run: `cd apps/server && bun test`

- [ ] **Step 6: Commit**

---

### Task 10: Web UI

**Files:**
- Modify: `apps/web/src/components/profile/me-letterboxd-import.tsx`

- [ ] **Step 1: Expand `LETTERBOXD_PICK_FILES` to five rows**

| file | required |
| diary.csv | false (gate: diary OR any other) |
| ratings.csv | optional |
| watchlist.csv | optional |
| reviews.csv | optional |
| films.csv | optional (note: from `likes/` folder) |

- [ ] **Step 2: Replace `hasDiaryCsv` gate with `hasRecognizedFile` mirror**

```ts
const RECOGNIZED = new Set([
	"diary.csv",
	"ratings.csv",
	"watchlist.csv",
	"reviews.csv",
	"films.csv",
]);
function canImportFromSelection(files: File[]) {
	return files.some((f) => RECOGNIZED.has(f.name.toLowerCase()));
}
```

- [ ] **Step 3: Extend `ImportResult` type + result panel**

Four groups: Diary, Watchlist, Reviews (imported/updated/skipped/unmatched), Favorites (favorited/logsCreated/skipped/unmatched).

- [ ] **Step 4: Update copy** — step 3, footer in/out of scope lists per spec §5.

- [ ] **Step 5: Toast summarizes all categories**

- [ ] **Step 6: `bun run build` in apps/web**

- [ ] **Step 7: Commit**

---

### Task 11: Final verification

- [ ] **Step 1:** `cd apps/server && bun test`
- [ ] **Step 2:** `cd apps/web && bun run build`
- [ ] **Step 3:** `graphify update .`
- [ ] **Step 4:** Manual smoke — pick sample CSVs from a Letterboxd export folder; re-import merge check

---

## Spec coverage checklist

| Spec § | Task |
| --- | --- |
| §1 Accepted files | Task 1 classifier, Tasks 2–4 parsers |
| §1 Import gate | Task 9 route, Task 10 UI |
| §2 Processing order | Task 8 orchestrator |
| §2 Merge rules | Tasks 6–8 |
| §3 API response | Task 7 types, Task 9 route |
| §3 Side effects | Task 9 |
| §4 Module layout | Tasks 1–9 |
| §5 Web UI | Task 10 |
| §7 Testing | Tasks 1–8 tests, Task 11 |
| §8 Out of scope | Not implemented (documented in UI copy) |
