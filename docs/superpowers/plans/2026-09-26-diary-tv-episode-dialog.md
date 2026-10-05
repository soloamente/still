# Diary TV Episode Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A left click on a diary TV poster flies and flips into a centered dialog of season posters and per-episode rating pills, then flies back to the same cell.

**Architecture:** Pure helpers in `diary-tv-episode-pills.ts` turn TMDb episodes plus diary logs into pill states. `DiaryTvEpisodeDialog` portals that layout and animates the poster between the cell rect and the large season slot with `motion/react`. `DiaryTvGroupCell` drops the in-grid flip-back list and opens the dialog. No new API.

**Tech Stack:** Next.js, React, `motion/react`, Bun tests, existing `GET /api/tv/:id/seasons`, `GET /api/tv/:id/season/:n`, `GET /api/logs/me/by-tv/:id`.

**Spec:** `docs/superpowers/specs/2026-09-26-diary-tv-episode-dialog-design.md`

**Stay on `main`.** Do not commit unrelated watchlist WIP. Each task commit touches only the files listed in that task.

---

## File structure

- Create `apps/web/src/lib/diary-tv-episode-pills.ts` — pill state, average, open season, label text.
- Create `apps/web/src/lib/diary-tv-episode-pills.test.ts`
- Create `apps/web/src/components/diary/diary-tv-episode-dialog.tsx` — dialog, season column, pills, legend, flight.
- Modify `apps/web/src/components/diary/diary-tv-group-cell.tsx` — open the dialog on left click; remove the flip-back list.

---

### Task 1: Pill state

**Files:**
- Create: `apps/web/src/lib/diary-tv-episode-pills.ts`
- Test: `apps/web/src/lib/diary-tv-episode-pills.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

import {
	type DiaryTvEpisodeLog,
	pillForEpisode,
} from "./diary-tv-episode-pills";

const episode = { seasonNumber: 1, episodeNumber: 2 };

describe("pillForEpisode", () => {
	test("is empty when no episode log matches", () => {
		const logs: DiaryTvEpisodeLog[] = [
			{
				id: "season",
				logScope: "season",
				seasonNumber: 1,
				episodeNumber: null,
				rating: 80,
				watchedAt: "2026-01-01",
			},
		];
		expect(pillForEpisode(episode, logs)).toEqual({
			kind: "empty",
			latestLogId: null,
			averageDisplay: null,
		});
	});

	test("is neutral when every matching episode log is unrated", () => {
		const logs: DiaryTvEpisodeLog[] = [
			{
				id: "a",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: null,
				watchedAt: "2026-01-02",
			},
		];
		expect(pillForEpisode(episode, logs).kind).toBe("neutral");
	});

	test("averages rated logs and ignores unrated ones", () => {
		const logs: DiaryTvEpisodeLog[] = [
			{
				id: "old",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: 80,
				watchedAt: "2026-01-01",
			},
			{
				id: "new",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: 100,
				watchedAt: "2026-02-01",
			},
			{
				id: "blank",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: null,
				watchedAt: "2026-03-01",
			},
		];
		expect(pillForEpisode(episode, logs)).toEqual({
			kind: "rated",
			latestLogId: "blank",
			averageDisplay: 9,
		});
	});
});
```

**Step 2: Run the test**

Run: `bun test apps/web/src/lib/diary-tv-episode-pills.test.ts`

Expected: FAIL. Module not found.

**Step 3: Implement**

```ts
import { logRatingToDisplay } from "@/lib/log-rating";

export type DiaryTvEpisodeLog = {
	id: string;
	logScope: "show" | "season" | "episode";
	seasonNumber: number | null;
	episodeNumber: number | null;
	/** Stored tenths, or null when the log has no rating. */
	rating: number | null;
	watchedAt: string;
};

export type DiaryTvPill =
	| { kind: "empty"; latestLogId: null; averageDisplay: null }
	| { kind: "neutral"; latestLogId: string; averageDisplay: null }
	| { kind: "rated"; latestLogId: string; averageDisplay: number };

export function pillForEpisode(
	episode: { seasonNumber: number; episodeNumber: number },
	logs: readonly DiaryTvEpisodeLog[],
): DiaryTvPill {
	const matches = logs.filter(
		(log) =>
			log.logScope === "episode" &&
			log.seasonNumber === episode.seasonNumber &&
			log.episodeNumber === episode.episodeNumber,
	);
	if (matches.length === 0) {
		return { kind: "empty", latestLogId: null, averageDisplay: null };
	}
	const latest = [...matches].sort((a, b) =>
		a.watchedAt < b.watchedAt ? 1 : -1,
	)[0];
	const rated = matches
		.map((log) => logRatingToDisplay(log.rating))
		.filter((value): value is number => value != null);
	if (rated.length === 0) {
		return { kind: "neutral", latestLogId: latest.id, averageDisplay: null };
	}
	const average = rated.reduce((sum, value) => sum + value, 0) / rated.length;
	return {
		kind: "rated",
		latestLogId: latest.id,
		averageDisplay: Math.round(average * 10) / 10,
	};
}
```

