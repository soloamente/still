import { describe, expect, test } from "bun:test";

import {
	type DiaryTvEpisodeLog,
	initialSeasonNumber,
	pillForEpisode,
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
