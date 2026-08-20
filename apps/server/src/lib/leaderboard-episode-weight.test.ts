import { describe, expect, test } from "bun:test";

import {
	episodeCountForSeason,
	seasonsFromTvTmdbJson,
	selectLogsForEpisodeRank,
	showEpisodeCountFromTmdbJson,
	weightForEpisodeRankLog,
} from "./leaderboard-episode-weight";

const seasons = [
	{ season_number: 1, episode_count: 10 },
	{ season_number: 2, episode_count: 8 },
];

describe("weightForEpisodeRankLog", () => {
	test("episode scope always counts as 1", () => {
		expect(weightForEpisodeRankLog("episode", 1, { seasons })).toBe(1);
	});

	test("season scope uses episode_count with ≥1 fallback", () => {
		expect(weightForEpisodeRankLog("season", 2, { seasons })).toBe(8);
		expect(weightForEpisodeRankLog("season", 9, { seasons })).toBe(1);
		expect(weightForEpisodeRankLog("season", 1, null)).toBe(1);
	});

	test("show scope prefers number_of_episodes then season sum", () => {
		expect(
			weightForEpisodeRankLog("show", null, {
				number_of_episodes: 24,
				seasons,
			}),
		).toBe(24);
		expect(weightForEpisodeRankLog("show", null, { seasons })).toBe(18);
		expect(weightForEpisodeRankLog("show", null, {})).toBe(1);
	});

	test("prefers _stillSeasons cache over top-level seasons", () => {
		const tmdbJson = {
			seasons: [{ season_number: 1, episode_count: 99 }],
			_stillSeasons: {
				syncedAt: "2026-01-01T00:00:00.000Z",
				seasons: [{ season_number: 1, episode_count: 6 }],
			},
		};
		expect(seasonsFromTvTmdbJson(tmdbJson)[0]?.episode_count).toBe(6);
		expect(weightForEpisodeRankLog("season", 1, tmdbJson)).toBe(6);
	});
});

describe("episodeCountForSeason / showEpisodeCountFromTmdbJson", () => {
	test("ignores empty or invalid season counts", () => {
		expect(
			episodeCountForSeason([{ season_number: 1, episode_count: 0 }], 1),
		).toBe(null);
		expect(
			showEpisodeCountFromTmdbJson({ number_of_episodes: 0, seasons }),
		).toBe(18);
	});
});

describe("selectLogsForEpisodeRank", () => {
	test("keeps episode logs and drops the season log for the same season", () => {
		const kept = selectLogsForEpisodeRank([
			{
				id: "s2",
				tvId: 1,
				logScope: "season",
				seasonNumber: 2,
			},
			{
				id: "e1",
				tvId: 1,
				logScope: "episode",
				seasonNumber: 2,
			},
			{
				id: "e2",
				tvId: 1,
				logScope: "episode",
				seasonNumber: 2,
			},
		]);
		expect(kept.map((r) => r.id).sort()).toEqual(["e1", "e2"]);
	});

	test("keeps a season log when that season has no episode logs", () => {
		const kept = selectLogsForEpisodeRank([
			{
				id: "s1",
				tvId: 1,
				logScope: "season",
				seasonNumber: 1,
			},
			{
				id: "e2",
				tvId: 1,
				logScope: "episode",
				seasonNumber: 2,
			},
		]);
		expect(kept.map((r) => r.id).sort()).toEqual(["e2", "s1"]);
	});

	test("suppresses show log when any season or episode log exists for the title", () => {
		const withSeason = selectLogsForEpisodeRank([
			{ id: "show", tvId: 5, logScope: "show", seasonNumber: null },
			{ id: "s1", tvId: 5, logScope: "season", seasonNumber: 1 },
		]);
		expect(withSeason.map((r) => r.id)).toEqual(["s1"]);

		const showOnly = selectLogsForEpisodeRank([
			{ id: "show", tvId: 5, logScope: "show", seasonNumber: null },
		]);
		expect(showOnly.map((r) => r.id)).toEqual(["show"]);
	});
});
