import { describe, expect, test } from "bun:test";

import {
	type DiaryTvEpisodeLog,
	EPISODE_SCORE_LEGEND,
	episodeBarHeightPx,
	episodeScoreBand,
	episodeScoreBandFill,
	initialSeasonNumber,
	pillForEpisode,
	seasonEpisodeAverage,
	seasonLogLabel,
	seasonLogScoreLabel,
	showLogLabel,
} from "./diary-tv-episode-pills";

const episode = { seasonNumber: 1, episodeNumber: 2 };

describe("pillForEpisode", () => {
	test("is empty when no episode log matches", () => {
		const logs: DiaryTvEpisodeLog[] = [
			{
				id: "season",
				logScope: "season",
				seasonNumber: 1,
				episodeNumber: null,
				rating: 80,
				watchedAt: "2026-01-01",
			},
		];
		expect(pillForEpisode(episode, logs)).toEqual({
			kind: "empty",
			latestLogId: null,
			averageDisplay: null,
		});
	});

	test("is neutral when every matching episode log is unrated", () => {
		const logs: DiaryTvEpisodeLog[] = [
			{
				id: "a",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: null,
				watchedAt: "2026-01-02",
			},
		];
		expect(pillForEpisode(episode, logs).kind).toBe("neutral");
	});

	test("averages rated logs and ignores unrated ones", () => {
		const logs: DiaryTvEpisodeLog[] = [
			{
				id: "old",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: 80,
				watchedAt: "2026-01-01",
			},
			{
				id: "new",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: 100,
				watchedAt: "2026-02-01",
			},
			{
				id: "blank",
				logScope: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				rating: null,
				watchedAt: "2026-03-01",
			},
		];
		expect(pillForEpisode(episode, logs)).toEqual({
			kind: "rated",
			latestLogId: "blank",
			averageDisplay: 9,
		});
	});
});

test("opens on the season of the latest episode log", () => {
	expect(
		initialSeasonNumber(
			[
				{
					id: "s",
					logScope: "episode",
					seasonNumber: 2,
					episodeNumber: 1,
					rating: 70,
					watchedAt: "2026-01-01",
				},
				{
					id: "t",
					logScope: "episode",
					seasonNumber: 3,
					episodeNumber: 1,
					rating: 90,
					watchedAt: "2026-04-01",
				},
			],
			[1, 2, 3],
		),
	).toBe(3);
});

test("falls back to the first catalogue season", () => {
	expect(initialSeasonNumber([], [0, 1])).toBe(0);
});

test("season and show labels do not invent episode color", () => {
	const logs: DiaryTvEpisodeLog[] = [
		{
			id: "show",
			logScope: "show",
			seasonNumber: null,
			episodeNumber: null,
			rating: 100,
			watchedAt: "2026-01-01",
		},
		{
			id: "season",
			logScope: "season",
			seasonNumber: 1,
			episodeNumber: null,
			rating: 60,
			watchedAt: "2026-02-01",
		},
	];
	expect(showLogLabel(logs)).toBe("Whole series · 10");
	expect(seasonLogLabel(1, logs)).toBe("Season 1 · 6.0");
	expect(seasonLogLabel(2, logs)).toBeNull();
	expect(seasonLogScoreLabel(1, logs)).toBe("6.0");
	expect(seasonLogScoreLabel(2, logs)).toBeNull();
});

test("season average weights each rated episode once", () => {
	const logs: DiaryTvEpisodeLog[] = [
		{
			id: "e2a",
			logScope: "episode",
			seasonNumber: 1,
			episodeNumber: 2,
			rating: 80,
			watchedAt: "2026-01-01",
		},
		{
			id: "e2b",
			logScope: "episode",
			seasonNumber: 1,
			episodeNumber: 2,
			rating: 100,
			watchedAt: "2026-01-02",
		},
		{
			id: "e3",
			logScope: "episode",
			seasonNumber: 1,
			episodeNumber: 3,
			rating: 60,
			watchedAt: "2026-01-03",
		},
		{
			id: "e4",
			logScope: "episode",
			seasonNumber: 1,
			episodeNumber: 4,
			rating: null,
			watchedAt: "2026-01-04",
		},
	];
	// Episode 2 averages to 9, episode 3 is 6, episode 4 is unrated.
	expect(seasonEpisodeAverage(1, logs)).toEqual({
		averageDisplay: 7.5,
		ratedCount: 2,
	});
	expect(seasonEpisodeAverage(2, logs)).toBeNull();
});

test("episode score bands follow the color chart", () => {
	expect(episodeScoreBand(10)).toBe("awesome");
	expect(episodeScoreBand(9)).toBe("awesome");
	expect(episodeScoreBand(8.9)).toBe("great");
	expect(episodeScoreBand(8)).toBe("great");
	expect(episodeScoreBand(7.8)).toBe("good");
	expect(episodeScoreBand(6)).toBe("regular");
	expect(episodeScoreBand(5.9)).toBe("bad");
	expect(episodeScoreBand(4)).toBe("bad");
	expect(episodeScoreBand(3.9)).toBe("garbage");
	expect(episodeScoreBand(0)).toBe("garbage");
});

test("score legend uses the same colors as the tiles", () => {
	const sample: Record<(typeof EPISODE_SCORE_LEGEND)[number]["band"], number> =
		{
			awesome: 9,
			great: 8,
			good: 7,
			regular: 6,
			bad: 4,
			garbage: 0,
		};
	expect(EPISODE_SCORE_LEGEND.map((item) => item.band)).toEqual([
		"awesome",
		"great",
		"good",
		"regular",
		"bad",
		"garbage",
	]);
	for (const item of EPISODE_SCORE_LEGEND) {
		expect(item.backgroundColor).toBe(
			episodeScoreBandFill(sample[item.band]).backgroundColor,
		);
	}
});

test("episode bars stretch a tight score cluster", () => {
	const scores = [9.4, 9.5, 10];
	const low = episodeBarHeightPx(9.4, scores);
	const high = episodeBarHeightPx(10, scores);
	expect(high - low).toBeGreaterThanOrEqual(28);
	expect(low).toBeLessThan(episodeBarHeightPx(9.5, scores));
	expect(episodeBarHeightPx(9.5, scores)).toBeLessThan(high);
});

test("unrated season logs do not repeat the season name as a score", () => {
	expect(
		seasonLogScoreLabel(2, [
			{
				id: "season",
				logScope: "season",
				seasonNumber: 2,
				episodeNumber: null,
				rating: null,
				watchedAt: "2026-02-01",
			},
		]),
	).toBeNull();
});
