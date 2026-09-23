import { describe, expect, test } from "bun:test";

import { computePatronEntitlements } from "./patron-entitlements";
import {
	buildWatchlistStreamingAlertEmailContent,
	diffWatchlistStreamingProviders,
	evaluateWatchlistStreamingDiff,
	flatrateProvidersForRegion,
	formatWatchlistStreamingPill,
	primaryFlatrateProviderName,
	readCatalogWatchRegionPref,
	readCatalogWatchRegionPrefOrNull,
	readCatalogWatchRegionSignal,
	readWatchlistStreamingAlertsPref,
	shouldProcessWatchlistStreamingAlerts,
	type TmdbWatchProvidersByCountry,
	watchlistItemAlertEligible,
	watchlistSnapshotAction,
	watchProvidersFromTmdbJson,
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

describe("shouldProcessWatchlistStreamingAlerts", () => {
	test("skips Still patrons even when pref is on", () => {
		const still = computePatronEntitlements({
			subscriptionTier: "still",
			planOverride: null,
			featureGrantKeys: [],
		});
		expect(shouldProcessWatchlistStreamingAlerts({}, still)).toBe(false);
	});

	test("runs for Attuned patrons with pref enabled", () => {
		const attuned = computePatronEntitlements({
			subscriptionTier: "attuned",
			planOverride: null,
			featureGrantKeys: [],
		});
		expect(shouldProcessWatchlistStreamingAlerts({}, attuned)).toBe(true);
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

describe("watchProvidersFromTmdbJson + primaryFlatrateProviderName", () => {
	test("reads the SQL-projected watch/providers object (not a full tmdb_json row)", () => {
		const projected = {
			"watch/providers": { results: US_PROVIDERS },
		};
		expect(watchProvidersFromTmdbJson(projected)).toEqual(US_PROVIDERS);
		expect(primaryFlatrateProviderName(projected, "US")).toBe("Netflix");
		expect(primaryFlatrateProviderName(projected, "DE")).toBe(null);
	});

	test("returns null when the projection has no providers blob", () => {
		expect(primaryFlatrateProviderName({ "watch/providers": null }, "US")).toBe(
			null,
		);
		expect(primaryFlatrateProviderName(null, "US")).toBe(null);
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

describe("readCatalogWatchRegionPrefOrNull", () => {
	test("null when unset or world-ish; region when valid", () => {
		expect(readCatalogWatchRegionPrefOrNull(null)).toBeNull();
		expect(
			readCatalogWatchRegionPrefOrNull({ catalogTmdbWatchRegion: "ALL" }),
		).toBeNull();
		expect(
			readCatalogWatchRegionPrefOrNull({ catalogTmdbWatchRegion: "it" }),
		).toBe("IT");
		expect(
			readCatalogWatchRegionPrefOrNull({ catalogTmdbWatchRegion: "xyz" }),
		).toBeNull();
	});
});

describe("readCatalogWatchRegionSignal", () => {
	test("ISO region, explicit ALL, or null", () => {
		expect(readCatalogWatchRegionSignal(null)).toBeNull();
		expect(readCatalogWatchRegionSignal({ catalogTmdbWatchRegion: "it" })).toBe(
			"IT",
		);
		expect(
			readCatalogWatchRegionSignal({ catalogTmdbWatchRegion: " all " }),
		).toBe("ALL");
		expect(
			readCatalogWatchRegionSignal({ catalogTmdbWatchRegion: "WORLD" }),
		).toBeNull();
	});
});

describe("watchlistItemAlertEligible", () => {
	test("needs the feature, then either the global pref or the item flag", () => {
		expect(
			watchlistItemAlertEligible({
				globalPref: true,
				itemFlag: false,
				hasFeature: false,
			}),
		).toBe(false);
		expect(
			watchlistItemAlertEligible({
				globalPref: true,
				itemFlag: false,
				hasFeature: true,
			}),
		).toBe(true);
		expect(
			watchlistItemAlertEligible({
				globalPref: false,
				itemFlag: true,
				hasFeature: true,
			}),
		).toBe(true);
		expect(
			watchlistItemAlertEligible({
				globalPref: false,
				itemFlag: false,
				hasFeature: true,
			}),
		).toBe(false);
	});
});

describe("watchlistSnapshotAction", () => {
	test("no snapshot work without the feature, whatever the prefs", () => {
		for (const globalPref of [true, false]) {
			for (const itemFlag of [true, false]) {
				expect(
					watchlistSnapshotAction({ hasFeature: false, globalPref, itemFlag }),
				).toBe("skip");
			}
		}
	});

	test("feature holders keep a baseline and notify only when opted in", () => {
		expect(
			watchlistSnapshotAction({
				hasFeature: true,
				globalPref: false,
				itemFlag: false,
			}),
		).toBe("snapshot_only");
		expect(
			watchlistSnapshotAction({
				hasFeature: true,
				globalPref: true,
				itemFlag: false,
			}),
		).toBe("snapshot_and_notify");
		expect(
			watchlistSnapshotAction({
				hasFeature: true,
				globalPref: false,
				itemFlag: true,
			}),
		).toBe("snapshot_and_notify");
		expect(
			watchlistSnapshotAction({
				hasFeature: true,
				globalPref: true,
				itemFlag: true,
			}),
		).toBe("snapshot_and_notify");
	});
});
