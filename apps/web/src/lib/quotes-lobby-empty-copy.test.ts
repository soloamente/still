import { describe, expect, test } from "bun:test";

import { quotesLobbyEmptyCopy } from "@/lib/quotes-lobby-empty-copy";

describe("quotesLobbyEmptyCopy", () => {
	test("saved uses Films/Shows vocabulary and a browse CTA", () => {
		expect(
			quotesLobbyEmptyCopy({ view: "saved", kind: "all", status: "all" }),
		).toEqual({
			title: "No saved quotes yet",
			body: "Open a film or show, open the Quotes tab, and save lines you want to keep.",
			ctaLabel: "Browse films & shows",
		});
		expect(
			quotesLobbyEmptyCopy({ view: "saved", kind: "tv", status: "all" }).title,
		).toBe("No saved show quotes yet");
	});

	test("submitted points at suggest ritual", () => {
		const copy = quotesLobbyEmptyCopy({
			view: "submitted",
			kind: "all",
			status: "all",
		});
		expect(copy.title).toBe("No submissions yet");
		expect(copy.ctaLabel).toBe("Browse titles to suggest");
		expect(copy.body.toLowerCase()).toContain("suggest");
	});

	test("pending status empty keeps suggest CTA", () => {
		const copy = quotesLobbyEmptyCopy({
			view: "submitted",
			kind: "movie",
			status: "pending",
		});
		expect(copy.title).toBe("No quotes awaiting review");
		expect(copy.ctaLabel).toBe("Browse titles to suggest");
	});
});
