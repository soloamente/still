# Data Settings (Export, Clear Library, Delete Account) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patrons can export all their data as a Letterboxd-style ZIP of CSVs, wipe their watch library (keeping social identity), and delete their whole account via an email-verified link — all from a renamed **Data** settings section.

**Architecture:** Synchronous everything. A new `/api/me` Elysia route group builds the export ZIP in memory (`fflate`) and clears the library in one Drizzle transaction. Account deletion uses Better Auth's built-in `user.deleteUser` with `sendDeleteAccountVerification` over a new Resend email helper in `packages/auth`. The web side renames the Imports settings tab to Data and adds an Export panel plus a Danger zone with two confirm dialogs.

**Tech Stack:** Elysia + Drizzle (apps/server), Better Auth 1.6.9 + Resend (packages/auth), Next.js App Router + motion/react (apps/web), fflate for ZIP, Bun test.

**Spec:** `docs/superpowers/specs/2026-06-09-data-settings-export-clear-delete-design.md`

---

## File structure

**packages/env**
- Modify: `packages/env/src/server.ts` — add `RESEND_API_KEY`, `EMAIL_FROM` (both optional).

**packages/auth**
- Create: `packages/auth/src/lib/send-email.ts` — Resend wrapper + pure `buildDeleteAccountEmail`.
- Create: `packages/auth/src/lib/send-email.test.ts`
- Create: `packages/auth/src/lib/delete-user-cleanup.ts` — best-effort blob cleanup (avatar, banner, list covers).
- Modify: `packages/auth/src/index.ts` — enable `user.deleteUser`.
- Modify: `packages/auth/package.json` — add `resend`, `@vercel/blob`.

**apps/server**
- Create: `apps/server/src/lib/me-export-csv.ts` — pure CSV primitives (escape, build, rating/date conversions).
- Create: `apps/server/src/lib/me-export-csv.test.ts`
- Create: `apps/server/src/lib/me-export-data.ts` — `fetchExportInput` (db) + `assembleExportFiles` (pure).
- Create: `apps/server/src/lib/me-export-data.test.ts` — tests the pure assembly only.
- Create: `apps/server/src/lib/clear-user-library.ts` — single-transaction wipe.
- Create: `apps/server/src/routes/me-data.ts` — `GET /api/me/export` + `DELETE /api/me/library`.
- Create: `apps/server/src/routes/me-data.test.ts`
- Modify: `apps/server/src/server/app.ts` — register `meDataRoute`.
- Modify: `apps/server/package.json` — add `fflate`.

**apps/web**
- Modify: `apps/web/src/lib/me-account-nav.ts` — Imports → Data rename + legacy path mapping.
- Create: `apps/web/src/app/(app)/me/settings/data/page.tsx`
- Modify: `apps/web/src/app/(app)/me/settings/imports/page.tsx` — redirect to `/me/settings/data`.
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx` — `SettingsImportsSection` → `SettingsDataSection`.
- Create: `apps/web/src/components/profile/me-data-export-panel.tsx`
- Create: `apps/web/src/components/profile/me-danger-zone.tsx`
- Create: `apps/web/src/components/profile/me-destructive-confirm-dialog.tsx` — shared type-to-confirm dialog shell.
- Create: `apps/web/src/components/profile/me-clear-library-dialog.tsx`
- Create: `apps/web/src/components/profile/me-delete-account-dialog.tsx`

---

### Task 1: Env vars + Resend email helper

**Files:**
- Modify: `packages/env/src/server.ts`
- Create: `packages/auth/src/lib/send-email.ts`
- Create: `packages/auth/src/lib/send-email.test.ts`
- Modify: `packages/auth/package.json` (via `bun add`)

- [ ] **Step 1.1: Add env vars**

In `packages/env/src/server.ts`, inside the `serverEnv` object after `BLOB_STORE_ACCESS`, add:

```ts
	// Resend API key for transactional email (account-deletion verification).
	// Optional — when unset (local dev), emails fall back to console logging.
	RESEND_API_KEY: optionalNonEmptyString(),
	// Verified Resend sender, e.g. "Sense <noreply@updates.example.com>".
	EMAIL_FROM: optionalNonEmptyString(),
```

- [ ] **Step 1.2: Add the resend dependency**

Run (working directory `packages/auth`):

```bash
bun add resend
```

Expected: `resend` appears in `packages/auth/package.json` dependencies.

- [ ] **Step 1.3: Write the failing test for the email copy builder**

Create `packages/auth/src/lib/send-email.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { buildDeleteAccountEmail } from "./send-email";

describe("buildDeleteAccountEmail", () => {
	test("includes the verification url and an expiry warning", () => {
		const email = buildDeleteAccountEmail({
			url: "https://sense.example/api/auth/delete-user/callback?token=abc",
		});
		expect(email.subject).toBe("Confirm your Sense account deletion");
		expect(email.text).toContain(
			"https://sense.example/api/auth/delete-user/callback?token=abc",
		);
		expect(email.text).toContain("24 hours");
		expect(email.text.toLowerCase()).toContain("permanently");
	});
});
```

- [ ] **Step 1.4: Run the test to verify it fails**

Run (working directory `packages/auth`): `bun test src/lib/send-email.test.ts`
Expected: FAIL — module `./send-email` not found.

- [ ] **Step 1.5: Implement the helper**

Create `packages/auth/src/lib/send-email.ts`:

```ts
import { env } from "@still/env/server";
import { Resend } from "resend";

export interface SendEmailInput {
	to: string;
	subject: string;
	text: string;
}

/**
 * Transactional email via Resend. When RESEND_API_KEY / EMAIL_FROM are unset
 * (local dev), the email is logged to the console instead so link-dependent
 * flows (account deletion) stay testable without a provider.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
	if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
		console.info(
			`[send-email:dev-fallback] to=${input.to} subject=${input.subject}\n${input.text}`,
		);
		return;
	}
	const resend = new Resend(env.RESEND_API_KEY);
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to: input.to,
		subject: input.subject,
		text: input.text,
	});
	if (error) {
		throw new Error(`Email send failed: ${error.message}`);
	}
}

/** Plain-text deletion-verification email — one link, no marketing chrome. */
export function buildDeleteAccountEmail(params: { url: string }): {
	subject: string;
	text: string;
} {
	return {
		subject: "Confirm your Sense account deletion",
		text: [
			"You asked to permanently delete your Sense account.",
			"",
			"Click the link below to confirm. This permanently removes your profile, diary, reviews, lists, and followers. There is no undo.",
			"",
			params.url,
			"",
			"The link expires in 24 hours. If you didn't request this, you can ignore this email — nothing will happen.",
		].join("\n"),
	};
}
```

- [ ] **Step 1.6: Run the test to verify it passes**

Run (working directory `packages/auth`): `bun test src/lib/send-email.test.ts`
Expected: PASS (1 test).

- [ ] **Step 1.7: Commit**

```bash
git add packages/env/src/server.ts packages/auth/src/lib/send-email.ts packages/auth/src/lib/send-email.test.ts packages/auth/package.json bun.lock
git commit -m "feat(auth): add Resend email helper with dev console fallback"
```

---

### Task 2: Better Auth deleteUser + blob cleanup

**Files:**
- Create: `packages/auth/src/lib/delete-user-cleanup.ts`
- Modify: `packages/auth/src/index.ts`
- Modify: `packages/auth/package.json` (via `bun add`)

- [ ] **Step 2.1: Add the blob dependency**

Run (working directory `packages/auth`):

```bash
bun add @vercel/blob
```

- [ ] **Step 2.2: Implement blob cleanup**

Create `packages/auth/src/lib/delete-user-cleanup.ts`:

```ts
import { db, list, profile, user } from "@still/db";
import { env } from "@still/env/server";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";

/**
 * Best-effort Vercel Blob cleanup before account deletion. Collects every
 * blob URL the patron owns (avatar on `user.image`, profile banner, custom
 * list covers) and deletes them in one call. Never throws — a failed blob
 * delete must not block the account deletion itself.
 */
export async function deleteUserBlobAssets(userId: string): Promise<void> {
	if (!env.BLOB_READ_WRITE_TOKEN) return;

	const urls: string[] = [];
	try {
		const [userRow] = await db
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, userId));
		if (userRow?.image?.startsWith("https://")) urls.push(userRow.image);

		const [profileRow] = await db
			.select({ bannerUrl: profile.bannerUrl })
			.from(profile)
			.where(eq(profile.userId, userId));
		if (profileRow?.bannerUrl?.startsWith("https://")) {
			urls.push(profileRow.bannerUrl);
		}

		const ownedLists = await db
			.select({ coverImageUrl: list.coverImageUrl })
			.from(list)
			.where(eq(list.userId, userId));
		for (const row of ownedLists) {
			if (row.coverImageUrl?.startsWith("https://")) {
				urls.push(row.coverImageUrl);
			}
		}

		if (urls.length === 0) return;
		await del(urls, { token: env.BLOB_READ_WRITE_TOKEN });
	} catch (err) {
		console.error("[delete-user-cleanup] blob cleanup failed", err);
	}
}
```

- [ ] **Step 2.3: Enable deleteUser in the auth config**

In `packages/auth/src/index.ts`:

Add imports at the top (after the existing imports):

```ts
import { deleteUserBlobAssets } from "./lib/delete-user-cleanup";
import { buildDeleteAccountEmail, sendEmail } from "./lib/send-email";
```

Inside the `betterAuth({ ... })` options object, after the `emailAndPassword` block, add:

```ts
		user: {
			deleteUser: {
				enabled: true,
				// Email-verified deletion: the patron clicks a link in their inbox;
				// Better Auth's callback then deletes the user row and DB cascades
				// wipe everything else.
				sendDeleteAccountVerification: async ({ user: target, url }) => {
					const email = buildDeleteAccountEmail({ url });
					await sendEmail({
						to: target.email,
						subject: email.subject,
						text: email.text,
					});
				},
				beforeDelete: async (target) => {
					await deleteUserBlobAssets(target.id);
				},
			},
		},
