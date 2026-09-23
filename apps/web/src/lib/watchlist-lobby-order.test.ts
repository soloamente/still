import { describe, expect, test } from "bun:test";
import {
	buildWatchlistLobbyHref,
	parseWatchlistLobbyOrder,
	sortContinueSeeds,
	tvWatchBundleToContinueSeed,
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

describe("parseWatchlistLobbyOrder decision modes", () => {
	test("accepts the three new modes and keeps the default", () => {
		expect(parseWatchlistLobbyOrder("tonight")).toBe("tonight");
		expect(parseWatchlistLobbyOrder("available")).toBe("available");
		expect(parseWatchlistLobbyOrder("continue")).toBe("continue");
		expect(parseWatchlistLobbyOrder(undefined)).toBe("latest_added");
		expect(buildWatchlistLobbyHref({ order: "tonight" })).toBe(
			"/watchlist?order=tonight",
		);
	});
});

describe("watchlist decision seeds", () => {
	const base = {
		item: { addedAt: "2026-09-01T00:00:00Z", movieId: 5, tvId: null },
		movie: { tmdbId: 5, title: "Heat", posterPath: null },
		tv: null,
	};
	test("tonight reason wins the pill slot over the streaming pill", () => {
		const seed = watchlistRowToPopularSeed({
			...base,
			streaming_provider_name: "Netflix",
			tonight_reason: "Maya recommended",
			streaming_alert: true,
		});
		expect(seed.watchlistStreamingLabel).toBe("Maya recommended");
		expect(seed.watchlistStreamingAlert).toBe(true);
		expect(seed.watchlistIsStreaming).toBe(true);
	});
	test("continue seed shows next episode and flags aired ones", () => {
		const seed = tvWatchBundleToContinueSeed(
			{
				watch: {
					id: "w",
					userId: "u",
					tvId: 9,
					status: "watching",
					progressMode: "episode",
					lastSeason: 2,
					lastEpisode: 4,
					notifyNewEpisodes: true,
					startedAt: "2026-01-01",
					statusChangedAt: "2026-09-01",
				},
				show: { tmdbId: 9, title: "Severance", posterPath: null },
				watchedEpisodes: [],
				nextEpisode: {
					seasonNumber: 2,
					episodeNumber: 5,
					airDate: "2026-09-20",
				},
			},
			"2026-09-23",
		);
		expect(seed?.listingKind).toBe("tv");
		expect(seed?.watchlistStreamingLabel).toBe("S2 · E5 next");
		expect(seed?.hasNewEpisode).toBe(true);
	});
	test("sortContinueSeeds puts new episodes first, then newest change", () => {
		const sorted = sortContinueSeeds([
			{ id: 1, hasNewEpisode: false, changedAt: "2026-09-22" },
			{ id: 2, hasNewEpisode: true, changedAt: "2026-09-01" },
			{ id: 3, hasNewEpisode: false, changedAt: "2026-09-23" },
			{ id: 4, hasNewEpisode: true, changedAt: "2026-09-10" },
		]);
		expect(sorted.map((s) => s.id)).toEqual([4, 2, 3, 1]);
	});
	test("continue seed without next episode data", () => {
		const seed = tvWatchBundleToContinueSeed(
			{
				watch: null,
				show: { tmdbId: 9, title: "X", posterPath: null },
				watchedEpisodes: [],
				nextEpisode: null,
			},
			"2026-09-23",
		);
		expect(seed?.watchlistStreamingLabel).toBe("Continue");
	});
});