**Step 4: Run the test**

Run: `bun test apps/web/src/lib/diary-tv-episode-pills.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/diary-tv-episode-pills.ts apps/web/src/lib/diary-tv-episode-pills.test.ts
git commit -m "feat(diary): derive TV episode pill state from diary logs"
```

---

### Task 2: Open season and scope labels

**Files:**
- Modify: `apps/web/src/lib/diary-tv-episode-pills.ts`
- Modify: `apps/web/src/lib/diary-tv-episode-pills.test.ts`

**Step 1: Add failing tests**

```ts
import {
	initialSeasonNumber,
	showLogLabel,
	seasonLogLabel,
} from "./diary-tv-episode-pills";

test("opens on the season of the latest episode log", () => {
	expect(
		initialSeasonNumber(
			[
				{
					id: "s",
					logScope: "episode",
					seasonNumber: 2,
					episodeNumber: 1,
					rating: 70,
					watchedAt: "2026-01-01",
				},
				{
					id: "t",
					logScope: "episode",
					seasonNumber: 3,
					episodeNumber: 1,
					rating: 90,
					watchedAt: "2026-04-01",
				},
			],
			[1, 2, 3],
		),
	).toBe(3);
});

test("falls back to the first catalogue season", () => {
	expect(initialSeasonNumber([], [0, 1])).toBe(0);
});

test("season and show labels do not invent episode color", () => {
	const logs: DiaryTvEpisodeLog[] = [
		{
			id: "show",
			logScope: "show",
			seasonNumber: null,
			episodeNumber: null,
			rating: 100,
			watchedAt: "2026-01-01",
		},
		{
			id: "season",
			logScope: "season",
			seasonNumber: 1,
			episodeNumber: null,
			rating: 60,
			watchedAt: "2026-02-01",
		},
	];
	expect(showLogLabel(logs)).toBe("Whole series · 6.0");
	expect(seasonLogLabel(1, logs)).toBe("Season 1 · 6.0");
	expect(seasonLogLabel(2, logs)).toBeNull();
});
```

**Step 2: Run the test**

Run: `bun test apps/web/src/lib/diary-tv-episode-pills.test.ts`

Expected: FAIL. `initialSeasonNumber` is not exported.

**Step 3: Implement**

Add to `diary-tv-episode-pills.ts`. Use `formatLogRatingDisplay` for the number. Latest log wins when several season or show logs exist. A label with no rating omits the score (`Whole series`, `Season 1`).

```ts
import { formatLogRatingDisplay, logRatingToDisplay } from "@/lib/log-rating";

export function initialSeasonNumber(
	logs: readonly DiaryTvEpisodeLog[],
	catalogueSeasonNumbers: readonly number[],
): number | null {
	const episodes = logs
		.filter((log) => log.logScope === "episode" && log.seasonNumber != null)
		.sort((a, b) => (a.watchedAt < b.watchedAt ? 1 : -1));
	if (episodes[0]?.seasonNumber != null) return episodes[0].seasonNumber;
	return catalogueSeasonNumbers[0] ?? null;
}

function scopeLabel(
	prefix: string,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	if (logs.length === 0) return null;
	const latest = [...logs].sort((a, b) =>
		a.watchedAt < b.watchedAt ? 1 : -1,
	)[0];
	const display = logRatingToDisplay(latest.rating);
	if (display == null) return prefix;
	return `${prefix} · ${formatLogRatingDisplay(display)}`;
}

export function showLogLabel(logs: readonly DiaryTvEpisodeLog[]): string | null {
	return scopeLabel(
		"Whole series",
		logs.filter((log) => log.logScope === "show"),
	);
}

export function seasonLogLabel(
	seasonNumber: number,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	return scopeLabel(
		`Season ${seasonNumber}`,
		logs.filter(
			(log) => log.logScope === "season" && log.seasonNumber === seasonNumber,
		),
	);
}
```

**Step 4: Run the test**

Run: `bun test apps/web/src/lib/diary-tv-episode-pills.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/diary-tv-episode-pills.ts apps/web/src/lib/diary-tv-episode-pills.test.ts
git commit -m "feat(diary): choose the open season and scope labels"
```

---

### Task 3: Dialog body

**Files:**
- Create: `apps/web/src/components/diary/diary-tv-episode-dialog.tsx`
- Modify: `apps/web/src/components/diary/diary-tv-group-cell.tsx`

**Step 1: Build the dialog without the flight**

`DiaryTvEpisodeDialog` props: `open`, `onOpenChange`, `tmdbId`, `title`, `posterPath`, `cellRef` (used in Task 4).

When `open` becomes true:

1. `fetchMyLogsForTv(tmdbId)` and `fetchTvSeasons(tmdbId)` together.
2. Map logs with the same field names as `tvLogsToDiaryRows` in `diary-tv-group-cell.tsx`.
3. Keep seasons where `episode_count > 0`, including season 0. Sort by `season_number`.
4. `initialSeasonNumber` picks the active season.
5. Fetch `fetchTvSeasonDetail` for the active season first, then the others. Store episodes in a map.
6. Failures: seasons error shows “Couldn’t load episodes” and Try again. Diary error shows “Couldn’t load diary entries” and Try again, and every pill stays empty. One season error shows Try again on that season only.

