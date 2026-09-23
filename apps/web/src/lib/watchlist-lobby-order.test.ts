import { describe, expect, test } from "bun:test";
import {
	buildWatchlistLobbyHref,
	decorateWatchlistSeedsForMode,
	parseWatchlistLobbyOrder,
	resolveWatchlistLegacyRedirect,
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
	const fightClubRow = {
		item: { addedAt: "2026-01-01", movieId: 550, tvId: null },
		movie: {
			tmdbId: 550,
			title: "Fight Club",
			posterPath: "/p.jpg",
		},
		tv: null,
		streaming_provider_name: "Netflix",
	} as const;

	test("Now available maps streaming provider to lobby pill label", () => {
		const seed = watchlistRowToPopularSeed(fightClubRow, "available");
		expect(seed.watchlistStreamingLabel).toBe(
			formatWatchlistStreamingPill("Netflix"),
		);
	});

	test("Recently added shows the title on the scrim, not streaming noise", () => {
		const seed = watchlistRowToPopularSeed(fightClubRow, "latest_added");
		expect(seed.watchlistStreamingLabel).toBe("Fight Club");
	});

	test("Tonight shows only the ranked reason, not a streaming fallback", () => {
		const seed = watchlistRowToPopularSeed(fightClubRow, "tonight");
		expect(seed.watchlistStreamingLabel).toBeNull();
		const withReason = watchlistRowToPopularSeed(
			{ ...fightClubRow, tonight_reason: "Maya recommended" },
			"tonight",
		);
		expect(withReason.watchlistStreamingLabel).toBe("Maya recommended");
	});
});

describe("decorateWatchlistSeedsForMode", () => {
	test("adds rank sublines on the first three tonight tiles", () => {
		const seeds = decorateWatchlistSeedsForMode(
			[
				{ id: 1, title: "A", poster_url: null },
				{ id: 2, title: "B", poster_url: null },
				{ id: 3, title: "C", poster_url: null },
				{ id: 4, title: "D", poster_url: null },
			],
			"tonight",
		);
		expect(seeds[0]?.watchlistCaptionSubline).toBe("Top pick");
		expect(seeds[2]?.watchlistCaptionSubline).toBe("3rd pick");
		expect(seeds[3]?.watchlistCaptionSubline).toBeUndefined();
	});
});

describe("parseWatchlistLobbyOrder", () => {
	test("accepts the three grid sorts and keeps the default", () => {
		expect(parseWatchlistLobbyOrder("latest_added")).toBe("latest_added");
		expect(parseWatchlistLobbyOrder("earliest_added")).toBe("earliest_added");
		expect(parseWatchlistLobbyOrder("title_az")).toBe("title_az");
		expect(parseWatchlistLobbyOrder(undefined)).toBe("latest_added");
	});

	test("legacy decision modes fall back to recently added", () => {
		expect(parseWatchlistLobbyOrder("tonight")).toBe("latest_added");
		expect(parseWatchlistLobbyOrder("available")).toBe("latest_added");
		expect(parseWatchlistLobbyOrder("continue")).toBe("latest_added");
	});
});

describe("buildWatchlistLobbyHref", () => {
	test("default sort omits order param", () => {
		expect(buildWatchlistLobbyHref({ order: "latest_added" })).toBe(
			"/watchlist",
		);
	});

	test("includes providers and non-default order", () => {
		expect(
			buildWatchlistLobbyHref({
				order: "title_az",
				providers: [350, 8],
			}),
		).toBe("/watchlist?order=title_az&providers=8%2C350");
	});
});

describe("resolveWatchlistLegacyRedirect", () => {
	test("tonight and continue strip order", () => {
		expect(resolveWatchlistLegacyRedirect({ order: "tonight" })).toBe(
			"/watchlist",
		);
		expect(resolveWatchlistLegacyRedirect({ order: "continue" })).toBe(
			"/watchlist",
		);
	});

	test("available opens filters once", () => {
		expect(resolveWatchlistLegacyRedirect({ order: "available" })).toBe(
			"/watchlist?filters=1",
		);
	});

	test("preserves providers while redirecting", () => {
		expect(
			resolveWatchlistLegacyRedirect({
				order: "tonight",
				providers: "8,350",
			}),
		).toBe("/watchlist?providers=8%2C350");
	});

	test("non-legacy order → no redirect", () => {
		expect(resolveWatchlistLegacyRedirect({ order: "title_az" })).toBeNull();
	});
});