```

- [ ] **Step 2.4: Type-check the package**

Run (working directory `packages/auth`): `bunx tsc --noEmit` — or if the package has no tsconfig of its own, run the workspace check used by CI (`bun run check-types` at repo root if defined; otherwise rely on the apps/server type-check in Task 5).
Expected: no errors in `packages/auth/src`.

- [ ] **Step 2.5: Commit**

```bash
git add packages/auth/src/index.ts packages/auth/src/lib/delete-user-cleanup.ts packages/auth/package.json bun.lock
git commit -m "feat(auth): enable email-verified account deletion with blob cleanup"
```

**Known gap (accepted):** account deletion does not cancel an active Polar subscription; webhook handlers must tolerate events for unknown (already-deleted) users. Follow-up work is tracked outside this plan.

---

### Task 3: CSV export primitives

**Files:**
- Create: `apps/server/src/lib/me-export-csv.ts`
- Create: `apps/server/src/lib/me-export-csv.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `apps/server/src/lib/me-export-csv.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	buildCsv,
	csvEscape,
	displayTenToLetterboxdStars,
	exportDateKey,
	formatRatingTenDisplay,
	storedRatingToDisplayTen,
} from "./me-export-csv";

describe("csvEscape", () => {
	test("passes plain values through", () => {
		expect(csvEscape("Whiplash")).toBe("Whiplash");
		expect(csvEscape(2014)).toBe("2014");
	});
	test("empty for null/undefined", () => {
		expect(csvEscape(null)).toBe("");
		expect(csvEscape(undefined)).toBe("");
	});
	test("quotes commas, quotes, and newlines", () => {
		expect(csvEscape("I, Tonya")).toBe('"I, Tonya"');
		expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
		expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
	});
});

describe("buildCsv", () => {
	test("joins header + rows with trailing newline", () => {
		const csv = buildCsv(
			["Date", "Name", "Year"],
			[
				["2026-01-06", "Whiplash", 2014],
				["2026-01-07", "I, Tonya", 2017],
			],
		);
		expect(csv).toBe(
			'Date,Name,Year\n2026-01-06,Whiplash,2014\n2026-01-07,"I, Tonya",2017\n',
		);
	});
});

describe("rating conversions", () => {
	test("stored tenths normalize to 0–10 display", () => {
		expect(storedRatingToDisplayTen(72)).toBe(7.2);
		expect(storedRatingToDisplayTen(100)).toBe(10);
	});
	test("legacy whole 1–10 passes through", () => {
		expect(storedRatingToDisplayTen(7)).toBe(7);
		expect(storedRatingToDisplayTen(10)).toBe(10);
	});
	test("display 0–10 maps to Letterboxd half-stars", () => {
		expect(displayTenToLetterboxdStars(7.2)).toBe(3.5);
		expect(displayTenToLetterboxdStars(7.5)).toBe(4);
		expect(displayTenToLetterboxdStars(10)).toBe(5);
		expect(displayTenToLetterboxdStars(0.4)).toBe(0.5);
	});
	test("Rating10 column shows one decimal except whole 10", () => {
		expect(formatRatingTenDisplay(7.2)).toBe("7.2");
		expect(formatRatingTenDisplay(10)).toBe("10");
		expect(formatRatingTenDisplay(7)).toBe("7.0");
	});
});

describe("exportDateKey", () => {
	test("UTC YYYY-MM-DD", () => {
		expect(exportDateKey(new Date("2026-01-06T23:30:00Z"))).toBe("2026-01-06");
	});
	test("accepts ISO strings", () => {
		expect(exportDateKey("2026-01-06T01:00:00.000Z")).toBe("2026-01-06");
	});
	test("empty for null", () => {
		expect(exportDateKey(null)).toBe("");
	});
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run (working directory `apps/server`): `bun test src/lib/me-export-csv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement the primitives**

Create `apps/server/src/lib/me-export-csv.ts`:

```ts
/**
 * Pure CSV primitives for the patron data export (`GET /api/me/export`).
 * Letterboxd-compatible film CSVs depend on exact header layouts — keep the
 * formatting rules here and unit-tested, away from the db-fetch code.
 */

export type CsvValue = string | number | boolean | null | undefined;

export function csvEscape(value: CsvValue): string {
	if (value == null) return "";
	const str = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
	if (/[",\n\r]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function buildCsv(
	headers: readonly string[],
	rows: ReadonlyArray<ReadonlyArray<CsvValue>>,
): string {
	const lines = [headers.map(csvEscape).join(",")];
	for (const row of rows) {
		lines.push(row.map(csvEscape).join(","));
	}
	return `${lines.join("\n")}\n`;
}

/** Stored `log.rating` / `review.rating` (tenths 0–100 or legacy 1–10) → 0–10 display. */
export function storedRatingToDisplayTen(stored: number): number {
	return stored > 10 ? stored / 10 : stored;
}

/** 0–10 display score → Letterboxd 0.5–5 stars, rounded to the nearest half star. */
export function displayTenToLetterboxdStars(displayTen: number): number {
	return Math.max(0.5, Math.round(displayTen) / 2);
}

/** Native-score column: one decimal (`7.2`), whole `10` at the max (house style). */
export function formatRatingTenDisplay(displayTen: number): string {
	if (displayTen === 10) return "10";
	return displayTen.toFixed(1);
}

/** UTC `YYYY-MM-DD` for date columns; empty string for missing values. */
export function exportDateKey(value: Date | string | null | undefined): string {
	if (value == null) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run (working directory `apps/server`): `bun test src/lib/me-export-csv.test.ts`
Expected: PASS (all tests).

- [ ] **Step 3.5: Commit**

```bash
git add apps/server/src/lib/me-export-csv.ts apps/server/src/lib/me-export-csv.test.ts
git commit -m "feat(server): CSV primitives for patron data export"
```

---

### Task 4: Export data assembly (pure) + db fetch

**Files:**
- Create: `apps/server/src/lib/me-export-data.ts`
- Create: `apps/server/src/lib/me-export-data.test.ts`

Design: `fetchExportInput(userId)` runs the Drizzle queries and returns a plain
`ExportInput` data bag; `assembleExportFiles(input)` is pure and turns that bag
into `{ path, contents }[]`. Tests cover the pure half with fixture data.

- [ ] **Step 4.1: Write the failing tests**

Create `apps/server/src/lib/me-export-data.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { assembleExportFiles, type ExportInput } from "./me-export-data";

const baseInput: ExportInput = {
	profile: {
		handle: "adgv",
		displayName: "Anselmo",
		bio: "cinema",
		pronouns: null,
		location: null,
		website: null,
		joinedAt: new Date("2026-01-06T10:00:00Z"),
		email: "adgv@example.com",
	},
	favoriteFilms: [{ title: "Whiplash", year: 2014, tmdbId: 244786 }],
	filmLogs: [
		{
			title: "Whiplash",
			year: 2014,
			tmdbId: 244786,
			watchedAt: new Date("2026-01-06T00:00:00Z"),
			createdAt: new Date("2026-01-06T12:00:00Z"),
			rating: 95,
			rewatch: true,
			liked: true,
			note: null,
		},
	],
	tvLogs: [
		{
			title: "Severance",
			year: 2022,
			tmdbId: 95396,
			watchedAt: new Date("2026-02-01T00:00:00Z"),
			createdAt: new Date("2026-02-01T12:00:00Z"),
			rating: 88,
			rewatch: false,
			liked: false,
			note: "great finale",
			logScope: "season",
			seasonNumber: 2,
			episodeNumber: null,
		},
	],
	filmWatchlist: [
		{
			title: "One Battle After Another",
			year: 2025,
			tmdbId: 1084736,
			addedAt: new Date("2026-01-06T09:00:00Z"),
		},
	],
	tvWatchlist: [
		{
			title: "The Pitt",
			year: 2025,
			tmdbId: 250307,
			addedAt: new Date("2026-03-01T09:00:00Z"),
		},
	],
	tvProgress: [
		{
			title: "Severance",
			year: 2022,
			tmdbId: 95396,
			status: "finished",
			lastSeason: 2,
			lastEpisode: 10,
			startedAt: new Date("2026-01-10T00:00:00Z"),
			statusChangedAt: new Date("2026-02-01T00:00:00Z"),
		},
	],
	reviews: [
		{
			title: "Whiplash",
			year: 2014,
			tmdbId: 244786,
			reviewTitle: "Tempo",
			body: "Not quite my tempo, indeed.",
			rating: 95,
			containsSpoilers: false,
			publishedAt: new Date("2026-01-07T00:00:00Z"),
			watchedAt: new Date("2026-01-06T00:00:00Z"),
		},
	],
	lists: [
		{
			title: "Favorites",
			description: null,
			isRanked: true,
			items: [
				{
					position: 0,
					title: "Whiplash",
					year: 2014,
					tmdbId: 244786,
					mediaType: "film",
					note: null,
					addedAt: new Date("2026-01-06T12:00:00Z"),
				},
			],
		},
	],
	comments: [
		{
			parentType: "review",
			parentId: "rev_1",
			body: "agreed!",
			createdAt: new Date("2026-01-08T00:00:00Z"),
		},
	],
	likedReviews: [
		{
			reviewId: "rev_2",
			movieTitle: "Sound of Metal",
			likedAt: new Date("2026-01-09T00:00:00Z"),
		},
	],
	likedLists: [
		{
			listId: "list_2",
			listTitle: "Best of 2024",
			likedAt: new Date("2026-01-10T00:00:00Z"),
		},
	],
};

