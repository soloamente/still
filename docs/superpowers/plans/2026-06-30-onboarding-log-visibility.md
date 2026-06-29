# Onboarding Log Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make titles rated during onboarding visible like normal logs, backfill users already stuck with private onboarding logs, and reconcile the leaderboard drawer's poster count with the ranking number by showing lock tiles for a non-owner's private titles.

**Architecture:** Three independent changes. (1) Drop a hardcoded `visibility: "private"` in the onboarding finish flow so logs inherit `profile.defaultVisibility`. (2) A one-off, dry-run-first backfill script that flips onboarding-era private logs to the user's default visibility within a tight time window around `onboarded_at`. (3) The leaderboard drawer endpoint returns a `hiddenCount` (logs counted by the ranking but not visible to this viewer); the drawer grid renders that many lock placeholder tiles with no title/poster data.

**Tech Stack:** TypeScript, Elysia (server), Drizzle ORM (Postgres/Neon), Next.js + React (web), Bun + `bun:test`, lucide-react icons.

Spec: `docs/superpowers/specs/2026-06-30-onboarding-log-visibility-design.md`

---

## File Structure

- `apps/web/src/components/onboarding/onboarding-wizard.tsx` — **modify** (Task 1): remove the forced `private`.
- `apps/server/scripts/backfill-onboarding-visibility.ts` — **create** (Task 2): one-off backfill.
- `apps/server/src/lib/leaderboard-hidden-count.ts` — **create** (Task 3): side-effect-free `clampHiddenCount` helper (so it is unit-testable without importing `db`).
- `apps/server/src/lib/leaderboard-hidden-count.test.ts` — **create** (Task 3): unit test for the helper.
- `apps/server/src/lib/leaderboard-query.ts` — **modify** (Task 3): compute and return `hiddenCount` in `fetchLeaderboardLogs`.
- `apps/web/src/lib/home-leaderboard-types.ts` — **modify** (Task 4): add `hiddenCount` to `LeaderboardLogsPayload`.
- `apps/web/src/components/home/patron-watch-ledger-grid.tsx` — **modify** (Task 4): render lock tiles.
- `apps/web/src/components/home/patron-watch-ledger-panel.tsx` — **modify** (Task 4): pass `hiddenCount` to the grid and include it in the count line.

