import { describe, expect, test } from "bun:test";

import {
	isStillMalCacheFresh,
	MAL_ENRICHMENT_CACHE_TTL_MS,
	mapJikanAnimeToEnrichment,
	readStillMalCache,
} from "./mal-anime-enrichment";
import {
	readMalIdFromTmdbJson,
	STILL_ANILIST_JSON_KEY,
	STILL_MAL_JSON_KEY,
} from "./tv-mal-id";

describe("readMalIdFromTmdbJson", () => {
	test("prefers _stillMal then _stillAnilist then external_ids", () => {
		expect(
			readMalIdFromTmdbJson({
				[STILL_MAL_JSON_KEY]: { malId: 5114 },
			}),
		).toBe(5114);
		expect(
			readMalIdFromTmdbJson({
				[STILL_ANILIST_JSON_KEY]: { idMal: 20 },
			}),
		).toBe(20);
		expect(
			readMalIdFromTmdbJson({
				external_ids: { mal_id: 99 },
			}),
		).toBe(99);
	});

	test("returns null when no positive id", () => {
		expect(readMalIdFromTmdbJson(null)).toBeNull();
		expect(readMalIdFromTmdbJson({})).toBeNull();
		expect(
			readMalIdFromTmdbJson({
				[STILL_MAL_JSON_KEY]: { malId: 0 },
			}),
		).toBeNull();
	});
});

describe("readStillMalCache", () => {
	test("returns enrichment when score or rank present", () => {
		const cached = readStillMalCache({
			[STILL_MAL_JSON_KEY]: {
				malId: 5114,
				fetchedAt: new Date().toISOString(),
				score: 9.1,
				rank: 1,
				popularity: 25,
				status: "Finished Airing",
			},
		});
		expect(cached).toEqual({
			malId: 5114,
			score: 9.1,
			rank: 1,
			popularity: 25,
			status: "Finished Airing",
		});
	});

	test("returns null when only malId is stored", () => {
		expect(
			readStillMalCache({
				[STILL_MAL_JSON_KEY]: { malId: 5114 },
			}),
		).toBeNull();
	});
});

describe("isStillMalCacheFresh", () => {
	test("is fresh inside TTL window", () => {
		expect(
			isStillMalCacheFresh({
				fetchedAt: new Date().toISOString(),
			}),
		).toBe(true);
	});

	test("is stale after TTL", () => {
		const stale = new Date(Date.now() - MAL_ENRICHMENT_CACHE_TTL_MS - 1000);
		expect(
			isStillMalCacheFresh({
				fetchedAt: stale.toISOString(),
			}),
		).toBe(false);
	});
});

describe("mapJikanAnimeToEnrichment", () => {
	test("normalizes numeric fields", () => {
		expect(
			mapJikanAnimeToEnrichment(20, {
				score: 8.25,
				rank: 400,
				popularity: 50,
				status: "Finished Airing",
			}),
		).toEqual({
			malId: 20,
			score: 8.25,
			rank: 400,
			popularity: 50,
			status: "Finished Airing",
		});
	});
});