describe("assembleExportFiles", () => {
	test("emits the full Letterboxd-style file set", () => {
		const files = assembleExportFiles(baseInput);
		const paths = files.map((f) => f.path).sort();
		expect(paths).toEqual(
			[
				"comments.csv",
				"diary.csv",
				"likes/films.csv",
				"likes/lists.csv",
				"likes/reviews.csv",
				"lists/favorites.csv",
				"profile.csv",
				"ratings.csv",
				"reviews.csv",
				"tv-diary.csv",
				"tv-progress.csv",
				"tv-watchlist.csv",
				"watched.csv",
				"watchlist.csv",
			].sort(),
		);
	});

	test("diary.csv uses the Letterboxd column layout and star scale", () => {
		const diary = assembleExportFiles(baseInput).find(
			(f) => f.path === "diary.csv",
		);
		expect(diary?.contents).toBe(
			"Date,Name,Year,TMDb ID,Rating,Rating10,Rewatch,Watched Date\n" +
				"2026-01-06,Whiplash,2014,244786,5,9.5,Yes,2026-01-06\n",
		);
	});

	test("ratings.csv keeps one row per film with the latest rating", () => {
		const input: ExportInput = {
			...baseInput,
			filmLogs: [
				...baseInput.filmLogs,
				{
					title: "Whiplash",
					year: 2014,
					tmdbId: 244786,
					watchedAt: new Date("2026-03-01T00:00:00Z"),
					createdAt: new Date("2026-03-01T12:00:00Z"),
					rating: 80,
					rewatch: true,
					liked: true,
					note: null,
				},
			],
		};
		const ratings = assembleExportFiles(input).find(
			(f) => f.path === "ratings.csv",
		);
		const lines = ratings?.contents.trim().split("\n") ?? [];
		expect(lines).toHaveLength(2); // header + one film
		expect(lines[1]).toContain("4"); // 80 tenths → 8.0 display → 4 stars
		expect(lines[1]).toContain("8.0");
	});

	test("tv-diary.csv carries scope and season columns", () => {
		const tvDiary = assembleExportFiles(baseInput).find(
			(f) => f.path === "tv-diary.csv",
		);
		expect(tvDiary?.contents).toContain(
			"Date,Name,Year,TMDb ID,Scope,Season,Episode,Rating,Rating10,Rewatch,Watched Date",
		);
		expect(tvDiary?.contents).toContain("season,2,");
	});

	test("watchlist.csv contains films only", () => {
		const watchlist = assembleExportFiles(baseInput).find(
			(f) => f.path === "watchlist.csv",
		);
		expect(watchlist?.contents).toContain("One Battle After Another");
		expect(watchlist?.contents).not.toContain("The Pitt");
	});

	test("list slugs dedupe on collision", () => {
		const input: ExportInput = {
			...baseInput,
			lists: [
				{ title: "Best!", description: null, isRanked: false, items: [] },
				{ title: "Best?", description: null, isRanked: false, items: [] },
			],
		};
		const paths = assembleExportFiles(input)
			.map((f) => f.path)
			.filter((p) => p.startsWith("lists/"));
		expect(paths).toEqual(["lists/best.csv", "lists/best-2.csv"]);
	});

	test("unrated logs leave rating columns empty", () => {
		const input: ExportInput = {
			...baseInput,
			filmLogs: [{ ...baseInput.filmLogs[0], rating: null }],
		};
		const diary = assembleExportFiles(input).find(
			(f) => f.path === "diary.csv",
		);
		expect(diary?.contents).toContain("244786,,,Yes");
		const ratings = assembleExportFiles(input).find(
			(f) => f.path === "ratings.csv",
		);
		expect(ratings?.contents.trim().split("\n")).toHaveLength(1); // header only
	});
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run (working directory `apps/server`): `bun test src/lib/me-export-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement assembly + fetch**

Create `apps/server/src/lib/me-export-data.ts`:

```ts
import {
	comment,
	db,
	list,
	listItem,
	log,
	movie,
	profile,
	reaction,
	review,
	tv,
	tvWatch,
	user,
	watchlistItem,
} from "@still/db";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

import {
	buildCsv,
	type CsvValue,
	displayTenToLetterboxdStars,
	exportDateKey,
	formatRatingTenDisplay,
	storedRatingToDisplayTen,
} from "./me-export-csv";

// ---------------------------------------------------------------------------
// Input shape — a plain data bag so `assembleExportFiles` stays pure/testable.
// ---------------------------------------------------------------------------

interface TitleRef {
	title: string;
	year: number | null;
	tmdbId: number;
}

export interface ExportInput {
	profile: {
		handle: string;
		displayName: string;
		bio: string | null;
		pronouns: string | null;
		location: string | null;
		website: string | null;
		joinedAt: Date | string;
		email: string;
	};
	favoriteFilms: TitleRef[];
	filmLogs: Array<
		TitleRef & {
			watchedAt: Date | string;
			createdAt: Date | string;
			rating: number | null;
			rewatch: boolean;
			liked: boolean;
			note: string | null;
		}
	>;
	tvLogs: Array<
		TitleRef & {
			watchedAt: Date | string;
			createdAt: Date | string;
			rating: number | null;
			rewatch: boolean;
			liked: boolean;
			note: string | null;
			logScope: string;
			seasonNumber: number | null;
			episodeNumber: number | null;
		}
	>;
	filmWatchlist: Array<TitleRef & { addedAt: Date | string }>;
	tvWatchlist: Array<TitleRef & { addedAt: Date | string }>;
	tvProgress: Array<
		TitleRef & {
			status: string;
			lastSeason: number | null;
			lastEpisode: number | null;
			startedAt: Date | string;
			statusChangedAt: Date | string;
		}
	>;
	reviews: Array<
		TitleRef & {
			reviewTitle: string | null;
			body: string;
			rating: number | null;
			containsSpoilers: boolean;
			publishedAt: Date | string;
			watchedAt: Date | string | null;
		}
	>;
	lists: Array<{
		title: string;
		description: string | null;
		isRanked: boolean;
		items: Array<{
			position: number;
			title: string;
			year: number | null;
			tmdbId: number;
			mediaType: "film" | "tv";
			note: string | null;
			addedAt: Date | string;
		}>;
	}>;
	comments: Array<{
		parentType: string;
		parentId: string;
		body: string;
		createdAt: Date | string;
	}>;
	likedReviews: Array<{
		reviewId: string;
		movieTitle: string | null;
		likedAt: Date | string;
	}>;
	likedLists: Array<{
		listId: string;
		listTitle: string | null;
		likedAt: Date | string;
	}>;
}

export interface ExportFile {
	path: string;
	contents: string;
}

// ---------------------------------------------------------------------------
// Pure assembly
// ---------------------------------------------------------------------------

function ratingColumns(stored: number | null): [CsvValue, CsvValue] {
	if (stored == null) return ["", ""];
	const displayTen = storedRatingToDisplayTen(stored);
	return [
		displayTenToLetterboxdStars(displayTen),
		formatRatingTenDisplay(displayTen),
	];
}

/** `lists/<slug>.csv` filename — ascii-safe, deduped with `-2`, `-3`, ... */
function listSlug(title: string, used: Set<string>): string {
	const base =
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "list";
	let slug = base;
	let n = 2;
	while (used.has(slug)) {
		slug = `${base}-${n}`;
		n += 1;
	}
	used.add(slug);
	return slug;
}

export function assembleExportFiles(input: ExportInput): ExportFile[] {
	const files: ExportFile[] = [];

	files.push({
		path: "profile.csv",
		contents: buildCsv(
			[
				"Date Joined",
				"Username",
				"Display Name",
				"Email Address",
				"Location",
				"Website",
				"Bio",
				"Pronoun",
				"Favorite Films",
			],
			[
				[
					exportDateKey(input.profile.joinedAt),
					input.profile.handle,
					input.profile.displayName,
					input.profile.email,
					input.profile.location,
					input.profile.website,
					input.profile.bio,
					input.profile.pronouns,
					input.favoriteFilms.map((f) => f.title).join(", "),
				],
			],
		),
	});

	files.push({
		path: "diary.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID", "Rating", "Rating10", "Rewatch", "Watched Date"],
			input.filmLogs.map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.createdAt),
					row.title,
					row.year,
					row.tmdbId,
					stars,
					ten,
					row.rewatch,
					exportDateKey(row.watchedAt),
				];
			}),
		),
	});

	// watched.csv — one row per distinct film (first watch date).
	const watchedByFilm = new Map<number, (typeof input.filmLogs)[number]>();
	for (const row of input.filmLogs) {
		const existing = watchedByFilm.get(row.tmdbId);
		if (
			!existing ||
			new Date(row.watchedAt).getTime() < new Date(existing.watchedAt).getTime()
		) {
			watchedByFilm.set(row.tmdbId, row);
		}
	}
	files.push({
		path: "watched.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			[...watchedByFilm.values()].map((row) => [
				exportDateKey(row.watchedAt),
				row.title,
				row.year,
				row.tmdbId,
			]),
		),
	});

	// ratings.csv — latest rated log per film.
	const latestRatedByFilm = new Map<number, (typeof input.filmLogs)[number]>();
	for (const row of input.filmLogs) {
		if (row.rating == null) continue;
		const existing = latestRatedByFilm.get(row.tmdbId);
		if (
			!existing ||
			new Date(row.watchedAt).getTime() >= new Date(existing.watchedAt).getTime()
		) {
			latestRatedByFilm.set(row.tmdbId, row);
		}
	}
	files.push({
		path: "ratings.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID", "Rating", "Rating10"],
			[...latestRatedByFilm.values()].map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.watchedAt),
					row.title,
					row.year,
					row.tmdbId,
					stars,
					ten,
				];
			}),
		),
	});

	files.push({
		path: "watchlist.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			input.filmWatchlist.map((row) => [
				exportDateKey(row.addedAt),
				row.title,
				row.year,
				row.tmdbId,
			]),
		),
	});

	files.push({
		path: "reviews.csv",
		contents: buildCsv(
			[
				"Date",
				"Name",
				"Year",
				"TMDb ID",
				"Review Title",
				"Review",
				"Rating",
				"Rating10",
				"Contains Spoilers",
				"Watched Date",
			],
			input.reviews.map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.publishedAt),
					row.title,
					row.year,
					row.tmdbId,
					row.reviewTitle,
					row.body,
					stars,
					ten,
					row.containsSpoilers,
					exportDateKey(row.watchedAt),
				];
			}),
		),
	});

	files.push({
		path: "tv-diary.csv",
		contents: buildCsv(
			[
				"Date",
				"Name",
				"Year",
				"TMDb ID",
				"Scope",
				"Season",
				"Episode",
				"Rating",
				"Rating10",
				"Rewatch",
				"Watched Date",
			],
			input.tvLogs.map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.createdAt),
					row.title,
					row.year,
					row.tmdbId,
					row.logScope,
					row.seasonNumber,
					row.episodeNumber,
					stars,
					ten,
					row.rewatch,
					exportDateKey(row.watchedAt),
				];
			}),
		),
	});

	files.push({
		path: "tv-watchlist.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			input.tvWatchlist.map((row) => [
				exportDateKey(row.addedAt),
				row.title,
				row.year,
				row.tmdbId,
			]),
		),
	});

	files.push({
		path: "tv-progress.csv",
		contents: buildCsv(
			[
				"Name",
				"Year",
				"TMDb ID",
				"Status",
				"Last Season",
				"Last Episode",
				"Started",
				"Status Changed",
			],
			input.tvProgress.map((row) => [
				row.title,
				row.year,
				row.tmdbId,
				row.status,
				row.lastSeason,
				row.lastEpisode,
				exportDateKey(row.startedAt),
				exportDateKey(row.statusChangedAt),
			]),
		),
	});

	const usedSlugs = new Set<string>();
	for (const owned of input.lists) {
		files.push({
			path: `lists/${listSlug(owned.title, usedSlugs)}.csv`,
			contents: buildCsv(
				["Position", "Name", "Year", "TMDb ID", "Type", "Note", "Added"],
				owned.items.map((item) => [
					owned.isRanked ? item.position + 1 : "",
					item.title,
					item.year,
					item.tmdbId,
					item.mediaType,
					item.note,
					exportDateKey(item.addedAt),
				]),
			),
		});
	}

	files.push({
		path: "comments.csv",
		contents: buildCsv(
			["Date", "On", "Target Id", "Comment"],
			input.comments.map((row) => [
				exportDateKey(row.createdAt),
				row.parentType,
				row.parentId,
				row.body,
			]),
		),
	});

	files.push({
		path: "likes/films.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			input.filmLogs
				.filter((row) => row.liked)
				.map((row) => [
					exportDateKey(row.watchedAt),
					row.title,
					row.year,
					row.tmdbId,
				]),
		),
	});

	files.push({
		path: "likes/reviews.csv",
		contents: buildCsv(
			["Date", "Review Id", "Film"],
			input.likedReviews.map((row) => [
				exportDateKey(row.likedAt),
				row.reviewId,
				row.movieTitle,
			]),
		),
	});

	files.push({
		path: "likes/lists.csv",
		contents: buildCsv(
			["Date", "List Id", "List"],
			input.likedLists.map((row) => [
				exportDateKey(row.likedAt),
				row.listId,
				row.listTitle,
			]),
		),
	});

	return files;
}

