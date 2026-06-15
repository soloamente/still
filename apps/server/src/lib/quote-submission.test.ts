import { describe, expect, test } from "bun:test";

import {
	parseQuoteSubmissionInput,
	quoteSubmissionNotificationHref,
} from "./quote-submission";

describe("quoteSubmissionNotificationHref", () => {
	test("links movie detail Quotes tab", () => {
		expect(
			quoteSubmissionNotificationHref({
				movieId: 550,
				tvId: null,
				seasonNumber: null,
				episodeNumber: null,
			}),
		).toBe("/movies/550?view=quotes");
	});

	test("links TV detail Quotes tab with season and episode", () => {
		expect(
			quoteSubmissionNotificationHref({
				movieId: null,
				tvId: 1399,
				seasonNumber: 1,
				episodeNumber: 3,
			}),
		).toBe("/tv/1399?view=quotes&season=1&episode=3");
	});
});

describe("parseQuoteSubmissionInput", () => {
	test("accepts movie submission", () => {
		const parsed = parseQuoteSubmissionInput({
			body: "  Hello, world  ",
			speaker: "Tyler",
			timestamp: "1:02:03",
			movieId: 550,
		});
		expect(parsed.body).toBe("Hello, world");
		expect(parsed.speaker).toBe("Tyler");
		expect(parsed.timestampMs).toBe(3_723_000);
		expect(parsed.scope.movieId).toBe(550);
	});

	test("accepts TV episode submission", () => {
		const parsed = parseQuoteSubmissionInput({
			body: "Winter is coming",
			tvId: 1399,
			seasonNumber: 1,
			episodeNumber: 1,
		});
		expect(parsed.scope.tvId).toBe(1399);
		expect(parsed.scope.seasonNumber).toBe(1);
		expect(parsed.scope.episodeNumber).toBe(1);
	});
});
