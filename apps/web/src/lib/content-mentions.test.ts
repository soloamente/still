import { describe, expect, test } from "bun:test";

import {
	formatListingMention,
	formatPatronMention,
	formatPersonMention,
	getActiveListingMentionQuery,
	getActivePeopleMentionQuery,
	insertListingMention,
	isPatronMentionQuery,
	migrateLegacyListingMentions,
	parseBodyWithMentions,
} from "@/lib/content-mentions";

describe("content mentions", () => {
	test("formats listing tokens with # prefix", () => {
		expect(
			formatListingMention({
				title: "Dune: Part Two",
				listingKind: "movie",
				tmdbId: 9664,
			}),
		).toBe("#[Dune: Part Two](/movies/9664)");
	});

	test("formats person and patron tokens", () => {
		expect(
			formatPersonMention({ name: "Timothée Chalamet", tmdbPersonId: 1190663 }),
		).toBe("@[Timothée Chalamet](/people/1190663)");
		expect(
			formatPatronMention({ displayName: "Jane Doe", handle: "jane_doe" }),
		).toBe("@[Jane Doe](/profile/jane_doe)");
	});

	test("parses legacy @ listings, new # listings, people, and patrons", () => {
		const body =
			"Loved #[The Matrix](/movies/603) and @[Legacy](/movies/999) plus @[Tim](/people/1) and @[Jane](/profile/jane)";
		expect(parseBodyWithMentions(body)).toEqual([
			{ type: "text", value: "Loved " },
			{
				type: "listing",
				label: "The Matrix",
				href: "/movies/603",
				listingKind: "movie",
			},
			{ type: "text", value: " and " },
			{
				type: "listing",
				label: "Legacy",
				href: "/movies/999",
				listingKind: "movie",
			},
			{ type: "text", value: " plus " },
			{
				type: "person",
				label: "Tim",
				href: "/people/1",
				tmdbPersonId: 1,
			},
			{ type: "text", value: " and " },
			{
				type: "patron",
				label: "Jane",
				href: "/profile/jane",
				handle: "jane",
			},
		]);
	});

	test("detects # listing query and @ people query", () => {
		expect(getActiveListingMentionQuery("Compare #brea", 13)).toEqual({
			query: "brea",
			start: 8,
			end: 13,
		});
		expect(getActivePeopleMentionQuery("Shout @tim", 11)).toEqual({
			query: "tim",
			start: 6,
			end: 11,
		});
	});

	test("patron mention heuristic", () => {
		expect(isPatronMentionQuery("jane_doe")).toBe(true);
		expect(isPatronMentionQuery("@jane_doe")).toBe(true);
		expect(isPatronMentionQuery("Timothée")).toBe(false);
		expect(isPatronMentionQuery("tim ch")).toBe(false);
	});

	test("migrates legacy listing @ tokens to #", () => {
		expect(
			migrateLegacyListingMentions("Old @[Matrix](/movies/603) stays readable"),
		).toBe("Old #[Matrix](/movies/603) stays readable");
		expect(
			migrateLegacyListingMentions("@[Jane](/profile/jane) untouched"),
		).toBe("@[Jane](/profile/jane) untouched");
	});

	test("inserts listing mention token at active range", () => {
		const body = "Compare #brea and go";
		const { nextBody, nextCursor } = insertListingMention(
			body,
			{ start: 8, end: 13 },
			{ title: "Breaking Bad", listingKind: "tv", tmdbId: 1396 },
		);
		expect(nextBody).toBe("Compare #[Breaking Bad](/tv/1396) and go");
		expect(nextCursor).toBe("Compare #[Breaking Bad](/tv/1396)".length);
	});
});