// ---------------------------------------------------------------------------
// DB fetch — thin queries, no formatting. Not unit-tested (covered manually
// and by the pure assembly tests above).
// ---------------------------------------------------------------------------

export async function fetchExportInput(userId: string): Promise<ExportInput> {
	const [profileRow] = await db
		.select({
			handle: profile.handle,
			displayName: profile.displayName,
			bio: profile.bio,
			pronouns: profile.pronouns,
			location: profile.location,
			website: profile.website,
			favoriteMovieIds: profile.favoriteMovieIds,
			createdAt: profile.createdAt,
		})
		.from(profile)
		.where(eq(profile.userId, userId));
	if (!profileRow) throw new Error("PROFILE_NOT_FOUND");

	const [userRow] = await db
		.select({ email: user.email, createdAt: user.createdAt })
		.from(user)
		.where(eq(user.id, userId));

	const favoriteFilms =
		profileRow.favoriteMovieIds.length > 0
			? await db
					.select({ title: movie.title, year: movie.year, tmdbId: movie.tmdbId })
					.from(movie)
					.where(inArray(movie.tmdbId, profileRow.favoriteMovieIds))
			: [];

	const filmLogs = await db
		.select({
			title: movie.title,
			year: movie.year,
			tmdbId: movie.tmdbId,
			watchedAt: log.watchedAt,
			createdAt: log.createdAt,
			rating: log.rating,
			rewatch: log.rewatch,
			liked: log.liked,
			note: log.note,
		})
		.from(log)
		.innerJoin(movie, eq(log.movieId, movie.tmdbId))
		.where(
			and(eq(log.userId, userId), isNotNull(log.movieId), isNull(log.removedAt)),
		)
		.orderBy(asc(log.watchedAt), asc(log.createdAt));

	const tvLogs = await db
		.select({
			title: tv.title,
			year: tv.year,
			tmdbId: tv.tmdbId,
			watchedAt: log.watchedAt,
			createdAt: log.createdAt,
			rating: log.rating,
			rewatch: log.rewatch,
			liked: log.liked,
			note: log.note,
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			episodeNumber: log.episodeNumber,
		})
		.from(log)
		.innerJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(
			and(eq(log.userId, userId), isNotNull(log.tvId), isNull(log.removedAt)),
		)
		.orderBy(asc(log.watchedAt), asc(log.createdAt));

	const filmWatchlist = await db
		.select({
			title: movie.title,
			year: movie.year,
			tmdbId: movie.tmdbId,
			addedAt: watchlistItem.addedAt,
		})
		.from(watchlistItem)
		.innerJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
		.where(and(eq(watchlistItem.userId, userId), isNotNull(watchlistItem.movieId)))
		.orderBy(asc(watchlistItem.addedAt));

	const tvWatchlist = await db
		.select({
			title: tv.title,
			year: tv.year,
			tmdbId: tv.tmdbId,
			addedAt: watchlistItem.addedAt,
		})
		.from(watchlistItem)
		.innerJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
		.where(and(eq(watchlistItem.userId, userId), isNotNull(watchlistItem.tvId)))
		.orderBy(asc(watchlistItem.addedAt));

	const tvProgress = await db
		.select({
			title: tv.title,
			year: tv.year,
			tmdbId: tv.tmdbId,
			status: tvWatch.status,
			lastSeason: tvWatch.lastSeason,
			lastEpisode: tvWatch.lastEpisode,
			startedAt: tvWatch.startedAt,
			statusChangedAt: tvWatch.statusChangedAt,
		})
		.from(tvWatch)
		.innerJoin(tv, eq(tvWatch.tvId, tv.tmdbId))
		.where(eq(tvWatch.userId, userId))
		.orderBy(asc(tvWatch.startedAt));

	const reviews = await db
		.select({
			title: movie.title,
			year: movie.year,
			tmdbId: movie.tmdbId,
			reviewTitle: review.title,
			body: review.body,
			rating: review.rating,
			containsSpoilers: review.containsSpoilers,
			publishedAt: review.publishedAt,
			watchedAt: log.watchedAt,
		})
		.from(review)
		.innerJoin(movie, eq(review.movieId, movie.tmdbId))
		.leftJoin(log, eq(review.logId, log.id))
		.where(and(eq(review.userId, userId), isNull(review.removedAt)))
		.orderBy(asc(review.publishedAt));

	const ownedLists = await db
		.select({
			id: list.id,
			title: list.title,
			description: list.description,
			isRanked: list.isRanked,
		})
		.from(list)
		.where(and(eq(list.userId, userId), isNull(list.removedAt)))
		.orderBy(asc(list.createdAt));

	const listsWithItems: ExportInput["lists"] = [];
	for (const owned of ownedLists) {
		const movieItems = await db
			.select({
				position: listItem.position,
				title: movie.title,
				year: movie.year,
				tmdbId: movie.tmdbId,
				note: listItem.note,
				addedAt: listItem.addedAt,
			})
			.from(listItem)
			.innerJoin(movie, eq(listItem.movieId, movie.tmdbId))
			.where(and(eq(listItem.listId, owned.id), isNotNull(listItem.movieId)));
		const tvItems = await db
			.select({
				position: listItem.position,
				title: tv.title,
				year: tv.year,
				tmdbId: tv.tmdbId,
				note: listItem.note,
				addedAt: listItem.addedAt,
			})
			.from(listItem)
			.innerJoin(tv, eq(listItem.tvId, tv.tmdbId))
			.where(and(eq(listItem.listId, owned.id), isNotNull(listItem.tvId)));
		listsWithItems.push({
			title: owned.title,
			description: owned.description,
			isRanked: owned.isRanked,
			items: [
				...movieItems.map((i) => ({ ...i, mediaType: "film" as const })),
				...tvItems.map((i) => ({ ...i, mediaType: "tv" as const })),
			].sort(
				(a, b) =>
					a.position - b.position ||
					new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
			),
		});
	}

	const comments = await db
		.select({
			parentType: comment.parentType,
			parentId: comment.parentId,
			body: comment.body,
			createdAt: comment.createdAt,
		})
		.from(comment)
		.where(and(eq(comment.userId, userId), isNull(comment.deletedAt)))
		.orderBy(asc(comment.createdAt));

	const likedReviews = await db
		.select({
			reviewId: reaction.parentId,
			movieTitle: movie.title,
			likedAt: reaction.createdAt,
		})
		.from(reaction)
		.leftJoin(review, eq(reaction.parentId, review.id))
		.leftJoin(movie, eq(review.movieId, movie.tmdbId))
		.where(
			and(
				eq(reaction.userId, userId),
				eq(reaction.parentType, "review"),
				eq(reaction.kind, "like"),
			),
		)
		.orderBy(asc(reaction.createdAt));

	const likedLists = await db
		.select({
			listId: reaction.parentId,
			listTitle: list.title,
			likedAt: reaction.createdAt,
		})
		.from(reaction)
		.leftJoin(list, eq(reaction.parentId, list.id))
		.where(
			and(
				eq(reaction.userId, userId),
				eq(reaction.parentType, "list"),
				eq(reaction.kind, "like"),
			),
		)
		.orderBy(asc(reaction.createdAt));

	return {
		profile: {
			handle: profileRow.handle,
			displayName: profileRow.displayName,
			bio: profileRow.bio,
			pronouns: profileRow.pronouns,
			location: profileRow.location,
			website: profileRow.website,
			joinedAt: userRow?.createdAt ?? profileRow.createdAt,
			email: userRow?.email ?? "",
		},
		favoriteFilms,
		filmLogs,
		tvLogs,
		filmWatchlist,
		tvWatchlist,
		tvProgress,
		reviews,
		lists: listsWithItems,
		comments,
		likedReviews,
		likedLists,
	};
}
```

Also add `inArray` to the `drizzle-orm` import at the top of the file (the
`favoriteFilms` call site guards `length > 0`, so `inArray` never receives an
empty array — Drizzle throws on empty arrays at runtime).

- [ ] **Step 4.4: Run tests to verify they pass**

Run (working directory `apps/server`): `bun test src/lib/me-export-data.test.ts`
Expected: PASS (all tests). If `tv-diary.csv` ordering or empty-rating assertions
fail, fix the assembly (not the test) — the test encodes the spec.

- [ ] **Step 4.5: Commit**

```bash
git add apps/server/src/lib/me-export-data.ts apps/server/src/lib/me-export-data.test.ts
git commit -m "feat(server): export data fetch + pure Letterboxd-style file assembly"
```

---

### Task 5: Clear-library transaction

**Files:**
- Create: `apps/server/src/lib/clear-user-library.ts`

This is a single transaction; correctness is enforced by the route tests in
Task 6 (auth gating, response shape) plus the manual pass at the end. The
deletes rely on FKs already declared `cascade` in the schema.

- [ ] **Step 5.1: Implement the transaction**

Create `apps/server/src/lib/clear-user-library.ts`:

```ts
import {
	db,
	eventLog,
	LIST_SYSTEM_KIND_FAVORITES,
	list,
	listItem,
	log,
	profile,
	tasteDismissedMovie,
	tvWatch,
	userAchievement,
	userBadge,
	userCompletionistChallenge,
	userStreak,
	watchlistItem,
} from "@still/db";
import { and, eq } from "drizzle-orm";