Layout, inside a portal on `document.body`, `z-[250]` (same layer as other app modals):

- Scrim: existing `APP_MODAL_OVERLAY_CLASS` from `apps/web/src/lib/app-modal-layer.ts`. Click closes.
- Panel: `bg-card`, `rounded-[2rem]`, centered, `max-w-5xl`, `max-h-[min(88svh,52rem)]`, no border, ring, or shadow.
- Close control: `min-h-11` round `bg-background` button, `aria-label="Close"`. Escape closes.
- Left: column of season poster buttons (`min-h-11`). Active season poster is the large image (`data-diary-flight-slot`). Show poster path when the season has no poster.
- Under the large poster: `showLogLabel`.
- Right: one group per season, `bg-background` `rounded-[1.25rem]`. Header is the season name plus `seasonLogLabel` when present. Pills wrap with `gap-2`.
- Pill: episode number, `min-h-11`, `rounded-full`. Empty: episode number only, not a button. Neutral: `bg-background` button. Rated: button, number from `formatLogRatingDisplay(averageDisplay)`, background `color-mix(in oklab, var(--foreground) ${Math.round((averageDisplay / 10) * 100)}%, var(--background))`, text `text-background` when the mix is over 55% and `text-foreground` otherwise.
- Legend: “Not logged”, “Watched, no rating”, and 0 / 5 / 10 swatches using the same mix.
- Logged pill calls `useQuickLog` `open` with `diaryLogToQuickLogOpenPayload` for `latestLogId`. Pass `onSuccess` that refetches diary logs only. Dialog stays open.
- Loading pills: `h-11 w-11 animate-pulse rounded-full bg-background`.

`DiaryTvGroupCell`: remove the `rotateY` back face, the in-grid log list, and `expanded` flip classes. Keep `CataloguePosterTile` and the poster button. Left click calls `onOpenChange(true)` instead of flipping. The cell root gets `ref` forwarded as `cellRef`. Radial menu stays on the tile.

**Step 2: Check types**

Run: `bunx biome check apps/web/src/components/diary/diary-tv-episode-dialog.tsx apps/web/src/components/diary/diary-tv-group-cell.tsx apps/web/src/lib/diary-tv-episode-pills.ts`

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/components/diary/diary-tv-episode-dialog.tsx apps/web/src/components/diary/diary-tv-group-cell.tsx
git commit -m "feat(diary): open TV seasons and episode pills from the poster"
```

---

### Task 4: Flight

**Files:**
- Modify: `apps/web/src/components/diary/diary-tv-episode-dialog.tsx`

**Step 1: Animate the poster**

Use `motion` from `motion/react` and `useReducedMotion`.

On open, read `cellRef.current.getBoundingClientRect()` before the dialog paints. Render a fixed `motion.img` (or the show/season poster image) at that rect with `rotateY: 0`. When the large slot mounts, read its rect and `animate` to `{ x, y, scale, rotateY: 180 }` using the slot’s center minus the start center. Duration `0.45`, ease `[0.22, 1, 0.36, 1]`. Dialog chrome starts at `opacity: 0` and fades to 1 over `0.2s` as the flight finishes. The grid cell hides its poster (`invisible`) while the clone is in flight or the dialog is open, and shows it again when the flight home completes.

On close, read the cell rect again. Animate the clone back to that rect and `rotateY: 0`, then unmount. If `cellRef.current` is null, fade the dialog out over `0.2s` and do not fly.

`useReducedMotion() === true`: no clone. Dialog opacity toggles. Cell poster stays visible.

Opening a second show is out of scope for one cell. The lobby already allows one expanded group; keep a single dialog by closing this cell when `expanded` flips false. If `DiaryLobbyInfinite` still tracks `expanded`, map that flag to `open` so only one dialog is open.

**Step 2: Check the file**

Run: `bunx biome check apps/web/src/components/diary/diary-tv-episode-dialog.tsx`

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/components/diary/diary-tv-episode-dialog.tsx apps/web/src/components/diary/diary-tv-group-cell.tsx
git commit -m "feat(diary): fly the TV poster into the episode dialog and back"
```

---

### Task 5: Browser check

On a signed-in `/diary` with a TV show that has episode logs:

- Left click flies and flips into the dialog. Right-click still opens the radial menu.
- The active season is large. Other season posters select it.
- Empty, neutral, and rated pills match the logs. A season log and a show log are labels only.
- A rated pill opens Quick Log. Saving updates the pill. The dialog stays open.
- Escape returns the poster to the cell. Scroll during the dialog, then close, and it lands on the cell’s new position.
- `prefers-reduced-motion: reduce` opens and closes with no flight.

Run: `bun test apps/web/src/lib/diary-tv-episode-pills.test.ts`

Expected: PASS
