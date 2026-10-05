import { describe, expect, test } from "bun:test";
import {
	activeIndexAfterRemoval,
	buildTasteQueueBackfillRunner,
	createTasteQueueBackfillScheduler,
	mergeTailBackfill,
	railAfterTasteRefresh,
	sameTasteRailIds,
	TASTE_MATCH_TARGET_RESULTS,
} from "./taste-match-queue";
import type { TasteMatchMovie } from "./taste-matched-discovery";

const row = (id: number): TasteMatchMovie => ({
	tmdbId: id,
	title: `Film ${id}`,
	posterPath: null,
	year: 2020,
});

describe("TASTE_MATCH_TARGET_RESULTS", () => {
	test("mirrors server target depth", () => {
		expect(TASTE_MATCH_TARGET_RESULTS).toBe(24);
	});
});

describe("activeIndexAfterRemoval", () => {
	test("keeps index when removing active title", () => {
		expect(activeIndexAfterRemoval(2, 2, 7)).toBe(2);
	});

	test("decrements when removing before active", () => {
		expect(activeIndexAfterRemoval(1, 3, 7)).toBe(2);
	});

	test("unchanged when removing after active", () => {
		expect(activeIndexAfterRemoval(5, 2, 7)).toBe(2);
	});

	test("clamps to last index", () => {
		expect(activeIndexAfterRemoval(0, 0, 1)).toBe(0);
	});
});

describe("mergeTailBackfill", () => {
	test("appends unseen candidates to target depth", () => {
		const current = [row(1), row(2), row(3)];
		const candidates = [row(1), row(4), row(5), row(6)];
		const out = mergeTailBackfill(current, candidates, 6);
		expect(out.map((m) => m.tmdbId)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	test("stops at candidate exhaustion", () => {
		const current = [row(1), row(2)];
		const out = mergeTailBackfill(current, [row(3)], 24);
		expect(out.map((m) => m.tmdbId)).toEqual([1, 2, 3]);
	});

	test("no-op when already at target", () => {
		const current = Array.from({ length: 24 }, (_, i) => row(i + 1));
		const out = mergeTailBackfill(current, [row(99)], 24);
		expect(out).toBe(current);
	});
});

describe("createTasteQueueBackfillScheduler", () => {
	test("debounces rapid schedule calls into one trailing run", async () => {
		let runs = 0;
		const scheduler = createTasteQueueBackfillScheduler({
			debounceMs: 50,
			runBackfill: async () => {
				runs += 1;
			},
		});

		scheduler.schedule();
		scheduler.schedule();
		scheduler.schedule();

		await new Promise((resolve) => setTimeout(resolve, 120));

		expect(runs).toBe(1);
	});

	test("cancel prevents a pending backfill run", async () => {
		let runs = 0;
		const scheduler = createTasteQueueBackfillScheduler({
			debounceMs: 50,
			runBackfill: async () => {
				runs += 1;
			},
		});

		scheduler.schedule();
		scheduler.cancel();

		await new Promise((resolve) => setTimeout(resolve, 120));

		expect(runs).toBe(0);
	});
});

describe("sameTasteRailIds", () => {
	test("matches the same order only", () => {
		expect(sameTasteRailIds([row(1), row(2)], [row(1), row(2)])).toBe(true);
		expect(sameTasteRailIds([row(1), row(2)], [row(2), row(1)])).toBe(false);
	});
});

describe("railAfterTasteRefresh", () => {
	test("drops the logged title when for-you still returns it", () => {
		const out = railAfterTasteRefresh({
			fresh: [row(1), row(2), row(3)],
			pinned: row(1),
			consumedTmdbId: 2,
		});
		expect(out.map((film) => film.tmdbId)).toEqual([1, 3]);
	});

	test("keeps today's pin when the new ranking omits it", () => {
		const pinned = row(9);
		const out = railAfterTasteRefresh({
			fresh: [row(1), row(2)],
			pinned,
			consumedTmdbId: 4,
		});
		expect(out.map((film) => film.tmdbId)).toEqual([9, 1, 2]);
	});

	test("does not put back the title that was just logged", () => {
		const out = railAfterTasteRefresh({
			fresh: [row(1), row(2)],
			pinned: row(9),
			consumedTmdbId: 9,
		});
		expect(out.map((film) => film.tmdbId)).toEqual([1, 2]);
	});
});

describe("buildTasteQueueBackfillRunner", () => {
	test("removes a logged title from a full rail", async () => {
		const current = Array.from({ length: 24 }, (_, index) => row(index + 1));
		let next: TasteMatchMovie[] | null = null;
		const run = buildTasteQueueBackfillRunner({
			getMovies: () => current,
			setMovies: (movies) => {
				next = movies;
			},
			fetchForYou: async () => ({
				coldStart: false,
				genrePhrase: null,
				movies: [row(2), row(25)],
				consumedTmdbIds: [1],
			}),
		});

		await run();

		expect(next).not.toBeNull();
		expect(next?.some((film) => film.tmdbId === 1)).toBe(false);
		expect(next?.[0]?.tmdbId).toBe(2);
	});
});