export interface ClearLibraryCounts {
	logs: number;
	watchlist: number;
	tvProgress: number;
	favorites: number;
	badges: number;
	achievements: number;
	challenges: number;
}

/**
 * Wipe the patron's watch library in one transaction:
 * diary logs (film + TV), watchlist, TV progress, streak, taste dismissals,
 * and all diary-derived gamification (badges, achievement progress, challenge
 * enrollments, unprocessed event-log rows). The system Favorites list is
 * emptied (membership derives from `log.liked`) but the list row stays.
 *
 * Kept: reviews (their `log_id` FK is `set null`), comments, lists + items,
 * list likes, follows, profile, settings, notifications, product events.
 */
export async function clearUserLibrary(
	userId: string,
): Promise<ClearLibraryCounts> {
	return await db.transaction(async (tx) => {
		// Favorites first — membership derives from log.liked hearts.
		const [favoritesList] = await tx
			.select({ id: list.id })
			.from(list)
			.where(
				and(
					eq(list.userId, userId),
					eq(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
				),
			);
		let favorites = 0;
		if (favoritesList) {
			const removed = await tx
				.delete(listItem)
				.where(eq(listItem.listId, favoritesList.id))
				.returning({ id: listItem.id });
			favorites = removed.length;
			await tx
				.update(list)
				.set({
					itemsCount: 0,
					movieItemsCount: 0,
					tvItemsCount: 0,
					coverMovieIds: [],
					coverTvIds: [],
					coverMovieId: null,
					coverTvId: null,
				})
				.where(eq(list.id, favoritesList.id));
		}

		// Diary logs — film and all TV scopes. `review.log_id` is ON DELETE SET
		// NULL, so published reviews keep their mirrored rating.
		const logs = await tx
			.delete(log)
			.where(eq(log.userId, userId))
			.returning({ id: log.id });

		const watchlist = await tx
			.delete(watchlistItem)
			.where(eq(watchlistItem.userId, userId))
			.returning({ addedAt: watchlistItem.addedAt });

		// tv_watch_episode cascades from tv_watch.
		const tvProgress = await tx
			.delete(tvWatch)
			.where(eq(tvWatch.userId, userId))
			.returning({ id: tvWatch.id });

		await tx.delete(userStreak).where(eq(userStreak.userId, userId));
		await tx
			.delete(tasteDismissedMovie)
			.where(eq(tasteDismissedMovie.userId, userId));

		const badges = await tx
			.delete(userBadge)
			.where(eq(userBadge.userId, userId))
			.returning({ badgeId: userBadge.badgeId });
		const achievements = await tx
			.delete(userAchievement)
			.where(eq(userAchievement.userId, userId))
			.returning({ achievementId: userAchievement.achievementId });
		const challenges = await tx
			.delete(userCompletionistChallenge)
			.where(eq(userCompletionistChallenge.userId, userId))
			.returning({ challengeId: userCompletionistChallenge.challengeId });
		await tx.delete(eventLog).where(eq(eventLog.userId, userId));

		// Reset diary-derived profile caches so heroes/stats don't show ghosts.
		await tx
			.update(profile)
			.set({
				statsCache: {},
				tasteSignature: null,
				tasteSignatureComputedAt: null,
			})
			.where(eq(profile.userId, userId));

		return {
			logs: logs.length,
			watchlist: watchlist.length,
			tvProgress: tvProgress.length,
			favorites,
			badges: badges.length,
			achievements: achievements.length,
			challenges: challenges.length,
		};
	});
}
```

Note: verify the exact exported names from `@still/db` before writing imports —
`bun run` a quick grep: `rg "export \*|export \{" packages/db/src/index.ts`. If
schema tables are re-exported via `export * from "./schema/..."`, the names
above (`userStreak`, `tasteDismissedMovie`, `userBadge`, `userAchievement`,
`eventLog`, `userCompletionistChallenge`) match the schema files. If any are
missing from the package barrel, add them to the barrel rather than importing
deep paths.

- [ ] **Step 5.2: Type-check**

Run (working directory `apps/server`): `bunx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5.3: Commit**

```bash
git add apps/server/src/lib/clear-user-library.ts
git commit -m "feat(server): single-transaction clear of patron watch library"
```

---

### Task 6: `/api/me` route group (export ZIP + clear library)

**Files:**
- Create: `apps/server/src/routes/me-data.ts`
- Create: `apps/server/src/routes/me-data.test.ts`
- Modify: `apps/server/src/server/app.ts`
- Modify: `apps/server/package.json` (via `bun add fflate`)

- [ ] **Step 6.1: Add fflate**

Run (working directory `apps/server`):

```bash
bun add fflate
```

- [ ] **Step 6.2: Write the failing route tests**

Create `apps/server/src/routes/me-data.test.ts`. The libs are mocked so tests
cover the route contract: auth gating, rate limiting, ZIP headers, response
shape. (`mock.module` is process-global in Bun — mock only OUR lib modules,
never `drizzle-orm` or `@still/db` internals used by other tests.)

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { unzipSync } from "fflate";

// --- Mock state -------------------------------------------------------------
const state = {
	user: null as { id: string } | null,
	clearCalls: [] as string[],
	exportCalls: [] as string[],
};

// The route factory takes a `deriveUser` seam, so the real `context` plugin is
// never touched here — mock only OUR two lib modules.
mock.module("../lib/me-export-data", () => ({
	fetchExportInput: async (userId: string) => {
		state.exportCalls.push(userId);
		return { profile: { handle: "adgv" } };
	},
	assembleExportFiles: () => [
		{ path: "diary.csv", contents: "Date,Name\n" },
		{ path: "likes/films.csv", contents: "Date,Name\n" },
	],
}));

mock.module("../lib/clear-user-library", () => ({
	clearUserLibrary: async (userId: string) => {
		state.clearCalls.push(userId);
		return {
			logs: 3,
			watchlist: 2,
			tvProgress: 1,
			favorites: 1,
			badges: 4,
			achievements: 2,
			challenges: 1,
		};
	},
}));

import { buildMeDataRoute } from "./me-data";

function makeApp(user: { id: string } | null) {
	return buildMeDataRoute({
		deriveUser: () => user,
		exportRateLimit: { limit: 3, windowMs: 60 * 60_000 },
	});
}

beforeEach(() => {
	state.user = null;
	state.clearCalls = [];
	state.exportCalls = [];
});

describe("GET /api/me/export", () => {
	test("401 when signed out", async () => {
		const res = await makeApp(null).handle(
			new Request("http://test/api/me/export"),
		);
		expect(res.status).toBe(401);
	});

	test("returns a zip with content-disposition and the assembled files", async () => {
		const res = await makeApp({ id: "user_1" }).handle(
			new Request("http://test/api/me/export"),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/zip");
		expect(res.headers.get("content-disposition")).toContain(
			'filename="sense-export-adgv-',
		);
		const bytes = new Uint8Array(await res.arrayBuffer());
		const unzipped = unzipSync(bytes);
		expect(Object.keys(unzipped).sort()).toEqual([
			"diary.csv",
			"likes/films.csv",
		]);
		expect(state.exportCalls).toEqual(["user_1"]);
	});

	test("429 after the rate limit", async () => {
		const app = buildMeDataRoute({
			deriveUser: () => ({ id: "user_rate" }),
			exportRateLimit: { limit: 1, windowMs: 60 * 60_000 },
		});
		const first = await app.handle(new Request("http://test/api/me/export"));
		expect(first.status).toBe(200);
		const second = await app.handle(new Request("http://test/api/me/export"));
		expect(second.status).toBe(429);
	});
});

describe("DELETE /api/me/library", () => {
	test("401 when signed out", async () => {
		const res = await makeApp(null).handle(
			new Request("http://test/api/me/library", { method: "DELETE" }),
		);
		expect(res.status).toBe(401);
	});

	test("clears and returns per-category counts", async () => {
		const res = await makeApp({ id: "user_2" }).handle(
			new Request("http://test/api/me/library", { method: "DELETE" }),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			ok: boolean;
			counts: Record<string, number>;
		};
		expect(body.ok).toBe(true);
		expect(body.counts.logs).toBe(3);
		expect(state.clearCalls).toEqual(["user_2"]);
	});
});
```

- [ ] **Step 6.3: Run tests to verify they fail**

Run (working directory `apps/server`): `bun test src/routes/me-data.test.ts`
Expected: FAIL — `./me-data` not found.

- [ ] **Step 6.4: Implement the route**

Create `apps/server/src/routes/me-data.ts`. The route is built by a small
factory so tests can inject the user-derive and rate-limit config; the exported
`meDataRoute` wires the real `context` plugin.

```ts
import { strToU8, zipSync } from "fflate";
import { Elysia } from "elysia";

import { context } from "../context";
import { clearUserLibrary } from "../lib/clear-user-library";
import { assembleExportFiles, fetchExportInput } from "../lib/me-export-data";
import { hit } from "../lib/rate-limit";

interface MeDataRouteOptions {
	/** Test seam — production uses the `context` plugin's session user. */
	deriveUser?: () => { id: string } | null;
	exportRateLimit?: { limit: number; windowMs: number };
}

const EXPORT_RATE_LIMIT = { limit: 3, windowMs: 60 * 60_000 };

/**
 * Patron data controls (spec 2026-06-09): synchronous in-memory ZIP export and
 * the clear-library transaction. Account deletion lives in Better Auth
 * (`/api/auth/delete-user/*`), not here.
 */
export function buildMeDataRoute(options: MeDataRouteOptions = {}) {
	const limits = options.exportRateLimit ?? EXPORT_RATE_LIMIT;

	let app = new Elysia({ prefix: "/api/me", tags: ["me"] });
	if (options.deriveUser) {
		const derive = options.deriveUser;
		app = app.derive(() => ({ user: derive() })) as typeof app;
	} else {
		app = app.use(context) as typeof app;
	}

	return app
		.get("/export", async ({ user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`me:export:${user.id}`, limits).ok) {
				return status(429, "Export limit reached — try again in an hour");
			}

			const input = await fetchExportInput(user.id);
			const files = assembleExportFiles(input);
			const zipped = zipSync(
				Object.fromEntries(files.map((f) => [f.path, strToU8(f.contents)])),
			);

			const date = new Date().toISOString().slice(0, 10);
			const handle = input.profile.handle;
			return new Response(zipped.buffer as ArrayBuffer, {
				headers: {
					"content-type": "application/zip",
					"content-disposition": `attachment; filename="sense-export-${handle}-${date}.zip"`,
				},
			});
		})
		.delete("/library", async ({ user, status }) => {
			if (!user) return status(401, "Sign in");
			const counts = await clearUserLibrary(user.id);
			return { ok: true as const, counts };
		});
}

export const meDataRoute = buildMeDataRoute();
```

Implementation notes:
- If the `app = app.derive(...) as typeof app` dance fights Elysia's types,
  restructure: build the two handlers as standalone functions taking
  `(user, status)` and define two separate `new Elysia()` chains (one for prod
  with `context`, one factory branch for tests). Do not weaken types with `any`.
- `zipSync` returns `Uint8Array`; `new Response(zipped)` also works in Bun if
  the `.buffer` cast bothers TypeScript.

- [ ] **Step 6.5: Run tests to verify they pass**

Run (working directory `apps/server`): `bun test src/routes/me-data.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6.6: Register the route**

In `apps/server/src/server/app.ts`:

Add the import (alphabetical with the others):

```ts
import { meDataRoute } from "../routes/me-data";
```

Add `.use(meDataRoute)` after `.use(importRoute)`:

```ts
	.use(importRoute)
	.use(meDataRoute)
```

- [ ] **Step 6.7: Run the full server test suite**

Run (working directory `apps/server`): `bun test`
Expected: all suites pass (no `mock.module` leakage into other route tests —
if `lists.test.ts` or `staff.test.ts` start failing, the me-data test mocked
something shared; restrict mocks to `../lib/me-export-data` and
`../lib/clear-user-library` only).

- [ ] **Step 6.8: Commit**

```bash
git add apps/server/src/routes/me-data.ts apps/server/src/routes/me-data.test.ts apps/server/src/server/app.ts apps/server/package.json bun.lock
git commit -m "feat(server): GET /api/me/export zip + DELETE /api/me/library"
```

---

### Task 7: Web — rename Imports to Data

**Files:**
- Modify: `apps/web/src/lib/me-account-nav.ts`
- Create: `apps/web/src/app/(app)/me/settings/data/page.tsx`
- Modify: `apps/web/src/app/(app)/me/settings/imports/page.tsx`
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`

- [ ] **Step 7.1: Update the nav**

In `apps/web/src/lib/me-account-nav.ts`, replace the Imports entry:

```ts
	{ href: "/me/settings/data", label: "Data" },
```

(keep its position — fifth item, where Imports was). Then extend
`resolveMeAccountNavPath` so legacy `/me/settings/imports` links resolve to
Data. Replace the function body with:

```ts
export function resolveMeAccountNavPath(pathname: string): string {
	if (pathname === "/me/settings" || pathname === "/me/settings/") {
		return ME_ACCOUNT_SETTINGS_HOME_HREF;
	}
	// Legacy route — the Imports tab became Data (import + export + danger zone).
	if (
		pathname === "/me/settings/imports" ||
		pathname.startsWith("/me/settings/imports/")
	) {
		return "/me/settings/data";
	}
	const match = ME_ACCOUNT_NAV_ITEMS.find(
		(item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
	);
	if (match) return match.href;
	if (pathname.startsWith("/me/settings/")) {
		return ME_ACCOUNT_SETTINGS_HOME_HREF;
	}
	return pathname;
}
```

- [ ] **Step 7.2: Add the Data page, redirect the old route**

Create `apps/web/src/app/(app)/me/settings/data/page.tsx`:

```tsx
import { SettingsDataSection } from "@/components/profile/settings-section-panels";

export default function SettingsDataPage() {
	return <SettingsDataSection />;
}
```

Replace the contents of `apps/web/src/app/(app)/me/settings/imports/page.tsx`:

```tsx
import { redirect } from "next/navigation";

/** Legacy route — the Imports tab became Data (import + export + danger zone). */
export default function SettingsImportsPage() {
	redirect("/me/settings/data");
}
```

- [ ] **Step 7.3: Rename the section component**

In `apps/web/src/components/profile/settings-section-panels.tsx`, replace
`SettingsImportsSection` with (new imports for the two components created in
Tasks 8–9 — add them now; the files come next):

```tsx
import { MeDangerZone } from "@/components/profile/me-danger-zone";
import { MeDataExportPanel } from "@/components/profile/me-data-export-panel";

export function SettingsDataSection() {
	return (
		<SettingsSectionPage>
			<MeLetterboxdImport />
			<MeAnilistImport />
			<MeDataExportPanel />
			<MeDangerZone />
		</SettingsSectionPage>
	);
}
```

Check for other references: `rg "SettingsImportsSection" apps/web/src` — update
any remaining import sites (the old `imports/page.tsx` no longer references it
after Step 7.2).

- [ ] **Step 7.4: Commit** (build will be verified after Tasks 8–9 since the new
components don't exist yet — commit together with Task 8 if you prefer a
compiling tree per commit; otherwise stub the two components as
`export function MeDataExportPanel() { return null; }` /
`export function MeDangerZone() { return null; }` placeholders in this commit
and fill them in the next tasks)

Stub approach (keeps every commit compiling):

Create `apps/web/src/components/profile/me-data-export-panel.tsx`:

```tsx
"use client";

export function MeDataExportPanel() {
	return null;
}
```

Create `apps/web/src/components/profile/me-danger-zone.tsx`:

```tsx
"use client";

export function MeDangerZone() {
	return null;
}
```

```bash
git add apps/web/src/lib/me-account-nav.ts "apps/web/src/app/(app)/me/settings/data/page.tsx" "apps/web/src/app/(app)/me/settings/imports/page.tsx" apps/web/src/components/profile/settings-section-panels.tsx apps/web/src/components/profile/me-data-export-panel.tsx apps/web/src/components/profile/me-danger-zone.tsx
git commit -m "feat(web): rename Imports settings tab to Data with legacy redirect"
```

---

### Task 8: Export panel (web)

**Files:**
- Modify: `apps/web/src/components/profile/me-data-export-panel.tsx`

- [ ] **Step 8.1: Implement the panel**

Replace the stub. Pattern-match `MeLetterboxdImport` for section/panel chrome;
inline feedback only (no toast). Uses `stillApiOrigin()` so session cookies ride
along (NOT raw `NEXT_PUBLIC_SERVER_URL`).

```tsx
"use client";

import { Button } from "@still/ui/components/button";
import { Check, CircleAlert, Download } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import { stillApiOrigin } from "@/lib/still-api-origin";

type ExportState =
	| { phase: "idle" }
	| { phase: "generating" }
	| { phase: "done"; filename: string }
	| { phase: "error"; message: string };

function filenameFromDisposition(header: string | null): string {
	const match = header?.match(/filename="([^"]+)"/);
	return match?.[1] ?? "sense-export.zip";
}

/**
 * Patron data export (Data settings) — synchronous ZIP download of
 * Letterboxd-style CSVs from `GET /api/me/export`.
 */
export function MeDataExportPanel() {
	const reduceMotion = useReducedMotion();
	const [state, setState] = useState<ExportState>({ phase: "idle" });

	const feedbackMotion = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] as const };

	async function runExport() {
		if (state.phase === "generating") return;
		setState({ phase: "generating" });
		try {
			const res = await fetch(`${stillApiOrigin()}/api/me/export`, {
				credentials: "include",
			});
			if (res.status === 429) {
				setState({
					phase: "error",
					message: "Export limit reached — try again in an hour.",
				});
				return;
			}
			if (!res.ok) {
				setState({
					phase: "error",
					message: "Export failed — please try again.",
				});
				return;
			}
			const filename = filenameFromDisposition(
				res.headers.get("content-disposition"),
			);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.click();
			URL.revokeObjectURL(url);
			setState({ phase: "done", filename });
		} catch {
			setState({
				phase: "error",
				message: "Export failed — check your connection and try again.",
			});
		}
	}

	return (
		<MeSettingsSection
			title="Export"
			description="Download everything you've added to Sense as CSV files — diary, ratings, watchlist, reviews, lists, and TV progress."
		>
			<MeSettingsPanel className="flex flex-col gap-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
						Film CSVs use the Letterboxd layout, so they re-import anywhere. TV
						data ships in separate files.
					</p>
					<Button
						type="button"
						size="pill"
						onClick={() => void runExport()}
						disabled={state.phase === "generating"}
						className="min-w-44"
					>
						<Download className="size-4" aria-hidden />
						{state.phase === "generating" ? "Preparing…" : "Export my data"}
					</Button>
				</div>
				<AnimatePresence mode="wait" initial={false}>
					{state.phase === "done" ? (
						<motion.p
							key="done"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={feedbackMotion}
							className="flex items-center gap-2 text-emerald-500 text-sm"
						>
							<Check className="size-4" aria-hidden />
							Saved {state.filename}
						</motion.p>
					) : null}
					{state.phase === "error" ? (
						<motion.p
							key="error"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={feedbackMotion}
							className="flex items-center gap-2 text-destructive text-sm"
						>
							<CircleAlert className="size-4" aria-hidden />
							{state.message}
						</motion.p>
					) : null}
				</AnimatePresence>
			</MeSettingsPanel>
		</MeSettingsSection>
	);
}
```

Note: check `MeSettingsSection`'s actual props in
`apps/web/src/components/profile/me-settings-layout.tsx` before wiring
(`title` / `description` are used by every sibling panel — match exactly). Match
the existing success/error color tokens used by `MeLetterboxdImport` (open it
and reuse its classes if they differ from `text-emerald-500` /
`text-destructive`).

- [ ] **Step 8.2: Verify lints**

Run lints on the file (ReadLints or `bunx biome check apps/web/src/components/profile/me-data-export-panel.tsx`).
Expected: clean.

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/components/profile/me-data-export-panel.tsx
git commit -m "feat(web): data export panel with inline download feedback"
```

