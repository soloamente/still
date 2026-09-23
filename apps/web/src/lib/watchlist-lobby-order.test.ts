import { describe, expect, test } from "bun:test";
import {
	watchlistCatalogueWaveKey,
	watchlistOrderGridIsStale,
	watchlistRowToPopularSeed,
} from "./watchlist-lobby-order";
import { formatWatchlistStreamingPill } from "./watchlist-streaming-display";

describe("watchlistCatalogueWaveKey", () => {
	test("keys the wall to the seed order, not a sibling chip value", () => {
		expect(watchlistCatalogueWaveKey("latest_added")).toBe(
			"watchlist:latest_added",
		);
		expect(watchlistCatalogueWaveKey("earliest_added")).toBe(
			"watchlist:earliest_added",
		);
		expect(watchlistCatalogueWaveKey("latest_added")).not.toBe(
			watchlistCatalogueWaveKey("title_az"),
		);
	});
});

describe("watchlistOrderGridIsStale", () => {
	test("first paint (no seed yet) is not stale", () => {
		expect(watchlistOrderGridIsStale("latest_added", null)).toBe(false);
	});

	test("chip matching the RSC seed is not stale", () => {
		expect(watchlistOrderGridIsStale("title_az", "title_az")).toBe(false);
	});

	test("chip ahead of the RSC seed is stale", () => {
		expect(watchlistOrderGridIsStale("earliest_added", "latest_added")).toBe(
			true,
		);
	});
});

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