**Commands referenced** (run from repo root unless noted):
- Web typecheck: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` (the `npx tsc` inside `apps/web` is a false-pass decoy — do not use it).
- Server typecheck: `cd apps/server && bun run check-types`
- Server unit test: `cd apps/server && bun test <path>`

---

## Task 1: Forward fix — onboarding logs inherit profile default

**Files:**
- Modify: `apps/web/src/components/onboarding/onboarding-wizard.tsx` (the `postLog` dep inside `finishFull`, ~lines 273–287)

Background: the server log POST (`apps/server/src/routes/logs.ts` ~184–192) already resolves `body.visibility ?? profile.defaultVisibility ?? "public"`. New profiles default to `"public"` (`packages/db/src/schema/profile.ts:111`). The full onboarding flow routes unverified users through the verify step before "taste" (`stepAfterBio`, same file ~line 67), so the public-visibility email gate (`logs.ts` ~194) passes by the time logs are posted. So removing the hardcoded `private` is sufficient and safe.

- [ ] **Step 1: Remove the forced `private` from the onboarding log payload**

In `apps/web/src/components/onboarding/onboarding-wizard.tsx`, change the `postLog` dep body from:

```ts
				postLog: async (movieId, rating) => {
					const res = await api.api.logs.post({
						movieId,
						rating,
						watchedAt: new Date().toISOString(),
						visibility: "private",
						watchVenue: "streaming",
					});
```

to (delete only the `visibility: "private",` line):

```ts
				postLog: async (movieId, rating) => {
					const res = await api.api.logs.post({
						movieId,
						rating,
						watchedAt: new Date().toISOString(),
						watchVenue: "streaming",
					});
```

Leave the `if (res.error) { … isEmailVerificationRequiredError … }` block below it unchanged (defensive guard).

- [ ] **Step 2: Typecheck the web app**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: no NEW errors referencing `onboarding-wizard.tsx`. (Pre-existing baseline errors in unrelated `*.test.ts` files may remain — compare against a clean run if unsure.)

- [ ] **Step 3: Manual smoke (no automated harness for this React closure)**

With the dev servers running (`bun run dev:server` and the web dev server), complete onboarding as a fresh, email-verified test account, then load `/diary`, your `/profile/<handle>`, and the community surfaces. Expected: the titles rated during onboarding now appear (not just in the ranking count). If you cannot create a fresh account, this step can be deferred to QA — the server default-resolution path is already verified.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/onboarding/onboarding-wizard.tsx
git commit -m "fix(web): onboarding logs inherit profile default visibility (not forced private)"
```

---

## Task 2: Targeted backfill script for existing private onboarding logs

**Files:**
- Create: `apps/server/scripts/backfill-onboarding-visibility.ts`

Pattern mirrors `apps/server/scripts/backfill-movie-palette.ts` (standalone Bun script, `db` from `@still/db`). It is **dry-run by default** and only writes when passed `--apply`. The matching predicate is written once (DRY) and reused for the count and the update.

- [ ] **Step 1: Create the backfill script**

Create `apps/server/scripts/backfill-onboarding-visibility.ts`:

```ts
import { db } from "@still/db";
import { sql } from "drizzle-orm";

/**
 * One-off backfill: flip onboarding-era PRIVATE movie logs to each user's
 * current default visibility. Onboarding writes its taste logs immediately
 * before `markOnboarded` sets `profile.onboarded_at`, so they land in a tight
 * window just before it. Intentional private logs are filed AFTER onboarding
 * and fall outside the window, so they are left untouched.
 *
 * Usage:
 *   bun run scripts/backfill-onboarding-visibility.ts            # dry run
 *   bun run scripts/backfill-onboarding-visibility.ts --apply    # write
 *   ONBOARDING_BACKFILL_WINDOW="30 minutes" bun run ... --apply   # custom window
 */
const APPLY = process.argv.includes("--apply");
const WINDOW = process.env.ONBOARDING_BACKFILL_WINDOW ?? "15 minutes";

/** neon-http and postgres-js return result rows in slightly different shapes. */
function rowsOf<T>(res: unknown): T[] {
	const r = res as { rows?: T[] };
	return Array.isArray(r.rows) ? r.rows : (res as T[]);
}

async function main(): Promise<void> {
	const matches = await db.execute(sql`
		SELECT l.id AS id, p.default_visibility AS target
		FROM "log" l
		JOIN "profile" p ON p.user_id = l.user_id
		WHERE p.onboarded_at IS NOT NULL
		  AND p.default_visibility <> 'private'
		  AND l.visibility = 'private'
		  AND l.movie_id IS NOT NULL
		  AND l.note IS NULL
		  AND l.rating IS NOT NULL
		  AND l.removed_at IS NULL
		  AND l.created_at <= p.onboarded_at
		  AND l.created_at >= p.onboarded_at - (${WINDOW})::interval
	`);

	const rows = rowsOf<{ id: string; target: string }>(matches);
	console.log(
		`[onboarding-visibility] window=${WINDOW} — ${rows.length} private onboarding-era log(s) match`,
	);

	if (!APPLY) {
		console.log("[onboarding-visibility] dry run — re-run with --apply to update");
		return;
	}

	let done = 0;
	for (const row of rows) {
		await db.execute(
			sql`UPDATE "log" SET visibility = ${row.target} WHERE id = ${row.id}`,
		);
		done += 1;
		if (done % 50 === 0) {
			console.log(`[onboarding-visibility] ${done}/${rows.length}`);
		}
	}
	console.log(`[onboarding-visibility] complete — ${done} updated`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[onboarding-visibility] failed", err);
		process.exit(1);
	});
```

- [ ] **Step 2: Typecheck the server**

Run: `cd apps/server && bun run check-types`
Expected: no new errors.

- [ ] **Step 3: Run the dry run and inspect the count**

Run: `cd apps/server && bun run scripts/backfill-onboarding-visibility.ts`
Expected: a line like `[onboarding-visibility] window=15 minutes — N private onboarding-era log(s) match` followed by `dry run — re-run with --apply to update`, and no rows changed. Sanity-check that `N` is plausible (≤ total private logs). This is the verification of the heuristic against real data — confirm the number looks like onboarding bursts, not the entire private-log population.

- [ ] **Step 4: Commit (script only — do NOT run --apply as part of the commit)**

```bash
git add apps/server/scripts/backfill-onboarding-visibility.ts
git commit -m "chore(server): add dry-run backfill for onboarding-era private logs"
```

Running `--apply` against the live DB is a deliberate operator action taken after reviewing the dry-run count, not part of this commit.

---

## Task 3: Server returns `hiddenCount` from the leaderboard drawer endpoint

**Files:**
- Create: `apps/server/src/lib/leaderboard-hidden-count.ts`
- Test: `apps/server/src/lib/leaderboard-hidden-count.test.ts`
- Modify: `apps/server/src/lib/leaderboard-query.ts` (`fetchLeaderboardLogs`, return type + both `films`/`tv` branches)

`fetchLeaderboard` (the ranking) counts every in-window log; `fetchLeaderboardLogs` (the drawer) applies `contentVisibilityWhere`. `hiddenCount` = in-window qualifying logs minus the ones visible to this viewer; it is `0` for the owner (who sees all).

- [ ] **Step 1: Write the failing test for the clamp helper**

Create `apps/server/src/lib/leaderboard-hidden-count.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { clampHiddenCount } from "./leaderboard-hidden-count";

describe("clampHiddenCount", () => {
	test("returns the remainder hidden from a non-owner viewer", () => {
		expect(clampHiddenCount(50, 38)).toBe(12);
	});

	test("is zero when the viewer sees everything (owner)", () => {
		expect(clampHiddenCount(24, 24)).toBe(0);
	});

	test("never goes negative even if visible exceeds total", () => {
		expect(clampHiddenCount(5, 9)).toBe(0);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/server && bun test src/lib/leaderboard-hidden-count.test.ts`
Expected: FAIL — cannot find module `./leaderboard-hidden-count` / `clampHiddenCount` is not exported.

- [ ] **Step 3: Implement the helper**

Create `apps/server/src/lib/leaderboard-hidden-count.ts`:

```ts
/**
 * How many in-window logs a viewer is NOT allowed to see.
 *
 * @param totalInWindow qualifying logs the leaderboard ranking counts
 * @param visibleToViewer logs returned after applying visibility rules
 */
export function clampHiddenCount(
	totalInWindow: number,
	visibleToViewer: number,
): number {
	return Math.max(0, totalInWindow - visibleToViewer);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/server && bun test src/lib/leaderboard-hidden-count.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `hiddenCount` to the `fetchLeaderboardLogs` return type**

In `apps/server/src/lib/leaderboard-query.ts`, import the helper near the other lib imports:

```ts
import { clampHiddenCount } from "./leaderboard-hidden-count";
```

Then add `hiddenCount: number;` to the `fetchLeaderboardLogs` return type. The return type currently is:

```ts
}): Promise<{
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
	};
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	items: LeaderboardLogItem[];
} | null> {
```

Change it to:

```ts
}): Promise<{
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
	};
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	items: LeaderboardLogItem[];
	hiddenCount: number;
} | null> {
```

- [ ] **Step 6: Compute and return `hiddenCount` in the `films` branch**

In the `if (opts.kind === "films") { … }` branch, after the existing `const logs = await db.select(...)...orderBy(desc(log.watchedAt));`, add a total-in-window count (same conditions as `logs` but WITHOUT `contentVisibilityWhere`):

```ts
		const [totalRow] = await db
			.select({ total: count() })
			.from(log)
			.where(
				and(
					eq(log.userId, opts.userId),
					isNull(log.removedAt),
					isNotNull(log.movieId),
					gte(log.watchedAt, start),
					lt(log.watchedAt, end),
				),
			);
		const hiddenCount = clampHiddenCount(
			Number(totalRow?.total ?? 0),
			logs.length,
		);
```

Then add `hiddenCount,` to that branch's returned object, e.g.:

```ts
			period: opts.period,
			window: { start: start.toISOString(), end: end.toISOString() },
			hiddenCount,
			items: annotateLeaderboardLogItems(
```

(`count`, `and`, `eq`, `isNull`, `isNotNull`, `gte`, `lt` are already imported at the top of the file.)

- [ ] **Step 7: Compute and return `hiddenCount` in the `tv` branch**

In the `tv` path (the second `const logs = await db.select(...)` block, joining `tv`), add the equivalent count using `isNotNull(log.tvId)`:

```ts
	const [tvTotalRow] = await db
		.select({ total: count() })
		.from(log)
		.where(
			and(
				eq(log.userId, opts.userId),
				isNull(log.removedAt),
				isNotNull(log.tvId),
				gte(log.watchedAt, start),
				lt(log.watchedAt, end),
			),
		);
	const tvHiddenCount = clampHiddenCount(
		Number(tvTotalRow?.total ?? 0),
		logs.length,
	);
```

Then add `hiddenCount: tvHiddenCount,` to the final returned object (the `tv` branch return at the end of the function).

- [ ] **Step 8: Typecheck the server**

Run: `cd apps/server && bun run check-types`
Expected: no new errors. (If `count` was not yet imported, add it to the `drizzle-orm` import — but it is already present in this file.)

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/lib/leaderboard-hidden-count.ts apps/server/src/lib/leaderboard-hidden-count.test.ts apps/server/src/lib/leaderboard-query.ts
git commit -m "feat(server): leaderboard drawer returns hiddenCount of private logs"
```

---

## Task 4: Drawer renders lock placeholder tiles for hidden private titles

**Files:**
- Modify: `apps/web/src/lib/home-leaderboard-types.ts` (add `hiddenCount` to `LeaderboardLogsPayload`)
- Modify: `apps/web/src/components/home/patron-watch-ledger-grid.tsx` (render lock tiles)
- Modify: `apps/web/src/components/home/patron-watch-ledger-panel.tsx` (pass `hiddenCount`, include in count line)

No title/poster data is sent for hidden logs — only the integer `hiddenCount` — so the lock tiles cannot leak anything.

- [ ] **Step 1: Add `hiddenCount` to the client payload type**

In `apps/web/src/lib/home-leaderboard-types.ts`, change the `LeaderboardLogsPayload` type to include `hiddenCount`:

```ts
export type LeaderboardLogsPayload = {
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
	};
	period: HomeLeaderboardPeriod;
	window: { start: string; end: string };
	items: LeaderboardLogItem[];
	hiddenCount: number;
};
```

- [ ] **Step 2: Render lock tiles in the grid**

In `apps/web/src/components/home/patron-watch-ledger-grid.tsx`, add a `Lock` import and a `hiddenCount` prop, render the placeholder tiles after the posters, and update the empty-state guard so a grid with only hidden titles still renders tiles.

Add to imports:

```tsx
import { Lock } from "lucide-react";
```

Change the component signature and empty guard from:

```tsx
export function PatronWatchLedgerGrid({
	items,
	kind,
}: {
	items: LeaderboardLogItem[];
	kind: "films" | "tv";
}) {
	if (!items.length) {
		return (
			<p
				className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
				role="status"
			>
				No {kind === "tv" ? "show" : "film"} logs in this window.
			</p>
		);
	}
```

to:

```tsx
export function PatronWatchLedgerGrid({
	items,
	kind,
	hiddenCount = 0,
}: {
	items: LeaderboardLogItem[];
	kind: "films" | "tv";
	hiddenCount?: number;
}) {
	if (!items.length && hiddenCount === 0) {
		return (
			<p
				className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
				role="status"
			>
				No {kind === "tv" ? "show" : "film"} logs in this window.
			</p>
		);
	}
```

Then, inside the `<div className="grid …">`, after the existing `{items.map(...)}` block (and before the closing `</div>`), add the lock tiles:

```tsx
				{Array.from({ length: hiddenCount }).map((_, index) => (
					<div
						key={`private-${index}`}
						className="min-w-0 text-center"
					>
						<div
							className="relative flex aspect-2/3 items-center justify-center rounded-2xl bg-muted/40"
							role="img"
							aria-label="Private title"
						>
							<Lock
								className="size-5 text-muted-foreground/70"
								aria-hidden
							/>
						</div>
					</div>
				))}
```

- [ ] **Step 3: Pass `hiddenCount` from the panel and include it in the count line**

In `apps/web/src/components/home/patron-watch-ledger-panel.tsx`:

Change the grid render from:

```tsx
						{!loading && !error ? (
							<PatronWatchLedgerGrid items={sortedItems} kind={seed.kind} />
						) : null}
```

to:

```tsx
						{!loading && !error ? (
							<PatronWatchLedgerGrid
								items={sortedItems}
								kind={seed.kind}
								hiddenCount={payload?.hiddenCount ?? 0}
							/>
						) : null}
```

And change the count line so the displayed total reconciles with the ranking number. Replace:

```tsx
		const titleCount = items.length;
```

with:

```tsx
		const hiddenCount = payload?.hiddenCount ?? 0;
		const titleCount = items.length + hiddenCount;
```

(The existing `{titleCount} {kindLabel.toLowerCase()} log…` line now reflects visible + private, matching the leaderboard count.)

- [ ] **Step 4: Typecheck the web app**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: no new errors referencing `patron-watch-ledger-grid.tsx`, `patron-watch-ledger-panel.tsx`, or `home-leaderboard-types.ts`.

- [ ] **Step 5: Manual/visual verification (optional, needs a logged-in viewer)**

With the dev servers running, sign in as a user who is NOT a given patron, open that patron's watch-log drawer from the community ranking. Expected: visible posters followed by lock tiles, and the header count equals the patron's ranking number. Opening your OWN drawer shows no lock tiles (`hiddenCount` is 0). If a suitable account/data isn't handy, the typecheck gate plus the server unit test from Task 3 cover the logic; this is a visual confirmation.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/home-leaderboard-types.ts apps/web/src/components/home/patron-watch-ledger-grid.tsx apps/web/src/components/home/patron-watch-ledger-panel.tsx
git commit -m "feat(web): show lock tiles for a patron's private titles in the watch-log drawer"
```

---

## Final verification

- [ ] Web typecheck clean: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
- [ ] Server typecheck clean: `cd apps/server && bun run check-types`
- [ ] Server unit tests pass: `cd apps/server && bun test src/lib/leaderboard-hidden-count.test.ts`
- [ ] Backfill dry-run produces a plausible count (operator runs `--apply` separately after review).
