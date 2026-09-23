import { describe, expect, test } from "bun:test";

import { aggregateWatchlistProviderCatalogue } from "./watchlist-provider-catalogue";

describe("aggregateWatchlistProviderCatalogue", () => {
	test("aggregates flatrate providers with title counts, sorted by count desc", () => {
		const netflixApple = {
			"watch/providers": {
				results: {
					US: {
						flatrate: [
							{
								provider_id: 8,
								provider_name: "Netflix",
								logo_path: "/netflix.png",
							},
							{
								provider_id: 350,
								provider_name: "Apple TV",
								logo_path: "/apple.png",
							},
						],
					},
				},
			},
		};
		const netflixOnly = {
			"watch/providers": {
				results: {
					US: {
						flatrate: [
							{
								provider_id: 8,
								provider_name: "Netflix",
								logo_path: "/netflix.png",
							},
						],
					},
				},
			},
		};

		const providers = aggregateWatchlistProviderCatalogue(
			[{ tmdbJson: netflixApple }, { tmdbJson: netflixOnly }],
			"US",
		);

		expect(providers).toEqual([
			{
				providerId: 8,
				providerName: "Netflix",
				logoPath: "/netflix.png",
				titleCount: 2,
			},
			{
				providerId: 350,
				providerName: "Apple TV",
				logoPath: "/apple.png",
				titleCount: 1,
			},
		]);
	});

	test("dedupes duplicate flatrate rows on one title", () => {
		const json = {
			"watch/providers": {
				results: {
					US: {
						flatrate: [
							{ provider_id: 8, provider_name: "Netflix" },
							{ provider_id: 8, provider_name: "Netflix" },
						],
					},
				},
			},
		};

		expect(
			aggregateWatchlistProviderCatalogue([{ tmdbJson: json }], "US"),
		).toEqual([
			{
				providerId: 8,
				providerName: "Netflix",
				logoPath: null,
				titleCount: 1,
			},
		]);
	});

	test("empty rows → []", () => {
		expect(aggregateWatchlistProviderCatalogue([], "US")).toEqual([]);
	});
});
