import { describe, expect, test } from "bun:test";

import {
	buildOnboardingImportQueue,
	toggleOnboardingImportLiveSource,
} from "./onboarding-import-queue";

describe("buildOnboardingImportQueue", () => {
	test("empty selection yields an empty queue", () => {
		expect(buildOnboardingImportQueue([])).toEqual([]);
	});

	test("letterboxd only", () => {
		expect(buildOnboardingImportQueue(["letterboxd"])).toEqual(["letterboxd"]);
	});

	test("anilist only", () => {
		expect(buildOnboardingImportQueue(["anilist"])).toEqual(["anilist"]);
	});

	test("both live sources always order Letterboxd then Anilist", () => {
		expect(buildOnboardingImportQueue(["anilist", "letterboxd"])).toEqual([
			"letterboxd",
			"anilist",
		]);
		expect(buildOnboardingImportQueue(["letterboxd", "anilist"])).toEqual([
			"letterboxd",
			"anilist",
		]);
	});

	test("ignores soon ids and unknown strings", () => {
		expect(
			buildOnboardingImportQueue([
				"imdb",
				"trakt",
				"serializd",
				"tvtime",
				"plex",
			]),
		).toEqual([]);
		expect(buildOnboardingImportQueue(["letterboxd", "imdb"])).toEqual([
			"letterboxd",
		]);
	});

	test("dedupes repeats", () => {
		expect(
			buildOnboardingImportQueue(["letterboxd", "letterboxd", "anilist"]),
		).toEqual(["letterboxd", "anilist"]);
	});
});

describe("toggleOnboardingImportLiveSource", () => {
	test("adds then removes", () => {
		const added = toggleOnboardingImportLiveSource(new Set(), "letterboxd");
		expect([...added]).toEqual(["letterboxd"]);
		expect([...toggleOnboardingImportLiveSource(added, "letterboxd")]).toEqual(
			[],
		);
	});
});
