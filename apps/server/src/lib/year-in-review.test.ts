import { describe, expect, test } from "bun:test";

import {
	computeYearInReviewFromRows,
	YEAR_IN_REVIEW_MIN_LOGS,
	type YearInReviewLogRow,
} from "./year-in-review";

function logRow(
	overrides: Partial<YearInReviewLogRow> &
		Pick<YearInReviewLogRow, "watchedAt">,
): YearInReviewLogRow {
	return {
		rating: null,
		movieId: 1,
		tvId: null,
		title: "Film",
		posterPath: "/p.jpg",
		releaseYear: 2010,
		genreIds: [18],
		...overrides,
	};
}

describe("computeYearInReviewFromRows", () => {
	test("sparse year with fewer than five logs is not eligible", () => {
		const result = computeYearInReviewFromRows(2024, {
			logs: [
				logRow({ watchedAt: new Date("2024-03-01T12:00:00.000Z") }),
				logRow({
					watchedAt: new Date("2024-04-01T12:00:00.000Z"),
					movieId: 2,
					title: "Second",
				}),
				logRow({
					watchedAt: new Date("2024-05-01T12:00:00.000Z"),
					movieId: 3,
					title: "Third",
				}),
				logRow({
					watchedAt: new Date("2024-06-01T12:00:00.000Z"),
					movieId: 4,
					title: "Fourth",
				}),
			],
			reviewCount: 0,
		});

		expect(result.eligible).toBe(false);
		expect(result.totalLogs).toBe(4);
		expect(result.totalLogs).toBeLessThan(YEAR_IN_REVIEW_MIN_LOGS);
		expect(result.topGenres).toEqual([]);
		expect(result.topTitles).toEqual([]);
	});

	test("dense year aggregates genres, decade, busiest month, and top titles", () => {
		const logs: YearInReviewLogRow[] = [
			logRow({
				watchedAt: new Date("2024-01-10T12:00:00.000Z"),
				rating: 90,
				movieId: 101,
				title: "Alpha",
				releaseYear: 2014,
				genreIds: [18, 53],
			}),
			logRow({
				watchedAt: new Date("2024-01-20T12:00:00.000Z"),
				rating: 80,
				movieId: 102,
				title: "Beta",
				releaseYear: 2008,
				genreIds: [18],
			}),
			logRow({
				watchedAt: new Date("2024-02-05T12:00:00.000Z"),
				rating: 100,
				movieId: 103,
				title: "Gamma",
				releaseYear: 2019,
				genreIds: [53],
			}),
			logRow({
				watchedAt: new Date("2024-02-15T12:00:00.000Z"),
				rating: 70,
				movieId: 104,
				title: "Delta",
				releaseYear: 1999,
				genreIds: [18],
			}),
			logRow({
				watchedAt: new Date("2024-03-01T12:00:00.000Z"),
				rating: 95,
				movieId: 105,
				title: "Epsilon",
				releaseYear: 2012,
				genreIds: [878],
			}),
			logRow({
				watchedAt: new Date("2024-03-02T12:00:00.000Z"),
				rating: 85,
				movieId: 106,
				title: "Zeta",
				releaseYear: 2015,
				genreIds: [18],
			}),
		];

		const result = computeYearInReviewFromRows(2024, {
			logs,
			reviewCount: 2,
		});

		expect(result.eligible).toBe(true);
		expect(result.totalLogs).toBe(6);
		expect(result.averageRating).toBeCloseTo(8.7, 1);
		expect(result.topGenres.map((g) => g.genreId)).toEqual([18, 53, 878]);
		expect(result.topDecade).toBe(2010);
		expect(result.busiestMonth).toBe(1);
		expect(result.longestStreakInYear).toBe(2);
		expect(result.reviewCount).toBe(2);
		expect(result.topTitles).toHaveLength(5);
		expect(result.topTitles[0]?.title).toBe("Gamma");
		expect(result.topTitles[0]?.rating).toBe(10);
	});
});