describe("watchlistCatalogueWaveKey providers", () => {
	test("includes provider ids in the wave key", () => {
		expect(watchlistCatalogueWaveKey("latest_added", [8, 350])).toBe(
			"watchlist:latest_added:8,350",
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
		const seed = watchlistRowToPopularSeed(
			{
				...base,
				streaming_provider_name: "Netflix",
				tonight_reason: "Maya recommended",
				streaming_alert: true,
				streaming_region: "US",
				streaming_in_region: true,
			},
			"tonight",
		);
		expect(seed.watchlistStreamingLabel).toBe("Maya recommended");
		expect(seed.watchlistStreamingAlert).toBe(true);
		expect(seed.watchlistIsStreaming).toBe(true);
		expect(seed.watchlistStreamingRegion).toBe("US");
	});
	test("carries the reason kind for analytics, separate from the pill text", () => {
		const seed = watchlistRowToPopularSeed(
			{
				...base,
				tonight_reason: "On your Heist nights list",
				tonight_reason_kind: "list",
			},
			"tonight",
		);
		expect(seed.watchlistStreamingLabel).toBe("On your Heist nights list");
		expect(seed.watchlistReasonKind).toBe("list");
		expect(
			watchlistRowToPopularSeed(base, "tonight").watchlistReasonKind,
		).toBeNull();
	});
	test("no chosen region → streaming unknown even with a US-fallback pill", () => {
		const seed = watchlistRowToPopularSeed(
			{
				...base,
				streaming_provider_name: "Netflix",
				streaming_region: null,
				streaming_in_region: null,
			},
			"available",
		);
		expect(seed.watchlistStreamingLabel).toBe("Now on Netflix");
		expect(seed.watchlistIsStreaming).toBeUndefined();
		expect(seed.watchlistStreamingRegion).toBeNull();
	});
	test("chosen region drives the flag, not the pill provider", () => {
		const off = watchlistRowToPopularSeed(
			{
				...base,
				streaming_provider_name: null,
				streaming_region: "IT",
				streaming_in_region: false,
			},
			"available",
		);
		expect(off.watchlistIsStreaming).toBe(false);
		const legacyPayload = watchlistRowToPopularSeed(
			{
				...base,
				streaming_provider_name: "Netflix",
			},
			"available",
		);
		expect(legacyPayload.watchlistIsStreaming).toBeUndefined();
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
		expect(seed?.watchlistStreamingLabel).toBeNull();
	});
	test("unaired next episode names its air date, not 'next'", () => {
		const seed = tvWatchBundleToContinueSeed(
			{
				watch: null,
				show: { tmdbId: 9, title: "X", posterPath: null },
				watchedEpisodes: [],
				nextEpisode: {
					seasonNumber: 2,
					episodeNumber: 5,
					airDate: "2026-10-03",
				},
			},
			"2026-09-23",
		);
		expect(seed?.watchlistStreamingLabel).toBe("S2 · E5 · Oct 3");
		expect(seed?.hasNewEpisode).toBe(false);
	});
	test("next episode airing today counts as aired", () => {
		const seed = tvWatchBundleToContinueSeed(
			{
				watch: null,
				show: { tmdbId: 9, title: "X", posterPath: null },
				watchedEpisodes: [],
				nextEpisode: {
					seasonNumber: 1,
					episodeNumber: 3,
					airDate: "2026-09-23",
				},
			},
			"2026-09-23",
		);
		expect(seed?.watchlistStreamingLabel).toBe("S1 · E3 next");
	});
	test("continue seed accepts Date timestamps from Eden (no crash)", () => {
		// Eden deserializes date-like JSON strings into `Date` at runtime,
		// even though `TvWatchBundle` types them as strings.
		const bundle = {
			watch: null,
			show: { tmdbId: 9, title: "X", posterPath: null },
			watchedEpisodes: [],
			nextEpisode: {
				seasonNumber: 1,
				episodeNumber: 2,
				airDate: new Date("2026-09-20T00:00:00Z"),
			},
		} as unknown as Parameters<typeof tvWatchBundleToContinueSeed>[0];
		const seed = tvWatchBundleToContinueSeed(bundle, "2026-09-23");
		expect(seed?.hasNewEpisode).toBe(true);
		const invalid = {
			...bundle,
			nextEpisode: {
				seasonNumber: 1,
				episodeNumber: 2,
				airDate: new Date("nope"),
			},
		} as unknown as Parameters<typeof tvWatchBundleToContinueSeed>[0];
		expect(
			tvWatchBundleToContinueSeed(invalid, "2026-09-23")?.hasNewEpisode,
		).toBe(false);
	});
});
