# Letterboxd `watched.csv` Gap-Fill Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Letterboxd `watched.csv` rows as diary gap-fill logs for titles not already in the patron’s Sense diary after the normal diary + ratings phase.

**Architecture:** Extend the filename classifier with `"watched"`, add `applyWatchedGapFillPhase()` in `letterboxd-import-apply.ts` (runs immediately after diary phase, before reviews), reuse `parseLetterboxdCsv` and `createMinimalLetterboxdLog` / `anyLogExistsForMovie`. Wire counts through API, notification, product event, and Settings UI.

**Tech Stack:** Bun, Elysia, Drizzle (Neon HTTP), `bun:test`, Next.js client `me-letterboxd-import.tsx`.

**Spec:** `docs/superpowers/specs/2026-06-10-letterboxd-watched-csv-import-design.md`

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `apps/server/src/lib/letterboxd-file-classifier.ts` | Modify | Map `watched.csv` → kind `"watched"` |
| `apps/server/src/lib/letterboxd-file-classifier.test.ts` | Modify | Classifier + gate tests for watched |
| `apps/server/src/lib/letterboxd-import-apply.ts` | Modify | `applyWatchedGapFillPhase`, result type, orchestration |
| `apps/server/src/lib/letterboxd-import-apply.test.ts` | Create | Gap-fill behavior with injected resolver + log-exists mock |
| `apps/server/src/routes/import.ts` | Modify | `touched`, notification summary, product event, 400 copy |
| `apps/web/src/components/profile/me-letterboxd-import.tsx` | Modify | Recognize file, picker row, toast, result panel |
| `docs/superpowers/specs/2026-06-10-letterboxd-watched-csv-import-design.md` | Modify | Set status to **Approved** |

---

### Task 1: Classify `watched.csv`

**Files:**
- Modify: `apps/server/src/lib/letterboxd-file-classifier.ts`
- Modify: `apps/server/src/lib/letterboxd-file-classifier.test.ts`

- [ ] **Step 1: Write failing classifier tests**

Add to `letterboxd-file-classifier.test.ts`:

```ts
test("maps watched.csv", () => {
	expect(classifyLetterboxdFileName("watched.csv")).toBe("watched");
	expect(classifyLetterboxdFileName("WATCHED.CSV")).toBe("watched");
});

test("hasRecognizedLetterboxdFile allows watched-only", () => {
	expect(hasRecognizedLetterboxdFile(["watched.csv"])).toBe(true);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/server && bun test src/lib/letterboxd-file-classifier.test.ts`  
Expected: FAIL — `"watched"` not in union / switch has no case

- [ ] **Step 3: Implement classifier**

In `letterboxd-file-classifier.ts`:

```ts
export type LetterboxdCsvKind =
	| "diary"
	| "ratings"
	| "watchlist"
	| "reviews"
	| "likes"
	| "watched"
	| "unknown";

// inside switch:
case "watched.csv":
	return "watched";
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/server && bun test src/lib/letterboxd-file-classifier.test.ts`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/letterboxd-file-classifier.ts apps/server/src/lib/letterboxd-file-classifier.test.ts
git commit -m "feat(import): classify Letterboxd watched.csv"
```

---

### Task 2: Watched gap-fill phase (server orchestrator)

**Files:**
- Modify: `apps/server/src/lib/letterboxd-import-apply.ts`
- Create: `apps/server/src/lib/letterboxd-import-apply.test.ts`

- [ ] **Step 1: Write failing orchestrator tests**

Create `apps/server/src/lib/letterboxd-import-apply.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { applyLetterboxdImport } from "./letterboxd-import-apply";

const WATCHED_ONLY_CSV = `Date,Name,Year,Letterboxd URI
2026-01-06,One Battle After Another,2025,https://boxd.it/DUHM`;

const DIARY_CSV = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-01-06,Whiplash,2014,https://boxd.it/ctAfJf,,Yes,,2026-01-06`;

