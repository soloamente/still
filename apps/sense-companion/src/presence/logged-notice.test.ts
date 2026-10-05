import { describe, expect, test } from "bun:test";

import {
	companionLoggedCopy,
	formatCompanionRatingLabel,
	readCompanionLoggedNotice,
} from "./logged-notice";

const EPISODE = {
	logId: "log_1",
	title: "Stranger Things",
	kind: "tv" as const,
	season: 4,
	episode: 1,
	seriesFinale: false,
};

describe("readCompanionLoggedNotice", () => {
	test("reads a log notice", () => {
		expect(
			readCompanionLoggedNotice({
				type: "sense-companion:logged",
				...EPISODE,
			}),
		).toEqual(EPISODE);
	});

	test("ignores other host messages", () => {
		expect(
			readCompanionLoggedNotice({
				type: "sense-companion:discord-status",
				connected: true,
			}),
		).toBeNull();
	});
});

describe("companionLoggedCopy", () => {
	test("an episode names the season and episode", () => {
		expect(companionLoggedCopy(EPISODE)).toBe("Logged S4 E1");
	});

	test("the last episode of the show names the show", () => {
		expect(companionLoggedCopy({ ...EPISODE, seriesFinale: true })).toBe(
			"Logged whole show, Stranger Things",
		);
	});

	test("a film keeps its title", () => {
		expect(
			companionLoggedCopy({
				logId: "log_2",
				title: "Am I OK?",
				kind: "movie",
				season: null,
				episode: null,
				seriesFinale: false,
			}),
		).toBe("Logged Am I OK?");
	});
});

describe("formatCompanionRatingLabel", () => {
	test("shows one decimal, and 10 without a decimal", () => {
		expect(formatCompanionRatingLabel(7.4)).toBe("7.4");
		expect(formatCompanionRatingLabel(10)).toBe("10");
	});
});
