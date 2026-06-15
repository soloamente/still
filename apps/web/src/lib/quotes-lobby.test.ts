import { describe, expect, test } from "bun:test";

import {
	buildQuoteSubmissionNotificationHref,
	buildQuotesLobbyHref,
	parseQuotesLobbyKind,
	savedQuoteListingHref,
} from "@/lib/quotes-lobby";

describe("quotes-lobby", () => {
	test("parseQuotesLobbyKind", () => {
		expect(parseQuotesLobbyKind(null)).toBe("all");
		expect(parseQuotesLobbyKind("movie")).toBe("movie");
		expect(parseQuotesLobbyKind("tv")).toBe("tv");
		expect(parseQuotesLobbyKind("nope")).toBe("all");
	});

	test("buildQuotesLobbyHref", () => {
		expect(buildQuotesLobbyHref({ kind: "all" })).toBe("/quotes");
		expect(buildQuotesLobbyHref({ kind: "movie" })).toBe("/quotes?kind=movie");
	});

	test("savedQuoteListingHref", () => {
		expect(
			savedQuoteListingHref({
				kind: "movie",
				id: 42,
				title: "Test",
				posterPath: null,
				posterUrl: null,
				year: 2020,
				seasonNumber: null,
				episodeNumber: null,
			}),
		).toBe("/movies/42?view=quotes");
		expect(
			savedQuoteListingHref({
				kind: "tv",
				id: 9,
				title: "Show",
				posterPath: null,
				posterUrl: null,
				year: null,
				seasonNumber: 2,
				episodeNumber: 3,
			}),
		).toBe("/tv/9?view=quotes&season=2&episode=3");
	});

	test("buildQuoteSubmissionNotificationHref", () => {
		expect(buildQuoteSubmissionNotificationHref({ movieId: 1 })).toBe(
			"/movies/1?view=quotes",
		);
		expect(
			buildQuoteSubmissionNotificationHref({
				tvId: 2,
				seasonNumber: 1,
				episodeNumber: 4,
			}),
		).toBe("/tv/2?view=quotes&season=1&episode=4");
	});
});
