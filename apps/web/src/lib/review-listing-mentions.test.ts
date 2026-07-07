import { describe, expect, test } from "bun:test";

import {
	formatReviewListingMention,
	getActiveListingMentionQuery,
	insertReviewListingMention,
	listingMentionPickerSubtitle,
	parseReviewBodyWithMentions,
} from "@/lib/review-listing-mentions";

describe("review listing mentions", () => {
	test("formats movie and tv tokens with # prefix", () => {
		expect(
			formatReviewListingMention({
				title: "Dune: Part Two",
				listingKind: "movie",
				tmdbId: 9664,
			}),
		).toBe("#[Dune: Part Two](/movies/9664)");
		expect(
			formatReviewListingMention({
				title: "Breaking Bad",
				listingKind: "tv",
				tmdbId: 1396,
			}),
		).toBe("#[Breaking Bad](/tv/1396)");
	});

	test("parses mixed text and legacy @ mentions", () => {
		const body = "Loved @[The Matrix](/movies/603) more than the sequel.";
		expect(parseReviewBodyWithMentions(body)).toEqual([
			{ type: "text", value: "Loved " },
			{
				type: "mention",
				label: "The Matrix",
				href: "/movies/603",
				listingKind: "movie",
			},
			{ type: "text", value: " more than the sequel." },
		]);
	});

	test("parses new # listing mentions", () => {
		const body = "Loved #[The Matrix](/movies/603) more than the sequel.";
		expect(parseReviewBodyWithMentions(body)).toEqual([
			{ type: "text", value: "Loved " },
			{
				type: "mention",
				label: "The Matrix",
				href: "/movies/603",
				listingKind: "movie",
			},
			{ type: "text", value: " more than the sequel." },
		]);
	});

	test("detects active # query at cursor", () => {
		const body = "Compare #brea";
		const active = getActiveListingMentionQuery(body, body.length);
		expect(active).toEqual({ query: "brea", start: 8, end: 13 });
	});

	test("inserts mention token at active range", () => {
		const body = "Compare #brea and go";
		const { nextBody, nextCursor } = insertReviewListingMention(
			body,
			{ start: 8, end: 13 },
			{ title: "Breaking Bad", listingKind: "tv", tmdbId: 1396 },
		);
		expect(nextBody).toBe("Compare #[Breaking Bad](/tv/1396) and go");
		expect(nextCursor).toBe("Compare #[Breaking Bad](/tv/1396)".length);
	});

	test("picker subtitle includes year when available", () => {
		expect(
			listingMentionPickerSubtitle({
				listingKind: "movie",
				release_date: "1999-03-31",
			}),
		).toBe("Film · 1999");
		expect(
			listingMentionPickerSubtitle({
				listingKind: "tv",
				first_air_date: "2008-01-20",
			}),
		).toBe("TV show · 2008");
		expect(
			listingMentionPickerSubtitle({
				listingKind: "movie",
			}),
		).toBe("Film");
	});
});
