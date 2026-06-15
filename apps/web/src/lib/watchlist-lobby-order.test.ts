import { describe, expect, test } from "bun:test";
import { watchlistRowToPopularSeed } from "./watchlist-lobby-order";
import { formatWatchlistStreamingPill } from "./watchlist-streaming-display";

describe("watchlistRowToPopularSeed", () => {
	test("maps streaming provider to lobby pill label", () => {
		const seed = watchlistRowToPopularSeed({
			item: { addedAt: "2026-01-01", movieId: 550, tvId: null },
			movie: {
				tmdbId: 550,
				title: "Fight Club",
				posterPath: "/p.jpg",
			},
			tv: null,
			streaming_provider_name: "Netflix",
		});
		expect(seed.watchlistStreamingLabel).toBe(
			formatWatchlistStreamingPill("Netflix"),
		);
	});

	test("omits pill when provider missing", () => {
		const seed = watchlistRowToPopularSeed({
			item: { addedAt: "2026-01-01", movieId: 550, tvId: null },
			movie: {
				tmdbId: 550,
				title: "Fight Club",
				posterPath: "/p.jpg",
			},
			tv: null,
		});
		expect(seed.watchlistStreamingLabel).toBeNull();
	});
});