---

### Task 9: Danger zone — clear library + delete account dialogs

**Files:**
- Create: `apps/web/src/components/profile/me-destructive-confirm-dialog.tsx`
- Create: `apps/web/src/components/profile/me-clear-library-dialog.tsx`
- Create: `apps/web/src/components/profile/me-delete-account-dialog.tsx`
- Modify: `apps/web/src/components/profile/me-danger-zone.tsx`

- [ ] **Step 9.1: Shared destructive confirm dialog shell**

Create `apps/web/src/components/profile/me-destructive-confirm-dialog.tsx` —
the `MeAccountLeaveConfirmDialog` visual pattern (centered rounded `bg-card`
panel, icon circle, stacked copy) extended with a type-to-confirm input and
slots for body content. Modal layering uses `APP_MODAL_OVERLAY_CLASS`.

```tsx
"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { cn } from "@still/ui/lib/utils";
import { TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useState } from "react";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/**
 * Centered destructive confirmation with a type-to-confirm gate — shared by
 * Clear library data and Delete account (Data settings danger zone).
 */
export function MeDestructiveConfirmDialog({
	open,
	title,
	confirmPhrase,
	confirmLabel,
	busyLabel,
	isBusy,
	error,
	onClose,
	onConfirm,
	children,
}: {
	open: boolean;
	title: string;
	/** Exact phrase the patron must type, e.g. "clear my library". */
	confirmPhrase: string;
	confirmLabel: string;
	busyLabel: string;
	isBusy: boolean;
	error: string | null;
	onClose: () => void;
	onConfirm: () => void;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const inputId = useId();
	const [typed, setTyped] = useState("");
	const confirmed = typed.trim().toLowerCase() === confirmPhrase;

	useEffect(() => {
		if (!open) setTyped("");
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	const handleKey = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape" && !isBusy) onClose();
		},
		[onClose, isBusy],
	);
	useEffect(() => {
		if (!open) return;
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [open, handleKey]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	return (
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"grid place-items-center overflow-y-auto overscroll-contain bg-absolute-black/78 px-4 py-8 backdrop-blur-sm",
					)}
					onClick={() => {
						if (!isBusy) onClose();
					}}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={panelTransition}
						onClick={(e) => e.stopPropagation()}
						className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:rounded-[2.25rem]"
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onClose}
								disabled={isBusy}
								aria-label="Close"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex flex-col items-center px-7 pt-10 pb-8 text-center sm:px-9 sm:pt-12 sm:pb-10">
							<div
								className="mb-6 flex size-14 items-center justify-center rounded-full bg-background text-destructive sm:size-16"
								aria-hidden
							>
								<TriangleAlert
									className="size-7 sm:size-8"
									strokeWidth={1.75}
									aria-hidden
								/>
							</div>

							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
							>
								{title}
							</h2>

							<div className="mt-4 w-full text-left text-muted-foreground text-sm leading-relaxed">
								{children}
							</div>

							<form
								className="mt-6 w-full"
								onSubmit={(e) => {
									e.preventDefault();
									if (confirmed && !isBusy) onConfirm();
								}}
							>
								<label
									htmlFor={inputId}
									className="block text-left text-muted-foreground text-sm"
								>
									Type <span className="font-semibold text-foreground">{confirmPhrase}</span> to
									confirm
								</label>
								<Input
									id={inputId}
									value={typed}
									onChange={(e) => setTyped(e.target.value)}
									autoComplete="off"
									spellCheck={false}
									disabled={isBusy}
									className="mt-2 bg-background"
								/>

								{error ? (
									<p className="mt-3 text-left text-destructive text-sm">{error}</p>
								) : null}

								<div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
									<DetailMotionButtonWrap>
										<Button
											type="button"
											variant="ghost"
											size="pill"
											disabled={isBusy}
											className={cn(
												"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-muted-foreground sm:w-auto sm:min-w-34",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
											onClick={onClose}
										>
											Cancel
										</Button>
									</DetailMotionButtonWrap>
									<DetailMotionButtonWrap>
										<Button
											type="submit"
											variant="destructive"
											size="pill"
											disabled={!confirmed || isBusy}
											className="h-auto min-h-11 w-full px-5 py-2.5 text-base sm:w-auto sm:min-w-34"
										>
											{isBusy ? busyLabel : confirmLabel}
										</Button>
									</DetailMotionButtonWrap>
								</div>
							</form>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
```