describe("applyLetterboxdImport watched gap-fill", () => {
	test("creates diary log for watched-only title", async () => {
		const existingLogs = new Set<number>();
		const inserted: { movieId: number; watchedAt: Date }[] = [];

		const result = await applyLetterboxdImport({
			userId: "user_test",
			importedAt: new Date("2026-06-10T12:00:00.000Z"),
			files: [{ name: "watched.csv", text: WATCHED_ONLY_CSV }],
			resolveTmdbId: async (name) =>
				name === "One Battle After Another" ? 12345 : null,
			ensureMovie: async () => {},
			hasAnyLogForMovie: async (_userId, movieId) =>
				existingLogs.has(movieId),
			insertMinimalLog: async (input) => {
				inserted.push({
					movieId: input.movieId,
					watchedAt: input.watchedAt,
				});
				existingLogs.add(input.movieId);
				return "log_test";
			},
		});

		expect(result.watched.imported).toBe(1);
		expect(result.watched.skipped).toBe(0);
		expect(result.watched.unmatched).toBe(0);
		expect(inserted).toHaveLength(1);
		expect(inserted[0]?.movieId).toBe(12345);
		expect(inserted[0]?.watchedAt.toISOString().slice(0, 10)).toBe(
			"2026-01-06",
		);
	});

	test("skips watched row when any diary log already exists", async () => {
		let insertCalls = 0;

		const result = await applyLetterboxdImport({
			userId: "user_test",
			importedAt: new Date("2026-06-10T12:00:00.000Z"),
			files: [
				{ name: "diary.csv", text: DIARY_CSV },
				{ name: "watched.csv", text: `Date,Name,Year,Letterboxd URI
2026-01-06,Whiplash,2014,https://boxd.it/7bQA` },
			],
			resolveTmdbId: async () => 999,
			ensureMovie: async () => {},
			hasAnyLogForMovie: async () => true,
			insertMinimalLog: async () => {
				insertCalls++;
				return "log_test";
			},
		});

		expect(result.diary.imported).toBe(0);
		expect(result.watched.imported).toBe(0);
		expect(result.watched.skipped).toBe(1);
		expect(insertCalls).toBe(0);
	});

	test("counts unmatched when TMDb resolve fails", async () => {
		const result = await applyLetterboxdImport({
			userId: "user_test",
			files: [{ name: "watched.csv", text: WATCHED_ONLY_CSV }],
			resolveTmdbId: async () => null,
			ensureMovie: async () => {},
		});

		expect(result.watched.imported).toBe(0);
		expect(result.watched.unmatched).toBe(1);
	});
});
```

**Note for implementer:** Tests inject optional hooks `hasAnyLogForMovie` and `insertMinimalLog` on `ApplyLetterboxdImportOptions` (defaults delegate to `anyLogExistsForMovie` / `createMinimalLetterboxdLog`). This mirrors existing `resolveTmdbId` / `ensureMovie` injection — do **not** mock Drizzle in unit tests.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/server && bun test src/lib/letterboxd-import-apply.test.ts`  
Expected: FAIL — `watched` undefined / hooks missing

- [ ] **Step 3: Implement gap-fill phase**

In `letterboxd-import-apply.ts`:

1. Add interface:

```ts
export interface LetterboxdImportWatchedCounts {
	imported: number;
	skipped: number;
	unmatched: number;
}
```

2. Extend `LetterboxdImportApplyResult` with `watched: LetterboxdImportWatchedCounts`.

3. Extend `ApplyLetterboxdImportOptions`:

```ts
hasAnyLogForMovie?: (userId: string, movieId: number) => Promise<boolean>;
insertMinimalLog?: (input: {
	userId: string;
	movieId: number;
	watchedAt: Date;
	ratingStars: number | null;
	rewatch: boolean;
	letterboxdUri: string | null;
}) => Promise<string>;
```

4. Add `applyWatchedGapFillPhase` (structure mirrors watchlist phase):

