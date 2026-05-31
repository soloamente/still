import { describe, expect, test } from "bun:test";

import { episodeSlotsForProgressCount } from "./anilist-import-episodes";

describe("episodeSlotsForProgressCount", () => {
	test("walks seasons in order up to progress count", () => {
		const slots = episodeSlotsForProgressCount(
			[
				{
					seasonNumber: 1,
					episodes: [
						{ season_number: 1, episode_number: 1, name: "E1" },
						{ season_number: 1, episode_number: 2, name: "E2" },
					],
				},
				{
					seasonNumber: 2,
					episodes: [{ season_number: 2, episode_number: 1, name: "S2E1" }],
				},
			],
			3,
		);
		expect(slots).toEqual([
			{ seasonNumber: 1, episodeNumber: 1 },
			{ seasonNumber: 1, episodeNumber: 2 },
			{ seasonNumber: 2, episodeNumber: 1 },
		]);
	});
});