Check before wiring: `APP_MODAL_OVERLAY_CLASS` exact export in
`apps/web/src/lib/app-modal-layer.ts` (it includes `fixed inset-0 z-[250]`; if
it doesn't include positioning, keep the `fixed inset-0` classes from
`MeAccountLeaveConfirmDialog`). Verify `Button` has a `destructive` variant in
`packages/ui/src/components/button.tsx`; if the variant name differs, use the
existing destructive styling pattern from
`list-lobby-delete-confirm-dialog.tsx`.

- [ ] **Step 9.2: Clear-library dialog**

Create `apps/web/src/components/profile/me-clear-library-dialog.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MeDestructiveConfirmDialog } from "@/components/profile/me-destructive-confirm-dialog";
import { stillApiOrigin } from "@/lib/still-api-origin";

/**
 * Clear library data (Data settings danger zone): wipes diary, ratings,
 * watchlist, TV progress, streaks, and gamification — keeps reviews, lists,
 * follows, and profile. Type-to-confirm gated; nudges export first.
 */
export function MeClearLibraryDialog({
	open,
	onClose,
	onCleared,
	onExportFirst,
}: {
	open: boolean;
	onClose: () => void;
	onCleared: () => void;
	onExportFirst: () => void;
}) {
	const router = useRouter();
	const [isBusy, setIsBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function runClear() {
		setIsBusy(true);
		setError(null);
		try {
			const res = await fetch(`${stillApiOrigin()}/api/me/library`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) {
				setError("Couldn't clear your library — nothing was deleted. Try again.");
				return;
			}
			onCleared();
			onClose();
			router.refresh();
		} catch {
			setError("Couldn't clear your library — check your connection.");
		} finally {
			setIsBusy(false);
		}
	}

	return (
		<MeDestructiveConfirmDialog
			open={open}
			title="Clear library data"
			confirmPhrase="clear my library"
			confirmLabel="Clear library"
			busyLabel="Clearing…"
			isBusy={isBusy}
			error={error}
			onClose={onClose}
			onConfirm={() => void runClear()}
		>
			<p>
				This permanently removes your <strong>diary logs, ratings, watchlist,
				TV progress, streaks, badges, and challenge progress</strong>. Your
				favorites list is emptied.
			</p>
			<p className="mt-2">
				Your <strong>reviews, lists, comments, followers, and profile</strong>{" "}
				are kept. There is no undo.
			</p>
			<p className="mt-3">
				<button
					type="button"
					className="font-medium text-foreground underline underline-offset-2"
					onClick={onExportFirst}
				>
					Export your data first
				</button>{" "}
				if you want a copy.
			</p>
		</MeDestructiveConfirmDialog>
	);
}
```

- [ ] **Step 9.3: Delete-account dialog**