```ts
async function applyWatchedGapFillPhase(
	userId: string,
	rows: LetterboxdCsvRow[],
	importDay: Date,
	resolveTmdbId: (name: string, year: number | null) => Promise<number | null>,
	ensureMovie: (tmdbId: number) => Promise<void>,
	hasAnyLogForMovie: (userId: string, movieId: number) => Promise<boolean>,
	insertMinimalLog: ApplyLetterboxdImportOptions["insertMinimalLog"] & {},
): Promise<LetterboxdImportWatchedCounts> {
	const counts = { imported: 0, skipped: 0, unmatched: 0 };
	const seenKeys = new Set<string>();

	for (const row of rows) {
		const key = letterboxdTitleMatchKey(row);
		if (seenKeys.has(key)) {
			counts.skipped++;
			continue;
		}
		seenKeys.add(key);

		const movieId = await resolveMovieId(
			row.name,
			row.year,
			resolveTmdbId,
			ensureMovie,
		);
		if (movieId == null) {
		 counts.unmatched++;
			continue;
		}

		if (await hasAnyLogForMovie(userId, movieId)) {
			counts.skipped++;
			continue;
		}

		const watchedAt = defaultMinimalLogWatchedAt(
			row.watchedAt,
			null,
			importDay,
		);

		await insertMinimalLog!({
			userId,
			movieId,
			watchedAt,
			ratingStars: null,
			rewatch: false,
			letterboxdUri: row.letterboxdUri,
		});
		counts.imported++;
	}

	return counts;
}
```

5. Wire in `applyLetterboxdImport`:

```ts
import {
	anyLogExistsForMovie,
	createMinimalLetterboxdLog,
	defaultMinimalLogWatchedAt,
	letterboxdTitleMatchKey,
} from "./letterboxd-import-log-resolve";

// after bucketFiles:
const watchedRows = (buckets.get("watched") ?? []).flatMap((text) =>
	parseLetterboxdCsv(text),
);

// totalRows:
result.totalRows =
	diaryRows.length +
	watchedRows.length +
	reviewRows.length +
	likeRows.length +
	watchlistRows.length;

// after diary phase:
const hasAnyLog =
	opts.hasAnyLogForMovie ??
	((userId, movieId) => anyLogExistsForMovie(userId, movieId));
const insertMinimal =
	opts.insertMinimalLog ??
	((input) => createMinimalLetterboxdLog(input));

result.watched = await applyWatchedGapFillPhase(
	opts.userId,
	watchedRows,
	importDay,
	resolveTmdbId,
	ensureMovie,
	hasAnyLog,
	insertMinimal,
);
```

6. Initialize `watched: { imported: 0, skipped: 0, unmatched: 0 }` in `emptyResult()`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/server && bun test src/lib/letterboxd-import-apply.test.ts`  
Expected: all PASS

Also run: `cd apps/server && bun test src/lib/letterboxd-csv.test.ts`  
Expected: regression PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/letterboxd-import-apply.ts apps/server/src/lib/letterboxd-import-apply.test.ts
git commit -m "feat(import): gap-fill diary logs from Letterboxd watched.csv"
```

---

### Task 3: Import route side effects

**Files:**
- Modify: `apps/server/src/routes/import.ts`

- [ ] **Step 1: Extend touched / notification / product event**

In `import.ts`:

1. Update 400 gate copy to mention `watched.csv`:

```ts
"No recognized Letterboxd CSV files — include diary.csv, watched.csv, watchlist.csv, reviews.csv, films.csv, or ratings.csv",
```

2. Include watched in `touched`:

```ts
const touched =
	applyResult.diary.imported +
	applyResult.ratingFilled +
	applyResult.watched.imported +
	applyResult.watchlist.imported +
	// ... rest unchanged
```

3. Include watched in taste recompute when watched logs created:

```ts
const tasteChanged =
	applyResult.diary.imported > 0 ||
	applyResult.ratingFilled > 0 ||
	applyResult.watched.imported > 0 ||
	applyResult.reviews.imported > 0 ||
	applyResult.reviews.updated > 0;
```

4. Notification summary — insert after diary segment when > 0:

```ts
const summaryParts = [
	`${applyResult.diary.imported} diary`,
];
if (applyResult.watched.imported > 0) {
	summaryParts.push(`${applyResult.watched.imported} watched`);
}
summaryParts.push(
	`${applyResult.watchlist.imported} watchlist`,
	`${applyResult.reviews.imported + applyResult.reviews.updated} reviews`,
	`${applyResult.likes.favorited} favorites`,
);
const summary = summaryParts.join(" · ");
```

