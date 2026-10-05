import { describe, expect, test } from "bun:test";

import {
	presentTvSeasonScore,
	presentTvTitleScore,
	tvChildAverageNote,
	tvEditorAverageSeed,
	tvScoreAverageAside,
	tvScoreSourceLabel,
} from "./tv-score-presentation";

describe("tv score presentation", () => {
	test("a saved show score of 10 stays beside a 9.7 season average", () => {
		const presentation = presentTvTitleScore([
			{ logScope: "show", rating: 100 },
			{ logScope: "episode", seasonNumber: 1, episodeNumber: 1, rating: 96 },
			{ logScope: "episode", seasonNumber: 1, episodeNumber: 2, rating: 98 },
		]);
		expect(presentation).toEqual({
			rating: 100,
			source: "yours",
			averageRating: 97,
			averageCount: 1,
		});
		expect(tvScoreSourceLabel("show", presentation)).toBe("Your rating");
		expect(tvScoreAverageAside("show", presentation)).toBe(
			"Seasons average 9.7",
		);
		expect(tvChildAverageNote("show", presentation)).toBe(
			"Seasons average 9.7",
		);
		expect(tvEditorAverageSeed("show", presentation)).toEqual({
			stored: 97,
			label: "Average of 1 season",
		});
	});

	test("episode scores become the show score when the show was never rated", () => {
		const presentation = presentTvTitleScore([
			{ logScope: "episode", seasonNumber: 1, episodeNumber: 1, rating: 96 },
			{ logScope: "episode", seasonNumber: 1, episodeNumber: 2, rating: 98 },
		]);
		expect(presentation.rating).toBe(97);
		expect(presentation.source).toBe("average");
		expect(tvScoreSourceLabel("show", presentation)).toBe(
			"Average of 1 season",
		);
		expect(tvScoreAverageAside("show", presentation)).toBeNull();
		expect(tvChildAverageNote("show", presentation)).toBe(
			"Seasons average 9.7",
		);
		expect(tvEditorAverageSeed("show", presentation)).toEqual({
			stored: 97,
			label: "Average of 1 season",
		});
	});

	test("a saved season score stays beside the episode average", () => {
		const presentation = presentTvSeasonScore(
			[
				{ logScope: "season", seasonNumber: 1, rating: 80 },
				{ logScope: "episode", seasonNumber: 1, episodeNumber: 1, rating: 100 },
			],
			1,
		);
		expect(presentation.source).toBe("yours");
		expect(tvScoreSourceLabel("season", presentation)).toBe("Your rating");
		expect(tvScoreAverageAside("season", presentation)).toBe(
			"Episodes average 10",
		);
		expect(tvEditorAverageSeed("season", presentation)).toEqual({
			stored: 100,
			label: "Average of 1 episode",
		});
	});
});
