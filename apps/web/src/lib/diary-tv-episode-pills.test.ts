import { describe, expect, test } from "bun:test";

import {
	type DiaryTvEpisodeLog,
	pillForEpisode,
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