Create `apps/web/src/components/profile/me-delete-account-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";

import { MeDestructiveConfirmDialog } from "@/components/profile/me-destructive-confirm-dialog";
import { authClient } from "@/lib/auth-client";

/**
 * Delete account (Data settings danger zone). Email-verified: Better Auth
 * sends a deletion link to the account email; the account survives until the
 * patron clicks it. On send we surface a pending state on the panel.
 */
export function MeDeleteAccountDialog({
	open,
	onClose,
	onEmailSent,
}: {
	open: boolean;
	onClose: () => void;
	onEmailSent: () => void;
}) {
	const [isBusy, setIsBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function requestDeletion() {
		setIsBusy(true);
		setError(null);
		try {
			const { error: apiError } = await authClient.deleteUser({
				callbackURL: "/",
			});
			if (apiError) {
				setError(
					apiError.message ??
						"Couldn't start account deletion — please try again.",
				);
				return;
			}
			onEmailSent();
			onClose();
		} catch {
			setError("Couldn't start account deletion — check your connection.");
		} finally {
			setIsBusy(false);
		}
	}

	return (
		<MeDestructiveConfirmDialog
			open={open}
			title="Delete account"
			confirmPhrase="delete my account"
			confirmLabel="Send deletion email"
			busyLabel="Sending…"
			isBusy={isBusy}
			error={error}
			onClose={onClose}
			onConfirm={() => void requestDeletion()}
		>
			<p>
				This permanently deletes your <strong>entire account</strong> — profile,
				diary, reviews, lists, followers, everything. There is no undo.
			</p>
			<p className="mt-2">
				To confirm it's you, we'll email a verification link to your account
				address. Your account is only deleted after you click it. The link
				expires in 24 hours.
			</p>
		</MeDestructiveConfirmDialog>
	);
}
```

- [ ] **Step 9.4: Danger zone panel**

Replace the stub in `apps/web/src/components/profile/me-danger-zone.tsx`:

```tsx
"use client";

import { Button } from "@still/ui/components/button";
import { MailCheck } from "lucide-react";
import { useState } from "react";

import { MeClearLibraryDialog } from "@/components/profile/me-clear-library-dialog";
import { MeDeleteAccountDialog } from "@/components/profile/me-delete-account-dialog";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";

type OpenDialog = "clear" | "delete" | null;

/** Data settings danger zone — clear library + delete account. */
export function MeDangerZone() {
	const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
	const [clearedAt, setClearedAt] = useState<Date | null>(null);
	const [deletionEmailSent, setDeletionEmailSent] = useState(false);

	return (
		<MeSettingsSection
			title="Danger zone"
			description="Destructive actions — both ask you to confirm, and account deletion is verified by email."
		>
			<MeSettingsPanel className="space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="max-w-prose">
						<p className="font-medium text-foreground text-sm">
							Clear library data
						</p>
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							Remove your diary, ratings, watchlist, TV progress, streaks, and
							badges. Reviews, lists, and followers stay.
						</p>
						{clearedAt ? (
							<p className="mt-1 text-emerald-500 text-sm">
								Library cleared.
							</p>
						) : null}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="pill"
						className="border border-destructive/40 text-destructive"
						onClick={() => setOpenDialog("clear")}
					>
						Clear library…
					</Button>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="max-w-prose">
						<p className="font-medium text-foreground text-sm">Delete account</p>
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							Permanently delete your account and everything in it. Confirmed by
							a link sent to your email.
						</p>
						{deletionEmailSent ? (
							<p className="mt-1 flex items-center gap-1.5 text-foreground text-sm">
								<MailCheck className="size-4" aria-hidden />
								Check your inbox — the deletion link expires in 24 hours.
							</p>
						) : null}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="pill"
						className="border border-destructive/40 text-destructive"
						onClick={() => setOpenDialog("delete")}
					>
						Delete account…
					</Button>
				</div>
			</MeSettingsPanel>

			<MeClearLibraryDialog
				open={openDialog === "clear"}
				onClose={() => setOpenDialog(null)}
				onCleared={() => setClearedAt(new Date())}
				onExportFirst={() => {
					setOpenDialog(null);
					document
						.getElementById("me-data-export-panel")
						?.scrollIntoView({ behavior: "smooth", block: "center" });
				}}
			/>
			<MeDeleteAccountDialog
				open={openDialog === "delete"}
				onClose={() => setOpenDialog(null)}
				onEmailSent={() => setDeletionEmailSent(true)}
			/>
		</MeSettingsSection>
	);
}
```

And in `me-data-export-panel.tsx`, give the section an anchor for the
"Export your data first" jump — wrap the section content or add
`id="me-data-export-panel"` to the outermost element `MeSettingsSection`
renders. If `MeSettingsSection` doesn't forward an `id` prop, wrap it:

```tsx
	return (
		<div id="me-data-export-panel">
			<MeSettingsSection ...>...</MeSettingsSection>
		</div>
	);
```

Styling note: match the danger-zone button treatment to the app's destructive
affordances — check `list-lobby-delete-confirm-dialog.tsx` and the surrounding
settings panels; surface-depth tokens are preferred over borders, so if
`border-destructive/40` looks off next to sibling panels, use
`bg-background text-destructive` rows instead (flat raised tiles).

- [ ] **Step 9.5: Lints + type-check**

ReadLints on the four files; then run (working directory `apps/web`):
`bunx tsc --noEmit` (or `bun run check-types` if defined).
Expected: clean. If `authClient.deleteUser` types complain about `callbackURL`,
confirm better-auth 1.6.9 client signature — it accepts
`{ callbackURL?: string; password?: string; token?: string }`.

- [ ] **Step 9.6: Commit**

```bash
git add apps/web/src/components/profile/me-destructive-confirm-dialog.tsx apps/web/src/components/profile/me-clear-library-dialog.tsx apps/web/src/components/profile/me-delete-account-dialog.tsx apps/web/src/components/profile/me-danger-zone.tsx apps/web/src/components/profile/me-data-export-panel.tsx
git commit -m "feat(web): danger zone with clear-library and email-verified delete-account dialogs"
```

---

### Task 10: Cascade audit

**Files:**
- Possibly create: `packages/db/src/migrations/00XX_*.sql` + journal entry (only if gaps found)

- [ ] **Step 10.1: Audit every user FK**

Run:

```bash
rg "references\(\(\) => user\.id" packages/db/src/schema -A 1
```

For each match, confirm `onDelete: "cascade"` (or an intentional `set null`
like `listItem.addedById`). Tables expected to cascade: `session`, `account`,
`profile`, `follow` (both columns), `block` (both columns), `log`, `review`,
`watchlistItem`, `tvWatch`, `userStreak`, `tasteDismissedMovie`, `userBadge`,
`userAchievement`, `eventLog`, `userCompletionistChallenge`, `list`,
`listCollaborator`, `post`, `comment`, `reaction`, plus the notification, chat,
news, staff, and product-event tables.

- [ ] **Step 10.2: Fix any gaps**

If any user FK lacks a delete behavior, add `onDelete: "cascade"` in the schema
file AND generate a migration. New SQL migrations MUST be registered in
`packages/db/src/migrations/meta/_journal.json` before `bun run db:migrate` —
unjournaled files are silently skipped. If no gaps: skip to 10.3, no commit.

- [ ] **Step 10.3: Verify `@still/db` barrel exports**

Run:

```bash
rg "export" packages/db/src/index.ts
```

Confirm `userStreak`, `tasteDismissedMovie`, `userBadge`, `userAchievement`,
`eventLog`, `userCompletionistChallenge`, `comment`, `reaction`, `tvWatch`,
`watchlistItem` are all reachable from the `@still/db` import used in Tasks 4–5
(if `export * from "./schema"` style, they are). Add missing re-exports if any,
then `git add` + `git commit -m "fix(db): export gamification tables from barrel"`.

---

### Task 11: Full verification

- [ ] **Step 11.1: Server suite**

Run (working directory `apps/server`): `bun test`
Expected: all pass.

- [ ] **Step 11.2: Web build**

Run (working directory `apps/web`): `bun run build`
Expected: compiles. (If route-type errors mention stale `/me/settings/imports`
types, delete `apps/web/.next` and rebuild.)

- [ ] **Step 11.3: Manual pass (dev servers running)**

1. Settings sidebar shows **Data** (no Imports); `/me/settings/imports` redirects.
2. Export: button downloads `sense-export-<handle>-<date>.zip`; unzip and spot-check
   `diary.csv` headers + a rating value (stored tenths → stars + Rating10).
3. Round-trip: re-import the exported `diary.csv` through the Letterboxd import
   panel on a second account — rows import.
4. Clear library: type-to-confirm gates the button; after clearing, `/diary`,
   `/watchlist`, profile filmography, and Achievements are empty; reviews and
   lists remain; favorites list exists but is empty.
5. Delete account: dialog sends email (dev fallback logs the link in the server
   console); opening the logged link deletes the account, signs out, redirects
   to `/`; signing in with the deleted credentials fails.
6. Export rate limit: 4th export within an hour shows the inline 429 message.

- [ ] **Step 11.4: Update the knowledge graph**

Run: `graphify update .`

- [ ] **Step 11.5: Final commit (if any stragglers)**

```bash
git status
git add -A docs apps packages
git commit -m "chore: data settings polish after manual verification"
```

---

## Self-review notes (already applied)

- Spec coverage: settings IA (Task 7), export ZIP + rate limit (Tasks 3–6, 8),
  clear library incl. gamification reset + favorites emptying + stats-cache
  reset (Tasks 5–6, 9), email-verified deletion + Resend + blob cleanup
  (Tasks 1–2, 9), cascade audit (Task 10), round-trip test (Task 11).
- Type consistency: `ExportInput`/`ExportFile`/`assembleExportFiles`/
  `fetchExportInput` names match across Tasks 4 and 6; `clearUserLibrary` and
  `ClearLibraryCounts` match across Tasks 5 and 6; `buildMeDataRoute` factory
  seam matches the route test.
- Known judgment calls an implementer may adjust with evidence: Elysia factory
  typing (Task 6 note), `MeSettingsSection` prop names, destructive button
  styling tokens (Task 9 note), `@still/db` barrel coverage (Task 10.3).