5. Notification payload + product event — add `watched: applyResult.watched`.

6. Badge rule stays diary-only (`applyResult.diary.imported > 0`) — watched gap-fill does not award `prestige_diaries_merged` on its own (matches spec: legacy diary counts unchanged).

- [ ] **Step 2: Smoke-check route compiles**

Run: `cd apps/server && bun run check-types` (or `bun test` if no check-types script)  
Expected: no TypeScript errors on `import.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/import.ts
git commit -m "feat(import): surface watched.csv counts in Letterboxd import route"
```

---

### Task 4: Settings UI

**Files:**
- Modify: `apps/web/src/components/profile/me-letterboxd-import.tsx`

- [ ] **Step 1: Recognize and display watched.csv**

1. Add to `LETTERBOXD_RECOGNIZED_FILES`:

```ts
"watched.csv",
```

2. Add picker row after `ratings.csv`:

```ts
{
	fileName: "watched.csv",
	title: "watched.csv",
	detail:
		"Films marked watched without a diary entry — fills gaps after diary import",
	label: "Optional",
},
```

3. Extend `ImportCountGroup` usage — add optional `watched?: ImportCountGroup` on `ImportResult`.

4. Parse `watched` from API in `runImport`:

```ts
watched: data?.watched,
```

5. Toast — in `formatImportToast`, after diary block:

```ts
if (result.watched?.imported) {
	parts.push(
		`${result.watched.imported} watched ${result.watched.imported === 1 ? "title" : "titles"}`,
	);
}
```

6. Result panel — add a **Watched** group (same Added / Skipped / Unmatched rows as Watchlist).

7. Update footer copy:

```tsx
Imported: diary, ratings, watched, watchlist, reviews, liked films. Not yet:
comments, custom lists, liked reviews/lists, or TV (use Anilist import).
```

8. Step 3 instructions — mention `watched.csv` in optional file list.

- [ ] **Step 2: Type-check web app**

Run: `cd apps/web && bun run check-types`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/me-letterboxd-import.tsx
git commit -m "feat(settings): show Letterboxd watched.csv in import UI"
```

---

### Task 5: Spec status + manual verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-10-letterboxd-watched-csv-import-design.md`

- [ ] **Step 1: Mark spec approved**

Change header status from `Draft — pending user review` to `Approved`.

- [ ] **Step 2: Run full server test suite for import libs**

Run: `cd apps/server && bun test src/lib/letterboxd-file-classifier.test.ts src/lib/letterboxd-import-apply.test.ts src/lib/letterboxd-csv.test.ts src/lib/letterboxd-import-log-resolve.test.ts`  
Expected: all PASS

- [ ] **Step 3: Manual check (staging/local)**

1. Settings → Data → Letterboxd import  
2. Upload from `letterboxd-adgv-2026-05-30-01-03-utc`: `diary.csv`, `ratings.csv`, `watched.csv`  
3. Confirm **One Battle After Another** appears in diary after import  
4. Confirm **Whiplash** not duplicated (watched skipped)  
5. Re-import same files — watched `skipped` increases, no duplicate logs  

- [ ] **Step 4: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-10-letterboxd-watched-csv-import-design.md
git commit -m "docs: approve Letterboxd watched.csv import spec"
```

- [ ] **Step 5: Update knowledge graph**

Run: `graphify update .` from repo root (AST-only).

---

## Plan self-review

| Spec requirement | Task |
| --- | --- |
| Classify `watched.csv` | Task 1 |
| Gap-fill after diary, skip if any log | Task 2 |
| Reuse `parseLetterboxdCsv` | Task 2 (no new parser) |
| `watched` API counts | Task 2 + 3 |
| UI picker + toast + result | Task 4 |
| Watched-only import gate | Task 1 |
| Idempotent re-import | Task 2 tests |
| Notification + product event | Task 3 |
| Out of scope (first-watch backfill, orphaned/) | Not in plan ✓ |

No placeholders. Type names consistent across tasks.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-10-letterboxd-watched-csv-import.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach?
