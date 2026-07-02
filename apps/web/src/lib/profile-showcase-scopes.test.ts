import { describe, expect, test } from "bun:test";

import { distinctShowcaseTvScopeOptions } from "./profile-showcase-scopes";

describe("distinctShowcaseTvScopeOptions", () => {
	test("dedupes identical scopes", () => {
		const options = distinctShowcaseTvScopeOptions(1399, [
			{ logScope: "season", seasonNumber: 2, episodeNumber: null },
			{ logScope: "season", seasonNumber: 2, episodeNumber: null },
		]);
		expect(options).toHaveLength(1);
		expect(options[0]?.label).toBe("Season 2");
	});

	test("keeps show, season, and episode scopes separate", () => {
		const options = distinctShowcaseTvScopeOptions(1399, [
			{ logScope: "show" },
			{ logScope: "season", seasonNumber: 1 },
			{ logScope: "episode", seasonNumber: 1, episodeNumber: 3 },
		]);
		expect(options.map((row) => row.label)).toEqual([
			"Whole series",
			"Season 1",
			"S01E03",
		]);
	});
});
