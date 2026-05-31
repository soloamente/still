import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { AnilistImportMedia } from "./anilist-import-json";
import { anilistMediaSearchQueries } from "./anilist-import-json";
import { pickBestAnimeTvSearchHit } from "./resolve-anilist-tv-tmdb";

const searchTv = mock(async () => ({
	results: [{ id: 46260, name: "Naruto", first_air_date: "2002-10-03" }],
}));

const fetchAnilistMediaTitles = mock(async () => null);
const fetchMalAnimeSearchTitles = mock(async () => [] as string[]);

mock.module("./tmdb", () => ({
	tmdbApi: { searchTv },
}));

mock.module("./anilist-media-titles", () => ({
	fetchAnilistMediaTitles,
	mergeAnilistMediaTitles: (
		base: AnilistImportMedia["title"],
		extra: AnilistImportMedia["title"],
	) => ({
		userPreferred: base.userPreferred ?? extra.userPreferred,
		english: base.english ?? extra.english,
		romaji: base.romaji ?? extra.romaji,
		native: base.native ?? extra.native,
	}),
}));

mock.module("./mal-anime-titles", () => ({
	fetchMalAnimeSearchTitles,
}));

mock.module("@still/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => [],
				}),
				limit: async () => [],
			}),
		}),
		update: () => ({
			set: () => ({
				where: async () => {},
			}),
		}),
	},
	tv: { tmdbJson: "tmdbJson", tmdbId: "tmdbId" },
}));

const { resolveAnilistMediaToTmdbTvId } = await import(
	"./resolve-anilist-tv-tmdb"
);

const sampleMedia: AnilistImportMedia = {
	anilistId: 20,
	idMal: 20,
	title: { english: "Naruto", romaji: "NARUTO" },
	startDate: { year: 2002 },
};

describe("anilistMediaSearchQueries", () => {
	test("prefers english before romaji for TMDb", () => {
		expect(
			anilistMediaSearchQueries({
				anilistId: 1,
				title: {
					userPreferred: "Sousou no Frieren",
					english: "Frieren: Beyond Journey's End",
					romaji: "Sousou no Frieren",
				},
			}),
		).toEqual(["Frieren: Beyond Journey's End", "Sousou no Frieren"]);
	});
});

describe("pickBestAnimeTvSearchHit", () => {
	test("prefers animation + year over unrelated live-action", () => {
		const id = pickBestAnimeTvSearchHit(
			[
				{
					id: 1,
					name: "Death Note Live",
					first_air_date: "2006-01-01",
					genre_ids: [18],
					original_language: "en",
					poster_path: null,
					backdrop_path: null,
					overview: "",
				},
				{
					id: 13916,
					name: "Death Note",
					first_air_date: "2006-10-04",
					genre_ids: [16, 9648],
					original_language: "ja",
					poster_path: null,
					backdrop_path: null,
					overview: "",
				},
			],
			2006,
		);
		expect(id).toBe(13916);
	});
});

describe("resolveAnilistMediaToTmdbTvId", () => {
	beforeEach(() => {
		searchTv.mockClear();
		searchTv.mockImplementation(async () => ({
			results: [{ id: 46260, name: "Naruto", first_air_date: "2002-10-03" }],
		}));
		fetchAnilistMediaTitles.mockClear();
		fetchAnilistMediaTitles.mockImplementation(async () => null);
		fetchMalAnimeSearchTitles.mockClear();
		fetchMalAnimeSearchTitles.mockImplementation(async () => []);
	});

	test("searches english title first", async () => {
		const id = await resolveAnilistMediaToTmdbTvId(sampleMedia);
		expect(id).toBe(46260);
		expect(searchTv).toHaveBeenCalledWith("Naruto", 1, { language: "en-US" });
	});

	test("tries romaji when english misses in both locales", async () => {
		let calls = 0;
		searchTv.mockImplementation(async (query: string) => {
			calls++;
			if (query === "NARUTO") {
				return {
					results: [
						{ id: 46260, name: "Naruto", first_air_date: "2002-10-03" },
					],
				};
			}
			return { results: [] };
		});
		const id = await resolveAnilistMediaToTmdbTvId({
			anilistId: 20,
			title: { english: "Wrong", romaji: "NARUTO" },
		});
		expect(id).toBe(46260);
		expect(calls).toBeGreaterThanOrEqual(3);
	});

	test("enriches from Anilist when local titles miss", async () => {
		searchTv.mockImplementation(async (query: string) => {
			if (query === "Frieren: Beyond Journey's End") {
				return {
					results: [
						{
							id: 209867,
							name: "Frieren: Beyond Journey's End",
							first_air_date: "2023-09-29",
						},
					],
				};
			}
			return { results: [] };
		});
		fetchAnilistMediaTitles.mockImplementation(async () => ({
			userPreferred: "Sousou no Frieren",
			english: "Frieren: Beyond Journey's End",
			romaji: "Sousou no Frieren",
			native: null,
		}));
		const id = await resolveAnilistMediaToTmdbTvId({
			anilistId: 154587,
			title: {
				userPreferred: "Sousou no Frieren",
				romaji: "Sousou no Frieren",
			},
		});
		expect(id).toBe(209867);
		expect(fetchAnilistMediaTitles).toHaveBeenCalledWith(154587);
	});

	test("returns null when all strategies miss", async () => {
		searchTv.mockImplementation(async () => ({ results: [] }));
		const id = await resolveAnilistMediaToTmdbTvId(sampleMedia);
		expect(id).toBeNull();
	});
});
