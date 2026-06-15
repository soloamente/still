import { describe, expect, test } from "bun:test";

import {
	buildWatchlistStreamingAlertEmailContent,
	diffWatchlistStreamingProviders,
	evaluateWatchlistStreamingDiff,
	flatrateProvidersForRegion,
	formatWatchlistStreamingPill,
	readCatalogWatchRegionPref,
	readWatchlistStreamingAlertsPref,
	type TmdbWatchProvidersByCountry,
} from "./watchlist-streaming-alerts";

const US_PROVIDERS: TmdbWatchProvidersByCountry = {
	US: {
		flatrate: [
			{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.png" },
			{ provider_id: 9, provider_name: "Prime Video", logo_path: "/p.png" },
		],
	},
};

describe("readWatchlistStreamingAlertsPref", () => {
	test("defaults to enabled", () => {
		expect(readWatchlistStreamingAlertsPref(null)).toBe(true);
		expect(readWatchlistStreamingAlertsPref({})).toBe(true);
	});

	test("respects explicit false", () => {
		expect(
			readWatchlistStreamingAlertsPref({ watchlistStreamingAlerts: false }),
		).toBe(false);
	});
});

describe("readCatalogWatchRegionPref", () => {
	test("defaults to US", () => {
		expect(readCatalogWatchRegionPref(null)).toBe("US");
	});

	test("normalizes catalogue region", () => {
		expect(readCatalogWatchRegionPref({ catalogTmdbWatchRegion: "gb" })).toBe(
			"GB",
		);
	});
});

describe("flatrateProvidersForRegion", () => {
	test("returns sorted unique flatrate providers", () => {
		expect(flatrateProvidersForRegion(US_PROVIDERS, "US")).toEqual([
			{ providerId: 8, providerName: "Netflix" },
			{ providerId: 9, providerName: "Prime Video" },
		]);
	});

	test("returns empty when region missing", () => {
		expect(flatrateProvidersForRegion(US_PROVIDERS, "DE")).toEqual([]);
	});
});

describe("formatWatchlistStreamingPill", () => {
	test("formats provider label", () => {
		expect(formatWatchlistStreamingPill("Netflix")).toBe("Now on Netflix");
		expect(formatWatchlistStreamingPill("  ")).toBe("");
	});
});

describe("buildWatchlistStreamingAlertEmailContent", () => {
	test("builds Pro email copy with deep link", () => {
		const content = buildWatchlistStreamingAlertEmailContent({
			title: "Fight Club",
			providerName: "Netflix",
			region: "US",
			href: "/movies/550",
			appOrigin: "https://sense.test",
		});
		expect(content.subject).toBe("Now streaming · Fight Club");
		expect(content.text).toContain("Netflix");
		expect(content.text).toContain("https://sense.test/movies/550");
		expect(content.html).toContain("Open in Sense");
	});
});

describe("diffWatchlistStreamingProviders", () => {
	test("first snapshot does not notify", () => {
		expect(
			diffWatchlistStreamingProviders({
				previousProviderIds: null,
				currentProviders: [{ providerId: 8, providerName: "Netflix" }],
			}),
		).toEqual([]);
	});

	test("detects newly added Netflix", () => {
		expect(
			diffWatchlistStreamingProviders({
				previousProviderIds: [],
				currentProviders: [{ providerId: 8, providerName: "Netflix" }],
			}),
		).toEqual([{ providerId: 8, providerName: "Netflix" }]);
	});

	test("ignores providers that were already present", () => {
		expect(
			diffWatchlistStreamingProviders({
				previousProviderIds: [8],
				currentProviders: [{ providerId: 8, providerName: "Netflix" }],
			}),
		).toEqual([]);
	});
});

describe("evaluateWatchlistStreamingDiff", () => {
	test("marks first snapshot without new providers", () => {
		const diff = evaluateWatchlistStreamingDiff({
			region: "US",
			previousProviderIds: null,
			watchProviders: US_PROVIDERS,
		});
		expect(diff.isFirstSnapshot).toBe(true);
		expect(diff.newProviders).toEqual([]);
		expect(diff.currentProviders).toHaveLength(2);
	});

	test("fixture: Netflix added after empty baseline", () => {
		const diff = evaluateWatchlistStreamingDiff({
			region: "US",
			previousProviderIds: [],
			watchProviders: {
				US: {
					flatrate: [
						{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.png" },
					],
				},
			},
		});
		expect(diff.isFirstSnapshot).toBe(false);
		expect(diff.newProviders).toEqual([
			{ providerId: 8, providerName: "Netflix" },
		]);
	});
});
