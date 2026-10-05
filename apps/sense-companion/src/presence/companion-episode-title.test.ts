import { describe, expect, test } from "bun:test";

import { inferCompanionEpisodeTitle } from "./companion-episode-title";

describe("inferCompanionEpisodeTitle", () => {
	test("uses details when it is not the show title", () => {
		expect(
			inferCompanionEpisodeTitle("Stranger Things", {
				name: "Stranger Things",
				details: "Chapter One",
				state: "S4 E1",
				largeImageKey: null,
				largeImageText: null,
				smallImageKey: null,
				smallImageText: null,
				startTimestamp: null,
				endTimestamp: null,
				type: 3,
			}),
		).toBe("Chapter One");
	});

	test("parses episode name from a season mark on state", () => {
		expect(
			inferCompanionEpisodeTitle("Stranger Things", {
				name: "Stranger Things",
				details: "Stranger Things",
				state: "S4 E1 - Chapter One",
				largeImageKey: null,
				largeImageText: null,
				smallImageKey: null,
				smallImageText: null,
				startTimestamp: null,
				endTimestamp: null,
				type: 3,
			}),
		).toBe("Chapter One");
	});
});
