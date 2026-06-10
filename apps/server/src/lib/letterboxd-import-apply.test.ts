import { describe, expect, test } from "bun:test";

import { applyLetterboxdImport } from "./letterboxd-import-apply";

const WATCHED_ONLY_CSV = `Date,Name,Year,Letterboxd URI
2026-01-06,One Battle After Another,2025,https://boxd.it/DUHM`;

const WATCHED_WHIPLASH_CSV = `Date,Name,Year,Letterboxd URI
2026-01-06,Whiplash,2014,https://boxd.it/7bQA`;

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
			hasAnyLogForMovie: async (_userId, movieId) => existingLogs.has(movieId),
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
			files: [{ name: "watched.csv", text: WATCHED_WHIPLASH_CSV }],
			resolveTmdbId: async () => 999,
			ensureMovie: async () => {},
			hasAnyLogForMovie: async () => true,
			insertMinimalLog: async () => {
				insertCalls++;
				return "log_test";
			},
		});

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
