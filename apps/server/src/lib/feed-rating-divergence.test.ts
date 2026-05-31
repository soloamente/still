import { describe, expect, test } from "bun:test";

import {
	FEED_DIVERGENCE_MIN_DELTA,
	pickFeedRatingDivergence,
} from "./feed-rating-divergence";

function row(
	userId: string,
	movieId: number,
	rating: number,
	watchedAtMs: number,
): Parameters<typeof pickFeedRatingDivergence>[0][number] {
	return {
		log: {
			userId,
			movieId,
			tvId: null,
			rating,
			watchedAt: new Date(watchedAtMs),
		},
		movie: {
			tmdbId: movieId,
			title: "Test Film",
			posterPath: "/p.jpg",
		},
		tv: null,
		user: { id: userId, name: userId, image: null },
		profile: { handle: userId, displayName: userId },
	};
}

describe("pickFeedRatingDivergence", () => {
	test("threshold matches ST.5 spec", () => {
		expect(FEED_DIVERGENCE_MIN_DELTA).toBe(4);
	});

	test("returns null when fewer than two patrons on a title", () => {
		expect(pickFeedRatingDivergence([row("a", 1, 90, 1)])).toBeNull();
	});

	test("returns null when spread is below threshold", () => {
		expect(
			pickFeedRatingDivergence([row("a", 1, 80, 1), row("b", 1, 70, 2)]),
		).toBeNull();
	});

	test("picks largest gap between followed patrons", () => {
		const result = pickFeedRatingDivergence([
			row("a", 1, 90, 100),
			row("b", 1, 40, 200),
			row("c", 2, 100, 300),
			row("d", 2, 20, 400),
		]);
		expect(result).not.toBeNull();
		expect(result?.payload.delta).toBeGreaterThanOrEqual(4);
		expect(result?.payload.movieId).toBe(2);
		expect(result?.payload.lowPatron.displayRating).toBe(2);
		expect(result?.payload.highPatron.displayRating).toBe(10);
	});

	test("dedupes to latest log per patron per title", () => {
		const result = pickFeedRatingDivergence([
			row("a", 1, 50, 1),
			row("a", 1, 95, 500),
			row("b", 1, 30, 2),
		]);
		expect(result?.payload.highPatron.userId).toBe("a");
		expect(result?.payload.highPatron.displayRating).toBe(9.5);
		expect(result?.payload.delta).toBeGreaterThanOrEqual(4);
	});
});
